export type DominoCard = [number, number]; // [a, b] where 0 <= a, b <= 6

export interface PlacedCard {
  card: DominoCard;
  side: 'left' | 'right' | 'initial';
  rotation?: number; // 0 for vertical, 90 for horizontal
}

export interface GaplehBoard {
  leftEnd: number | null;
  rightEnd: number | null;
  placedCards: PlacedCard[];
}

export interface GaplehMove {
  card: DominoCard;
  side: 'left' | 'right';
}

export type GaplehGameMode = 'individual' | 'partnership';
export type GaplehRuleset = 'kampung' | 'tournament';

export interface GaplehState {
  board: GaplehBoard;
  hands: Record<string, DominoCard[]>; // Secret hands, never sent in full to opponents!
  currentTurn: string;
  turnOrder: string[];
  passCount: number;
  lastAction?: {
    userId: string;
    action: 'play' | 'pass';
    card?: DominoCard;
    side?: 'left' | 'right';
  } | null;
  isFinished: boolean;
  winnerId?: string | null;
  deadlock: boolean;
  scores: Record<string, number>; // Individual hand pips
  round: number;

  // Partnership-specific fields (optional for backward compatibility with individual mode)
  gameMode: GaplehGameMode;
  ruleset: GaplehRuleset;
  targetScore: number;
  teams: Record<string, 'A' | 'B'>;
  teamPips?: { A: number; B: number };
  roundPoints?: { A: number; B: number };
  matchScores: { A: number; B: number };
  winningTeam?: 'A' | 'B' | null;
  winReason?: 'cards_cleared' | 'deadlock' | 'seri';
  partnershipSummary?: string;
  isMatchOver?: boolean;
}
