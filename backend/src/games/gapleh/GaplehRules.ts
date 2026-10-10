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

    return { startingPlayerId: bestPlayer, startingCard: bestCard };
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

  // Resolve winner in deadlock (Gaple / Buntu)
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
}
