import { BaseGame } from '../engine/BaseGame';
import { ActionResult, GamePlayerInfo, GameResult } from '../engine/types';
import { GaplehRules } from './GaplehRules';
import { DominoCard, GaplehMove, GaplehState, GaplehGameMode, GaplehRuleset } from './types';

export class GaplehGame extends BaseGame {
  readonly gameType = 'gapleh';
  readonly minPlayers = 2;
  readonly maxPlayers = 4;

  protected declare state: GaplehState;

  initializeState(config: any): GaplehState {
    const isPartnership = config?.gaplehMode === 'partnership';
    const gameMode: GaplehGameMode = isPartnership ? 'partnership' : 'individual';
    const ruleset: GaplehRuleset = config?.gaplehRuleset === 'tournament' ? 'tournament' : 'kampung';
    const targetScore = typeof config?.targetScore === 'number' ? config.targetScore : 250;

    // Sort players by seat_number to ensure correct seating alternation:
    // Seat 0 (A1), Seat 1 (B1), Seat 2 (A2), Seat 3 (B2)
    const sortedPlayers = [...this.players].sort((a, b) => (a.seat_number ?? 0) - (b.seat_number ?? 0));
    const playerIds = sortedPlayers.map((p) => p.user_id);

    const teams: Record<string, 'A' | 'B'> = {};
    if (isPartnership) {
      sortedPlayers.forEach((p, idx) => {
        const seat = typeof p.seat_number === 'number' ? p.seat_number : idx;
        teams[p.user_id] = seat % 2 === 0 ? 'A' : 'B';
      });
    }

    const { hands } = GaplehRules.dealCards(playerIds);
    const { startingPlayerId } = GaplehRules.findStartingPlayer(hands, playerIds);

    return {
      board: {
        leftEnd: null,
        rightEnd: null,
        placedCards: [],
      },
      hands,
      currentTurn: startingPlayerId,
      turnOrder: [...playerIds],
      passCount: 0,
      lastAction: null,
      isFinished: false,
      winnerId: null,
      deadlock: false,
      scores: {},
      round: 1,

      // Partnership configuration and tracking
      gameMode,
      ruleset,
      targetScore,
      teams,
      teamPips: undefined,
      roundPoints: { A: 0, B: 0 },
      matchScores: { A: 0, B: 0 },
      winningTeam: undefined,
      winReason: undefined,
      partnershipSummary: undefined,
      isMatchOver: false,
    };
  }

  handleAction(userId: string, action: string, payload: any): ActionResult {
    if (this.state.isFinished) {
      return { success: false, error: 'Permainan telah selesai.' };
    }

    if (!this.isPlayerTurn(userId)) {
      return { success: false, error: 'Bukan giliran Anda.' };
    }

    const currentHand = this.state.hands[userId] || [];

    if (action === 'play') {
      const card: DominoCard = payload.card;
      const side: 'left' | 'right' = payload.side || 'left';

      if (!card || !Array.isArray(card) || card.length !== 2) {
        return { success: false, error: 'Format kartu tidak valid.' };
      }

      const validation = GaplehRules.validateMove(card, side, currentHand, this.state.board);
      if (!validation.valid || !validation.orientedCard) {
        return { success: false, error: validation.error || 'Langkah kartu tidak sah.' };
      }

      // Remove played card from player's hand
      const cardIndex = currentHand.findIndex(
        ([a, b]) => (a === card[0] && b === card[1]) || (a === card[1] && b === card[0])
      );
      currentHand.splice(cardIndex, 1);

      // Place card onto board
      const isFirst = this.state.board.placedCards.length === 0;
      const oriented = validation.orientedCard;
      const isDouble = oriented[0] === oriented[1];

      if (isFirst) {
        this.state.board.placedCards.push({
          card: oriented,
          side: 'initial',
          rotation: isDouble ? 0 : 90,
        });
      } else if (side === 'left') {
        this.state.board.placedCards.unshift({
          card: oriented,
          side: 'left',
          rotation: isDouble ? 0 : 90,
        });
      } else {
        this.state.board.placedCards.push({
          card: oriented,
          side: 'right',
          rotation: isDouble ? 0 : 90,
        });
      }

      this.state.board.leftEnd = validation.newLeftEnd!;
      this.state.board.rightEnd = validation.newRightEnd!;
      this.state.passCount = 0; // Reset pass streak

      this.state.lastAction = {
        userId,
        action: 'play',
        card: oriented,
        side,
      };

      // Check win condition: empty hand
      if (currentHand.length === 0) {
        this.state.isFinished = true;
        this.finishWithCardClear(userId);

        return {
          success: true,
          action: 'play',
          data: { card: oriented, side, remaining: 0 },
          finished: true,
          results: this.getResults(),
        };
      }

      // Advance turn
      const nextTurn = this.advanceTurn();
      return {
        success: true,
        action: 'play',
        data: { card: oriented, side, remaining: currentHand.length },
        nextTurn,
      };
    } else if (action === 'pass') {
      // Validate that player truly cannot move
      const validMoves = GaplehRules.getValidMoves(currentHand, this.state.board);
      if (validMoves.length > 0) {
        return {
          success: false,
          error: 'Anda memiliki kartu yang bisa dimainkan! Tidak boleh pass.',
        };
      }

      this.state.passCount += 1;
      this.state.lastAction = {
        userId,
        action: 'pass',
      };

      // Check deadlock condition: all players passed consecutively
      if (this.state.passCount >= this.players.length) {
        this.state.isFinished = true;
        this.state.deadlock = true;
        this.finishWithDeadlock();

        return {
          success: true,
          action: 'pass',
          finished: true,
          results: this.getResults(),
        };
      }

      const nextTurn = this.advanceTurn();
      return {
        success: true,
        action: 'pass',
        nextTurn,
      };
    }

    return { success: false, error: `Aksi "${action}" tidak dikenal.` };
  }

  private finishWithCardClear(userId: string): void {
    if (this.state.gameMode === 'partnership') {
      const playerIds = this.players.map((p) => p.user_id);
      if (this.state.ruleset === 'tournament') {
        const res = GaplehRules.resolvePartnershipTournament(
          this.state.hands,
          this.state.teams,
          playerIds,
          this.state.matchScores,
          this.state.targetScore,
          userId
        );
        this.state.winningTeam = res.winnerTeam;
        this.state.winReason = res.winReason;
        this.state.teamPips = res.teamPips;
        this.state.scores = res.individualPips;
        this.state.roundPoints = res.roundPoints;
        this.state.matchScores = res.newMatchScores;
        this.state.isMatchOver = res.isMatchOver;
        this.state.partnershipSummary = res.summary;
        this.state.winnerId = res.winners[0] || userId;
      } else {
        // Kampung ruleset
        const res = GaplehRules.resolvePartnershipKampung(
          this.state.hands,
          this.state.teams,
          playerIds,
          userId
        );
        this.state.winningTeam = res.winnerTeam;
        this.state.winReason = res.winReason;
        this.state.teamPips = res.teamPips;
        this.state.scores = res.individualPips;
        this.state.roundPoints = { A: res.winnerTeam === 'A' ? 50 : 0, B: res.winnerTeam === 'B' ? 50 : 0 };
        this.state.partnershipSummary = res.summary;
        this.state.winnerId = res.winners[0] || userId;
      }
    } else {
      // Individual mode
      this.state.winnerId = userId;
      this.calculateFinalScores(userId, false);
    }
  }

  private finishWithDeadlock(): void {
    const playerIds = this.players.map((p) => p.user_id);
    if (this.state.gameMode === 'partnership') {
      if (this.state.ruleset === 'tournament') {
        const res = GaplehRules.resolvePartnershipTournament(
          this.state.hands,
          this.state.teams,
          playerIds,
          this.state.matchScores,
          this.state.targetScore,
          null
        );
        this.state.winningTeam = res.winnerTeam;
        this.state.winReason = res.winReason;
        this.state.teamPips = res.teamPips;
        this.state.scores = res.individualPips;
        this.state.roundPoints = res.roundPoints;
        this.state.matchScores = res.newMatchScores;
        this.state.isMatchOver = res.isMatchOver;
        this.state.partnershipSummary = res.summary;
        this.state.winnerId = res.winners[0] || null;
      } else {
        // Kampung ruleset
        const res = GaplehRules.resolvePartnershipKampung(
          this.state.hands,
          this.state.teams,
          playerIds,
          null
        );
        this.state.winningTeam = res.winnerTeam;
        this.state.winReason = res.winReason;
        this.state.teamPips = res.teamPips;
        this.state.scores = res.individualPips;
        this.state.roundPoints = { A: res.winnerTeam === 'A' ? 50 : 0, B: res.winnerTeam === 'B' ? 50 : 0 };
        this.state.partnershipSummary = res.summary;
        this.state.winnerId = res.winners[0] || null;
      }
    } else {
      // Individual mode
      const { winnerId } = GaplehRules.resolveDeadlock(this.state.hands, playerIds);
      this.state.winnerId = winnerId;
      this.calculateFinalScores(winnerId, true);
    }
  }

  // Advance turn to next player in circular order
  private advanceTurn(): string {
    const currentIndex = this.state.turnOrder.indexOf(this.state.currentTurn);
    const nextIndex = (currentIndex + 1) % this.state.turnOrder.length;
    this.state.currentTurn = this.state.turnOrder[nextIndex] || '';
    return this.state.currentTurn;
  }

  // Calculate scores upon match completion (Individual mode)
  private calculateFinalScores(winnerId: string, deadlock: boolean): void {
    const scores: Record<string, number> = {};
    for (const player of this.players) {
      const hand = this.state.hands[player.user_id] || [];
      const pips = GaplehRules.calculateHandPips(hand);
      scores[player.user_id] = pips;
    }
    this.state.scores = scores;
  }

  getStateForPlayer(userId: string): any {
    const myHand = this.state.hands[userId] || [];
    const opponents: Record<string, { cardCount: number }> = {};

    for (const player of this.players) {
      if (player.user_id !== userId) {
        opponents[player.user_id] = {
          cardCount: (this.state.hands[player.user_id] || []).length,
        };
      }
    }

    const validMoves = this.isPlayerTurn(userId)
      ? GaplehRules.getValidMoves(myHand, this.state.board)
      : [];

    return {
      gameType: this.gameType,
      board: this.state.board,
      myHand,
      opponents,
      currentTurn: this.state.currentTurn,
      turnOrder: this.state.turnOrder,
      validMoves,
      canPass: this.isPlayerTurn(userId) && validMoves.length === 0,
      passCount: this.state.passCount,
      lastAction: this.state.lastAction,
      isFinished: this.state.isFinished,
      winnerId: this.state.winnerId,
      deadlock: this.state.deadlock,
      scores: this.state.isFinished ? this.state.scores : undefined,
      // Partnership extras
      gameMode: this.state.gameMode,
      ruleset: this.state.ruleset,
      targetScore: this.state.targetScore,
      teams: this.state.teams,
      teamPips: this.state.isFinished ? this.state.teamPips : undefined,
      roundPoints: this.state.roundPoints,
      matchScores: this.state.matchScores,
      winningTeam: this.state.winningTeam,
      winReason: this.state.winReason,
      partnershipSummary: this.state.partnershipSummary,
      isMatchOver: this.state.isMatchOver,
    };
  }

  getStateForSpectator(): any {
    const playersHandCounts: Record<string, { cardCount: number }> = {};
    for (const player of this.players) {
      playersHandCounts[player.user_id] = {
        cardCount: (this.state.hands[player.user_id] || []).length,
      };
    }

    return {
      gameType: this.gameType,
      board: this.state.board,
      players: playersHandCounts,
      currentTurn: this.state.currentTurn,
      turnOrder: this.state.turnOrder,
      lastAction: this.state.lastAction,
      isFinished: this.state.isFinished,
      winnerId: this.state.winnerId,
      deadlock: this.state.deadlock,
      scores: this.state.isFinished ? this.state.scores : undefined,
      // Partnership extras
      gameMode: this.state.gameMode,
      ruleset: this.state.ruleset,
      targetScore: this.state.targetScore,
      teams: this.state.teams,
      teamPips: this.state.isFinished ? this.state.teamPips : undefined,
      roundPoints: this.state.roundPoints,
      matchScores: this.state.matchScores,
      winningTeam: this.state.winningTeam,
      winReason: this.state.winReason,
      partnershipSummary: this.state.partnershipSummary,
      isMatchOver: this.state.isMatchOver,
    };
  }

  isFinished(): boolean {
    return this.state.isFinished;
  }

  getResults(): GameResult {
    if (this.state.gameMode === 'partnership') {
      const playerIds = this.players.map((p) => p.user_id);
      const winningTeam = this.state.winningTeam;

      const winners = winningTeam
        ? playerIds.filter((id) => this.state.teams[id] === winningTeam)
        : [];
      const losers = winningTeam
        ? playerIds.filter((id) => this.state.teams[id] !== winningTeam)
        : playerIds;

      const teamANames = this.players
        .filter((p) => this.state.teams[p.user_id] === 'A')
        .map((p) => p.display_name || p.username)
        .join(' & ');
      const teamBNames = this.players
        .filter((p) => this.state.teams[p.user_id] === 'B')
        .map((p) => p.display_name || p.username)
        .join(' & ');

      let summary = this.state.partnershipSummary || '';
      if (!summary) {
        if (winningTeam) {
          summary = `Tim ${winningTeam} (${winningTeam === 'A' ? teamANames : teamBNames}) memenangkan putaran!`;
        } else {
          summary = 'Putaran berakhir seri!';
        }
      }

      const pointsAwarded =
        this.state.ruleset === 'kampung'
          ? (winningTeam ? 50 : 0)
          : (this.state.isMatchOver ? 50 : 0);

      return {
        winners,
        losers,
        scores: this.state.scores,
        summary,
        pointsAwarded,
      };
    }

    // Individual mode (standard)
    const winnerId = this.state.winnerId || (this.players[0] ? this.players[0].user_id : '');
    const losers = this.players.map((p) => p.user_id).filter((id) => id !== winnerId);

    const winnerPlayer = this.players.find((p) => p.user_id === winnerId);
    const summary = this.state.deadlock
      ? `Gaple Buntu! Pemenang poin terendah adalah ${winnerPlayer?.display_name || 'Pemain'}.`
      : `Selamat! ${winnerPlayer?.display_name || 'Pemain'} berhasil menghabiskan semua kartu!`;

    return {
      winners: [winnerId],
      losers,
      scores: this.state.scores,
      summary,
      pointsAwarded: 50,
    };
  }

  getValidMoves(userId: string): GaplehMove[] {
    const hand = this.state.hands[userId] || [];
    return GaplehRules.getValidMoves(hand, this.state.board);
  }

  handleTimeout(userId: string): ActionResult {
    const validMoves = this.getValidMoves(userId);
    if (validMoves.length > 0 && validMoves[0]) {
      // Pick first valid move
      const move = validMoves[0];
      return this.handleAction(userId, 'play', { card: move.card, side: move.side });
    } else {
      return this.handleAction(userId, 'pass', {});
    }
  }

  getBotAction(userId: string): { action: string; payload: any } | null {
    if (!this.isPlayerTurn(userId)) return null;

    const validMoves = this.getValidMoves(userId);
    if (validMoves.length === 0 || !validMoves[0]) {
      return { action: 'pass', payload: {} };
    }

    // Heuristic: Prefer playing heavier cards or balaks first to reduce pip risk
    validMoves.sort((a, b) => {
      const isBalakA = a.card[0] === a.card[1] ? 10 : 0;
      const isBalakB = b.card[0] === b.card[1] ? 10 : 0;
      const sumA = a.card[0] + a.card[1] + isBalakA;
      const sumB = b.card[0] + b.card[1] + isBalakB;
      return sumB - sumA;
    });

    const bestMove = validMoves[0];
    if (!bestMove) return { action: 'pass', payload: {} };
    return {
      action: 'play',
      payload: { card: bestMove.card, side: bestMove.side },
    };
  }
}
