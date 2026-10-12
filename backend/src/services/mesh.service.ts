import { MeshPeer, MeshMessage, MeshPacket, SyncBatchRequest, SyncBatchResponse } from '../models/mesh.types';
import { prisma } from '../utils/prisma';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export class MeshNetworkService {
  private peers: Map<string, MeshPeer> = new Map();
  private messageStore: Map<string, MeshMessage> = new Map();
  private seenPacketIds: Map<string, number> = new Map(); // packet_id -> timestamp
  private rateLimitCounts: Map<string, { count: number; windowStart: number }> = new Map();
  private storageFile: string;

  public static readonly MAX_HOPS = 5;
  public static readonly DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
  public static readonly MAX_MESSAGES_PER_MINUTE = 10; // Anti-spam rule (6.7)

  constructor(storageDir?: string) {
    const dir = storageDir || path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    }
    this.storageFile = path.join(dir, 'mesh_storage.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf-8');
        const data = JSON.parse(raw);
        if (data.peers && Array.isArray(data.peers)) {
          data.peers.forEach((p: MeshPeer) => this.peers.set(p.peer_id, p));
        }
        if (data.messages && Array.isArray(data.messages)) {
          data.messages.forEach((m: MeshMessage) => this.messageStore.set(m.id, m));
        }
      }
    } catch (e) {
      // Fresh fallback
    }
  }

  private saveToDisk(): void {
    try {
      const data = {
        peers: Array.from(this.peers.values()),
        messages: Array.from(this.messageStore.values()),
        updatedAt: Date.now(),
      };
      fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Non-critical persistence
    }
  }

  // --- ANTI-SPAM RATE LIMITING (6.7: Max 10/menit per peer) ---
  public checkRateLimit(senderId: string): boolean {
    const now = Date.now();
    const entry = this.rateLimitCounts.get(senderId);

    if (!entry || now - entry.windowStart >= 60000) {
      this.rateLimitCounts.set(senderId, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= MeshNetworkService.MAX_MESSAGES_PER_MINUTE) {
      return false; // Rate limit exceeded!
    }

    entry.count += 1;
    return true;
  }

  // --- PEER DISCOVERY & MANAGEMENT ---
  public registerOrUpdatePeer(peer: Partial<MeshPeer> & { peer_id: string; display_name: string }): MeshPeer {
    const existing = this.peers.get(peer.peer_id);
    const updated: MeshPeer = {
      peer_id: peer.peer_id,
      display_name: peer.display_name,
      last_seen: Date.now(),
      public_key: peer.public_key || existing?.public_key,
      hop_count: peer.hop_count ?? existing?.hop_count ?? 1,
      signal_strength: peer.signal_strength ?? existing?.signal_strength ?? 85,
      verified: peer.verified ?? existing?.verified ?? false,
    };
    this.peers.set(peer.peer_id, updated);
    this.saveToDisk();
    return updated;
  }

  public getPeers(includeStale: boolean = false): MeshPeer[] {
    const now = Date.now();
    const STALE_THRESHOLD = 15 * 60 * 1000; // 15 minutes
    const list: MeshPeer[] = [];
    for (const p of this.peers.values()) {
      if (includeStale || (now - p.last_seen < STALE_THRESHOLD)) {
        list.push({ ...p });
      }
    }
    return list.sort((a, b) => (a.hop_count || 1) - (b.hop_count || 1));
  }

  public getPeer(peerId: string): MeshPeer | null {
    return this.peers.get(peerId) || null;
  }

  // --- PEER VERIFICATION (QR Code Fingerprint) ---
  public generatePeerVerificationFingerprint(publicKey: string): string {
    const hash = crypto.createHash('sha256').update(publicKey).digest('hex').toUpperCase();
    // Return formatted 16-character fingerprint grouped in 4s: XXXX-XXXX-XXXX-XXXX
    return hash.slice(0, 16).match(/.{1,4}/g)?.join('-') || hash.slice(0, 16);
  }

  public verifyPeer(peerId: string, fingerprintOrSignature: string): boolean {
    const peer = this.peers.get(peerId);
    if (!peer || !peer.public_key) return false;

    const expectedFingerprint = this.generatePeerVerificationFingerprint(peer.public_key);
    const normalizedInput = fingerprintOrSignature.replace(/-/g, '').toUpperCase();
    const normalizedExpected = expectedFingerprint.replace(/-/g, '').toUpperCase();

    if (normalizedInput === normalizedExpected) {
      peer.verified = true;
      this.peers.set(peerId, peer);
      this.saveToDisk();
      return true;
    }
    return false;
  }

  // --- PACKET CREATION ---
  public createPacket(params: {
    senderId: string;
    senderName: string;
    recipientId: string;
    type: MeshPacket['type'];
    payload: string;
    publicKey?: string;
    fileMeta?: MeshPacket['file_meta'];
  }): MeshPacket {
    return {
      packet_id: 'pkt_' + crypto.randomBytes(8).toString('hex'),
      type: params.type,
      sender_id: params.senderId,
      sender_name: params.senderName,
      recipient_id: params.recipientId,
      public_key: params.publicKey,
      payload: params.payload,
      timestamp: Date.now(),
      ttl_hops: MeshNetworkService.MAX_HOPS,
      hop_count: 0,
      visited_peers: [params.senderId],
      file_meta: params.fileMeta,
    };
  }

  // --- MULTI-HOP ROUTING & STORE-AND-FORWARD ENGINE ---
  public processIncomingPacket(myNodeId: string, packet: MeshPacket): {
    action: 'DELIVER_LOCAL' | 'RELAY' | 'STORE_FORWARD' | 'DROP';
    reason?: string;
    forwardPacket?: MeshPacket;
    message?: MeshMessage;
  } {
    // 1. Deduplication check
    if (this.seenPacketIds.has(packet.packet_id)) {
      return { action: 'DROP', reason: 'Duplicate packet already seen' };
    }
    this.seenPacketIds.set(packet.packet_id, Date.now());

    // 2. Loop prevention check
    if (packet.visited_peers.includes(myNodeId)) {
      return { action: 'DROP', reason: 'Routing loop detected (already visited this node)' };
    }

    // 3. TTL Hop check
    if (packet.ttl_hops <= 0) {
      return { action: 'DROP', reason: 'Hop limit TTL exhausted' };
    }

    // 4. Rate-limit check on sender
    if (packet.type === 'CHAT_MESSAGE' && !this.checkRateLimit(packet.sender_id)) {
      return { action: 'DROP', reason: 'Anti-spam rate limit exceeded (max 10 msg/min)' };
    }

    // Auto-discover sender peer
    this.registerOrUpdatePeer({
      peer_id: packet.sender_id,
      display_name: packet.sender_name,
      public_key: packet.public_key,
      hop_count: packet.hop_count + 1,
    });

    // 5. Destination check: Is this packet addressed to me or BROADCAST?
    const isForMe = packet.recipient_id === myNodeId;
    const isBroadcast = packet.recipient_id === 'BROADCAST';

    if (isForMe || isBroadcast) {
      let createdMsg: MeshMessage | undefined;
      if (packet.type === 'CHAT_MESSAGE') {
        createdMsg = {
          id: packet.packet_id,
          sender_id: packet.sender_id,
          recipient_id: packet.recipient_id,
          content: packet.payload,
          created_at: packet.timestamp,
          delivered: 1,
          ttl: MeshNetworkService.DEFAULT_TTL,
          hop_count: packet.hop_count + 1,
          route: [...packet.visited_peers, myNodeId],
          file_name: packet.file_meta?.name || null,
          file_size: packet.file_meta?.size || null,
          file_type: packet.file_meta?.mime_type || null,
          is_synced: false,
        };
        this.messageStore.set(createdMsg.id, createdMsg);
        this.saveToDisk();
      }

      if (isForMe) {
        return { action: 'DELIVER_LOCAL', message: createdMsg };
      }
    }

    // 6. Packet forwarding / routing for other recipients
    const nextHopPacket: MeshPacket = {
      ...packet,
      ttl_hops: packet.ttl_hops - 1,
      hop_count: packet.hop_count + 1,
      visited_peers: [...packet.visited_peers, myNodeId],
    };

    // Check if recipient is a known active direct or 1-2 hop peer
    const targetPeer = this.peers.get(packet.recipient_id);
    const isTargetActive = targetPeer && (Date.now() - targetPeer.last_seen < 10 * 60 * 1000);

    if (isTargetActive || isBroadcast) {
      return { action: 'RELAY', forwardPacket: nextHopPacket };
    } else {
      // Store-and-Forward: Recipient not seen yet, hold in local message store
      if (packet.type === 'CHAT_MESSAGE') {
        const storedMsg: MeshMessage = {
          id: packet.packet_id,
          sender_id: packet.sender_id,
          recipient_id: packet.recipient_id,
          content: packet.payload,
          created_at: packet.timestamp,
          delivered: 0,
          ttl: MeshNetworkService.DEFAULT_TTL,
          hop_count: packet.hop_count + 1,
          route: [...packet.visited_peers, myNodeId],
          file_name: packet.file_meta?.name || null,
          file_size: packet.file_meta?.size || null,
          is_synced: false,
        };
        this.messageStore.set(storedMsg.id, storedMsg);
        this.saveToDisk();
      }
      return { action: 'STORE_FORWARD', forwardPacket: nextHopPacket };
    }
  }

  // --- RETRIEVE QUEUED STORE-AND-FORWARD MESSAGES WHEN PEER RECONNECTS ---
  public flushQueuedMessagesForPeer(peerId: string): MeshMessage[] {
    const queued: MeshMessage[] = [];
    for (const msg of this.messageStore.values()) {
      if (msg.recipient_id === peerId && msg.delivered === 0) {
        queued.push({ ...msg });
        msg.delivered = 1;
      }
    }
    if (queued.length > 0) {
      this.saveToDisk();
    }
    return queued;
  }

  // --- LOCAL STORE QUERIES & TTL CLEANUP (Max 7 Hari) ---
  public getMessages(peerId?: string): MeshMessage[] {
    const list = Array.from(this.messageStore.values());
    if (peerId) {
      return list.filter(
        m => m.sender_id === peerId || m.recipient_id === peerId || m.recipient_id === 'BROADCAST'
      ).sort((a, b) => a.created_at - b.created_at);
    }
    return list.sort((a, b) => a.created_at - b.created_at);
  }

  public getUnsyncedMessages(): MeshMessage[] {
    return Array.from(this.messageStore.values()).filter(m => !m.is_synced);
  }

  public markMessagesSynced(messageIds: string[]): void {
    for (const id of messageIds) {
      const msg = this.messageStore.get(id);
      if (msg) {
        msg.is_synced = true;
      }
    }
    this.saveToDisk();
  }

  public pruneExpiredMessages(): number {
    const now = Date.now();
    let prunedCount = 0;
    for (const [id, msg] of this.messageStore.entries()) {
      if (now - msg.created_at > msg.ttl) {
        this.messageStore.delete(id);
        prunedCount++;
      }
    }
    if (prunedCount > 0) {
      this.saveToDisk();
    }
    return prunedCount;
  }

  // --- SERVER-SIDE SYNC ENGINE (When Device Reconnects Online) ---
  public async syncOfflineBatch(req: SyncBatchRequest): Promise<SyncBatchResponse> {
    const syncedIds: string[] = [];
    let failedCount = 0;

    for (const m of req.messages) {
      try {
        // Save to central database if prisma exists
        if (prisma && prisma.message && prisma.message.create) {
          const roomId = [m.sender_id, m.recipient_id].sort().join('_');
          await prisma.message.create({
            data: {
              id: m.id,
              sender_id: m.sender_id,
              room_id: roomId,
              content: m.content,
              timestamp: new Date(m.created_at),
              is_read: m.delivered === 1,
            }
          }).catch(() => {
            // If already exists, ignore duplicate key error
          });
        }

        // Keep local record synced
        const existing = this.messageStore.get(m.id);
        if (existing) {
          existing.is_synced = true;
          existing.delivered = 1;
        } else {
          this.messageStore.set(m.id, { ...m, is_synced: true, delivered: 1 });
        }

        syncedIds.push(m.id);
      } catch (err) {
        failedCount++;
      }
    }

    if (req.known_peers) {
      for (const p of req.known_peers) {
        this.registerOrUpdatePeer(p);
      }
    }

    this.saveToDisk();

    return {
      success: true,
      synced_count: syncedIds.length,
      failed_count: failedCount,
      synced_message_ids: syncedIds,
      server_timestamp: Date.now(),
    };
  }

  // Reset in-memory maps (useful for testing)
  public resetForTesting(): void {
    this.peers.clear();
    this.messageStore.clear();
    this.seenPacketIds.clear();
    this.rateLimitCounts.clear();
  }
}

export const meshNetworkService = new MeshNetworkService();
