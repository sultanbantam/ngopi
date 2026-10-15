/**
 * Web/Mobile AcousticModem (Ribbit-style AFSK 1200/2200 Hz Bell 202)
 * Synthesizes audible AFSK audio waveforms for transmission over HT microphone
 * and plays authentic Walkie-Talkie sounds (Mic click, Roger beep).
 */

export class AcousticModemFrontend {
  private static audioCtx: AudioContext | null = null;

  private static getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Play authentic Roger Beep (K-beep: 1000 Hz, 120ms) upon releasing PTT
   */
  public static playRogerBeep(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, ctx.currentTime);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.warn('AudioContext Roger Beep error:', e);
    }
  }

  /**
   * Play PTT Key-down chirp (squelch burst)
   */
  public static playPttChirp(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
      console.warn('AudioContext PTT Chirp error:', e);
    }
  }

  /**
   * Synthesize and play AFSK Bell 202 audio stream directly through speaker
   * (Preamble + 1200/2200 Hz continuous phase FSK + CRC)
   */
  public static async playAfsktone(text: string, onFinish?: () => void): Promise<void> {
    const ctx = this.getAudioContext();
    if (!ctx) {
      if (onFinish) onFinish();
      return;
    }

    try {
      // Convert text to bytes
      const textBytes = new TextEncoder().encode(text);
      const length = textBytes.length;

      const framePayload = new Uint8Array(2 + length);
      framePayload[0] = (length >> 8) & 0xFF;
      framePayload[1] = length & 0xFF;
      framePayload.set(textBytes, 2);

      // CRC-16 CCITT
      let crc = 0xFFFF;
      for (let i = 0; i < framePayload.length; i++) {
        crc ^= (framePayload[i]! << 8);
        for (let j = 0; j < 8; j++) {
          crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
        }
      }

      const fullBytes: number[] = [];
      // 12 preamble flags
      for (let i = 0; i < 12; i++) fullBytes.push(0x7E);
      for (let b of framePayload) fullBytes.push(b);
      fullBytes.push((crc >> 8) & 0xFF, crc & 0xFF);
      for (let i = 0; i < 4; i++) fullBytes.push(0x7E);

      // Bits LSB
      const bits: number[] = [];
      for (const byte of fullBytes) {
        for (let b = 0; b < 8; b++) {
          bits.push((byte >> b) & 1);
        }
      }

      const sampleRate = ctx.sampleRate;
      const baudRate = 1200;
      const samplesPerBit = Math.round(sampleRate / baudRate);
      const totalSamples = bits.length * samplesPerBit;

      const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
      const channelData = buffer.getChannelData(0);

      let phase = 0;
      let idx = 0;

      for (const bit of bits) {
        const freq = bit === 1 ? 1200 : 2200;
        const phaseInc = (2 * Math.PI * freq) / sampleRate;

        for (let s = 0; s < samplesPerBit; s++) {
          channelData[idx++] = Math.sin(phase) * 0.75;
          phase += phaseInc;
          if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
        }
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);

      source.onended = () => {
        this.playRogerBeep();
        if (onFinish) onFinish();
      };

      source.start();
    } catch (err) {
      console.warn('[AcousticModemFrontend] Playback failed:', err);
      if (onFinish) onFinish();
    }
  }
}
