import { DominoCard, GaplehBoard, GaplehMove } from './types';

export class GaplehRules {
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
  public static findStartingPlayer(hands: Record<string, DominoCard[]>, playerIds: string[]): { startingPlayerId: string; startingCard?: DominoCard } {
    // Check doubles from 6-6 down to 0-0
    for (let balak = 6; balak >= 0; balak--) {
      for (const id of playerIds) {
        const hasBalak = hands[id]?.find(([a, b]) => a === balak && b === balak);
        if (hasBalak) {
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
  public static getValidMoves(hand: DominoCard[], board: GaplehBoard): GaplehMove[] {
    if (!hand || hand.length === 0) return [];

    // Empty board: any card can be placed
    if (board.leftEnd === null || board.rightEnd === null) {
      return hand.map((card) => ({ card, side: 'left' }));
    }

    const moves: GaplehMove[] = [];
    for (const card of hand) {
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
  public static validateMove(
    card: DominoCard,
    side: 'left' | 'right',
    hand: DominoCard[],
    board: GaplehBoard
  ): { valid: boolean; error?: string; orientedCard?: DominoCard; newLeftEnd?: number; newRightEnd?: number } {
    // Check if player actually owns this card
    const cardIndex = hand.findIndex(([a, b]) => (a === card[0] && b === card[1]) || (a === card[1] && b === card[0]));
    if (cardIndex === -1) {
      return { valid: false, error: 'Anda tidak memiliki kartu ini.' };
    }

    // First card on empty board
    if (board.leftEnd === null || board.rightEnd === null) {
      return {
        valid: true,
        orientedCard: card,
        newLeftEnd: card[0],
        newRightEnd: card[1],
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
}

