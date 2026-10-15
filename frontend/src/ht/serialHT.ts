/**
 * Web Serial API Controller for kv4p HT & USB Radio Dongles
 */

export interface SerialHTClientState {
  isSupported: boolean;
  isConnected: boolean;
  portName?: string;
  frequency: number; // MHz
  powerWatts: number;
  pttActive: boolean;
  ctcss: string;
}

export class SerialHTClient {
  private static port: any = null;
  private static writer: any = null;
  private static reader: any = null;

  public static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public static async connect(): Promise<{ success: boolean; error?: string }> {
    if (!this.isSupported()) {
      return { success: false, error: 'Web Serial API tidak didukung pada browser ini. Gunakan Chrome/Edge atau beralih ke Mode Akustik.' };
    }

    try {
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate: 9600 });
      this.writer = this.port.writable.getWriter();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Gagal menyambungkan port USB Serial.' };
    }
  }

  public static async sendCommand(cmd: string): Promise<boolean> {
    if (!this.writer) return false;
    try {
      const data = new TextEncoder().encode(cmd + '\n');
      await this.writer.write(data);
      return true;
    } catch (e) {
      console.warn('Serial write error:', e);
      return false;
    }
  }

  public static async setFrequency(freq: number): Promise<boolean> {
    return this.sendCommand(`FREQ ${freq.toFixed(3)}`);
  }

  public static async setPtt(active: boolean): Promise<boolean> {
    return this.sendCommand(active ? 'PTT ON' : 'PTT OFF');
  }

  public static async disconnect(): Promise<void> {
    try {
      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (e) {
      console.warn('Serial disconnect error:', e);
    }
  }
}
