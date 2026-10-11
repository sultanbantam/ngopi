export interface SnakeLadderPlayerState {
  userId: string;
  position: number; // 1 to 100
  previousPosition: number;
  lastRoll: number | null;
  movesCount: number;
}

export interface SnakeLadderGameState {
  boardSize: number; // 100
  currentTurn: string;
  turnOrder: string[];
  players: Record<string, SnakeLadderPlayerState>;
  ladders: Record<number, number>;
  snakes: Record<number, number>;
  lastAction: {
    userId: string;
    roll: number;
    from: number;
    to: number;
    transitionType?: 'ladder' | 'snake' | 'normal' | 'bounce';
    finalPosition: number;
    message: string;
  } | null;
  isFinished: boolean;
  winnerId: string | null;
}
