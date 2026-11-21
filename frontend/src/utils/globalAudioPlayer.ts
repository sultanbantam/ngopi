import { Platform } from 'react-native';
import axios from 'axios';
import { createAudioPlayer, AudioPlayer, setAudioModeAsync } from 'expo-audio';
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
  private nativePlayer: AudioPlayer | null = null;
  private statusSubscription: { remove: () => void } | null = null;
  private onEndCallback: (() => void) | null = null;
  private queue: GlobalTrack[] = [];
  private queueIndex: number = -1;
  private intervalTimer: any = null;
  private resolvedUrlCache: Map<string, string> = new Map();

  private fullTrackMap: Record<string, string> = {
    // Album 1 (Bandung, dan Para Mantanku)
    'trk_dt_spirit': 'https://api.ngopi.top/uploads/mixtape_songs/trk_dt_spirit.mp3',
    'trk_u2_one': 'https://api.ngopi.top/uploads/mixtape_songs/trk_u2_one.mp3',
    'trk_manowar_heart_of_steel': 'https://api.ngopi.top/uploads/mixtape_songs/trk_manowar_heart_of_steel.mp3',
    'trk_pearljam_alive': 'https://api.ngopi.top/uploads/mixtape_songs/trk_pearljam_alive.mp3',
    'trk_nirvana_smells': 'https://api.ngopi.top/uploads/mixtape_songs/trk_nirvana_smells.mp3',
    'trk_kantata_nyanyian_jiwa': 'https://api.ngopi.top/uploads/mixtape_songs/trk_kantata_nyanyian_jiwa.mp3',
    'trk_pasband_kesepian_kita': 'https://api.ngopi.top/uploads/mixtape_songs/trk_pasband_kesepian_kita.mp3',
    'trk_gnr_november_rain': 'https://api.ngopi.top/uploads/mixtape_songs/trk_gnr_november_rain.mp3',
    'trk_met_the_unforgiven': 'https://api.ngopi.top/uploads/mixtape_songs/trk_met_the_unforgiven.mp3',
    'trk_dewa_elang': 'https://api.ngopi.top/uploads/mixtape_songs/trk_dewa_elang.mp3',
    // Album 2 (2. Bandung, dan Para Mantanku)
    'trk_iwan_ibu': 'https://api.ngopi.top/uploads/mixtape_songs/trk_iwan_ibu.mp3',
    'trk_once_dealova': 'https://api.ngopi.top/uploads/mixtape_songs/trk_once_dealova.mp3',
    'trk_so7_dan': 'https://api.ngopi.top/uploads/mixtape_songs/trk_so7_dan.mp3',
    'trk_slank_terlalu_manis': 'https://api.ngopi.top/uploads/mixtape_songs/trk_slank_terlalu_manis.mp3',
    'trk_padi_mahadewi': 'https://api.ngopi.top/uploads/mixtape_songs/trk_padi_mahadewi.mp3',
    'trk_jamrud_pelangi': 'https://api.ngopi.top/uploads/mixtape_songs/trk_jamrud_pelangi.mp3',
    'trk_nike_bintang_kehidupan': 'https://api.ngopi.top/uploads/mixtape_songs/trk_nike_bintang_kehidupan.mp3',
    'trk_boomerang_pelangi': 'https://api.ngopi.top/uploads/mixtape_songs/trk_boomerang_pelangi.mp3',
    'trk_puresaturday_kosong': 'https://api.ngopi.top/uploads/mixtape_songs/trk_puresaturday_kosong.mp3',
    'trk_kantata_kesaksian': 'https://api.ngopi.top/uploads/mixtape_songs/trk_kantata_kesaksian.mp3',
    // Album 3 (3. Bandung, dan Para Mantanku)
    'trk_queen_love_of_my_life': 'https://api.ngopi.top/uploads/mixtape_songs/trk_queen_love_of_my_life.mp3',
    'trk_gnr_sweet_child': 'https://api.ngopi.top/uploads/mixtape_songs/trk_gnr_sweet_child.mp3',
    'trk_gnr_dont_cry': 'https://api.ngopi.top/uploads/mixtape_songs/trk_gnr_dont_cry.mp3',
    'trk_met_nothing_else': 'https://api.ngopi.top/uploads/mixtape_songs/trk_met_nothing_else.mp3',
    'trk_met_enter_sandman': 'https://api.ngopi.top/uploads/mixtape_songs/trk_met_enter_sandman.mp3',
    'trk_bonjovi_always': 'https://api.ngopi.top/uploads/mixtape_songs/trk_bonjovi_always.mp3',
    'trk_scorpions_wind': 'https://api.ngopi.top/uploads/mixtape_songs/trk_scorpions_wind.mp3',
    'trk_scorpions_still_loving': 'https://api.ngopi.top/uploads/mixtape_songs/trk_scorpions_still_loving.mp3',
    'trk_cranberries_zombie': 'https://api.ngopi.top/uploads/mixtape_songs/trk_cranberries_zombie.mp3',
  };

  public resolvePlayableUri(track: GlobalTrack): string {
    if (!track) return '';
    // 1. If track.track_uri is already on api.ngopi.top, return it directly!
    if (track.track_uri && track.track_uri.includes('api.ngopi.top/uploads/mixtape_songs/')) {
      return track.track_uri;
    }
    // 2. Check direct ID mapping in fullTrackMap
    if (track.id) {
      for (const [idKey, hostedUrl] of Object.entries(this.fullTrackMap)) {
        if (track.id.includes(idKey)) {
          return hostedUrl;
        }
      }
    }
    // 3. Fallback matching by cleaned title or artist
    const cleanTitle = (track.title || '').replace(/\[.*?\]|\(.*?\)/g, '').trim().toLowerCase();
    for (const [idKey, hostedUrl] of Object.entries(this.fullTrackMap)) {
      const namePart = idKey.replace(/^trk_/, '').replace(/_/g, ' ');
      if (cleanTitle.includes(namePart) || (track.artist && idKey.includes(track.artist.toLowerCase().split(' ')[0]))) {
        if (cleanTitle.includes('spirit') && idKey === 'trk_dt_spirit') return hostedUrl;
        if (cleanTitle.includes('one') && idKey === 'trk_u2_one') return hostedUrl;
        if (cleanTitle.includes('heart of steel') && idKey === 'trk_manowar_heart_of_steel') return hostedUrl;
        if (cleanTitle.includes('alive') && idKey === 'trk_pearljam_alive') return hostedUrl;
        if (cleanTitle.includes('smells') && idKey === 'trk_nirvana_smells') return hostedUrl;
        if (cleanTitle.includes('nyanyian jiwa') && idKey === 'trk_kantata_nyanyian_jiwa') return hostedUrl;
        if (cleanTitle.includes('kesepian') && idKey === 'trk_pasband_kesepian_kita') return hostedUrl;
        if (cleanTitle.includes('november') && idKey === 'trk_gnr_november_rain') return hostedUrl;
        if (cleanTitle.includes('unforgiven') && idKey === 'trk_met_the_unforgiven') return hostedUrl;
        if (cleanTitle.includes('elang') && idKey === 'trk_dewa_elang') return hostedUrl;
        if (cleanTitle.includes('ibu') && idKey === 'trk_iwan_ibu') return hostedUrl;
        if (cleanTitle.includes('dealova') && idKey === 'trk_once_dealova') return hostedUrl;
        if (cleanTitle.includes('dan') && idKey === 'trk_so7_dan') return hostedUrl;
        if (cleanTitle.includes('manis') && idKey === 'trk_slank_terlalu_manis') return hostedUrl;
        if (cleanTitle.includes('mahadewi') && idKey === 'trk_padi_mahadewi') return hostedUrl;
        if (cleanTitle.includes('matamu') && idKey === 'trk_jamrud_pelangi') return hostedUrl;
        if (cleanTitle.includes('bintang kehidupan') && idKey === 'trk_nike_bintang_kehidupan') return hostedUrl;
        if (cleanTitle.includes('pelangi') && idKey === 'trk_boomerang_pelangi') return hostedUrl;
        if (cleanTitle.includes('kosong') && idKey === 'trk_puresaturday_kosong') return hostedUrl;
        if (cleanTitle.includes('kesaksian') && idKey === 'trk_kantata_kesaksian') return hostedUrl;
        // Album 3 title matches
        if (cleanTitle.includes('love of my life') && idKey === 'trk_queen_love_of_my_life') return hostedUrl;
        if (cleanTitle.includes('sweet child') && idKey === 'trk_gnr_sweet_child') return hostedUrl;
        if ((cleanTitle.includes('dont cry') || cleanTitle.includes("don't cry")) && idKey === 'trk_gnr_dont_cry') return hostedUrl;
        if (cleanTitle.includes('nothing else') && idKey === 'trk_met_nothing_else') return hostedUrl;
        if (cleanTitle.includes('sandman') && idKey === 'trk_met_enter_sandman') return hostedUrl;
        if (cleanTitle.includes('always') && idKey === 'trk_bonjovi_always') return hostedUrl;
        if (cleanTitle.includes('wind') && idKey === 'trk_scorpions_wind') return hostedUrl;
        if (cleanTitle.includes('still loving') && idKey === 'trk_scorpions_still_loving') return hostedUrl;
        if (cleanTitle.includes('zombie') && idKey === 'trk_cranberries_zombie') return hostedUrl;
      }
    }
    // 4. If external archive.org link, proxy it through server to avoid 503/403/CORS issues
    if (track.track_uri && track.track_uri.includes('archive.org') && !track.track_uri.includes('api.ngopi.top')) {
      return `https://api.ngopi.top/api/albums/stream?url=${encodeURIComponent(track.track_uri)}&trackId=${track.id || ''}`;
    }
    return track.track_uri;
  }

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
    } else if (Platform.OS !== 'web') {
      try {
        setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: true,
        }).catch((err) => {
          console.warn('[GlobalAudioPlayer] setAudioModeAsync error:', err);
        });
      } catch {}
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
      this.handleTrackEnded();
    };

    audio.onerror = async (e) => {
      console.warn('[GlobalAudioPlayer] Audio error on source:', audio.src, e);
      const track = this.state.track;
      if (!track) return;

      // 1. Radio fallback
      if (track.is_radio || track.added_by === 'Radio Warkop' || track.track_uri.includes('stream')) {
        if (!audio.src.includes('/api/jukebox/radio/stream')) {
          const proxy = `https://api.ngopi.top/api/jukebox/radio/stream?url=${encodeURIComponent(track.track_uri)}`;
          console.log('[GlobalAudioPlayer] Attempting radio stream proxy:', proxy);
          audio.src = proxy;
          audio.load();
          audio.play().catch(err => {
            if (err?.name !== 'AbortError') {
              this.state.error = 'Siaran sedang offline atau diblokir browser.';
              this.state.isPlaying = false;
              this.notify();
            }
          });
          return;
        }
      }

      // 2. Song fallback: resolve to full hosted track or stream proxy
      try {
        const fallbackUri = this.resolvePlayableUri(track);
        if (fallbackUri && fallbackUri !== audio.src) {
          console.log('[GlobalAudioPlayer] Switching to full hosted audio source:', fallbackUri);
          track.track_uri = fallbackUri;
          audio.src = fallbackUri;
          audio.load();
          await audio.play();
          this.state.isPlaying = true;
          this.state.isLoading = false;
          this.state.error = null;
          this.notify();
          return;
        } else if (!audio.src.includes('/api/albums/stream') && !audio.src.includes('/uploads/mixtape_songs/')) {
          const proxyUri = `https://api.ngopi.top/api/albums/stream?url=${encodeURIComponent(track.track_uri)}&trackId=${track.id || ''}`;
          console.log('[GlobalAudioPlayer] Switching to album stream proxy:', proxyUri);
          audio.src = proxyUri;
          audio.load();
          await audio.play();
          this.state.isPlaying = true;
          this.state.isLoading = false;
          this.state.error = null;
          this.notify();
          return;
        }
      } catch (resErr) {
        console.warn('[GlobalAudioPlayer] Fallback play error:', resErr);
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

  private handleTrackEnded() {
    this.state.isPlaying = false;
    this.state.progress = 100;
    this.notify();

    if (this.queue.length > 0 && this.queueIndex + 1 < this.queue.length) {
      const nextIdx = this.queueIndex + 1;
      const nextTrack = this.queue[nextIdx];
      if (nextTrack) {
        this.queueIndex = nextIdx;
        this.playInternal(nextTrack).catch(() => {});
        return;
      }
    }

    if (this.onEndCallback) {
      try {
        this.onEndCallback();
      } catch (e) {
        console.warn('[GlobalAudioPlayer] onEnded callback error:', e);
      }
    }
  }

  public setOnEndCallback(cb: (() => void) | null) {
    this.onEndCallback = cb;
  }

  public async playQueue(tracks: GlobalTrack[], startIndex = 0): Promise<void> {
    if (!Array.isArray(tracks) || tracks.length === 0) return;
    const safeIdx = Math.max(0, Math.min(startIndex, tracks.length - 1));
    this.queue = tracks.slice();
    this.queueIndex = safeIdx;
    const target = this.queue[safeIdx];
    if (target) {
      await this.playInternal(target);
    }
  }

  public async play(track: GlobalTrack): Promise<void> {
    this.queue = [];
    this.queueIndex = -1;
    await this.playInternal(track);
  }

  private async playInternal(track: GlobalTrack): Promise<void> {
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

    // Report playback to Warkop leaderboard statistics asynchronously
    try {
      if (isRadio) {
        const rawStationId = track.id?.replace(/^radio-/, '') || 'radio-live';
        axios
          .post('https://api.ngopi.top/api/leaderboard/radio/select', {
            stationId: rawStationId,
            name: track.title,
            genre: track.artist || 'Radio Warkop',
            icon: '📻',
            frequency: 'Live Stream',
          })
          .catch(() => {});
      } else if (track.title && track.artist) {
        axios
          .post('https://api.ngopi.top/api/leaderboard/music/played', {
            title: track.title,
            artist: track.artist,
            thumbnail: track.thumbnail || null,
          })
          .catch(() => {});
      }
    } catch {}

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

        const initialUri = this.resolvePlayableUri(track);
        audio.src = initialUri;
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
    } else if (Platform.OS !== 'web') {
      // Native audio engine via expo-audio
      try {
        if (this.nativePlayer) {
          try {
            this.statusSubscription?.remove();
            this.nativePlayer.pause();
            this.nativePlayer.remove();
          } catch {}
          this.nativePlayer = null;
          this.statusSubscription = null;
        }

        const initialUri = this.resolvePlayableUri(track);
        console.log('[GlobalAudioPlayer] Native playing URI:', initialUri);

        const player = createAudioPlayer({ uri: initialUri });
        player.volume = this.state.volume;

        this.statusSubscription = player.addListener('playbackStatusUpdate', (status) => {
          this.state.isPlaying = status.playing;
          this.state.isLoading = status.isBuffering;

          const cur = status.currentTime || 0;
          const dur = status.duration && status.duration > 0
            ? status.duration
            : (this.state.track?.duration || 0);

          this.state.currentTime = cur;
          this.state.duration = dur;
          if (dur > 0) {
            this.state.progress = Math.min(100, Math.max(0, Math.round((cur / dur) * 100)));
          }
          this.notify();

          if (dur > 0 && cur >= dur - 0.5) {
            this.handleTrackEnded();
          }
        });

        player.play();
        this.nativePlayer = player;
        this.state.isPlaying = true;
        this.state.isLoading = false;
        this.state.error = null;
        this.notify();
      } catch (err: any) {
        console.warn('[GlobalAudioPlayer] Native play error on source:', err);
        this.state.isPlaying = false;
        this.state.isLoading = false;
        this.state.error = 'Gagal memutar audio di perangkat';
        this.notify();
      }
    }
  }

  public pause() {
    this.state.isPlaying = false;
    if (this.audioEl) {
      try { this.audioEl.pause(); } catch {}
    }
    if (this.nativePlayer) {
      try { this.nativePlayer.pause(); } catch {}
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
    if (this.nativePlayer) {
      try {
        this.nativePlayer.play();
      } catch (e) {
        console.warn('[GlobalAudioPlayer] Native resume failed:', e);
      }
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
    if (this.nativePlayer) {
      const dur = this.state.duration || (this.state.track?.duration || 0);
      if (dur > 0) {
        const targetSeconds = (pct / 100) * dur;
        this.nativePlayer.seekTo(targetSeconds).catch(() => {});
        this.state.currentTime = targetSeconds;
        this.state.progress = pct;
        this.notify();
      }
    }
  }

  public setVolume(vol: number) {
    const v = Math.max(0, Math.min(1, vol));
    this.state.volume = v;
    if (this.audioEl) {
      this.audioEl.volume = v;
    }
    if (this.nativePlayer) {
      try { this.nativePlayer.volume = v; } catch {}
    }
    this.notify();
  }

  public stop() {
    this.pause();
    if (this.nativePlayer) {
      try {
        this.statusSubscription?.remove();
        this.nativePlayer.pause();
        this.nativePlayer.remove();
      } catch {}
      this.nativePlayer = null;
      this.statusSubscription = null;
    }
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
