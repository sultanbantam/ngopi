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
export type GaplehWinType = 'gapleh_biasa' | 'digapleh' | 'nutup_balak6' | 'nutup_balak0';

export interface OpponentCardsBreakdown {
  opponentId: string;
  cardsLeft: number;
  points: number;
}

export interface GaplehPointsCalculation {
  winType: GaplehWinType;
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
  multiplier: number;
  isFirstNutup: boolean;
  streakCount: number;
  opponentCardsBreakdown?: OpponentCardsBreakdown[];
  breakdownSummary: string;
}

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
  lastPlayedCards?: Record<string, DominoCard>;
  isFinished: boolean;
  winnerId?: string | null;
  deadlock: boolean;
  scores: Record<string, number>; // Individual hand pips
  round: number;
  level: 1 | 2; // Level 1 (Klasik - aturan existing tidak diubah) | Level 2 (Rame - aturan baru Sprint 1)

  // Points & victory details (v3)
  winType?: GaplehWinType;
  pointsDetails?: GaplehPointsCalculation;

  // Partnership-specific fields (optional for backward compatibility with individual mode)
  gameMode: GaplehGameMode;
  ruleset: GaplehRuleset;
  targetScore: number;
  teams: Record<string, 'A' | 'B'>;
  teamPips?: { A: number; B: number } | undefined;
  roundPoints?: { A: number; B: number } | undefined;
  matchScores: { A: number; B: number };
  winningTeam?: 'A' | 'B' | null | undefined;
  winReason?: 'cards_cleared' | 'deadlock' | 'seri' | undefined;
  partnershipSummary?: string | undefined;
  isMatchOver?: boolean | undefined;
}

