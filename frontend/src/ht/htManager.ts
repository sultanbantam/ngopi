/**
 * HTManager (Orkestrator HT Offline & Sinkronisasi Store-and-Forward)
 * Sesuai Task 5.7 update1.md.
 * Mengelola switching mode (Bluetooth, USB Serial, Akustik),
 * penyimpanan pesan offline ke IndexedDB, dan sinkronisasi otomatis ke server.
 */

import { BluetoothHT, bluetoothHT } from './bluetoothHT';
import { SerialHT, serialHT } from './serialHT';
import { AcousticModem, AcousticModemFrontend } from './acousticModem';

export interface HTLocalMessage {
  id: string;
  text: string;
  content: string;
  freq: number;
  mode: 'bluetooth' | 'serial' | 'acoustic' | 'none';
  status: 'pending' | 'sent' | 'delivered';
  timestamp: number;
  created_at: string;
}

export type HTMode = 'bluetooth' | 'serial' | 'acoustic' | 'none';

/**
 * Universal IndexedDB Helper dengan fallback aman ke in-memory / localStorage
 */
class LocalHTStore {
  private memoryStore: Map<string, HTLocalMessage> = new Map();
  private dbName = 'ngopi-ht';
  private storeName = 'messages';

  private async getIDB(): Promise<IDBDatabase | null> {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      return null;
    }
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  public async put(message: HTLocalMessage): Promise<void> {
    this.memoryStore.set(message.id, message);
    const db = await this.getIDB();
    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.put(message);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    } else if (typeof localStorage !== 'undefined') {
      try {
        const all = await this.getAll();
        const existingIdx = all.findIndex((m) => m.id === message.id);
        if (existingIdx >= 0) all[existingIdx] = message;
        else all.push(message);
        localStorage.setItem(`${this.dbName}_${this.storeName}`, JSON.stringify(all));
      } catch {
        // Fallback safely to memoryStore
      }
    }
  }

  public async getAll(): Promise<HTLocalMessage[]> {
    const db = await this.getIDB();
    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.storeName, 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve(Array.from(this.memoryStore.values()));
        } catch {
          resolve(Array.from(this.memoryStore.values()));
        }
      });
    } else if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(`${this.dbName}_${this.storeName}`);
        if (raw) return JSON.parse(raw);
      } catch {
        // fallback
      }
    }
    return Array.from(this.memoryStore.values());
  }

  public async delete(id: string): Promise<void> {
    this.memoryStore.delete(id);
    const db = await this.getIDB();
    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.delete(id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    } else if (typeof localStorage !== 'undefined') {
      try {
        const all = (await this.getAll()).filter((m) => m.id !== id);
        localStorage.setItem(`${this.dbName}_${this.storeName}`, JSON.stringify(all));
      } catch {
        // fallback
      }
    }
  }

  public async clear(): Promise<void> {
    this.memoryStore.clear();
    const db = await this.getIDB();
    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction(this.storeName, 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    } else if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(`${this.dbName}_${this.storeName}`);
      } catch {
        // fallback
      }
    }
  }
}

export const localHTStore = new LocalHTStore();

/**
 * Helper openDB sesuai Task 5.7 update1.md
 */
export async function openDB(dbName = 'ngopi-ht', version = 1) {
  return {
    put: (_store: string, data: any) => localHTStore.put(data),
    getAll: (_store: string) => localHTStore.getAll(),
    delete: (_store: string, id: string) => localHTStore.delete(id),
    clear: (_store: string) => localHTStore.clear(),
  };
}

/**
 * Kelas Orkestrator HTManager (Task 5.7)
 */
export class HTManager {
  private mode: HTMode = 'acoustic';
  private bluetooth: BluetoothHT = bluetoothHT;
  private serial: SerialHT = serialHT;
  private listeners: Set<(pending: HTLocalMessage[]) => void> = new Set();
  private isSyncing = false;

  constructor() {
    // Setup listener auto-sync saat browser kembali online (Task 5.7 line 698)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.syncToServer();
      });
    }
  }

  public getMode(): HTMode {
    return this.mode;
  }

  public setMode(mode: HTMode): void {
    this.mode = mode;
  }

  public async init(mode: string): Promise<void> {
    this.mode = (mode as HTMode) || 'acoustic';
    switch (this.mode) {
      case 'bluetooth':
        await this.bluetooth.connect();
        break;
      case 'serial':
        await this.serial.connect();
        break;
      case 'acoustic':
        // Tidak butuh koneksi khusus, cukup AudioContext
        break;
    }
  }

  /**
   * Mengirim pesan dan menyimpan salinan ke IndexedDB lokal untuk sinkronisasi (Task 5.7)
   */
  public async sendMessage(text: string, options?: { freq?: number }): Promise<HTLocalMessage> {
    const message: HTLocalMessage = {
      id: `ht_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text,
      content: text,
      freq: options?.freq || 145.500,
      mode: this.mode,
      status: 'pending',
      timestamp: Date.now(),
      created_at: new Date().toISOString(),
    };

    // 1. Simpan ke IndexedDB untuk sinkronisasi nanti saat online kembali
    await this.saveToLocalDB(message);

    // 2. Transmisi sesuai mode aktif
    switch (this.mode) {
      case 'bluetooth':
        await this.bluetooth.sendText(text);
        break;
      case 'serial':
        await this.serial.sendText(text);
        break;
      case 'acoustic':
      default:
        try {
          const buffer = AcousticModem.encode(text);
          await this.playAudio(buffer);
        } catch {
          await AcousticModemFrontend.playAfsktone(text);
        }
        break;
    }

    this.notifyPending();
    return message;
  }

  /**
   * Mainkan AudioBuffer melalui speaker perangkat
   */
  public async playAudio(buffer: AudioBuffer): Promise<void> {
    await AcousticModem.playAudio(buffer);
  }

  /**
   * Simpan ke IndexedDB lokal (Task 5.7)
   */
  public async saveToLocalDB(data: HTLocalMessage): Promise<void> {
    const db = await openDB('ngopi-ht', 1);
    await db.put('messages', data);
  }

  /**
   * Ambil daftar pesan yang menunggu sinkronisasi
   */
  public async getPendingMessages(): Promise<HTLocalMessage[]> {
    const db = await openDB('ngopi-ht', 1);
    const messages = await db.getAll('messages');
    return messages.filter((m) => m.status === 'pending');
  }

  /**
   * Sinkronisasi saat online kembali (Task 5.7 & 5.9.4)
   */
  public async syncToServer(apiBaseUrl = ''): Promise<{ success: boolean; syncedCount: number; errors: number }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, syncedCount: 0, errors: 0 };
    }

    if (this.isSyncing) {
      return { success: true, syncedCount: 0, errors: 0 };
    }

    this.isSyncing = true;
    let syncedCount = 0;
    let errors = 0;

    try {
      const db = await openDB('ngopi-ht', 1);
      const pending = await this.getPendingMessages();

      if (pending.length === 0) {
        this.isSyncing = false;
        return { success: true, syncedCount: 0, errors: 0 };
      }

      // Kirim batch atau individual ke /api/ht/sync
      const endpoint = `${apiBaseUrl}/api/ht/sync`;
      for (const msg of pending) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg),
          });

          if (res.ok) {
            await db.delete('messages', msg.id);
            syncedCount++;
          } else {
            errors++;
          }
        } catch {
          errors++;
        }
      }
    } catch {
      errors++;
    } finally {
      this.isSyncing = false;
      this.notifyPending();
    }

    return { success: errors === 0, syncedCount, errors };
  }

  /**
   * Subscribe ke perubahan jumlah pending messages
   */
  public subscribePending(callback: (pending: HTLocalMessage[]) => void): () => void {
    this.listeners.add(callback);
    this.getPendingMessages().then(callback);
    return () => this.listeners.delete(callback);
  }

  private async notifyPending(): Promise<void> {
    const pending = await this.getPendingMessages();
    this.listeners.forEach((cb) => {
      try {
        cb(pending);
      } catch (e) {
        console.warn('Pending listener error:', e);
      }
    });
  }
}

export const htManager = new HTManager();
