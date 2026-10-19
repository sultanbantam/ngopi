import { BaseGame } from '../engine/BaseGame';
import { ActionResult, GamePlayerInfo, GameResult } from '../engine/types';
import { StandardCardDeck, PlayingCard, CardSuit, CardRank, RANK_VALUES } from '../cards/StandardCardDeck';

export type TrufPhase = 'bidding' | 'playing' | 'scoring';
export type TrufMode = 'main_atas' | 'main_bawah';

export interface TrufBid {
  card: PlayingCard;
  target: number; // A=1, 2=2, ..., K=13
  revealed: boolean;
}

export interface TrickCardEntry {
  playerId: string;
  playerName: string;
  card: PlayingCard;
  isTrump: boolean;
  isFaceDown: boolean;
}

export interface CompletedTrickRecord {
  trickNumber: number;
  leaderId: string;
  ledSuit: CardSuit;
  cards: TrickCardEntry[];
  winnerId: string;
  winnerName: string;
}

// Bidding target mapping: A=1, 2..10, J=11, Q=12, K=13
export const BID_TARGET_VALUES: Record<CardRank, number> = {
  'A': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
};

// Suit power priority for breaking ties in highest bid (Spades > Hearts > Clubs > Diamonds)
const SUIT_BID_PRIORITY: Record<CardSuit, number> = {
  spades: 4,
  hearts: 3,
  clubs: 2,
  diamonds: 1,
};

export class TrufGame extends BaseGame {
  readonly gameType = 'truf';
  readonly minPlayers = 4;
  readonly maxPlayers = 4;

  public initializeState(_config: any) {
    return this.dealNewRound();
  }

  private dealNewRound(redealMessage?: string) {
    const deck = StandardCardDeck.createDeck();
    const hands: Record<string, PlayingCard[]> = {};

    // Deal exactly 13 cards to each of the 4 players
    for (const player of this.players) {
      const dealt = deck.splice(0, 13);
      // Sort hand by suit and rank for great UX
      hands[player.user_id] = this.sortHand(dealt);
    }

    const firstPlayerId = this.players[0]!.user_id;

    return {
      phase: 'bidding' as TrufPhase,
      hands,
      bids: {} as Record<string, TrufBid>,
      trumpSuit: null as CardSuit | null,
      mode: null as TrufMode | null,
      totalBid: null as number | null,
      highestBidCard: null as { playerId: string; card: PlayingCard } | null,
      currentTrick: [] as TrickCardEntry[],
      lastCompletedTrick: null as CompletedTrickRecord | null,
      tricksWon: Object.fromEntries(this.players.map((p) => [p.user_id, 0])),
      trickNumber: 1,
      currentLeaderId: firstPlayerId,
      currentTurn: firstPlayerId,
      winnerId: null as string | null,
      isFinished: false,
      finalScores: {} as Record<string, { target: number; won: number; score: number; success: boolean }>,
      history: [] as CompletedTrickRecord[],
      noticeMessage: redealMessage || 'Fase Bidding: Pilih 1 kartu secara tertutup sebagai target kemenangan!',
    };
  }

  private sortHand(cards: PlayingCard[]): PlayingCard[] {
    const suitOrder: Record<CardSuit, number> = {
      spades: 1,
      hearts: 2,
      clubs: 3,
      diamonds: 4,
    };
    return [...cards].sort((a, b) => {
      if (suitOrder[a.suit] !== suitOrder[b.suit]) {
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      return a.value - b.value;
    });
  }

  public handleAction(userId: string, action: string, payload: any): ActionResult {
    if (this.state.isFinished) {
      return { success: false, error: 'Permainan Truf sudah selesai.' };
    }

    if (action === 'bid') {
      return this.handleBid(userId, payload);
    }

    if (action === 'play') {
      return this.handlePlayCard(userId, payload);
    }

    return { success: false, error: `Aksi "${action}" tidak dikenal di Truf.` };
  }

  // 1. SUBMIT BIDDING
  private handleBid(userId: string, payload: any): ActionResult {
    if (this.state.phase !== 'bidding') {
      return { success: false, error: 'Fase bidding sudah selesai.' };
    }

    if (this.state.bids[userId]) {
      return { success: false, error: 'Anda sudah memasang kartu tawaran (bid).' };
    }

    const { suit, rank } = payload || {};
    const hand = this.state.hands[userId] || [];
    const cardIdx = hand.findIndex((c: PlayingCard) => c.suit === suit && c.rank === rank);
    if (cardIdx === -1) {
      return { success: false, error: 'Kartu tidak ada di tangan Anda.' };
    }

    // Keep the card in hand or remove?
    // In Indonesian Truf: The bid card is played face-down from hand as the contract card.
    // Each player plays with the remaining 12 cards, or plays 13 tricks with bid card remaining as contract.
    // Per ngopitruf.md: "Pilih 1 kartu secara tertutup dari tangan mereka untuk dijadikan tawaran."
    // And "Setelah 13 trik selesai": wait, if 13 tricks are played, the bid card is either kept in hand or 12 tricks.
    // In traditional Indonesian Truf PeKaI, the bid card is placed face-down on the contract spot, and players play 12 tricks (or 13 tricks with 52 cards where bid card is part of hand).
    // Let's remove the card from hand so the bid card is safely locked on the contract slot:
    const [bidCard] = hand.splice(cardIdx, 1);
    const target = BID_TARGET_VALUES[bidCard!.rank] || 1;

    this.state.bids[userId] = {
      card: bidCard!,
      target,
      revealed: false,
    };

    // If there are still players who haven't bid, set currentTurn to the next unbid player
    const unbidPlayer = this.players.find((p) => !this.state.bids[p.user_id]);
    if (unbidPlayer) {
      this.state.currentTurn = unbidPlayer.user_id;
    }

    // If all 4 players have placed bids -> resolve bidding!
    if (Object.keys(this.state.bids).length === this.players.length) {
      return this.resolveBidding();
    }

    return {
      success: true,
      message: `Tawaran Anda berhasil disimpan (${target} trik). Menunggu pemain lain...`,
    };
  }

  // RESOLVE BIDDING
  private resolveBidding(): ActionResult {
    // 1. Reveal all 4 bids
    let totalBid = 0;
    for (const b of Object.values(this.state.bids) as TrufBid[]) {
      b.revealed = true;
      totalBid += b.target;
    }
    this.state.totalBid = totalBid;

    // 2. Check for VOID (Total Bid == 13): Gantung / Batal
    if (totalBid === 13) {
      this.state = this.dealNewRound(
        '⚠️ Total Tawaran = 13 (BATAL/GANTUNG)! Seluruh kartu dikocok dan dibagikan ulang.'
      );
      return {
        success: true,
        action: 'redeal',
        data: {
          redeal: true,
          message: 'Total tawaran berjumlah 13. Sesuai aturan Truf, permainan batal dan dikocok ulang!',
        },
      };
    }

    // 3. Determine Mode (Main Atas vs Main Bawah)
    if (totalBid > 13) {
      this.state.mode = 'main_atas';
    } else {
      this.state.mode = 'main_bawah';
    }

    // 4. Find highest bid card to determine Trump Suit & Leader
    // Value ranking for bid card comparison: A is highest (14) or rank value (2..K), with suit tiebreaker
    let highestPlayerId = this.players[0]!.user_id;
    let highestCard = this.state.bids[highestPlayerId]!.card;

    const getBidCardPower = (c: PlayingCard) => {
      // In card rank: Ace is 14, King is 13, ..., 2 is 2
      const rankVal = c.rank === 'A' ? 14 : RANK_VALUES[c.rank];
      const suitVal = SUIT_BID_PRIORITY[c.suit] || 0;
      return rankVal * 10 + suitVal;
    };

    for (const player of this.players) {
      const bid = this.state.bids[player.user_id]!;
      if (getBidCardPower(bid.card) > getBidCardPower(highestCard)) {
        highestCard = bid.card;
        highestPlayerId = player.user_id;
      }
    }

    this.state.trumpSuit = highestCard.suit;
    this.state.highestBidCard = { playerId: highestPlayerId, card: highestCard };
    this.state.currentLeaderId = highestPlayerId;
    this.state.currentTurn = highestPlayerId;
    this.state.phase = 'playing';

    const leaderName = this.players.find((p) => p.user_id === highestPlayerId)?.display_name || 'Leader';
    const modeLabel = this.state.mode === 'main_atas' ? 'MAIN ATAS (Kejar Target)' : 'MAIN BAWAH (Hindari Trik)';
    this.state.noticeMessage = `Tawaran Terbuka! Total: ${totalBid}. Mode: ${modeLabel}. Kembang Truf: ${highestCard.suit.toUpperCase()}. ${leaderName} memimpin trik pertama!`;

    return {
      success: true,
      action: 'biddingResolved',
      data: {
        trumpSuit: this.state.trumpSuit,
        mode: this.state.mode,
        leaderId: highestPlayerId,
      },
    };
  }

  // 2. PLAY CARD IN TRICK
  private handlePlayCard(userId: string, payload: any): ActionResult {
    if (this.state.phase !== 'playing') {
      return { success: false, error: 'Permainan belum dalam fase trik.' };
    }

    if (this.state.currentTurn !== userId) {
      return { success: false, error: 'Bukan giliran Anda.' };
    }

    const { suit, rank } = payload || {};
    const hand = this.state.hands[userId] || [];
    const cardIdx = hand.findIndex((c: PlayingCard) => c.suit === suit && c.rank === rank);
    if (cardIdx === -1) {
      return { success: false, error: 'Kartu tidak ada di tangan Anda.' };
    }

    const card = hand[cardIdx]!;

    // Rule: Must follow suit if player has any card of the led suit
    if (this.state.currentTrick.length > 0) {
      const ledSuit = this.state.currentTrick[0]!.card.suit;
      const hasLedSuit = hand.some((c: PlayingCard) => c.suit === ledSuit);
      if (hasLedSuit && card.suit !== ledSuit) {
        return {
          success: false,
          error: `Anda wajib memainkan kembang yang diminta (${ledSuit.toUpperCase()}) karena masih memilikinya!`,
        };
      }
    }

    // Remove played card from hand
    hand.splice(cardIdx, 1);

    const playerName = this.players.find((p) => p.user_id === userId)?.display_name || userId;
    const isTrump = card.suit === this.state.trumpSuit;

    // Special Rule: Kartu Truf Tertutup
    // "Jika kartu adalah Truf, kartu tersebut diletakkan TERTUTUP (face down).
    // Catatan: Aturan Truf Tertutup berlaku jika dimainkan saat tidak punya kembang yang diminta.
    // Jika kembang yang diminta adalah Truf sendiri, kartu dimainkan terbuka."
    let isFaceDown = false;
    if (this.state.currentTrick.length > 0) {
      const ledSuit = this.state.currentTrick[0]!.card.suit;
      if (isTrump && ledSuit !== this.state.trumpSuit) {
        isFaceDown = true;
      }
    }

    this.state.currentTrick.push({
      playerId: userId,
      playerName,
      card,
      isTrump,
      isFaceDown,
    });

    // If trick is full (all 4 players have played) -> resolve trick!
    if (this.state.currentTrick.length === this.players.length) {
      return this.resolveTrick();
    }

    // Advance turn clockwise to next player
    const curIdx = this.players.findIndex((p) => p.user_id === userId);
    const nextIdx = (curIdx + 1) % this.players.length;
    this.state.currentTurn = this.players[nextIdx]!.user_id;

    return { success: true };
  }

  // RESOLVE TRICK
  private resolveTrick(): ActionResult {
    // 1. Reveal all face-down cards
    for (const entry of this.state.currentTrick) {
      entry.isFaceDown = false;
    }

    const ledSuit = this.state.currentTrick[0]!.card.suit;
    let bestEntry = this.state.currentTrick[0]!;

    for (const entry of this.state.currentTrick) {
      // If entry is Trump
      if (entry.card.suit === this.state.trumpSuit) {
        if (bestEntry.card.suit !== this.state.trumpSuit) {
          bestEntry = entry;
        } else if (entry.card.value > bestEntry.card.value) {
          bestEntry = entry;
        }
      } else if (bestEntry.card.suit !== this.state.trumpSuit && entry.card.suit === ledSuit) {
        // If neither is trump, highest card of ledSuit wins
        if (entry.card.value > bestEntry.card.value) {
          bestEntry = entry;
        }
      }
    }

    const winnerId = bestEntry.playerId;
    const winnerName = bestEntry.playerName;

    // Increment tricks won
    this.state.tricksWon[winnerId] = (this.state.tricksWon[winnerId] || 0) + 1;

    // Record completed trick
    const completedRecord: CompletedTrickRecord = {
      trickNumber: this.state.trickNumber,
      leaderId: this.state.currentLeaderId,
      ledSuit,
      cards: [...this.state.currentTrick],
      winnerId,
      winnerName,
    };
    this.state.lastCompletedTrick = completedRecord;
    this.state.history.push(completedRecord);

    // Winner leads next trick
    this.state.currentLeaderId = winnerId;
    this.state.currentTurn = winnerId;
    this.state.currentTrick = [];
    this.state.trickNumber += 1;

    // Check if round is finished (all cards in hands exhausted)
    const anyCardsLeft = Object.values(this.state.hands).some((h: any) => h.length > 0);
    if (!anyCardsLeft) {
      return this.resolveScoring();
    }

    this.state.noticeMessage = `Trik ${completedRecord.trickNumber} dimenangkan oleh ${winnerName} dengan ${bestEntry.card.rank} ${bestEntry.card.suit.toUpperCase()}!`;
    return {
      success: true,
      action: 'trickResolved',
      data: { winnerId },
    };
  }

  // 3. SCORING & FINAL RESULTS
  private resolveScoring(): ActionResult {
    this.state.phase = 'scoring';
    this.state.isFinished = true;

    const isMainAtas = this.state.mode === 'main_atas';
    const finalScores: Record<string, { target: number; won: number; score: number; success: boolean }> = {};

    let highestScore = -Infinity;
    let winningPlayerId = this.players[0]!.user_id;

    for (const player of this.players) {
      const pId = player.user_id;
      const target = this.state.bids[pId]?.target || 1;
      const won = this.state.tricksWon[pId] || 0;

      let score = 0;
      let success = false;

      if (isMainAtas) {
        // Main Atas: target tercapai jika won >= target
        if (won >= target) {
          success = true;
          // Poin positif: target * 10 + bonus selisih trik
          score = target * 10 + (won - target) * 5;
        } else {
          success = false;
          // Poin negatif
          score = -(target * 10);
        }
      } else {
        // Main Bawah: berhasil jika won <= target (mengalah / hindari trik)
        if (won <= target) {
          success = true;
          score = target * 10 + (target - won) * 5;
        } else {
          success = false;
          score = -(target * 10 + (won - target) * 10);
        }
      }

      finalScores[pId] = { target, won, score, success };

      if (score > highestScore) {
        highestScore = score;
        winningPlayerId = pId;
      }
    }

    this.state.finalScores = finalScores;
    this.state.winnerId = winningPlayerId;

    const winnerObj = this.players.find((p) => p.user_id === winningPlayerId);
    const modeLabel = isMainAtas ? 'Main Atas' : 'Main Bawah';
    this.state.noticeMessage = `Permainan Selesai (${modeLabel})! Juara Truf: ${winnerObj?.display_name || 'Pemenang'} dengan skor ${highestScore}!`;

    return {
      success: true,
      finished: true,
      results: this.getResults(),
    };
  }

  public getStateForPlayer(userId: string) {
    // For opponent cards in active trick: if faceDown, hide suit and rank!
    const sanitizedCurrentTrick = this.state.currentTrick.map((tr: TrickCardEntry) => {
      if (tr.isFaceDown && tr.playerId !== userId) {
        return {
          playerId: tr.playerId,
          playerName: tr.playerName,
          isFaceDown: true,
          isTrump: false,
          card: { suit: 'spades', rank: '?', value: 0 },
        };
      }
      return tr;
    });

    // During bidding, opponents' exact bid cards are hidden (only whether they have bid is visible)
    const sanitizedBids: Record<string, any> = {};
    for (const player of this.players) {
      const pId = player.user_id;
      const b = this.state.bids[pId];
      if (!b) {
        sanitizedBids[pId] = { hasBid: false };
      } else if (b.revealed || pId === userId) {
        sanitizedBids[pId] = { hasBid: true, target: b.target, card: b.card, revealed: b.revealed };
      } else {
        sanitizedBids[pId] = { hasBid: true, revealed: false };
      }
    }

    return {
      gameType: 'truf',
      phase: this.state.phase,
      mode: this.state.mode,
      trumpSuit: this.state.trumpSuit,
      totalBid: this.state.totalBid,
      highestBidCard: this.state.highestBidCard,
      myHand: this.state.hands[userId] || [],
      handCounts: Object.fromEntries(
        this.players.map((p) => [p.user_id, (this.state.hands[p.user_id] || []).length])
      ),
      bids: sanitizedBids,
      currentTrick: sanitizedCurrentTrick,
      lastCompletedTrick: this.state.lastCompletedTrick,
      tricksWon: this.state.tricksWon,
      trickNumber: this.state.trickNumber,
      currentLeaderId: this.state.currentLeaderId,
      currentTurn: this.state.currentTurn,
      isFinished: this.state.isFinished,
      winnerId: this.state.winnerId,
      finalScores: this.state.finalScores,
      noticeMessage: this.state.noticeMessage,
    };
  }

  public getStateForSpectator() {
    return {
      gameType: 'truf',
      phase: this.state.phase,
      mode: this.state.mode,
      trumpSuit: this.state.trumpSuit,
      totalBid: this.state.totalBid,
      highestBidCard: this.state.highestBidCard,
      handCounts: Object.fromEntries(
        this.players.map((p) => [p.user_id, (this.state.hands[p.user_id] || []).length])
      ),
      bids: this.state.bids,
      currentTrick: this.state.currentTrick,
      lastCompletedTrick: this.state.lastCompletedTrick,
      tricksWon: this.state.tricksWon,
      trickNumber: this.state.trickNumber,
      currentLeaderId: this.state.currentLeaderId,
      currentTurn: this.state.currentTurn,
      isFinished: this.state.isFinished,
      winnerId: this.state.winnerId,
      finalScores: this.state.finalScores,
      noticeMessage: this.state.noticeMessage,
    };
  }

  public isFinished(): boolean {
    return Boolean(this.state.isFinished);
  }

  public getResults(): GameResult {
    const winner = this.state.winnerId || this.players[0]!.user_id;
    const losers = this.players.filter((p) => p.user_id !== winner).map((p) => p.user_id);
    const winnerName = this.players.find((p) => p.user_id === winner)?.display_name || 'Pemain';
    const modeLabel = this.state.mode === 'main_atas' ? 'Main Atas' : 'Main Bawah';

    return {
      winners: [winner],
      losers,
      scores: Object.fromEntries(
        Object.entries(this.state.finalScores).map(([pId, data]: [string, any]) => [pId, data.score])
      ),
      summary: `Juara Truf (${modeLabel}): ${winnerName}! Menang ${this.state.tricksWon[winner] || 0} Trik.`,
    };
  }

  public getValidMoves(userId: string): any[] {
    if (this.state.phase === 'bidding') {
      if (this.state.bids[userId]) return [];
      const hand = this.state.hands[userId] || [];
      return hand.map((c: PlayingCard) => ({ action: 'bid', payload: { suit: c.suit, rank: c.rank } }));
    }

    if (this.state.phase === 'playing') {
      if (this.state.currentTurn !== userId) return [];
      const hand = this.state.hands[userId] || [];
      if (this.state.currentTrick.length === 0) {
        return hand.map((c: PlayingCard) => ({ action: 'play', payload: { suit: c.suit, rank: c.rank } }));
      }
      const ledSuit = this.state.currentTrick[0]!.card.suit;
      const matchingCards = hand.filter((c: PlayingCard) => c.suit === ledSuit);
      const playable = matchingCards.length > 0 ? matchingCards : hand;
      return playable.map((c: PlayingCard) => ({ action: 'play', payload: { suit: c.suit, rank: c.rank } }));
    }

    return [];
  }

  public handleTimeout(userId: string): ActionResult {
    const botAction = this.getBotAction(userId);
    if (botAction) {
      return this.handleAction(userId, botAction.action, botAction.payload);
    }
    return { success: false, error: 'Waktu habis.' };
  }

  // BOT AI TRUF LOGIC
  public getBotAction(userId: string): { action: string; payload: any } | null {
    // 1. In bidding phase
    if (this.state.phase === 'bidding') {
      if (this.state.bids[userId]) return null;
      const hand = this.state.hands[userId] || [];
      if (hand.length === 0) return null;

      // Prefer a reasonable bid card (value between 3 and 6, or middle of hand)
      const mediumCard =
        hand.find((c: PlayingCard) => c.value >= 3 && c.value <= 6) || hand[Math.floor(hand.length / 2)] || hand[0]!;
      return { action: 'bid', payload: { suit: mediumCard.suit, rank: mediumCard.rank } };
    }

    // 2. In playing phase
    if (this.state.phase === 'playing') {
      if (this.state.currentTurn !== userId) return null;
      const hand = this.state.hands[userId] || [];
      if (hand.length === 0) return null;

      const isMainAtas = this.state.mode === 'main_atas';

      // Leading trick
      if (this.state.currentTrick.length === 0) {
        if (isMainAtas) {
          // Play highest card to establish lead
          const highest = [...hand].sort((a, b) => b.value - a.value)[0]!;
          return { action: 'play', payload: { suit: highest.suit, rank: highest.rank } };
        } else {
          // In main bawah: play lowest card to duck
          const lowest = [...hand].sort((a, b) => a.value - b.value)[0]!;
          return { action: 'play', payload: { suit: lowest.suit, rank: lowest.rank } };
        }
      }

      // Following trick
      const ledSuit = this.state.currentTrick[0]!.card.suit;
      const matchingCards = hand.filter((c: PlayingCard) => c.suit === ledSuit);

      if (matchingCards.length > 0) {
        // Must follow suit!
        if (isMainAtas) {
          // Play highest of that suit
          const best = matchingCards.sort((a: PlayingCard, b: PlayingCard) => b.value - a.value)[0]!;
          return { action: 'play', payload: { suit: best.suit, rank: best.rank } };
        } else {
          // Play lowest of that suit to avoid winning
          const lowest = matchingCards.sort((a: PlayingCard, b: PlayingCard) => a.value - b.value)[0]!;
          return { action: 'play', payload: { suit: lowest.suit, rank: lowest.rank } };
        }
      }

      // Has no matching suit! Can dump off-suit or cut with Trump
      const trumpCards = hand.filter((c: PlayingCard) => c.suit === this.state.trumpSuit);
      const offSuitCards = hand.filter((c: PlayingCard) => c.suit !== this.state.trumpSuit);

      if (isMainAtas) {
        // Try cutting with lowest Trump if available
        if (trumpCards.length > 0) {
          const cutCard = trumpCards.sort((a: PlayingCard, b: PlayingCard) => a.value - b.value)[0]!;
          return { action: 'play', payload: { suit: cutCard.suit, rank: cutCard.rank } };
        }
        // Otherwise discard lowest off-suit
        const discard = [...hand].sort((a: PlayingCard, b: PlayingCard) => a.value - b.value)[0]!;
        return { action: 'play', payload: { suit: discard.suit, rank: discard.rank } };
      } else {
        // In main bawah: dump highest off-suit card (get rid of dangerous high cards!)
        const pool = offSuitCards.length > 0 ? offSuitCards : hand;
        const dumpCard = pool.sort((a: PlayingCard, b: PlayingCard) => b.value - a.value)[0]!;
        return { action: 'play', payload: { suit: dumpCard.suit, rank: dumpCard.rank } };
      }
    }

    return null;
  }
}

// Export alias for TrufPeKaiGame as referenced in ngopitruf.md
export class TrufPeKaiGame extends TrufGame {}
