import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { coffee } from '../theme/coffee';
import axios from 'axios';

interface SoundItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  audioUrl: string;
}

const DEFAULT_SOUNDS: SoundItem[] = [
  {
    id: 'hujan',
    name: 'Hujan Rintik',
    description: 'Suasana gerimis santai di teras warkop',
    icon: '🌧️',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_bb630cc098.mp3?filename=rain-and-thunder-16705.mp3',
  },
  {
    id: 'kafe_ramai',
    name: 'Kafe Ramai',
    description: 'Denting cangkir kopi & celoteh warkop',
    icon: '☕',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_8340d8987b.mp3?filename=coffee-shop-ambience-19597.mp3',
  },
  {
    id: 'ombak',
    name: 'Ombak Pantai',
    description: 'Deburan ombak tenang di tepi laut',
    icon: '🌊',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2021/09/06/audio_9242d992f8.mp3?filename=waves-ambient-3023.mp3',
  },
  {
    id: 'hutan',
    name: 'Hutan Senja',
    description: 'Kicau burung lembut di pepohonan rindang',
    icon: '🌲',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_cbee1284d7.mp3?filename=forest-birds-and-wind-11234.mp3',
  },
  {
    id: 'jangkrik',
    name: 'Jangkrik Malam',
    description: 'Suara serangga malam di bawah langit berbintang',
    icon: '🦗',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_24e207908b.mp3?filename=night-crickets-ambient-19601.mp3',
  },
  {
    id: 'api_unggun',
    name: 'Api Unggun',
    description: 'Gemeretak kayu bakar hangat di malam hari',
    icon: '🔥',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2021/08/09/audio_dc39bde808.mp3?filename=campfire-crackling-fireplace-sound-119594.mp3',
  },
];

const PREF_KEY_SOUND = 'ngopi_ambient_sound_id';
const PREF_KEY_VOL = 'ngopi_ambient_vol';

export const AmbientPlayer = () => {
  const [sounds, setSounds] = useState<SoundItem[]>(DEFAULT_SOUNDS);
  const [selectedSoundId, setSelectedSoundId] = useState<string>('kafe_ramai');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [modalVisible, setModalVisible] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load available sounds from API if possible
  useEffect(() => {
    axios.get('https://api.ngopi.top/api/ambient/list')
      .then(res => {
        if (res.data?.sounds && Array.isArray(res.data.sounds)) {
          setSounds(res.data.sounds);
        }
      })
      .catch(() => {});

    if (Platform.OS === 'web') {
      const savedSound = localStorage.getItem(PREF_KEY_SOUND);
      const savedVol = localStorage.getItem(PREF_KEY_VOL);
      if (savedSound) setSelectedSoundId(savedSound);
      if (savedVol) setVolume(parseFloat(savedVol));
    }
  }, []);

  const currentSound = sounds.find(s => s.id === selectedSoundId) || sounds[0];

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    if (!audioRef.current) {
      const audio = new Audio();
      audio.loop = true;
      audioRef.current = audio;
    }

    const audio = audioRef.current;
    if (currentSound && audio.src !== currentSound.audioUrl) {
      audio.src = currentSound.audioUrl;
      if (isPlaying) {
        audio.play().catch(() => setIsPlaying(false));
      }
    }
    audio.volume = volume;
  }, [selectedSoundId, currentSound]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !audioRef.current) return;
    audioRef.current.volume = volume;
  }, [volume]);

  const togglePlay = () => {
    if (Platform.OS !== 'web' || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.warn('Audio play restricted by browser gesture:', err);
          setIsPlaying(false);
        });
    }
  };

  const handleSelectSound = (id: string) => {
    setSelectedSoundId(id);
    if (Platform.OS === 'web') {
      localStorage.setItem(PREF_KEY_SOUND, id);
    }
  };

  const changeVolume = (newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    if (Platform.OS === 'web') {
      localStorage.setItem(PREF_KEY_VOL, clamped.toString());
    }
  };

  return (
    <>
      <View style={styles.floatingBar}>
        <TouchableOpacity
          style={[styles.playButton, isPlaying && styles.playButtonActive]}
          onPress={togglePlay}
          accessibilityLabel={isPlaying ? 'Jeda Suara Latar' : 'Putar Suara Latar'}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'volume-high'}
            size={18}
            color={isPlaying ? '#171411' : coffee.text}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.labelButton}
          onPress={() => setModalVisible(true)}
          accessibilityLabel="Pilih Suara Latar Warkop"
        >
          <Text style={styles.iconBadge}>{currentSound.icon}</Text>
          <Text style={styles.soundName} numberOfLines={1}>
            {currentSound.name}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.volButton}
          onPress={() => changeVolume(volume === 0 ? 0.5 : volume > 0.5 ? 0.2 : volume + 0.3)}
          accessibilityLabel="Atur Volume"
        >
          <Text style={styles.volText}>{Math.round(volume * 100)}%</Text>
        </TouchableOpacity>
      </View>

      {/* Selector modal */}
      <Modal transparent visible={modalVisible} animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20 }}>🔊</Text>
                <Text style={styles.modalTitle}>Suara Latar Warkop</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={coffee.text} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Pilih suasana untuk menemani obrolanmu santai seperti di warung kopi.
            </Text>

            <View style={styles.soundList}>
              {sounds.map(item => {
                const isSelected = item.id === selectedSoundId;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.soundItem, isSelected && styles.soundItemActive]}
                    onPress={() => handleSelectSound(item.id)}
                  >
                    <Text style={styles.soundItemIcon}>{item.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.soundItemName, isSelected && styles.soundItemNameActive]}>
                        {item.name}
                      </Text>
                      <Text style={styles.soundItemDesc}>{item.description}</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={20} color={coffee.accent} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Volume adjustments */}
            <View style={styles.volumeRow}>
              <Text style={styles.volumeLabel}>Volume:</Text>
              <View style={styles.volumeSteps}>
                {[0.2, 0.4, 0.6, 0.8, 1.0].map((v, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.volChip,
                      Math.abs(volume - v) < 0.15 && styles.volChipActive,
                    ]}
                    onPress={() => changeVolume(v)}
                  >
                    <Text
                      style={[
                        styles.volChipText,
                        Math.abs(volume - v) < 0.15 && styles.volChipTextActive,
                      ]}
                    >
                      {Math.round(v * 100)}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                setModalVisible(false);
                if (!isPlaying) togglePlay();
              }}
            >
              <Text style={styles.doneBtnText}>
                {isPlaying ? 'Tutup & Nikmati' : 'Mulai Putar Suara 🔊'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(38, 32, 27, 0.95)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: coffee.border,
    paddingVertical: 5,
    paddingHorizontal: 8,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: coffee.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonActive: {
    backgroundColor: coffee.accent,
  },
  labelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
    maxWidth: 140,
  },
  iconBadge: {
    fontSize: 14,
  },
  soundName: {
    fontSize: 12,
    color: coffee.text,
    fontWeight: '600',
  },
  volButton: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: coffee.inset,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: coffee.border,
  },
  volText: {
    fontSize: 10,
    color: coffee.muted,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 8, 6, 0.8)',
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
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: coffee.text,
  },
  closeBtn: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: coffee.muted,
    marginBottom: 16,
    lineHeight: 18,
  },
  soundList: {
    gap: 8,
    marginBottom: 16,
  },
  soundItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: coffee.inset,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 12,
  },
  soundItemActive: {
    borderColor: coffee.accent,
    backgroundColor: coffee.raised,
  },
  soundItemIcon: {
    fontSize: 22,
  },
  soundItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: coffee.text,
  },
  soundItemNameActive: {
    color: coffee.accent,
  },
  soundItemDesc: {
    fontSize: 11,
    color: coffee.muted,
    marginTop: 2,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: coffee.raised,
    marginBottom: 16,
  },
  volumeLabel: {
    fontSize: 13,
    color: coffee.text,
    fontWeight: '600',
  },
  volumeSteps: {
    flexDirection: 'row',
    gap: 6,
  },
  volChip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: coffee.inset,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  volChipActive: {
    backgroundColor: coffee.accentWash,
    borderColor: coffee.accent,
  },
  volChipText: {
    fontSize: 11,
    color: coffee.muted,
    fontWeight: '600',
  },
  volChipTextActive: {
    color: coffee.accent,
  },
  doneBtn: {
    backgroundColor: coffee.button,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: coffee.buttonText,
    fontWeight: '700',
    fontSize: 14,
  },
});
