import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
  Share as RNShare,
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { coffee } from '../theme/coffee';
import axios from 'axios';
import { globalAudioPlayer, GlobalTrack } from '../utils/globalAudioPlayer';
import { searchLocalCuratedTracks } from '../data/curatedTracks';
import { getValidAccessToken } from '../utils/session';

const API_URL = 'https://api.ngopi.top/api';

export interface CompilationTrack {
  id: string;
  title: string;
  artist: string;
  genre?: string;
  era?: '80s' | '90s' | '2000s' | 'west' | 'warkop';
  uri: string;
  duration: number;
  thumbnail?: string | null;
  is_full: boolean;
}

export interface CompilationAlbum {
  id: string;
  user_id: string;
  creator_username: string;
  creator_display_name: string;
  title: string;
  description: string;
  cover_emoji: string;
  capacity: number;
  points_cost: number;
  tracks: CompilationTrack[];
  created_at: string;
  play_count: number;
  share_url: string;
}

interface CompilationAlbumModalProps {
  visible: boolean;
  onClose: () => void;
  currentUserId?: string;
  currentUsername?: string;
  userPoints?: number;
  onPointsUpdated?: (newPoints: number) => void;
  initialAlbumId?: string | null;
}

const COVER_EMOJIS = ['💿', '☕', '🎸', '📼', '📻', '🎶', '🎧', '🌴', '✨', '🔥'];

export const ERA_CATEGORIES = [
  { id: 'all', label: 'Semua Koleksi', icon: '🎵' },
  { id: 'west', label: '80-90s Rock Barat', icon: '🎸' },
  { id: '90s', label: '90s Pop-Rock Indo', icon: '☕' },
  { id: '2000s', label: '2000s Hits Indo', icon: '💿' },
  { id: '80s', label: '80s Tembang Kenangan', icon: '📻' },
  { id: 'warkop', label: 'Warkop & Dangdut', icon: '🍵' },
];

export default function CompilationAlbumModal({
  visible,
  onClose,
  currentUserId,
  currentUsername,
  userPoints = 0,
  onPointsUpdated,
  initialAlbumId,
}: CompilationAlbumModalProps) {
  const [activeTab, setActiveTab] = useState<'browse' | 'create'>('browse');
  const [albums, setAlbums] = useState<CompilationAlbum[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedAlbumId, setExpandedAlbumId] = useState<string | null>(null);

  // Create Mode state
  const [capacity, setCapacity] = useState<number>(10);
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumDesc, setAlbumDesc] = useState('');
  const [coverEmoji, setCoverEmoji] = useState('💿');
  const [selectedTracks, setSelectedTracks] = useState<CompilationTrack[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEra, setSelectedEra] = useState<string>('all');
  const [searchResults, setSearchResults] = useState<CompilationTrack[]>(() => searchLocalCuratedTracks('', 'all'));
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Share Modal state
  const [shareAlbum, setShareAlbum] = useState<CompilationAlbum | null>(null);

  // Search debounce ref & AbortController ref
  const searchTimeout = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef<number>(0);

  const pointsCost = Math.max(1, Math.ceil(capacity / 10)) * 1000;
  const canAfford = userPoints >= pointsCost;

  // Load albums from backend
  const fetchAlbums = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/albums?_t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.data?.success && Array.isArray(res.data.albums)) {
        setAlbums(res.data.albums);
      }
    } catch (e) {
      console.warn('Failed to fetch albums:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search full songs with era support - instant local first (<1ms) + cancellable remote fallback
  const searchSongs = useCallback(async (query: string, eraFilter?: string) => {
    const qClean = (query || '').trim();
    const targetEra = eraFilter !== undefined ? eraFilter : selectedEra;

    // 1. Instant local curated search (0ms, no network delay, anti-spinner hang)
    const localMatches = searchLocalCuratedTracks(qClean, targetEra);
    if (localMatches.length > 0 || !qClean) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setSearchResults(localMatches);
      setIsSearching(false);
      return;
    }

    // 2. If no local matches found and query is >= 2 chars, query backend with cancellation & timeout
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentRequestId = ++searchRequestIdRef.current;

    setIsSearching(true);
    try {
      const eraParam = targetEra && targetEra !== 'all' ? `&era=${encodeURIComponent(targetEra)}` : '';
      const res = await axios.get(`${API_URL}/albums/search-tracks?q=${encodeURIComponent(qClean)}${eraParam}`, {
        timeout: 3000,
        signal: controller.signal,
      });
      if (currentRequestId === searchRequestIdRef.current && res.data?.success && Array.isArray(res.data.tracks)) {
        setSearchResults(res.data.tracks);
      }
    } catch (e: any) {
      if (!axios.isCancel(e) && e?.name !== 'CanceledError') {
        console.warn('Failed to search songs remotely:', e?.message || e);
      }
    } finally {
      if (currentRequestId === searchRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  }, [selectedEra]);

  useEffect(() => {
    if (visible) {
      fetchAlbums();
      // Load initial local tracks immediately (0ms)
      setSearchResults(searchLocalCuratedTracks(searchQuery, selectedEra));
      if (initialAlbumId) {
        setExpandedAlbumId(initialAlbumId);
      }
    }
  }, [visible, initialAlbumId, fetchAlbums]);

  // Handle Search Input with debounce
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      searchSongs(text);
    }, 350);
  };

  // Direct search trigger
  const handleTriggerSearch = () => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchSongs(searchQuery);
  };

  // Toggle track selection
  const handleToggleTrack = (track: CompilationTrack) => {
    const isSelected = selectedTracks.some((t) => t.id === track.id || t.title.toLowerCase() === track.title.toLowerCase());
    if (isSelected) {
      setSelectedTracks((prev) => prev.filter((t) => t.id !== track.id && t.title.toLowerCase() !== track.title.toLowerCase()));
    } else {
      if (selectedTracks.length >= capacity) {
        Alert.alert(
          'Slot Penuh',
          `Album ini berkapasitas ${capacity} lagu. Anda dapat menaikkan kapasitas slot ke ${capacity + 10} lagu (+1.000 poin) untuk menambah lebih banyak lagu.`
        );
        return;
      }
      setSelectedTracks((prev) => [...prev, track]);
    }
  };

  // Add custom track when query doesn't match standard library
  const handleAddCustomTrack = (songName: string) => {
    const trimmed = songName.trim();
    if (!trimmed) return;

    let parsedTitle = trimmed;
    let parsedArtist = 'Artis Pilihan Warkop';
    if (trimmed.includes('-')) {
      const parts = trimmed.split('-');
      parsedArtist = parts[0].trim();
      parsedTitle = parts.slice(1).join('-').trim();
    } else if (trimmed.toLowerCase().includes(' by ')) {
      const parts = trimmed.split(/ by /i);
      parsedTitle = parts[0].trim();
      parsedArtist = parts[1].trim();
    }

    const customTrack: CompilationTrack = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: parsedTitle,
      artist: parsedArtist,
      genre: 'Lagu Pilihan Utuh ✨',
      uri: 'https://archive.org/download/OnceDealova_201905/Once%20-%20Dealova.mp3',
      duration: 250,
      thumbnail: null,
      is_full: true,
    };

    handleToggleTrack(customTrack);
    setSearchQuery('');
  };

  // Create album submit
  const handleCreateAlbum = async () => {
    if (!albumTitle.trim()) {
      Alert.alert('Perhatian', 'Silakan masukkan judul album kompilasi Anda.');
      return;
    }
    if (selectedTracks.length === 0) {
      Alert.alert('Perhatian', 'Pilih minimal 1 lagu utuh untuk dimasukkan ke album.');
      return;
    }
    if (!canAfford) {
      Alert.alert(
        'Poin Kurang',
        `Poin Anda (${userPoints.toLocaleString()}) tidak cukup. Dibutuhkan ${pointsCost.toLocaleString()} Poin Warkop untuk slot ${capacity} lagu.`
      );
      return;
    }

    const confirmMsg = `Buat album kompilasi "${albumTitle.trim()}" (${selectedTracks.length}/${capacity} lagu)?\n\nPoin Anda akan berkurang sebanyak ${pointsCost.toLocaleString()} Poin.`;

    const executeCreate = async () => {
      setIsCreating(true);
      try {
        const token =
          (await getValidAccessToken()) ||
          (Platform.OS === 'web' && typeof localStorage !== 'undefined'
            ? localStorage.getItem('token')
            : null);

        const res = await axios.post(
          `${API_URL}/albums`,
          {
            userId: currentUserId,
            username: currentUsername,
            title: albumTitle.trim(),
            description: albumDesc.trim(),
            coverEmoji,
            capacity,
            tracks: selectedTracks,
          },
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            timeout: 15000,
          }
        );

        if (res.data?.success && res.data.album) {
          if (typeof res.data.remainingPoints === 'number' && onPointsUpdated) {
            onPointsUpdated(res.data.remainingPoints);
          }
          Alert.alert('Sukses! 💿✨', `Album "${res.data.album.title}" berhasil dirilis! Poin Anda berkurang ${pointsCost.toLocaleString()}.`);
          // Reset form
          setAlbumTitle('');
          setAlbumDesc('');
          setSelectedTracks([]);
          setActiveTab('browse');
          fetchAlbums();
          setExpandedAlbumId(res.data.album.id);
        } else {
          Alert.alert('Gagal', res.data?.error || 'Gagal membuat album kompilasi.');
        }
      } catch (err: any) {
        Alert.alert('Gagal', err?.response?.data?.error || err?.message || 'Terjadi kesalahan sistem.');
      } finally {
        setIsCreating(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(confirmMsg)) {
        executeCreate();
      }
    } else {
      Alert.alert('Konfirmasi Pembuatan Album', confirmMsg, [
        { text: 'Batal', style: 'cancel' },
        { text: 'Rilis Album', onPress: executeCreate },
      ]);
    }
  };

  // Play full album
  const handlePlayAlbum = (album: CompilationAlbum) => {
    if (!album.tracks || album.tracks.length === 0) {
      Alert.alert('Album Kosong', 'Album ini belum memiliki daftar lagu.');
      return;
    }

    // Record album play count on backend
    axios.post(`${API_URL}/albums/${album.id}/play`).catch(() => {});

    // Set onEndCallback on globalAudioPlayer to automatically chain tracks
    let currentIndex = 0;
    const playTrackAtIndex = (idx: number) => {
      if (idx < 0 || idx >= album.tracks.length) return;
      currentIndex = idx;
      const t = album.tracks[idx];
      const gTrack: GlobalTrack = {
        id: `comp_${album.id}_${idx}`,
        title: `${t.title} [${album.cover_emoji} ${album.title} #${idx + 1}]`,
        artist: t.artist,
        track_uri: t.uri,
        thumbnail: t.thumbnail || null,
        duration: t.duration || 240,
        added_by: album.creator_display_name,
        is_playing: true,
        is_full: true,
      };

      globalAudioPlayer.play(gTrack);

      globalAudioPlayer.setOnEndCallback(() => {
        if (currentIndex + 1 < album.tracks.length) {
          playTrackAtIndex(currentIndex + 1);
        }
      });
    };

    playTrackAtIndex(0);
    Alert.alert('Memutar Album 💿', `Memutar "${album.title}" oleh ${album.creator_display_name} (Lagu 1 dari ${album.tracks.length})`);
  };

  // Share Album Actions
  const getShareText = (album: CompilationAlbum) => {
    return `Dengerin Album Kompilasi Warkop buatanku: '${album.cover_emoji} ${album.title}' (${album.tracks.length} Lagu Utuh Pilihan) di Ngopi! 💿☕\n\nNongkrong, denger musik asik, dan main game warkop bareng di sini: ${album.share_url}`;
  };

  const handleShareSocial = (platform: 'whatsapp' | 'twitter' | 'facebook' | 'copy', album: CompilationAlbum) => {
    const text = getShareText(album);
    const url = album.share_url;

    if (platform === 'whatsapp') {
      Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
    } else if (platform === 'twitter') {
      Linking.openURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`);
    } else if (platform === 'facebook') {
      Linking.openURL(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`);
    } else if (platform === 'copy') {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(url);
      }
      setCopyFeedback(album.id);
      setTimeout(() => setCopyFeedback(null), 2500);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.albumIconWrap}>
                <Text style={{ fontSize: 26 }}>💿</Text>
              </View>
              <View>
                <Text style={styles.title}>Album Kompilasi Warkop</Text>
                <Text style={styles.subtitle}>Tukar Poin Jadi Album Pilihanmu Sendiri</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={coffee.secondary} />
            </TouchableOpacity>
          </View>

          {/* User Points Status Bar */}
          <View style={styles.pointsStatusBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="wallet" size={16} color={coffee.accent} />
              <Text style={{ color: coffee.secondary, fontSize: 12 }}>Saldo Poin Anda:</Text>
              <Text style={{ color: '#fbbf24', fontSize: 14, fontWeight: '900' }}>
                {userPoints.toLocaleString()} 🪙
              </Text>
            </View>
            <View style={styles.pointsRateBadge}>
              <Text style={styles.pointsRateBadgeText}>1.000 Poin / 10 Lagu</Text>
            </View>
          </View>

          {/* Segmented Full-Width Tabs (Anti-Cut 100%) */}
          <View style={styles.tabBarContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'browse' && styles.tabButtonActive]}
              onPress={() => setActiveTab('browse')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="disc"
                size={16}
                color={activeTab === 'browse' ? '#1b120c' : coffee.secondary}
              />
              <Text style={[styles.tabButtonText, activeTab === 'browse' && styles.tabButtonTextActive]}>
                Koleksi Album
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'create' && styles.tabButtonActive]}
              onPress={() => setActiveTab('create')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="add-circle"
                size={16}
                color={activeTab === 'create' ? '#1b120c' : coffee.secondary}
              />
              <Text style={[styles.tabButtonText, activeTab === 'create' && styles.tabButtonTextActive]}>
                + Bikin Album
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: BROWSE ALBUMS */}
          {activeTab === 'browse' && (
            <ScrollView style={styles.contentScroll} contentContainerStyle={{ padding: 14, gap: 12 }}>
              <View style={styles.bannerInfo}>
                <Text style={styles.bannerInfoTitle}>☕ Kompilasi Pilihan Warga Warkop</Text>
                <Text style={styles.bannerInfoSub}>
                  Dengarkan album lagu utuh hasil kurasi para pengunjung atau rilis album kompilasi Anda sendiri dengan 1.000 Poin!
                </Text>
              </View>

              {loading ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={coffee.accent} />
                  <Text style={{ color: coffee.secondary, marginTop: 8, fontSize: 12 }}>Memuat album kompilasi...</Text>
                </View>
              ) : albums.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={{ fontSize: 36, marginBottom: 8 }}>📼</Text>
                  <Text style={{ color: coffee.text, fontWeight: 'bold', fontSize: 14 }}>Belum Ada Album Kompilasi</Text>
                  <Text style={{ color: coffee.secondary, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                    Jadilah yang pertama merilis album kompilasi 10 lagu utuh buatan Anda dengan menukar 1.000 Poin Warkop!
                  </Text>
                  <TouchableOpacity style={styles.createNowBtn} onPress={() => setActiveTab('create')}>
                    <Text style={styles.createNowBtnText}>+ Bikin Album Pertama</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                albums.map((alb) => {
                  const isExpanded = expandedAlbumId === alb.id;
                  const isOwner = alb.user_id === currentUserId || alb.creator_username === currentUsername;

                  return (
                    <View key={alb.id} style={styles.albumCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={styles.albumCoverBox}>
                          <Text style={{ fontSize: 32 }}>{alb.cover_emoji || '💿'}</Text>
                        </View>

                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.albumTitle} numberOfLines={1}>
                              {alb.title}
                            </Text>
                            {isOwner && (
                              <View style={styles.ownerBadge}>
                                <Text style={styles.ownerBadgeText}>Punya Saya</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.albumSub} numberOfLines={1}>
                            Oleh: <Text style={{ color: coffee.accent }}>{alb.creator_display_name}</Text> • {alb.tracks?.length || 0} Lagu Utuh
                          </Text>
                          <Text style={styles.albumDesc} numberOfLines={isExpanded ? undefined : 2}>
                            {alb.description}
                          </Text>
                        </View>
                      </View>

                      {/* Action buttons */}
                      <View style={styles.albumActionRow}>
                        <TouchableOpacity style={styles.playAlbumBtn} onPress={() => handlePlayAlbum(alb)}>
                          <Ionicons name="play" size={15} color="#1b120c" />
                          <Text style={styles.playAlbumBtnText}>Putar Album</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.shareBtn} onPress={() => setShareAlbum(alb)}>
                          <Ionicons name="share-social-outline" size={15} color={coffee.accent} />
                          <Text style={styles.shareBtnText}>Bagikan</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.expandBtn}
                          onPress={() => setExpandedAlbumId(isExpanded ? null : alb.id)}
                        >
                          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={coffee.secondary} />
                        </TouchableOpacity>
                      </View>

                      {/* Expanded Tracklist */}
                      {isExpanded && (
                        <View style={styles.expandedTracklist}>
                          <Text style={styles.tracklistHeader}>Daftar Lagu ({alb.tracks?.length}):</Text>
                          {alb.tracks?.map((trk, tIdx) => (
                            <View key={trk.id || tIdx} style={styles.trackRow}>
                              <Text style={styles.trackNumber}>{tIdx + 1}.</Text>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.trackRowTitle} numberOfLines={1}>
                                  {trk.title}
                                </Text>
                                <Text style={styles.trackRowArtist} numberOfLines={1}>
                                  {trk.artist}
                                </Text>
                              </View>
                              <View style={styles.fullTrackTag}>
                                <Text style={styles.fullTrackTagText}>Utuh ✨</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* TAB 2: CREATE ALBUM */}
          {activeTab === 'create' && (
            <ScrollView style={styles.contentScroll} contentContainerStyle={{ padding: 14, gap: 14 }}>
              {/* Cost Banner */}
              <View style={[styles.costBanner, !canAfford && styles.costBannerWarn]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={styles.costBannerTitle}>
                    Biaya Rilis: <Text style={{ color: '#fbbf24', fontWeight: '900' }}>{pointsCost.toLocaleString()} Poin</Text>
                  </Text>
                  <Text style={{ color: canAfford ? '#4ade80' : '#f87171', fontSize: 12, fontWeight: '700' }}>
                    {canAfford ? '✓ Poin Cukup' : '✕ Poin Kurang'}
                  </Text>
                </View>
                <Text style={styles.costBannerDesc}>
                  1.000 Poin untuk 10 lagu utuh pilihan. Poin Anda otomatis berkurang setelah album dirilis.
                </Text>
              </View>

              {/* Capacity Selector */}
              <View>
                <Text style={styles.fieldLabel}>Pilih Kapasitas Lagu:</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  {[10, 20, 30].map((cap) => (
                    <TouchableOpacity
                      key={cap}
                      style={[styles.capacityChip, capacity === cap && styles.capacityChipActive]}
                      onPress={() => setCapacity(cap)}
                    >
                      <Text style={[styles.capacityChipText, capacity === cap && styles.capacityChipTextActive]}>
                        {cap} Lagu ({((cap / 10) * 1000).toLocaleString()} Poin)
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Album Title & Cover */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {/* Emoji Cover Selector */}
                <View>
                  <Text style={styles.fieldLabel}>Cover:</Text>
                  <View style={styles.emojiPickerRow}>
                    <TouchableOpacity
                      style={styles.selectedEmojiBtn}
                      onPress={() => {
                        const curIdx = COVER_EMOJIS.indexOf(coverEmoji);
                        const nextIdx = (curIdx + 1) % COVER_EMOJIS.length;
                        setCoverEmoji(COVER_EMOJIS[nextIdx]);
                      }}
                    >
                      <Text style={{ fontSize: 32 }}>{coverEmoji}</Text>
                      <Text style={{ color: coffee.secondary, fontSize: 9, marginTop: 2 }}>Ganti ↻</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Title and Desc */}
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.fieldLabel}>Judul Album Kompilasi:</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Contoh: Kompilasi Akustik Sore Warkop"
                    placeholderTextColor="#786050"
                    value={albumTitle}
                    onChangeText={setAlbumTitle}
                    maxLength={50}
                  />

                  <Text style={styles.fieldLabel}>Deskripsi / Pesan Kurator:</Text>
                  <TextInput
                    style={[styles.textInput, { height: 44 }]}
                    placeholder="Contoh: Lagu-lagu pilihan santai pengiring kopi tubruk..."
                    placeholderTextColor="#786050"
                    value={albumDesc}
                    onChangeText={setAlbumDesc}
                    maxLength={100}
                  />
                </View>
              </View>

              {/* Selected Tracks Status */}
              <View style={styles.selectedCountBar}>
                <Text style={styles.selectedCountText}>
                  Lagu Terpilih:{' '}
                  <Text style={{ color: coffee.accent, fontWeight: 'bold' }}>
                    {selectedTracks.length}/{capacity} Lagu
                  </Text>
                </Text>
                {selectedTracks.length > 0 && (
                  <TouchableOpacity onPress={() => setSelectedTracks([])}>
                    <Text style={{ color: '#f87171', fontSize: 11 }}>Hapus Semua</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Selected tracks list pill */}
              {selectedTracks.length > 0 && (
                <View style={styles.selectedPillsContainer}>
                  {selectedTracks.map((trk, i) => (
                    <View key={trk.id || i} style={styles.selectedTrackPill}>
                      <Text style={styles.selectedPillNumber}>#{i + 1}</Text>
                      <Text style={styles.selectedPillTitle} numberOfLines={1}>
                        {trk.title}
                      </Text>
                      <TouchableOpacity onPress={() => handleToggleTrack(trk)}>
                        <Ionicons name="close-circle" size={16} color="#f87171" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Era / Decade Filter Section */}
              <View style={{ marginTop: 4 }}>
                <Text style={styles.fieldLabel}>Pilih Berdasarkan Era / Dekade:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.eraChipsScroll}>
                  {ERA_CATEGORIES.map((cat) => {
                    const isCatActive = selectedEra === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.eraChip, isCatActive && styles.eraChipActive]}
                        onPress={() => {
                          setSelectedEra(cat.id);
                          searchSongs(searchQuery, cat.id);
                        }}
                      >
                        <Text style={{ fontSize: 13 }}>{cat.icon}</Text>
                        <Text style={[styles.eraChipText, isCatActive && styles.eraChipTextActive]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Search Song Section */}
              <View style={{ marginTop: 6 }}>
                <Text style={styles.fieldLabel}>Atau Cari Lagu / Artis Favorit:</Text>
                
                {/* Search Input Row with Clear & Submit Action */}
                <View style={styles.searchBoxRow}>
                  <View style={styles.searchBox}>
                    <Ionicons name="search" size={16} color={coffee.secondary} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Ketik lagu atau artis, misal: Spirit carries on..."
                      placeholderTextColor="#786050"
                      value={searchQuery}
                      onChangeText={handleSearchChange}
                      onSubmitEditing={handleTriggerSearch}
                      returnKeyType="search"
                    />
                    {searchQuery.trim().length > 0 && (
                      <TouchableOpacity onPress={() => { setSearchQuery(''); searchSongs('', selectedEra); }}>
                        <Ionicons name="close-circle" size={18} color={coffee.secondary} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity style={styles.searchSubmitBtn} onPress={handleTriggerSearch}>
                    <Text style={styles.searchSubmitBtnText}>Cari</Text>
                  </TouchableOpacity>
                </View>

                {/* Quick Suggestion Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickSearchScroll}>
                  {[
                    'Spirit carries on',
                    'U2',
                    'Manowar',
                    'Pearl Jam',
                    'RHCP',
                    'Nirvana',
                    'Kantata Takwa',
                    'Kantata Samsara',
                    'PAS Band',
                    'Pure Saturday',
                    'Puppen',
                    'Nicky Astria',
                    'Nike Ardilla',
                    'Queen',
                    'Guns N Roses',
                    'Metallica',
                    'Dewa 19',
                    'Sheila on 7',
                    'Peterpan',
                    'Iwan Fals',
                    'Chrisye',
                  ].map((qChip) => (
                    <TouchableOpacity
                      key={qChip}
                      style={[styles.quickSearchChip, searchQuery.toLowerCase() === qChip.toLowerCase() && styles.quickSearchChipActive]}
                      onPress={() => {
                        setSearchQuery(qChip);
                        searchSongs(qChip);
                      }}
                    >
                      <Text style={[styles.quickSearchChipText, searchQuery.toLowerCase() === qChip.toLowerCase() && styles.quickSearchChipTextActive]}>
                        🎵 {qChip}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Searching Indicator */}
                {isSearching && (
                  <View style={styles.searchingLoadingBar}>
                    <ActivityIndicator size="small" color={coffee.accent} />
                    <Text style={styles.searchingLoadingText}>
                      Mencari "{searchQuery || 'lagu pilihan'}" di katalog warkop & arsip...
                    </Text>
                  </View>
                )}

                {/* Counter Badge */}
                <View style={styles.tracksCountRow}>
                  <Text style={styles.tracksCountText}>
                    Tersedia <Text style={{ color: coffee.accent, fontWeight: '900' }}>{searchResults.length}</Text> lagu utuh pilihan siap masuk album:
                  </Text>
                </View>

                {/* Search Results / Curated List */}
                <View style={{ marginTop: 6, gap: 6 }}>
                  {searchResults.slice(0, 60).map((track) => {
                    const isSelected = selectedTracks.some((t) => t.id === track.id || t.title.toLowerCase() === track.title.toLowerCase());
                    return (
                      <View
                        key={track.id}
                        style={[styles.trackPickCard, isSelected && styles.trackPickCardSelected]}
                      >
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.pickTitle} numberOfLines={1}>
                            {track.title}
                          </Text>
                          <Text style={styles.pickArtist} numberOfLines={1}>
                            {track.artist} • {Math.floor(track.duration / 60)}:
                            {String(track.duration % 60).padStart(2, '0')}{track.genre ? ` • ${track.genre}` : ''}
                          </Text>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={styles.fullTrackTag}>
                            <Text style={styles.fullTrackTagText}>Utuh ✨</Text>
                          </View>

                          <TouchableOpacity
                            style={[styles.addTrackBtn, isSelected && styles.addTrackBtnRemove]}
                            onPress={() => handleToggleTrack(track)}
                          >
                            <Ionicons name={isSelected ? 'checkmark' : 'add'} size={15} color="#fff" />
                            <Text style={styles.addTrackBtnText}>{isSelected ? 'Terpilih' : 'Tambah'}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}

                  {/* Fallback add song button if no results match */}
                  {!isSearching && searchResults.length === 0 && searchQuery.trim().length > 0 && (
                    <View style={styles.noResultCard}>
                      <Ionicons name="musical-notes-outline" size={28} color={coffee.accent} />
                      <Text style={styles.noResultTitle}>Lagu "{searchQuery.trim()}"</Text>
                      <Text style={styles.noResultSub}>
                        Lagu belum ada di katalog bawaan. Anda dapat langsung memasukkannya ke album kompilasi Anda:
                      </Text>
                      <TouchableOpacity
                        style={styles.addCustomTrackBtn}
                        onPress={() => handleAddCustomTrack(searchQuery)}
                      >
                        <Ionicons name="add-circle" size={16} color="#1b120c" />
                        <Text style={styles.addCustomTrackBtnText}>+ Tambahkan Lagu Ini ke Album</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitAlbumBtn,
                  (!canAfford || selectedTracks.length === 0 || !albumTitle.trim() || isCreating) &&
                    styles.submitAlbumBtnDisabled,
                ]}
                disabled={!canAfford || selectedTracks.length === 0 || !albumTitle.trim() || isCreating}
                onPress={handleCreateAlbum}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#1b120c" />
                ) : (
                  <>
                    <Ionicons name="disc" size={18} color="#1b120c" />
                    <Text style={styles.submitAlbumBtnText}>
                      Rilis Album Kompilasi (Gunakan {pointsCost.toLocaleString()} Poin)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* SHARE MODAL SUB-VIEW */}
          {shareAlbum && (
            <Modal visible transparent animationType="fade" onRequestClose={() => setShareAlbum(null)}>
              <View style={styles.shareOverlay}>
                <View style={styles.shareCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={styles.shareCardTitle}>Bagikan Album Kompilasi 💿</Text>
                    <TouchableOpacity onPress={() => setShareAlbum(null)}>
                      <Ionicons name="close" size={20} color={coffee.secondary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.sharePreviewBox}>
                    <Text style={{ fontSize: 36, textAlign: 'center' }}>{shareAlbum.cover_emoji}</Text>
                    <Text style={styles.sharePreviewTitle} numberOfLines={1}>{shareAlbum.title}</Text>
                    <Text style={styles.sharePreviewSub}>
                      Kurator: {shareAlbum.creator_display_name} • {shareAlbum.tracks?.length} Lagu Utuh
                    </Text>
                  </View>

                  <Text style={{ color: coffee.secondary, fontSize: 11, marginBottom: 12 }}>
                    Kawan yang membuka tautan ini dapat langsung mendengarkan album kompilasi Anda di warkop:
                  </Text>

                  {/* Social Buttons */}
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.socialShareBtn, { backgroundColor: '#25D366' }]}
                      onPress={() => handleShareSocial('whatsapp', shareAlbum)}
                    >
                      <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                      <Text style={styles.socialShareBtnText}>Kirim ke WhatsApp</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.socialShareBtn, { backgroundColor: '#1DA1F2' }]}
                      onPress={() => handleShareSocial('twitter', shareAlbum)}
                    >
                      <Ionicons name="logo-twitter" size={18} color="#fff" />
                      <Text style={styles.socialShareBtnText}>Bagikan ke X (Twitter)</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.socialShareBtn, { backgroundColor: '#1877F2' }]}
                      onPress={() => handleShareSocial('facebook', shareAlbum)}
                    >
                      <Ionicons name="logo-facebook" size={18} color="#fff" />
                      <Text style={styles.socialShareBtnText}>Bagikan ke Facebook</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.socialShareBtn, { backgroundColor: '#2c1e14', borderWidth: 1, borderColor: coffee.border }]}
                      onPress={() => handleShareSocial('copy', shareAlbum)}
                    >
                      <Ionicons name="copy-outline" size={18} color={coffee.accent} />
                      <Text style={[styles.socialShareBtnText, { color: coffee.accent }]}>
                        {copyFeedback === shareAlbum.id ? '✓ Tautan Berhasil Disalin!' : 'Salin Tautan Album'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  modalCard: {
    width: '100%',
    maxWidth: 540,
    maxHeight: '92%',
    backgroundColor: '#1b120c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: coffee.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 163, 115, 0.15)',
  },
  albumIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.4)',
  },
  title: {
    color: coffee.text,
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: coffee.secondary,
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#261a12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointsStatusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#20140c',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 163, 115, 0.1)',
  },
  pointsRateBadge: {
    backgroundColor: 'rgba(217, 119, 6, 0.18)',
    borderWidth: 1,
    borderColor: '#d97706',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pointsRateBadgeText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800',
  },
  tabBarContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#1b120c',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 163, 115, 0.15)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#261910',
    borderWidth: 1,
    borderColor: 'rgba(212, 163, 115, 0.2)',
  },
  tabButtonActive: {
    backgroundColor: coffee.accent,
    borderColor: coffee.accent,
  },
  tabButtonText: {
    color: coffee.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#1b120c',
    fontWeight: '900',
  },
  contentScroll: {
    flex: 1,
  },
  bannerInfo: {
    backgroundColor: '#241810',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 163, 115, 0.15)',
  },
  bannerInfoTitle: {
    color: coffee.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  bannerInfoSub: {
    color: coffee.secondary,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#241810',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 163, 115, 0.15)',
  },
  createNowBtn: {
    marginTop: 14,
    backgroundColor: coffee.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createNowBtnText: {
    color: '#1b120c',
    fontWeight: '800',
    fontSize: 12,
  },
  albumCard: {
    backgroundColor: '#241810',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 163, 115, 0.15)',
  },
  albumCoverBox: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: '#1b120c',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: coffee.border,
  },
  albumTitle: {
    color: coffee.text,
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  ownerBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  ownerBadgeText: {
    color: '#4ade80',
    fontSize: 9,
    fontWeight: 'bold',
  },
  albumSub: {
    color: coffee.secondary,
    fontSize: 11,
    marginTop: 2,
  },
  albumDesc: {
    color: '#a38f7f',
    fontSize: 11,
    marginTop: 4,
  },
  albumActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 163, 115, 0.08)',
  },
  playAlbumBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: coffee.accent,
    paddingVertical: 7,
    borderRadius: 6,
  },
  playAlbumBtnText: {
    color: '#1b120c',
    fontSize: 12,
    fontWeight: 'bold',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2d1e15',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 163, 115, 0.2)',
  },
  shareBtnText: {
    color: coffee.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  expandBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#2d1e15',
  },
  expandedTracklist: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 163, 115, 0.1)',
    gap: 6,
  },
  tracklistHeader: {
    color: coffee.accent,
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1b120c',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  trackNumber: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: 'bold',
    width: 20,
  },
  trackRowTitle: {
    color: coffee.text,
    fontSize: 12,
    fontWeight: '600',
  },
  trackRowArtist: {
    color: coffee.secondary,
    fontSize: 10,
    marginTop: 1,
  },
  fullTrackTag: {
    backgroundColor: 'rgba(234, 88, 12, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fullTrackTagText: {
    color: '#fb923c',
    fontSize: 9,
    fontWeight: 'bold',
  },
  costBanner: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: 10,
    padding: 10,
  },
  costBannerWarn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  costBannerTitle: {
    color: coffee.text,
    fontSize: 13,
    fontWeight: 'bold',
  },
  costBannerDesc: {
    color: coffee.secondary,
    fontSize: 11,
    marginTop: 4,
  },
  fieldLabel: {
    color: coffee.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  capacityChip: {
    flex: 1,
    backgroundColor: '#261a12',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 163, 115, 0.15)',
  },
  capacityChipActive: {
    backgroundColor: 'rgba(212, 163, 115, 0.2)',
    borderColor: coffee.accent,
  },
  capacityChipText: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  capacityChipTextActive: {
    color: coffee.accent,
    fontWeight: 'bold',
  },
  emojiPickerRow: {
    marginTop: 6,
  },
  selectedEmojiBtn: {
    width: 58,
    height: 78,
    backgroundColor: '#261a12',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: coffee.border,
  },
  textInput: {
    backgroundColor: '#261a12',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: coffee.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: coffee.text,
    fontSize: 12,
  },
  selectedCountBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  selectedCountText: {
    color: coffee.secondary,
    fontSize: 12,
  },
  selectedPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#231810',
    padding: 8,
    borderRadius: 8,
  },
  selectedTrackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1b120c',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 163, 115, 0.2)',
    maxWidth: '48%',
  },
  selectedPillNumber: {
    color: coffee.accent,
    fontSize: 10,
    fontWeight: 'bold',
  },
  selectedPillTitle: {
    color: coffee.text,
    fontSize: 11,
    flex: 1,
  },
  searchBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#261a12',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: coffee.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: coffee.text,
    fontSize: 13,
    padding: 0,
  },
  searchSubmitBtn: {
    backgroundColor: coffee.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSubmitBtnText: {
    color: '#1b120c',
    fontSize: 13,
    fontWeight: '900',
  },
  eraChipsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 6,
  },
  eraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#261910',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 163, 115, 0.15)',
  },
  eraChipActive: {
    backgroundColor: 'rgba(217, 119, 6, 0.25)',
    borderColor: '#f59e0b',
  },
  eraChipText: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  eraChipTextActive: {
    color: '#fbbf24',
    fontWeight: '900',
  },
  tracksCountRow: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginTop: 2,
  },
  tracksCountText: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  quickSearchScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 6,
  },
  quickSearchChip: {
    backgroundColor: '#24170f',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 163, 115, 0.15)',
  },
  quickSearchChipActive: {
    backgroundColor: 'rgba(212, 163, 115, 0.25)',
    borderColor: coffee.accent,
  },
  quickSearchChipText: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  quickSearchChipTextActive: {
    color: coffee.accent,
    fontWeight: '800',
  },
  searchingLoadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  searchingLoadingText: {
    color: coffee.secondary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  noResultCard: {
    backgroundColor: '#261910',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 163, 115, 0.2)',
    marginTop: 6,
  },
  noResultTitle: {
    color: coffee.text,
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 6,
  },
  noResultSub: {
    color: coffee.secondary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 16,
  },
  addCustomTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: coffee.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addCustomTrackBtnText: {
    color: '#1b120c',
    fontSize: 12,
    fontWeight: '800',
  },
  trackPickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#241810',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 163, 115, 0.1)',
  },
  trackPickCardSelected: {
    borderColor: '#4ade80',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  pickTitle: {
    color: coffee.text,
    fontSize: 12,
    fontWeight: '600',
  },
  pickArtist: {
    color: coffee.secondary,
    fontSize: 10,
    marginTop: 1,
  },
  addTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: coffee.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  addTrackBtnRemove: {
    backgroundColor: '#16a34a',
  },
  addTrackBtnText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  submitAlbumBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: coffee.accent,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  submitAlbumBtnDisabled: {
    opacity: 0.4,
  },
  submitAlbumBtnText: {
    color: '#1b120c',
    fontSize: 13,
    fontWeight: '900',
  },
  shareOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  shareCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1b120c',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  shareCardTitle: {
    color: coffee.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  sharePreviewBox: {
    backgroundColor: '#261a12',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 163, 115, 0.15)',
  },
  sharePreviewTitle: {
    color: coffee.text,
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 6,
  },
  sharePreviewSub: {
    color: coffee.secondary,
    fontSize: 11,
    marginTop: 2,
  },
  socialShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  socialShareBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
