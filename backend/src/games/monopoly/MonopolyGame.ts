import { BaseGame } from '../engine/BaseGame';
import { ActionResult, GamePlayerInfo, GameResult } from '../engine/types';
import { MonopolyBoard } from './MonopolyBoard';
import { MonopolyCards } from './MonopolyCards';
import { MonopolyRules } from './MonopolyRules';
import { MonopolyCard, MonopolyGameState, MonopolyPlayerState, MonopolyPropertyState } from './types';

export class MonopolyGame extends BaseGame {
  readonly gameType = 'monopoly';
  readonly minPlayers = 2;
  readonly maxPlayers = 6;

  protected declare state: MonopolyGameState;

  constructor(players: GamePlayerInfo[], config?: any) {
    super(players, config);
  }

  public initializeState(config: any): MonopolyGameState {
    const playerStates: Record<string, MonopolyPlayerState> = {};
    const propertyStates: Record<number, MonopolyPropertyState> = {};
    const turnOrder = this.players.map((p) => p.user_id);

    for (const p of this.players) {
      playerStates[p.user_id] = {
        userId: p.user_id,
        money: MonopolyRules.STARTING_MONEY,
        position: 0,
        inJail: false,
        jailTurns: 0,
        isBankrupt: false,
        getOutOfJailCards: 0,
        properties: [],
      };
    }

    for (const sq of MonopolyBoard.SQUARES) {
      if (sq.type === 'property' || sq.type === 'station' || sq.type === 'utility') {
        propertyStates[sq.id] = {
          squareId: sq.id,
          ownerId: null,
          houses: 0,
          isMortgaged: false,
        };
      }
    }

    return {
      squares: MonopolyBoard.SQUARES,
      properties: propertyStates,
      players: playerStates,
      currentTurn: turnOrder[0] || '',
      turnOrder,
      dice: [1, 1],
      isDouble: false,
      doubleCount: 0,
      hasRolled: false,
      pendingAction: null,
      lastAction: null,
      isFinished: false,
      winnerId: null,
      modeBMC: !!config?.modeBMC,
    };
  }

  public handleAction(userId: string, action: string, payload: any): ActionResult {
    if (this.state.isFinished) {
      return { success: false, error: 'Permainan Monopoli sudah selesai.' };
    }

    // Auto-advance if currentTurn is on a bankrupt player
    if (this.state.players[this.state.currentTurn]?.isBankrupt && !this.state.isFinished) {
      const nextUser = this.getNextActivePlayer(this.state.currentTurn);
      if (nextUser) {
        this.state.currentTurn = nextUser;
        this.state.hasRolled = false;
        this.state.isDouble = false;
        this.state.doubleCount = 0;
        this.state.pendingAction = null;
      } else {
        this.state.isFinished = true;
        return { success: false, error: 'Permainan Monopoli sudah selesai.' };
      }
    }

    if (this.state.currentTurn !== userId) {
      return { success: false, error: 'Bukan giliran Anda!' };
    }

    const player = this.state.players[userId];
    if (!player || player.isBankrupt) {
      return { success: false, error: 'Pemain tidak valid atau sudah bangkrut.' };
    }

    switch (action) {
      case 'roll':
        return this.handleRoll(userId);

      case 'buy_property':
        return this.handleBuyProperty(userId);

      case 'skip_buy':
        return this.handleSkipBuy(userId);

      case 'build_house':
        return this.handleBuildHouse(userId, payload?.squareId);

      case 'pay_jail_fine':
        return this.handlePayJailFine(userId);

      case 'use_jail_card':
        return this.handleUseJailCard(userId);

      case 'end_turn':
        return this.handleEndTurn(userId);

      default:
        return { success: false, error: `Aksi "${action}" tidak dikenal.` };
    }
  }

  private handleRoll(userId: string): ActionResult {
    const player = this.state.players[userId]!;
    if (this.state.hasRolled && !this.state.isDouble) {
      return { success: false, error: 'Anda sudah melempar dadu giliran ini.' };
    }

    if (this.state.pendingAction) {
      return { success: false, error: 'Selesaikan aksi sebelumnya terlebih dahulu!' };
    }

    const dice = MonopolyBoard.rollDice();
    const isDouble = dice[0] === dice[1];
    this.state.dice = dice;
    this.state.isDouble = isDouble;
    this.state.hasRolled = true;

    if (isDouble) {
      this.state.doubleCount++;
      if (this.state.doubleCount >= 3) {
        // 3 kali lempar angka kembar = langsung masuk penjara
        return this.sendToJail(
          userId,
          `Dadu kembar 3 kali berturut-turut (${dice[0]}+${dice[1]})! Ditangkap polisi dan masuk penjara.`
        );
      }
    } else {
      this.state.doubleCount = 0;
    }

    // Handle In Jail logic
    if (player.inJail) {
      if (isDouble) {
        player.inJail = false;
        player.jailTurns = 0;
        this.state.lastAction = {
          userId,
          action: 'jail_escape',
          message: `Berhasil keluar dari Penjara dengan dadu kembar (${dice[0]}+${dice[1]})!`,
          dice,
        };
      } else {
        player.jailTurns++;
        if (player.jailTurns >= 3) {
          // Harus bayar Rp 50 setelah 3 ronde
          if (player.money >= MonopolyRules.JAIL_FINE) {
            player.money -= MonopolyRules.JAIL_FINE;
            player.inJail = false;
            player.jailTurns = 0;
            this.state.lastAction = {
              userId,
              action: 'jail_release',
              message: `Masa tahanan selesai! Membayar denda Rp ${MonopolyRules.JAIL_FINE} dan bebas.`,
              dice,
            };
          } else {
            return this.declareBankruptcy(userId, null, MonopolyRules.JAIL_FINE);
          }
        } else {
          this.state.lastAction = {
            userId,
            action: 'jail_stay',
            message: `Masih di penjara (Ronde ${player.jailTurns}/3). Dadu: ${dice[0]}+${dice[1]}.`,
            dice,
          };
          return { success: true };
        }
      }
    }

    // Move player
    const totalStep = dice[0] + dice[1];
    const prevPos = player.position;
    const newPos = (prevPos + totalStep) % MonopolyBoard.TOTAL_SQUARES;

    // Passed or landed on START (Bonus 200)
    let passBonus = false;
    if (newPos < prevPos || newPos === 0) {
      player.money += MonopolyRules.PASS_START_BONUS;
      passBonus = true;
    }

    player.position = newPos;
    const landedSquare = MonopolyBoard.getSquare(newPos);

    let msg = `Melempar ${dice[0]}+${dice[1]} (${totalStep}) ke "${landedSquare.name}"`;
    if (passBonus) msg += ' dan menerima Rp 200 lewat START';

    this.state.lastAction = {
      userId,
      action: 'move',
      message: msg,
      dice,
    };

    // Resolve landed square
    return this.resolveSquare(userId, landedSquare);
  }

  private resolveSquare(userId: string, square: ReturnType<typeof MonopolyBoard.getSquare>): ActionResult {
    const player = this.state.players[userId]!;

    if (square.type === 'go_to_jail') {
      return this.sendToJail(userId, `Mendarat di "Masuk Penjara"! Langsung ditahan di penjara.`);
    }

    if (square.type === 'tax') {
      const tax = square.taxAmount || 100;
      if (player.money < tax) {
        return this.declareBankruptcy(userId, null, tax);
      }
      player.money -= tax;
      this.state.lastAction = {
        userId,
        action: 'tax',
        message: `Membayar ${square.name} sebesar Rp ${tax}.`,
      };
      return { success: true };
    }

    if (square.type === 'chance') {
      const card = MonopolyCards.drawChance();
      return this.executeCard(userId, card);
    }

    if (square.type === 'community') {
      const card = MonopolyCards.drawCommunity();
      return this.executeCard(userId, card);
    }

    if (square.type === 'property' || square.type === 'station' || square.type === 'utility') {
      const propState = this.state.properties[square.id];
      if (!propState) return { success: true };

      if (!propState.ownerId) {
        // Can buy property
        this.state.pendingAction = {
          type: 'buy_property',
          squareId: square.id,
          amount: square.price,
        };
        return { success: true };
      } else if (propState.ownerId !== userId) {
        // Pay rent to owner
        const owner = this.state.players[propState.ownerId];
        if (!owner || owner.isBankrupt) return { success: true };

        const ownsAll = square.group ? MonopolyRules.doesPlayerOwnAllInGroup(this.state, owner.userId, square.group) : false;
        const stationsCount = MonopolyRules.getPlayerOwnedStationsCount(this.state, owner.userId);
        const rent = MonopolyBoard.calculateRent(square, propState.houses, ownsAll, stationsCount);

        if (player.money < rent) {
          return this.declareBankruptcy(userId, owner.userId, rent);
        }

        player.money -= rent;
        owner.money += rent;

        this.state.lastAction = {
          userId,
          action: 'rent',
          message: `Membayar sewa Rp ${rent} kepada ${this.getPlayerName(owner.userId)} di "${square.name}".`,
        };
        return { success: true };
      }
    }

    return { success: true };
  }

  private handleBuyProperty(userId: string): ActionResult {
    const pending = this.state.pendingAction;
    if (!pending || pending.type !== 'buy_property' || pending.squareId === undefined) {
      return { success: false, error: 'Tidak ada properti yang dapat dibeli saat ini.' };
    }

    const player = this.state.players[userId]!;
    const square = MonopolyBoard.getSquare(pending.squareId);
    const price = square.price || 100;

    if (player.money < price) {
      return { success: false, error: `Uang Anda tidak cukup (butuh Rp ${price}).` };
    }

    player.money -= price;
    player.properties.push(square.id);

    const prop = this.state.properties[square.id]!;
    prop.ownerId = userId;
    this.state.pendingAction = null;

    this.state.lastAction = {
      userId,
      action: 'buy',
      message: `Membeli properti "${square.name}" seharga Rp ${price}!`,
    };

    return { success: true };
  }

  private handleSkipBuy(userId: string): ActionResult {
    if (this.state.pendingAction?.type !== 'buy_property') {
      return { success: false, error: 'Tidak ada tawaran pembelian properti.' };
    }

    this.state.pendingAction = null;
    this.state.lastAction = {
      userId,
      action: 'skip_buy',
      message: `Melewatkan pembelian properti.`,
    };
    return { success: true };
  }

  private handleBuildHouse(userId: string, squareId: number): ActionResult {
    const valid = MonopolyRules.canBuildHouse(this.state, userId, squareId);
    if (!valid.canBuild) {
      return { success: false, error: valid.reason || 'Tidak dapat membangun.' };
    }

    const square = MonopolyBoard.getSquare(squareId);
    const cost = square.houseCost || 100;
    const player = this.state.players[userId]!;
    const prop = this.state.properties[squareId]!;

    player.money -= cost;
    prop.houses++;

    const isHotel = prop.houses === 5;
    this.state.lastAction = {
      userId,
      action: 'build',
      message: `Membangun ${isHotel ? 'HOTEL 🏨' : `Rumah ke-${prop.houses} 🏠`} di "${square.name}" (Rp ${cost}).`,
    };

    return { success: true };
  }

  private handlePayJailFine(userId: string): ActionResult {
    const player = this.state.players[userId]!;
    if (!player.inJail) {
      return { success: false, error: 'Anda sedang tidak berada di penjara.' };
    }

    if (player.money < MonopolyRules.JAIL_FINE) {
      return { success: false, error: `Uang tidak cukup bayar denda (butuh Rp ${MonopolyRules.JAIL_FINE}).` };
    }

    player.money -= MonopolyRules.JAIL_FINE;
    player.inJail = false;
    player.jailTurns = 0;

    this.state.lastAction = {
      userId,
      action: 'pay_jail',
      message: `Membayar denda Rp ${MonopolyRules.JAIL_FINE} dan bebas dari penjara!`,
    };
    return { success: true };
  }

  private handleUseJailCard(userId: string): ActionResult {
    const player = this.state.players[userId]!;
    if (!player.inJail) {
      return { success: false, error: 'Anda sedang tidak berada di penjara.' };
    }

    if (player.getOutOfJailCards <= 0) {
      return { success: false, error: 'Anda tidak memiliki kartu Bebas Penjara.' };
    }

    player.getOutOfJailCards--;
    player.inJail = false;
    player.jailTurns = 0;

    this.state.lastAction = {
      userId,
      action: 'card_jail_free',
      message: `Menggunakan kartu "Bebas Penjara" dan resmi bebas!`,
    };
    return { success: true };
  }

  private executeCard(userId: string, card: MonopolyCard): ActionResult {
    const player = this.state.players[userId]!;
    let extraMsg = '';

    switch (card.action.type) {
      case 'money':
        if (card.action.amount < 0 && player.money < Math.abs(card.action.amount)) {
          return this.declareBankruptcy(userId, null, Math.abs(card.action.amount));
        }
        player.money += card.action.amount;
        extraMsg = card.action.amount > 0 ? ` (+Rp ${card.action.amount})` : ` (-Rp ${Math.abs(card.action.amount)})`;
        break;

      case 'move':
        if (card.action.toPosition < 0) {
          // Relative step backward
          player.position = (player.position + card.action.toPosition + MonopolyBoard.TOTAL_SQUARES) % MonopolyBoard.TOTAL_SQUARES;
        } else {
          if (card.action.toPosition < player.position && card.action.toPosition === 0) {
            player.money += MonopolyRules.PASS_START_BONUS;
          }
          player.position = card.action.toPosition;
        }
        extraMsg = ` menuju ${MonopolyBoard.getSquare(player.position).name}`;
        break;

      case 'jail':
        return this.sendToJail(userId, `Kartu ${card.title}: ${card.description}`);

      case 'get_out_of_jail':
        player.getOutOfJailCards++;
        extraMsg = ` (Disimpan di tas kartu)`;
        break;

      case 'collect_all':
        for (const pid of this.state.turnOrder) {
          if (pid !== userId && !this.state.players[pid]?.isBankrupt) {
            const opp = this.state.players[pid]!;
            const amount = Math.min(opp.money, card.action.amountPerPlayer);
            opp.money -= amount;
            player.money += amount;
          }
        }
        break;

      case 'pay_all':
        for (const pid of this.state.turnOrder) {
          if (pid !== userId && !this.state.players[pid]?.isBankrupt) {
            const opp = this.state.players[pid]!;
            const amount = card.action.amountPerPlayer;
            if (player.money >= amount) {
              player.money -= amount;
              opp.money += amount;
            }
          }
        }
        break;
    }

    this.state.lastAction = {
      userId,
      action: 'draw_card',
      message: `[${card.type.toUpperCase()}] "${card.title}": ${card.description}${extraMsg}`,
    };

    return { success: true };
  }

  private sendToJail(userId: string, reason: string): ActionResult {
    const player = this.state.players[userId]!;
    player.position = 6; // Square 6 is Jail
    player.inJail = true;
    player.jailTurns = 0;
    this.state.isDouble = false;
    this.state.doubleCount = 0;
    this.state.pendingAction = null;

    this.state.lastAction = {
      userId,
      action: 'jail',
      message: reason,
    };

    return { success: true };
  }

  private declareBankruptcy(userId: string, creditorId: string | null, neededAmount: number): ActionResult {
    const player = this.state.players[userId]!;
    player.isBankrupt = true;
    player.money = 0;

    // Transfer properties to creditor or reset
    for (const sqId of player.properties) {
      const prop = this.state.properties[sqId];
      if (prop) {
        if (creditorId) {
          prop.ownerId = creditorId;
          const creditor = this.state.players[creditorId];
          if (creditor) creditor.properties.push(sqId);
        } else {
          prop.ownerId = null;
          prop.houses = 0;
        }
      }
    }
    player.properties = [];

    this.state.pendingAction = null;
    this.state.isDouble = false;
    this.state.doubleCount = 0;
    this.state.lastAction = {
      userId,
      action: 'bankrupt',
      message: `Pemain ${this.getPlayerName(userId)} BANGKRUT karena tidak dapat membayar Rp ${neededAmount}!`,
    };

    // Check game over
    const activePlayers = this.state.turnOrder.filter((id) => !this.state.players[id]?.isBankrupt);
    if (activePlayers.length <= 1) {
      const winner = activePlayers[0] || null;
      this.state.isFinished = true;
      this.state.winnerId = winner;
      return { success: true };
    }

    return this.handleEndTurn(userId);
  }

  private handleEndTurn(userId: string): ActionResult {
    if (this.state.pendingAction) {
      return { success: false, error: 'Selesaikan keputusan properti terlebih dahulu.' };
    }

    // Double dice allows another turn unless sent to jail OR bankrupt
    if (this.state.isDouble && !this.state.players[userId]?.inJail && !this.state.players[userId]?.isBankrupt) {
      this.state.hasRolled = false;
      this.state.isDouble = false;
      return { success: true };
    }

    const nextUser = this.getNextActivePlayer(userId);
    if (!nextUser) {
      this.state.isFinished = true;
      return { success: true };
    }

    this.state.currentTurn = nextUser;
    this.state.hasRolled = false;
    this.state.isDouble = false;
    this.state.doubleCount = 0;
    this.state.pendingAction = null;

    return { success: true };
  }

  private getNextActivePlayer(currentUserId: string): string | null {
    const order = this.state.turnOrder;
    const curIdx = order.indexOf(currentUserId);
    for (let i = 1; i <= order.length; i++) {
      const nextId = order[(curIdx + i) % order.length]!;
      if (!this.state.players[nextId]?.isBankrupt) {
        return nextId;
      }
    }
    return null;
  }

  private getPlayerName(userId: string): string {
    const p = this.players.find((pl) => pl.user_id === userId);
    return p?.display_name || p?.username || userId;
  }

  // BOT AI (Monopoly Smart Player)
  public getBotAction(userId: string): { action: string; payload: any } | null {
    const player = this.state.players[userId];
    if (!player || player.isBankrupt) {
      // If called for a bankrupt player or bot, auto-advance turn immediately
      return { action: 'end_turn', payload: {} };
    }

    // 1. In Jail decision
    if (player.inJail) {
      if (player.getOutOfJailCards > 0) {
        return { action: 'use_jail_card', payload: {} };
      }
      if (player.money >= 300) {
        return { action: 'pay_jail_fine', payload: {} };
      }
    }

    // 2. Pending Buy decision
    if (this.state.pendingAction?.type === 'buy_property') {
      const sqId = this.state.pendingAction.squareId!;
      const sq = MonopolyBoard.getSquare(sqId);
      const price = sq.price || 100;
      // Bot buys if it keeps at least 150 reserve money
      if (player.money - price >= 150) {
        return { action: 'buy_property', payload: {} };
      } else {
        return { action: 'skip_buy', payload: {} };
      }
    }

    // 3. Roll dice if haven't rolled yet
    if (!this.state.hasRolled) {
      return { action: 'roll', payload: {} };
    }

    // 4. Try building house on owned complete color groups
    for (const sqId of player.properties) {
      const check = MonopolyRules.canBuildHouse(this.state, userId, sqId);
      const sq = MonopolyBoard.getSquare(sqId);
      if (check.canBuild && player.money - (sq.houseCost || 100) >= 200) {
        return { action: 'build_house', payload: { squareId: sqId } };
      }
    }

    // 5. Otherwise end turn
    return { action: 'end_turn', payload: {} };
  }

  public handleTimeout(userId: string): ActionResult {
    const botAction = this.getBotAction(userId);
    if (botAction) {
      return this.handleAction(userId, botAction.action, botAction.payload);
    }
    return this.handleEndTurn(userId);
  }

  public isFinished(): boolean {
    return this.state.isFinished;
  }

  public getResults(): GameResult {
    const winnerId = this.state.winnerId || this.players[0]?.user_id || '';
    const losers = this.players.map((p) => p.user_id).filter((id) => id !== winnerId);
    const scores: Record<string, number> = {};
    for (const p of this.players) {
      scores[p.user_id] = this.state.players[p.user_id]?.money || 0;
    }
    const winnerName = this.getPlayerName(winnerId);
    return {
      winners: [winnerId],
      losers,
      scores,
      summary: `🎉 ${winnerName} menjadi Taipan Terkaya dan memenangkan Monopoli Warkop!`,
      pointsAwarded: 50,
    };
  }

  public getValidMoves(userId: string): any[] {
    if (this.state.currentTurn !== userId || this.state.isFinished) return [];
    const moves: string[] = [];
    const player = this.state.players[userId];
    if (!player || player.isBankrupt) return [];

    if (player.inJail) {
      if (player.getOutOfJailCards > 0) moves.push('use_jail_card');
      if (player.money >= MonopolyRules.JAIL_FINE) moves.push('pay_jail_fine');
    }

    if (this.state.pendingAction?.type === 'buy_property') {
      moves.push('buy_property', 'skip_buy');
    }

    if (!this.state.hasRolled) {
      moves.push('roll');
    } else if (!this.state.pendingAction) {
      moves.push('end_turn');
    }

    for (const sqId of player.properties) {
      if (MonopolyRules.canBuildHouse(this.state, userId, sqId).canBuild) {
        moves.push(`build_house_${sqId}`);
      }
    }

    return moves;
  }

  public override getRawState(): MonopolyGameState {
    // Self-healing: if current turn is on a bankrupt player, advance to next active player immediately
    if (this.state.players[this.state.currentTurn]?.isBankrupt && !this.state.isFinished) {
      const nextUser = this.getNextActivePlayer(this.state.currentTurn);
      if (nextUser) {
        this.state.currentTurn = nextUser;
        this.state.hasRolled = false;
        this.state.isDouble = false;
        this.state.doubleCount = 0;
        this.state.pendingAction = null;
      } else {
        this.state.isFinished = true;
      }
    }
    return this.state;
  }

  public getStateForPlayer(_userId: string): any {
    return this.getRawState();
  }

  public getStateForSpectator(): any {
    return this.getRawState();
  }
}
