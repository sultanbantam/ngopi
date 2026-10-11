export type UnoColor = 'red' | 'yellow' | 'green' | 'blue' | 'wild';

export type UnoValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2'
  | 'wild' | 'wild4';

export interface UnoCard {
  id: string;
  color: UnoColor;
  value: UnoValue;
  score: number;
}

export interface UnoGameState {
  hands: Record<string, UnoCard[]>;
  deck: UnoCard[];
  discardPile: UnoCard[];
  currentTurn: string;
  turnDirection: 1 | -1;
  activeColor: UnoColor;
  drawCountPending: number;
  hasCalledUno: Record<string, boolean>;
  winnerId: string | null;
  isFinished: boolean;
  gameType: 'uno';
}
