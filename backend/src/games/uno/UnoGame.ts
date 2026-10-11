import { BaseGame } from '../engine/BaseGame';
import { ActionResult, GamePlayerInfo, GameResult } from '../engine/types';
import { UnoCard, UnoColor, UnoGameState } from './types';
import { UnoDeck } from './UnoDeck';
import { UnoRules } from './UnoRules';

export class UnoGame extends BaseGame {
  readonly gameType = 'uno';
  readonly minPlayers = 2;
  readonly maxPlayers = 10;

  protected declare state: UnoGameState;

  public initializeState(_config: any): UnoGameState {
    const rawDeck = UnoDeck.createDeck();
    const deck = UnoDeck.shuffle(rawDeck);

    const hands: Record<string, UnoCard[]> = {};
    const hasCalledUno: Record<string, boolean> = {};

    // Deal 7 cards to each player
    for (const player of this.players) {
      hands[player.user_id] = deck.splice(0, 7);
      hasCalledUno[player.user_id] = false;
    }

    // Top starter card (ensure not wild4 for smooth opening)
    let topCard = deck.pop()!;
    while (topCard.color === 'wild') {
      deck.unshift(topCard);
      topCard = deck.pop()!;
    }

    const discardPile: UnoCard[] = [topCard];
    const activeColor: UnoColor = topCard.color;

    return {
      hands,
      deck,
      discardPile,
      currentTurn: this.players[0]!.user_id,
      turnDirection: 1,
      activeColor,
      drawCountPending: 0,
      hasCalledUno,
      winnerId: null,
      isFinished: false,
      gameType: 'uno',
    };
  }

  public override replacePlayer(oldUserId: string, newPlayer: GamePlayerInfo): boolean {
    const ok = super.replacePlayer(oldUserId, newPlayer);
    if (ok) {
      if (this.state.hands[oldUserId]) {
        this.state.hands[newPlayer.user_id] = this.state.hands[oldUserId]!;
        delete this.state.hands[oldUserId];
      }
      if (this.state.hasCalledUno[oldUserId] !== undefined) {
        this.state.hasCalledUno[newPlayer.user_id] = this.state.hasCalledUno[oldUserId]!;
        delete this.state.hasCalledUno[oldUserId];
      }
    }
    return ok;
  }

  public handleAction(userId: string, action: string, payload: any): ActionResult {
    if (this.state.isFinished) {
      return { success: false, error: 'Permainan UNO sudah selesai.' };
    }

    // Shout "UNO!" action (can be shouted on turn or off turn if holding 1 card)
    if (action === 'uno') {
      const hand = this.state.hands[userId] || [];
      if (hand.length <= 2) {
        this.state.hasCalledUno[userId] = true;
        return { success: true, action: 'uno_called', data: { userId } };
      }
      return { success: false, error: 'Hanya bisa panggil UNO saat kartu sisa 1 atau 2.' };
    }

    // Catch opponent who forgot to call UNO
    if (action === 'catch_uno') {
      const targetUserId = payload?.targetUserId;
      if (!targetUserId || targetUserId === userId) {
        return { success: false, error: 'Pemain target tidak sah.' };
      }
      const targetHand = this.state.hands[targetUserId] || [];
      if (targetHand.length === 1 && !this.state.hasCalledUno[targetUserId]) {
        // Penalty: draw 2 cards
        this.drawCardsForPlayer(targetUserId, 2);
        return {
          success: true,
          action: 'uno_penalized',
          data: { penalizedUser: targetUserId, message: 'Kena penalti 2 kartu karena lupa panggil UNO!' },
        };
      }
      return { success: false, error: 'Pemain target sudah panggil UNO atau kartunya bukan 1.' };
    }

    // Turn-based actions
    if (this.state.currentTurn !== userId) {
      return { success: false, error: 'Bukan giliran Anda.' };
    }

    // Draw card action
    if (action === 'draw') {
      const drawn = this.drawCardsForPlayer(userId, 1);
      this.state.hasCalledUno[userId] = false;

      // Pass turn to next player
      this.advanceTurn();
      return {
        success: true,
        action: 'draw',
        data: { drawnCount: drawn.length },
      };
    }

    // Play card action
    if (action === 'play') {
      const { cardId, chosenColor } = payload || {};
      const playerHand = this.state.hands[userId] || [];
      const cardIdx = playerHand.findIndex((c) => c.id === cardId);

      if (cardIdx === -1) {
        return { success: false, error: 'Kartu tidak ada di tangan Anda.' };
      }

      const card = playerHand[cardIdx]!;
      const topCard = this.getTopCard();

      if (!UnoRules.isValidPlay(card, topCard, this.state.activeColor)) {
        return { success: false, error: 'Kartu tidak cocok dengan warna atau angka saat ini.' };
      }

      // If Wild / Wild Draw Four, player must pick a valid color
      if (card.color === 'wild') {
        const validColors: UnoColor[] = ['red', 'yellow', 'green', 'blue'];
        if (!chosenColor || !validColors.includes(chosenColor)) {
          return { success: false, error: 'Pilih warna kartu (Merah, Kuning, Hijau, atau Biru).' };
        }
      }

      // Remove card from hand and place on discard pile
      playerHand.splice(cardIdx, 1);
      this.state.discardPile.push(card);

      // Update active color
      if (card.color === 'wild') {
        this.state.activeColor = chosenColor;
      } else {
        this.state.activeColor = card.color;
      }

      // Check win condition
      if (playerHand.length === 0) {
        this.state.winnerId = userId;
        this.state.isFinished = true;
        return {
          success: true,
          finished: true,
          results: this.getResults(),
        };
      }

      // Reset uno call if hand grew > 1
      if (playerHand.length > 1) {
        this.state.hasCalledUno[userId] = false;
      }

      // Apply card special effects
      let skipNext = false;

      if (card.value === 'skip') {
        skipNext = true;
      } else if (card.value === 'reverse') {
        if (this.players.length === 2) {
          skipNext = true; // 2 players: reverse acts like skip
        } else {
          this.state.turnDirection = (this.state.turnDirection * -1) as 1 | -1;
        }
      } else if (card.value === 'draw2') {
        const nextPlayerId = this.getNextPlayerId();
        this.drawCardsForPlayer(nextPlayerId, 2);
        skipNext = true;
      } else if (card.value === 'wild4') {
        const nextPlayerId = this.getNextPlayerId();
        this.drawCardsForPlayer(nextPlayerId, 4);
        skipNext = true;
      }

      // Advance turn
      this.advanceTurn(skipNext ? 2 : 1);

      return {
        success: true,
        data: {
          playedCard: card,
          activeColor: this.state.activeColor,
          cardsLeft: playerHand.length,
        },
      };
    }

    return { success: false, error: `Aksi "${action}" tidak dikenal di UNO.` };
  }

  // Draw n cards from deck, reshuffling discard pile if deck runs out
  private drawCardsForPlayer(userId: string, count: number): UnoCard[] {
    const drawn: UnoCard[] = [];
    for (let i = 0; i < count; i++) {
      if (this.state.deck.length === 0) {
        // Reshuffle discard pile except top card
        if (this.state.discardPile.length > 1) {
          const top = this.state.discardPile.pop()!;
          this.state.deck = UnoDeck.shuffle(this.state.discardPile);
          this.state.discardPile = [top];
        } else {
          break; // No more cards to draw
        }
      }
      const card = this.state.deck.pop();
      if (card) {
        drawn.push(card);
        this.state.hands[userId]?.push(card);
      }
    }
    return drawn;
  }

  private getTopCard(): UnoCard {
    return this.state.discardPile[this.state.discardPile.length - 1]!;
  }

  private getNextPlayerId(steps = 1): string {
    const pCount = this.players.length;
    const currentIdx = this.players.findIndex((p) => p.user_id === this.state.currentTurn);
    let nextIdx = (currentIdx + this.state.turnDirection * steps) % pCount;
    if (nextIdx < 0) nextIdx += pCount;
    return this.players[nextIdx]!.user_id;
  }

  private advanceTurn(steps = 1): void {
    this.state.currentTurn = this.getNextPlayerId(steps);
  }

  // ANTI-CHEAT: Only reveal current player's own hand!
  public getStateForPlayer(userId: string): any {
    const otherPlayers = this.players.map((p) => ({
      user_id: p.user_id,
      username: p.username,
      display_name: p.display_name,
      seat_number: p.seat_number,
      is_bot: p.is_bot,
      cardCount: (this.state.hands[p.user_id] || []).length,
      hasCalledUno: !!this.state.hasCalledUno[p.user_id],
    }));

    return {
      gameType: 'uno',
      myHand: this.state.hands[userId] || [],
      topCard: this.getTopCard(),
      activeColor: this.state.activeColor,
      currentTurn: this.state.currentTurn,
      turnDirection: this.state.turnDirection,
      deckCount: this.state.deck.length,
      discardCount: this.state.discardPile.length,
      hasCalledUno: !!this.state.hasCalledUno[userId],
      isFinished: this.state.isFinished,
      winnerId: this.state.winnerId,
      playersSummary: otherPlayers,
    };
  }

  public getStateForSpectator(): any {
    const otherPlayers = this.players.map((p) => ({
      user_id: p.user_id,
      username: p.username,
      display_name: p.display_name,
      seat_number: p.seat_number,
      is_bot: p.is_bot,
      cardCount: (this.state.hands[p.user_id] || []).length,
      hasCalledUno: !!this.state.hasCalledUno[p.user_id],
    }));

    return {
      gameType: 'uno',
      topCard: this.getTopCard(),
      activeColor: this.state.activeColor,
      currentTurn: this.state.currentTurn,
      turnDirection: this.state.turnDirection,
      deckCount: this.state.deck.length,
      discardCount: this.state.discardPile.length,
      isFinished: this.state.isFinished,
      winnerId: this.state.winnerId,
      playersSummary: otherPlayers,
    };
  }

  public isFinished(): boolean {
    return !!this.state.isFinished;
  }

  public getResults(): GameResult {
    const winner = this.state.winnerId || this.players[0]!.user_id;
    const losers = this.players.filter((p) => p.user_id !== winner).map((p) => p.user_id);

    const scores: Record<string, number> = {};
    for (const p of this.players) {
      const hand = this.state.hands[p.user_id] || [];
      const remainingScore = hand.reduce((acc, c) => acc + c.score, 0);
      scores[p.user_id] = remainingScore;
    }

    const winnerName = this.players.find((p) => p.user_id === winner)?.display_name || 'Pemain';

    return {
      winners: [winner],
      losers,
      scores,
      summary: `🎉 ${winnerName} berhasil menghabiskan kartu dan Menang UNO!`,
      pointsAwarded: 50,
    };
  }

  public getValidMoves(userId: string): UnoCard[] {
    if (this.state.currentTurn !== userId) return [];
    const hand = this.state.hands[userId] || [];
    const top = this.getTopCard();
    return hand.filter((c) => UnoRules.isValidPlay(c, top, this.state.activeColor));
  }

  public handleTimeout(userId: string): ActionResult {
    const botAction = this.getBotAction(userId);
    if (botAction) {
      return this.handleAction(userId, botAction.action, botAction.payload);
    }
    return this.handleAction(userId, 'draw', {});
  }

  // Bot AI automated execution
  public getBotAction(userId: string): { action: string; payload: any } | null {
    const hand = this.state.hands[userId] || [];
    if (hand.length === 0) return null;

    // If bot has 2 cards and is about to play one, auto call UNO
    if (hand.length === 2 && !this.state.hasCalledUno[userId]) {
      this.state.hasCalledUno[userId] = true;
    }

    const validMoves = this.getValidMoves(userId);
    if (validMoves.length > 0) {
      // Prioritize action cards or color matches
      const preferred =
        validMoves.find((c) => ['draw2', 'skip', 'reverse'].includes(c.value)) ||
        validMoves.find((c) => c.color === this.state.activeColor) ||
        validMoves[0]!;

      let chosenColor: UnoColor = 'red';
      if (preferred.color === 'wild') {
        // Pick bot's most prevalent color
        const colorCounts: Record<string, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
        for (const c of hand) {
          if (c.color !== 'wild') colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
        }
        chosenColor = (Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'red') as UnoColor;
      }

      return {
        action: 'play',
        payload: {
          cardId: preferred.id,
          chosenColor: preferred.color === 'wild' ? chosenColor : undefined,
        },
      };
    }

    // No valid cards: draw
    return { action: 'draw', payload: {} };
  }
}
