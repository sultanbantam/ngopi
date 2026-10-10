import { Platform } from 'react-native';
import { musicSynthesizer } from './musicSynthesizer';

export interface GlobalTrack {
  id: string;
  title: string;
  artist: string;
  track_uri: string;
  thumbnail?: string | null;
  duration: number;
  added_by?: string;
  is_playing?: boolean;
  is_radio?: boolean;
  is_full?: boolean;
}

export interface GlobalAudioState {
  track: GlobalTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number; // 0 - 100
  currentTime: number; // seconds
  duration: number; // seconds
  volume: number; // 0 - 1
  error: string | null;
}

type AudioListener = (state: GlobalAudioState) => void;

class GlobalAudioPlayer {
  private state: GlobalAudioState = {
    track: null,
    isPlaying: false,
    isLoading: false,
    progress: 0,
    currentTime: 0,
    duration: 0,
    volume: 1,
    error: null,
  };

  private listeners = new Set<AudioListener>();
  private audioEl: HTMLAudioElement | null = null;
  private onEndCallback: (() => void) | null = null;
  private intervalTimer: any = null;

  constructor() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Reuse existing HTMLAudioElement on window across module re-evaluations
      const win = window as any;
      if (win.__ngopiAudioElement) {
        this.audioEl = win.__ngopiAudioElement;
      } else {
        try {
          this.audioEl = new window.Audio();
          win.__ngopiAudioElement = this.audioEl;
        } catch (e) {
          console.warn('[GlobalAudioPlayer] Failed to instantiate Audio:', e);
        }
      }

      if (this.audioEl) {
        this.bindAudioEvents(this.audioEl);
      }
    }
  }

  private bindAudioEvents(audio: HTMLAudioElement) {
    audio.onplay = () => {
      this.state.isPlaying = true;
      this.state.isLoading = false;
      this.notify();
    };

    audio.onpause = () => {
      this.state.isPlaying = false;
      this.notify();
    };

    audio.onwaiting = () => {
      this.state.isLoading = true;
      this.notify();
    };

    audio.oncanplay = () => {
      this.state.isLoading = false;
      this.notify();
    };

    audio.ontimeupdate = () => {
      if (!this.state.isPlaying) return;
      const cur = audio.currentTime || 0;
      const dur = audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) 
        ? audio.duration 
        : (this.state.track?.duration || 0);

      this.state.currentTime = cur;
      this.state.duration = dur;
      if (dur > 0) {
        this.state.progress = Math.min(100, Math.max(0, Math.round((cur / dur) * 100)));
      }
      this.notify();
    };

    audio.onended = () => {
      this.state.isPlaying = false;
      this.state.progress = 100;
      this.notify();
      if (this.onEndCallback) {
        try {
          this.onEndCallback();
        } catch (e) {
          console.warn('[GlobalAudioPlayer] onEnded callback error:', e);
        }
      }
    };

    audio.onerror = (e) => {
      console.warn('[GlobalAudioPlayer] Audio error:', e);
      const track = this.state.track;
      // If error occurred on radio stream, fallback to proxy stream
      if (track && (track.is_radio || track.added_by === 'Radio Warkop' || track.track_uri.includes('stream'))) {
        if (!audio.src.includes('/api/jukebox/radio/stream')) {
          const proxy = `https://api.ngopi.top/api/jukebox/radio/stream?url=${encodeURIComponent(track.track_uri)}`;
          console.log('[GlobalAudioPlayer] Attempting radio stream proxy:', proxy);
          audio.src = proxy;
          audio.load();
          audio.play().catch(err => {
            if (err?.name !== 'AbortError') {
              this.state.error = 'Gagal memutar siaran radio';
              this.state.isPlaying = false;
              this.notify();
            }
          });
          return;
        }
      }
      this.state.isLoading = false;
      this.state.error = 'Gagal memutar audio';
      this.notify();
    };
  }

  public getState(): GlobalAudioState {
    return { ...this.state };
  }

  public subscribe(listener: AudioListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach(fn => {
      try {
        fn(s);
      } catch (err) {
        console.error('[GlobalAudioPlayer] Listener error:', err);
      }
    });
  }

  public setOnEndCallback(cb: (() => void) | null) {
    this.onEndCallback = cb;
  }

  public async play(track: GlobalTrack): Promise<void> {
    if (!track || !track.track_uri) return;

    // Check if it's a synthesizer track (synth:lofi or synth:malam)
    if (track.track_uri.startsWith('synth:')) {
      if (this.audioEl) {
        try { this.audioEl.pause(); } catch {}
      }
      musicSynthesizer.play(track.track_uri, track.title);
      this.state.track = { ...track };
      this.state.isPlaying = true;
      this.state.isLoading = false;
      this.state.error = null;
      this.state.currentTime = 0;
      this.state.duration = track.duration || 180;
      this.notify();
      this.startSynthInterval();
      return;
    }

    // Stop synth if playing
    musicSynthesizer.pause();
    this.clearSynthInterval();

    const isRadio = track.is_radio || track.added_by === 'Radio Warkop' || track.id?.startsWith('radio-');
    this.state.track = { ...track, is_radio: isRadio };
    this.state.isLoading = true;
    this.state.error = null;
    this.state.currentTime = 0;
    this.state.duration = isRadio ? 0 : (track.duration || 0);
    this.state.progress = isRadio ? 100 : 0;
    this.notify();

    if (Platform.OS === 'web' && this.audioEl) {
      try {
        const audio = this.audioEl;
        // If already playing this source, don't restart
        if (audio.src === track.track_uri && !audio.paused) {
          this.state.isPlaying = true;
          this.state.isLoading = false;
          this.notify();
          return;
        }

        audio.src = track.track_uri;
        audio.load();
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.state.isPlaying = true;
              this.state.isLoading = false;
              this.notify();
            })
            .catch((err: any) => {
              if (err?.name === 'AbortError') return;
              console.warn('[GlobalAudioPlayer] Direct play error:', err);
              if (isRadio) {
                const proxy = `https://api.ngopi.top/api/jukebox/radio/stream?url=${encodeURIComponent(track.track_uri)}`;
                audio.src = proxy;
                audio.load();
                audio.play().catch(pErr => {
                  if (pErr?.name !== 'AbortError') {
                    this.state.error = 'Siaran sedang offline atau diblokir browser.';
                    this.state.isPlaying = false;
                    this.notify();
                  }
                });
              } else {
                this.state.error = 'Pemutaran audio diblokir browser atau format tidak didukung.';
                this.state.isPlaying = false;
                this.notify();
              }
            });
        }
      } catch (e: any) {
        console.warn('[GlobalAudioPlayer] Exception starting playback:', e);
        this.state.error = e?.message || 'Error audio';
        this.notify();
      }
    } else {
      // Non-web or synth fallback
      this.state.isPlaying = true;
      this.state.isLoading = false;
      this.notify();
    }
  }

  public pause() {
    this.state.isPlaying = false;
    if (this.audioEl) {
      try { this.audioEl.pause(); } catch {}
    }
    musicSynthesizer.pause();
    this.clearSynthInterval();
    this.notify();
  }

  public resume() {
    if (!this.state.track) return;
    if (this.state.track.track_uri.startsWith('synth:')) {
      musicSynthesizer.play(this.state.track.track_uri, this.state.track.title);
      this.state.isPlaying = true;
      this.notify();
      this.startSynthInterval();
      return;
    }

    if (this.audioEl) {
      this.audioEl.play().catch(e => {
        console.warn('[GlobalAudioPlayer] Resume failed:', e);
      });
    }
    this.state.isPlaying = true;
    this.notify();
  }

  public togglePlay() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.resume();
    }
  }

  public seek(pct: number) {
    if (this.audioEl && this.audioEl.duration && !isNaN(this.audioEl.duration)) {
      const targetTime = (pct / 100) * this.audioEl.duration;
      this.audioEl.currentTime = targetTime;
      this.state.currentTime = targetTime;
      this.state.progress = pct;
      this.notify();
    }
  }

  public setVolume(vol: number) {
    const v = Math.max(0, Math.min(1, vol));
    this.state.volume = v;
    if (this.audioEl) {
      this.audioEl.volume = v;
    }
    this.notify();
  }

  public stop() {
    this.pause();
    this.state.track = null;
    this.state.progress = 0;
    this.state.currentTime = 0;
    this.notify();
  }

  private startSynthInterval() {
    this.clearSynthInterval();
    this.intervalTimer = setInterval(() => {
      if (!this.state.isPlaying) return;
      this.state.currentTime += 1;
      const dur = this.state.track?.duration || 180;
      this.state.progress = Math.min(100, Math.round((this.state.currentTime / dur) * 100));
      this.notify();
      if (this.state.currentTime >= dur && this.onEndCallback) {
        this.onEndCallback();
      }
    }, 1000);
  }

  private clearSynthInterval() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }
}

// Global window reference for singleton persistence across Hot Module Reloads
const win = typeof window !== 'undefined' ? (window as any) : {};
export const globalAudioPlayer: GlobalAudioPlayer = win.__ngopiGlobalAudioPlayer || new GlobalAudioPlayer();
if (typeof window !== 'undefined') {
  win.__ngopiGlobalAudioPlayer = globalAudioPlayer;
}
