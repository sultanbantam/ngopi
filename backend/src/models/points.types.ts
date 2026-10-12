export type PointsTransactionType =
  | 'chat_reward'
  | 'reaction_reward'
  | 'helper_reward'
  | 'game_played'
  | 'game_won'
  | 'daily_streak'
  | 'referral_reward'
  | 'daily_mission'
  | 'purchase_pokemon_pack'
  | 'purchase_sticker'
  | 'purchase_large_file'
  | 'purchase_cloud_storage'
  | 'purchase_watch_party'
  | 'purchase_theme'
  | 'purchase_badge'
  | 'purchase_beta_access'
  | 'convert_to_bmc';

export interface UserPoints {
  user_id: string;
  balance: number;
  lifetime: number;
  streak_days: number;
  last_login_date: string; // YYYY-MM-DD
  last_checkin_cycle_day?: number;
  daily_chat_count: number;
  daily_reaction_count: number;
  updated_at: number;
}

export interface PointsTransaction {
  id: string;
  user_id: string;
  amount: number; // positive = earn, negative = spend
  type: PointsTransactionType;
  reference?: string | null;
  description: string;
  created_at: number;
}

export interface PremiumFeature {
  id: string;
  name: string;
  price_points: number;
  price_bmc?: number;
  description: string;
  category: 'utility' | 'social' | 'customization' | 'access';
  icon: string;
}

export interface PremiumSubscription {
  id: string;
  user_id: string;
  tier: 'free' | 'premium' | 'pro';
  active_features: string[]; // array of feature ids
  expires_at: number;
  created_at: number;
}

export interface WatchPartyParticipant {
  user_id: string;
  user_name: string;
  joined_at: number;
}

export interface WatchParty {
  id: string;
  host_id: string;
  host_name: string;
  warung_id?: string | null;
  title: string;
  video_url: string;
  video_type: 'youtube' | 'custom';
  current_time: number; // in seconds
  is_playing: boolean;
  participants: WatchPartyParticipant[];
  created_at: number;
}

export interface ConvertPointsToBmcRequest {
  user_id: string;
  points_to_convert: number; // must be multiple of 1000
  wallet_address: string;
}

export interface ConvertPointsToBmcResponse {
  success: boolean;
  points_deducted: number;
  bmc_awarded: number;
  new_points_balance: number;
  tx_hash: string;
  timestamp: number;
}
