import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { coffee } from '../theme/coffee';
import axios from 'axios';

const API_URL = 'https://api.ngopi.top/api';

interface TopPointUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  bmc_id: number;
  points: number;
}

interface TopMusicTrack {
  title: string;
  artist: string;
  thumbnail?: string | null;
  playCount: number;
}

interface TopRadioStation {
  id: string;
  name: string;
  frequency: string;
  genre: string;
  icon: string;
  selectedCount: number;
}

interface TopGameItem {
  id: string;
  name: string;
  icon: string;
  matchesPlayed: number;
}

interface LeaderboardData {
  top_points: TopPointUser[];
  top_music: TopMusicTrack[];
  top_radio: TopRadioStation[];
  top_games: TopGameItem[];
}

interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectRadio?: (stationId: string) => void;
}

type TabType = 'points' | 'music' | 'radio' | 'games';

export default function LeaderboardModal({ visible, onClose, onSelectRadio }: LeaderboardModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('points');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/leaderboard`);
      if (res.data?.success && res.data?.data) {
        setData(res.data.data);
      }
    } catch (e) {
      console.warn('Failed to load leaderboard:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchLeaderboard();
    }
  }, [visible, fetchLeaderboard]);

  const getRankBadge = (index: number) => {
    if (index === 0) return { icon: '🥇', label: '1st', bg: '#fef3c7', border: '#f59e0b', color: '#b45309' };
    if (index === 1) return { icon: '🥈', label: '2nd', bg: '#f1f5f9', border: '#94a3b8', color: '#475569' };
    if (index === 2) return { icon: '🥉', label: '3rd', bg: '#ffedd5', border: '#ea580c', color: '#9a3412' };
    return { icon: `${index + 1}`, label: `#${index + 1}`, bg: '#241a12', border: coffee.border, color: coffee.muted };
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.trophyIconWrap}>
                <Text style={{ fontSize: 24 }}>🏆</Text>
              </View>
              <View>
                <Text style={styles.title}>Klasemen Warkop</Text>
                <Text style={styles.subtitle}>Peringkat Komunitas & Aktivitas Warkop</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={coffee.secondary} />
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'points' && styles.tabButtonActive]}
              onPress={() => setActiveTab('points')}
            >
              <Ionicons
                name="star"
                size={14}
                color={activeTab === 'points' ? coffee.accent : coffee.muted}
              />
              <Text style={[styles.tabText, activeTab === 'points' && styles.tabTextActive]}>
                Poin
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'music' && styles.tabButtonActive]}
              onPress={() => setActiveTab('music')}
            >
              <Ionicons
                name="musical-notes"
                size={14}
                color={activeTab === 'music' ? coffee.accent : coffee.muted}
              />
              <Text style={[styles.tabText, activeTab === 'music' && styles.tabTextActive]}>
                Musik
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'radio' && styles.tabButtonActive]}
              onPress={() => setActiveTab('radio')}
            >
              <Ionicons
                name="radio"
                size={14}
                color={activeTab === 'radio' ? coffee.accent : coffee.muted}
              />
              <Text style={[styles.tabText, activeTab === 'radio' && styles.tabTextActive]}>
                Radio
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'games' && styles.tabButtonActive]}
              onPress={() => setActiveTab('games')}
            >
              <Ionicons
                name="game-controller"
                size={14}
                color={activeTab === 'games' ? coffee.accent : coffee.muted}
              />
              <Text style={[styles.tabText, activeTab === 'games' && styles.tabTextActive]}>
                Game
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={coffee.accent} />
              <Text style={styles.loadingText}>Memuat data klasemen...</Text>
            </View>
          ) : (
            <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
              {/* TAB 1: POIN TERBANYAK */}
              {activeTab === 'points' && (
                <View style={styles.tabContent}>
                  <View style={styles.tabBanner}>
                    <Text style={styles.tabBannerTitle}>⭐ Peraih Poin Terbanyak Warkop</Text>
                    <Text style={styles.tabBannerDesc}>
                      Poin didapat dari menang game santai, interaksi warkop, dan tantangan harian. Poin disimpan permanen.
                    </Text>
                  </View>

                  {data?.top_points?.map((item, idx) => {
                    const badge = getRankBadge(idx);
                    return (
                      <View key={item.id} style={styles.rankCard}>
                        <View style={[styles.rankBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                          <Text style={[styles.rankText, { color: badge.color }]}>{badge.icon}</Text>
                        </View>

                        <View style={styles.avatarWrap}>
                          {item.avatar_url ? (
                            <Image source={{ uri: item.avatar_url }} style={styles.avatarImg} />
                          ) : (
                            <Text style={styles.avatarLetter}>
                              {(item.display_name || item.username || 'U').charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>

                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {item.display_name}
                          </Text>
                          <Text style={styles.itemSub} numberOfLines={1}>
                            @{item.username} • BMC #{item.bmc_id}
                          </Text>
                        </View>

                        <View style={styles.pointsPill}>
                          <Text style={styles.pointsVal}>{item.points.toLocaleString()}</Text>
                          <Text style={styles.pointsLabel}>Poin</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* TAB 2: MUSIK BANYAK DIDENGAR */}
              {activeTab === 'music' && (
                <View style={styles.tabContent}>
                  <View style={styles.tabBanner}>
                    <Text style={styles.tabBannerTitle}>🎵 Musik Paling Banyak Didengar</Text>
                    <Text style={styles.tabBannerDesc}>
                      Daftar lagu favorit pilihan warga Warkop yang paling sering diputar dan disukai di Jukebox.
                    </Text>
                  </View>

                  {data?.top_music?.map((item, idx) => {
                    const badge = getRankBadge(idx);
                    return (
                      <View key={item.title + idx} style={styles.rankCard}>
                        <View style={[styles.rankBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                          <Text style={[styles.rankText, { color: badge.color }]}>{badge.icon}</Text>
                        </View>

                        <View style={styles.musicIconWrap}>
                          <Text style={{ fontSize: 18 }}>🎶</Text>
                        </View>

                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.itemSub} numberOfLines={1}>
                            {item.artist}
                          </Text>
                        </View>

                        <View style={styles.countPill}>
                          <Text style={styles.countVal}>{item.playCount}</Text>
                          <Text style={styles.countLabel}>x Putar</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* TAB 3: RADIO BANYAK DIPILIH */}
              {activeTab === 'radio' && (
                <View style={styles.tabContent}>
                  <View style={styles.tabBanner}>
                    <Text style={styles.tabBannerTitle}>📻 Stasiun Radio Paling Populer</Text>
                    <Text style={styles.tabBannerDesc}>
                      Stasiun radio siaran langsung yang paling sering dinyalakan untuk menemani nongkrong di meja kopi.
                    </Text>
                  </View>

                  {data?.top_radio?.map((item, idx) => {
                    const badge = getRankBadge(idx);
                    return (
                      <View key={item.id} style={styles.rankCard}>
                        <View style={[styles.rankBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                          <Text style={[styles.rankText, { color: badge.color }]}>{badge.icon}</Text>
                        </View>

                        <View style={styles.radioIconWrap}>
                          <Text style={{ fontSize: 18 }}>{item.icon || '📻'}</Text>
                        </View>

                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.itemSub} numberOfLines={1}>
                            {item.genre} • {item.frequency}
                          </Text>
                        </View>

                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <View style={styles.countPill}>
                            <Text style={styles.countVal}>{item.selectedCount}</Text>
                            <Text style={styles.countLabel}>Dipilih</Text>
                          </View>
                          {onSelectRadio && (
                            <TouchableOpacity
                              style={styles.listenShortcut}
                              onPress={() => {
                                onSelectRadio(item.id);
                                onClose();
                              }}
                            >
                              <Text style={styles.listenShortcutText}>Putar 🔊</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* TAB 4: GAME BANYAK DIMAINKAN */}
              {activeTab === 'games' && (
                <View style={styles.tabContent}>
                  <View style={styles.tabBanner}>
                    <Text style={styles.tabBannerTitle}>🎲 Permainan Terpopuler di Meja</Text>
                    <Text style={styles.tabBannerDesc}>
                      Permainan kartu & catur yang paling sering digelar antar pengunjung warung kopi.
                    </Text>
                  </View>

                  {data?.top_games?.map((item, idx) => {
                    const badge = getRankBadge(idx);
                    return (
                      <View key={item.id} style={styles.rankCard}>
                        <View style={[styles.rankBadge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                          <Text style={[styles.rankText, { color: badge.color }]}>{badge.icon}</Text>
                        </View>

                        <View style={styles.gameIconWrap}>
                          <Text style={{ fontSize: 22 }}>{item.icon || '🎮'}</Text>
                        </View>

                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.itemSub} numberOfLines={1}>
                            Meja Santai Warkop
                          </Text>
                        </View>

                        <View style={styles.countPill}>
                          <Text style={styles.countVal}>{item.matchesPlayed}</Text>
                          <Text style={styles.countLabel}>Pertandingan</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}

          {/* Footer refresh */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchLeaderboard}>
              <Ionicons name="refresh" size={14} color={coffee.secondary} />
              <Text style={styles.refreshText}>Segarkan Data</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: '#1b120c',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: coffee.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    backgroundColor: '#241a12',
  },
  trophyIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 163, 115, 0.15)',
    borderWidth: 1,
    borderColor: coffee.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: coffee.text,
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: coffee.secondary,
    fontSize: 11,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#2e1f14',
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    backgroundColor: '#170e08',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: coffee.accent,
    backgroundColor: 'rgba(212, 163, 115, 0.08)',
  },
  tabText: {
    color: coffee.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: coffee.accent,
    fontWeight: '800',
  },
  contentScroll: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: coffee.secondary,
    fontSize: 13,
  },
  tabContent: {
    gap: 10,
    paddingBottom: 16,
  },
  tabBanner: {
    backgroundColor: 'rgba(212, 163, 115, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 163, 115, 0.25)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  tabBannerTitle: {
    color: coffee.accent,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  tabBannerDesc: {
    color: coffee.secondary,
    fontSize: 11,
    lineHeight: 16,
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#241a12',
    borderWidth: 1,
    borderColor: coffee.border,
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '800',
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: coffee.accent,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 36,
    height: 36,
  },
  avatarLetter: {
    color: '#1b120c',
    fontSize: 15,
    fontWeight: '800',
  },
  musicIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#382619',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#382619',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#382619',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemName: {
    color: coffee.text,
    fontSize: 13,
    fontWeight: '700',
  },
  itemSub: {
    color: coffee.muted,
    fontSize: 11,
    marginTop: 2,
  },
  pointsPill: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(212, 163, 115, 0.15)',
    borderWidth: 1,
    borderColor: coffee.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pointsVal: {
    color: coffee.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  pointsLabel: {
    color: coffee.secondary,
    fontSize: 9,
    fontWeight: '600',
  },
  countPill: {
    alignItems: 'flex-end',
    backgroundColor: '#2e1f14',
    borderWidth: 1,
    borderColor: coffee.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countVal: {
    color: coffee.text,
    fontSize: 13,
    fontWeight: '700',
  },
  countLabel: {
    color: coffee.muted,
    fontSize: 9,
  },
  listenShortcut: {
    backgroundColor: 'rgba(212, 163, 115, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  listenShortcutText: {
    color: coffee.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: coffee.border,
    backgroundColor: '#170e08',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  refreshText: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
});
