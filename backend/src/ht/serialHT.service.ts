/**
 * SerialHT Service (kv4p HT & USB-C Radio Dongle Controller)
 * Implements hardware serial communication protocol for USB-C HT dongles.
 */

export interface SerialHTState {
  connected: boolean;
  portName?: string;
  frequency: number; // MHz (e.g. 144.390)
  ctcss: string;      // e.g. "88.5" or "OFF"
  pttActive: boolean;
  powerWatts: number;
  batteryLevel?: number; // 0 - 100%
  rssi: number;          // -dBm signal strength
  lastCommand?: string;
  lastResponse?: string;
}

export class SerialHTService {
  private state: SerialHTState = {
    connected: false,
    frequency: 144.390,
    ctcss: 'OFF',
    pttActive: false,
    powerWatts: 1.0,
    batteryLevel: 95,
    rssi: -85,
  };

  private commandLog: Array<{ command: string; response: string; timestamp: number }> = [];

  /**
   * Process a hardware serial command string
   */
  public processCommand(rawCmd: string): { success: boolean; reply: string; state: SerialHTState } {
    const cmd = rawCmd.trim();
    const parts = cmd.split(' ');
    const op = parts[0]?.toUpperCase();
    const arg = parts.slice(1).join(' ');

    let reply = 'OK';
    let success = true;

    switch (op) {
      case 'CONNECT':
        this.state.connected = true;
        this.state.portName = arg || 'COM_USB_RADIO';
        reply = `CONNECTED: kv4p HT Rev B (Firmware v2.4, Port: ${this.state.portName})`;
        break;

      case 'DISCONNECT':
        this.state.connected = false;
        this.state.pttActive = false;
        reply = 'DISCONNECTED';
        break;

      case 'FREQ': {
        const f = parseFloat(arg);
        if (isNaN(f) || f < 136 || f > 480) {
          success = false;
          reply = 'ERROR: Frekuensi di luar batas VHF/UHF (136 - 480 MHz)';
        } else {
          this.state.frequency = Math.round(f * 1000) / 1000;
          reply = `FREQ SET: ${this.state.frequency.toFixed(3)} MHz`;
        }
        break;
      }

      case 'PTT': {
        const mode = arg.toUpperCase();
        if (mode === 'ON' || mode === '1') {
          this.state.pttActive = true;
          reply = `PTT ON: Transmitting on ${this.state.frequency.toFixed(3)} MHz`;
        } else if (mode === 'OFF' || mode === '0') {
          this.state.pttActive = false;
          reply = 'PTT OFF: Standby RX';
        } else {
          success = false;
          reply = 'ERROR: PTT must be ON or OFF';
        }
        break;
      }

      case 'CTCSS': {
        this.state.ctcss = arg || 'OFF';
        reply = `CTCSS TONE: ${this.state.ctcss}`;
        break;
      }

      case 'POWER': {
        const p = parseFloat(arg);
        if (isNaN(p) || p <= 0 || p > 5) {
          success = false;
          reply = 'ERROR: Power must be 0.1W - 5.0W';
        } else {
          this.state.powerWatts = p;
          reply = `POWER: ${p}W`;
        }
        break;
      }

      case 'STATUS': {
        reply = `STATUS: ${JSON.stringify(this.state)}`;
        break;
      }

      case 'SEND': {
        if (!this.state.connected) {
          success = false;
          reply = 'ERROR: Device not connected';
          break;
        }
        // Simulated transmit burst: PTT ON -> Payload -> PTT OFF
        reply = `SENT: "${arg}" on ${this.state.frequency} MHz (${this.state.powerWatts}W)`;
        break;
      }

      default:
        success = false;
        reply = `ERROR: Unknown command "${op}"`;
        break;
    }

    this.state.lastCommand = cmd;
    this.state.lastResponse = reply;

    this.commandLog.push({
      command: cmd,
      response: reply,
      timestamp: Date.now(),
    });

    if (this.commandLog.length > 100) {
      this.commandLog.shift();
    }

    return { success, reply, state: { ...this.state } };
  }

  public getState(): SerialHTState {
    return { ...this.state };
  }

  public getCommandLog() {
    return [...this.commandLog];
  }

  public reset(): void {
    this.state = {
      connected: false,
      frequency: 144.390,
      ctcss: 'OFF',
      pttActive: false,
      powerWatts: 1.0,
      batteryLevel: 95,
      rssi: -85,
    };
    this.commandLog = [];
  }
}

export const serialHTService = new SerialHTService();
