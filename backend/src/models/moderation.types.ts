export type ModerationActionType = 'warning' | 'mute' | 'kick' | 'ban' | 'blacklist';
export type ModerationSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ModerationAction {
  id: string;
  user_id: string;
  warung_id?: string | null;
  action_type: ModerationActionType;
  reason: string;
  severity: ModerationSeverity;
  evidence?: {
    content?: string;
    detected_rule?: string;
    ai_score?: number;
    categories?: string[];
  } | null;
  expires_at?: string | null;
  issued_by?: string | null; // null = auto (AI/server)
  created_at: string;
}

export interface BlacklistEntry {
  id: string;
  user_id: string;
  ip_address?: string | null;
  device_id?: string | null;
  reason: string;
  is_permanent: boolean;
  created_at: string;
}

export interface SpamHashRecord {
  hash: string;
  count: number;
  first_seen: number;
  last_seen: number;
  user_id: string;
}

export interface ModerationReport {
  id: string;
  reporter_id: string;
  reporter_name?: string;
  reported_user_id: string;
  reported_user_name?: string;
  warung_id?: string | null;
  reason: string;
  message_content?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  action_taken?: ModerationActionType | null;
  created_at: string;
}

export interface ModerationClassificationResult {
  isHarmful: boolean;
  confidence: number;
  categories: {
    spam: boolean;
    hate_speech: boolean;
    sexual: boolean;
    violence: boolean;
    gambling: boolean;
  };
  recommended_action?: ModerationActionType;
  detected_by: 'RATE_LIMIT' | 'PRE_AI_RULES' | 'HASH_FLOOD' | 'AI_AGENT' | 'CLEAN';
  details?: string;
}
