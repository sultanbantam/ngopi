import { UnoCard, UnoColor, UnoValue } from './types';

export class UnoDeck {
  public static createDeck(): UnoCard[] {
    const cards: UnoCard[] = [];
    const colors: UnoColor[] = ['red', 'yellow', 'green', 'blue'];
    let counter = 1;

    for (const color of colors) {
      // One '0' per color
      cards.push({
        id: `uno_${counter++}`,
        color,
        value: '0',
        score: 0,
      });

      // Two of '1' through '9' per color
      for (let num = 1; num <= 9; num++) {
        const val = String(num) as UnoValue;
        cards.push({ id: `uno_${counter++}`, color, value: val, score: num });
        cards.push({ id: `uno_${counter++}`, color, value: val, score: num });
      }

      // Two action cards per color: Skip, Reverse, Draw Two (+2)
      for (let i = 0; i < 2; i++) {
        cards.push({ id: `uno_${counter++}`, color, value: 'skip', score: 20 });
        cards.push({ id: `uno_${counter++}`, color, value: 'reverse', score: 20 });
        cards.push({ id: `uno_${counter++}`, color, value: 'draw2', score: 20 });
      }
    }

    // 4 Wild cards
    for (let i = 0; i < 4; i++) {
      cards.push({ id: `uno_${counter++}`, color: 'wild', value: 'wild', score: 50 });
    }

    // 4 Wild Draw Four cards (+4)
    for (let i = 0; i < 4; i++) {
      cards.push({ id: `uno_${counter++}`, color: 'wild', value: 'wild4', score: 50 });
    }

    return cards;
  }

  // Fisher-Yates shuffle
  public static shuffle(deck: UnoCard[]): UnoCard[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = temp;
    }
    return shuffled;
  }
}
