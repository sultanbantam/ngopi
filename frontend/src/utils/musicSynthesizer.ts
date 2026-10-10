/**
 * Web Audio Jukebox Music Synthesizer & Player
 * Plays procedural lo-fi / acoustic tracks directly in the browser,
 * or handles direct audio streaming URLs with zero external server dependencies.
 */

class MusicSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isPlaying = false;
  private activeTimeouts: any[] = [];
  private currentTrackId: string | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private loopInterval: any = null;
  private stepIndex = 0;

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

  // Play an acoustic plucked note or electric piano tone
  private playNote(freq: number, startTime: number, duration: number, type: 'epiano' | 'guitar' = 'epiano', velocity: number = 0.5) {
    if (!this.ctx || !this.masterGain) return;
    const ctx = this.ctx;

    // Carrier
    const osc = ctx.createOscillator();
    const noteGain = ctx.createGain();

    if (type === 'epiano') {
      osc.type = 'sine';
      // Subtle FM modulator for Rhodes tone
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      mod.frequency.setValueAtTime(freq * 2, startTime);
      modGain.gain.setValueAtTime(freq * 0.4, startTime);
      modGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      mod.connect(modGain);
      modGain.connect(osc.frequency);
      mod.start(startTime);
      mod.stop(startTime + duration);
    } else {
      osc.type = 'triangle';
    }

    osc.frequency.setValueAtTime(freq, startTime);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 3, startTime);
    filter.frequency.exponentialRampToValueAtTime(freq * 0.9, startTime + duration);

    // Envelope
    noteGain.gain.setValueAtTime(0.001, startTime);
    noteGain.gain.linearRampToValueAtTime(velocity * 0.22, startTime + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }

  // Soft vinyl crackle
  private startVinylCrackle(ctx: AudioContext, destination: GainNode) {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.015;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    noise.start();
  }

  // Play Lo-Fi Chillhop Song ("Senja di Kedai Kopi")
  private playLofiLoop() {
    const ctx = this.getAudioContext();
    if (!ctx || !this.isPlaying) return;

    this.startVinylCrackle(ctx, this.masterGain!);

    // Chords: Dm9 (D3, F3, A3, C4, E4), G13 (G2, F3, B3, E4), Cmaj9 (C3, E3, G3, B3, D4), A7alt (A2, G3, C#4, F4)
    const chords = [
      [146.83, 174.61, 220.00, 261.63, 329.63], // Dm9
      [98.00,  174.61, 246.94, 329.63],         // G13
      [130.81, 164.81, 196.00, 246.94, 293.66], // Cmaj9
      [110.00, 196.00, 277.18, 349.23],         // A7alt
    ];

    const chordDuration = 2.2; // seconds per chord
    this.stepIndex = 0;

    const playNext = () => {
      if (!this.isPlaying || !this.ctx) return;
      const currentChord = chords[this.stepIndex % chords.length];
      const now = this.ctx.currentTime;

      // Arpeggiate chord notes with slight humanized delay
      currentChord.forEach((freq, idx) => {
        this.playNote(freq, now + idx * 0.06, chordDuration * 0.9, 'epiano', 0.45);
      });

      // Melodic flourish every second chord
      if (this.stepIndex % 2 === 1) {
        const leadFreqs = [440.00, 493.88, 523.25, 587.33];
        const lead = leadFreqs[Math.floor(Math.random() * leadFreqs.length)];
        this.playNote(lead, now + 0.8, 0.7, 'epiano', 0.35);
      }

      this.stepIndex++;
      const timeout = setTimeout(playNext, chordDuration * 1000);
      this.activeTimeouts.push(timeout);
    };

    playNext();
  }

  // Play Acoustic Warkop Song ("Kopi Dangdut" / Upbeat)
  private playAcousticLoop() {
    const ctx = this.getAudioContext();
    if (!ctx || !this.isPlaying) return;

    // Fast acoustic strum: Am -> Dm -> E7 -> Am
    const chords = [
      [220.00, 261.63, 329.63, 440.00], // Am
      [146.83, 220.00, 293.66, 349.23], // Dm
      [164.81, 246.94, 329.63, 392.00], // E7
      [220.00, 261.63, 329.63, 440.00], // Am
    ];

    const beatDuration = 0.55;
    this.stepIndex = 0;

    const playNext = () => {
      if (!this.isPlaying || !this.ctx) return;
      const chordIndex = Math.floor(this.stepIndex / 2) % chords.length;
      const currentChord = chords[chordIndex];
      const now = this.ctx.currentTime;

      // Guitar strum pattern
      currentChord.forEach((freq, i) => {
        this.playNote(freq, now + i * 0.02, 0.45, 'guitar', this.stepIndex % 2 === 0 ? 0.6 : 0.4);
      });

      this.stepIndex++;
      const timeout = setTimeout(playNext, beatDuration * 1000);
      this.activeTimeouts.push(timeout);
    };

    playNext();
  }

  // Play Fingerstyle Nocturne ("Melodi Malam Warung")
  private playNightLoop() {
    const ctx = this.getAudioContext();
    if (!ctx || !this.isPlaying) return;

    // Peaceful fingerpicking pattern
    const pattern = [
      130.81, 196.00, 261.63, 329.63, // C
      123.47, 196.00, 246.94, 293.66, // G/B
      110.00, 164.81, 220.00, 261.63, // Am
      87.31,  174.61, 220.00, 261.63, // F
    ];

    const noteDuration = 0.4;
    this.stepIndex = 0;

    const playNext = () => {
      if (!this.isPlaying || !this.ctx) return;
      const freq = pattern[this.stepIndex % pattern.length];
      const now = this.ctx.currentTime;

      this.playNote(freq, now, 0.75, 'guitar', 0.4);

      this.stepIndex++;
      const timeout = setTimeout(playNext, noteDuration * 1000);
      this.activeTimeouts.push(timeout);
    };

    playNext();
  }

  public play(trackUri: string, title?: string): boolean {
    this.stop();
    this.isPlaying = true;
    this.currentTrackId = trackUri;

    // Check if it's one of the preset synthesizer tracks
    if (trackUri.includes('lofi') || title?.includes('Senja di Kedai Kopi')) {
      const ctx = this.getAudioContext();
      if (!ctx) return false;
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, ctx.currentTime);
      this.masterGain.connect(ctx.destination);
      this.playLofiLoop();
      return true;
    }

    if (trackUri.includes('dangdut') || title?.includes('Kopi Dangdut') || trackUri.includes('coffee-acoustic')) {
      const ctx = this.getAudioContext();
      if (!ctx) return false;
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, ctx.currentTime);
      this.masterGain.connect(ctx.destination);
      this.playAcousticLoop();
      return true;
    }

    if (trackUri.includes('malam') || title?.includes('Melodi Malam Warung') || trackUri.includes('chill-abstract')) {
      const ctx = this.getAudioContext();
      if (!ctx) return false;
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, ctx.currentTime);
      this.masterGain.connect(ctx.destination);
      this.playNightLoop();
      return true;
    }

    // Otherwise, treat as direct audio URL stream
    if (typeof window !== 'undefined') {
      try {
        if (!this.audioEl) {
          this.audioEl = new Audio();
        }
        this.audioEl.src = trackUri;
        this.audioEl.play().catch(err => {
          console.warn('Audio play restricted or failed:', err);
          // Fallback to soothing lofi loop if stream fails
          this.playLofiLoop();
        });
        return true;
      } catch (err) {
        console.error('Failed to play audio URI:', err);
        return false;
      }
    }

    return false;
  }

  public pause() {
    this.stop();
  }

  public stop() {
    this.isPlaying = false;
    this.activeTimeouts.forEach(id => clearTimeout(id));
    this.activeTimeouts = [];

    if (this.loopInterval) {
      clearInterval(this.loopInterval);
      this.loopInterval = null;
    }

    if (this.masterGain) {
      try {
        this.masterGain.disconnect();
      } catch {}
      this.masterGain = null;
    }

    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
      } catch {}
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const musicSynthesizer = new MusicSynthesizer();
