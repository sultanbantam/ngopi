import { BaseGame } from '../engine/BaseGame';
import { ActionResult, GamePlayerInfo, GameResult } from '../engine/types';
import { StandardCardDeck, PlayingCard, CardSuit } from '../cards/StandardCardDeck';

export class BridgeGame extends BaseGame {
  readonly gameType = 'bridge';
  readonly minPlayers = 4;
  readonly maxPlayers = 4;

  public initializeState(_config: any) {
    const deck = StandardCardDeck.createDeck();
    const hands: Record<string, PlayingCard[]> = {};

    // Deal 13 cards to each of the 4 players
    for (const player of this.players) {
      hands[player.user_id] = deck.splice(0, 13);
    }

    return {
      hands,
      trumpSuit: 'spades' as CardSuit,
      currentTrick: [] as Array<{ playerId: string; card: PlayingCard }>,
      tricksWon: Object.fromEntries(this.players.map((p) => [p.user_id, 0])),
      currentTurn: this.players[0]!.user_id,
      winnerId: null as string | null,
      isFinished: false,
    };
  }

  public handleAction(userId: string, action: string, payload: any): ActionResult {
    if (this.state.isFinished) return { success: false, error: 'Permainan bridge sudah selesai.' };
    if (this.state.currentTurn !== userId) return { success: false, error: 'Bukan giliran Anda.' };

    if (action === 'play') {
      const { suit, rank } = payload || {};
      const hand = this.state.hands[userId] || [];
      const cardIdx = hand.findIndex((c: PlayingCard) => c.suit === suit && c.rank === rank);
      if (cardIdx === -1) return { success: false, error: 'Kartu tidak ada di tangan Anda.' };

      const [card] = hand.splice(cardIdx, 1);
      this.state.currentTrick.push({ playerId: userId, card: card! });

      // If trick is full (4 cards played)
      if (this.state.currentTrick.length === this.players.length) {
        // Evaluate trick winner: highest trump or highest lead suit
        const leadSuit = this.state.currentTrick[0]!.card.suit;
        let bestTrick = this.state.currentTrick[0]!;

        for (const t of this.state.currentTrick) {
          if (t.card.suit === this.state.trumpSuit && bestTrick.card.suit !== this.state.trumpSuit) {
            bestTrick = t;
          } else if (t.card.suit === bestTrick.card.suit && t.card.value > bestTrick.card.value) {
            bestTrick = t;
          }
        }

        this.state.tricksWon[bestTrick.playerId] = (this.state.tricksWon[bestTrick.playerId] || 0) + 1;
        this.state.currentTurn = bestTrick.playerId;
        this.state.currentTrick = [];

        // Check if all cards played
        const anyCardsLeft = Object.values(this.state.hands).some((h: any) => h.length > 0);
        if (!anyCardsLeft) {
          let maxTricks = -1;
          let winner = this.players[0]!.user_id;
          for (const [pId, tricks] of Object.entries(this.state.tricksWon)) {
            if ((tricks as number) > maxTricks) {
              maxTricks = tricks as number;
              winner = pId;
            }
          }
          this.state.winnerId = winner;
          this.state.isFinished = true;
          return { success: true, finished: true, results: this.getResults() };
        }

        return { success: true };
      }

      // Next player in trick
      const curIdx = this.players.findIndex((p) => p.user_id === userId);
      const nextIdx = (curIdx + 1) % this.players.length;
      this.state.currentTurn = this.players[nextIdx]!.user_id;
      return { success: true };
    }

    return { success: false, error: `Aksi "${action}" tidak dikenal di bridge.` };
  }

  public getStateForPlayer(userId: string) {
    return {
      gameType: 'bridge',
      myHand: this.state.hands[userId] || [],
      trumpSuit: this.state.trumpSuit,
      currentTrick: this.state.currentTrick,
      tricksWon: this.state.tricksWon,
      currentTurn: this.state.currentTurn,
      isFinished: this.state.isFinished,
      winnerId: this.state.winnerId,
    };
  }

  public getStateForSpectator() {
    return {
      gameType: 'bridge',
      trumpSuit: this.state.trumpSuit,
      currentTrick: this.state.currentTrick,
      tricksWon: this.state.tricksWon,
      currentTurn: this.state.currentTurn,
      isFinished: this.state.isFinished,
      winnerId: this.state.winnerId,
    };
  }

  public isFinished(): boolean {
    return !!this.state.isFinished;
  }

  public getResults(): GameResult {
    const winner = this.state.winnerId || this.players[0]!.user_id;
    return {
      winners: [winner],
      scores: this.state.tricksWon,
      summary: `Pemenang Bridge: ${this.players.find((p) => p.user_id === winner)?.display_name || 'Pemain'} (${this.state.tricksWon[winner]} Trick)!`,
    };
  }

  public getValidMoves(userId: string): any[] {
    if (this.state.currentTurn !== userId) return [];
    const hand = this.state.hands[userId] || [];
    return hand.map((c: PlayingCard) => ({ action: 'play', payload: { suit: c.suit, rank: c.rank } }));
  }

  public handleTimeout(userId: string): ActionResult {
    const botAction = this.getBotAction(userId);
    if (botAction) return this.handleAction(userId, botAction.action, botAction.payload);
    return { success: false, error: 'Waktu habis.' };
  }

  public getBotAction(userId: string): { action: string; payload: any } | null {
    if (this.state.currentTurn !== userId) return null;
    const hand = this.state.hands[userId] || [];
    if (hand.length === 0) return null;
    const card = hand[0]!;
    return { action: 'play', payload: { suit: card.suit, rank: card.rank } };
  }
}
