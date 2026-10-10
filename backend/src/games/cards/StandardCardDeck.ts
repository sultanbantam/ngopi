export type CardSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type CardRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface PlayingCard {
  suit: CardSuit;
  rank: CardRank;
  value: number; // 2 to 14
}

export const SUITS: CardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const RANKS: CardRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const RANK_VALUES: Record<CardRank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

export class StandardCardDeck {
  public static createDeck(): PlayingCard[] {
    const deck: PlayingCard[] = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({
          suit,
          rank,
          value: RANK_VALUES[rank],
        });
      }
    }
    return this.shuffle(deck);
  }

  public static shuffle(cards: PlayingCard[]): PlayingCard[] {
    const deck = [...cards];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = deck[i]!;
      deck[i] = deck[j]!;
      deck[j] = temp;
    }
    return deck;
  }
}
