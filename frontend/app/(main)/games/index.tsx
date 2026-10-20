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

import LeaderboardModal from '../../../src/components/LeaderboardModal';
import PokemonHubModal from '../../../src/components/PokemonHubModal';
import GameEventModal from '../../../src/components/GameEventModal';
import PointsHubModal from '../../../src/components/PointsHubModal';
import ChessProArenaModal from '../../../src/components/ChessProArenaModal';

const API_URL = 'https://api.ngopi.top/api';

type GameType = 'gapleh' | 'catur' | 'uno' | 'snake_ladder' | 'monopoly' | 'pokemon' | 'remi' | 'poker' | 'bridge' | 'truf' | 'mahyong' | 'halma' | 'daku' | 'karambol' | 'billiard';

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
  { id: 'uno', label: 'UNO', icon: 'cards-playing-outline' },
  { id: 'snake_ladder', label: 'Ular Tangga', icon: 'dice-multiple' },
  { id: 'monopoly', label: 'Monopoli', icon: 'home-city-outline' },
  { id: 'pokemon', label: 'Monster TCG', icon: 'sword-cross' },
  { id: 'remi', label: 'Remi', icon: 'cards-playing-outline' },
  { id: 'poker', label: 'Poker', icon: 'cards-spade' },
  { id: 'bridge', label: 'Bridge', icon: 'bridge' },
  { id: 'truf', label: 'Truf PekaI', icon: 'cards-diamond' },
  { id: 'mahyong', label: 'Mahjong', icon: 'cards' },
  { id: 'halma', label: 'Halma', icon: 'star' },
  { id: 'daku', label: 'Daku', icon: 'circle-slice-8' },
  { id: 'karambol', label: 'Karambol', icon: 'record-circle-outline' },
  { id: 'billiard', label: 'Billiard', icon: 'billiards' },
];

export interface GaplehBotItem {
  id: string;
  name: string;
  title: string;
  personality: string;
  difficulty: string;
  avatar: string;
}

export const GAPLEH_BOTS: GaplehBotItem[] = [
  { id: 'gapleh_2_budi', name: 'Gelideg', title: 'Kelas Bulu', personality: 'Pemalu, sering salah', difficulty: 'Pemula', avatar: '🐣' },
  { id: 'gapleh_2_asep', name: 'Mangmad', title: 'Kelas Warung', personality: 'Ramah, main santai', difficulty: 'Kasual', avatar: '☕' },
  { id: 'gapleh_2_rudi', name: 'Mangsante', title: 'Kelas Kampung', personality: 'Serius, kadang blunder', difficulty: 'Menengah', avatar: '🧢' },
  { id: 'gapleh_2_deni', name: 'Hamlihi', title: 'Kelas Kota', personality: 'Cerdas, sering jebakan', difficulty: 'Mahir', avatar: '🕶️' },
  { id: 'gapleh_2_jago', name: 'Sodung', title: 'Kelas Jagal', personality: 'Agresif, susah ditebak', difficulty: 'Expert', avatar: '🔥' },
  { id: 'gapleh_2_maestro', name: 'Daman', title: 'Kelas Dunia', personality: 'Tenang, mematikan', difficulty: 'Juara', avatar: '👑' },
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
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [chessColor, setChessColor] = useState<'white' | 'black' | 'random'>('white');
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [gaplehLevel, setGaplehLevel] = useState<1 | 2>(1);
  const [selectedBotIds, setSelectedBotIds] = useState<string[]>(['gapleh_2_budi', 'gapleh_2_asep', 'gapleh_2_deni']);
  const [gaplehMode, setGaplehMode] = useState<'individual' | 'partnership'>('individual');
  const [gaplehRuleset, setGaplehRuleset] = useState<'kampung' | 'tournament'>('kampung');
  const [targetScore, setTargetScore] = useState<number>(250);
  const [gaplehRulesModalVisible, setGaplehRulesModalVisible] = useState<boolean>(false);
  const [pokemonHubVisible, setPokemonHubVisible] = useState<boolean>(false);
  const [eventModalVisible, setEventModalVisible] = useState<boolean>(false);
  const [pointsHubVisible, setPointsHubVisible] = useState<boolean>(false);
  const [chessProModalVisible, setChessProModalVisible] = useState<boolean>(false);
  const [chessMode, setChessMode] = useState<'basic' | 'pro'>('basic');

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
        timeout: 6000,
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
      const isLevel2 = selectedTab === 'gapleh' && gaplehLevel === 2;
      const config = selectedTab === 'catur'
        ? { preferredColor: chessColor, botDifficulty }
        : selectedTab === 'gapleh'
        ? {
            level: gaplehLevel,
            gaplehMode,
            gaplehRuleset,
            targetScore,
            selectedBotIds: isLevel2 ? ['gapleh_2_budi', 'gapleh_2_asep', 'gapleh_2_deni'] : undefined,
          }
        : undefined;

      const maxP = ['catur', 'pokemon', 'daku', 'billiard'].includes(selectedTab)
        ? 2
        : (isLevel2 || gaplehMode === 'partnership')
        ? 4
        : 4;
      const minP = isLevel2 || gaplehMode === 'partnership' ? 4 : 2;

      // 1. Create table
      const res = await axios.post(
        `${API_URL}/games/tables`,
        {
          gameType: selectedTab,
          name: isLevel2 ? `Meja Gapleh Rame (Lvl 2) @${currentUsername || 'Ngopikawan'}` : `Meja Santai @${currentUsername || 'Ngopikawan'}`,
          maxPlayers: maxP,
          minPlayers: minP,
          isPrivate: false,
          config,
        },
        { headers }
      );

      if (res.data?.success && res.data.table) {
        const tableId = res.data.table.id;
        // 2. If not level 2 (which already auto-seated 3 bots), add 1 friendly bot
        if (!isLevel2) {
          try {
            await axios.post(`${API_URL}/games/tables/${tableId}/bot`, {}, { headers });
          } catch (botErr) {
            console.warn('Auto bot add warning:', botErr);
          }
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
      const isLevel2 = selectedTab === 'gapleh' && gaplehLevel === 2;
      const config = selectedTab === 'catur'
        ? { preferredColor: chessColor, botDifficulty }
        : selectedTab === 'gapleh'
        ? {
            level: gaplehLevel,
            gaplehMode,
            gaplehRuleset,
            targetScore,
            selectedBotIds: isLevel2 ? selectedBotIds : undefined,
          }
        : undefined;

      const maxP = ['catur', 'pokemon', 'daku', 'billiard'].includes(selectedTab)
        ? 2
        : (isLevel2 || gaplehMode === 'partnership')
        ? 4
        : maxPlayers;
      const minP = isLevel2 || gaplehMode === 'partnership' ? 4 : 2;

      const res = await axios.post(
        `${API_URL}/games/tables`,
        {
          gameType: selectedTab,
          name: tableName.trim(),
          maxPlayers: maxP,
          minPlayers: minP,
          isPrivate,
          password: isPrivate ? password.trim() : undefined,
          config,
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
        {
          password: pwd,
          userId: currentUserId,
          username: currentUsername,
        },
        {
          headers: {
            ...headers,
            'x-user-id': currentUserId,
            'x-user-name': currentUsername,
          },
        }
      );

      if (res.data?.success) {
        setPasswordModalVisible(false);
        router.push({
          pathname: '/(main)/games/[id]' as any,
          params: { id: tableId },
        });
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || 'Gagal masuk ke meja.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(errMsg);
      } else {
        Alert.alert('Gagal Gabung', errMsg);
      }
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
    const humanCount = item.players.filter((p) => !p.is_bot).length;
    const hasBots = item.players.some((p) => p.is_bot);
    const isFull = humanCount >= item.max_players;
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
            {(item as any).config?.level === 2 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <View style={{ backgroundColor: 'rgba(249, 115, 22, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#f97316' }}>
                  <Text style={{ color: '#fb923c', fontSize: 10, fontWeight: '800' }}>
                    🔥 Gapleh Rame (Level 2) • 4 Pemain WAJIB
                  </Text>
                </View>
              </View>
            ) : item.game_type === 'gapleh' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <View style={{ backgroundColor: 'rgba(212, 163, 115, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: coffee.accent }}>
                  <Text style={{ color: coffee.accent, fontSize: 10, fontWeight: '700' }}>
                    ☕ Gapleh Klasik (Level 1)
                  </Text>
                </View>
              </View>
            ) : null}
            {(item as any).config?.gaplehMode === 'partnership' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                <View style={{ backgroundColor: 'rgba(212, 163, 115, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: coffee.accent }}>
                  <Text style={{ color: coffee.accent, fontSize: 10, fontWeight: '800' }}>
                    🤝 2 vs 2 • {(item as any).config?.gaplehRuleset === 'tournament' ? 'Preset Turnamen' : 'Gaya Kampung'}
                  </Text>
                </View>
              </View>
            )}
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
          {hasBots ? (
            <>
              <TouchableOpacity
                style={styles.joinBtn}
                onPress={() => handleJoinPress(item)}
              >
                <Ionicons name="enter-outline" size={16} color={coffee.buttonText} />
                <Text style={styles.joinBtnText}>
                  {isHost ? 'Masuk Kembali' : 'Gabung (Ganti Bot 🤖)'}
                </Text>
              </TouchableOpacity>
              {isPlaying && (
                <TouchableOpacity
                  style={styles.spectateBtn}
                  onPress={() => handleSpectatePress(item.id)}
                >
                  <Ionicons name="eye-outline" size={16} color={coffee.text} />
                  <Text style={styles.spectateBtnText}>Tonton</Text>
                </TouchableOpacity>
              )}
            </>
          ) : isPlaying || isFull ? (
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
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Header - Row 1: Brand & Primary Actions */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            router.replace('/(main)/warkop' as any);
          }}
          accessibilityLabel="Kembali ke Warung Kopi"
        >
          <Ionicons name="arrow-back" size={22} color={coffee.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>Meja Warkop ☕🎮</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Nongkrong, Ngopi, dan Main Bareng
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={onRefresh}
          accessibilityLabel="Refresh daftar meja"
        >
          <Ionicons name="refresh" size={18} color={coffee.text} />
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
          <Text style={styles.createHeaderBtnText}>+ Buat Meja</Text>
        </TouchableOpacity>
      </View>

      {/* Feature Navigation Pills - Row 2: Prominent & Scrollable */}
      <View style={styles.featurePillsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.featurePillsScroll}
        >
          <TouchableOpacity
            style={[styles.featurePill, { backgroundColor: 'rgba(217, 119, 6, 0.2)', borderColor: '#f59e0b' }]}
            onPress={() => setLeaderboardVisible(true)}
          >
            <Ionicons name="trophy" size={16} color="#fbbf24" />
            <Text style={[styles.featurePillText, { color: '#fef08a' }]}>Klasemen Warkop 🏆</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.featurePill, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: '#f59e0b' }]}
            onPress={() => setPointsHubVisible(true)}
          >
            <Text style={{ fontSize: 14 }}>🪙</Text>
            <Text style={[styles.featurePillText, { color: '#fde68a' }]}>Poin & BaMbooChain</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.featurePill, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: '#3b82f6' }]}
            onPress={() => setEventModalVisible(true)}
          >
            <Ionicons name="calendar" size={15} color="#60a5fa" />
            <Text style={[styles.featurePillText, { color: '#bfdbfe' }]}>Agenda Mabar 📅</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.featurePill, { backgroundColor: 'rgba(234, 179, 8, 0.15)', borderColor: '#eab308' }]}
            onPress={() => setChessProModalVisible(true)}
          >
            <MaterialCommunityIcons name="chess-king" size={15} color="#eab308" />
            <Text style={[styles.featurePillText, { color: '#fef08a' }]}>Catur Pro (9 Bot) 🏆</Text>
          </TouchableOpacity>
        </ScrollView>
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
            Mau langsung main {selectedTab === 'gapleh' ? (gaplehLevel === 2 ? 'GAPLEH RAME (Lvl 2)' : 'GAPLEH KLASIK (Lvl 1)') : selectedTab.toUpperCase()}?
          </Text>
          <Text style={styles.quickBannerSub}>
            {selectedTab === 'gapleh' && gaplehLevel === 2
              ? 'Wajib 4 pemain, otomatis ditemani 3 bot karakter pilihan!'
              : 'Buat meja instan lengkap dengan Bot cerdas siap tanding!'}
          </Text>
          {selectedTab === 'gapleh' && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
              <TouchableOpacity
                style={[
                  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
                  gaplehLevel === 1
                    ? { backgroundColor: coffee.accent, borderColor: coffee.accent }
                    : { backgroundColor: 'rgba(212, 163, 115, 0.15)', borderColor: coffee.border },
                ]}
                onPress={() => setGaplehLevel(1)}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: gaplehLevel === 1 ? coffee.buttonText : coffee.text }}>
                  ☕ Level 1 (Klasik)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
                  gaplehLevel === 2
                    ? { backgroundColor: '#ea580c', borderColor: '#ea580c' }
                    : { backgroundColor: 'rgba(234, 88, 12, 0.15)', borderColor: '#c2410c' },
                ]}
                onPress={() => setGaplehLevel(2)}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: gaplehLevel === 2 ? '#ffffff' : '#fb923c' }}>
                  🔥 Level 2 (Rame 4 Pemain)
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {selectedTab === 'catur' && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={[
                  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
                  chessMode === 'basic'
                    ? { backgroundColor: coffee.accent, borderColor: coffee.accent }
                    : { backgroundColor: 'rgba(212, 163, 115, 0.15)', borderColor: coffee.border },
                ]}
                onPress={() => setChessMode('basic')}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: chessMode === 'basic' ? coffee.buttonText : coffee.text }}>
                  ♟️ Catur Basic (Santai)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
                  chessMode === 'pro'
                    ? { backgroundColor: '#eab308', borderColor: '#eab308' }
                    : { backgroundColor: 'rgba(234, 179, 8, 0.15)', borderColor: '#ca8a04' },
                ]}
                onPress={() => {
                  setChessMode('pro');
                  setChessProModalVisible(true);
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: chessMode === 'pro' ? '#1e293b' : '#fef08a' }}>
                  🏆 Catur Pro (Kompetisi 9 Bot)
                </Text>
              </TouchableOpacity>
            </View>
          )}
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

      {selectedTab === 'pokemon' && (
        <View style={{ marginHorizontal: 16, marginBottom: 10 }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              backgroundColor: '#3b1c11',
              borderColor: '#f59e0b',
              borderWidth: 1,
              borderRadius: 10,
              paddingVertical: 10,
            }}
            onPress={() => setPokemonHubVisible(true)}
          >
            <Text style={{ fontSize: 16 }}>🎴</Text>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
              Buka Binder Koleksi & Booster Pack (Gacha) ✨
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {selectedTab === 'catur' && (
        <View style={{ marginHorizontal: 16, marginBottom: 10 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#26170d',
              borderColor: '#eab308',
              borderWidth: 1.5,
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
            }}
            onPress={() => setChessProModalVisible(true)}
          >
            <View style={{ flex: 1, paddingRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <MaterialCommunityIcons name="chess-king" size={18} color="#eab308" />
                <Text style={{ color: '#fef08a', fontWeight: '900', fontSize: 13, letterSpacing: 0.3 }}>
                  CATUR PROFESIONAL (STOCKFISH 19)
                </Text>
              </View>
              <Text style={{ color: coffee.secondary, fontSize: 11, lineHeight: 15 }}>
                Tantang 9 Bot (Tonah s/d Messi) dalam kompetisi adu strategi poin! Saldo 0 atau minus tetap bisa tanding.
              </Text>
            </View>
            <View style={{ backgroundColor: '#eab308', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
              <Text style={{ color: '#1e293b', fontWeight: '900', fontSize: 11 }}>TANTANG ⚔️</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

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
          <View style={styles.modalCardScrollable}>
            <View style={styles.modalHeaderPinned}>
              <Text style={styles.modalTitle}>Buka Meja Warkop Baru</Text>
              <TouchableOpacity
                onPress={() => setCreateModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={coffee.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 18, gap: 14 }}
              showsVerticalScrollIndicator={true}
            >
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

              {selectedTab !== 'catur' && (
                <View>
                  <Text style={styles.inputLabel}>Jumlah Maksimal Pemain</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {[2, 3, 4].map((num) => {
                      const isLocked4 = selectedTab === 'gapleh' && (gaplehLevel === 2 || gaplehMode === 'partnership');
                      return (
                        <TouchableOpacity
                          key={num}
                          style={[
                            styles.numberOption,
                            (isLocked4 ? num === 4 : maxPlayers === num) && styles.numberOptionActive,
                            isLocked4 && num !== 4 && { opacity: 0.4 },
                          ]}
                          disabled={isLocked4}
                          onPress={() => setMaxPlayers(num)}
                        >
                          <Text
                            style={[
                              styles.numberOptionText,
                              (isLocked4 ? num === 4 : maxPlayers === num) && styles.numberOptionTextActive,
                            ]}
                          >
                            {num} Pemain
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {selectedTab === 'gapleh' && gaplehLevel === 2 && (
                    <Text style={{ color: '#fb923c', fontSize: 11, marginTop: 4 }}>
                      *Level 2 (Gapleh Rame) wajib 4 pemain: 28 kartu dibagikan habis (7 kartu/orang).
                    </Text>
                  )}
                  {selectedTab === 'gapleh' && gaplehLevel === 1 && gaplehMode === 'partnership' && (
                    <Text style={{ color: coffee.secondary, fontSize: 11, marginTop: 4 }}>
                      *Mode berpasangan wajib 4 pemain (2 vs 2: Tim A vs Tim B).
                    </Text>
                  )}
                </View>
              )}

              {/* Gapleh Level, Mode & Bot Selection */}
              {selectedTab === 'gapleh' && (
                <View style={{ gap: 12, backgroundColor: '#241a12', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: coffee.border }}>
                  {/* Level Selection (Task 2) */}
                  <View>
                    <Text style={styles.inputLabel}>Level Game Gapleh</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={[styles.numberOption, gaplehLevel === 1 && styles.numberOptionActive]}
                        onPress={() => setGaplehLevel(1)}
                      >
                        <Text style={[styles.numberOptionText, gaplehLevel === 1 && styles.numberOptionTextActive]}>
                          ☕ Level 1 (Klasik)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.numberOption,
                          gaplehLevel === 2 && { backgroundColor: '#ea580c', borderColor: '#f97316' },
                        ]}
                        onPress={() => {
                          setGaplehLevel(2);
                          setMaxPlayers(4);
                        }}
                      >
                        <Text
                          style={[
                            styles.numberOptionText,
                            gaplehLevel === 2 ? { color: '#ffffff', fontWeight: '800' } : { color: coffee.secondary },
                          ]}
                        >
                          🔥 Level 2 (Rame - 4 Pemain)
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{ color: coffee.secondary, fontSize: 11, marginTop: 4 }}>
                      {gaplehLevel === 1
                        ? 'Level 1: Sistem gapleh klasik yang sudah berjalan di ngopi.top (2-4 pemain). Cocok untuk pemula.'
                        : 'Level 2: Mode 4 orang sekaligus dengan aturan v3 (nutup 500 poin, digapleh 75 poin, pilihan bot karakter).'}
                    </Text>
                  </View>

                  {/* Bot Selection List for Level 2 (Task 2.2) */}
                  {gaplehLevel === 2 && (
                    <View style={{ backgroundColor: '#1a120c', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(249, 115, 22, 0.4)', gap: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ color: '#fed7aa', fontWeight: '800', fontSize: 12 }}>
                          🤖 Pilih Lawan Bot (1 - 3 Bot)
                        </Text>
                        <Text style={{ color: '#fb923c', fontSize: 11, fontWeight: '800' }}>
                          {selectedBotIds.length}/3 Terpilih
                        </Text>
                      </View>
                      <Text style={{ color: coffee.muted, fontSize: 10 }}>
                        Pilih 1 hingga 3 bot dengan nama karakter untuk mengisi kursi meja. Sisa kursi kosong dapat diisi pemain lain.
                      </Text>
                      <View style={{ gap: 6 }}>
                        {GAPLEH_BOTS.map((bot) => {
                          const isSelected = selectedBotIds.includes(bot.id);
                          return (
                            <TouchableOpacity
                              key={bot.id}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 8,
                                paddingHorizontal: 10,
                                backgroundColor: isSelected ? 'rgba(234, 88, 12, 0.15)' : '#231810',
                                borderRadius: 6,
                                borderWidth: 1,
                                borderColor: isSelected ? '#ea580c' : '#3d2b1f',
                                gap: 10,
                              }}
                              onPress={() => {
                                if (isSelected) {
                                  setSelectedBotIds((prev) => prev.filter((id) => id !== bot.id));
                                } else {
                                  if (selectedBotIds.length >= 3) {
                                    Alert.alert('Batas Bot', 'Maksimal memilih 3 bot (1 kursi untuk Anda).');
                                    return;
                                  }
                                  setSelectedBotIds((prev) => [...prev, bot.id]);
                                }
                              }}
                            >
                              <Ionicons
                                name={isSelected ? 'checkbox' : 'square-outline'}
                                size={18}
                                color={isSelected ? '#f97316' : coffee.secondary}
                              />
                              <Text style={{ fontSize: 16 }}>{bot.avatar}</Text>
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={{ color: coffee.text, fontWeight: '700', fontSize: 12 }}>
                                    {bot.name} ({bot.title})
                                  </Text>
                                  <View style={{ backgroundColor: 'rgba(212, 163, 115, 0.2)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 }}>
                                    <Text style={{ color: coffee.accent, fontSize: 9, fontWeight: '700' }}>{bot.difficulty}</Text>
                                  </View>
                                </View>
                                <Text style={{ color: coffee.secondary, fontSize: 10 }}>{bot.personality}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  <View>
                    <Text style={styles.inputLabel}>Mode Permainan Gapleh</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={[styles.numberOption, gaplehMode === 'individual' && styles.numberOptionActive]}
                        onPress={() => {
                          setGaplehMode('individual');
                          setMaxPlayers(4);
                        }}
                      >
                        <Text style={[styles.numberOptionText, gaplehMode === 'individual' && styles.numberOptionTextActive]}>
                          👤 Individu (4 Pemain)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.numberOption, gaplehMode === 'partnership' && styles.numberOptionActive]}
                        onPress={() => {
                          setGaplehMode('partnership');
                          setMaxPlayers(4);
                        }}
                      >
                        <Text style={[styles.numberOptionText, gaplehMode === 'partnership' && styles.numberOptionTextActive]}>
                          🤝 Berpasangan (2 vs 2)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {gaplehMode === 'partnership' && (
                    <>
                      <View>
                        <Text style={styles.inputLabel}>Gaya Permainan (Ruleset)</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                          <TouchableOpacity
                            style={[styles.numberOption, gaplehRuleset === 'kampung' && styles.numberOptionActive]}
                            onPress={() => setGaplehRuleset('kampung')}
                          >
                            <Text style={[styles.numberOptionText, gaplehRuleset === 'kampung' && styles.numberOptionTextActive]}>
                              🏘️ Gaya Kampung
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.numberOption, gaplehRuleset === 'tournament' && styles.numberOptionActive]}
                            onPress={() => setGaplehRuleset('tournament')}
                          >
                            <Text style={[styles.numberOptionText, gaplehRuleset === 'tournament' && styles.numberOptionTextActive]}>
                              🏆 Preset Turnamen Ngopi
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {gaplehRuleset === 'tournament' && (
                        <View>
                          <Text style={styles.inputLabel}>Target Skor Turnamen</Text>
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                            {[100, 150, 200, 250].map((score) => (
                              <TouchableOpacity
                                key={score}
                                style={[styles.numberOption, targetScore === score && styles.numberOptionActive]}
                                onPress={() => setTargetScore(score)}
                              >
                                <Text style={[styles.numberOptionText, targetScore === score && styles.numberOptionTextActive]}>
                                  {score} {score === 250 ? '★' : ''}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      )}

                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
                        onPress={() => setGaplehRulesModalVisible(true)}
                      >
                        <Ionicons name="information-circle" size={16} color={coffee.accent} />
                        <Text style={{ color: coffee.accent, fontSize: 12, fontWeight: '700' }}>
                          Lihat Ringkasan Aturan {gaplehRuleset === 'tournament' ? 'Preset Turnamen Ngopi' : 'Gaya Kampung'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {selectedTab === 'catur' && (
                <View style={{ gap: 12, backgroundColor: '#241a12', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: coffee.border }}>
                  <View>
                    <Text style={styles.inputLabel}>Pilihan Warna Bidak Anda</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={[styles.numberOption, chessColor === 'white' && styles.numberOptionActive]}
                        onPress={() => setChessColor('white')}
                      >
                        <Text style={[styles.numberOptionText, chessColor === 'white' && styles.numberOptionTextActive]}>
                          ⚪ Putih (Dulu)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.numberOption, chessColor === 'black' && styles.numberOptionActive]}
                        onPress={() => setChessColor('black')}
                      >
                        <Text style={[styles.numberOptionText, chessColor === 'black' && styles.numberOptionTextActive]}>
                          ⚫ Hitam
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.numberOption, chessColor === 'random' && styles.numberOptionActive]}
                        onPress={() => setChessColor('random')}
                      >
                        <Text style={[styles.numberOptionText, chessColor === 'random' && styles.numberOptionTextActive]}>
                          🎲 Acak
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View>
                    <Text style={styles.inputLabel}>Tingkat Kesulitan Bot Lawan</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={[styles.numberOption, botDifficulty === 'easy' && styles.numberOptionActive]}
                        onPress={() => setBotDifficulty('easy')}
                      >
                        <Text style={[styles.numberOptionText, botDifficulty === 'easy' && styles.numberOptionTextActive]}>
                          🌱 Pemula (+15)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.numberOption, botDifficulty === 'medium' && styles.numberOptionActive]}
                        onPress={() => setBotDifficulty('medium')}
                      >
                        <Text style={[styles.numberOptionText, botDifficulty === 'medium' && styles.numberOptionTextActive]}>
                          ⚔️ Menengah (+35)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.numberOption, botDifficulty === 'hard' && styles.numberOptionActive]}
                        onPress={() => setBotDifficulty('hard')}
                      >
                        <Text style={[styles.numberOptionText, botDifficulty === 'hard' && styles.numberOptionTextActive]}>
                          👑 Master (+60)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

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
            </ScrollView>

            <View style={styles.modalFooterPinned}>
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
            </View>
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

      {/* Gapleh Rules Explanation Modal */}
      <Modal
        visible={gaplehRulesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGaplehRulesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCardScrollable}>
            <View style={styles.modalHeaderPinned}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>📖 Aturan Gapleh Berpasangan</Text>
                <Text style={styles.modalSub}>Sistem 2 vs 2: Tim A vs Tim B</Text>
              </View>
              <TouchableOpacity
                onPress={() => setGaplehRulesModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={coffee.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 18, gap: 14 }}
              showsVerticalScrollIndicator={true}
            >
              {/* Seating Order */}
              <View style={{ backgroundColor: '#241a12', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: coffee.border }}>
                <Text style={{ color: coffee.accent, fontWeight: '800', fontSize: 13, marginBottom: 4 }}>
                  🪑 Posisi Duduk & Giliran Berselang-seling
                </Text>
                <Text style={{ color: coffee.text, fontSize: 12, lineHeight: 18 }}>
                  • Kursi 1: Tim A (A1) {'\n'}
                  • Kursi 2: Tim B (B1) {'\n'}
                  • Kursi 3: Tim A (A2) — Rekan Tim A {'\n'}
                  • Kursi 4: Tim B (B2) — Rekan Tim B {'\n'}
                  Urutan giliran memutar teratur: A1 ➔ B1 ➔ A2 ➔ B2.
                </Text>
              </View>

              {/* Gaya Kampung */}
              <View style={{ backgroundColor: '#241a12', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: coffee.border }}>
                <Text style={{ color: coffee.accent, fontWeight: '800', fontSize: 13, marginBottom: 4 }}>
                  🏘️ Gaya Kampung (Preset Kampung Ngopi)
                </Text>
                <Text style={{ color: coffee.text, fontSize: 12, lineHeight: 18 }}>
                  1. <Text style={{ fontWeight: 'bold' }}>Batu Habis:</Text> Tim yang anggotanya menghabiskan batu langsung menang putaran. Kedua anggota tim masing-masing mendapatkan <Text style={{ color: coffee.accent, fontWeight: 'bold' }}>+50 poin</Text>.{'\n'}
                  2. <Text style={{ fontWeight: 'bold' }}>Gaple Buntu:</Text> Total mata sisa kedua anggota dijumlahkan per tim. Tim dengan mata terendah menang (+50 poin per anggota).{'\n'}
                  3. <Text style={{ fontWeight: 'bold' }}>Seri:</Text> Jika total mata kedua tim sama persis saat buntu, putaran seri (0 poin).
                </Text>
              </View>

              {/* Preset Turnamen Ngopi */}
              <View style={{ backgroundColor: '#241a12', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: coffee.border }}>
                <Text style={{ color: coffee.accent, fontWeight: '800', fontSize: 13, marginBottom: 4 }}>
                  🏆 Preset Turnamen Ngopi (Akumulasi Target)
                </Text>
                <Text style={{ color: coffee.text, fontSize: 12, lineHeight: 18 }}>
                  1. Pertandingan dimainkan dalam putaran akumulasi hingga mencapai target skor (bawaan: 250 poin).{'\n'}
                  2. <Text style={{ fontWeight: 'bold' }}>Nilai Putaran (Batu Habis):</Text> Tim pemenang putaran memperoleh nilai sebesar <Text style={{ color: coffee.accent, fontWeight: 'bold' }}>total mata sisa tim lawan</Text>.{'\n'}
                  3. <Text style={{ fontWeight: 'bold' }}>Nilai Putaran (Buntu):</Text> Tim dengan mata sisa terendah memperoleh nilai sebesar <Text style={{ color: coffee.accent, fontWeight: 'bold' }}>selisih mata lawan dikurangi mata sendiri</Text> (Mata Lawan - Mata Pemenang).{'\n'}
                  4. <Text style={{ fontWeight: 'bold' }}>Buntu Seri:</Text> Nilai putaran 0.{'\n'}
                  5. Tim pertama yang mencapai target skor memenangkan pertandingan (+50 poin juara).
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooterPinned}>
              <TouchableOpacity
                style={styles.submitCreateBtn}
                onPress={() => setGaplehRulesModalVisible(false)}
              >
                <Text style={styles.submitCreateBtnText}>Paham & Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Leaderboard Modal */}
      <LeaderboardModal
        visible={leaderboardVisible}
        onClose={() => setLeaderboardVisible(false)}
        initialTab="gapleh"
      />

      {/* Pokemon Hub Modal */}
      <PokemonHubModal
        visible={pokemonHubVisible}
        onClose={() => setPokemonHubVisible(false)}
        onStartBattle={() => {
          setPokemonHubVisible(false);
          setSelectedTab('pokemon');
          handleQuickMatch();
        }}
      />

      {/* Game Event Modal */}
      <GameEventModal
        visible={eventModalVisible}
        onClose={() => setEventModalVisible(false)}
        onEventStarted={(tableId) => {
          setEventModalVisible(false);
          router.push({ pathname: '/(main)/games/[id]' as any, params: { id: tableId } });
        }}
      />

      {/* Points & BMC Economy Modal */}
      <PointsHubModal
        visible={pointsHubVisible}
        onClose={() => setPointsHubVisible(false)}
      />

      {/* Chess Pro Arena Modal */}
      <ChessProArenaModal
        visible={chessProModalVisible}
        onClose={() => setChessProModalVisible(false)}
      />
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
  featurePillsRow: {
    backgroundColor: coffee.surface,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    paddingVertical: 8,
  },
  featurePillsScroll: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  featurePillText: {
    fontSize: 12,
    fontWeight: '700',
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
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: coffee.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  modalCardScrollable: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: coffee.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: coffee.border,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeaderPinned: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    backgroundColor: coffee.surface,
  },
  modalFooterPinned: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: coffee.border,
    backgroundColor: coffee.surface,
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
  modalSub: {
    color: coffee.secondary,
    fontSize: 12,
    marginTop: 2,
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
