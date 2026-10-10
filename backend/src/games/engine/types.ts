export type GameType = 'gapleh' | 'remi' | 'bridge' | 'truf' | 'poker' | 'catur';

export type TableStatus = 'waiting' | 'playing' | 'finished';

export interface GamePlayerInfo {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null | undefined;
  seat_number: number;
  team?: string | null | undefined;
  chip_balance?: number | undefined;
  is_ready: boolean;
  is_active: boolean;
  is_bot?: boolean | undefined;
}

export interface GameSpectatorInfo {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null | undefined;
  joined_at: string;
}

export interface ActionResult {
  success: boolean;
  error?: string | undefined;
  action?: string | undefined;
  data?: any;
  nextTurn?: string | null | undefined;
  finished?: boolean | undefined;
  results?: GameResult | undefined;
}

export interface GameResult {
  winners: string[];
  losers: string[];
  scores: Record<string, number>;
  summary: string;
}

export interface TableConfig {
  turnTimeLimitSec?: number | undefined; // default: 30
  maxScore?: number | undefined;
  blindAmount?: number | undefined;
  isPrivate?: boolean | undefined;
  password?: string | undefined;
  allowBots?: boolean | undefined;
}

export interface GameTableData {
  id: string;
  warung_id?: string | null | undefined;
  game_type: GameType;
  name: string;
  max_players: number;
  min_players: number;
  status: TableStatus;
  is_private: boolean;
  has_password: boolean;
  host_id: string;
  created_at: string;
  started_at?: string | null | undefined;
  finished_at?: string | null | undefined;
  players: GamePlayerInfo[];
  spectators: GameSpectatorInfo[];
  config?: TableConfig | undefined;
}
