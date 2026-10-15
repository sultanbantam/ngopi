export type HTProtocol = 'APRS' | 'DMR' | 'AFSK' | 'ANALOG_VOICE';

export type HTLicenseType = 'IAR' | 'KRAP' | 'ORARI' | 'NONE';

export interface HTProfile {
  id: string;
  user_id: string;
  callsign: string;
  license_type: HTLicenseType;
  license_number?: string;
  default_freq: number; // in MHz, e.g. 144.390
  default_ctcss?: string; // e.g. '88.5'
  aprs_ssid: string; // e.g. '7' (handheld)
  power_watts: number; // max 5W for portable
  emergency_contact?: string;
  is_verified: boolean;
  disclaimer_accepted: boolean;
  created_at: string;
  updated_at: string;
}

export interface HTMessage {
  id: string;
  sender_id: string;
  sender_callsign?: string;
  recipient_id?: string | null; // null = broadcast / channel CQ
  recipient_callsign?: string | null;
  content: string;
  freq: number; // MHz
  ctcss?: string | null;
  protocol: HTProtocol;
  status: 'pending' | 'transmitting' | 'sent' | 'delivered' | 'failed';
  rssi?: number; // signal strength -dBm
  latitude?: number;
  longitude?: number;
  created_at: number;
  sent_at?: number | null;
  delivered_at?: number | null;
  audio_url?: string | null;
  is_emergency?: boolean;
}

export interface HTGroup {
  id: string;
  name: string;
  freq: number; // MHz
  ctcss?: string | null;
  protocol: HTProtocol;
  creator_id: string;
  description?: string;
  members: Array<{
    user_id: string;
    callsign: string;
    joined_at: number;
  }>;
  is_active: boolean;
  created_at: string;
}

export interface APRSPacket {
  sourceCall: string;
  sourceSsid?: string;
  destCall: string;
  path: string[];
  type: 'message' | 'position' | 'status' | 'telemetry' | 'weather';
  messageText?: string;
  addressee?: string;
  latitude?: number;
  longitude?: number;
  comment?: string;
  raw: string;
}

export interface HTTransmissionLog {
  id: string;
  user_id: string;
  callsign: string;
  freq_mhz: number;
  protocol: HTProtocol;
  tx_duration_ms: number;
  power_watts: number;
  is_emergency: boolean;
  timestamp: number;
  hash: string;
}
