export interface UserConsentRecord {
  user_id: string;
  has_consented: boolean;
  policy_version: string; // e.g. "v3.0-2026"
  terms_version: string;
  consented_at: string;
  ip_address?: string;
  user_agent?: string;
}

export interface UserDeletionRequest {
  user_id: string;
  requested_at: string;
  grace_period_days: number; // 30 days default
  scheduled_purge_at: string;
  status: 'pending_deletion' | 'cancelled' | 'purged';
  reason?: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: 'LOGIN' | 'CONSENT_GRANTED' | 'CONSENT_REVOKED' | 'DATA_EXPORT' | 'ACCOUNT_DELETE_REQUESTED' | 'ACCOUNT_DELETE_CANCELLED' | 'PROFILE_UPDATED' | 'BREACH_ALERT';
  resource: string;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface DataExportPayload {
  export_metadata: {
    export_id: string;
    generated_at: string;
    format_version: string;
    controller: string;
    regulatory_framework: string; // "UU No. 27/2022 tentang Perlindungan Data Pribadi (UU PDP)"
  };
  profile: {
    user_id: string;
    username: string;
    display_name?: string;
    created_at?: string;
    avatar_url?: string | null;
  };
  consents: UserConsentRecord | null;
  points_economy: {
    balance: number;
    lifetime: number;
    streak_days: number;
    transactions: any[];
  };
  pokemon_tcg: {
    cards_count: number;
    cards: any[];
  };
  game_events: {
    hosted_events: any[];
    invitations: any[];
  };
  chats_metadata: {
    rooms_participated: string[];
    total_messages_sent: number;
    note: string; // "Isi pesan terlindungi dengan Enkripsi Ujung-ke-Ujung (E2EE X25519/AES-256-GCM) dan hanya dapat didekripsi di perangkat Anda."
  };
}

export interface SecurityBreachAlert {
  incident_id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detected_at: string;
  affected_accounts_count: number;
  description: string;
  containment_status: 'INVESTIGATING' | 'CONTAINED' | 'RESOLVED';
  notification_deadline_kominfo: string; // 3 x 24 hours deadline
  dpo_contact: string;
}
