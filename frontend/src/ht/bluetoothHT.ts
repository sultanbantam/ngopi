/**
 * Web Bluetooth API Controller for Handy Talky (HT) Hardware
 * Mendukung komunikasi radio HT offline (Baofeng, Quansheng, BTECH, SenHaix, BLE TNC)
 * Sesuai Task 5.4 update1.md
 */

// Bluetooth GATT UUIDs umum untuk radio HT & TNC
export const HT_BLE_SERVICES = {
  STANDARD_HT_SERVICE: '0000ffe0-0000-1000-8000-00805f9b34fb', // Standard transparent serial
  STANDARD_HT_CHARACTERISTIC: '0000ffe1-0000-1000-8000-00805f9b34fb', // Read/Write/Notify
  NORDIC_UART_SERVICE: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  NORDIC_TX_CHARACTERISTIC: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  NORDIC_RX_CHARACTERISTIC: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  BATTERY_SERVICE: '0000180f-0000-1000-8000-00805f9b34fb',
  BATTERY_LEVEL_CHARACTERISTIC: '00002a19-0000-1000-8000-00805f9b34fb',
};

export interface BluetoothHTState {
  isSupported: boolean;
  isConnected: boolean;
  deviceName?: string;
  deviceId?: string;
  batteryLevel?: number;
  frequency: number; // MHz, default 145.500
  powerLevel: 'low' | 'mid' | 'high';
  pttActive: boolean;
  lastReceivedText?: string;
  lastSentText?: string;
  lastError?: string;
  statusMessage: string;
}

export type HTMessageListener = (text: string, rawBytes?: Uint8Array) => void;
export type HTStateListener = (state: BluetoothHTState) => void;

export class BluetoothHT {
  private device: any = null;
  private server: any = null;
  private characteristic: any = null;
  private batteryCharacteristic: any = null;

  private state: BluetoothHTState = {
    isSupported: false,
    isConnected: false,
    frequency: 145.500,
    powerLevel: 'high',
    pttActive: false,
    statusMessage: 'Siap untuk dipindai',
  };

  private messageListeners: Set<HTMessageListener> = new Set();
  private stateListeners: Set<HTStateListener> = new Set();

  constructor() {
    this.state.isSupported = this.isSupported();
  }

  /**
   * Cek dukungan Web Bluetooth pada browser (Chrome / Edge / Android Web)
   */
  public isSupported(): boolean {
    if (typeof navigator === 'undefined') return false;
    return typeof (navigator as any).bluetooth !== 'undefined';
  }

  /**
   * Dapatkan status kompatibilitas perangkat & browser (Task 5.4.2)
   */
  public getCompatibilityInfo(): {
    supported: boolean;
    browser: string;
    advice: string;
  } {
    const supported = this.isSupported();
    let browser = 'Browser Lain';
    let advice = 'Web Bluetooth didukung di Google Chrome & Microsoft Edge (Android & Desktop).';

    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent;
      if (/iPhone|iPad|iPod/i.test(ua)) {
        browser = 'Safari iOS / WebKit';
        advice = 'iOS Safari tidak mendukung Web Bluetooth. Silakan gunakan Mode Akustik (FSK) atau Bluefy browser.';
      } else if (/Firefox/i.test(ua)) {
        browser = 'Mozilla Firefox';
        advice = 'Firefox butuh flag eksperimental. Disarankan beralih ke Chrome/Edge atau Mode Akustik.';
      } else if (/Chrome|Edg/i.test(ua)) {
        browser = 'Google Chrome / Edge';
        advice = 'Mendukung penuh Web Bluetooth API.';
      }
    }

    return { supported, browser, advice };
  }

  /**
   * Sambungkan ke perangkat radio HT via Web Bluetooth
   */
  public async connect(): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      const compat = this.getCompatibilityInfo();
      const err = `Web Bluetooth tidak didukung pada browser ini. ${compat.advice}`;
      this.updateState({ statusMessage: err });
      return { success: false, error: err };
    }

    try {
      this.updateState({ statusMessage: 'Mencari perangkat HT Bluetooth...' });

      // Request device dengan filter UUID service HT standar dan optionalServices
      this.device = await (navigator as any).bluetooth.requestDevice({
        filters: [
          { services: [HT_BLE_SERVICES.STANDARD_HT_SERVICE] },
        ],
        optionalServices: [
          HT_BLE_SERVICES.BATTERY_SERVICE,
          HT_BLE_SERVICES.NORDIC_UART_SERVICE,
          'battery_service',
        ],
      });

      if (!this.device) {
        throw new Error('Pemilihan perangkat dibatalkan.');
      }

      this.device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

      this.updateState({
        statusMessage: `Menghubungkan ke ${this.device.name || 'Perangkat HT'}...`,
        deviceName: this.device.name || 'HT Radio',
        deviceId: this.device.id,
      });

      // Connect ke GATT Server
      this.server = await this.device.gatt?.connect();
      if (!this.server) {
        throw new Error('Gagal menghubungkan ke GATT Server HT.');
      }

      // Ambil Primary Service serial HT
      let service = null;
      try {
        service = await this.server.getPrimaryService(HT_BLE_SERVICES.STANDARD_HT_SERVICE);
      } catch (svcErr) {
        // Fallback coba Nordic UART
        try {
          service = await this.server.getPrimaryService(HT_BLE_SERVICES.NORDIC_UART_SERVICE);
        } catch {
          throw svcErr;
        }
      }

      // Ambil Karakteristik baca/tulis
      try {
        this.characteristic = await service.getCharacteristic(HT_BLE_SERVICES.STANDARD_HT_CHARACTERISTIC);
      } catch {
        this.characteristic = await service.getCharacteristic(HT_BLE_SERVICES.NORDIC_TX_CHARACTERISTIC);
      }

      // Mulai dengarkan notifikasi data masuk dari HT
      if (this.characteristic && typeof this.characteristic.startNotifications === 'function') {
        await this.characteristic.startNotifications();
        this.characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
          const value = event.target.value as DataView;
          if (value && value.buffer) {
            const rawBytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
            const text = new TextDecoder('utf-8').decode(rawBytes);
            this.onReceive(text, rawBytes);
          }
        });
      }

      // Opsional: baca level baterai HT jika ada
      try {
        const battService = await this.server.getPrimaryService(HT_BLE_SERVICES.BATTERY_SERVICE);
        this.batteryCharacteristic = await battService.getCharacteristic(HT_BLE_SERVICES.BATTERY_LEVEL_CHARACTERISTIC);
        const battVal = await this.batteryCharacteristic.readValue();
        const level = battVal.getUint8(0);
        this.updateState({ batteryLevel: level });
      } catch {
        // Baterai optional, tidak fatal jika gagal
      }

      this.updateState({
        isConnected: true,
        statusMessage: `Terhubung dengan ${this.device.name || 'HT Radio'}. Frekuensi: ${this.state.frequency} MHz`,
      });

      return { success: true };
    } catch (err: any) {
      console.warn('Bluetooth HT Connect error:', err);
      const msg = err?.message || 'Gagal menyambungkan HT Bluetooth.';
      this.updateState({
        isConnected: false,
        statusMessage: msg,
        lastError: msg,
      });
      return { success: false, error: msg };
    }
  }

  /**
   * Kirim pesan teks via transmisi radio HT
   */
  public async sendText(text: string): Promise<boolean> {
    if (!this.characteristic) {
      console.warn('Bluetooth HT belum terhubung');
      return false;
    }

    try {
      const encoder = new TextEncoder();
      const payload = encoder.encode(text + '\n');
      
      // Kirim bytes ke karakteristik Bluetooth HT
      if (typeof this.characteristic.writeValueWithResponse === 'function') {
        await this.characteristic.writeValueWithResponse(payload);
      } else {
        await this.characteristic.writeValue(payload);
      }

      this.updateState({
        lastSentText: text,
        statusMessage: `Terkirim via HT: "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}"`,
      });

      return true;
    } catch (e: any) {
      console.error('Error sending text via Bluetooth HT:', e);
      this.updateState({ lastError: e?.message || 'Gagal mengirim teks' });
      return false;
    }
  }

  /**
   * Kirim data biner mentah (APRS packet, frame FSK, atau audio payload)
   */
  public async sendRaw(bytes: Uint8Array): Promise<boolean> {
    if (!this.characteristic) return false;
    try {
      if (typeof this.characteristic.writeValueWithResponse === 'function') {
        await this.characteristic.writeValueWithResponse(bytes);
      } else {
        await this.characteristic.writeValue(bytes);
      }
      return true;
    } catch (e) {
      console.error('Error sending raw bytes via Bluetooth HT:', e);
      return false;
    }
  }

  /**
   * Kontrol Push-To-Talk (PTT) pada HT Bluetooth
   */
  public async setPTT(active: boolean): Promise<boolean> {
    this.updateState({ pttActive: active });
    const cmd = active ? 'PTT ON' : 'PTT OFF';
    return this.sendText(cmd);
  }

  /**
   * Atur frekuensi kerja HT (VHF/UHF, contoh: 145.500 MHz)
   */
  public async setFrequency(freqMHz: number): Promise<boolean> {
    this.updateState({ frequency: freqMHz });
    const cmd = `FREQ ${freqMHz.toFixed(3)}`;
    return this.sendText(cmd);
  }

  /**
   * Atur level daya pancar HT (Low, Mid, High)
   */
  public async setPower(power: 'low' | 'mid' | 'high'): Promise<boolean> {
    this.updateState({ powerLevel: power });
    const cmd = `POWER ${power.toUpperCase()}`;
    return this.sendText(cmd);
  }

  /**
   * Handler saat menerima data radio dari HT
   */
  public onReceive(text: string, rawBytes?: Uint8Array): void {
    console.log('[HT BLE Received]:', text);
    this.updateState({
      lastReceivedText: text,
      statusMessage: `Diterima dari HT: "${text.slice(0, 30)}${text.length > 30 ? '...' : ''}"`,
    });

    for (const listener of this.messageListeners) {
      try {
        listener(text, rawBytes);
      } catch (err) {
        console.error('Error in HT message listener:', err);
      }
    }
  }

  /**
   * Disconnect dari perangkat HT
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    } catch {}
    this.onDisconnected();
  }

  private onDisconnected(): void {
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.batteryCharacteristic = null;
    this.updateState({
      isConnected: false,
      pttActive: false,
      statusMessage: 'Koneksi HT terputus.',
    });
  }

  public getState(): BluetoothHTState {
    return { ...this.state };
  }

  public subscribeState(listener: HTStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getState());
    return () => this.stateListeners.delete(listener);
  }

  public onMessage(listener: HTMessageListener): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  private updateState(partial: Partial<BluetoothHTState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.stateListeners) {
      try {
        listener(this.getState());
      } catch {}
    }
  }
}

// Export singleton instance for easy app-wide sharing
export const bluetoothHT = new BluetoothHT();
