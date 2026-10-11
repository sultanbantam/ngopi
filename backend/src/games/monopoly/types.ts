export type MonopolySquareType =
  | 'start'
  | 'property'
  | 'station'
  | 'utility'
  | 'chance'
  | 'community'
  | 'tax'
  | 'jail'
  | 'go_to_jail'
  | 'free_parking';

export interface MonopolySquare {
  id: number; // 0..23
  name: string;
  type: MonopolySquareType;
  group?: string | undefined;
  price?: number | undefined;
  rentBase?: number | undefined;
  houseCost?: number | undefined;
  taxAmount?: number | undefined;
}

export interface MonopolyPropertyState {
  squareId: number;
  ownerId: string | null;
  houses: number; // 0..4 (houses), 5 = hotel
  isMortgaged?: boolean | undefined;
}

export interface MonopolyPlayerState {
  userId: string;
  money: number;
  position: number; // 0..23
  inJail: boolean;
  jailTurns: number;
  isBankrupt: boolean;
  getOutOfJailCards: number;
  properties: number[]; // squareIds
}

export interface MonopolyCard {
  id: string;
  type: 'chance' | 'community';
  title: string;
  description: string;
  action:
    | { type: 'money'; amount: number }
    | { type: 'move'; toPosition: number }
    | { type: 'jail' }
    | { type: 'get_out_of_jail' }
    | { type: 'collect_all'; amountPerPlayer: number }
    | { type: 'pay_all'; amountPerPlayer: number };
}

export interface MonopolyGameState {
  squares: MonopolySquare[];
  properties: Record<number, MonopolyPropertyState>;
  players: Record<string, MonopolyPlayerState>;
  currentTurn: string;
  turnOrder: string[];
  dice: [number, number];
  isDouble: boolean;
  doubleCount: number;
  hasRolled: boolean;
  pendingAction?: {
    type: 'buy_property' | 'pay_rent' | 'draw_card' | 'jail_decision';
    squareId?: number | undefined;
    ownerId?: string | undefined;
    amount?: number | undefined;
    card?: MonopolyCard | undefined;
  } | null | undefined;
  lastAction?: {
    userId: string;
    action: string;
    message: string;
    dice?: [number, number] | undefined;
  } | null | undefined;
  isFinished: boolean;
  winnerId?: string | null | undefined;
  modeBMC?: boolean | undefined;
}
