/**
 * Web/Mobile AcousticModem (Ribbit-style AFSK 1200/2200 Hz Bell 202)
 * Sesuai Task 5.6 update1.md (HT Offline: Mode Akustik FSK).
 * Mengubah teks menjadi gelombang audio (Speaker HP ↔ Mic HT)
 * dan demodulasi suara dari speaker radio kembali menjadi teks via Mic HP.
 */

export class AcousticModem {
  protected static FREQ_MARK = 1200;   // Hz (bit 1)
  protected static FREQ_SPACE = 2200;  // Hz (bit 0)
  protected static SAMPLE_RATE = 44100; // Hz
  protected static audioCtx: AudioContext | null = null;
  protected static activeStream: MediaStream | null = null;
  protected static activeProcessor: ScriptProcessorNode | AudioWorkletNode | null = null;

  public static getAudioContext(): AudioContext | null {
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
   * Cek apakah Web Audio API didukung di browser ini
   */
  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window.AudioContext || (window as any).webkitAudioContext);
  }

  /**
   * 5.6.1 Encode teks → AudioBuffer
   */
  public static encode(text: string): AudioBuffer {
    const ctx = this.getAudioContext() || (typeof AudioContext !== 'undefined' ? new AudioContext() : null);
    if (!ctx) {
      throw new Error('Web Audio API (AudioContext) tidak didukung pada browser ini.');
    }

    const bitstream = this.textToBits(text);
    const samplesPerBit = Math.round(this.SAMPLE_RATE / 1200); // 1200 baud
    const totalSamples = bitstream.length * samplesPerBit;
    const buffer = ctx.createBuffer(1, totalSamples, this.SAMPLE_RATE);
    const data = buffer.getChannelData(0);

    let phase = 0.0;
    let sampleIndex = 0;
    for (const bit of bitstream) {
      const freq = bit === 1 ? this.FREQ_MARK : this.FREQ_SPACE;
      const phaseInc = (2 * Math.PI * freq) / this.SAMPLE_RATE;
      for (let i = 0; i < samplesPerBit; i++) {
        data[sampleIndex++] = Math.sin(phase) * 0.85;
        phase += phaseInc;
        if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
      }
    }

    return buffer;
  }

  /**
   * 5.6.1 Decode AudioBuffer → teks
   */
  public static async decode(audioBuffer: AudioBuffer): Promise<string> {
    const data = audioBuffer.getChannelData(0);
    return this.decodeSamples(data, audioBuffer.sampleRate);
  }

  /**
   * Goertzel algorithm helper to detect single frequency power
   */
  public static goertzel(samples: Float32Array, targetFreq: number, sampleRate: number): number {
    const numSamples = samples.length;
    const k = Math.round((numSamples * targetFreq) / sampleRate);
    const omega = (2.0 * Math.PI * k) / numSamples;
    const coeff = 2.0 * Math.cos(omega);

    let sPrev = 0.0;
    let sPrev2 = 0.0;

    for (let i = 0; i < numSamples; i++) {
      const s = samples[i]! + coeff * sPrev - sPrev2;
      sPrev2 = sPrev;
      sPrev = s;
    }

    return sPrev2 * sPrev2 + sPrev * sPrev - coeff * sPrev * sPrev2;
  }

  /**
   * Decode raw Float32 audio samples ke string teks
   */
  public static decodeSamples(samples: Float32Array, sampleRate = this.SAMPLE_RATE): string {
    let sumSq = 0;
    for (let i = 0; i < samples.length; i++) {
      sumSq += samples[i]! * samples[i]!;
    }
    const rms = Math.sqrt(sumSq / samples.length);
    // Squelch: ignore ambient silence and low-level room noise
    if (rms < 0.015) {
      return '';
    }

    const samplesPerBit = Math.round(sampleRate / 1200);
    if (samples.length < samplesPerBit * 24) return '';

    // Sample across different phase offsets to maximize symbol synchronization
    const offsets = [
      0,
      Math.round(samplesPerBit * 0.25),
      Math.round(samplesPerBit * 0.5),
      Math.round(samplesPerBit * 0.75),
    ];

    for (const offset of offsets) {
      const bitstream: number[] = [];
      for (let i = offset; i + samplesPerBit <= samples.length; i += samplesPerBit) {
        const segment = samples.slice(i, i + samplesPerBit);
        const markEnergy = this.goertzel(segment, this.FREQ_MARK, sampleRate);
        const spaceEnergy = this.goertzel(segment, this.FREQ_SPACE, sampleRate);
        bitstream.push(markEnergy >= spaceEnergy ? 1 : 0);
      }

      const decoded = this.extractFrameFromBits(bitstream);
      if (decoded && decoded.length >= 2) {
        return decoded;
      }
    }

    return '';
  }

  /**
   * Cari HDLC flag 0x7E (01111110) LSB ganda (16 bit) dan ekstrak payload frame Bell 202
   */
  private static extractFrameFromBits(bits: number[]): string {
    if (bits.length < 32) return '';

    // Cari pola 2x flag 0x7E berturut-turut (16 bits) untuk mencegah false sync pada derau
    let syncIdx = -1;
    for (let i = 0; i <= bits.length - 16; i++) {
      let match = true;
      for (let f = 0; f < 2; f++) {
        const offset = i + f * 8;
        if (
          !(bits[offset] === 0 &&
            bits[offset + 1] === 1 &&
            bits[offset + 2] === 1 &&
            bits[offset + 3] === 1 &&
            bits[offset + 4] === 1 &&
            bits[offset + 5] === 1 &&
            bits[offset + 6] === 1 &&
            bits[offset + 7] === 0)
        ) {
          match = false;
          break;
        }
      }
      if (match) {
        syncIdx = i;
        break;
      }
    }

    if (syncIdx === -1) return '';

    // Lewati seluruh deretan preamble 0x7E flags
    let cursor = syncIdx;
    while (cursor + 8 <= bits.length) {
      let bVal = 0;
      for (let b = 0; b < 8; b++) {
        bVal |= (bits[cursor + b]! << b);
      }
      if (bVal === 0x7E) {
        cursor += 8;
      } else {
        break;
      }
    }

    if (cursor + 16 > bits.length) return '';

    // Baca 2 bytes panjang payload: (high << 8) | low
    let lenHigh = 0;
    for (let b = 0; b < 8; b++) lenHigh |= (bits[cursor + b]! << b);
    let lenLow = 0;
    for (let b = 0; b < 8; b++) lenLow |= (bits[cursor + 8 + b]! << b);
    const length = (lenHigh << 8) | lenLow;
    cursor += 16;

    if (length > 0 && length <= 200 && cursor + length * 8 <= bits.length) {
      const payloadBytes = new Uint8Array(length);
      let allPrintable = true;
      for (let i = 0; i < length; i++) {
        let bVal = 0;
        for (let b = 0; b < 8; b++) {
          bVal |= (bits[cursor + i * 8 + b]! << b);
        }
        payloadBytes[i] = bVal;
        // Pastikan hanya karakter teks yang valid (ASCII printable atau UTF-8)
        if (bVal < 32 && bVal !== 9 && bVal !== 10 && bVal !== 13) {
          allPrintable = false;
          break;
        }
      }
      if (!allPrintable) return '';

      const rawText = new TextDecoder().decode(payloadBytes);
      return this.cleanAprsText(rawText);
    }

    return '';
  }

  /**
   * Bersihkan format APRS (ekstrak pesan obrolan asli)
   */
  public static cleanAprsText(text: string): string {
    if (!text) return '';
    // Format: CALL>APNGO1,WIDE1-1:!lat/lon-Pesan Obrolan
    const aprsMatch = text.match(/:(?:!)?[^ -]*-(.+)$/);
    if (aprsMatch && aprsMatch[1]) {
      return aprsMatch[1].trim();
    }
    const colonIdx = text.lastIndexOf(':');
    if (colonIdx !== -1 && colonIdx < text.length - 1) {
      const candidate = text.substring(colonIdx + 1).replace(/^![^ -]*-/, '').trim();
      if (candidate.length > 0) return candidate;
    }
    return text.trim();
  }

  /**
   * Deteksi frekuensi dominan menggunakan Zero-crossing detection (5.6.1)
   */
  public static detectFrequency(samples: Float32Array, sampleRate = this.SAMPLE_RATE): number {
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i - 1] < 0 && samples[i] >= 0) {
        crossings++;
      }
    }
    if (samples.length === 0) return 0;
    return (crossings * sampleRate) / samples.length;
  }

  /**
   * Konversi string teks ke array bits (8-bit per karakter) (5.6.1)
   */
  public static textToBits(text: string): number[] {
    const bits: number[] = [];
    for (const char of text) {
      const code = char.charCodeAt(0);
      for (let i = 7; i >= 0; i--) {
        bits.push((code >> i) & 1);
      }
    }
    return bits;
  }

  /**
   * Konversi array bits kembali ke string teks (5.6.1)
   */
  public static bitsToText(bits: number[]): string {
    let text = '';
    for (let i = 0; i < bits.length; i += 8) {
      if (i + 8 > bits.length) break;
      const byte = bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0);
      if (byte > 0 && byte < 128) {
        text += String.fromCharCode(byte);
      }
    }
    return text;
  }

  /**
   * Mainkan AudioBuffer melalui speaker perangkat
   */
  public static async playAudio(buffer: AudioBuffer, onFinish?: () => void): Promise<void> {
    const ctx = this.getAudioContext();
    if (!ctx) {
      if (onFinish) onFinish();
      return;
    }

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        this.playRogerBeep();
        if (onFinish) onFinish();
      };
      source.start();
    } catch (err) {
      console.warn('[AcousticModem] Gagal memutar audio:', err);
      if (onFinish) onFinish();
    }
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
   * Sintesis dan putar nada AFSK Bell 202 dengan sinkronisasi preamble + CRC
   */
  public static async playAfsktone(text: string, onFinish?: () => void): Promise<void> {
    const ctx = this.getAudioContext();
    if (!ctx) {
      if (onFinish) onFinish();
      return;
    }

    try {
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
      // 12 preamble flags (0x7E)
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

      const sampleRate = ctx.sampleRate || this.SAMPLE_RATE;
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
      console.warn('[AcousticModem] Gagal transmit AFSK tone:', err);
      if (onFinish) onFinish();
    }
  }

  /**
   * RX Demodulator: Mendengarkan audio masuk melalui mikrofon HP (speaker HT → mic HP)
   * Men-demodulasi gelombang FSK 1200/2200 Hz kembali menjadi teks.
   */
  public static async startListening(onReceive: (text: string) => void): Promise<() => void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Mikrofon tidak didukung di browser ini.');
    }

    const ctx = this.getAudioContext();
    if (!ctx) {
      throw new Error('Web Audio API tidak aktif.');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      this.activeStream = stream;

      const micSource = ctx.createMediaStreamSource(stream);
      // Buffer 4096 samples untuk analisis periodik
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      this.activeProcessor = processor;

      let accumulatedSamples: number[] = [];
      let lastReceivedText = '';
      let lastReceivedTime = 0;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        for (let i = 0; i < inputData.length; i++) {
          accumulatedSamples.push(inputData[i]!);
        }

        // Ketika terkumpul ~1.2 detik audio, coba decode
        if (accumulatedSamples.length >= Math.round(ctx.sampleRate * 1.2)) {
          const sampleArray = new Float32Array(accumulatedSamples);
          accumulatedSamples = accumulatedSamples.slice(Math.round(ctx.sampleRate * 0.6)); // 50% overlap

          const decoded = this.decodeSamples(sampleArray, ctx.sampleRate);
          const cleanText = decoded.trim().replace(/[\x00-\x1F\x7F]/g, '');
          const now = Date.now();
          if (cleanText.length >= 2 && (cleanText !== lastReceivedText || now - lastReceivedTime > 4000)) {
            lastReceivedText = cleanText;
            lastReceivedTime = now;
            accumulatedSamples = [];
            onReceive(cleanText);
          }
        }
      };

      const muteGain = ctx.createGain();
      muteGain.gain.setValueAtTime(0, ctx.currentTime);

      micSource.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(ctx.destination);

      return () => {
        this.stopListening();
      };
    } catch (err) {
      console.warn('[AcousticModem] Gagal mengaktifkan mikrofon RX:', err);
      throw err;
    }
  }

  /**
   * Hentikan listener mikrofon RX
   */
  public static stopListening(): void {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((track) => track.stop());
      this.activeStream = null;
    }
    if (this.activeProcessor) {
      this.activeProcessor.disconnect();
      this.activeProcessor = null;
    }
  }
}

/**
 * Alias kelas untuk kompatibilitas mundur dengan kode komponen eksisting
 */
export class AcousticModemFrontend extends AcousticModem {}
