import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { coffee } from '../theme/coffee';
import { socketService } from '../utils/socket';
import axios from 'axios';
import * as SecureStore from '../utils/storage';

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

import { musicSynthesizer } from '../utils/musicSynthesizer';

const PRESET_SONGS = [
  { title: 'Senja di Kedai Kopi', artist: 'Warkop Indie', uri: 'synth:lofi', duration: 160 },
  { title: 'Kopi Dangdut', artist: 'Fahmi Shahab', uri: 'synth:dangdut', duration: 180 },
  { title: 'Melodi Malam Warung', artist: 'Ngopi Collective', uri: 'synth:malam', duration: 210 },
];

export const JukeboxWidget: React.FC<JukeboxWidgetProps> = ({ warungId }) => {
  const [playingTrack, setPlayingTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [votes, setVotes] = useState({ skips: 0, likes: 0, userVoted: null as string | null });
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 - 100
  const [modalVisible, setModalVisible] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newArtist, setNewArtist] = useState('');
  const [newUri, setNewUri] = useState('');

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

  // Audio playback on web
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    if (playingTrack && isPlaying) {
      musicSynthesizer.play(playingTrack.track_uri, playingTrack.title);
    } else {
      musicSynthesizer.pause();
    }
  }, [playingTrack, isPlaying]);

  // Progress simulation for procedural audio & tracks
  useEffect(() => {
    if (!isPlaying) return;
    const intervalSec = ((playingTrack?.duration || 180) / 100) * 1000;
    const timer = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          handleTrackEnded();
          return 0;
        }
        return p + 1;
      });
    }, intervalSec);

    return () => clearInterval(timer);
  }, [isPlaying, playingTrack]);

  const handleTrackEnded = () => {
    handleVote('skip');
  };

  const togglePlay = () => {
    if (!playingTrack) {
      // Pick first preset song immediately
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
      musicSynthesizer.play(newTrack.track_uri, newTrack.title);
      return;
    }

    if (isPlaying) {
      musicSynthesizer.pause();
      setIsPlaying(false);
    } else {
      musicSynthesizer.play(playingTrack.track_uri, playingTrack.title);
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
        musicSynthesizer.play(next.track_uri, next.title);
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
        musicSynthesizer.play(nextTrack.track_uri, nextTrack.title);
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

  const handleAddTrack = async (trackData?: { title: string; artist: string; uri: string; duration: number }) => {
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
      is_playing: true,
    };

    // Immediately play in client state!
    setPlayingTrack(newTrack);
    setProgress(0);
    setIsPlaying(true);
    musicSynthesizer.play(newTrack.track_uri, newTrack.title);

    setAddModalVisible(false);
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

      {/* Add Track Modal */}
      <Modal transparent visible={addModalVisible} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pilih Lagu untuk Warkop</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={20} color={coffee.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.presetHeader}>Lagu Pilihan Warkop:</Text>
            <View style={{ gap: 8, marginBottom: 16 }}>
              {PRESET_SONGS.map((song, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.presetItem}
                  onPress={() => handleAddTrack(song)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.presetTitle}>{song.title}</Text>
                    <Text style={styles.presetArtist}>{song.artist}</Text>
                  </View>
                  <Text style={styles.addBadge}>+ Putar</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.presetHeader}>Atau Masukkan Audio Sendiri:</Text>
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

            <TouchableOpacity
              style={[styles.primaryBtn, (!newTitle || !newUri) && { opacity: 0.5 }]}
              onPress={() => handleAddTrack()}
              disabled={!newTitle || !newUri}
            >
              <Text style={styles.primaryBtnText}>Masukkan ke Antrian 🎵</Text>
            </TouchableOpacity>
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
});
