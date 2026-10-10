import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { coffee } from '../../../src/theme/coffee';
import axios from 'axios';
import { getAuthHeaders } from '../../../src/utils/api';
import * as SecureStore from '../../../src/utils/storage';

const API_URL = 'https://api.ngopi.top/api';

type GameType = 'gapleh' | 'catur' | 'remi' | 'poker' | 'bridge' | 'truf';

interface GameTable {
  id: string;
  name: string;
  game_type: GameType;
  max_players: number;
  min_players: number;
  status: 'waiting' | 'playing' | 'finished';
  is_private: boolean;
  has_password?: boolean;
  host_id: string;
  players: Array<{
    user_id: string;
    display_name: string;
    seat_number: number;
    is_bot?: boolean;
  }>;
  spectators: any[];
}

const GAME_TABS: Array<{ id: GameType; label: string; icon: string; count?: number }> = [
  { id: 'gapleh', label: 'Gapleh', icon: 'dots-vertical' },
  { id: 'catur', label: 'Catur', icon: 'chess-knight' },
  { id: 'remi', label: 'Remi', icon: 'cards-playing-outline' },
  { id: 'poker', label: 'Poker', icon: 'cards-spade' },
  { id: 'bridge', label: 'Bridge', icon: 'bridge' },
  { id: 'truf', label: 'Truf', icon: 'cards-diamond' },
];

export default function GamesLobbyScreen() {
  const [selectedTab, setSelectedTab] = useState<GameType>('gapleh');
  const [tables, setTables] = useState<GameTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUsername, setCurrentUsername] = useState<string>('');

  // Modal create table state
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [tableName, setTableName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Join password modal state
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [selectedTableForJoin, setSelectedTableForJoin] = useState<GameTable | null>(null);
  const [inputPassword, setInputPassword] = useState('');

  const loadCurrentUser = async () => {
    let uid = '';
    let uname = '';
    if (Platform.OS === 'web') {
      uid = localStorage.getItem('userId') || '';
      uname = localStorage.getItem('username') || '';
    } else {
      uid = (await SecureStore.getItemAsync('userId')) || '';
      uname = (await SecureStore.getItemAsync('username')) || '';
    }
    setCurrentUserId(uid || 'user_guest');
    setCurrentUsername(uname || 'Ngopikawan');
  };

  const fetchTables = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(`${API_URL}/games/tables`, {
        params: { type: selectedTab },
        headers,
      });
      if (res.data?.success) {
        setTables(res.data.tables || []);
      }
    } catch (e) {
      console.warn('Gagal memuat meja game:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTab]);

  useEffect(() => {
    loadCurrentUser();
    fetchTables();
  }, [fetchTables]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTables();
  };

  // Quick Match / Instant Game with Bot
  const handleQuickMatch = async () => {
    setIsCreating(true);
    try {
      const headers = await getAuthHeaders();
      // 1. Create table
      const res = await axios.post(
        `${API_URL}/games/tables`,
        {
          gameType: selectedTab,
          name: `Meja Santai @${currentUsername || 'Ngopikawan'}`,
          maxPlayers: 4,
          minPlayers: 2,
          isPrivate: false,
        },
        { headers }
      );

      if (res.data?.success && res.data.table) {
        const tableId = res.data.table.id;
        // 2. Add a friendly bot so user can play immediately!
        try {
          await axios.post(`${API_URL}/games/tables/${tableId}/bot`, {}, { headers });
        } catch (botErr) {
          console.warn('Auto bot add warning:', botErr);
        }

        // 3. Navigate to game room
        router.push({
          pathname: '/(main)/games/[id]' as any,
          params: { id: tableId },
        });
      }
    } catch (err: any) {
      Alert.alert('Gagal', err?.response?.data?.error || 'Gagal membuat meja cepat.');
    } finally {
      setIsCreating(false);
    }
  };

  // Create Table from Modal
  const handleCreateTable = async () => {
    if (!tableName.trim()) {
      Alert.alert('Perhatian', 'Nama meja tidak boleh kosong.');
      return;
    }
    if (isPrivate && !password.trim()) {
      Alert.alert('Perhatian', 'Masukkan kata sandi untuk meja privat.');
      return;
    }

    setIsCreating(true);
    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(
        `${API_URL}/games/tables`,
        {
          gameType: selectedTab,
          name: tableName.trim(),
          maxPlayers,
          minPlayers: 2,
          isPrivate,
          password: isPrivate ? password.trim() : undefined,
        },
        { headers }
      );

      if (res.data?.success && res.data.table) {
        setCreateModalVisible(false);
        setTableName('');
        setPassword('');
        setIsPrivate(false);

        router.push({
          pathname: '/(main)/games/[id]' as any,
          params: { id: res.data.table.id },
        });
      }
    } catch (err: any) {
      Alert.alert('Gagal', err?.response?.data?.error || 'Gagal membuat meja baru.');
    } finally {
      setIsCreating(false);
    }
  };

  // Join Table
  const handleJoinPress = (table: GameTable) => {
    if (table.is_private) {
      setSelectedTableForJoin(table);
      setInputPassword('');
      setPasswordModalVisible(true);
    } else {
      executeJoin(table.id);
    }
  };

  const executeJoin = async (tableId: string, pwd?: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await axios.post(
        `${API_URL}/games/tables/${tableId}/join`,
        { password: pwd },
        { headers }
      );

      if (res.data?.success) {
        setPasswordModalVisible(false);
        router.push({
          pathname: '/(main)/games/[id]' as any,
          params: { id: tableId },
        });
      }
    } catch (err: any) {
      Alert.alert('Gagal Gabung', err?.response?.data?.error || 'Gagal masuk ke meja.');
    }
  };

  // Spectate Table
  const handleSpectatePress = (tableId: string) => {
    router.push({
      pathname: '/(main)/games/[id]' as any,
      params: { id: tableId, spectate: '1' },
    });
  };

  const renderTableCard = ({ item }: { item: GameTable }) => {
    const isPlaying = item.status === 'playing';
    const isFull = item.players.length >= item.max_players;
    const isHost = item.host_id === currentUserId;

    return (
      <View style={styles.tableCard}>
        <View style={styles.tableHeaderRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.tableName} numberOfLines={1}>
                {item.name}
              </Text>
              {item.is_private && (
                <Ionicons name="lock-closed" size={14} color={coffee.accent} />
              )}
            </View>
            <Text style={styles.tableSubText}>
              Host: {item.players[0]?.display_name || 'Ngopikawan'}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              isPlaying ? styles.statusBadgePlaying : styles.statusBadgeWaiting,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isPlaying ? styles.statusTextPlaying : styles.statusTextWaiting,
              ]}
            >
              {isPlaying ? 'Sedang Main 🎲' : 'Menunggu ⏳'}
            </Text>
          </View>
        </View>

        {/* Players Chips */}
        <View style={styles.playersPreviewRow}>
          <View style={styles.playerCountBadge}>
            <Ionicons name="people" size={14} color={coffee.secondary} />
            <Text style={styles.playerCountText}>
              {item.players.length}/{item.max_players} Pemain
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {item.players.map((p, idx) => (
              <View key={p.user_id + idx} style={styles.playerChip}>
                <Text style={styles.playerChipText} numberOfLines={1}>
                  {p.display_name} {p.is_bot ? '🤖' : ''}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Card Actions */}
        <View style={styles.cardActionsRow}>
          {isPlaying || isFull ? (
            <TouchableOpacity
              style={styles.spectateBtn}
              onPress={() => handleSpectatePress(item.id)}
            >
              <Ionicons name="eye-outline" size={16} color={coffee.text} />
              <Text style={styles.spectateBtnText}>Tonton Meja</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() => handleJoinPress(item)}
            >
              <Ionicons name="enter-outline" size={16} color={coffee.buttonText} />
              <Text style={styles.joinBtnText}>
                {isHost ? 'Masuk Kembali' : 'Gabung Kursi'}
              </Text>
            </TouchableOpacity>
          )}

          {isPlaying && (
            <TouchableOpacity
              style={styles.joinBtnSecondary}
              onPress={() => handleSpectatePress(item.id)}
            >
              <Text style={styles.joinBtnSecondaryText}>Spectator View</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityLabel="Kembali"
        >
          <Ionicons name="arrow-back" size={22} color={coffee.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle}>Meja Warkop ☕🎮</Text>
          <Text style={styles.headerSubtitle}>
            Nongkrong, Ngopi, dan Main Bareng Teman
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={onRefresh}
          accessibilityLabel="Refresh daftar meja"
        >
          <Ionicons name="refresh" size={20} color={coffee.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.createHeaderBtn}
          onPress={() => {
            setTableName(`Meja ${selectedTab.toUpperCase()} Warkop`);
            setCreateModalVisible(true);
          }}
          accessibilityLabel="Buat meja baru"
        >
          <Ionicons name="add" size={18} color={coffee.buttonText} />
          <Text style={styles.createHeaderBtnText}>Buat Meja</Text>
        </TouchableOpacity>
      </View>

      {/* Game Selector Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {GAME_TABS.map((tab) => {
            const isSelected = selectedTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabItem, isSelected && styles.tabItemActive]}
                onPress={() => setSelectedTab(tab.id)}
              >
                <MaterialCommunityIcons
                  name={tab.icon as any}
                  size={18}
                  color={isSelected ? coffee.buttonText : coffee.secondary}
                />
                <Text
                  style={[
                    styles.tabItemText,
                    isSelected && styles.tabItemTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Quick Match Action Banner */}
      <View style={styles.quickBanner}>
        <View style={{ flex: 1 }}>
          <Text style={styles.quickBannerTitle}>
            Mau langsung main {selectedTab.toUpperCase()}?
          </Text>
          <Text style={styles.quickBannerSub}>
            Buat meja instan lengkap dengan Bot cerdas siap tanding!
          </Text>
        </View>
        <TouchableOpacity
          style={styles.quickMatchBtn}
          onPress={handleQuickMatch}
          disabled={isCreating}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color={coffee.buttonText} />
          ) : (
            <>
              <Ionicons name="flash" size={16} color={coffee.buttonText} />
              <Text style={styles.quickMatchBtnText}>Main Cepat</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Table List */}
      <View style={{ flex: 1 }}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={coffee.accent} />
            <Text style={styles.loadingText}>Menyiapkan Meja Warkop...</Text>
          </View>
        ) : (
          <FlatList
            data={tables}
            keyExtractor={(item) => item.id}
            renderItem={renderTableCard}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={coffee.accent}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={{ fontSize: 44, marginBottom: 12 }}>🁫☕</Text>
                <Text style={styles.emptyTitle}>
                  Belum Ada Meja {selectedTab.toUpperCase()}
                </Text>
                <Text style={styles.emptySub}>
                  Jadilah yang pertama membuka meja warkop! Ajak teman atau tanding seru melawan bot.
                </Text>
                <TouchableOpacity
                  style={styles.emptyActionBtn}
                  onPress={() => {
                    setTableName(`Meja ${selectedTab.toUpperCase()} Warkop`);
                    setCreateModalVisible(true);
                  }}
                >
                  <Text style={styles.emptyActionBtnText}>+ Buka Meja Baru Sekarang</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </View>

      {/* Modal: Buat Meja Baru */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Buka Meja Warkop Baru</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={22} color={coffee.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 14 }}>
              <View>
                <Text style={styles.inputLabel}>Nama Meja</Text>
                <TextInput
                  style={styles.textInput}
                  value={tableName}
                  onChangeText={setTableName}
                  placeholder="Contoh: Meja Santai Mas Bro"
                  placeholderTextColor={coffee.muted}
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Jumlah Maksimal Pemain</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {[2, 3, 4].map((num) => (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.numberOption,
                        maxPlayers === num && styles.numberOptionActive,
                      ]}
                      onPress={() => setMaxPlayers(num)}
                    >
                      <Text
                        style={[
                          styles.numberOptionText,
                          maxPlayers === num && styles.numberOptionTextActive,
                        ]}
                      >
                        {num} Pemain
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setIsPrivate((p) => !p)}
              >
                <Ionicons
                  name={isPrivate ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={isPrivate ? coffee.accent : coffee.secondary}
                />
                <Text style={styles.checkboxLabel}>Meja Privat (Pakai Kata Sandi)</Text>
              </TouchableOpacity>

              {isPrivate && (
                <View>
                  <Text style={styles.inputLabel}>Kata Sandi Meja</Text>
                  <TextInput
                    style={styles.textInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Masukkan sandi meja"
                    placeholderTextColor={coffee.muted}
                    secureTextEntry
                  />
                </View>
              )}

              <TouchableOpacity
                style={[styles.submitCreateBtn, isCreating && { opacity: 0.6 }]}
                onPress={handleCreateTable}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color={coffee.buttonText} />
                ) : (
                  <Text style={styles.submitCreateBtnText}>Buka Meja & Masuk</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Password Join */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Meja Privat Terkunci</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <Ionicons name="close" size={22} color={coffee.secondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: coffee.secondary, fontSize: 13, marginBottom: 12 }}>
              Masukkan kata sandi untuk bergabung ke {selectedTableForJoin?.name}.
            </Text>

            <TextInput
              style={styles.textInput}
              value={inputPassword}
              onChangeText={setInputPassword}
              placeholder="Kata sandi meja"
              placeholderTextColor={coffee.muted}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.submitCreateBtn, { marginTop: 16 }]}
              onPress={() => {
                if (selectedTableForJoin) {
                  executeJoin(selectedTableForJoin.id, inputPassword);
                }
              }}
            >
              <Text style={styles.submitCreateBtnText}>Buka Kunci & Gabung</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: coffee.background,
  },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.surface,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: coffee.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: coffee.text,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: coffee.secondary,
    fontSize: 11,
    marginTop: 1,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: coffee.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: coffee.button,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
  },
  createHeaderBtnText: {
    color: coffee.buttonText,
    fontSize: 13,
    fontWeight: '800',
  },
  tabsWrapper: {
    backgroundColor: coffee.surface,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
  },
  tabsContainer: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: coffee.raised,
  },
  tabItemActive: {
    backgroundColor: coffee.button,
  },
  tabItemText: {
    color: coffee.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  tabItemTextActive: {
    color: coffee.buttonText,
    fontWeight: '800',
  },
  quickBanner: {
    margin: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: coffee.raised,
    borderWidth: 1,
    borderColor: coffee.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 960,
    width: 'auto',
    alignSelf: 'stretch',
  },
  quickBannerTitle: {
    color: coffee.text,
    fontSize: 14,
    fontWeight: '800',
  },
  quickBannerSub: {
    color: coffee.secondary,
    fontSize: 11,
    marginTop: 2,
  },
  quickMatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: coffee.button,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  quickMatchBtnText: {
    color: coffee.buttonText,
    fontSize: 13,
    fontWeight: '800',
  },
  listContent: {
    padding: 14,
    gap: 12,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  tableCard: {
    backgroundColor: coffee.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: coffee.raised,
    gap: 12,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  tableName: {
    color: coffee.text,
    fontSize: 16,
    fontWeight: '800',
  },
  tableSubText: {
    color: coffee.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeWaiting: {
    backgroundColor: coffee.raised,
  },
  statusBadgePlaying: {
    backgroundColor: 'rgba(212, 163, 115, 0.2)',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusTextWaiting: {
    color: coffee.secondary,
  },
  statusTextPlaying: {
    color: coffee.accent,
  },
  playersPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 6,
    borderRightWidth: 1,
    borderRightColor: coffee.border,
  },
  playerCountText: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  playerChip: {
    backgroundColor: coffee.raised,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  playerChipText: {
    color: coffee.text,
    fontSize: 11,
    fontWeight: '700',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  joinBtn: {
    flex: 1,
    minHeight: 38,
    backgroundColor: coffee.button,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  joinBtnText: {
    color: coffee.buttonText,
    fontSize: 13,
    fontWeight: '800',
  },
  joinBtnSecondary: {
    paddingHorizontal: 12,
    minHeight: 38,
    backgroundColor: coffee.raised,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnSecondaryText: {
    color: coffee.text,
    fontSize: 12,
    fontWeight: '700',
  },
  spectateBtn: {
    flex: 1,
    minHeight: 38,
    backgroundColor: coffee.raised,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  spectateBtnText: {
    color: coffee.text,
    fontSize: 13,
    fontWeight: '800',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: coffee.secondary,
    fontSize: 13,
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: coffee.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySub: {
    color: coffee.secondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 380,
    marginBottom: 16,
  },
  emptyActionBtn: {
    backgroundColor: coffee.button,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  emptyActionBtnText: {
    color: coffee.buttonText,
    fontSize: 13,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: coffee.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: coffee.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: coffee.text,
    fontSize: 17,
    fontWeight: '800',
  },
  inputLabel: {
    color: coffee.secondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: coffee.background,
    color: coffee.text,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: coffee.border,
    outlineStyle: 'none' as any,
  },
  numberOption: {
    flex: 1,
    minHeight: 40,
    backgroundColor: coffee.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: coffee.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberOptionActive: {
    borderColor: coffee.accent,
    backgroundColor: coffee.raised,
  },
  numberOptionText: {
    color: coffee.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  numberOptionTextActive: {
    color: coffee.accent,
    fontWeight: '800',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  checkboxLabel: {
    color: coffee.text,
    fontSize: 13,
    fontWeight: '700',
  },
  submitCreateBtn: {
    minHeight: 44,
    backgroundColor: coffee.button,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitCreateBtnText: {
    color: coffee.buttonText,
    fontSize: 14,
    fontWeight: '800',
  },
});
