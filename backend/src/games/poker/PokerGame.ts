import { BaseGame } from '../engine/BaseGame';
import { ActionResult, GamePlayerInfo, GameResult } from '../engine/types';
import { StandardCardDeck, PlayingCard } from '../cards/StandardCardDeck';

export class PokerGame extends BaseGame {
  readonly gameType = 'poker';
  readonly minPlayers = 2;
  readonly maxPlayers = 6;

  public initializeState(_config: any) {
    const deck = StandardCardDeck.createDeck();
    const hands: Record<string, PlayingCard[]> = {};

    // Deal 2 hole cards per player
    for (const player of this.players) {
      hands[player.user_id] = deck.splice(0, 2);
    }

    // Community cards: 5 cards
    const communityCards = deck.splice(0, 5);

    return {
      hands,
      deck,
      communityCards,
      stage: 'flop' as 'preflop' | 'flop' | 'turn' | 'river' | 'showdown',
      pot: this.players.length * 10,
      currentTurn: this.players[0]!.user_id,
      folded: [] as string[],
      winnerId: null as string | null,
      isFinished: false,
    };
  }

  public handleAction(userId: string, action: string, payload: any): ActionResult {
    if (this.state.isFinished) return { success: false, error: 'Permainan poker sudah selesai.' };
    if (this.state.currentTurn !== userId) return { success: false, error: 'Bukan giliran Anda.' };

    if (action === 'fold') {
      this.state.folded.push(userId);
      const remaining = this.players.filter((p) => !this.state.folded.includes(p.user_id));
      if (remaining.length === 1) {
        this.state.winnerId = remaining[0]!.user_id;
        this.state.isFinished = true;
        return { success: true, finished: true, results: this.getResults() };
      }
    } else if (action === 'bet' || action === 'raise') {
      const amount = Number(payload?.amount) || 10;
      this.state.pot += amount;
    } else if (action === 'check' || action === 'call') {
      // standard check or call
    } else {
      return { success: false, error: `Aksi "${action}" tidak dikenal di poker.` };
    }

    // Pass turn to next active player
    const currentIdx = this.players.findIndex((p) => p.user_id === userId);
    let nextIdx = (currentIdx + 1) % this.players.length;
    let loopCount = 0;
    while (this.state.folded.includes(this.players[nextIdx]!.user_id) && loopCount < this.players.length) {
      nextIdx = (nextIdx + 1) % this.players.length;
      loopCount++;
    }

    // Advance round if full circle completed
    if (nextIdx === 0) {
      if (this.state.stage === 'flop') this.state.stage = 'turn';
      else if (this.state.stage === 'turn') this.state.stage = 'river';
      else if (this.state.stage === 'river') {
        this.state.stage = 'showdown';
        const remaining = this.players.filter((p) => !this.state.folded.includes(p.user_id));
        this.state.winnerId = remaining[0]!.user_id;
        this.state.isFinished = true;
        return { success: true, finished: true, results: this.getResults() };
      }
    }

    this.state.currentTurn = this.players[nextIdx]!.user_id;
    return { success: true };
  }

  public getStateForPlayer(userId: string) {
    const revealedCommunity =
      this.state.stage === 'flop'
        ? this.state.communityCards.slice(0, 3)
        : this.state.stage === 'turn'
        ? this.state.communityCards.slice(0, 4)
        : this.state.communityCards;

    return {
      gameType: 'poker',
      myHand: this.state.hands[userId] || [],
      communityCards: revealedCommunity,
      stage: this.state.stage,
      pot: this.state.pot,
      folded: this.state.folded,
      currentTurn: this.state.currentTurn,
      isFinished: this.state.isFinished,
      winnerId: this.state.winnerId,
    };
  }

  public getStateForSpectator() {
    return {
      gameType: 'poker',
      communityCards: this.state.communityCards,
      stage: this.state.stage,
      pot: this.state.pot,
      folded: this.state.folded,
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
      scores: { [winner]: this.state.pot },
      summary: `Pemenang Poker: ${this.players.find((p) => p.user_id === winner)?.display_name || 'Pemain'} (Pot: ${this.state.pot} Koin)!`,
    };
  }

  public getValidMoves(userId: string): any[] {
    if (this.state.currentTurn !== userId) return [];
    return [
      { action: 'check', payload: {} },
      { action: 'bet', payload: { amount: 10 } },
      { action: 'fold', payload: {} },
    ];
  }

  public handleTimeout(userId: string): ActionResult {
    return this.handleAction(userId, 'check', {});
  }

  public getBotAction(userId: string): { action: string; payload: any } | null {
    if (this.state.currentTurn !== userId) return null;
    return { action: 'check', payload: {} };
  }
}
