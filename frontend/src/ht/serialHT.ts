/**
 * Web Serial API Controller for Handy Talky (HT) via USB Cable / Dongle TNC
 * Sesuai Task 5.5 di update1.md
 * Mendukung kabel pemrograman Baofeng/Quansheng (PL2303, CH340, CP2102) & dongle kv4p HT
 */

export interface SerialHTState {
  isSupported: boolean;
  isConnected: boolean;
  portName?: string;
  baudRate: number;
  frequency: number; // MHz, default 145.500
  pttActive: boolean;
  powerWatts?: number;
  lastReceivedText?: string;
  lastSentText?: string;
  lastError?: string;
  statusMessage: string;
}

export type SerialHTMessageListener = (text: string) => void;
export type SerialHTStateListener = (state: SerialHTState) => void;

export class SerialHT {
  private port: any = null;
  private reader: any = null;
  private reading = false;

  private state: SerialHTState = {
    isSupported: false,
    isConnected: false,
    baudRate: 9600,
    frequency: 145.500,
    pttActive: false,
    statusMessage: 'Siap untuk menghubungkan USB Serial HT',
  };

  private messageListeners: Set<SerialHTMessageListener> = new Set();
  private stateListeners: Set<SerialHTStateListener> = new Set();

  constructor() {
    this.state.isSupported = this.isSupported();
  }

  /**
   * Cek apakah Web Serial API didukung pada browser ini
   */
  public isSupported(): boolean {
    if (typeof navigator === 'undefined') return false;
    return typeof (navigator as any).serial !== 'undefined';
  }

  /**
   * Dapatkan informasi kompatibilitas browser untuk Web Serial
   */
  public getCompatibilityInfo(): {
    supported: boolean;
    browser: string;
    advice: string;
  } {
    const supported = this.isSupported();
    let browser = 'Browser Lain';
    let advice = 'Web Serial API didukung di Google Chrome & Edge (Desktop).';

    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      if (/Android|iPhone|iPad|iPod/i.test(ua)) {
        browser = 'Mobile Browser';
        advice = 'Web Serial umumnya hanya tersedia di Desktop. Di ponsel Android/iOS, gunakan Mode Bluetooth atau Mode Akustik.';
      } else if (/Safari/i.test(ua) && !/Chrome|Edg/i.test(ua)) {
        browser = 'Safari Desktop';
        advice = 'Safari tidak mendukung Web Serial. Gunakan Google Chrome atau Edge di Desktop.';
      } else if (/Firefox/i.test(ua)) {
        browser = 'Mozilla Firefox';
        advice = 'Firefox tidak mendukung Web Serial API. Gunakan Chrome atau beralih ke Mode Akustik.';
      } else if (/Chrome|Edg/i.test(ua)) {
        browser = 'Google Chrome / Edge (Desktop)';
        advice = 'Mendukung penuh Web Serial API untuk dongle USB HT & TNC.';
      }
    }

    return { supported, browser, advice };
  }

  /**
   * Sambungkan ke port USB HT via dialog Web Serial
   */
  public async connect(options?: { baudRate?: number }): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      const compat = this.getCompatibilityInfo();
      const err = `Web Serial API tidak didukung pada browser ini. ${compat.advice}`;
      this.updateState({ statusMessage: err, lastError: err });
      return { success: false, error: err };
    }

    const baudRate = options?.baudRate || this.state.baudRate || 9600;

    try {
      this.updateState({ statusMessage: 'Meminta izin pemilihan port USB Serial HT...' });

      // Request port dari user
      this.port = await (navigator as any).serial.requestPort();
      if (!this.port) {
        throw new Error('Pemilihan port USB dibatalkan.');
      }

      await this.port.open({ baudRate });

      this.updateState({
        isConnected: true,
        baudRate,
        statusMessage: `Port USB Serial terhubung (${baudRate} baud).`,
      });

      // Mulai baca stream data masuk dari HT
      this.startReadingStream();

      return { success: true };
    } catch (err: any) {
      console.warn('Web Serial HT Connect error:', err);
      const msg = err?.message || 'Gagal menyambungkan port USB Serial.';
      this.updateState({
        isConnected: false,
        statusMessage: msg,
        lastError: msg,
      });
      return { success: false, error: msg };
    }
  }

  /**
   * Inisialisasi loop pembacaan stream data dari HT
   */
  private startReadingStream(): void {
    if (!this.port || !this.port.readable) return;

    try {
      if (typeof TextDecoderStream !== 'undefined') {
        const textDecoder = new TextDecoderStream();
        this.port.readable.pipeTo(textDecoder.writable).catch((e: any) => {
          console.warn('Serial pipe error:', e);
        });
        this.reader = textDecoder.readable.getReader();
      } else {
        this.reader = this.port.readable.getReader();
      }

      this.reading = true;
      this.readLoop();
    } catch (e) {
      console.warn('Error starting serial reader stream:', e);
    }
  }

  /**
   * Loop membaca data masuk tanpa henti sesuai Task 5.5
   */
  public async readLoop(): Promise<void> {
    try {
      while (this.reading && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }
        if (value) {
          const text = typeof value === 'string' ? value : new TextDecoder().decode(value);
          this.onReceive(text);
        }
      }
    } catch (err: any) {
      if (this.reading) {
        console.warn('Serial readLoop stopped:', err);
      }
    } finally {
      if (this.reader) {
        try {
          this.reader.releaseLock();
        } catch {}
        this.reader = null;
      }
    }
  }

  /**
   * Kirim teks via radio HT USB sesuai Task 5.5
   */
  public async sendText(text: string): Promise<boolean> {
    if (!this.port || !this.port.writable) {
      console.warn('Port Serial HT belum tersambung');
      return false;
    }

    let writer: any = null;
    try {
      writer = this.port.writable.getWriter();
      const encoder = new TextEncoder();
      const payload = encoder.encode(`SEND ${text}\n`);
      await writer.write(payload);
      writer.releaseLock();

      this.updateState({
        lastSentText: text,
        statusMessage: `Terkirim via USB HT: "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}"`,
      });
      return true;
    } catch (e: any) {
      console.error('Serial sendText error:', e);
      if (writer) {
        try { writer.releaseLock(); } catch {}
      }
      this.updateState({ lastError: e?.message || 'Gagal mengirim data via serial' });
      return false;
    }
  }

  /**
   * Aktifkan transmisi PTT (Push-To-Talk) sesuai Task 5.5
   */
  public async startPTT(): Promise<boolean> {
    this.updateState({ pttActive: true });
    return this.sendCommand('PTT ON\n');
  }

  /**
   * Matikan transmisi PTT sesuai Task 5.5
   */
  public async stopPTT(): Promise<boolean> {
    this.updateState({ pttActive: false });
    return this.sendCommand('PTT OFF\n');
  }

  /**
   * Atur frekuensi kerja HT (contoh: 145.500 MHz)
   */
  public async setFrequency(freqMHz: number): Promise<boolean> {
    this.updateState({ frequency: freqMHz });
    return this.sendCommand(`FREQ ${freqMHz.toFixed(3)}\n`);
  }

  /**
   * Kirim perintah raw serial
   */
  public async sendCommand(cmd: string): Promise<boolean> {
    if (!this.port || !this.port.writable) return false;

    let writer: any = null;
    try {
      writer = this.port.writable.getWriter();
      const data = new TextEncoder().encode(cmd.endsWith('\n') ? cmd : cmd + '\n');
      await writer.write(data);
      writer.releaseLock();
      return true;
    } catch (e: any) {
      if (writer) {
        try { writer.releaseLock(); } catch {}
      }
      console.warn('Serial sendCommand error:', e);
      return false;
    }
  }

  /**
   * Handler saat menerima data radio via Serial HT
   */
  public onReceive(text: string): void {
    console.log('HT Received:', text);
    this.updateState({
      lastReceivedText: text,
      statusMessage: `Diterima dari USB HT: "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}"`,
    });

    for (const listener of this.messageListeners) {
      try {
        listener(text);
      } catch (err) {
        console.error('Error in Serial message listener:', err);
      }
    }
  }

  /**
   * Putuskan koneksi port Serial USB
   */
  public async disconnect(): Promise<void> {
    this.reading = false;
    try {
      if (this.reader) {
        await this.reader.cancel().catch(() => {});
        this.reader = null;
      }
      if (this.port) {
        await this.port.close().catch(() => {});
        this.port = null;
      }
    } catch (e) {
      console.warn('Serial disconnect warning:', e);
    } finally {
      this.updateState({
        isConnected: false,
        pttActive: false,
        statusMessage: 'Koneksi USB Serial HT terputus.',
      });
    }
  }

  public getState(): SerialHTState {
    return { ...this.state };
  }

  public subscribeState(listener: SerialHTStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => this.stateListeners.delete(listener);
  }

  public onMessage(listener: SerialHTMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  private updateState(partial: Partial<SerialHTState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.stateListeners) {
      try {
        listener(this.getState());
      } catch {}
    }
  }

  // --- Static delegations for backward compatibility ---
  public static async connect(options?: { baudRate?: number }): Promise<{ success: boolean; error?: string }> {
    return serialHT.connect(options);
  }

  public static async setFrequency(freq: number): Promise<boolean> {
    return serialHT.setFrequency(freq);
  }

  public static async setPtt(active: boolean): Promise<boolean> {
    return active ? serialHT.startPTT() : serialHT.stopPTT();
  }

  public static async startPTT(): Promise<boolean> {
    return serialHT.startPTT();
  }

  public static async stopPTT(): Promise<boolean> {
    return serialHT.stopPTT();
  }

  public static async sendCommand(cmd: string): Promise<boolean> {
    return serialHT.sendCommand(cmd);
  }

  public static async sendText(text: string): Promise<boolean> {
    return serialHT.sendText(text);
  }

  public static async disconnect(): Promise<void> {
    return serialHT.disconnect();
  }
}

// Backward-compatible alias for existing imports
export const SerialHTClient = SerialHT;
export type SerialHTClientState = SerialHTState;

// Singleton instance
export const serialHT = new SerialHT();
