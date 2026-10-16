import { DominoCard, GaplehBoard, GaplehMove, GaplehWinType, GaplehPointsCalculation, OpponentCardsBreakdown } from './types';

export class GaplehRules {
  // Check if a card is Balak 6 or Balak 0
  public static isRestrictedBalak(card: DominoCard): boolean {
    return (card[0] === 6 && card[1] === 6) || (card[0] === 0 && card[1] === 0);
  }

  // Check if player is allowed to play Balak 6 or Balak 0
  public static canPlayRestrictedBalak(card: DominoCard, hand: DominoCard[], board: GaplehBoard): boolean {
    if (!this.isRestrictedBalak(card)) return true;

    // First move on empty board cannot use Balak 6 or Balak 0
    if (board.leftEnd === null || board.rightEnd === null) return false;

    // If only 1 card left in hand, this is the final "nutup" move -> ALLOWED
    if (hand.length <= 1) return true;

    // Check if there are other playable cards in hand that are NOT restricted balaks
    const hasOtherPlayable = hand.some((c) => {
      if (this.isRestrictedBalak(c)) return false;
      const [a, b] = c;
      return a === board.leftEnd || b === board.leftEnd || a === board.rightEnd || b === board.rightEnd;
    });

    // Allowed ONLY IF no other legal move can be made
    return !hasOtherPlayable;
  }

  // Generate complete standard 28-card domino set
  public static generateDeck(): DominoCard[] {
    const deck: DominoCard[] = [];
    for (let a = 0; a <= 6; a++) {
      for (let b = a; b <= 6; b++) {
        deck.push([a, b]);
      }
    }
    return deck;
  }

  // Fisher-Yates shuffle
  public static shuffleDeck(deck: DominoCard[]): DominoCard[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp;
    }
    return shuffled;
  }

  // Deal cards to players (typically 7 each)
  public static dealCards(playerIds: string[]): { hands: Record<string, DominoCard[]> } {
    const deck = this.shuffleDeck(this.generateDeck());
    const hands: Record<string, DominoCard[]> = {};
    const cardsPerPlayer = playerIds.length === 4 ? 7 : Math.min(7, Math.floor(28 / playerIds.length));

    playerIds.forEach((id, idx) => {
      hands[id] = deck.slice(idx * cardsPerPlayer, (idx + 1) * cardsPerPlayer);
    });

    return { hands };
  }

  // Determine starting player: owner of highest balak ([6,6] down to [0,0])
  // Level 1: Standard classic rules (startingCard is [balak, balak])
  // Level 2: Opening move cannot be 6-6 or 0-0, so suggested startingCard is alternative
  public static findStartingPlayer(hands: Record<string, DominoCard[]>, playerIds: string[], level: 1 | 2 = 1): { startingPlayerId: string; startingCard?: DominoCard } {
    // Check doubles from 6-6 down to 0-0 to find owner
    for (let balak = 6; balak >= 0; balak--) {
      for (const id of playerIds) {
        const hasBalak = hands[id]?.find(([a, b]) => a === balak && b === balak);
        if (hasBalak) {
          if (level === 2) {
            // Level 2: Provide valid opening card (not 6-6 and not 0-0)
            const validStartingCards = (hands[id] || []).filter((c) => !GaplehRules.isRestrictedBalak(c));
            validStartingCards.sort((a, b) => (b[0] + b[1]) - (a[0] + a[1]));
            const startingCard = validStartingCards[0];
            return { startingPlayerId: id, startingCard };
          }
          // Level 1: Standard classic rule unchanged
          return { startingPlayerId: id, startingCard: [balak, balak] };
        }
      }
    }

    // Fallback: highest card sum
    let bestPlayer = playerIds[0] || '';
    let maxVal = -1;
    let bestCard: DominoCard | undefined;

    for (const id of playerIds) {
      for (const card of hands[id] || []) {
        if (level === 2 && GaplehRules.isRestrictedBalak(card)) continue;
        const val = card[0] + card[1];
        if (val > maxVal) {
          maxVal = val;
          bestPlayer = id;
          bestCard = card;
        }
      }
    }

    return bestCard
      ? { startingPlayerId: bestPlayer, startingCard: bestCard }
      : { startingPlayerId: bestPlayer };
  }

  // Find all valid moves for a hand given the current board
  // Level 1: Pure classic rules (semua kartu cocok bisa dimainkan, tidak diubah)
  // Level 2: Aturan baru (balak 6 & 0 tidak boleh dibuka diawal, terkunci di tengah permainan)
  public static getValidMoves(hand: DominoCard[], board: GaplehBoard, level: 1 | 2 = 1): GaplehMove[] {
    if (!hand || hand.length === 0) return [];

    // Empty board
    if (board.leftEnd === null || board.rightEnd === null) {
      if (level === 2) {
        // Level 2: cannot open with Balak 6 or Balak 0
        return hand
          .filter((card) => !this.isRestrictedBalak(card))
          .map((card) => ({ card, side: 'left' as const }));
      }
      // Level 1: Any card can be placed on empty board
      return hand.map((card) => ({ card, side: 'left' as const }));
    }

    // Check if player has alternative playable cards other than Balak 6/0 (only for Level 2)
    const hasAlternativeMoves = level === 2 && hand.some((c) => {
      if (this.isRestrictedBalak(c)) return false;
      const [a, b] = c;
      return a === board.leftEnd || b === board.leftEnd || a === board.rightEnd || b === board.rightEnd;
    });

    const moves: GaplehMove[] = [];
    for (const card of hand) {
      // Level 2 only: If card is Balak 6 or Balak 0, player has > 1 card, and other moves exist: cannot play it
      if (level === 2 && this.isRestrictedBalak(card) && hand.length > 1 && hasAlternativeMoves) {
        continue;
      }

      const [a, b] = card;

      // Check left end
      if (a === board.leftEnd || b === board.leftEnd) {
        moves.push({ card, side: 'left' });
      }

      // Check right end (avoid duplicate if single card matches both ends on identical side)
      if (a === board.rightEnd || b === board.rightEnd) {
        if (board.leftEnd !== board.rightEnd || !moves.some((m) => m.card[0] === card[0] && m.card[1] === card[1] && m.side === 'left')) {
          moves.push({ card, side: 'right' });
        }
      }
    }

    return moves;
  }

  // Validate a move and determine resulting orientation and updated ends
  // Level 1: Aturan klasik standar (tidak diubah)
  // Level 2: Validasi aturan baru Balak 6 & 0
  public static validateMove(
    card: DominoCard,
    side: 'left' | 'right',
    hand: DominoCard[],
    board: GaplehBoard,
    level: 1 | 2 = 1
  ): { valid: boolean; error?: string; orientedCard?: DominoCard; newLeftEnd?: number; newRightEnd?: number } {
    // Check if player actually owns this card
    const cardIndex = hand.findIndex(([a, b]) => (a === card[0] && b === card[1]) || (a === card[1] && b === card[0]));
    if (cardIndex === -1) {
      return { valid: false, error: 'Anda tidak memiliki kartu ini.' };
    }

    // First card on empty board
    if (board.leftEnd === null || board.rightEnd === null) {
      if (level === 2 && this.isRestrictedBalak(card)) {
        return {
          valid: false,
          error: 'Kartu pertama tidak boleh dibuka dengan Balak 6 (6-6) atau Balak 0 (0-0).',
        };
      }
      return {
        valid: true,
        orientedCard: card,
        newLeftEnd: card[0],
        newRightEnd: card[1],
      };
    }

    // Mid-game check: Balak 6 and Balak 0 restriction (Level 2 only)
    if (level === 2 && this.isRestrictedBalak(card) && !this.canPlayRestrictedBalak(card, hand, board)) {
      return {
        valid: false,
        error: 'Balak 6 (6-6) dan Balak 0 (0-0) hanya boleh dimainkan sebagai kartu nutup atau jika tidak ada langkah lain.',
      };
    }

    const [a, b] = card;

    if (side === 'left') {
      const target = board.leftEnd;
      if (b === target) {
        // [a, b] connects via b to leftEnd target => new left end is a
        return { valid: true, orientedCard: [a, b], newLeftEnd: a, newRightEnd: board.rightEnd };
      } else if (a === target) {
        // Flip card: [b, a] connects via a to leftEnd target => new left end is b
        return { valid: true, orientedCard: [b, a], newLeftEnd: b, newRightEnd: board.rightEnd };
      } else {
        return { valid: false, error: `Kartu [${a}, ${b}] tidak cocok dengan ujung kiri (${target}).` };
      }
    } else {
      const target = board.rightEnd;
      if (a === target) {
        // [a, b] connects via a to rightEnd target => new right end is b
        return { valid: true, orientedCard: [a, b], newLeftEnd: board.leftEnd, newRightEnd: b };
      } else if (b === target) {
        // Flip card: [b, a] connects via b to rightEnd target => new right end is a
        return { valid: true, orientedCard: [b, a], newLeftEnd: board.leftEnd, newRightEnd: a };
      } else {
        return { valid: false, error: `Kartu [${a}, ${b}] tidak cocok dengan ujung kanan (${target}).` };
      }
    }
  }

  // Calculate pip total of hand
  public static calculateHandPips(hand: DominoCard[]): number {
    return hand.reduce((sum, [a, b]) => sum + a + b, 0);
  }

  // Calculate team pips
  public static calculateTeamPips(
    hands: Record<string, DominoCard[]>,
    teams: Record<string, 'A' | 'B'>
  ): { A: number; B: number; individualPips: Record<string, number> } {
    const individualPips: Record<string, number> = {};
    let sumA = 0;
    let sumB = 0;

    for (const [userId, hand] of Object.entries(hands)) {
      const pips = this.calculateHandPips(hand || []);
      individualPips[userId] = pips;
      const team = teams[userId];
      if (team === 'A') sumA += pips;
      else if (team === 'B') sumB += pips;
    }

    return { A: sumA, B: sumB, individualPips };
  }

  // Resolve winner in individual deadlock (Gaple / Buntu)
  public static resolveDeadlock(hands: Record<string, DominoCard[]>, playerIds: string[]): { winnerId: string; scores: Record<string, number> } {
    const scores: Record<string, number> = {};
    let minPips = Infinity;
    let minCardCount = Infinity;
    let winnerId = playerIds[0] || '';

    for (const id of playerIds) {
      const hand = hands[id] || [];
      const pips = this.calculateHandPips(hand);
      scores[id] = pips;

      if (pips < minPips) {
        minPips = pips;
        minCardCount = hand.length;
        winnerId = id;
      } else if (pips === minPips) {
        if (hand.length < minCardCount) {
          minCardCount = hand.length;
          winnerId = id;
        }
      }
    }

    return { winnerId, scores };
  }

  // Resolve partnership round under Gaya Kampung
  public static resolvePartnershipKampung(
    hands: Record<string, DominoCard[]>,
    teams: Record<string, 'A' | 'B'>,
    playerIds: string[],
    finisherUserId?: string | null
  ): {
    winnerTeam: 'A' | 'B' | null;
    winReason: 'cards_cleared' | 'deadlock' | 'seri';
    pointsAwarded: number;
    teamPips: { A: number; B: number };
    individualPips: Record<string, number>;
    winners: string[];
    losers: string[];
    summary: string;
    formulaExplanation: string;
  } {
    const { A, B, individualPips } = this.calculateTeamPips(hands, teams);
    const teamPips = { A, B };

    if (finisherUserId) {
      const winnerTeam = teams[finisherUserId] || 'A';
      const winners = playerIds.filter((id) => teams[id] === winnerTeam);
      const losers = playerIds.filter((id) => teams[id] !== winnerTeam);

      return {
        winnerTeam,
        winReason: 'cards_cleared',
        pointsAwarded: 50,
        teamPips,
        individualPips,
        winners,
        losers,
        summary: `Tim ${winnerTeam} menang! Anggota tim berhasil menghabiskan seluruh kartu.`,
        formulaExplanation: `Berdasarkan Preset Kampung Ngopi, tim yang anggotanya menghabiskan batu menang putaran. Masing-masing anggota Tim ${winnerTeam} mendapatkan 50 poin. (Sisa mata: Tim A: ${A}, Tim B: ${B})`,
      };
    }

    // Deadlock condition
    if (A < B) {
      const winners = playerIds.filter((id) => teams[id] === 'A');
      const losers = playerIds.filter((id) => teams[id] === 'B');
      return {
        winnerTeam: 'A',
        winReason: 'deadlock',
        pointsAwarded: 50,
        teamPips,
        individualPips,
        winners,
        losers,
        summary: `Gaple Buntu! Tim A menang karena total mata batu tersisa (${A}) lebih rendah daripada Tim B (${B}).`,
        formulaExplanation: `Berdasarkan Preset Kampung Ngopi, saat buntu tim dengan total mata sisa terendah menang. Anggota Tim A masing-masing mendapatkan 50 poin kemenangan.`,
      };
    } else if (B < A) {
      const winners = playerIds.filter((id) => teams[id] === 'B');
      const losers = playerIds.filter((id) => teams[id] === 'A');
      return {
        winnerTeam: 'B',
        winReason: 'deadlock',
        pointsAwarded: 50,
        teamPips,
        individualPips,
        winners,
        losers,
        summary: `Gaple Buntu! Tim B menang karena total mata batu tersisa (${B}) lebih rendah daripada Tim A (${A}).`,
        formulaExplanation: `Berdasarkan Preset Kampung Ngopi, saat buntu tim dengan total mata sisa terendah menang. Anggota Tim B masing-masing mendapatkan 50 poin kemenangan.`,
      };
    } else {
      // Seri
      return {
        winnerTeam: null,
        winReason: 'seri',
        pointsAwarded: 0,
        teamPips,
        individualPips,
        winners: [],
        losers: playerIds,
        summary: `Gaple Buntu! Putaran Seri: total mata batu tersisa kedua tim sama (${A} vs ${B}).`,
        formulaExplanation: `Berdasarkan Preset Kampung Ngopi, saat buntu dengan mata sama, putaran berakhir seri dan tidak ada poin kemenangan.`,
      };
    }
  }

  // Resolve partnership round under Preset Turnamen Ngopi
  public static resolvePartnershipTournament(
    hands: Record<string, DominoCard[]>,
    teams: Record<string, 'A' | 'B'>,
    playerIds: string[],
    currentMatchScores: { A: number; B: number },
    targetScore: number = 250,
    finisherUserId?: string | null
  ): {
    winnerTeam: 'A' | 'B' | null;
    winReason: 'cards_cleared' | 'deadlock' | 'seri';
    roundPoints: { A: number; B: number };
    newMatchScores: { A: number; B: number };
    isMatchOver: boolean;
    matchWinnerTeam?: 'A' | 'B' | null;
    teamPips: { A: number; B: number };
    individualPips: Record<string, number>;
    winners: string[];
    losers: string[];
    summary: string;
    formulaExplanation: string;
    pointsAwarded: number;
  } {
    const { A, B, individualPips } = this.calculateTeamPips(hands, teams);
    const teamPips = { A, B };
    let winnerTeam: 'A' | 'B' | null = null;
    let winReason: 'cards_cleared' | 'deadlock' | 'seri' = 'seri';
    let roundPoints = { A: 0, B: 0 };
    let summary = '';
    let formulaExplanation = '';

    if (finisherUserId) {
      winnerTeam = teams[finisherUserId] || 'A';
      winReason = 'cards_cleared';
      const opponentTeam = winnerTeam === 'A' ? 'B' : 'A';
      const oppPips = teamPips[opponentTeam];
      roundPoints = {
        A: winnerTeam === 'A' ? oppPips : 0,
        B: winnerTeam === 'B' ? oppPips : 0,
      };
      summary = `Tim ${winnerTeam} menang putaran! Anggota tim berhasil menghabiskan seluruh kartu.`;
      formulaExplanation = `Berdasarkan Preset Turnamen Ngopi, tim pemenang putaran memperoleh nilai sebesar total mata sisa tim lawan (+${oppPips} poin).`;
    } else {
      // Deadlock
      if (A < B) {
        winnerTeam = 'A';
        winReason = 'deadlock';
        const diff = B - A;
        roundPoints = { A: diff, B: 0 };
        summary = `Gaple Buntu! Tim A menang putaran dengan selisih ${diff} mata (${B} - ${A}).`;
        formulaExplanation = `Berdasarkan Preset Turnamen Ngopi, saat buntu tim pemenang memperoleh poin sebesar selisih mata lawan dikurangi mata sendiri (${B} - ${A} = +${diff} poin).`;
      } else if (B < A) {
        winnerTeam = 'B';
        winReason = 'deadlock';
        const diff = A - B;
        roundPoints = { A: 0, B: diff };
        summary = `Gaple Buntu! Tim B menang putaran dengan selisih ${diff} mata (${A} - ${B}).`;
        formulaExplanation = `Berdasarkan Preset Turnamen Ngopi, saat buntu tim pemenang memperoleh poin sebesar selisih mata lawan dikurangi mata sendiri (${A} - ${B} = +${diff} poin).`;
      } else {
        winnerTeam = null;
        winReason = 'seri';
        roundPoints = { A: 0, B: 0 };
        summary = `Gaple Buntu! Seri: jumlah mata kedua tim sama (${A} vs ${B}), skor putaran 0.`;
        formulaExplanation = `Berdasarkan Preset Turnamen Ngopi, saat buntu dengan mata sama, skor putaran adalah 0.`;
      }
    }

    const newMatchScores = {
      A: (currentMatchScores?.A || 0) + roundPoints.A,
      B: (currentMatchScores?.B || 0) + roundPoints.B,
    };

    const isMatchOver = newMatchScores.A >= targetScore || newMatchScores.B >= targetScore;
    let matchWinnerTeam: 'A' | 'B' | null = null;
    let winners: string[] = [];
    let losers: string[] = [];
    let pointsAwarded = 0;

    if (isMatchOver) {
      matchWinnerTeam = newMatchScores.A >= newMatchScores.B ? 'A' : 'B';
      winners = playerIds.filter((id) => teams[id] === matchWinnerTeam);
      losers = playerIds.filter((id) => teams[id] !== matchWinnerTeam);
      pointsAwarded = 50; // Match champions get 50 leaderboard points
      summary += ` Pertandingan selesai! Tim ${matchWinnerTeam} mencapai target ${targetScore} poin!`;
    } else if (winnerTeam) {
      winners = playerIds.filter((id) => teams[id] === winnerTeam);
      losers = playerIds.filter((id) => teams[id] !== winnerTeam);
    } else {
      winners = [];
      losers = playerIds;
    }

    return {
      winnerTeam,
      winReason,
      roundPoints,
      newMatchScores,
      isMatchOver,
      matchWinnerTeam,
      teamPips,
      individualPips,
      winners,
      losers,
      summary,
      formulaExplanation,
      pointsAwarded,
    };
  }

  // Check if match reached Digapleh (deadlock where all players still have cards but none can move)
  public static checkDigapleh(hands: Record<string, DominoCard[]>, board: GaplehBoard): boolean {
    if (board.leftEnd === null || board.rightEnd === null) return false;
    const handValues = Object.values(hands);
    if (handValues.length === 0) return false;

    // All players must still hold at least one card
    const allHaveCards = handValues.every((h) => (h || []).length > 0);
    if (!allHaveCards) return false;

    // No player can make a legal move
    const noMovesPossible = handValues.every((h) => this.getValidMoves(h || [], board).length === 0);
    return noMovesPossible;
  }

  // Determine winner in Digapleh: player who played the most cards (fewest remaining cards in hand)
  // Tiebreaker: player with lowest pip sum
  public static determineDigaplehWinner(
    hands: Record<string, DominoCard[]>,
    playerIds: string[]
  ): {
    winnerId: string;
    scores: Record<string, number>;
    remainingCardsCount: Record<string, number>;
    summary: string;
  } {
    const scores: Record<string, number> = {};
    const remainingCardsCount: Record<string, number> = {};
    let minCardCount = Infinity;
    let minPips = Infinity;
    let winnerId = playerIds[0] || '';

    for (const id of playerIds) {
      const hand = hands[id] || [];
      const pips = this.calculateHandPips(hand);
      const cardCount = hand.length;

      scores[id] = pips;
      remainingCardsCount[id] = cardCount;

      if (cardCount < minCardCount) {
        minCardCount = cardCount;
        minPips = pips;
        winnerId = id;
      } else if (cardCount === minCardCount) {
        if (pips < minPips) {
          minPips = pips;
          winnerId = id;
        }
      }
    }

    return {
      winnerId,
      scores,
      remainingCardsCount,
      summary: `Digapleh (Permainan Buntu)! Pemenang adalah pemain dengan kartu tersisa paling sedikit (${minCardCount} kartu tersisa, ${minPips} mata).`,
    };
  }

  // Calculate points according to Ngopi Gapleh v3 rules
  public static calculatePoints(params: {
    winType: GaplehWinType;
    streakCount?: number;
    isFirstNutup?: boolean;
    opponentHands?: Record<string, DominoCard[]>;
    winnerId?: string;
  }): GaplehPointsCalculation {
    const { winType, streakCount = 0, isFirstNutup = false, opponentHands = {}, winnerId = '' } = params;
    let basePoints = 50;
    let bonusPoints = 0;
    let multiplier = 1;
    const opponentCardsBreakdown: OpponentCardsBreakdown[] = [];

    if (winType === 'gapleh_biasa') {
      basePoints = 50;
      for (const [oppId, hand] of Object.entries(opponentHands)) {
        if (oppId === winnerId) continue;
        const count = (hand || []).length;
        let oppBonus = count * 5; // +5 poin per kartu lawan tersisa
        if (count > 5) {
          oppBonus += 10; // +10 poin bonus jika lawan > 5 kartu
        }
        bonusPoints += oppBonus;
        opponentCardsBreakdown.push({
          opponentId: oppId,
          cardsLeft: count,
          points: oppBonus,
        });
      }
    } else if (winType === 'digapleh') {
      basePoints = 75; // flat 75 poin
      bonusPoints = 0;
    } else if (winType === 'nutup_balak6' || winType === 'nutup_balak0') {
      basePoints = 500;
      if (isFirstNutup) {
        multiplier = 3; // First time nutup balak 6/0 -> x3
      } else if (streakCount >= 3) {
        multiplier = 1.5; // Streak 3x berturut-turut -> x1.5
      }
    }

    const totalPoints = Math.floor((basePoints + bonusPoints) * multiplier);

    let breakdownSummary = '';
    if (winType === 'gapleh_biasa') {
      breakdownSummary = `Gapleh Biasa: ${basePoints} base + ${bonusPoints} bonus kartu lawan = ${totalPoints} poin.`;
    } else if (winType === 'digapleh') {
      breakdownSummary = `Digapleh: ${basePoints} poin (permainan buntu).`;
    } else {
      const balakName = winType === 'nutup_balak6' ? 'Balak 6 (6-6)' : 'Balak 0 (0-0)';
      const multNote = multiplier > 1 ? ` (x${multiplier} multiplier)` : '';
      breakdownSummary = `Nutup ${balakName}: ${basePoints} poin${multNote} = ${totalPoints} poin!`;
    }

    return {
      winType,
      basePoints,
      bonusPoints,
      totalPoints,
      multiplier,
      isFirstNutup,
      streakCount,
      opponentCardsBreakdown,
      breakdownSummary,
    };
  }
}


