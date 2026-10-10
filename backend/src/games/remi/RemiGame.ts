import { BaseGame } from '../engine/BaseGame';
import { ActionResult, GamePlayerInfo, GameResult } from '../engine/types';
import { StandardCardDeck, PlayingCard } from '../cards/StandardCardDeck';

export class RemiGame extends BaseGame {
  readonly gameType = 'remi';
  readonly minPlayers = 2;
  readonly maxPlayers = 4;

  public initializeState(_config: any) {
    const deck = StandardCardDeck.createDeck();
    const hands: Record<string, PlayingCard[]> = {};

    // Deal 7 cards per player
    for (const player of this.players) {
      hands[player.user_id] = deck.splice(0, 7);
    }

    const discardPile: PlayingCard[] = [deck.pop()!];

    return {
      hands,
      deck,
      discardPile,
      currentTurn: this.players[0]!.user_id,
      turnPhase: 'draw' as 'draw' | 'discard',
      winnerId: null as string | null,
      isFinished: false,
    };
  }

  public handleAction(userId: string, action: string, payload: any): ActionResult {
    if (this.state.isFinished) return { success: false, error: 'Permainan remi sudah selesai.' };
    if (this.state.currentTurn !== userId) return { success: false, error: 'Bukan giliran Anda.' };

    const hand = this.state.hands[userId] || [];

    if (action === 'draw') {
      if (this.state.turnPhase !== 'draw') {
        return { success: false, error: 'Anda sudah mengambil kartu. Sekarang buang 1 kartu.' };
      }

      const source = payload?.source || 'deck';
      let drawnCard: PlayingCard | undefined;

      if (source === 'discard' && this.state.discardPile.length > 0) {
        drawnCard = this.state.discardPile.pop();
      } else if (this.state.deck.length > 0) {
        drawnCard = this.state.deck.pop();
      } else if (this.state.discardPile.length > 1) {
        // Recycle discard pile
        const top = this.state.discardPile.pop()!;
        this.state.deck = StandardCardDeck.shuffle(this.state.discardPile);
        this.state.discardPile = [top];
        drawnCard = this.state.deck.pop();
      }

      if (!drawnCard) return { success: false, error: 'Tumpukan kartu habis.' };

      hand.push(drawnCard);
      this.state.turnPhase = 'discard';
      return { success: true };
    }

    if (action === 'discard') {
      if (this.state.turnPhase !== 'discard') {
        return { success: false, error: 'Silakan ambil kartu terlebih dahulu.' };
      }

      const { suit, rank } = payload || {};
      const cardIdx = hand.findIndex((c: PlayingCard) => c.suit === suit && c.rank === rank);
      if (cardIdx === -1) return { success: false, error: 'Kartu tidak ada di tangan Anda.' };

      const [removed] = hand.splice(cardIdx, 1);
      this.state.discardPile.push(removed!);

      // Check win condition (empty hand or declares win)
      if (hand.length === 0) {
        this.state.winnerId = userId;
        this.state.isFinished = true;
        return { success: true, finished: true, results: this.getResults() };
      }

      // Pass turn to next player
      const currentIdx = this.players.findIndex((p) => p.user_id === userId);
      const nextIdx = (currentIdx + 1) % this.players.length;
      this.state.currentTurn = this.players[nextIdx]!.user_id;
      this.state.turnPhase = 'draw';

      return { success: true };
    }

    return { success: false, error: `Aksi "${action}" tidak dikenal di remi.` };
  }

  public getStateForPlayer(userId: string) {
    const opponents: Record<string, { cardCount: number }> = {};
    for (const p of this.players) {
      if (p.user_id !== userId) {
        opponents[p.user_id] = { cardCount: (this.state.hands[p.user_id] || []).length };
      }
    }

    return {
      gameType: 'remi',
      myHand: this.state.hands[userId] || [],
      opponents,
      deckCount: this.state.deck.length,
      topDiscard: this.state.discardPile[this.state.discardPile.length - 1] || null,
      currentTurn: this.state.currentTurn,
      turnPhase: this.state.turnPhase,
      isFinished: this.state.isFinished,
      winnerId: this.state.winnerId,
    };
  }

  public getStateForSpectator() {
    return {
      gameType: 'remi',
      opponents: Object.fromEntries(
        this.players.map((p) => [p.user_id, { cardCount: (this.state.hands[p.user_id] || []).length }])
      ),
      deckCount: this.state.deck.length,
      topDiscard: this.state.discardPile[this.state.discardPile.length - 1] || null,
      currentTurn: this.state.currentTurn,
      turnPhase: this.state.turnPhase,
      isFinished: this.state.isFinished,
      winnerId: this.state.winnerId,
    };
  }

  public isFinished(): boolean {
    return !!this.state.isFinished;
  }

  public getResults(): GameResult {
    const winner = this.state.winnerId || this.players[0]!.user_id;
    const losers = this.players.filter((p) => p.user_id !== winner).map((p) => p.user_id);
    return {
      winners: [winner],
      losers,
      scores: { [winner]: 100 },
      summary: `Pemenang Remi: ${this.players.find((p) => p.user_id === winner)?.display_name || 'Pemain'}!`,
    };
  }

  public getValidMoves(userId: string): any[] {
    if (this.state.currentTurn !== userId) return [];
    if (this.state.turnPhase === 'draw') {
      return [{ action: 'draw', payload: { source: 'deck' } }, { action: 'draw', payload: { source: 'discard' } }];
    }
    const hand = this.state.hands[userId] || [];
    return hand.map((c: PlayingCard) => ({ action: 'discard', payload: { suit: c.suit, rank: c.rank } }));
  }

  public handleTimeout(userId: string): ActionResult {
    const botAction = this.getBotAction(userId);
    if (botAction) return this.handleAction(userId, botAction.action, botAction.payload);
    return { success: false, error: 'Waktu habis.' };
  }

  public getBotAction(userId: string): { action: string; payload: any } | null {
    if (this.state.currentTurn !== userId) return null;
    if (this.state.turnPhase === 'draw') {
      return { action: 'draw', payload: { source: 'deck' } };
    }
    const hand = this.state.hands[userId] || [];
    if (hand.length === 0) return null;
    const card = hand[0]!;
    return { action: 'discard', payload: { suit: card.suit, rank: card.rank } };
  }
}
