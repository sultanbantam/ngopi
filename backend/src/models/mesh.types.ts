export interface MeshPeer {
  peer_id: string;
  display_name: string;
  last_seen: number;
  public_key?: string;
  hop_count?: number;
  signal_strength?: number; // RSSI or quality metric 0-100
  verified?: boolean;
}

export interface MeshMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string; // E2EE encrypted ciphertext
  created_at: number;
  delivered: number; // 0 = undelivered, 1 = delivered
  ttl: number; // Time-to-live in ms or expiration timestamp (default 7 days)
  hop_count?: number;
  route?: string[]; // Array of peer_ids traversed
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null; // e.g. 'image', 'document', 'audio'
  is_synced?: boolean;
}

export type MeshPacketType =
  | 'PEER_ANNOUNCE'
  | 'PEER_DISCOVERY'
  | 'CHAT_MESSAGE'
  | 'MESSAGE_ACK'
  | 'SYNC_BATCH'
  | 'PEER_VERIFY';

export interface MeshPacket {
  packet_id: string;
  type: MeshPacketType;
  sender_id: string;
  sender_name: string;
  recipient_id: string; // Target peer_id or 'BROADCAST'
  public_key?: string;
  payload: string; // Encrypted content or JSON payload
  timestamp: number;
  ttl_hops: number; // Max remaining hops (e.g. 5)
  hop_count: number;
  visited_peers: string[]; // Prevents infinite routing loops
  signature?: string;
  file_meta?: {
    name: string;
    size: number;
    mime_type: string;
    is_large: boolean; // true if > 1MB (requires WiFi-Direct / WebRTC)
  };
}

export interface SyncBatchRequest {
  device_id: string;
  user_id: string;
  messages: MeshMessage[];
  known_peers?: MeshPeer[];
}

export interface SyncBatchResponse {
  success: boolean;
  synced_count: number;
  failed_count: number;
  synced_message_ids: string[];
  server_timestamp: number;
}
