/**
 * AcousticModem Service (Ribbit-style AFSK 1200/2200 Hz Bell 202)
 * Converts text/data to audio waveforms (playable through smartphone speaker to HT mic)
 * and demodulates incoming audio back to text.
 */

export interface ModemConfig {
  sampleRate: number; // e.g. 22050 or 44100
  baudRate: number;   // 1200 baud
  markFreq: number;   // 1200 Hz (Logical 1)
  spaceFreq: number;  // 2200 Hz (Logical 0)
}

export const DEFAULT_MODEM_CONFIG: ModemConfig = {
  sampleRate: 22050,
  baudRate: 1200,
  markFreq: 1200,
  spaceFreq: 2200,
};

export class AcousticModem {
  private static readonly PREAMBLE_FLAGS = 16; // Number of sync flag bytes (0x7E)
  private static readonly FLAG_BYTE = 0x7E;     // Standard HDLC flag 01111110

  /**
   * Calculate CRC-16 CCITT (0x1021)
   */
  public static calculateCRC16(data: Uint8Array): number {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= (data[i]! << 8);
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    return crc;
  }

  /**
   * Modulate text into raw Float32 audio samples (-1.0 to 1.0)
   */
  public static encodeTextToSamples(text: string, config: ModemConfig = DEFAULT_MODEM_CONFIG): Float32Array {
    const textBytes = Buffer.from(text, 'utf-8');
    const length = textBytes.length;
    
    // Frame format: [Length: 2 bytes] + [Payload: N bytes] + [CRC16: 2 bytes]
    const framePayload = new Uint8Array(2 + length);
    framePayload[0] = (length >> 8) & 0xFF;
    framePayload[1] = length & 0xFF;
    framePayload.set(textBytes, 2);

    const crc = this.calculateCRC16(framePayload);
    const crcBytes = new Uint8Array([(crc >> 8) & 0xFF, crc & 0xFF]);

    // Build byte stream: Preamble + Frame + CRC + Postamble
    const fullBytes: number[] = [];
    for (let i = 0; i < this.PREAMBLE_FLAGS; i++) {
      fullBytes.push(this.FLAG_BYTE);
    }
    for (let b of framePayload) fullBytes.push(b);
    for (let b of crcBytes) fullBytes.push(b);
    for (let i = 0; i < 4; i++) fullBytes.push(this.FLAG_BYTE);

    // Convert bytes to bits (LSB first)
    const bits: number[] = [];
    for (const byte of fullBytes) {
      for (let b = 0; b < 8; b++) {
        bits.push((byte >> b) & 1);
      }
    }

    // Synthesize AFSK audio waveform
    const samplesPerBit = Math.round(config.sampleRate / config.baudRate);
    const totalSamples = bits.length * samplesPerBit;
    const samples = new Float32Array(totalSamples);

    let phase = 0.0;
    let sampleIdx = 0;

    for (const bit of bits) {
      const freq = bit === 1 ? config.markFreq : config.spaceFreq;
      const phaseInc = (2.0 * Math.PI * freq) / config.sampleRate;

      for (let s = 0; s < samplesPerBit; s++) {
        // Continuous phase sine wave
        samples[sampleIdx++] = Math.sin(phase) * 0.85; // 85% volume to avoid clipping in HT speaker
        phase += phaseInc;
        if (phase > 2.0 * Math.PI) {
          phase -= 2.0 * Math.PI;
        }
      }
    }

    return samples;
  }

  /**
   * Convert Float32Array to 16-bit PCM WAV Buffer
   */
  public static samplesToWav(samples: Float32Array, sampleRate = 22050): Buffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = samples.length * (bitsPerSample / 8);
    const buffer = Buffer.alloc(44 + dataSize);

    // RIFF identifier
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);

    // fmt sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);

    // data sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Write 16-bit PCM samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]!));
      const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
      buffer.writeInt16LE(Math.floor(val), offset);
      offset += 2;
    }

    return buffer;
  }

  /**
   * Goertzel algorithm to detect energy of a target frequency over N samples
   */
  public static goertzel(samples: Float32Array, startIdx: number, numSamples: number, targetFreq: number, sampleRate: number): number {
    const k = Math.round((numSamples * targetFreq) / sampleRate);
    const omega = (2.0 * Math.PI * k) / numSamples;
    const coeff = 2.0 * Math.cos(omega);

    let sPrev = 0.0;
    let sPrev2 = 0.0;

    const endIdx = Math.min(samples.length, startIdx + numSamples);
    for (let i = startIdx; i < endIdx; i++) {
      const s = samples[i]! + coeff * sPrev - sPrev2;
      sPrev2 = sPrev;
      sPrev = s;
    }

    return sPrev2 * sPrev2 + sPrev * sPrev - coeff * sPrev * sPrev2;
  }

  /**
   * Demodulate Float32 audio samples back into text
   */
  public static decodeSamplesToText(samples: Float32Array, config: ModemConfig = DEFAULT_MODEM_CONFIG): string | null {
    const samplesPerBit = Math.round(config.sampleRate / config.baudRate);
    if (samples.length < samplesPerBit * 8) return null;

    // Detect bits
    const totalBits = Math.floor(samples.length / samplesPerBit);
    const rawBits: number[] = [];

    for (let i = 0; i < totalBits; i++) {
      const start = i * samplesPerBit;
      const markEnergy = this.goertzel(samples, start, samplesPerBit, config.markFreq, config.sampleRate);
      const spaceEnergy = this.goertzel(samples, start, samplesPerBit, config.spaceFreq, config.sampleRate);
      rawBits.push(markEnergy >= spaceEnergy ? 1 : 0);
    }

    // Convert bitstream to bytes (aligning to start flag 0x7E)
    // Find sequence of preamble flags (0x7E)
    let bestStartBit = -1;
    for (let bitIdx = 0; bitIdx < rawBits.length - 16; bitIdx++) {
      let byteVal = 0;
      for (let b = 0; b < 8; b++) {
        byteVal |= (rawBits[bitIdx + b]! << b);
      }
      if (byteVal === this.FLAG_BYTE) {
        bestStartBit = bitIdx;
        break;
      }
    }

    if (bestStartBit === -1) return null;

    // Read bytes from alignment
    const bytes: number[] = [];
    for (let bitIdx = bestStartBit; bitIdx <= rawBits.length - 8; bitIdx += 8) {
      let byteVal = 0;
      for (let b = 0; b < 8; b++) {
        byteVal |= (rawBits[bitIdx + b]! << b);
      }
      bytes.push(byteVal);
    }

    // Skip preamble flags
    let idx = 0;
    while (idx < bytes.length && bytes[idx] === this.FLAG_BYTE) {
      idx++;
    }

    if (idx + 4 >= bytes.length) return null;

    // Read payload length (2 bytes)
    const lenHigh = bytes[idx++]!;
    const lenLow = bytes[idx++]!;
    const payloadLength = (lenHigh << 8) | lenLow;

    if (payloadLength <= 0 || idx + payloadLength + 2 > bytes.length) {
      return null;
    }

    // Extract payload bytes
    const payload = new Uint8Array(2 + payloadLength);
    payload[0] = lenHigh;
    payload[1] = lenLow;
    for (let p = 0; p < payloadLength; p++) {
      payload[2 + p] = bytes[idx++]!;
    }

    // Verify CRC-16
    const calculatedCrc = this.calculateCRC16(payload);
    const rxCrcHigh = bytes[idx++]!;
    const rxCrcLow = bytes[idx++]!;
    const rxCrc = (rxCrcHigh << 8) | rxCrcLow;

    if (calculatedCrc !== rxCrc) {
      console.warn(`[AcousticModem] CRC mismatch (calc: ${calculatedCrc.toString(16)}, rx: ${rxCrc.toString(16)})`);
      return null;
    }

    // Extract text from payload (skip 2 length bytes)
    const textBuffer = Buffer.from(payload.buffer, payload.byteOffset + 2, payloadLength);
    return textBuffer.toString('utf-8');
  }

  /**
   * Helper: Encode text directly to playable base64 Data URL (WAV)
   */
  public static encodeToWavDataUrl(text: string, config: ModemConfig = DEFAULT_MODEM_CONFIG): string {
    const samples = this.encodeTextToSamples(text, config);
    const wav = this.samplesToWav(samples, config.sampleRate);
    return `data:audio/wav;base64,${wav.toString('base64')}`;
  }
}
