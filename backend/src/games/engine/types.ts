export type GameType = 'gapleh' | 'remi' | 'bridge' | 'truf' | 'poker' | 'catur';

export type TableStatus = 'waiting' | 'playing' | 'finished';

export interface GamePlayerInfo {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  seat_number: number;
  team?: string | null;
  chip_balance?: number;
  is_ready: boolean;
  is_active: boolean;
  is_bot?: boolean;
}

export interface GameSpectatorInfo {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  joined_at: string;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  action?: string;
  data?: any;
  nextTurn?: string | null;
  finished?: boolean;
  results?: GameResult;
}

export interface GameResult {
  winners: string[];
  losers: string[];
  scores: Record<string, number>;
  summary: string;
}

export interface TableConfig {
  turnTimeLimitSec?: number; // default: 30
  maxScore?: number;
  blindAmount?: number;
  isPrivate?: boolean;
  password?: string;
  allowBots?: boolean;
}

export interface GameTableData {
  id: string;
  warung_id?: string | null;
  game_type: GameType;
  name: string;
  max_players: number;
  min_players: number;
  status: TableStatus;
  is_private: boolean;
  has_password?: boolean;
  host_id: string;
  created_at: string;
  players: GamePlayerInfo[];
  spectators: GameSpectatorInfo[];
  config?: TableConfig;
}
