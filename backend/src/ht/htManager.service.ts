import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { HTProfile, HTMessage, HTGroup, HTTransmissionLog, HTProtocol } from './types';
import { AcousticModem } from './acousticModem.service';
import { APRSService } from './aprs.service';

const DEFAULT_HT_GROUPS: HTGroup[] = [
  {
    id: 'grp_aprs_nasional',
    name: 'APRS 144.390 MHz (Paket Data & GPS)',
    freq: 144.390,
    ctcss: null,
    protocol: 'APRS',
    creator_id: 'system',
    description: 'Frekuensi standar nasional APRS untuk tracking GPS, telemetri, dan pesan teks radio amatir.',
    members: [],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'grp_orari_emergency',
    name: 'ORARI 145.000 MHz (Panggilan Darurat)',
    freq: 145.000,
    ctcss: '88.5',
    protocol: 'ANALOG_VOICE',
    creator_id: 'system',
    description: 'Saluran siaga darurat bencana, SAR, dan posko kemanusiaan se-Indonesia.',
    members: [],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'grp_warkop_ht',
    name: 'Warung Kopi HT Net 144.500 MHz',
    freq: 144.500,
    ctcss: null,
    protocol: 'AFSK',
    creator_id: 'system',
    description: 'Nongkrong santai ngobrol teks dan audio akustik antar pengguna Ngopi tanpa internet.',
    members: [],
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'grp_uhf_local',
    name: 'UHF Repeater 435.000 MHz (Jangkauan Kota)',
    freq: 435.000,
    ctcss: '100.0',
    protocol: 'DMR',
    creator_id: 'system',
    description: 'Kanal UHF digital untuk area perkotaan dan gedung bertingkat.',
    members: [],
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export class HTManagerService {
  private profiles: Map<string, HTProfile> = new Map();
  private messages: HTMessage[] = [];
  private groups: Map<string, HTGroup> = new Map();
  private logs: HTTransmissionLog[] = [];
  private storageFile: string;

  constructor(storageDir?: string) {
    const dir = storageDir || path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    }
    this.storageFile = path.join(dir, 'ht_store.json');
    this.loadFromDisk();

    // Seed default groups if empty
    if (this.groups.size === 0) {
      for (const g of DEFAULT_HT_GROUPS) {
        this.groups.set(g.id, g);
      }
      this.saveToDisk();
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data.profiles)) {
          data.profiles.forEach((p: HTProfile) => this.profiles.set(p.user_id, p));
        }
        if (Array.isArray(data.messages)) {
          this.messages = data.messages;
        }
        if (Array.isArray(data.groups)) {
          data.groups.forEach((g: HTGroup) => this.groups.set(g.id, g));
        }
        if (Array.isArray(data.logs)) {
          this.logs = data.logs;
        }
      }
    } catch {
      // Fallback in-memory
    }
  }

  private saveToDisk(): void {
    try {
      const data = {
        profiles: Array.from(this.profiles.values()),
        messages: this.messages,
        groups: Array.from(this.groups.values()),
        logs: this.logs,
        updatedAt: Date.now(),
      };
      fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Non-critical persistence
    }
  }

  // --- 1. PROFILES & LEGAL COMPLIANCE ---

  public getOrCreateProfile(userId: string, defaultCallsign?: string): HTProfile {
    let p = this.profiles.get(userId);
    if (!p) {
      const generatedCall = defaultCallsign || `YD0${userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()}`;
      p = {
        id: 'ht_' + crypto.randomBytes(6).toString('hex'),
        user_id: userId,
        callsign: generatedCall,
        license_type: 'NONE',
        default_freq: 144.390,
        default_ctcss: '88.5',
        aprs_ssid: '7',
        power_watts: 1.0,
        is_verified: false,
        disclaimer_accepted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.profiles.set(userId, p);
      this.saveToDisk();
    }
    return p;
  }

  public updateProfile(userId: string, updates: Partial<HTProfile>): HTProfile {
    const p = this.getOrCreateProfile(userId);
    if (updates.callsign) p.callsign = updates.callsign.toUpperCase().trim();
    if (updates.license_type) p.license_type = updates.license_type;
    if (updates.license_number) p.license_number = updates.license_number.trim();
    if (typeof updates.default_freq === 'number') p.default_freq = updates.default_freq;
    if (updates.default_ctcss !== undefined) p.default_ctcss = updates.default_ctcss;
    if (updates.aprs_ssid) p.aprs_ssid = updates.aprs_ssid;
    if (typeof updates.power_watts === 'number') p.power_watts = Math.min(5.0, Math.max(0.1, updates.power_watts));
    if (updates.emergency_contact !== undefined) p.emergency_contact = updates.emergency_contact;
    if (typeof updates.disclaimer_accepted === 'boolean') p.disclaimer_accepted = updates.disclaimer_accepted;
    p.updated_at = new Date().toISOString();

    this.profiles.set(userId, p);
    this.saveToDisk();
    return p;
  }

  // --- 2. TRANSMISSION & AFSK AUDIO GENERATION ---

  public prepareTransmission(params: {
    userId: string;
    content: string;
    freq?: number;
    protocol?: HTProtocol;
    recipientId?: string | null;
    recipientCallsign?: string | null;
    latitude?: number;
    longitude?: number;
    isEmergency?: boolean;
    audioUrl?: string | null;
  }): {
    message: HTMessage;
    audioDataUrl: string;
    rawPacket: string;
    log: HTTransmissionLog;
  } {
    const profile = this.getOrCreateProfile(params.userId);
    const freq = params.freq || profile.default_freq || 144.390;
    const protocol = params.protocol || 'AFSK';
    const isEmergency = !!params.isEmergency;

    let rawPacket = params.content;

    // If APRS, build standard packet frame
    if (protocol === 'APRS') {
      if (isEmergency && params.latitude && params.longitude) {
        rawPacket = APRSService.buildEmergencyPacket({
          sourceCall: profile.callsign,
          sourceSsid: profile.aprs_ssid,
          latitude: params.latitude,
          longitude: params.longitude,
          emergencyText: params.content,
        });
      } else if (params.recipientCallsign) {
        rawPacket = APRSService.buildMessagePacket({
          sourceCall: profile.callsign,
          sourceSsid: profile.aprs_ssid,
          addresseeCall: params.recipientCallsign,
          message: params.content,
        });
      } else if (params.latitude && params.longitude) {
        rawPacket = APRSService.buildPositionPacket({
          sourceCall: profile.callsign,
          sourceSsid: profile.aprs_ssid,
          latitude: params.latitude,
          longitude: params.longitude,
          comment: params.content,
        });
      }
    }

    // Generate AFSK 1200/2200 Hz WAV audio or use supplied voice audio
    const audioDataUrl = params.audioUrl || AcousticModem.encodeToWavDataUrl(rawPacket);

    // Save HT message
    const msgId = 'htm_' + crypto.randomBytes(8).toString('hex');
    const message: HTMessage = {
      id: msgId,
      sender_id: params.userId,
      sender_callsign: profile.callsign,
      recipient_id: params.recipientId || null,
      recipient_callsign: params.recipientCallsign || null,
      content: params.content,
      freq,
      ctcss: profile.default_ctcss,
      protocol,
      status: 'sent',
      latitude: params.latitude,
      longitude: params.longitude,
      created_at: Date.now(),
      sent_at: Date.now(),
      delivered_at: Date.now(),
      audio_url: audioDataUrl,
      is_emergency: isEmergency,
    };

    this.messages.push(message);

    // Record legal compliance transmission log
    const log: HTTransmissionLog = {
      id: 'txlog_' + crypto.randomBytes(6).toString('hex'),
      user_id: params.userId,
      callsign: profile.callsign,
      freq_mhz: freq,
      protocol,
      tx_duration_ms: Math.round((rawPacket.length * 8 * 1000) / 1200) + 200,
      power_watts: profile.power_watts,
      is_emergency: isEmergency,
      timestamp: Date.now(),
      hash: crypto.createHash('sha256').update(`${profile.callsign}:${freq}:${Date.now()}:${rawPacket}`).digest('hex'),
    };

    this.logs.push(log);
    if (this.logs.length > 2000) this.logs = this.logs.slice(-2000);

    this.saveToDisk();

    return { message, audioDataUrl, rawPacket, log };
  }

  // --- 3. STORE-AND-FORWARD & SINKRONISASI ---

  public receiveIncomingRadioMessage(params: {
    content: string;
    freq: number;
    protocol?: HTProtocol;
    senderCallsign?: string;
    rssi?: number;
  }): HTMessage {
    const parsedAprs = APRSService.parsePacket(params.content);
    const msg: HTMessage = {
      id: 'htm_' + crypto.randomBytes(8).toString('hex'),
      sender_id: parsedAprs?.sourceCall || params.senderCallsign || 'RADIO_RX',
      sender_callsign: parsedAprs?.sourceCall || params.senderCallsign || 'RADIO_RX',
      recipient_id: null,
      recipient_callsign: parsedAprs?.addressee || null,
      content: parsedAprs?.messageText || params.content,
      freq: params.freq,
      protocol: params.protocol || (parsedAprs ? 'APRS' : 'AFSK'),
      status: 'delivered',
      rssi: params.rssi || -78,
      latitude: parsedAprs?.latitude,
      longitude: parsedAprs?.longitude,
      created_at: Date.now(),
      sent_at: Date.now(),
      delivered_at: Date.now(),
      is_emergency: params.content.includes('EMERGENCY') || params.content.includes('SOS'),
    };

    this.messages.push(msg);
    this.saveToDisk();
    return msg;
  }

  public getMessages(filter?: { userId?: string; freq?: number; isEmergency?: boolean }): HTMessage[] {
    return this.messages.filter(m => {
      if (filter?.isEmergency && !m.is_emergency) return false;
      if (filter?.freq && Math.abs(m.freq - filter.freq) > 0.005) return false;
      if (filter?.userId && m.sender_id !== filter.userId && m.recipient_id !== filter.userId && m.recipient_id !== null) {
        return false;
      }
      return true;
    }).sort((a, b) => b.created_at - a.created_at);
  }

  public syncOfflineBatch(offlineMessages: HTMessage[]): { received: number; synced: HTMessage[] } {
    const synced: HTMessage[] = [];
    for (const om of offlineMessages) {
      if (!this.messages.some(m => m.id === om.id)) {
        om.status = 'delivered';
        om.delivered_at = Date.now();
        this.messages.push(om);
        synced.push(om);
      }
    }
    this.saveToDisk();
    return { received: synced.length, synced };
  }

  // --- 4. WARUNG HT GROUPS / CHANNELS ---

  public listGroups(): HTGroup[] {
    return Array.from(this.groups.values()).filter(g => g.is_active);
  }

  public createGroup(params: {
    name: string;
    freq: number;
    ctcss?: string | null;
    protocol?: HTProtocol;
    creatorId: string;
    description?: string;
  }): HTGroup {
    const grp: HTGroup = {
      id: 'grp_' + crypto.randomBytes(6).toString('hex'),
      name: params.name,
      freq: params.freq,
      ctcss: params.ctcss || null,
      protocol: params.protocol || 'AFSK',
      creator_id: params.creatorId,
      description: params.description || '',
      members: [],
      is_active: true,
      created_at: new Date().toISOString(),
    };
    this.groups.set(grp.id, grp);
    this.saveToDisk();
    return grp;
  }

  // --- 4b. ACTIVE CHANNELS & TRAFFIC SCANNER ---
  public getChannelActivity(): Array<{
    freq: number;
    name: string;
    messageCount: number;
    activeUsersCount: number;
    lastMessageAt: number | null;
    isBusy: boolean;
  }> {
    const now = Date.now();
    const fifteenMinutesAgo = now - 15 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const monitoredChannels = [
      { freq: 144.390, name: 'APRS 144.390 (Paket Data/GPS)' },
      { freq: 145.000, name: 'ORARI 145.000 (Darurat Bencana/SAR)' },
      { freq: 144.500, name: 'Warkop HT Net 144.500 (Ngobrol Santai)' },
      { freq: 142.100, name: 'RAPI Nusantara 142.100 (Brik Warga)' },
      { freq: 146.820, name: 'Repeater 146.820 (Antar Kota)' },
      { freq: 435.000, name: 'UHF Repeater 435.000 (Digital DMR)' },
      { freq: 143.550, name: 'Relawan SAR 143.550 (Siaga Bencana)' },
      { freq: 145.500, name: 'Panggilan 145.500 (VHF 2-Meter)' },
    ];

    return monitoredChannels.map((ch) => {
      const chMsgs = this.messages.filter((m) => Math.abs(Number(m.freq) - ch.freq) < 0.05);
      const recentMsgs = chMsgs.filter((m) => {
        const t = typeof m.created_at === 'number' ? m.created_at : new Date(m.created_at).getTime();
        return t >= oneDayAgo;
      });
      const veryRecentMsgs = chMsgs.filter((m) => {
        const t = typeof m.created_at === 'number' ? m.created_at : new Date(m.created_at).getTime();
        return t >= fifteenMinutesAgo;
      });

      const uniqueUsers = new Set(recentMsgs.map((m) => m.sender_id || m.sender_callsign)).size;
      const lastMsg = chMsgs.length > 0 ? chMsgs[chMsgs.length - 1] : null;
      const lastTime = lastMsg
        ? (typeof lastMsg.created_at === 'number' ? lastMsg.created_at : new Date(lastMsg.created_at).getTime())
        : null;

      return {
        freq: ch.freq,
        name: ch.name,
        messageCount: recentMsgs.length,
        activeUsersCount: uniqueUsers,
        lastMessageAt: lastTime,
        isBusy: veryRecentMsgs.length > 0 || (ch.freq === 144.500 && chMsgs.length > 0),
      };
    });
  }

  // --- 5. LOGS & COMPLIANCE ---

  public getTransmissionLogs(userId?: string): HTTransmissionLog[] {
    if (userId) {
      return this.logs.filter(l => l.user_id === userId).sort((a, b) => b.timestamp - a.timestamp);
    }
    return this.logs.slice().sort((a, b) => b.timestamp - a.timestamp);
  }

  public resetForTesting(): void {
    this.profiles.clear();
    this.messages = [];
    this.groups.clear();
    this.logs = [];
    for (const g of DEFAULT_HT_GROUPS) {
      this.groups.set(g.id, g);
    }
  }
}

export const htManagerService = new HTManagerService();
