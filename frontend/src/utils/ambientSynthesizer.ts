/**
 * Web Audio Ambient Sound Synthesizer
 * Generates continuous, high-quality, zero-dependency ambient soundscapes
 * directly in the browser using the Web Audio API.
 * 100% offline, zero network requests, zero 403 errors, infinite seamless loop.
 */

class AmbientSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentSoundId: string | null = null;
  private activeNodes: { stop?: () => void; disconnect?: () => void }[] = [];
  private intervals: any[] = [];
  private isRunning = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      this.ctx = new AudioContextClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Create a 5-second looping white/pink noise buffer
  private createNoiseBuffer(ctx: AudioContext, type: 'pink' | 'brown' | 'white' = 'pink'): AudioBuffer {
    const bufferSize = ctx.sampleRate * 5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    let lastOut = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;

      if (type === 'pink') {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else if (type === 'brown') {
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      } else {
        data[i] = white * 0.15;
      }
    }
    return buffer;
  }

  public start(soundId: string, volume: number = 0.5): boolean {
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    this.stop();
    this.currentSoundId = soundId;
    this.isRunning = true;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime);
    this.masterGain.connect(ctx.destination);

    switch (soundId) {
      case 'hujan':
        this.buildRain(ctx, this.masterGain);
        break;
      case 'ombak':
        this.buildWaves(ctx, this.masterGain);
        break;
      case 'kafe_ramai':
        this.buildCafe(ctx, this.masterGain);
        break;
      case 'hutan':
        this.buildForest(ctx, this.masterGain);
        break;
      case 'jangkrik':
        this.buildCrickets(ctx, this.masterGain);
        break;
      case 'api_unggun':
        this.buildCampfire(ctx, this.masterGain);
        break;
      default:
        this.buildRain(ctx, this.masterGain);
        break;
    }

    return true;
  }

  // 1. Hujan Rintik (Rain)
  private buildRain(ctx: AudioContext, destination: GainNode) {
    const noiseBuffer = this.createNoiseBuffer(ctx, 'pink');
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, ctx.currentTime);

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(100, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(highpass);
    highpass.connect(gain);
    gain.connect(destination);

    noiseSource.start();
    this.activeNodes.push(noiseSource);

    // Periodic gentle water droplet pings
    const dropInterval = setInterval(() => {
      if (!this.isRunning || ctx.state !== 'running') return;
      try {
        const osc = ctx.createOscillator();
        const dropGain = ctx.createGain();
        const freq = 1200 + Math.random() * 800;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.6, ctx.currentTime + 0.08);

        dropGain.gain.setValueAtTime(0.04, ctx.currentTime);
        dropGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);

        osc.connect(dropGain);
        dropGain.connect(destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.09);
      } catch {}
    }, 280);

    this.intervals.push(dropInterval);
  }

  // 2. Ombak Pantai (Ocean Waves with smooth 7s swell)
  private buildWaves(ctx: AudioContext, destination: GainNode) {
    const noiseBuffer = this.createNoiseBuffer(ctx, 'brown');
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);

    const waveGain = ctx.createGain();
    waveGain.gain.setValueAtTime(0.3, ctx.currentTime);

    // LFO modulator for wave swell (period ~ 6.5 seconds)
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.15, ctx.currentTime); // ~6.6 seconds

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.25, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(waveGain.gain);

    noiseSource.connect(filter);
    filter.connect(waveGain);
    waveGain.connect(destination);

    noiseSource.start();
    lfo.start();
    this.activeNodes.push(noiseSource, lfo);
  }

  // 3. Kafe Ramai (Warm coffee shop chatter + gentle cup chimes)
  private buildCafe(ctx: AudioContext, destination: GainNode) {
    const noiseBuffer = this.createNoiseBuffer(ctx, 'pink');
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(400, ctx.currentTime);
    bandpass.Q.setValueAtTime(0.8, ctx.currentTime);

    const cafeGain = ctx.createGain();
    cafeGain.gain.setValueAtTime(0.55, ctx.currentTime);

    noiseSource.connect(bandpass);
    bandpass.connect(cafeGain);
    cafeGain.connect(destination);

    noiseSource.start();
    this.activeNodes.push(noiseSource);

    // Occasional gentle cup/ceramic chime (setiap 3-6 detik)
    const chimeInterval = setInterval(() => {
      if (!this.isRunning || ctx.state !== 'running') return;
      try {
        const osc = ctx.createOscillator();
        const chimeGain = ctx.createGain();
        const baseFreq = [1760, 2093, 2637, 3136][Math.floor(Math.random() * 4)];

        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);

        chimeGain.gain.setValueAtTime(0.03, ctx.currentTime);
        chimeGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);

        osc.connect(chimeGain);
        chimeGain.connect(destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.65);
      } catch {}
    }, 3500);

    this.intervals.push(chimeInterval);
  }

  // 4. Hutan Senja (Forest breeze & gentle bird calls)
  private buildForest(ctx: AudioContext, destination: GainNode) {
    const noiseBuffer = this.createNoiseBuffer(ctx, 'pink');
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, ctx.currentTime);

    const breezeGain = ctx.createGain();
    breezeGain.gain.setValueAtTime(0.4, ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(breezeGain);
    breezeGain.connect(destination);

    noiseSource.start();
    this.activeNodes.push(noiseSource);

    // Randomized sweet bird chirps
    const birdInterval = setInterval(() => {
      if (!this.isRunning || ctx.state !== 'running') return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const bGain = ctx.createGain();
        const startFreq = 2400 + Math.random() * 800;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(startFreq + 500, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(startFreq - 200, now + 0.16);

        bGain.gain.setValueAtTime(0.03, now);
        bGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

        osc.connect(bGain);
        bGain.connect(destination);
        osc.start();
        osc.stop(now + 0.2);
      } catch {}
    }, 2400);

    this.intervals.push(birdInterval);
  }

  // 5. Jangkrik Malam (Night Crickets)
  private buildCrickets(ctx: AudioContext, destination: GainNode) {
    // Carrier oscillator
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(4500, ctx.currentTime);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(4900, ctx.currentTime);

    // Fast tremolo (35Hz modulation)
    const tremolo = ctx.createOscillator();
    tremolo.type = 'square';
    tremolo.frequency.setValueAtTime(36, ctx.currentTime);

    const tremoloGain = ctx.createGain();
    tremoloGain.gain.setValueAtTime(0.03, ctx.currentTime);

    const cricketsGain = ctx.createGain();
    cricketsGain.gain.setValueAtTime(0.05, ctx.currentTime);

    tremolo.connect(tremoloGain);
    tremoloGain.connect(cricketsGain.gain);

    osc1.connect(cricketsGain);
    osc2.connect(cricketsGain);
    cricketsGain.connect(destination);

    osc1.start();
    osc2.start();
    tremolo.start();

    this.activeNodes.push(osc1, osc2, tremolo);
  }

  // 6. Api Unggun (Campfire crackles)
  private buildCampfire(ctx: AudioContext, destination: GainNode) {
    const noiseBuffer = this.createNoiseBuffer(ctx, 'brown');
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, ctx.currentTime);

    const baseGain = ctx.createGain();
    baseGain.gain.setValueAtTime(0.35, ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(baseGain);
    baseGain.connect(destination);

    noiseSource.start();
    this.activeNodes.push(noiseSource);

    // Random crackle impulses
    const crackleInterval = setInterval(() => {
      if (!this.isRunning || ctx.state !== 'running') return;
      if (Math.random() > 0.4) {
        try {
          const osc = ctx.createOscillator();
          const cGain = ctx.createGain();
          const freq = 800 + Math.random() * 2000;

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime);

          const vol = 0.04 + Math.random() * 0.06;
          cGain.gain.setValueAtTime(vol, ctx.currentTime);
          cGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);

          osc.connect(cGain);
          cGain.connect(destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.05);
        } catch {}
      }
    }, 120);

    this.intervals.push(crackleInterval);
  }

  public setVolume(volume: number) {
    if (this.masterGain && this.ctx) {
      const clamped = Math.max(0, Math.min(1, volume));
      this.masterGain.gain.linearRampToValueAtTime(clamped, this.ctx.currentTime + 0.05);
    }
  }

  public stop() {
    this.isRunning = false;
    this.intervals.forEach(id => clearInterval(id));
    this.intervals = [];

    this.activeNodes.forEach(node => {
      try {
        if (typeof node.stop === 'function') node.stop();
        if (typeof node.disconnect === 'function') node.disconnect();
      } catch {}
    });
    this.activeNodes = [];

    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {}
      this.masterGain = null;
    }
    this.currentSoundId = null;
  }

  public getActiveSound(): string | null {
    return this.isRunning ? this.currentSoundId : null;
  }

  public getIsPlaying(): boolean {
    return this.isRunning;
  }
}

export const ambientSynthesizer = new AmbientSynthesizer();
