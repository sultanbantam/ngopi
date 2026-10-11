import { UnoCard, UnoColor } from './types';

export class UnoRules {
  // Check if card matches active color or top card value
  public static isValidPlay(card: UnoCard, topCard: UnoCard, activeColor: UnoColor): boolean {
    if (!card || !topCard) return false;

    // Wild and Wild Draw Four can always be placed
    if (card.color === 'wild') {
      return true;
    }

    // Matches the active color (either color of top card or color chosen after wild)
    if (card.color === activeColor) {
      return true;
    }

    // Matches the face value or symbol (e.g. 7 on 7, Skip on Skip)
    if (card.value === topCard.value) {
      return true;
    }

    return false;
  }

  // Anti-cheat verification: Wild Draw 4 is legal if player has no card of active color
  public static isWildDrawFourLegal(hand: UnoCard[], activeColor: UnoColor): boolean {
    return !hand.some((c) => c.color === activeColor);
  }
}
