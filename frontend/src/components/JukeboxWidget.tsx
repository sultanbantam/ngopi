import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView, Platform, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { coffee } from '../theme/coffee';
import { socketService } from '../utils/socket';
import axios from 'axios';
import * as SecureStore from '../utils/storage';
import { RADIO_STATIONS, RadioStation } from '../data/radioStations';
import { musicSynthesizer } from '../utils/musicSynthesizer';

interface Track {
  id: string;
  title: string;
  artist: string;
  track_uri: string;
  thumbnail?: string | null;
  duration: number;
  added_by: string;
  is_playing: boolean;
}

interface JukeboxWidgetProps {
  warungId: string;
}

export interface CatalogSong {
  title: string;
  artist: string;
  genre: string;
  uri: string;
  duration: number;
  thumbnail?: string | null;
}

export const SONG_CATALOG: CatalogSong[] = [
  {
    title: 'Kopi Dangdut',
    artist: 'Fahmi Shahab (Vokal Original)',
    genre: 'Dangdut Klasik',
    uri: 'https://archive.org/download/KopiDangdut/KopiDangdutFahmiSahab.mp3',
    duration: 238,
  },
  {
    title: 'Begadang',
    artist: 'Rhoma Irama (Vokal Original)',
    genre: 'Dangdut Warkop',
    uri: 'https://archive.org/download/rhoma-irama-begadang/Rhoma%20Irama%20-%20Begadang.mp3',
    duration: 187,
  },
  {
    title: 'Bento',
    artist: 'Iwan Fals (Vokal Original)',
    genre: 'Rock Akustik',
    uri: 'https://archive.org/download/BentoIwanFals_201903/Bento%20-%20Iwan%20Fals.mp3',
    duration: 355,
  },
  {
    title: 'Akad',
    artist: 'Payung Teduh (Vokal Original)',
    genre: 'Indie Folk',
    uri: 'https://archive.org/download/01PayungTeduhAkad/01%20Payung%20Teduh%20Akad.mp3',
    duration: 259,
  },
  {
    title: 'Seberapa Pantas',
    artist: 'Sheila on 7 (Vokal Original)',
    genre: 'Pop 90s/2000s',
    uri: 'https://archive.org/download/sheilaon7seberapapantaslirik/Sheila%20ON7%20-%20Seberapa%20Pantas%20%28lirik%29.mp3',
    duration: 240,
  },
  {
    title: 'Sahabat Sejati',
    artist: 'Sheila on 7 (Vokal Original)',
    genre: 'Pop Akustik',
    uri: 'https://archive.org/download/SheilaOn7FullAlbumAnugerahTerindahDariSheilaOn7/Sahabat%20Sejati%20%28Lana%20Nitibaskara%29.mp3',
    duration: 217,
  },
  {
    title: 'Kemesraan',
    artist: 'Iwan Fals & Friends (Vokal Original)',
    genre: 'Folk Ballad',
    uri: 'https://archive.org/download/kemesraan-iwan-fals/kemesraan%20-%20iwan%20fals.mp3',
    duration: 313,
  },
  {
    title: 'Sephia',
    artist: 'Sheila on 7 (Vokal Original)',
    genre: 'Pop Ballad',
    uri: 'https://archive.org/download/SheilaOn7FullAlbumAnugerahTerindahDariSheilaOn7/Sephia.mp3',
    duration: 295,
  },
  {
    title: 'Yang Terlewatkan',
    artist: 'Sheila on 7 (Vokal Original)',
    genre: 'Slow Pop',
    uri: 'https://archive.org/download/SheilaOn7FullAlbumAnugerahTerindahDariSheilaOn7/Yang%20Terlewatkan%20%28Album%20Version%29.mp3',
    duration: 246,
  },
  {
    title: 'Kopi Lambada',
    artist: 'Denada (Vokal Original)',
    genre: 'Dangdut Modern',
    uri: 'https://archive.org/download/KopiDangdut/Denada-KopiLambada.mp3',
    duration: 326,
  },
  {
    title: 'Kopi Dangdut (Duet)',
    artist: 'Uut Permatasari & Liza Natalia',
    genre: 'Dangdut Duet',
    uri: 'https://archive.org/download/KopiDangdut/UutPermatasariLizaNatalia-KopiDangdutduetMaut.mp3',
    duration: 221,
  },
  {
    title: 'Senja di Kedai Kopi',
    artist: 'Warkop Indie',
    genre: 'Lo-Fi Chill',
    uri: 'synth:lofi',
    duration: 160,
  },
  {
    title: 'Melodi Malam Warung',
    artist: 'Ngopi Collective',
    genre: 'Fingerstyle Gitar',
    uri: 'synth:malam',
    duration: 210,
  },
];

const PRESET_SONGS = SONG_CATALOG;

export const JukeboxWidget: React.FC<JukeboxWidgetProps> = ({ warungId }) => {
  const [playingTrack, setPlayingTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [votes, setVotes] = useState({ skips: 0, likes: 0, userVoted: null as string | null });
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 - 100
  const [modalVisible, setModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addModalTab, setAddModalTab] = useState<'catalog' | 'global' | 'radio'>('catalog');
  const [searchSongQuery, setSearchSongQuery] = useState('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalResults, setGlobalResults] = useState<CatalogSong[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [globalSearchError, setGlobalSearchError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newUri, setNewUri] = useState('');

  const filteredCatalog = React.useMemo(() => {
    if (!searchSongQuery.trim()) return SONG_CATALOG;
    const q = searchSongQuery.toLowerCase().trim();
    return SONG_CATALOG.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q) ||
      s.genre.toLowerCase().includes(q)
    );
  }, [searchSongQuery]);

  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleSearchGlobal = async (term?: string) => {
    const q = (term !== undefined ? term : globalSearchQuery).trim();
    if (!q) {
      setGlobalResults([]);
      return;
    }
    setIsSearchingGlobal(true);
    setGlobalSearchError('');
    try {
      // 1. Try our backend proxy first to avoid any client CORS issues
      try {
        const proxyRes = await axios.get('https://api.ngopi.top/api/jukebox/search', {
          params: { term: q },
          timeout: 8000,
        });
        if (proxyRes.data?.results && Array.isArray(proxyRes.data.results) && proxyRes.data.results.length > 0) {
          setGlobalResults(proxyRes.data.results);
          setIsSearchingGlobal(false);
          return;
        }
      } catch (proxyErr) {
        console.warn('Backend music proxy attempt error, falling back:', proxyErr);
      }

      // 2. Direct iTunes API fallback
      const res = await axios.get('https://itunes.apple.com/search', {
        params: {
          term: q,
          entity: 'song',
          limit: 30,
        },
        timeout: 10000,
      });
      if (res.data?.results && Array.isArray(res.data.results)) {
        const mapped: CatalogSong[] = res.data.results
          .filter((item: any) => Boolean(item.previewUrl))
          .map((item: any) => ({
            title: item.trackName || 'Lagu',
            artist: item.artistName || 'Artis',
            genre: item.primaryGenreName || 'Pop',
            uri: item.previewUrl,
            duration: Math.round((item.trackTimeMillis || 180000) / 1000),
            thumbnail: item.artworkUrl100 || item.artworkUrl60 || null,
          }));
        setGlobalResults(mapped);
      } else {
        setGlobalResults([]);
      }
    } catch (e: any) {
      console.warn('Global music search error:', e?.message);
      setGlobalSearchError('Pencarian gagal atau koneksi terputus. Silakan coba lagi.');
    } finally {
      setIsSearchingGlobal(false);
    }
  };

  const playRadioStation = (station: RadioStation) => {
    const streamUri = station.streamUrl;
    const radioTrack: Track = {
      id: `radio-${station.id}`,
      title: station.name,
      artist: `${station.genre} • ${station.location}`,
      track_uri: streamUri,
      thumbnail: null,
      duration: 0,
      added_by: 'Radio Warkop',
      is_playing: true,
    };
    setPlayingTrack(radioTrack);
    setProgress(100);
    setIsPlaying(true);
    startPlayingTrack(radioTrack);
    setAddModalVisible(false);
  };

  const loadNowPlaying = async () => {
    try {
      const token = (await SecureStore.getItemAsync('token')) || (Platform.OS === 'web' ? localStorage.getItem('token') : '');
      const res = await axios.get(`https://api.ngopi.top/api/jukebox/${warungId}/now-playing`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.playing) {
        setPlayingTrack(res.data.playing);
        setQueue(res.data.queue || []);
        if (res.data.votes) setVotes(res.data.votes);
      }
    } catch {}
  };

  useEffect(() => {
    loadNowPlaying();

    const socket = typeof socketService?.getSocket === 'function' ? socketService.getSocket() : socketService?.socket;
    if (socket) {
      const handleTrackChanged = (track: Track) => {
        setPlayingTrack(track);
        loadNowPlaying();
      };
      const handleSync = (data: any) => {
        if (data.position && playingTrack?.duration) {
          setProgress(Math.min(100, Math.round((data.position / playingTrack.duration) * 100)));
        }
      };

      socket.on('jukebox:track_changed', handleTrackChanged);
      socket.on('jukebox:sync', handleSync);

      return () => {
        socket.off('jukebox:track_changed', handleTrackChanged);
        socket.off('jukebox:sync', handleSync);
      };
    }
  }, [warungId]);

  const htmlAudioRef = useRef<any>(null);

  const startPlayingTrack = useCallback((track: Track) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (track.track_uri.startsWith('http')) {
        musicSynthesizer.pause();
        try {
          if (!htmlAudioRef.current) {
            htmlAudioRef.current = new window.Audio();
          }
          const audio = htmlAudioRef.current;
          audio.src = track.track_uri;
          audio.load();
          audio.play().catch((err: any) => {
            console.warn('Playback direct error, trying proxy if radio:', err);
            if (track.added_by === 'Radio Warkop') {
              const proxyUri = `https://api.ngopi.top/api/jukebox/radio/stream?url=${encodeURIComponent(track.track_uri)}`;
              audio.src = proxyUri;
              audio.load();
              audio.play().catch((pErr: any) => console.warn('Radio proxy also failed', pErr));
            } else {
              musicSynthesizer.play('synth:lofi', track.title);
            }
          });
          audio.onended = () => {
            if (track.added_by !== 'Radio Warkop') {
              handleVote('skip');
            }
          };
          return;
        } catch {
          if (track.added_by !== 'Radio Warkop') {
            musicSynthesizer.play('synth:lofi', track.title);
          }
          return;
        }
      }
    }
    if (htmlAudioRef.current) {
      try { htmlAudioRef.current.pause(); } catch {}
    }
    musicSynthesizer.play(track.track_uri, track.title);
  }, []);

  const stopPlayingTrack = useCallback(() => {
    if (htmlAudioRef.current) {
      try { htmlAudioRef.current.pause(); } catch {}
    }
    musicSynthesizer.pause();
  }, []);

  // Audio playback lifecycle
  useEffect(() => {
    if (playingTrack && isPlaying) {
      startPlayingTrack(playingTrack);
    } else {
      stopPlayingTrack();
    }
  }, [playingTrack, isPlaying, startPlayingTrack, stopPlayingTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (htmlAudioRef.current) {
        try { htmlAudioRef.current.pause(); } catch {}
      }
      musicSynthesizer.pause();
    };
  }, []);

  // Progress update for real audio & synth
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (htmlAudioRef.current && !htmlAudioRef.current.paused && htmlAudioRef.current.duration) {
        const pct = Math.floor((htmlAudioRef.current.currentTime / htmlAudioRef.current.duration) * 100);
        setProgress(Math.min(100, Math.max(0, pct)));
        return;
      }
      setProgress(p => {
        if (p >= 100) {
          handleVote('skip');
          return 0;
        }
        return p + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const togglePlay = () => {
    if (!playingTrack) {
      const firstSong = PRESET_SONGS[0];
      const newTrack: Track = {
        id: `local-${Date.now()}`,
        title: firstSong.title,
        artist: firstSong.artist,
        track_uri: firstSong.uri,
        duration: firstSong.duration,
        added_by: 'Warkop',
        is_playing: true,
      };
      setPlayingTrack(newTrack);
      setIsPlaying(true);
      startPlayingTrack(newTrack);
      return;
    }

    if (isPlaying) {
      stopPlayingTrack();
      setIsPlaying(false);
    } else {
      startPlayingTrack(playingTrack);
      setIsPlaying(true);
    }
  };

  const handleVote = async (type: 'skip' | 'like') => {
    if (!playingTrack) return;

    if (type === 'skip') {
      if (queue.length > 0) {
        const next = queue[0];
        setQueue(prev => prev.slice(1));
        setPlayingTrack(next);
        setProgress(0);
        setIsPlaying(true);
        startPlayingTrack(next);
      } else {
        const currentIdx = PRESET_SONGS.findIndex(s => s.title === playingTrack.title);
        const nextSong = PRESET_SONGS[(currentIdx + 1) % PRESET_SONGS.length];
        const nextTrack: Track = {
          id: `local-${Date.now()}`,
          title: nextSong.title,
          artist: nextSong.artist,
          track_uri: nextSong.uri,
          duration: nextSong.duration,
          added_by: 'Warkop',
          is_playing: true,
        };
        setPlayingTrack(nextTrack);
        setProgress(0);
        setIsPlaying(true);
        startPlayingTrack(nextTrack);
      }
    } else {
      setVotes(prev => ({
        ...prev,
        likes: prev.likes + 1,
        userVoted: 'like'
      }));
    }

    try {
      const token = (await SecureStore.getItemAsync('token')) || (Platform.OS === 'web' ? localStorage.getItem('token') : '');
      await axios.post(`https://api.ngopi.top/api/jukebox/${warungId}/vote`, {
        track_id: playingTrack.id,
        vote_type: type
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch {}
  };

  const handleAddTrack = async (trackData?: { title: string; artist: string; uri: string; duration: number }, playNow: boolean = false) => {
    const title = trackData?.title || newTitle;
    const artist = trackData?.artist || newArtist;
    const uri = trackData?.uri || newUri;
    const duration = trackData?.duration || 180;

    if (!title || !artist || !uri) return;

    const newTrack: Track = {
      id: `track-${Date.now()}`,
      title,
      artist,
      track_uri: uri,
      duration,
      added_by: 'Kamu',
      is_playing: playNow || !playingTrack,
    };

    if (playNow || !playingTrack) {
      setPlayingTrack(newTrack);
      setProgress(0);
      setIsPlaying(true);
      startPlayingTrack(newTrack);
    } else {
      setQueue(prev => [...prev, newTrack]);
    }

    setAddModalVisible(false);
    setSearchSongQuery('');
    setNewTitle('');
    setNewArtist('');
    setNewUri('');

    try {
      const token = (await SecureStore.getItemAsync('token')) || (Platform.OS === 'web' ? localStorage.getItem('token') : '');
      await axios.post(`https://api.ngopi.top/api/jukebox/${warungId}/queue`, {
        title,
        artist,
        track_uri: uri,
        duration,
        play_now: playNow,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch {}
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.trackInfoRow}>
          <TouchableOpacity
            style={[styles.playBtn, isPlaying && styles.playBtnActive]}
            onPress={togglePlay}
            accessibilityLabel={isPlaying ? 'Jeda Jukebox' : 'Putar Jukebox'}
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color={isPlaying ? '#171411' : coffee.text} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.titleArea} onPress={() => setModalVisible(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 13 }}>🎵</Text>
              <Text style={styles.titleText} numberOfLines={1}>
                {playingTrack ? playingTrack.title : 'Jukebox Warkop Kosong'}
              </Text>
            </View>
            <Text style={styles.artistText} numberOfLines={1}>
              {playingTrack ? `${playingTrack.artist} • ${queue.length} di antrian` : 'Ketuk untuk tambah lagu'}
            </Text>
          </TouchableOpacity>

          {playingTrack && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.voteBtn, votes.userVoted === 'like' && styles.voteBtnActive]}
                onPress={() => handleVote('like')}
                accessibilityLabel="Like lagu"
              >
                <Ionicons name="heart" size={14} color={votes.userVoted === 'like' ? coffee.accent : coffee.muted} />
                <Text style={styles.voteCount}>{votes.likes}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.voteBtn, votes.userVoted === 'skip' && styles.voteBtnActive]}
                onPress={() => handleVote('skip')}
                accessibilityLabel="Vote skip lagu"
              >
                <Ionicons name="play-skip-forward" size={14} color={coffee.muted} />
                <Text style={styles.voteCount}>{votes.skips}</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setAddModalVisible(true)}
            accessibilityLabel="Tambah lagu ke Jukebox"
          >
            <Ionicons name="add" size={18} color={coffee.text} />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        {playingTrack && (
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
        )}
      </View>

      {/* Queue Modal */}
      <Modal transparent visible={modalVisible} animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20 }}>🎶</Text>
                <Text style={styles.modalTitle}>Antrian Jukebox Warung</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={coffee.text} />
              </TouchableOpacity>
            </View>

            {playingTrack && (
              <View style={styles.currentTrackCard}>
                <Text style={styles.nowPlayingBadge}>SEDANG DIPUTAR</Text>
                <Text style={styles.modalTrackTitle}>{playingTrack.title}</Text>
                <Text style={styles.modalTrackArtist}>{playingTrack.artist}</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  <Text style={styles.voteBadge}>❤️ {votes.likes} suka</Text>
                  <Text style={styles.voteBadge}>⏭️ {votes.skips}/3 vote skip</Text>
                </View>
              </View>
            )}

            <Text style={styles.sectionHeader}>Antrian Selanjutnya ({queue.length}):</Text>
            <ScrollView style={{ maxHeight: 220, marginBottom: 16 }}>
              {queue.length === 0 ? (
                <Text style={styles.emptyQueueText}>Belum ada lagu berikutnya di antrian.</Text>
              ) : (
                queue.map((track, i) => (
                  <View key={track.id} style={styles.queueItem}>
                    <Text style={styles.queueIndex}>{i + 1}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.queueTitle} numberOfLines={1}>{track.title}</Text>
                      <Text style={styles.queueArtist} numberOfLines={1}>{track.artist}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                setModalVisible(false);
                setAddModalVisible(true);
              }}
            >
              <Text style={styles.primaryBtnText}>+ Tambah Lagu Baru</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Track & Radio Modal */}
      <Modal transparent visible={addModalVisible} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '92%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Musik & Suasana Warkop</Text>
                <Text style={{ fontSize: 11, color: coffee.muted, marginTop: 2 }}>
                  Pilih lagu warkop, cari musik global dunia, atau dengarkan radio streaming
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAddModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={coffee.text} />
              </TouchableOpacity>
            </View>

            {/* TAB SELECTION */}
            <View style={styles.tabBarRow}>
              <TouchableOpacity
                style={[styles.tabBtn, addModalTab === 'catalog' && styles.tabBtnActive]}
                onPress={() => setAddModalTab('catalog')}
              >
                <Text style={[styles.tabBtnText, addModalTab === 'catalog' && styles.tabBtnTextActive]}>
                  🎵 Pilihan
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, addModalTab === 'global' && styles.tabBtnActive]}
                onPress={() => setAddModalTab('global')}
              >
                <Text style={[styles.tabBtnText, addModalTab === 'global' && styles.tabBtnTextActive]}>
                  🌐 Cari Global
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tabBtn, addModalTab === 'radio' && styles.tabBtnActive]}
                onPress={() => setAddModalTab('radio')}
              >
                <Text style={[styles.tabBtnText, addModalTab === 'radio' && styles.tabBtnTextActive]}>
                  📻 Radio Live
                </Text>
              </TouchableOpacity>
            </View>

            {/* TAB 1: KATALOG PILIHAN WARKOP */}
            {addModalTab === 'catalog' && (
              <>
                <View style={styles.searchBar}>
                  <Ionicons name="search" size={16} color={coffee.muted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Saring lagu pilihan warkop..."
                    placeholderTextColor={coffee.muted}
                    value={searchSongQuery}
                    onChangeText={setSearchSongQuery}
                    autoCorrect={false}
                  />
                  {searchSongQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchSongQuery('')} style={{ padding: 4 }}>
                      <Ionicons name="close-circle" size={16} color={coffee.muted} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.presetHeader}>
                    Lagu Pilihan Warkop ({filteredCatalog.length}):
                  </Text>
                  {searchSongQuery.trim().length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setGlobalSearchQuery(searchSongQuery);
                        setAddModalTab('global');
                        handleSearchGlobal(searchSongQuery);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    >
                      <Ionicons name="earth" size={13} color={coffee.accent} />
                      <Text style={{ fontSize: 11, color: coffee.accent, fontWeight: 'bold' }}>
                        Cari Global 🌐
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView style={{ maxHeight: 220, marginBottom: 10 }}>
                  {filteredCatalog.length === 0 ? (
                    <View style={{ paddingVertical: 18, alignItems: 'center', gap: 10 }}>
                      <Text style={{ fontSize: 28 }}>🔍</Text>
                      <Text style={[styles.emptyQueueText, { textAlign: 'center', marginHorizontal: 16 }]}>
                        Lagu "{searchSongQuery}" tidak ada di katalog lokal warkop.
                      </Text>
                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          backgroundColor: coffee.accent,
                          paddingVertical: 10,
                          paddingHorizontal: 16,
                          borderRadius: 20,
                          marginTop: 4,
                        }}
                        onPress={() => {
                          setGlobalSearchQuery(searchSongQuery);
                          setAddModalTab('global');
                          handleSearchGlobal(searchSongQuery);
                        }}
                      >
                        <Ionicons name="earth" size={15} color="#171411" />
                        <Text style={{ color: '#171411', fontWeight: 'bold', fontSize: 13 }}>
                          Cari "{searchSongQuery}" di Musik Global 🌐
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {filteredCatalog.map((song, i) => (
                        <View key={i} style={styles.songCatalogItem}>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.presetTitle} numberOfLines={1}>{song.title}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <Text style={styles.presetArtist} numberOfLines={1}>{song.artist}</Text>
                              <View style={styles.genreBadge}>
                                <Text style={styles.genreText}>{song.genre}</Text>
                              </View>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity
                              style={styles.playNowBtn}
                              onPress={() => handleAddTrack(song, true)}
                            >
                              <Ionicons name="play" size={11} color="#171411" />
                              <Text style={styles.playNowText}>Putar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.addQueueBtn}
                              onPress={() => handleAddTrack(song, false)}
                            >
                              <Text style={styles.addQueueText}>+ Antrian</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>

                {/* Collapsible Manual Audio Input */}
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 9,
                    paddingHorizontal: 12,
                    backgroundColor: coffee.raised,
                    borderRadius: 8,
                    marginTop: 4,
                    borderWidth: 1,
                    borderColor: coffee.border,
                  }}
                  onPress={() => setShowCustomInput(!showCustomInput)}
                >
                  <Text style={{ color: coffee.muted, fontSize: 12, fontWeight: '600' }}>
                    {showCustomInput ? '▼ Tutup Input Link Audio Manual' : '＋ Masukkan Link Audio Manual (MP3 / Stream)...'}
                  </Text>
                  <Ionicons name={showCustomInput ? 'chevron-up' : 'chevron-down'} size={14} color={coffee.muted} />
                </TouchableOpacity>

                {showCustomInput && (
                  <View style={{ marginTop: 8, gap: 6 }}>
                    <TextInput
                      style={styles.input}
                      placeholder="Judul Lagu"
                      placeholderTextColor={coffee.muted}
                      value={newTitle}
                      onChangeText={setNewTitle}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Artis / Penyanyi"
                      placeholderTextColor={coffee.muted}
                      value={newArtist}
                      onChangeText={setNewArtist}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="URL Audio MP3 (https://...)"
                      placeholderTextColor={coffee.muted}
                      value={newUri}
                      onChangeText={setNewUri}
                    />

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={[styles.primaryBtn, { flex: 1, backgroundColor: coffee.raised }, (!newTitle || !newUri) && { opacity: 0.5 }]}
                        onPress={() => handleAddTrack(undefined, false)}
                        disabled={!newTitle || !newUri}
                      >
                        <Text style={[styles.primaryBtnText, { color: coffee.text, fontSize: 13 }]}>+ Antrian</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.primaryBtn, { flex: 1.3 }, (!newTitle || !newUri) && { opacity: 0.5 }]}
                        onPress={() => handleAddTrack(undefined, true)}
                        disabled={!newTitle || !newUri}
                      >
                        <Text style={[styles.primaryBtnText, { fontSize: 13 }]}>▶ Putar Sekarang</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            )}

            {/* TAB 2: PENCARIAN GLOBAL (iTunes Music API) */}
            {addModalTab === 'global' && (
              <>
                <View style={styles.searchBar}>
                  <Ionicons name="earth" size={16} color={coffee.accent} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Cari lagu / artis sedunia (Sheila On 7, Coldplay)..."
                    placeholderTextColor={coffee.muted}
                    value={globalSearchQuery}
                    onChangeText={setGlobalSearchQuery}
                    onSubmitEditing={() => handleSearchGlobal()}
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={styles.searchActionBtn}
                    onPress={() => handleSearchGlobal()}
                    disabled={isSearchingGlobal || !globalSearchQuery.trim()}
                  >
                    {isSearchingGlobal ? (
                      <ActivityIndicator size="small" color="#171411" />
                    ) : (
                      <Text style={styles.searchActionText}>Cari</Text>
                    )}
                  </TouchableOpacity>
                </View>

                {globalSearchError ? (
                  <Text style={{ fontSize: 12, color: '#ff7043', marginBottom: 8, textAlign: 'center' }}>
                    {globalSearchError}
                  </Text>
                ) : null}

                <Text style={styles.presetHeader}>
                  Hasil Pencarian Global ({globalResults.length}):
                </Text>

                <ScrollView style={{ maxHeight: 330, marginBottom: 8 }}>
                  {isSearchingGlobal ? (
                    <View style={{ paddingVertical: 36, alignItems: 'center' }}>
                      <ActivityIndicator size="large" color={coffee.accent} />
                      <Text style={{ color: coffee.muted, fontSize: 12, marginTop: 10 }}>
                        Mencari di katalog musik global...
                      </Text>
                    </View>
                  ) : globalResults.length === 0 ? (
                    <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                      <Text style={{ fontSize: 28, marginBottom: 8 }}>🌎</Text>
                      <Text style={styles.emptyQueueText}>
                        {globalSearchQuery.trim()
                          ? `Tidak ditemukan lagu dengan kata kunci "${globalSearchQuery}"`
                          : 'Ketik nama artis atau judul lagu bebas lalu tekan "Cari"'}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {globalResults.map((item, idx) => (
                        <View key={idx} style={styles.songCatalogItem}>
                          {item.thumbnail ? (
                            <Image
                              source={{ uri: item.thumbnail }}
                              style={{ width: 38, height: 38, borderRadius: 6, marginRight: 8 }}
                            />
                          ) : (
                            <View style={[styles.genreBadge, { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginRight: 8 }]}>
                              <Ionicons name="musical-notes" size={16} color={coffee.accent} />
                            </View>
                          )}
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <Text style={styles.presetTitle} numberOfLines={1}>{item.title}</Text>
                            <Text style={styles.presetArtist} numberOfLines={1}>
                              {item.artist} • <Text style={{ color: coffee.accent }}>{item.genre}</Text>
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity
                              style={styles.playNowBtn}
                              onPress={() => handleAddTrack(item, true)}
                            >
                              <Ionicons name="play" size={11} color="#171411" />
                              <Text style={styles.playNowText}>Putar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.addQueueBtn}
                              onPress={() => handleAddTrack(item, false)}
                            >
                              <Text style={styles.addQueueText}>+ Antrian</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </>
            )}

            {/* TAB 3: RADIO STREAMING WARKOP */}
            {addModalTab === 'radio' && (
              <>
                <Text style={styles.presetHeader}>
                  Siaran Langsung Radio Warkop ({RADIO_STATIONS.length}):
                </Text>
                <Text style={{ fontSize: 11, color: coffee.muted, marginBottom: 10 }}>
                  Dengarkan siaran langsung radio Indonesia 24 jam untuk menemani suasana ngopi santai.
                </Text>

                <ScrollView style={{ maxHeight: 340, marginBottom: 8 }}>
                  <View style={{ gap: 8 }}>
                    {RADIO_STATIONS.map((station) => {
                      const isCurrentRadio =
                        playingTrack?.track_uri === station.streamUrl && isPlaying;
                      return (
                        <View
                          key={station.id}
                          style={[
                            styles.songCatalogItem,
                            isCurrentRadio && { borderColor: coffee.accent, backgroundColor: coffee.surface }
                          ]}
                        >
                          <Text style={{ fontSize: 24, marginRight: 8 }}>{station.icon}</Text>
                          <View style={{ flex: 1, marginRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.presetTitle} numberOfLines={1}>{station.name}</Text>
                              {isCurrentRadio && (
                                <View style={styles.liveBadgeSmall}>
                                  <Text style={styles.liveBadgeSmallText}>LIVE</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.presetArtist} numberOfLines={1}>
                              {station.tagline}
                            </Text>
                            <Text style={{ fontSize: 10, color: coffee.muted, marginTop: 1 }}>
                              📍 {station.location} • {station.genre}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.playNowBtn,
                              isCurrentRadio && { backgroundColor: '#ff7043' }
                            ]}
                            onPress={() => {
                              if (isCurrentRadio) {
                                togglePlay();
                              } else {
                                playRadioStation(station);
                              }
                            }}
                          >
                            <Ionicons name={isCurrentRadio ? 'pause' : 'radio'} size={12} color="#171411" />
                            <Text style={styles.playNowText}>
                              {isCurrentRadio ? 'Jeda' : 'Putar'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: coffee.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: coffee.border,
    overflow: 'hidden',
    marginVertical: 8,
  },
  trackInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 8,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: coffee.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnActive: {
    backgroundColor: coffee.accent,
  },
  titleArea: {
    flex: 1,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    color: coffee.text,
  },
  artistText: {
    fontSize: 11,
    color: coffee.muted,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    backgroundColor: coffee.inset,
  },
  voteBtnActive: {
    backgroundColor: coffee.raised,
  },
  voteCount: {
    fontSize: 11,
    color: coffee.secondary,
    fontWeight: '600',
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: coffee.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarTrack: {
    height: 3,
    backgroundColor: coffee.inset,
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: coffee.accent,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 8, 6, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: coffee.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: coffee.border,
    padding: 20,
    width: '100%',
    maxWidth: 440,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: coffee.text,
  },
  currentTrackCard: {
    backgroundColor: coffee.inset,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: coffee.accentWash,
    marginBottom: 16,
  },
  nowPlayingBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: coffee.accent,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  modalTrackTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: coffee.text,
  },
  modalTrackArtist: {
    fontSize: 12,
    color: coffee.muted,
    marginTop: 2,
  },
  voteBadge: {
    fontSize: 12,
    color: coffee.secondary,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: coffee.muted,
    marginBottom: 8,
  },
  emptyQueueText: {
    fontSize: 12,
    color: coffee.muted,
    fontStyle: 'italic',
    paddingVertical: 12,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: coffee.raised,
    gap: 10,
  },
  queueIndex: {
    fontSize: 12,
    color: coffee.accent,
    fontWeight: '700',
    width: 20,
  },
  queueTitle: {
    fontSize: 13,
    color: coffee.text,
    fontWeight: '600',
  },
  queueArtist: {
    fontSize: 11,
    color: coffee.muted,
  },
  primaryBtn: {
    backgroundColor: coffee.button,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: coffee.buttonText,
    fontWeight: '700',
    fontSize: 14,
  },
  presetHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: coffee.muted,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: coffee.inset,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  presetTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: coffee.text,
  },
  presetArtist: {
    fontSize: 11,
    color: coffee.muted,
  },
  addBadge: {
    fontSize: 12,
    color: coffee.accent,
    fontWeight: '700',
  },
  input: {
    backgroundColor: coffee.inset,
    borderWidth: 1,
    borderColor: coffee.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: coffee.text,
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.inset,
    borderWidth: 1,
    borderColor: coffee.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: coffee.text,
    padding: 0,
  },
  songCatalogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    backgroundColor: coffee.inset,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  genreBadge: {
    backgroundColor: coffee.raised,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  genreText: {
    fontSize: 9,
    color: coffee.accent,
    fontWeight: '700',
  },
  playNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: coffee.accent,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  playNowText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#171411',
  },
  addQueueBtn: {
    backgroundColor: coffee.raised,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  addQueueText: {
    fontSize: 11,
    fontWeight: '600',
    color: coffee.text,
  },
  tabBarRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: coffee.inset,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: coffee.border,
  },
  tabBtnActive: {
    backgroundColor: coffee.button,
    borderColor: coffee.button,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: coffee.muted,
  },
  tabBtnTextActive: {
    color: coffee.buttonText,
    fontWeight: '700',
  },
  searchActionBtn: {
    backgroundColor: coffee.button,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchActionText: {
    color: coffee.buttonText,
    fontSize: 11,
    fontWeight: '700',
  },
  liveBadgeSmall: {
    backgroundColor: '#ff7043',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  liveBadgeSmallText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800',
  },
});
