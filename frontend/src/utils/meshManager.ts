import { Platform } from 'react-native';
import axios from 'axios';
import { getAuthHeaders } from './api';

const API_URL = 'https://api.ngopi.top/api';

export interface MeshPeerItem {
  peer_id: string;
  display_name: string;
  last_seen: number;
  public_key?: string;
  hop_count: number;
  signal_strength: number; // 0 - 100
  verified: boolean;
}

export interface MeshMessageItem {
  id: string;
  sender_id: string;
  sender_name?: string;
  recipient_id: string;
  content: string;
  created_at: number;
  delivered: number; // 0 or 1
  ttl: number;
  hop_count?: number;
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null;
  is_synced: boolean;
}

export interface MeshPacket {
  packet_id: string;
  type: 'PEER_ANNOUNCE' | 'CHAT_MESSAGE' | 'MESSAGE_ACK' | 'SYNC_BATCH';
  sender_id: string;
  sender_name: string;
  recipient_id: string;
  public_key?: string;
  payload: string;
  timestamp: number;
  ttl_hops: number;
  hop_count: number;
  visited_peers: string[];
  file_meta?: {
    name: string;
    size: number;
    mime_type: string;
    is_large: boolean;
  };
}

class MeshManager {
  private peers: Map<string, MeshPeerItem> = new Map();
  private messages: Map<string, MeshMessageItem> = new Map();
  private isOfflineMode: boolean = false;
  private myPeerId: string = 'peer_' + Math.random().toString(36).substring(2, 9);
  private myDisplayName: string = 'Kawan Ngopi';
  private broadcastChannel: any = null;
  private listeners: Set<() => void> = new Set();
  private recentSentTimestamps: number[] = [];

  constructor() {
    this.initStorage();
    this.initP2PChannel();
  }

  private initStorage() {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        const rawPeers = localStorage.getItem('ngopi_mesh_peers');
        if (rawPeers) {
          const list: MeshPeerItem[] = JSON.parse(rawPeers);
          list.forEach(p => this.peers.set(p.peer_id, p));
        }

        const rawMsgs = localStorage.getItem('ngopi_mesh_messages');
        if (rawMsgs) {
          const list: MeshMessageItem[] = JSON.parse(rawMsgs);
          list.forEach(m => this.messages.set(m.id, m));
        }

        const offlinePref = localStorage.getItem('ngopi_mesh_offline_forced');
        if (offlinePref === 'true') {
          this.isOfflineMode = true;
        } else if (typeof navigator !== 'undefined') {
          this.isOfflineMode = !navigator.onLine;
        }
      } catch (e) {
        // Storage fallback
      }
    }
  }

  private saveStorage() {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('ngopi_mesh_peers', JSON.stringify(Array.from(this.peers.values())));
        localStorage.setItem('ngopi_mesh_messages', JSON.stringify(Array.from(this.messages.values())));
        localStorage.setItem('ngopi_mesh_offline_forced', this.isOfflineMode ? 'true' : 'false');
      } catch (e) {
        // Storage quota or error fallback
      }
    }
    this.notify();
  }

  private initP2PChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new (window as any).BroadcastChannel('ngopi_bluetooth_mesh_bus');
        this.broadcastChannel.onmessage = (event: MessageEvent) => {
          if (event.data && event.data.packet_id) {
            this.handleIncomingMeshPacket(event.data);
          }
        };
      } catch {
        // BroadcastChannel unavailable
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (!this.isForcedOffline()) {
          this.isOfflineMode = false;
          this.syncPendingMessages();
          this.notify();
        }
      });
      window.addEventListener('offline', () => {
        this.isOfflineMode = true;
        this.notify();
      });
    }
  }

  public setIdentity(peerId: string, displayName: string) {
    if (peerId) this.myPeerId = peerId;
    if (displayName) this.myDisplayName = displayName;
    this.announcePresence();
  }

  public getMyPeerId(): string {
    return this.myPeerId;
  }

  public getMyDisplayName(): string {
    return this.myDisplayName;
  }

  public isOffline(): boolean {
    return this.isOfflineMode;
  }

  public isForcedOffline(): boolean {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return localStorage.getItem('ngopi_mesh_offline_forced') === 'true';
    }
    return false;
  }

  public setOfflineMode(enabled: boolean) {
    this.isOfflineMode = enabled;
    this.saveStorage();
    if (!enabled) {
      this.syncPendingMessages();
    }
  }

  // Anti-Spam: Max 10 messages per minute (Sprint 6.7)
  public canSendMessage(): boolean {
    const now = Date.now();
    this.recentSentTimestamps = this.recentSentTimestamps.filter(t => now - t < 60000);
    return this.recentSentTimestamps.length < 10;
  }

  public announcePresence() {
    const packet: MeshPacket = {
      packet_id: 'announce_' + Math.random().toString(36).substring(2, 9),
      type: 'PEER_ANNOUNCE',
      sender_id: this.myPeerId,
      sender_name: this.myDisplayName,
      recipient_id: 'BROADCAST',
      payload: JSON.stringify({ seen: Date.now() }),
      timestamp: Date.now(),
      ttl_hops: 5,
      hop_count: 0,
      visited_peers: [this.myPeerId],
    };
    this.broadcastPacket(packet);
  }

  public broadcastPacket(packet: MeshPacket) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(packet);
      } catch (e) {
        // BroadcastChannel send error
      }
    }
  }

  public handleIncomingMeshPacket(packet: MeshPacket) {
    if (packet.sender_id === this.myPeerId) return; // Ignore own packet
    if (packet.visited_peers && packet.visited_peers.includes(this.myPeerId)) return; // Loop drop

    // Register / update peer
    this.peers.set(packet.sender_id, {
      peer_id: packet.sender_id,
      display_name: packet.sender_name || 'Kawan Warkop',
      last_seen: Date.now(),
      hop_count: packet.hop_count + 1,
      signal_strength: Math.max(30, 100 - (packet.hop_count * 20)),
      verified: this.peers.get(packet.sender_id)?.verified || false,
    });

    if (packet.type === 'CHAT_MESSAGE') {
      const isForMe = packet.recipient_id === this.myPeerId || packet.recipient_id === 'BROADCAST';
      if (isForMe && !this.messages.has(packet.packet_id)) {
        this.messages.set(packet.packet_id, {
          id: packet.packet_id,
          sender_id: packet.sender_id,
          sender_name: packet.sender_name,
          recipient_id: packet.recipient_id,
          content: packet.payload,
          created_at: packet.timestamp,
          delivered: 1,
          ttl: 7 * 24 * 3600 * 1000,
          hop_count: packet.hop_count + 1,
          file_name: packet.file_meta?.name || null,
          file_size: packet.file_meta?.size || null,
          file_type: packet.file_meta?.mime_type || null,
          is_synced: false,
        });
      }

      // Relay packet if remaining hops > 0
      if (packet.ttl_hops > 1) {
        const relayedPacket: MeshPacket = {
          ...packet,
          ttl_hops: packet.ttl_hops - 1,
          hop_count: packet.hop_count + 1,
          visited_peers: [...(packet.visited_peers || []), this.myPeerId],
        };
        this.broadcastPacket(relayedPacket);
      }
    }

    this.saveStorage();
  }

  public sendOfflineMessage(
    recipientId: string,
    content: string,
    fileMeta?: { name: string; size: number; mime_type: string; is_large: boolean }
  ): { success: boolean; error?: string; message?: MeshMessageItem } {
    if (!this.canSendMessage()) {
      return { success: false, error: 'Batas pesan tercapai: Maksimum 10 pesan per menit (Anti-Spam).' };
    }

    const msgId = 'mesh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const msgItem: MeshMessageItem = {
      id: msgId,
      sender_id: this.myPeerId,
      sender_name: this.myDisplayName,
      recipient_id: recipientId,
      content,
      created_at: Date.now(),
      delivered: 0,
      ttl: 7 * 24 * 3600 * 1000,
      file_name: fileMeta?.name || null,
      file_size: fileMeta?.size || null,
      file_type: fileMeta?.mime_type || null,
      is_synced: false,
    };

    this.messages.set(msgId, msgItem);
    this.recentSentTimestamps.push(Date.now());

    // Broadcast packet via mesh
    const packet: MeshPacket = {
      packet_id: msgId,
      type: 'CHAT_MESSAGE',
      sender_id: this.myPeerId,
      sender_name: this.myDisplayName,
      recipient_id: recipientId,
      payload: content,
      timestamp: msgItem.created_at,
      ttl_hops: 5,
      hop_count: 0,
      visited_peers: [this.myPeerId],
      file_meta: fileMeta,
    };
    this.broadcastPacket(packet);

    this.saveStorage();
    return { success: true, message: msgItem };
  }

  public getPeers(): MeshPeerItem[] {
    const list = Array.from(this.peers.values());
    return list.sort((a, b) => a.hop_count - b.hop_count);
  }

  public getMessagesForRoom(roomId: string, otherUserId?: string): MeshMessageItem[] {
    const list = Array.from(this.messages.values());
    if (!otherUserId) return list;
    return list.filter(
      m => (m.sender_id === otherUserId && m.recipient_id === this.myPeerId) ||
           (m.sender_id === this.myPeerId && m.recipient_id === otherUserId) ||
           (m.recipient_id === roomId)
    ).sort((a, b) => a.created_at - b.created_at);
  }

  public getUnsyncedMessages(): MeshMessageItem[] {
    return Array.from(this.messages.values()).filter(m => !m.is_synced);
  }

  public verifyPeer(peerId: string, fingerprint: string): boolean {
    const peer = this.peers.get(peerId);
    if (!peer) return false;
    peer.verified = true;
    this.peers.set(peerId, peer);
    this.saveStorage();
    return true;
  }

  public async syncPendingMessages(): Promise<{ synced: number; failed: number }> {
    const unsynced = this.getUnsyncedMessages();
    if (unsynced.length === 0) return { synced: 0, failed: 0 };

    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(
        `${API_URL}/mesh/sync`,
        {
          device_id: this.myPeerId,
          user_id: this.myPeerId,
          messages: unsynced,
          known_peers: this.getPeers(),
        },
        { headers }
      );

      if (res.data?.success) {
        const syncedIds = new Set<string>(res.data.synced_message_ids || []);
        unsynced.forEach(m => {
          if (syncedIds.has(m.id)) {
            m.is_synced = true;
          }
        });
        this.saveStorage();
        return { synced: res.data.synced_count, failed: res.data.failed_count };
      }
    } catch (e) {
      // Server might still be unreachable
    }
    return { synced: 0, failed: unsynced.length };
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }
}

export const meshManager = new MeshManager();
