import crypto from 'crypto';
import { htManagerService } from '../ht/htManager.service';

export interface EmergencyContactData {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  relation: string;
  is_primary: boolean;
  created_at: string;
}

export interface EmergencyLogData {
  id: string;
  user_id: string;
  username: string;
  type: 'accident' | 'medical' | 'disaster' | 'general';
  latitude: number | null;
  longitude: number | null;
  description: string;
  status: 'active' | 'resolved';
  responded_by: string[];
  created_at: string;
  ht_broadcast?: any;
  p3k_guide?: {
    topic: string;
    action_summary: string;
    hotline: string;
  };
}

export class EmergencyService {
  private contacts: Map<string, EmergencyContactData[]> = new Map();
  private logs: Map<string, EmergencyLogData> = new Map();

  /**
   * Task 7.2: Tombol SOS Otomatis
   * 1. Kirim lokasi GPS ke kontak darurat & frekuensi HT darurat (145.000 MHz).
   * 2. Notifikasi ke grup "Warung Kopi Darurat".
   * 3. Tampilkan panduan P3K relevan.
   * 4. Buka akses ke frekuensi HT darurat.
   */
  public triggerSOS(params: {
    userId: string;
    username?: string;
    type?: 'accident' | 'medical' | 'disaster' | 'general';
    latitude?: number | null;
    longitude?: number | null;
    description?: string;
  }): {
    success: boolean;
    emergencyLog: EmergencyLogData;
    htTransmission: any;
    daruratGroup: any;
    p3kGuide: any;
    notifiedContacts: number;
  } {
    const logId = 'sos_' + crypto.randomBytes(6).toString('hex');
    const incidentType = params.type || 'general';
    const lat = params.latitude ?? -6.2088;
    const lon = params.longitude ?? 106.8456;
    const desc = params.description || 'PANGGILAN DARURAT: Membutuhkan bantuan medis/evakuasi segera!';
    const username = params.username || 'Warga Warkop';

    // 1. Kirim sinyal APRS & AFSK tone ke frekuensi HT darurat (145.000 MHz)
    const htResult = htManagerService.prepareTransmission({
      userId: params.userId,
      content: `MAYDAY MAYDAY! ${username} (${incidentType.toUpperCase()}): ${desc}`,
      freq: 145.000,
      protocol: 'APRS',
      latitude: lat,
      longitude: lon,
      isEmergency: true,
    });

    // 2. Notifikasi ke grup "Warung Kopi Darurat"
    let daruratGroup = htManagerService.listGroups().find(g => g.name === 'Warung Kopi Darurat');
    if (!daruratGroup) {
      daruratGroup = htManagerService.createGroup({
        name: 'Warung Kopi Darurat',
        freq: 145.000,
        protocol: 'APRS',
        creatorId: 'system',
        description: 'Kanal siaga komunikasi darurat dan koordinasi SAR warkop.',
      });
    }

    // 3. Tentukan panduan P3K relevan
    const p3kGuide = this.getRelevantP3K(incidentType);

    // 4. Catat ke emergency log
    const emergencyLog: EmergencyLogData = {
      id: logId,
      user_id: params.userId,
      username,
      type: incidentType,
      latitude: lat,
      longitude: lon,
      description: desc,
      status: 'active',
      responded_by: [],
      created_at: new Date().toISOString(),
      ht_broadcast: {
        freq: 145.000,
        protocol: 'APRS',
        message: htResult.message,
      },
      p3k_guide: p3kGuide,
    };

    this.logs.set(logId, emergencyLog);

    const userContacts = this.contacts.get(params.userId) || [];

    return {
      success: true,
      emergencyLog,
      htTransmission: htResult,
      daruratGroup,
      p3kGuide,
      notifiedContacts: userContacts.length,
    };
  }

  /**
   * Rekomendasi P3K relevan sesuai tipe insiden (Task 7.2 point 3)
   */
  public getRelevantP3K(type: string): { topic: string; action_summary: string; hotline: string } {
    switch (type) {
      case 'medical':
        return {
          topic: 'Serangan Jantung & Henti Napas (CPR)',
          action_summary: 'Lakukan kompresi dada sedalam 5-6 cm dengan kecepatan 100-120 BPM (ritme Stayin\' Alive). Buka jalan napas head-tilt chin-lift.',
          hotline: '119 (Ambulans Kemenkes / PSC)',
        };
      case 'accident':
        return {
          topic: 'Kecelakaan Lalu Lintas & Pendarahan',
          action_summary: 'Pertahankan fiksasi leher korban tetap lurus. Berikan tekanan langsung (direct pressure) pada luka berdarah. Jangan lepas helm motor.',
          hotline: '112 (Panggilan Darurat Terpadu)',
        };
      case 'disaster':
        return {
          topic: 'Evakuasi Bencana Alam',
          action_summary: 'Gempa: Drop, Cover, Hold On! Tsunami: Ikuti rumus 20-20-20 menuju dataran tinggi. Matikan listrik dan gas kompor.',
          hotline: '115 (Basarnas SAR) / 117 (BNPB)',
        };
      case 'general':
      default:
        return {
          topic: 'Prinsip Penyelamatan DRSABCD',
          action_summary: 'Pastikan Danger aman, cek Response korban, Send for help hubungi 112, cek Airway & Breathing, siapkan CPR jika tidak bernapas.',
          hotline: '112 (Hotline Darurat Nasional Bebas Pulsa)',
        };
    }
  }

  public addContact(userId: string, contact: Omit<EmergencyContactData, 'id' | 'user_id' | 'created_at'>): EmergencyContactData {
    const list = this.contacts.get(userId) || [];
    const newContact: EmergencyContactData = {
      id: 'emg_' + crypto.randomBytes(5).toString('hex'),
      user_id: userId,
      name: contact.name,
      phone: contact.phone,
      relation: contact.relation,
      is_primary: Boolean(contact.is_primary),
      created_at: new Date().toISOString(),
    };
    if (newContact.is_primary) {
      list.forEach(c => (c.is_primary = false));
    }
    list.push(newContact);
    this.contacts.set(userId, list);
    return newContact;
  }

  public getContacts(userId: string): EmergencyContactData[] {
    return this.contacts.get(userId) || [];
  }

  public deleteContact(userId: string, contactId: string): boolean {
    const list = this.contacts.get(userId);
    if (!list) return false;
    const initialLen = list.length;
    const filtered = list.filter(c => c.id !== contactId);
    this.contacts.set(userId, filtered);
    return filtered.length < initialLen;
  }

  public getActiveLogs(): EmergencyLogData[] {
    return Array.from(this.logs.values()).filter(l => l.status === 'active');
  }

  public resolveLog(logId: string, responder: string): boolean {
    const log = this.logs.get(logId);
    if (!log) return false;
    log.status = 'resolved';
    if (!log.responded_by.includes(responder)) {
      log.responded_by.push(responder);
    }
    return true;
  }

  public resetForTesting(): void {
    this.contacts.clear();
    this.logs.clear();
  }
}

export const emergencyService = new EmergencyService();
