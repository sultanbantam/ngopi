import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import { coffee } from '../../../src/theme/coffee';
import { DominoTile } from '../../../src/components/DominoTile';
import GaplehShareModal from '../../../src/components/GaplehShareModal';
import axios from 'axios';
import { getAuthHeaders } from '../../../src/utils/api';
import * as SecureStore from '../../../src/utils/storage';

const SOCKET_URL = 'https://api.ngopi.top/games';
const API_URL = 'https://api.ngopi.top/api';

const QUICK_EMOTES = ['☕', '👏', '😂', '🔥', '💩', '😎'];

const SUIT_META: Record<string, { symbol: string; color: string; label: string }> = {
  spades: { symbol: '♠', color: '#111827', label: 'Sekop' },
  hearts: { symbol: '♥', color: '#dc2626', label: 'Hati' },
  diamonds: { symbol: '♦', color: '#dc2626', label: 'Wajik' },
  clubs: { symbol: '♣', color: '#111827', label: 'Keriting' },
};

const CHESS_UNICODE: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

const UNO_COLOR_MAP: Record<string, { bg: string; border: string; text: string; label: string }> = {
  red: { bg: '#ef4444', border: '#b91c1c', text: '#ffffff', label: 'Merah' },
  yellow: { bg: '#eab308', border: '#a16207', text: '#1e293b', label: 'Kuning' },
  green: { bg: '#22c55e', border: '#15803d', text: '#ffffff', label: 'Hijau' },
  blue: { bg: '#3b82f6', border: '#1d4ed8', text: '#ffffff', label: 'Biru' },
  wild: { bg: '#8b5cf6', border: '#6d28d9', text: '#ffffff', label: 'Wild' },
};

const UNO_VALUE_LABEL: Record<string, string> = {
  skip: '🚫',
  reverse: '🔁',
  draw2: '+2',
  wild: '🌈',
  wild4: '+4',
};

const MONOPOLY_GROUP_COLORS: Record<string, string> = {
  brown: '#8d6e63',
  light_blue: '#38bdf8',
  pink: '#f472b6',
  orange: '#fb923c',
  red: '#ef4444',
  yellow: '#facc15',
  dark_blue: '#1d4ed8',
  station: '#64748b',
  utility: '#eab308',
};

const GAPLEH_BOTS: Array<{
  id: string;
  name: string;
  title: string;
  personality: string;
  difficulty: string;
  avatar: string;
}> = [
  { id: 'gapleh_2_budi', name: 'Gelideg', title: 'Kelas Bulu', personality: 'Pemalu, sering salah', difficulty: 'Pemula', avatar: '🐣' },
  { id: 'gapleh_2_asep', name: 'Mangmad', title: 'Kelas Warung', personality: 'Ramah, main santai', difficulty: 'Kasual', avatar: '☕' },
  { id: 'gapleh_2_rudi', name: 'Mangsante', title: 'Kelas Kampung', personality: 'Serius, kadang blunder', difficulty: 'Menengah', avatar: '🧢' },
  { id: 'gapleh_2_deni', name: 'Hamlihi', title: 'Kelas Kota', personality: 'Cerdas, sering jebakan', difficulty: 'Mahir', avatar: '🕶️' },
  { id: 'gapleh_2_jago', name: 'Sodung', title: 'Kelas Jagal', personality: 'Agresif, susah ditebak', difficulty: 'Expert', avatar: '🔥' },
  { id: 'gapleh_2_maestro', name: 'Daman', title: 'Kelas Dunia', personality: 'Tenang, mematikan', difficulty: 'Juara', avatar: '👑' },
];

function UnoCardTile({
  card,
  onPress,
  disabled,
  highlight,
  size = 'normal',
}: {
  card: { id?: string; color: string; value: string };
  onPress?: () => void;
  disabled?: boolean;
  highlight?: boolean;
  size?: 'normal' | 'small' | 'large';
}) {
  const meta = UNO_COLOR_MAP[card?.color] || UNO_COLOR_MAP.wild!;
  const displayVal = UNO_VALUE_LABEL[card?.value] || card?.value || '?';
  const width = size === 'large' ? 56 : size === 'small' ? 36 : 46;
  const height = size === 'large' ? 82 : size === 'small' ? 52 : 68;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={[
        {
          width,
          height,
          backgroundColor: meta.bg,
          borderColor: highlight ? '#fef08a' : meta.border,
          borderWidth: highlight ? 3 : 1.5,
          borderRadius: 8,
          padding: 4,
          justifyContent: 'space-between',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 3,
        },
        disabled && { opacity: 0.5 },
      ]}
    >
      <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-start' }}>
        <Text style={{ fontSize: size === 'large' ? 12 : 10, fontWeight: '900', color: meta.text }}>
          {displayVal}
        </Text>
      </View>
      <Text style={{ fontSize: size === 'large' ? 24 : 18, fontWeight: '900', color: meta.text }}>
        {displayVal}
      </Text>
      <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Text style={{ fontSize: size === 'large' ? 12 : 10, fontWeight: '900', color: meta.text }}>
          {displayVal}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function PlayingCardTile({
  card,
  onPress,
  disabled,
  highlight,
  size = 'normal',
  isFaceDown = false,
}: {
  card?: { suit: string; rank: string };
  onPress?: () => void;
  disabled?: boolean;
  highlight?: boolean;
  size?: 'normal' | 'small' | 'large';
  isFaceDown?: boolean;
}) {
  const meta = card ? SUIT_META[card.suit] || { symbol: '♠', color: '#111827', label: '' } : { symbol: '?', color: '#111827', label: '' };
  const isLarge = size === 'large';
  const isSmall = size === 'small';

  const width = isLarge ? 56 : isSmall ? 36 : 46;
  const height = isLarge ? 80 : isSmall ? 52 : 66;

  if (isFaceDown) {
    return (
      <View
        style={[
          {
            width,
            height,
            backgroundColor: '#451a03',
            borderRadius: 6,
            padding: 4,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: '#b45309',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 3,
            elevation: 3,
          },
          highlight && { borderColor: coffee.accent, borderWidth: 2 },
        ]}
      >
        <Text style={{ fontSize: isLarge ? 24 : isSmall ? 15 : 18 }}>🂠</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={[
        {
          width,
          height,
          backgroundColor: '#fffdfa',
          borderRadius: 6,
          padding: 4,
          justifyContent: 'space-between',
          alignItems: 'center',
          borderWidth: highlight ? 2 : 1,
          borderColor: highlight ? coffee.accent : '#d4bda4',
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 3,
          elevation: 2,
        },
        disabled && { opacity: 0.7 },
      ]}
    >
      <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-start' }}>
        <Text style={{ fontSize: isLarge ? 13 : isSmall ? 9 : 11, fontWeight: 'bold', color: meta.color }}>
          {card?.rank}
        </Text>
      </View>
      <Text style={{ fontSize: isLarge ? 24 : isSmall ? 15 : 18, color: meta.color, marginTop: -2 }}>
        {meta.symbol}
      </Text>
      <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Text style={{ fontSize: isLarge ? 11 : isSmall ? 8 : 9, color: meta.color }}>
          {meta.symbol}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function GameTableScreen() {
  const { id: tableId, spectate } = useLocalSearchParams<{ id: string; spectate?: string }>();
  const { width } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [table, setTable] = useState<any>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [isSpectator, setIsSpectator] = useState<boolean>(spectate === '1');
  const [selectedChessSquare, setSelectedChessSquare] = useState<{ row: number; col: number } | null>(null);

  // Socket
  const socketRef = useRef<Socket | null>(null);

  // Social & UI states
  const [chatVisible, setChatVisible] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [floatingEmotes, setFloatingEmotes] = useState<Array<{ id: string; emote: string; sender: string }>>([]);
  const [isMuted, setIsMuted] = useState(false);

  // Card placement choice modal (if card matches both left and right end)
  const [pendingCard, setPendingCard] = useState<[number, number] | null>(null);
  const [pendingSides, setPendingSides] = useState<Array<'left' | 'right'>>([]);

  // Result modal
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [gameResult, setGameResult] = useState<any>(null);
  const [botPickerVisible, setBotPickerVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  // UNO and Catur specialized states
  const [wildPickerCard, setWildPickerCard] = useState<any | null>(null);
  const [flipChessBoard, setFlipChessBoard] = useState(false);

  // Action: UNO Play Card
  const handleUnoCardPress = (card: any) => {
    if (!isMyTurn) {
      Alert.alert('Perhatian', 'Bukan giliran Anda!');
      return;
    }
    if (card.color === 'wild') {
      setWildPickerCard(card);
    } else {
      executePlayUnoCard(card.id);
    }
  };

  const executePlayUnoCard = (cardId: string, chosenColor?: string) => {
    if (!socketRef.current || !tableId) return;
    socketRef.current.emit(
      'game:action',
      {
        tableId,
        action: 'play',
        payload: { cardId, chosenColor },
      },
      (res: any) => {
        if (!res?.success) {
          Alert.alert('Langkah Gagal', res?.error || 'Kartu tidak cocok dengan warna atau angka di meja.');
        }
      }
    );
  };

  const handleUnoDraw = () => {
    if (!isMyTurn || !socketRef.current || !tableId) return;
    socketRef.current.emit('game:action', { tableId, action: 'draw', payload: {} });
  };

  const handleUnoShout = () => {
    if (!socketRef.current || !tableId) return;
    socketRef.current.emit('game:action', { tableId, action: 'uno', payload: {} });
  };

  const handleCatchUno = (targetUserId: string) => {
    if (!socketRef.current || !tableId) return;
    socketRef.current.emit(
      'game:action',
      {
        tableId,
        action: 'catch_uno',
        payload: { targetUserId },
      },
      (res: any) => {
        if (!res?.success) {
          Alert.alert('Info', res?.error || 'Pemain sudah panggil UNO.');
        }
      }
    );
  };

  // Snake & Ladder Action: Roll Dice
  const handleSnakeLadderRoll = () => {
    if (!isMyTurn || !socketRef.current || !tableId) return;
    socketRef.current.emit('game:action', { tableId, action: 'roll', payload: {} }, (res: any) => {
      if (!res?.success) {
        Alert.alert('Gagal', res?.error || 'Tidak dapat melempar dadu.');
      }
    });
  };

  // Monopoly Actions
  const handleMonopolyRoll = () => {
    if (!isMyTurn || !socketRef.current || !tableId) return;
    socketRef.current.emit('game:action', { tableId, action: 'roll', payload: {} }, (res: any) => {
      if (!res?.success) {
        Alert.alert('Gagal', res?.error || 'Tidak dapat melempar dadu.');
      }
    });
  };

  const handleMonopolyBuyProperty = () => {
    if (!isMyTurn || !socketRef.current || !tableId) return;
    socketRef.current.emit('game:action', { tableId, action: 'buy_property', payload: {} }, (res: any) => {
      if (!res?.success) {
        Alert.alert('Gagal Beli', res?.error || 'Tidak dapat membeli properti.');
      }
    });
  };

  const handleMonopolySkipBuy = () => {
    if (!isMyTurn || !socketRef.current || !tableId) return;
    socketRef.current.emit('game:action', { tableId, action: 'skip_buy', payload: {} });
  };

  const handleMonopolyBuildHouse = (squareId: number) => {
    if (!isMyTurn || !socketRef.current || !tableId) return;
    socketRef.current.emit('game:action', { tableId, action: 'build_house', payload: { squareId } }, (res: any) => {
      if (!res?.success) {
        Alert.alert('Gagal Bangun', res?.error || 'Tidak dapat membangun rumah.');
      }
    });
  };

  const handleMonopolyPayJailFine = () => {
    if (!isMyTurn || !socketRef.current || !tableId) return;
    socketRef.current.emit('game:action', { tableId, action: 'pay_jail_fine', payload: {} }, (res: any) => {
      if (!res?.success) {
        Alert.alert('Gagal', res?.error || 'Gagal membayar denda penjara.');
      }
    });
  };

  const handleMonopolyUseJailCard = () => {
    if (!isMyTurn || !socketRef.current || !tableId) return;
    socketRef.current.emit('game:action', { tableId, action: 'use_jail_card', payload: {} });
  };

  const handleMonopolyEndTurn = () => {
    if (!isMyTurn || !socketRef.current || !tableId) return;
    socketRef.current.emit('game:action', { tableId, action: 'end_turn', payload: {} }, (res: any) => {
      if (!res?.success) {
        Alert.alert('Info', res?.error || 'Gagal mengakhiri giliran.');
      }
    });
  };

  // Pokemon Battle Actions
  const handlePokemonAttack = (isSkill = false) => {
    if (!isMyTurn || !socketRef.current || !tableId) return;
    socketRef.current.emit(
      'game:action',
      {
        tableId,
        action: isSkill ? 'skill' : 'attack',
        payload: {},
      },
      (res: any) => {
        if (!res?.success) {
          Alert.alert('Langkah Gagal', res?.error || 'Gagal melancarkan serangan.');
        }
      }
    );
  };

  const handlePokemonSwitch = (index: number) => {
    if (!isMyTurn || !socketRef.current || !tableId) return;
    socketRef.current.emit(
      'game:action',
      {
        tableId,
        action: 'switch',
        payload: { index },
      },
      (res: any) => {
        if (!res?.success) {
          Alert.alert('Gagal Ganti', res?.error || 'Gagal mengganti monster.');
        }
      }
    );
  };

  const renderMonopolyTile = (sqId: number) => {
    const sq = gameState?.squares?.[sqId] || { name: `Kotak ${sqId}`, type: 'property' };
    const prop = gameState?.properties?.[sqId];
    const stripeColor = MONOPOLY_GROUP_COLORS[sq?.group || ''] || 'transparent';
    const cellPlayers = Object.values(gameState?.players || {}).filter(
      (p: any) => p.position === sqId && !p.isBankrupt
    );
    const owner = prop?.ownerId ? table.players?.find((p: any) => p.user_id === prop.ownerId) : null;
    const isSpecial = sq.type === 'start' || sq.type === 'jail' || sq.type === 'go_to_jail' || sq.type === 'free_parking';

    let displayIcon = '';
    if (sq.type === 'start') displayIcon = '🚩';
    else if (sq.type === 'jail') displayIcon = '🔒';
    else if (sq.type === 'go_to_jail') displayIcon = '👮';
    else if (sq.type === 'free_parking') displayIcon = '🅿️';
    else if (sq.type === 'chance') displayIcon = '❓';
    else if (sq.type === 'community') displayIcon = '🎁';
    else if (sq.type === 'station') displayIcon = '🚆';
    else if (sq.type === 'utility') displayIcon = '⚡';
    else if (sq.type === 'tax') displayIcon = '💸';

    return (
      <View
        key={sqId}
        style={{
          flex: 1,
          backgroundColor: isSpecial ? '#2e1c12' : '#23150d',
          borderRadius: 4,
          borderWidth: 0.5,
          borderColor: '#4d301d',
          overflow: 'hidden',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 1,
        }}
      >
        {stripeColor !== 'transparent' && (
          <View style={{ width: '100%', height: 4, backgroundColor: stripeColor }} />
        )}

        <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          {displayIcon ? (
            <Text style={{ fontSize: 9 }}>{displayIcon}</Text>
          ) : (
            <Text numberOfLines={1} style={{ fontSize: 7, color: '#f3e8dc', fontWeight: '700', textAlign: 'center' }}>
              {sq.name}
            </Text>
          )}

          {sq.price && (
            <Text style={{ fontSize: 6.5, color: '#94a3b8' }}>
              {prop?.houses >= 5 ? '🏨' : prop?.houses > 0 ? `🏠${prop.houses}` : `Rp${sq.price}`}
            </Text>
          )}

          {owner && (
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                backgroundColor: owner.user_id === currentUserId ? '#38bdf8' : '#f59e0b',
                marginTop: 1,
              }}
            />
          )}
        </View>

        {cellPlayers.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 1, justifyContent: 'center', flexWrap: 'wrap', paddingBottom: 1 }}>
            {cellPlayers.map((cp: any, idx: number) => (
              <View
                key={idx}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 3.5,
                  backgroundColor: cp.userId === currentUserId ? '#38bdf8' : idx === 1 ? '#ef4444' : '#22c55e',
                  borderWidth: 0.5,
                  borderColor: '#ffffff',
                }}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  // Load User Info
  const loadUser = async () => {
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

  // Fetch initial table state via REST
  const fetchTableState = useCallback(async () => {
    if (!tableId) return;
    try {
      const headers = await getAuthHeaders();
      const res = await axios.get(`${API_URL}/games/tables/${tableId}/state`, {
        params: { spectator: isSpectator ? 'true' : 'false' },
        headers: {
          ...headers,
          'x-user-id': currentUserId,
          'x-user-name': currentUsername,
        },
      });
      if (res.data?.success) {
        setTable(res.data.table);
        if (res.data.state) {
          setGameState(res.data.state);
        }
      }
    } catch (e) {
      console.warn('Gagal memuat state meja:', e);
    } finally {
      setLoading(false);
    }
  }, [tableId, isSpectator]);

  // Connect to Socket.IO namespace /games
  useEffect(() => {
    loadUser();
    fetchTableState();

    if (!tableId) return;

    let token = '';
    if (Platform.OS === 'web') {
      token = localStorage.getItem('token') || '';
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      query: {
        userId: currentUserId || 'guest',
        username: currentUsername || 'Ngopikawan',
      },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('table:subscribe', { tableId });
    });

    socket.on('table:state', (data: { table: any }) => {
      if (data?.table) setTable(data.table);
    });

    socket.on('table:player_joined', (data: { player: any; table: any }) => {
      if (data?.table) setTable(data.table);
    });

    socket.on('game:started', (data: { table: any }) => {
      if (data?.table) setTable(data.table);
      fetchTableState();
    });

    socket.on('game:state_update', (data: { tableId: string; state: any }) => {
      if (data?.state) {
        setGameState(data.state);
        if (data.state.isFinished) {
          setGameResult({
            winners: [data.state.winnerId],
            scores: data.state.scores,
            summary: data.state.summary || (data.state.deadlock
              ? 'Gaple Buntu! Pemenang ditentukan oleh sisa kartu dengan poin terkecil.'
              : 'Permainan Selesai!'),
          });
          setResultModalVisible(true);
        }
      }
    });

    socket.on('game:your_turn', (_data) => {
      // Gentle notification or haptic can be placed here
    });

    socket.on('game:chat_message', (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    socket.on('game:emote_received', (data: { senderId: string; senderName: string; emote: string }) => {
      const id = `${Date.now()}_${Math.random()}`;
      setFloatingEmotes((prev) => [...prev, { id, emote: data.emote, sender: data.senderName }]);
      setTimeout(() => {
        setFloatingEmotes((prev) => prev.filter((item) => item.id !== id));
      }, 3500);
    });

    socket.on('game:finished', (data: { results: any }) => {
      if (data?.results) {
        setGameResult(data.results);
        setResultModalVisible(true);

        // Task 3.1: Automatically open share modal when player wins with Nutup Balak 6/0 or Digapleh
        const isWinner = data.results.winners?.includes(currentUserId);
        const winType = data.results.winType;
        if (isWinner && (winType === 'nutup_balak6' || winType === 'nutup_balak0' || winType === 'digapleh')) {
          setTimeout(() => {
            setShareModalVisible(true);
          }, 700);
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [tableId, currentUserId, currentUsername, fetchTableState]);

  // Action: Take seat
  const handleTakeSeat = () => {
    if (!socketRef.current || !tableId) return;
    socketRef.current.emit('table:join', { tableId }, (res: any) => {
      if (!res?.success) {
        Alert.alert('Gagal Duduk', res?.error || 'Tidak dapat mengambil kursi.');
      } else if (res.table) {
        setTable(res.table);
      }
    });
  };

  // Action: Add Bot
  const handleAddBot = (botProfileId?: string) => {
    if (!socketRef.current || !tableId) return;
    if (!botProfileId && table?.game_type === 'gapleh' && Number(table?.config?.level) === 2) {
      setBotPickerVisible(true);
      return;
    }
    socketRef.current.emit('table:add_bot', { tableId, botProfileId }, (res: any) => {
      if (!res?.success) {
        Alert.alert('Gagal', res?.error || 'Gagal menambahkan bot.');
      } else if (res.table) {
        setTable(res.table);
      }
      setBotPickerVisible(false);
    });
  };

  // Action: Start Game
  const handleStartGame = () => {
    if (!socketRef.current || !tableId) return;
    socketRef.current.emit('table:start', { tableId }, (res: any) => {
      if (!res?.success) {
        Alert.alert('Gagal Mulai', res?.error || 'Gagal memulai permainan.');
      } else if (res.table) {
        setTable(res.table);
      }
    });
  };

  // Player Action: Toggle Ready
  const handleToggleReady = () => {
    if (!socketRef.current || !tableId || !table) return;
    const me = table.players?.find((p: any) => p.user_id === currentUserId);
    const newReady = !me?.is_ready;
    socketRef.current.emit('table:ready', { tableId, isReady: newReady }, (res: any) => {
      if (!res?.success) {
        Alert.alert('Perhatian', res?.error || 'Gagal mengubah status siap.');
      }
    });
  };

  // Share Victory to Social Media
  const handleShareVictory = async () => {
    if (table?.game_type === 'gapleh') {
      setShareModalVisible(true);
      return;
    }

    const gameLabel = (table?.game_type || 'GAPLEH').toUpperCase();
    const winnerName = currentUsername || 'albantani';
    const hookText = `menang maen ${gameLabel} sambil Ngopi! 🏆✨\n\nNongkrong santai di warkop digital: maen Gapleh, Catur, UNO, Pokemon, Monopoly, Truf, Bridge, Remi, Ulartangga, Poker, Remi! Kumpulin Poin Warkop & tukar Token BaMbooChain (BMC)! Gas maen bareng ${winnerName} sekarang, klik: https://ngopi.top?ref=${encodeURIComponent(winnerName)} ☕🚀`;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Kemenangan di Ngopi.top!',
            text: hookText,
          });
          return;
        } catch {
          // ignore or fallback
        }
      }
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(hookText);
        }
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(hookText)}`, '_blank');
      } catch {
        alert('Tautan kemenangan telah disiapkan!');
      }
    } else {
      try {
        await Share.share({
          message: hookText,
        });
      } catch (e) {
        console.warn(e);
      }
    }
  };

  // Chess Action: Move Piece
  const handleChessSquarePress = (row: number, col: number) => {
    if (!isMyTurn) {
      Alert.alert('Perhatian', 'Bukan giliran Anda!');
      return;
    }
    const piece = gameState?.board?.[row]?.[col];
    const myColor = gameState?.whitePlayerId === currentUserId ? 'w' : 'b';

    if (!selectedChessSquare) {
      if (piece && piece.startsWith(myColor)) {
        setSelectedChessSquare({ row, col });
      }
    } else {
      const selectedPiece = gameState?.board?.[selectedChessSquare.row]?.[selectedChessSquare.col];

      // Castling Shortcut: If King is selected and player clicks their own Rook on the same row
      const isKingSelected = selectedPiece === `${myColor}K`;
      const isClickingOwnRook = isKingSelected && row === selectedChessSquare.row && piece === `${myColor}R`;

      if (isClickingOwnRook) {
        const fromRow = selectedChessSquare.row;
        const fromCol = selectedChessSquare.col;
        const targetCol = col === 7 ? 6 : col === 0 ? 2 : col;
        setSelectedChessSquare(null);
        if (socketRef.current && tableId) {
          socketRef.current.emit(
            'game:action',
            {
              tableId,
              action: 'move',
              payload: { fromRow, fromCol, toRow: fromRow, toCol: targetCol },
            },
            (res: any) => {
              if (!res?.success) {
                Alert.alert('Langkah Gagal', res?.error || 'Langkah rokade (lokir) tidak sah.');
              }
            }
          );
        }
        return;
      }

      if (piece && piece.startsWith(myColor)) {
        setSelectedChessSquare({ row, col });
        return;
      }
      const fromRow = selectedChessSquare.row;
      const fromCol = selectedChessSquare.col;
      setSelectedChessSquare(null);
      if (socketRef.current && tableId) {
        socketRef.current.emit(
          'game:action',
          {
            tableId,
            action: 'move',
            payload: { fromRow, fromCol, toRow: row, toCol: col },
          },
          (res: any) => {
            if (!res?.success) {
              Alert.alert('Langkah Gagal', res?.error || 'Langkah bidak tidak sah.');
            }
          }
        );
      }
    }
  };

  // Change Catur Settings (Color / Bot Difficulty)
  const handleChangeCaturSetting = (
    preferredColor: 'white' | 'black' | 'random',
    botDifficulty: 'easy' | 'medium' | 'hard'
  ) => {
    if (!socketRef.current || !tableId) return;
    socketRef.current.emit(
      'table:update_catur_setting',
      { tableId, preferredColor, botDifficulty },
      (res: any) => {
        if (!res?.success) {
          Alert.alert('Gagal', res?.error || 'Tidak dapat memperbarui pengaturan catur.');
        } else {
          fetchTableState();
        }
      }
    );
  };

  // Card Action: Remi Discard or Trick Play
  const handlePlayCardAction = (card: any) => {
    if (!isMyTurn) {
      Alert.alert('Perhatian', 'Bukan giliran Anda!');
      return;
    }
    if (!socketRef.current || !tableId) return;

    if (table.game_type === 'remi') {
      socketRef.current.emit(
        'game:action',
        {
          tableId,
          action: 'discard',
          payload: { suit: card.suit, rank: card.rank },
        },
        (res: any) => {
          if (!res?.success) Alert.alert('Gagal', res?.error || 'Gagal membuang kartu.');
        }
      );
    } else if (table.game_type === 'bridge' || table.game_type === 'truf') {
      const isTrufBidding = table.game_type === 'truf' && gameState?.phase === 'bidding';
      socketRef.current.emit(
        'game:action',
        {
          tableId,
          action: isTrufBidding ? 'bid' : 'play',
          payload: { suit: card.suit, rank: card.rank },
        },
        (res: any) => {
          if (!res?.success) Alert.alert('Gagal', res?.error || (isTrufBidding ? 'Gagal menawar kartu.' : 'Gagal memainkan kartu.'));
        }
      );
    }
  };

  // Remi Action: Draw from deck or discard
  const handleRemiDraw = (source: 'deck' | 'discard') => {
    if (!isMyTurn || !socketRef.current || !tableId) return;
    socketRef.current.emit(
      'game:action',
      {
        tableId,
        action: 'draw',
        payload: { source },
      },
      (res: any) => {
        if (!res?.success) Alert.alert('Gagal', res?.error || 'Gagal mengambil kartu.');
      }
    );
  };

  // Poker Action: Check, Bet, Fold
  const handlePokerAction = (action: 'check' | 'bet' | 'fold') => {
    if (!isMyTurn || !socketRef.current || !tableId) return;
    socketRef.current.emit(
      'game:action',
      {
        tableId,
        action,
        payload: action === 'bet' ? { amount: 10 } : {},
      },
      (res: any) => {
        if (!res?.success) Alert.alert('Gagal', res?.error || 'Aksi poker gagal.');
      }
    );
  };



  // Play Card Action
  const handleCardPress = (card: [number, number]) => {
    if (!gameState || gameState.currentTurn !== currentUserId) {
      Alert.alert('Perhatian', 'Bukan giliran Anda!');
      return;
    }

    const board = gameState.board;
    // If board is empty, place directly
    if (board.leftEnd === null || board.rightEnd === null) {
      const isLevel2 = table.game_type === 'gapleh' && (Number(table.config?.level) === 2 || Number(gameState.level) === 2);
      if (isLevel2 && ((card[0] === 6 && card[1] === 6) || (card[0] === 0 && card[1] === 0))) {
        Alert.alert('Aturan Level 2', 'Kartu pembuka tidak boleh dibuka dengan Balak 6 (6-6) atau Balak 0 (0-0).');
        return;
      }
      executePlayCard(card, 'left');
      return;
    }

    // Check match for left & right
    const matchesLeft = card[0] === board.leftEnd || card[1] === board.leftEnd;
    const matchesRight = card[0] === board.rightEnd || card[1] === board.rightEnd;

    if (matchesLeft && matchesRight && board.leftEnd !== board.rightEnd) {
      // Must prompt user to choose side!
      setPendingCard(card);
      setPendingSides(['left', 'right']);
    } else if (matchesLeft) {
      executePlayCard(card, 'left');
    } else if (matchesRight) {
      executePlayCard(card, 'right');
    } else {
      Alert.alert('Tidak Cocok', 'Kartu ini tidak bisa ditempel ke ujung meja.');
    }
  };

  const executePlayCard = (card: [number, number], side: 'left' | 'right') => {
    if (!socketRef.current || !tableId) return;
    setPendingCard(null);
    setPendingSides([]);

    socketRef.current.emit(
      'game:action',
      {
        tableId,
        action: 'play',
        payload: { card, side },
      },
      (res: any) => {
        if (!res?.success) {
          Alert.alert('Langkah Gagal', res?.error || 'Langkah tidak sah.');
        }
      }
    );
  };

  // Pass Action
  const handlePass = () => {
    if (!socketRef.current || !tableId) return;
    socketRef.current.emit(
      'game:action',
      {
        tableId,
        action: 'pass',
        payload: {},
      },
      (res: any) => {
        if (!res?.success) {
          Alert.alert('Gagal Pass', res?.error || 'Tidak bisa pass.');
        }
      }
    );
  };

  // Send Emote
  const sendEmote = (emote: string) => {
    if (socketRef.current && tableId) {
      socketRef.current.emit('game:emote', { tableId, emote });
    }
  };

  // Send In-Game Chat
  const sendChatMessage = () => {
    if (!chatInput.trim() || !socketRef.current || !tableId) return;
    socketRef.current.emit('game:chat', { tableId, message: chatInput.trim() });
    setChatInput('');
  };

  // Leave Table (Back button)
  const handleLeaveTable = () => {
    const doLeave = () => {
      if (socketRef.current && tableId) {
        socketRef.current.emit('table:leave', { tableId });
      }
      try {
        axios.post(
          `${API_URL}/games/tables/${tableId}/leave`,
          {},
          {
            headers: {
              'x-user-id': currentUserId,
              'x-user-name': currentUsername,
            },
          }
        ).catch(() => {});
      } catch (_) {}

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
          router.back();
        } else {
          router.replace('/(main)/games' as any);
        }
      } else {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(main)/games' as any);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        const confirmed = window.confirm('Tinggalkan meja ini?');
        if (confirmed) {
          doLeave();
        }
      } else {
        doLeave();
      }
    } else {
      Alert.alert(
        'Tinggalkan Meja',
        'Apakah Anda yakin ingin meninggalkan meja ini?',
        [
          { text: 'Batal', style: 'cancel' },
          { text: 'Tinggalkan', style: 'destructive', onPress: doLeave },
        ]
      );
    }
  };

  if (loading || !table) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={coffee.accent} />
        <Text style={styles.loadingText}>Memasuki Meja Warkop...</Text>
      </View>
    );
  }

  const isHost = table.host_id === currentUserId;
  const isPlaying = table.status === 'playing';
  const myPlayer = table.players?.find((p: any) => p.user_id === currentUserId);
  const isMyTurn = isPlaying && gameState?.currentTurn === currentUserId;
  const allReady = table.players?.every((p: any) => p.is_ready || p.is_bot);
  const canStart = Boolean(myPlayer);
  const myHand: Array<[number, number]> = table.game_type === 'gapleh' && Array.isArray(gameState?.myHand) ? gameState.myHand : [];
  const myCards: Array<any> = table.game_type !== 'gapleh' && Array.isArray(gameState?.myHand) ? gameState.myHand : [];
  const validMoves = gameState?.validMoves || [];

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleLeaveTable}>
          <Ionicons name="arrow-back" size={20} color={coffee.text} />
        </TouchableOpacity>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {table.name}
          </Text>
          <Text style={styles.headerSub}>
            {isPlaying ? '🟢 Pertandingan Berlangsung' : '🟡 Menunggu Pemain'} • {table.players?.length}/{table.max_players} Kursi • {table.game_type === 'gapleh' ? (Number(table.config?.level) === 2 || Number(gameState?.level) === 2 ? '🔥 GAPLEH RAME (LEVEL 2)' : '☕ GAPLEH KLASIK (LEVEL 1)') : table.game_type?.toUpperCase()}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.socialIconBtn, isMuted && { backgroundColor: coffee.dangerButton }]}
          onPress={() => setIsMuted((p) => !p)}
          accessibilityLabel="Mic Voice"
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={18} color={coffee.buttonText} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialIconBtn}
          onPress={() => setChatVisible((p) => !p)}
          accessibilityLabel="Chat Meja"
        >
          <Ionicons name="chatbubble-ellipses" size={18} color={coffee.buttonText} />
        </TouchableOpacity>
      </View>

      {/* Floating Emotes Animation Container */}
      <View pointerEvents="none" style={styles.floatingEmotesContainer}>
        {floatingEmotes.map((item) => (
          <View key={item.id} style={styles.floatingEmoteBubble}>
            <Text style={{ fontSize: 32 }}>{item.emote}</Text>
            <Text style={styles.floatingEmoteSender}>{item.sender}</Text>
          </View>
        ))}
      </View>

      {/* Waiting Lobby Controls (Before Match Starts) */}
      {!isPlaying && (
        <View style={styles.waitingControlsBanner}>
          <Text style={styles.waitingText}>
            {table.players?.length < table.min_players
              ? `Pemain ${table.players?.length}/${table.min_players}. Tambah bot atau langsung tekan Mulai Main! 🎮`
              : 'Meja sudah siap! Tekan Mulai Main untuk bertanding sekarang.'}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* If spectator / not seated, show Duduk button */}
            {!myPlayer && table.players?.length < table.max_players && (
              <TouchableOpacity style={styles.startBtn} onPress={handleTakeSeat}>
                <Ionicons name="enter-outline" size={16} color={coffee.buttonText} />
                <Text style={styles.startBtnText}>🪑 Ambil Kursi Meja Ini</Text>
              </TouchableOpacity>
            )}

            {/* Add Bot button for any seated player or host */}
            {(isHost || Boolean(myPlayer)) && table.players?.length < table.max_players && (
              <TouchableOpacity style={styles.addBotBtn} onPress={() => handleAddBot()}>
                <Ionicons name="hardware-chip-outline" size={16} color={coffee.accent} />
                <Text style={styles.addBotBtnText}>+ Tambah Bot</Text>
              </TouchableOpacity>
            )}

            {/* Ready button for seated non-host (or host) */}
            {myPlayer && (
              <TouchableOpacity
                style={[styles.readyBtn, myPlayer.is_ready && styles.readyBtnActive]}
                onPress={handleToggleReady}
              >
                <Ionicons
                  name={myPlayer.is_ready ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={myPlayer.is_ready ? coffee.buttonText : coffee.text}
                />
                <Text
                  style={[
                    styles.readyBtnText,
                    myPlayer.is_ready && styles.readyBtnTextActive,
                  ]}
                >
                  {myPlayer.is_ready ? 'Sudah Siap' : 'Tandai Siap'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Start Game button - visible to Host OR to ANY seated player when all are ready! */}
            {canStart && (
              <TouchableOpacity
                style={styles.startBtn}
                onPress={handleStartGame}
              >
                <Ionicons name="play" size={16} color={coffee.buttonText} />
                <Text style={styles.startBtnText}>Mulai Main 🎮</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Seated Players Avatars Bar */}
      <View style={styles.seatsRow}>
        {table.players?.map((player: any) => {
          const isTurn = isPlaying && gameState?.currentTurn === player.user_id;
          const isMe = player.user_id === currentUserId;
          const cardCount = isMe
            ? (table.game_type === 'gapleh' ? myHand.length : myCards.length)
            : gameState?.opponents?.[player.user_id]?.cardCount ?? 7;

          const isPartnership = table.game_type === 'gapleh' && (table.config?.gaplehMode === 'partnership' || gameState?.gameMode === 'partnership');
          const playerTeam = isPartnership ? (player.team || (player.seat_number % 2 === 0 ? 'A' : 'B')) : null;
          const myTeam = isPartnership && myPlayer ? (myPlayer.team || (myPlayer.seat_number % 2 === 0 ? 'A' : 'B')) : null;
          const isTeammate = isPartnership && myTeam && playerTeam === myTeam && !isMe;
          const isOpponent = isPartnership && myTeam && playerTeam !== myTeam;

          return (
            <View
              key={player.user_id}
              style={[
                styles.playerSeatCard,
                isTurn && styles.playerSeatCardActive,
                playerTeam === 'A' && { borderColor: 'rgba(59, 130, 246, 0.5)', borderWidth: 1 },
                playerTeam === 'B' && { borderColor: 'rgba(249, 115, 22, 0.5)', borderWidth: 1 },
              ]}
            >
              {isPartnership && (
                <View
                  style={{
                    backgroundColor: playerTeam === 'A' ? '#1e3a8a' : '#7c2d12',
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                    borderRadius: 4,
                    marginBottom: 2,
                  }}
                >
                  <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>
                    {playerTeam === 'A' ? 'TIM A' : 'TIM B'} {player.seat_number % 2 === 0 ? '(1)' : '(2)'}
                  </Text>
                </View>
              )}
              {(() => {
                const botMeta = player.is_bot ? GAPLEH_BOTS.find((b) => player.user_id.includes(b.id) || player.display_name.toLowerCase().includes(b.name.toLowerCase())) : null;
                return (
                  <View
                    style={[
                      styles.seatAvatar,
                      isTurn && { borderColor: coffee.accent, borderWidth: 2 },
                      botMeta && { backgroundColor: '#3b2414' },
                    ]}
                  >
                    <Text style={[styles.seatAvatarText, botMeta && { fontSize: 16 }]}>
                      {botMeta ? botMeta.avatar : (player.display_name.charAt(0) || 'U')}
                    </Text>
                  </View>
                );
              })()}
              <Text style={styles.seatName} numberOfLines={1}>
                {player.display_name} {isMe ? '(Anda)' : ''} {player.user_id === table.host_id ? '👑' : ''}
              </Text>
              {isTeammate && (
                <Text style={{ color: '#60a5fa', fontSize: 9, fontWeight: '800' }}>Rekan 🤝</Text>
              )}
              {isOpponent && (
                <Text style={{ color: '#fb923c', fontSize: 9, fontWeight: '700' }}>Lawan 🎯</Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.cardCountText}>
                  {player.is_bot ? '🤖 Bot' : table.game_type === 'gapleh' ? '🁫' : '🃏'}{' '}
                  {isPlaying
                    ? table.game_type === 'catur'
                      ? gameState?.whitePlayerId === player.user_id
                        ? 'Putih ⚪'
                        : 'Hitam ⚫'
                      : table.game_type === 'truf' && gameState?.phase !== 'bidding'
                      ? `${cardCount} kartu • 🏆 ${gameState?.tricksWon?.[player.user_id] || 0}${gameState?.bids?.[player.user_id]?.target !== undefined ? `/${gameState.bids[player.user_id].target}` : ''}`
                      : `${cardCount} kartu`
                    : player.is_ready
                    ? 'Siap'
                    : 'Menunggu'}
                </Text>
              </View>
              {isTurn && <Text style={styles.turnIndicatorBadge}>Gilirannya</Text>}
            </View>
          );
        })}

        {/* Empty seat slots */}
        {!isPlaying && Array.from({ length: Math.max(0, table.max_players - (table.players?.length || 0)) }).map((_, emptyIdx) => (
          <TouchableOpacity
            key={`empty_${emptyIdx}`}
            style={[styles.playerSeatCard, { borderStyle: 'dashed', borderColor: coffee.border, borderWidth: 1 }]}
            onPress={() => {
              if (myPlayer) {
                handleAddBot();
              } else {
                handleTakeSeat();
              }
            }}
          >
            <View style={[styles.seatAvatar, { backgroundColor: 'transparent', borderWidth: 1, borderColor: coffee.border, borderStyle: 'dashed' }]}>
              <Text style={{ fontSize: 16, color: coffee.muted }}>＋</Text>
            </View>
            <Text style={[styles.seatName, { color: coffee.muted }]}>Kosong</Text>
            <Text style={{ fontSize: 10, color: coffee.accent, fontWeight: 'bold' }}>
              {myPlayer ? '+ Tambah Bot' : '+ Duduk'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Area Meja Permainan Warkop (Oval Felt Coffee Table) */}
      <View style={styles.tableArenaWrapper}>
        <View style={styles.tableFelt}>
          {isPlaying ? (
            table.game_type === 'gapleh' && gameState?.board ? (
              <View style={{ width: '100%', alignItems: 'center' }}>
                {(gameState?.gameMode === 'partnership' || table.config?.gaplehMode === 'partnership') && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 12,
                      backgroundColor: 'rgba(0,0,0,0.5)',
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: coffee.border,
                      marginBottom: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ color: '#93c5fd', fontWeight: '900', fontSize: 11 }}>TIM A:</Text>
                      <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 12 }}>
                        {gameState?.ruleset === 'tournament'
                          ? `${gameState?.matchScores?.A ?? 0} / ${gameState?.targetScore ?? 250}`
                          : `${gameState?.matchScores?.A ?? 0} Poin`}
                      </Text>
                    </View>
                    <Text style={{ color: coffee.secondary, fontSize: 10 }}>VS</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ color: '#fdba74', fontWeight: '900', fontSize: 11 }}>TIM B:</Text>
                      <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 12 }}>
                        {gameState?.ruleset === 'tournament'
                          ? `${gameState?.matchScores?.B ?? 0} / ${gameState?.targetScore ?? 250}`
                          : `${gameState?.matchScores?.B ?? 0} Poin`}
                      </Text>
                    </View>
                    <View style={{ backgroundColor: coffee.raised, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ color: coffee.accent, fontSize: 9, fontWeight: '800' }}>
                        {gameState?.ruleset === 'tournament' ? '🏆 Turnamen' : '🏘️ Kampung'}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.boardContainer}>
                {/* Left End Open Pip Indicator */}
                {gameState.board.leftEnd !== null && (
                  <View style={styles.endPipBadge}>
                    <Text style={styles.endPipLabel}>KIRI</Text>
                    <Text style={styles.endPipValue}>{gameState.board.leftEnd}</Text>
                  </View>
                )}

                {/* Scrollable Domino Chain */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dominoChainScroll}
                >
                  {gameState.board.placedCards.length === 0 ? (
                    <View style={styles.emptyBoardNotice}>
                      <Text style={styles.emptyBoardText}>
                        {isMyTurn
                          ? 'Giliran Anda membuka kartu pertama di meja!'
                          : 'Menunggu pembukaan kartu pertama...'}
                      </Text>
                    </View>
                  ) : (
                    gameState.board.placedCards.map((pc: any, idx: number) => (
                      <DominoTile
                        key={idx}
                        card={pc.card}
                        horizontal={pc.rotation === 90}
                        size="medium"
                      />
                    ))
                  )}
                </ScrollView>

                {/* Right End Open Pip Indicator */}
                {gameState.board.rightEnd !== null && (
                  <View style={styles.endPipBadge}>
                    <Text style={styles.endPipLabel}>KANAN</Text>
                    <Text style={styles.endPipValue}>{gameState.board.rightEnd}</Text>
                  </View>
                )}
              </View>
            </View>
          ) : table.game_type === 'catur' && gameState?.board ? (
              /* Catur 8x8 Board with Full Color & Difficulty Controls */
              <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                {/* Chess Controls Header */}
                <View style={{ width: '100%', maxWidth: 360, gap: 6, marginBottom: 8 }}>
                  {/* Row 1: User Color Selector */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#241a12', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: coffee.border }}>
                    <Text style={{ color: coffee.secondary, fontSize: 11, fontWeight: '700' }}>Warna Bidak:</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        style={{
                          backgroundColor: gameState?.whitePlayerId === currentUserId ? coffee.button : coffee.raised,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: gameState?.whitePlayerId === currentUserId ? coffee.accent : coffee.border,
                        }}
                        onPress={() => handleChangeCaturSetting('white', (table.config?.botDifficulty || gameState?.botDifficulty || 'medium') as any)}
                      >
                        <Text style={{ color: gameState?.whitePlayerId === currentUserId ? coffee.buttonText : coffee.text, fontSize: 11, fontWeight: '800' }}>
                          ⚪ Putih (Dulu)
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          backgroundColor: gameState?.blackPlayerId === currentUserId ? coffee.button : coffee.raised,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: gameState?.blackPlayerId === currentUserId ? coffee.accent : coffee.border,
                        }}
                        onPress={() => handleChangeCaturSetting('black', (table.config?.botDifficulty || gameState?.botDifficulty || 'medium') as any)}
                      >
                        <Text style={{ color: gameState?.blackPlayerId === currentUserId ? coffee.buttonText : coffee.text, fontSize: 11, fontWeight: '800' }}>
                          ⚫ Hitam
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{
                          backgroundColor: coffee.raised,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: coffee.border,
                        }}
                        onPress={() => handleChangeCaturSetting('random', (table.config?.botDifficulty || gameState?.botDifficulty || 'medium') as any)}
                      >
                        <Text style={{ color: coffee.text, fontSize: 11, fontWeight: '700' }}>
                          🎲 Acak
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Row 2: Bot Level & Flip Board */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#241a12', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: coffee.border }}>
                    <Text style={{ color: coffee.secondary, fontSize: 11, fontWeight: '700' }}>Level Bot:</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      {(['easy', 'medium', 'hard'] as const).map((diff) => {
                        const isCurrent = (table.config?.botDifficulty || gameState?.botDifficulty || 'medium') === diff;
                        const label = diff === 'easy' ? '🌱 Pemula' : diff === 'medium' ? '⚔️ Menengah' : '👑 Master';
                        const currentColor = gameState?.whitePlayerId === currentUserId ? 'white' : 'black';
                        return (
                          <TouchableOpacity
                            key={diff}
                            style={{
                              backgroundColor: isCurrent ? 'rgba(212, 163, 115, 0.25)' : coffee.raised,
                              paddingHorizontal: 6,
                              paddingVertical: 3,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: isCurrent ? coffee.accent : coffee.border,
                            }}
                            onPress={() => handleChangeCaturSetting(currentColor as any, diff)}
                          >
                            <Text style={{ color: isCurrent ? coffee.accent : coffee.secondary, fontSize: 10, fontWeight: '800' }}>
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <TouchableOpacity
                      style={{ backgroundColor: '#382619', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 }}
                      onPress={() => setFlipChessBoard((f) => !f)}
                    >
                      <Text style={{ color: coffee.accent, fontSize: 10, fontWeight: '700' }}>🔄 Balik</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Check Indicator Banner */}
                  {gameState?.inCheck && (
                    <View style={{ backgroundColor: 'rgba(220, 38, 38, 0.25)', borderColor: '#dc2626', borderWidth: 1, borderRadius: 6, paddingVertical: 3, alignItems: 'center' }}>
                      <Text style={{ color: '#f87171', fontWeight: '900', fontSize: 11 }}>
                        🚨 SKAK! RAJA DALAM ANCAMAN!
                      </Text>
                    </View>
                  )}
                </View>

                {/* 8x8 Chessboard Grid */}
                <View style={{ width: 280, height: 280, borderWidth: 2, borderColor: '#5c3d24', borderRadius: 6, overflow: 'hidden' }}>
                  {(() => {
                    const isUserBlack = Boolean(gameState?.whitePlayerId && gameState.whitePlayerId !== currentUserId);
                    const shouldFlip = flipChessBoard ? !isUserBlack : isUserBlack;
                    const rows = shouldFlip ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
                    const cols = shouldFlip ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

                    return rows.map((rIdx) => (
                      <View key={rIdx} style={{ flexDirection: 'row', flex: 1 }}>
                        {cols.map((cIdx) => {
                          const piece = gameState.board[rIdx]?.[cIdx] || null;
                          const isDark = (rIdx + cIdx) % 2 === 1;
                          const isSelected = selectedChessSquare?.row === rIdx && selectedChessSquare?.col === cIdx;
                          const pieceSymbol = piece ? CHESS_UNICODE[piece] || piece : null;
                          const isPieceWhite = piece?.startsWith('w');

                          return (
                            <TouchableOpacity
                              key={cIdx}
                              activeOpacity={0.7}
                              onPress={() => handleChessSquarePress(rIdx, cIdx)}
                              style={{
                                flex: 1,
                                backgroundColor: isSelected ? '#fef08a' : isDark ? '#b88b4a' : '#f5e6cc',
                                justifyContent: 'center',
                                alignItems: 'center',
                              }}
                            >
                              {pieceSymbol && (
                                <Text
                                  style={{
                                    fontSize: 22,
                                    color: isPieceWhite ? '#ffffff' : '#171411',
                                    textShadowColor: isPieceWhite ? '#000000' : '#ffffff',
                                    textShadowOffset: { width: 0.5, height: 0.5 },
                                    textShadowRadius: 1,
                                  }}
                                >
                                  {pieceSymbol}
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ));
                  })()}
                </View>

                <Text style={{ fontSize: 11, color: coffee.accent, marginTop: 6, fontWeight: '600' }}>
                  {isMyTurn ? 'Pilih bidak Anda lalu pilih kotak tujuan' : 'Menunggu langkah lawan...'}
                </Text>
              </View>
            ) : table.game_type === 'uno' && gameState?.topCard ? (
              /* UNO Center Play Arena */
              <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                {/* Active Color & Turn Direction */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: UNO_COLOR_MAP[gameState.activeColor]?.bg || '#8b5cf6',
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: '#ffffff',
                    }}
                  >
                    <Text style={{ color: UNO_COLOR_MAP[gameState.activeColor]?.text || '#ffffff', fontWeight: '900', fontSize: 12 }}>
                      WARNA: {UNO_COLOR_MAP[gameState.activeColor]?.label.toUpperCase()}
                    </Text>
                  </View>

                  <View
                    style={{
                      backgroundColor: '#2c1e14',
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: coffee.border,
                    }}
                  >
                    <Text style={{ color: coffee.accent, fontSize: 11, fontWeight: '700' }}>
                      {gameState.turnDirection === 1 ? '🔄 Searah Jam' : '🔃 Lawan Arah'}
                    </Text>
                  </View>
                </View>

                {/* Discard Pile Top Card & Draw Pile */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
                  <TouchableOpacity
                    style={{ alignItems: 'center' }}
                    onPress={handleUnoDraw}
                    disabled={!isMyTurn}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 82,
                        backgroundColor: '#1e1b4b',
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: '#6366f1',
                        justifyContent: 'center',
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 3,
                      }}
                    >
                      <Text style={{ fontSize: 24 }}>🂠</Text>
                      <Text style={{ fontSize: 10, color: '#c7d2fe', fontWeight: 'bold', marginTop: 2 }}>
                        {gameState.deckCount ?? 0}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: coffee.text, marginTop: 4, fontWeight: '600' }}>
                      Ambil Kartu
                    </Text>
                  </TouchableOpacity>

                  <View style={{ alignItems: 'center' }}>
                    <UnoCardTile card={gameState.topCard} size="large" />
                    <Text style={{ fontSize: 11, color: coffee.accent, marginTop: 4, fontWeight: '700' }}>
                      Kartu Terbuka
                    </Text>
                  </View>
                </View>
              </View>
            ) : table.game_type === 'snake_ladder' ? (
              /* Snake & Ladder (Ular Tangga) 10x10 Serpentine Board */
              <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                {/* Last Action Announcement Banner */}
                {gameState?.lastAction && (
                  <View
                    style={{
                      backgroundColor: 'rgba(212, 163, 115, 0.2)',
                      borderColor: coffee.accent,
                      borderWidth: 1,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      marginBottom: 8,
                      maxWidth: 320,
                    }}
                  >
                    <Text style={{ color: coffee.accent, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>
                      {gameState.lastAction.message}
                    </Text>
                  </View>
                )}

                {/* 10x10 Board Grid */}
                <View
                  style={{
                    width: 300,
                    height: 300,
                    borderWidth: 2,
                    borderColor: '#5c3d24',
                    borderRadius: 8,
                    overflow: 'hidden',
                    backgroundColor: '#1b130e',
                  }}
                >
                  {Array.from({ length: 10 }).map((_, rIdx) => {
                    const rowNumber = 9 - rIdx; // 9 down to 0
                    const isEvenRowFromBottom = rowNumber % 2 === 0;
                    return (
                      <View key={rIdx} style={{ flexDirection: 'row', flex: 1 }}>
                        {Array.from({ length: 10 }).map((_, cIdx) => {
                          const colNumber = isEvenRowFromBottom ? cIdx : 9 - cIdx;
                          const cellNum = rowNumber * 10 + colNumber + 1;
                          const isLight = (rowNumber + colNumber) % 2 === 0;

                          const isLadderBase = gameState?.ladders?.[cellNum] !== undefined;
                          const isSnakeHead = gameState?.snakes?.[cellNum] !== undefined;

                          // Players located on this cell
                          const cellPlayers = Object.values(gameState?.players || {}).filter(
                            (p: any) => p.position === cellNum
                          );

                          return (
                            <View
                              key={cIdx}
                              style={{
                                flex: 1,
                                backgroundColor: cellNum === 100 ? '#fef08a' : isLight ? '#f5e6cc' : '#d4bda4',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: 1,
                                borderWidth: 0.3,
                                borderColor: '#a3816a',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 7,
                                  fontWeight: '800',
                                  color: cellNum === 100 ? '#854d0e' : '#3d2516',
                                }}
                              >
                                {cellNum}
                              </Text>

                              {isLadderBase && <Text style={{ fontSize: 8 }}>🪜</Text>}
                              {isSnakeHead && <Text style={{ fontSize: 8 }}>🐍</Text>}

                              {/* Player tokens on cell */}
                              <View style={{ flexDirection: 'row', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                                {cellPlayers.map((cp: any, idx: number) => {
                                  const isMe = cp.userId === currentUserId;
                                  return (
                                    <View
                                      key={idx}
                                      style={{
                                        width: 9,
                                        height: 9,
                                        borderRadius: 4.5,
                                        backgroundColor: isMe ? '#2563eb' : idx === 1 ? '#dc2626' : '#16a34a',
                                        borderWidth: 1,
                                        borderColor: '#ffffff',
                                      }}
                                    />
                                  );
                                })}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                </View>

                {/* Legend Bar */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 6, alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, color: coffee.muted }}>🪜 Tangga Naik</Text>
                  <Text style={{ fontSize: 10, color: coffee.muted }}>🐍 Ular Turun</Text>
                  <Text style={{ fontSize: 10, color: coffee.accent, fontWeight: '700' }}>🏆 Kotak 100</Text>
                </View>
              </View>
            ) : table.game_type === 'monopoly' ? (
              /* Monopoly 24-Square Perimeter Board */
              <View style={{ alignItems: 'center', paddingVertical: 4 }}>
                {/* Last Action Announcement Banner */}
                {gameState?.lastAction && (
                  <View
                    style={{
                      backgroundColor: 'rgba(212, 163, 115, 0.2)',
                      borderColor: coffee.accent,
                      borderWidth: 1,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                      marginBottom: 6,
                      maxWidth: 340,
                    }}
                  >
                    <Text style={{ color: coffee.accent, fontSize: 11, fontWeight: '700', textAlign: 'center' }}>
                      {gameState.lastAction.message}
                    </Text>
                  </View>
                )}

                {/* 24-Square Board Container */}
                <View
                  style={{
                    width: 330,
                    height: 330,
                    borderWidth: 2,
                    borderColor: '#5c3d24',
                    borderRadius: 10,
                    backgroundColor: '#1b130e',
                    padding: 3,
                    justifyContent: 'space-between',
                  }}
                >
                  {/* Top Edge (Squares 12, 13, 14, 15, 16, 17, 18) */}
                  <View style={{ flexDirection: 'row', height: 48, gap: 2 }}>
                    {[12, 13, 14, 15, 16, 17, 18].map((sqId) => renderMonopolyTile(sqId))}
                  </View>

                  {/* Middle Section: Left Edge + Center Area + Right Edge */}
                  <View style={{ flexDirection: 'row', flex: 1, justifyContent: 'space-between', paddingVertical: 2 }}>
                    {/* Left Edge (Squares 11, 10, 9, 8, 7 - top to bottom) */}
                    <View style={{ width: 44, justifyContent: 'space-between', gap: 2 }}>
                      {[11, 10, 9, 8, 7].map((sqId) => renderMonopolyTile(sqId))}
                    </View>

                    {/* Center Area */}
                    <View
                      style={{
                        flex: 1,
                        marginHorizontal: 4,
                        backgroundColor: '#140d08',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#3d2516',
                        padding: 6,
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Text style={{ color: coffee.accent, fontWeight: '900', fontSize: 13, letterSpacing: 0.5 }}>
                        🏢 MONOPOLI WARKOP
                      </Text>

                      {/* Dice display */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#25170e', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                        <Text style={{ fontSize: 18 }}>🎲</Text>
                        <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>
                          [{gameState?.dice?.[0] || 1}] + [{gameState?.dice?.[1] || 1}] = {(gameState?.dice?.[0] || 1) + (gameState?.dice?.[1] || 1)}
                        </Text>
                        {gameState?.isDouble && (
                          <Text style={{ color: '#f59e0b', fontSize: 10, fontWeight: '800' }}>KEMBAR! 🔥</Text>
                        )}
                      </View>

                      {/* Pending Action Box in Center */}
                      {gameState?.pendingAction?.type === 'buy_property' ? (
                        <View style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: '#22c55e', borderWidth: 1, borderRadius: 8, padding: 6, alignItems: 'center', width: '100%' }}>
                          <Text style={{ color: '#86efac', fontSize: 10, fontWeight: '700', textAlign: 'center' }}>
                            Tawaran: {gameState?.squares?.[gameState.pendingAction.squareId]?.name || `Kotak ${gameState.pendingAction.squareId}`} (Rp {gameState.pendingAction.amount})
                          </Text>
                          {isMyTurn && !isSpectator && (
                            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                              <TouchableOpacity
                                style={{ backgroundColor: '#15803d', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 }}
                                onPress={handleMonopolyBuyProperty}
                              >
                                <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '800' }}>Beli 💰</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={{ backgroundColor: '#b91c1c', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 }}
                                onPress={handleMonopolySkipBuy}
                              >
                                <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '800' }}>Lewat ❌</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      ) : (
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{ color: coffee.muted, fontSize: 10 }}>
                            Giliran: <Text style={{ color: isMyTurn ? '#38bdf8' : coffee.accent, fontWeight: '700' }}>
                              {table.players?.find((p: any) => p.user_id === gameState?.currentTurn)?.display_name || 'Menunggu'}
                            </Text>
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Right Edge (Squares 19, 20, 21, 22, 23 - top to bottom) */}
                    <View style={{ width: 44, justifyContent: 'space-between', gap: 2 }}>
                      {[19, 20, 21, 22, 23].map((sqId) => renderMonopolyTile(sqId))}
                    </View>
                  </View>

                  {/* Bottom Edge (Squares 6, 5, 4, 3, 2, 1, 0 - left to right) */}
                  <View style={{ flexDirection: 'row', height: 48, gap: 2 }}>
                    {[6, 5, 4, 3, 2, 1, 0].map((sqId) => renderMonopolyTile(sqId))}
                  </View>
                </View>
              </View>
            ) : table.game_type === 'remi' ? (
              /* Remi Draw Deck and Discard Pile */
              <View style={{ alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 }}>
                  <TouchableOpacity
                    style={{ alignItems: 'center' }}
                    onPress={() => handleRemiDraw('deck')}
                    disabled={!isMyTurn || gameState?.turnPhase !== 'draw'}
                  >
                    <View style={{ width: 48, height: 68, backgroundColor: '#2c1e14', borderRadius: 6, borderWidth: 1, borderColor: coffee.border, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 22, color: coffee.accent }}>🂠</Text>
                      <Text style={{ fontSize: 10, color: coffee.muted, marginTop: 2 }}>{gameState?.deckRemaining ?? 40}</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: coffee.text, marginTop: 4 }}>Ambil Tumpukan</Text>
                  </TouchableOpacity>

                  {gameState?.discardTop ? (
                    <TouchableOpacity
                      style={{ alignItems: 'center' }}
                      onPress={() => handleRemiDraw('discard')}
                      disabled={!isMyTurn || gameState?.turnPhase !== 'draw'}
                    >
                      <PlayingCardTile card={gameState.discardTop} />
                      <Text style={{ fontSize: 11, color: coffee.accent, marginTop: 4 }}>Ambil Buangan</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ width: 48, height: 68, borderRadius: 6, borderWidth: 1, borderColor: coffee.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 10, color: coffee.muted }}>Kosong</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontSize: 11, color: coffee.muted }}>
                  {gameState?.turnPhase === 'draw' ? 'Fase Ambil Kartu' : 'Fase Buang 1 Kartu dari Tangan'}
                </Text>
              </View>
            ) : table.game_type === 'poker' ? (
              /* Texas Hold'em Community Cards and Pot */
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 10 }}>
                <View style={{ backgroundColor: '#2c1e14', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: coffee.accent }}>
                  <Text style={{ color: coffee.accent, fontWeight: 'bold', fontSize: 12 }}>
                    💰 Pot: {gameState?.pot || 0} Koin ({gameState?.stage?.toUpperCase() || 'PRE-FLOP'})
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6, minHeight: 68, alignItems: 'center' }}>
                  {gameState?.communityCards && gameState.communityCards.length > 0 ? (
                    gameState.communityCards.map((c: any, i: number) => (
                      <PlayingCardTile key={i} card={c} />
                    ))
                  ) : (
                    <Text style={{ fontSize: 12, color: coffee.muted }}>Kartu Meja (Community) Belum Dibuka</Text>
                  )}
                </View>
              </View>
            ) : table.game_type === 'pokemon' ? (
              /* Pokemon Monster TCG Battle Stadium */
              (() => {
                const pOrder = gameState?.playerOrder || [];
                const oppId = pOrder.find((uid: string) => uid !== currentUserId) || pOrder[1];
                const meId = currentUserId;

                const oppState = gameState?.players?.[oppId];
                const myState = gameState?.players?.[meId];

                const oppActiveMon = oppState?.team?.[oppState?.activeIndex ?? 0];
                const myActiveMon = myState?.team?.[myState?.activeIndex ?? 0];

                const oppHpPct = oppActiveMon ? Math.max(0, Math.min(100, Math.round((oppActiveMon.currentHp / oppActiveMon.maxHp) * 100))) : 0;
                const myHpPct = myActiveMon ? Math.max(0, Math.min(100, Math.round((myActiveMon.currentHp / myActiveMon.maxHp) * 100))) : 0;

                const getHpColor = (pct: number) => (pct > 50 ? '#22c55e' : pct > 20 ? '#eab308' : '#ef4444');

                return (
                  <View style={{ width: '100%', maxWidth: 360, alignItems: 'center', paddingVertical: 4 }}>
                    {/* Opponent Active Monster Card (Top) */}
                    <View
                      style={{
                        width: '100%',
                        backgroundColor: '#26150c',
                        borderRadius: 12,
                        padding: 10,
                        borderWidth: 1.5,
                        borderColor: '#78350f',
                        marginBottom: 6,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 11, color: coffee.muted, fontWeight: '700' }}>
                            👤 @{oppState?.username || 'Lawan'}
                          </Text>
                          {/* Bench Indicators */}
                          <View style={{ flexDirection: 'row', gap: 3 }}>
                            {oppState?.team?.map((m: any, idx: number) => (
                              <Text key={idx} style={{ fontSize: 9 }}>
                                {m.isFainted ? '💀' : idx === oppState?.activeIndex ? '🔴' : '⚪'}
                              </Text>
                            ))}
                          </View>
                        </View>
                        <Text style={{ fontSize: 10, color: coffee.accent, fontWeight: '900' }}>
                          {oppActiveMon?.type?.toUpperCase()}
                        </Text>
                      </View>

                      {/* Opponent Monster Row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
                        <View
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 25,
                            backgroundColor: '#3d1f11',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: coffee.accent,
                          }}
                        >
                          <Text style={{ fontSize: 26 }}>{oppActiveMon?.icon || '🐾'}</Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>
                              {oppActiveMon?.name || 'Monster Lawan'}
                              {oppActiveMon?.isShiny ? ' ✨' : ''}
                            </Text>
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: getHpColor(oppHpPct) }}>
                              {oppActiveMon?.currentHp}/{oppActiveMon?.maxHp} HP
                            </Text>
                          </View>

                          {/* HP Bar */}
                          <View
                            style={{
                              height: 8,
                              backgroundColor: '#171411',
                              borderRadius: 4,
                              overflow: 'hidden',
                              marginTop: 4,
                              borderWidth: 0.5,
                              borderColor: '#4a3319',
                            }}
                          >
                            <View
                              style={{
                                width: `${oppHpPct}%`,
                                height: '100%',
                                backgroundColor: getHpColor(oppHpPct),
                              }}
                            />
                          </View>

                          <Text style={{ fontSize: 9, color: coffee.muted, marginTop: 3 }}>
                            ATK {oppActiveMon?.attack || 0} | DEF {oppActiveMon?.defense || 0}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Middle Clash & Live Battle Announcer */}
                    <View
                      style={{
                        width: '100%',
                        backgroundColor: 'rgba(212, 163, 115, 0.15)',
                        borderWidth: 1,
                        borderColor: coffee.border,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        marginVertical: 4,
                      }}
                    >
                      <Text
                        style={{
                          color: coffee.accent,
                          fontSize: 10,
                          fontWeight: '700',
                          textAlign: 'center',
                        }}
                        numberOfLines={2}
                      >
                        {gameState?.lastAction?.message || gameState?.battleLog?.[0]?.message || '⚔️ Pertarungan sedang berlangsung!'}
                      </Text>
                    </View>

                    {/* Player Active Monster Card (Bottom) */}
                    <View
                      style={{
                        width: '100%',
                        backgroundColor: '#1f130a',
                        borderRadius: 12,
                        padding: 10,
                        borderWidth: 1.5,
                        borderColor: isMyTurn ? coffee.accent : '#5c3d24',
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 11, color: coffee.accent, fontWeight: '900' }}>
                            👑 Anda (@{currentUsername})
                          </Text>
                          {/* Bench Indicators */}
                          <View style={{ flexDirection: 'row', gap: 3 }}>
                            {myState?.team?.map((m: any, idx: number) => (
                              <Text key={idx} style={{ fontSize: 9 }}>
                                {m.isFainted ? '💀' : idx === myState?.activeIndex ? '🟢' : '⚪'}
                              </Text>
                            ))}
                          </View>
                        </View>
                        <Text style={{ fontSize: 10, color: coffee.accent, fontWeight: '900' }}>
                          {myActiveMon?.type?.toUpperCase()}
                        </Text>
                      </View>

                      {/* Player Monster Row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 }}>
                        <View
                          style={{
                            width: 50,
                            height: 50,
                            borderRadius: 25,
                            backgroundColor: '#3b2214',
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderWidth: 1.5,
                            borderColor: myActiveMon?.isShiny ? '#fbbf24' : coffee.accent,
                          }}
                        >
                          <Text style={{ fontSize: 26 }}>{myActiveMon?.icon || '🐾'}</Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>
                              {myActiveMon?.name || 'Monster Anda'}
                              {myActiveMon?.isShiny ? ' ✨' : ''}
                            </Text>
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: getHpColor(myHpPct) }}>
                              {myActiveMon?.currentHp}/{myActiveMon?.maxHp} HP
                            </Text>
                          </View>

                          {/* HP Bar */}
                          <View
                            style={{
                              height: 8,
                              backgroundColor: '#171411',
                              borderRadius: 4,
                              overflow: 'hidden',
                              marginTop: 4,
                              borderWidth: 0.5,
                              borderColor: '#4a3319',
                            }}
                          >
                            <View
                              style={{
                                width: `${myHpPct}%`,
                                height: '100%',
                                backgroundColor: getHpColor(myHpPct),
                              }}
                            />
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
                            <Text style={{ fontSize: 9, color: coffee.muted }}>
                              ATK {myActiveMon?.attack || 0} | DEF {myActiveMon?.defense || 0}
                            </Text>
                            <Text style={{ fontSize: 9, color: '#fef08a', fontWeight: '700' }}>
                              ⚡ {myActiveMon?.skillName} ({myActiveMon?.skillPower})
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })()
            ) : table.game_type === 'truf' ? (
              <View style={{ width: '100%', maxWidth: 420, alignItems: 'center', paddingVertical: 6, gap: 8 }}>
                {gameState?.phase === 'bidding' ? (
                  <View style={{ width: '100%', backgroundColor: '#26150c', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#78350f', alignItems: 'center' }}>
                    <Text style={{ color: '#f59e0b', fontWeight: '900', fontSize: 13, marginBottom: 4 }}>
                      🎯 FASE TAWARAN TARGET (BIDDING)
                    </Text>
                    <Text style={{ color: coffee.muted, fontSize: 11, textAlign: 'center', marginBottom: 10 }}>
                      Pilih 1 kartu dari tangan Anda di bawah. Angka kartu = target trik (A=1 s/d K=13). Kartu tertinggi menentukan Bunga Truf.
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', width: '100%' }}>
                      {table.players?.map((p: any) => {
                        const bid = gameState?.bids?.[p.user_id];
                        const isCurrentTurn = gameState?.currentTurn === p.user_id;
                        return (
                          <View
                            key={p.user_id}
                            style={{
                              backgroundColor: isCurrentTurn ? '#3d1f11' : '#1f130a',
                              borderWidth: 1,
                              borderColor: isCurrentTurn ? coffee.accent : '#5c3d24',
                              borderRadius: 8,
                              paddingHorizontal: 8,
                              paddingVertical: 5,
                              minWidth: 90,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }} numberOfLines={1}>
                              {p.display_name}
                            </Text>
                            {bid ? (
                              <Text style={{ color: '#22c55e', fontSize: 10, fontWeight: '800', marginTop: 2 }}>
                                ✓ {bid.card?.rank} {SUIT_META[bid.card?.suit]?.symbol} ({bid.target} Trik)
                              </Text>
                            ) : (
                              <Text style={{ color: isCurrentTurn ? '#f59e0b' : coffee.muted, fontSize: 10, marginTop: 2 }}>
                                {isCurrentTurn ? '⏳ Memilih...' : 'Menunggu'}
                              </Text>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : gameState?.phase === 'scoring' ? (
                  <View style={{ width: '100%', backgroundColor: '#26150c', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#78350f', alignItems: 'center' }}>
                    <Text style={{ color: '#22c55e', fontWeight: '900', fontSize: 14, marginBottom: 2 }}>
                      🏁 PERMAINAN TRUF SELESAI
                    </Text>
                    <Text style={{ color: coffee.accent, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>
                      Mode: {gameState?.mode === 'main_atas' ? 'Main Atas 📈 (Total Bid > 13)' : 'Main Bawah 📉 (Total Bid < 13)'} • Total Bid: {gameState?.totalBids}
                    </Text>
                    <View style={{ width: '100%', gap: 4 }}>
                      {table.players?.map((p: any) => {
                        const target = gameState?.bids?.[p.user_id]?.target ?? 0;
                        const won = gameState?.tricksWon?.[p.user_id] ?? 0;
                        const score = gameState?.scores?.[p.user_id] ?? 0;
                        const isSuccess = gameState?.mode === 'main_atas' ? won >= target : won <= target;
                        return (
                          <View
                            key={p.user_id}
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              backgroundColor: '#1f130a',
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 6,
                              borderWidth: 0.5,
                              borderColor: '#5c3d24',
                            }}
                          >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{p.display_name}</Text>
                            <Text style={{ color: coffee.muted, fontSize: 11 }}>
                              Target: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{target}</Text> | Dapat: <Text style={{ color: '#fff', fontWeight: 'bold' }}>{won}</Text>
                            </Text>
                            <Text style={{ color: isSuccess ? '#22c55e' : '#ef4444', fontWeight: '900', fontSize: 12 }}>
                              {score > 0 ? `+${score}` : score} Poin {isSuccess ? '🎯' : '💥'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  /* Truf Playing Phase */
                  <View style={{ width: '100%', alignItems: 'center', gap: 6 }}>
                    {/* Truf Meta Info Badges */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                      <View style={{ backgroundColor: '#2c1e14', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: coffee.border }}>
                        <Text style={{ color: coffee.accent, fontWeight: 'bold', fontSize: 11 }}>
                          🃏 Truf: {gameState?.trumpSuit ? `${SUIT_META[gameState.trumpSuit]?.symbol} ${SUIT_META[gameState.trumpSuit]?.label}` : 'Tanpa Truf'}
                        </Text>
                      </View>
                      <View style={{ backgroundColor: '#2c1e14', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: coffee.border }}>
                        <Text style={{ color: gameState?.mode === 'main_atas' ? '#22c55e' : '#38bdf8', fontWeight: 'bold', fontSize: 11 }}>
                          {gameState?.mode === 'main_atas' ? '📈 Main Atas' : '📉 Main Bawah'} (Bid: {gameState?.totalBids})
                        </Text>
                      </View>
                      <View style={{ backgroundColor: '#2c1e14', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: coffee.border }}>
                        <Text style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: 11 }}>
                          Trik #{gameState?.trickNumber || 1} / 13
                        </Text>
                      </View>
                    </View>

                    {/* Trick Cards On Table */}
                    <View style={{ flexDirection: 'row', gap: 10, minHeight: 76, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}>
                      {gameState?.currentTrick && gameState.currentTrick.length > 0 ? (
                        gameState.currentTrick.map((tr: any, i: number) => {
                          const player = table.players?.find((p: any) => p.user_id === tr.playerId);
                          return (
                            <View key={i} style={{ alignItems: 'center' }}>
                              <PlayingCardTile card={tr.card} isFaceDown={Boolean(tr.isFaceDown)} />
                              <Text style={{ fontSize: 9, color: coffee.accent, marginTop: 3, fontWeight: '600' }} numberOfLines={1}>
                                {player?.display_name || `P${i + 1}`}
                              </Text>
                              {tr.isFaceDown && (
                                <Text style={{ fontSize: 8, color: '#f59e0b', fontWeight: 'bold' }}>Truf Tertutup</Text>
                              )}
                            </View>
                          );
                        })
                      ) : (
                        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
                          <Text style={{ fontSize: 12, color: coffee.muted }}>
                            Menunggu pemain pertama membuka trik...
                          </Text>
                          {gameState?.lastTrickWinner && (
                            <Text style={{ fontSize: 11, color: coffee.accent, marginTop: 3 }}>
                              🏆 Trik lalu dimenangkan oleh: {table.players?.find((p: any) => p.user_id === gameState.lastTrickWinner)?.display_name || gameState.lastTrickWinner}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              /* Bridge Current Trick and Trump */
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 10 }}>
                <View style={{ backgroundColor: '#2c1e14', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: coffee.border }}>
                  <Text style={{ color: coffee.accent, fontWeight: 'bold', fontSize: 12 }}>
                    🃏 Truf: {gameState?.trumpSuit ? SUIT_META[gameState.trumpSuit]?.symbol + ' ' + SUIT_META[gameState.trumpSuit]?.label : 'Tidak Ada'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, minHeight: 68, alignItems: 'center', justifyContent: 'center' }}>
                  {gameState?.currentTrick && gameState.currentTrick.length > 0 ? (
                    gameState.currentTrick.map((tr: any, i: number) => (
                      <View key={i} style={{ alignItems: 'center' }}>
                        <PlayingCardTile card={tr.card} />
                        <Text style={{ fontSize: 9, color: coffee.muted, marginTop: 2 }}>Pemain {i + 1}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ fontSize: 12, color: coffee.muted }}>Menunggu trik dibuka...</Text>
                  )}
                </View>
              </View>
            )
          ) : (
            <View style={styles.idleTablePlaceholder}>
              <Text style={{ fontSize: 38, marginBottom: 8 }}>
                {table.game_type === 'catur' ? '♟️♞' : table.game_type === 'gapleh' ? '☕🁫' : '☕🃏'}
              </Text>
              <Text style={styles.idleTableTitle}>Meja {table.game_type?.toUpperCase()} Siap Digelar</Text>
              <Text style={styles.idleTableSub}>
                Tarik kursi warkop, nikmati kopi hangat, dan bersiap mulai bertanding!
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Turn Action Bar / Quick Emotes */}
      <View style={styles.actionToolbar}>
        {/* Quick Emotes Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {QUICK_EMOTES.map((em) => (
            <TouchableOpacity key={em} style={styles.quickEmoteBtn} onPress={() => sendEmote(em)}>
              <Text style={{ fontSize: 18 }}>{em}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Multi-game turn action buttons */}
        {isMyTurn && table.game_type === 'gapleh' && (
          <TouchableOpacity
            style={[styles.passBtn, !gameState?.canPass && styles.passBtnDisabled]}
            onPress={handlePass}
            disabled={!gameState?.canPass}
          >
            <Ionicons name="play-forward" size={16} color={coffee.buttonText} />
            <Text style={styles.passBtnText}>Lewat (Pass)</Text>
          </TouchableOpacity>
        )}

        {isMyTurn && table.game_type === 'poker' && (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity style={styles.passBtn} onPress={() => handlePokerAction('check')}>
              <Text style={styles.passBtnText}>Check</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.passBtn, { backgroundColor: coffee.accent }]} onPress={() => handlePokerAction('bet')}>
              <Text style={[styles.passBtnText, { color: '#171411', fontWeight: 'bold' }]}>Bet 10 🪙</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.passBtn, { backgroundColor: '#7f1d1d' }]} onPress={() => handlePokerAction('fold')}>
              <Text style={styles.passBtnText}>Fold ❌</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Truf Turn Guidance */}
        {isMyTurn && table.game_type === 'truf' && (
          <View style={{ backgroundColor: '#26150c', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: coffee.accent, marginVertical: 4, alignItems: 'center' }}>
            <Text style={{ color: coffee.accent, fontWeight: 'bold', fontSize: 12 }}>
              {gameState?.phase === 'bidding'
                ? '🎯 Giliran Anda! Pilih 1 kartu di bawah untuk menentukan Target & Bunga Truf.'
                : '🃏 Giliran Anda! Mainkan kartu yang sesuai dengan bunga pembuka.'}
            </Text>
          </View>
        )}

        {/* UNO Turn & Shout Controls */}
        {table.game_type === 'uno' && isPlaying && !isSpectator && (
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {isMyTurn && (
              <TouchableOpacity
                style={[styles.passBtn, { backgroundColor: '#4f46e5' }]}
                onPress={handleUnoDraw}
              >
                <Text style={styles.passBtnText}>Ambil (+1) 🂠</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.passBtn,
                { backgroundColor: gameState?.hasCalledUno ? '#15803d' : '#dc2626' },
              ]}
              onPress={handleUnoShout}
            >
              <Text style={[styles.passBtnText, { fontWeight: '900' }]}>
                {gameState?.hasCalledUno ? '✅ SUDAH UNO' : 'TERIAK UNO! 📢'}
              </Text>
            </TouchableOpacity>

            {/* Catch Uno Button if an opponent has 1 card without calling Uno */}
            {gameState?.playersSummary?.some((p: any) => p.user_id !== currentUserId && p.cardCount === 1 && !p.hasCalledUno) && (
              <TouchableOpacity
                style={[styles.passBtn, { backgroundColor: '#ea580c' }]}
                onPress={() => {
                  const target = gameState.playersSummary.find((p: any) => p.user_id !== currentUserId && p.cardCount === 1 && !p.hasCalledUno);
                  if (target) handleCatchUno(target.user_id);
                }}
              >
                <Text style={[styles.passBtnText, { fontWeight: '800' }]}>🚨 Tangkap UNO!</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Snake & Ladder Action */}
        {table.game_type === 'snake_ladder' && isPlaying && !isSpectator && (
          <TouchableOpacity
            style={[
              styles.passBtn,
              { backgroundColor: isMyTurn ? '#d97706' : '#4b5563' },
              !isMyTurn && styles.passBtnDisabled,
            ]}
            onPress={handleSnakeLadderRoll}
            disabled={!isMyTurn}
          >
            <Text style={[styles.passBtnText, { fontWeight: '900', fontSize: 13 }]}>
              {isMyTurn ? '🎲 LEMPAR DADU!' : 'Menunggu Giliran ⏳'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Monopoly Actions */}
        {table.game_type === 'monopoly' && isPlaying && !isSpectator && isMyTurn && (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {!gameState?.hasRolled && (
              <TouchableOpacity
                style={[styles.passBtn, { backgroundColor: '#d97706', minWidth: 120 }]}
                onPress={handleMonopolyRoll}
              >
                <Text style={[styles.passBtnText, { fontWeight: '900', fontSize: 12 }]}>🎲 LEMPAR DADU!</Text>
              </TouchableOpacity>
            )}

            {gameState?.pendingAction?.type === 'buy_property' && (
              <>
                <TouchableOpacity
                  style={[styles.passBtn, { backgroundColor: '#15803d', minWidth: 110 }]}
                  onPress={handleMonopolyBuyProperty}
                >
                  <Text style={[styles.passBtnText, { fontWeight: '900', fontSize: 11 }]}>
                    💰 Beli (Rp {gameState.pendingAction.amount})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.passBtn, { backgroundColor: '#b91c1c', minWidth: 80 }]}
                  onPress={handleMonopolySkipBuy}
                >
                  <Text style={[styles.passBtnText, { fontWeight: '900', fontSize: 11 }]}>❌ Lewat</Text>
                </TouchableOpacity>
              </>
            )}

            {gameState?.hasRolled && !gameState?.pendingAction && (
              <TouchableOpacity
                style={[styles.passBtn, { backgroundColor: '#2563eb', minWidth: 120 }]}
                onPress={handleMonopolyEndTurn}
              >
                <Text style={[styles.passBtnText, { fontWeight: '900', fontSize: 12 }]}>✅ Selesai Giliran</Text>
              </TouchableOpacity>
            )}

            {gameState?.players?.[currentUserId]?.inJail && (
              <TouchableOpacity
                style={[styles.passBtn, { backgroundColor: '#7c3aed', minWidth: 120 }]}
                onPress={handleMonopolyPayJailFine}
              >
                <Text style={[styles.passBtnText, { fontWeight: '800', fontSize: 11 }]}>🔓 Denda (Rp 50)</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Pokemon Battle Action Controls */}
        {table.game_type === 'pokemon' && isPlaying && !isSpectator && (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {isMyTurn ? (
              <>
                <TouchableOpacity
                  style={[styles.passBtn, { backgroundColor: '#b91c1c', minWidth: 90 }]}
                  onPress={() => handlePokemonAttack(false)}
                >
                  <Text style={[styles.passBtnText, { fontWeight: '900', fontSize: 12 }]}>🗡️ Serang</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.passBtn, { backgroundColor: '#ea580c', minWidth: 110 }]}
                  onPress={() => handlePokemonAttack(true)}
                >
                  <Text style={[styles.passBtnText, { fontWeight: '900', fontSize: 12 }]}>
                    ✨ Jurus Elemen
                  </Text>
                </TouchableOpacity>

                {gameState?.players?.[currentUserId]?.team?.map((benchMon: any, bIdx: number) => {
                  if (bIdx === gameState?.players?.[currentUserId]?.activeIndex || benchMon.isFainted) return null;
                  return (
                    <TouchableOpacity
                      key={bIdx}
                      style={[styles.passBtn, { backgroundColor: '#0284c7', minWidth: 85 }]}
                      onPress={() => handlePokemonSwitch(bIdx)}
                    >
                      <Text style={[styles.passBtnText, { fontWeight: '800', fontSize: 11 }]}>
                        🔄 {benchMon.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            ) : (
              <View style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, color: coffee.muted, fontStyle: 'italic' }}>
                  ⏳ Giliran pelatih lawan...
                </Text>
              </View>
            )}
          </View>
        )}

        {isMyTurn && table.game_type === 'catur' && (
          <TouchableOpacity
            style={[styles.passBtn, { backgroundColor: '#7f1d1d' }]}
            onPress={() => {
              Alert.alert('Menyerah', 'Apakah Anda yakin ingin menyerah?', [
                { text: 'Batal', style: 'cancel' },
                {
                  text: 'Ya, Menyerah',
                  style: 'destructive',
                  onPress: () => socketRef.current?.emit('game:action', { tableId, action: 'resign', payload: {} }),
                },
              ]);
            }}
          >
            <Text style={styles.passBtnText}>Menyerah 🏳️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Player's Secret Hand (Bawah) */}
      {isPlaying && !isSpectator && (
        <View style={styles.myHandSection}>
          <View style={styles.handHeaderRow}>
            <Text style={styles.handSectionTitle}>
              {table.game_type === 'catur'
                ? `Papan Catur: Anda ${gameState?.whitePlayerId === currentUserId ? 'Putih ⚪ (Jalan Duluan)' : 'Hitam ⚫'}`
                : table.game_type === 'uno'
                ? `Kartu UNO Anda (${myCards.length})`
                : table.game_type === 'snake_ladder'
                ? `Posisi Pion Anda: Kotak ${gameState?.players?.[currentUserId]?.position ?? 1} / 100`
                : table.game_type === 'monopoly'
                ? `Aset Monopoli Anda (Saldo: Rp ${gameState?.players?.[currentUserId]?.money ?? 0})`
                : table.game_type === 'pokemon'
                ? `Monster Anda: Klik Cadangan untuk Bertukar (${gameState?.players?.[currentUserId]?.team?.filter((m: any) => !m.isFainted).length ?? 0}/3 Siap)`
                : table.game_type === 'truf' && gameState?.phase === 'bidding'
                ? `Pilih 1 Kartu untuk Bid Target (${myCards.length} Kartu)`
                : `Kartu di Tangan Anda (${table.game_type === 'gapleh' ? myHand.length : myCards.length})`}
            </Text>
            {isMyTurn && (
              <View style={styles.turnPulseBanner}>
                <Text style={styles.turnPulseText}>✨ GILIRAN ANDA</Text>
              </View>
            )}
          </View>

          {table.game_type === 'gapleh' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.handTilesScroll}
            >
              {myHand.map((card, idx) => {
                const isPlayable =
                  isMyTurn &&
                  validMoves.some(
                    (m: any) =>
                      (m.card[0] === card[0] && m.card[1] === card[1]) ||
                      (m.card[0] === card[1] && m.card[1] === card[0])
                  );

                return (
                  <DominoTile
                    key={idx}
                    card={card}
                    size="large"
                    highlight={isPlayable}
                    disabled={!isPlayable}
                    onPress={() => handleCardPress(card)}
                  />
                );
              })}
            </ScrollView>
          ) : table.game_type === 'uno' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              {myCards.map((card, idx) => (
                <UnoCardTile
                  key={card.id || idx}
                  card={card}
                  size="large"
                  highlight={isMyTurn}
                  disabled={!isMyTurn}
                  onPress={() => handleUnoCardPress(card)}
                />
              ))}
            </ScrollView>
          ) : table.game_type === 'snake_ladder' ? (
            <View style={{ paddingVertical: 4, gap: 6 }}>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {Object.values(gameState?.players || {}).map((pl: any) => {
                  const pInfo = table.players?.find((p: any) => p.user_id === pl.userId);
                  const isCurrent = gameState?.currentTurn === pl.userId;
                  return (
                    <View
                      key={pl.userId}
                      style={{
                        backgroundColor: isCurrent ? 'rgba(212, 163, 115, 0.25)' : '#2c1e14',
                        borderColor: isCurrent ? coffee.accent : coffee.border,
                        borderWidth: 1,
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                      }}
                    >
                      <Text style={{ color: isCurrent ? coffee.accent : coffee.text, fontSize: 11, fontWeight: '700' }}>
                        {pInfo?.display_name || pl.userId}: Kotak {pl.position} {isCurrent ? '🎲' : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : table.game_type === 'monopoly' ? (
            /* Monopoly Player Asset & Balance Cards */
            <View style={{ paddingVertical: 4, gap: 6 }}>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                {Object.values(gameState?.players || {}).map((pl: any) => {
                  const pInfo = table.players?.find((p: any) => p.user_id === pl.userId);
                  const isCurrent = gameState?.currentTurn === pl.userId;
                  const isMe = pl.userId === currentUserId;
                  const propCount = pl.properties?.length || 0;
                  return (
                    <View
                      key={pl.userId}
                      style={{
                        backgroundColor: isCurrent ? 'rgba(212, 163, 115, 0.25)' : '#2c1e14',
                        borderColor: isMe ? '#38bdf8' : isCurrent ? coffee.accent : coffee.border,
                        borderWidth: isMe ? 2 : 1,
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        minWidth: 100,
                      }}
                    >
                      <Text style={{ color: isMe ? '#38bdf8' : isCurrent ? coffee.accent : coffee.text, fontSize: 11, fontWeight: '800' }}>
                        {pInfo?.display_name || pl.userId} {isMe ? '(Anda)' : ''} {isCurrent ? '🎲' : ''}
                      </Text>
                      <Text style={{ color: pl.isBankrupt ? '#ef4444' : '#22c55e', fontSize: 11, fontWeight: '700' }}>
                        {pl.isBankrupt ? '💀 BANGKRUT' : `💰 Rp ${pl.money}`}
                      </Text>
                      <Text style={{ color: coffee.muted, fontSize: 9 }}>
                        🏠 {propCount} Properti {pl.inJail ? '• 🔒 Penjara' : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* My Owned Properties with Build House option */}
              {gameState?.players?.[currentUserId]?.properties?.length > 0 && (
                <View style={{ marginTop: 4 }}>
                  <Text style={{ fontSize: 10, color: coffee.muted, marginBottom: 4, textAlign: 'center' }}>
                    Properti Anda (Klik untuk bangun Rumah jika punya 1 kelompok warna):
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}>
                    {gameState.players[currentUserId].properties.map((sqId: number) => {
                      const sq = gameState.squares?.[sqId];
                      const prop = gameState.properties?.[sqId];
                      const houses = prop?.houses || 0;
                      return (
                        <TouchableOpacity
                          key={sqId}
                          style={{
                            backgroundColor: '#1e140d',
                            borderColor: MONOPOLY_GROUP_COLORS[sq?.group || ''] || coffee.border,
                            borderWidth: 1.5,
                            borderRadius: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            alignItems: 'center',
                          }}
                          onPress={() => isMyTurn && handleMonopolyBuildHouse(sqId)}
                          disabled={!isMyTurn}
                        >
                          <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '700' }}>{sq?.name || `Kotak ${sqId}`}</Text>
                          <Text style={{ color: coffee.accent, fontSize: 9 }}>
                            {houses >= 5 ? '🏨 Hotel' : houses > 0 ? `🏠 x${houses}` : `Rp ${sq?.price || 0}`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          ) : table.game_type === 'pokemon' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              {gameState?.players?.[currentUserId]?.team?.map((mon: any, idx: number) => {
                const isActive = idx === gameState?.players?.[currentUserId]?.activeIndex;
                const isFainted = mon.isFainted;
                return (
                  <TouchableOpacity
                    key={idx}
                    disabled={isActive || isFainted || !isMyTurn}
                    onPress={() => handlePokemonSwitch(idx)}
                    style={{
                      backgroundColor: isActive ? '#3b1c11' : isFainted ? '#27272a' : '#1c1917',
                      borderColor: isActive ? coffee.accent : isFainted ? '#52525b' : coffee.border,
                      borderWidth: isActive ? 2 : 1,
                      borderRadius: 10,
                      padding: 8,
                      width: 120,
                      alignItems: 'center',
                      opacity: isFainted ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 24 }}>{mon.icon || '🐾'}</Text>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#fff', marginTop: 2 }} numberOfLines={1}>
                      {mon.name}
                    </Text>
                    <Text style={{ fontSize: 10, color: isFainted ? '#ef4444' : isActive ? '#22c55e' : coffee.accent, marginTop: 2, fontWeight: '700' }}>
                      {isFainted ? '💀 Pingsan' : isActive ? '🟢 Aktif' : `HP ${mon.currentHp}/${mon.maxHp}`}
                    </Text>
                    {!isActive && !isFainted && isMyTurn && (
                      <View style={{ marginTop: 4, backgroundColor: '#0284c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, color: '#fff', fontWeight: 'bold' }}>Pilih Ganti</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : table.game_type !== 'catur' ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              {myCards.map((card, idx) => {
                const isTrufBidding = table.game_type === 'truf' && gameState?.phase === 'bidding';
                const rankToTarget: Record<string, number> = {
                  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
                  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13,
                };
                const bidTarget = rankToTarget[card.rank] ?? card.rank;
                return (
                  <View key={idx} style={{ alignItems: 'center' }}>
                    <PlayingCardTile
                      card={card}
                      size="large"
                      highlight={isMyTurn}
                      disabled={!isMyTurn}
                      onPress={() => handlePlayCardAction(card)}
                    />
                    {isTrufBidding && (
                      <View style={{ backgroundColor: '#2c1e14', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, borderWidth: 0.5, borderColor: coffee.accent }}>
                        <Text style={{ fontSize: 10, color: coffee.accent, fontWeight: 'bold' }}>{bidTarget} Trik</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
      )}

      {/* Choice Modal: Play on Left or Right Side */}
      <Modal visible={!!pendingCard} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilih Ujung Meja</Text>
            <Text style={styles.modalSub}>
              Kartu ini cocok ditempel di ujung Kiri atau Kanan:
            </Text>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              <TouchableOpacity
                style={styles.sideChoiceBtn}
                onPress={() => pendingCard && executePlayCard(pendingCard, 'left')}
              >
                <Ionicons name="arrow-back" size={18} color={coffee.buttonText} />
                <Text style={styles.sideChoiceBtnText}>Tempel Kiri</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sideChoiceBtn}
                onPress={() => pendingCard && executePlayCard(pendingCard, 'right')}
              >
                <Text style={styles.sideChoiceBtnText}>Tempel Kanan</Text>
                <Ionicons name="arrow-forward" size={18} color={coffee.buttonText} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelChoiceBtn}
              onPress={() => setPendingCard(null)}
            >
              <Text style={{ color: coffee.secondary, fontSize: 13 }}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Wild Card Color Picker Modal */}
      <Modal visible={!!wildPickerCard} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: 4 }}>🌈</Text>
            <Text style={[styles.modalTitle, { textAlign: 'center' }]}>Pilih Warna Kartu Wild</Text>
            <Text style={[styles.modalSub, { textAlign: 'center', marginTop: 4 }]}>
              Tentukan warna aktif yang harus dimainkan pemain berikutnya:
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16, justifyContent: 'center' }}>
              {(['red', 'yellow', 'green', 'blue'] as const).map((color) => {
                const meta = UNO_COLOR_MAP[color];
                return (
                  <TouchableOpacity
                    key={color}
                    style={{
                      width: '45%',
                      backgroundColor: meta.bg,
                      borderColor: meta.border,
                      borderWidth: 2,
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onPress={() => {
                      if (wildPickerCard) {
                        executePlayUnoCard(wildPickerCard.id, color);
                        setWildPickerCard(null);
                      }
                    }}
                  >
                    <Text style={{ color: meta.text, fontWeight: '900', fontSize: 16 }}>
                      {meta.label.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.cancelChoiceBtn, { marginTop: 16 }]}
              onPress={() => setWildPickerCard(null)}
            >
              <Text style={{ color: coffee.secondary, fontSize: 13, textAlign: 'center' }}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bot Selection Modal for Level 2 (Task 2.2) */}
      <Modal visible={botPickerVisible} transparent animationType="fade" onRequestClose={() => setBotPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 420 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={styles.modalTitle}>Pilih Karakter Bot 🤖</Text>
                <Text style={{ color: coffee.secondary, fontSize: 11, marginTop: 2 }}>
                  Gapleh Rame (Level 2) — Pilih lawan tanding
                </Text>
              </View>
              <TouchableOpacity onPress={() => setBotPickerVisible(false)}>
                <Ionicons name="close" size={22} color={coffee.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 8 }}>
              {GAPLEH_BOTS.map((bot) => {
                const isAlreadySeated = table.players?.some((p: any) => p.user_id === bot.id || p.username === bot.id);
                return (
                  <TouchableOpacity
                    key={bot.id}
                    disabled={isAlreadySeated}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 10,
                      backgroundColor: isAlreadySeated ? 'rgba(0,0,0,0.3)' : '#231810',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: isAlreadySeated ? '#3d2b1f' : '#ea580c',
                      opacity: isAlreadySeated ? 0.4 : 1,
                      gap: 12,
                    }}
                    onPress={() => handleAddBot(bot.id)}
                  >
                    <Text style={{ fontSize: 24 }}>{bot.avatar}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ color: coffee.text, fontWeight: '800', fontSize: 13 }}>
                          {bot.name} ({bot.title})
                        </Text>
                        <View style={{ backgroundColor: 'rgba(234, 88, 12, 0.2)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                          <Text style={{ color: '#fb923c', fontSize: 10, fontWeight: '800' }}>{bot.difficulty}</Text>
                        </View>
                      </View>
                      <Text style={{ color: coffee.secondary, fontSize: 11, marginTop: 2 }}>
                        {isAlreadySeated ? '✓ Sudah ada di meja' : bot.personality}
                      </Text>
                    </View>
                    {!isAlreadySeated && (
                      <Ionicons name="chevron-forward" size={18} color={coffee.accent} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#2a1e15', borderWidth: 1, borderColor: coffee.border, alignItems: 'center' }}
                onPress={() => handleAddBot()}
              >
                <Text style={{ color: coffee.text, fontSize: 12, fontWeight: '700' }}>🎲 Bot Acak</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: coffee.surface, alignItems: 'center' }}
                onPress={() => setBotPickerVisible(false)}
              >
                <Text style={{ color: coffee.secondary, fontSize: 12, fontWeight: '700' }}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Game Over Results Modal */}
      <Modal visible={resultModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 420 }]}>
            <Text style={{ fontSize: 44, textAlign: 'center', marginBottom: 6 }}>🏆</Text>
            <Text style={[styles.modalTitle, { textAlign: 'center' }]}>
              {gameResult?.gameMode === 'partnership' || gameState?.gameMode === 'partnership' || table.config?.gaplehMode === 'partnership'
                ? (gameResult?.winningTeam ? `Tim ${gameResult.winningTeam} Menang!` : 'Putaran Seri!')
                : 'Permainan Selesai'}
            </Text>
            <Text style={[styles.modalSub, { textAlign: 'center', marginTop: 4, lineHeight: 18 }]}>
              {gameResult?.summary || 'Pertandingan selesai.'}
            </Text>

            {/* Formula Explanation Callout */}
            {gameResult?.formulaExplanation && (
              <View
                style={{
                  backgroundColor: 'rgba(212, 163, 115, 0.1)',
                  borderColor: coffee.accent,
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 10,
                  marginTop: 10,
                }}
              >
                <Text style={{ color: coffee.accent, fontSize: 11, fontWeight: '800', marginBottom: 2 }}>
                  ℹ️ Penjelasan Perhitungan Skor:
                </Text>
                <Text style={{ color: coffee.text, fontSize: 11, lineHeight: 16 }}>
                  {gameResult.formulaExplanation}
                </Text>
              </View>
            )}

            {/* Winner Points Banner */}
            {gameResult?.winners?.includes(currentUserId) && (
              <View
                style={{
                  backgroundColor: 'rgba(212, 163, 115, 0.2)',
                  borderColor: coffee.accent,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 10,
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Text style={{ color: coffee.accent, fontSize: 16, fontWeight: '800' }}>
                  🎉 SELAMAT! ANDA MENANG!
                </Text>
                <Text style={{ color: coffee.text, fontSize: 13, fontWeight: '700' }}>
                  ⭐ +{gameResult?.pointsAwarded ?? 50} Poin Kopi Warkop telah dikumpulkan!
                </Text>
                <Text style={{ color: coffee.secondary, fontSize: 11 }}>
                  Poin Anda tersimpan permanen di profil akun Anda.
                </Text>
              </View>
            )}

            {/* Team Pip Breakdown for Partnership Mode */}
            {gameResult?.teamPips && (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  marginTop: 10,
                  justifyContent: 'space-between',
                }}
              >
                <View
                  style={{
                    flex: 1,
                    backgroundColor: '#1e3a8a',
                    padding: 8,
                    borderRadius: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#93c5fd', fontSize: 11, fontWeight: '900' }}>TIM A</Text>
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900' }}>
                    {gameResult.teamPips.A} Mata
                  </Text>
                  <Text style={{ color: '#bfdbfe', fontSize: 10 }}>Total Sisa Kartu</Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: '#7c2d12',
                    padding: 8,
                    borderRadius: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fdba74', fontSize: 11, fontWeight: '900' }}>TIM B</Text>
                  <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '900' }}>
                    {gameResult.teamPips.B} Mata
                  </Text>
                  <Text style={{ color: '#fed7aa', fontSize: 10 }}>Total Sisa Kartu</Text>
                </View>
              </View>
            )}

            {/* Scores & Individual Pips Breakdown */}
            {gameResult?.scores && (
              <View style={styles.scoresListContainer}>
                <Text style={styles.scoresListTitle}>Rincian Sisa Mata Batu Pemain:</Text>
                {Object.entries(gameResult.scores).map(([uid, pips]) => {
                  const p = table.players?.find((pl: any) => pl.user_id === uid);
                  const isWinner = gameResult.winners?.includes(uid);
                  const isPartnership = table.game_type === 'gapleh' && (table.config?.gaplehMode === 'partnership' || gameState?.gameMode === 'partnership');
                  const teamLabel = isPartnership ? `[Tim ${p?.team || (p?.seat_number % 2 === 0 ? 'A' : 'B')}] ` : '';
                  return (
                    <View key={uid} style={styles.scoreRow}>
                      <Text style={[styles.scoreName, isWinner && { color: coffee.accent, fontWeight: '800' }]}>
                        {teamLabel}{p?.display_name || uid} {isWinner ? '👑 Pemenang' : ''}
                      </Text>
                      <Text style={styles.scorePips}>{pips as number} Mata</Text>
                    </View>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                backgroundColor: '#16a34a',
                borderRadius: 12,
                minHeight: 44,
                marginBottom: 8,
                paddingHorizontal: 16,
              }}
              onPress={handleShareVictory}
            >
              <Ionicons name="share-social-outline" size={18} color="#FFF" />
              <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>
                Bagikan Kemenangan ke Sosmed 📢
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.playAgainBtn, { marginTop: 4 }]}
              onPress={() => {
                setResultModalVisible(false);
                if (socketRef.current && tableId) {
                  socketRef.current.emit('table:reset', { tableId }, () => {
                    fetchTableState();
                  });
                } else {
                  fetchTableState();
                }
              }}
            >
              <Text style={styles.playAgainBtnText}>Tutup & Siap Main Lagi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Gapleh Viral Social Media Share Modal (Task 3) */}
      <GaplehShareModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        data={{
          winType: gameResult?.winType || (gameState as any)?.winType || 'gapleh_biasa',
          username: currentUsername || 'Ngopikawan',
          pointsEarned: gameResult?.pointsAwarded ?? 50,
          streakCount: gameResult?.pointsDetails?.streakCount ?? 1,
          isFirstNutup: Boolean(gameResult?.pointsDetails?.isFirstNutup),
          totalPoints: gameResult?.playerPoints?.[currentUserId] ?? 500,
        }}
      />

      {/* In-Game Chat Drawer / Modal */}
      <Modal
        visible={chatVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setChatVisible(false)}
      >
        <View style={styles.chatModalOverlay}>
          <View style={styles.chatModalPanel}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatTitle}>Obrolan Meja ☕</Text>
              <TouchableOpacity onPress={() => setChatVisible(false)}>
                <Ionicons name="close" size={20} color={coffee.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, gap: 8 }}>
              {chatMessages.length === 0 ? (
                <Text style={{ color: coffee.muted, textAlign: 'center', marginTop: 20 }}>
                  Belum ada percakapan di meja ini.
                </Text>
              ) : (
                chatMessages.map((m) => (
                  <View key={m.id} style={styles.chatBubble}>
                    <Text style={styles.chatSender}>{m.senderName}:</Text>
                    <Text style={styles.chatMsgText}>{m.message}</Text>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.chatInputRow}>
              <TextInput
                style={styles.chatTextInput}
                value={chatInput}
                onChangeText={setChatInput}
                placeholder="Kirim obrolan meja..."
                placeholderTextColor={coffee.muted}
                onSubmitEditing={sendChatMessage}
              />
              <TouchableOpacity style={styles.chatSendBtn} onPress={sendChatMessage}>
                <Ionicons name="send" size={16} color={coffee.buttonText} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1712', // Warm warkop ambiance dark tone
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: coffee.secondary,
    fontSize: 13,
    marginTop: 10,
  },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: coffee.surface,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
    zIndex: 10,
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
    fontSize: 16,
    fontWeight: '800',
  },
  headerSub: {
    color: coffee.secondary,
    fontSize: 11,
    marginTop: 1,
  },
  socialIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: coffee.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingControlsBanner: {
    backgroundColor: coffee.surface,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  waitingText: {
    color: coffee.secondary,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  addBotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: coffee.raised,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: coffee.accent,
  },
  addBotBtnText: {
    color: coffee.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: coffee.button,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
  },
  startBtnText: {
    color: coffee.buttonText,
    fontSize: 13,
    fontWeight: '800',
  },
  readyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: coffee.raised,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  readyBtnActive: {
    backgroundColor: coffee.success,
  },
  readyBtnText: {
    color: coffee.text,
    fontSize: 12,
    fontWeight: '700',
  },
  readyBtnTextActive: {
    color: coffee.buttonText,
    fontWeight: '800',
  },
  seatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  playerSeatCard: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    minWidth: 70,
  },
  playerSeatCardActive: {
    backgroundColor: 'rgba(212, 163, 115, 0.15)',
  },
  seatAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: coffee.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  seatAvatarText: {
    color: coffee.text,
    fontSize: 14,
    fontWeight: '800',
  },
  seatName: {
    color: coffee.text,
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 75,
  },
  cardCountText: {
    color: coffee.secondary,
    fontSize: 10,
    marginTop: 1,
  },
  turnIndicatorBadge: {
    color: coffee.accent,
    fontSize: 9,
    fontWeight: '900',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  tableArenaWrapper: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableFelt: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: '#1B3022', // Authentic casino felt green table
    borderWidth: 6,
    borderColor: '#4A3525', // Warm wood table rim
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  boardContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  endPipBadge: {
    backgroundColor: '#2E4C36',
    borderWidth: 1.5,
    borderColor: '#D4A373',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  endPipLabel: {
    color: '#D4A373',
    fontSize: 8,
    fontWeight: '900',
  },
  endPipValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
  },
  dominoChainScroll: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  emptyBoardNotice: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
  },
  emptyBoardText: {
    color: '#E0E0E0',
    fontSize: 13,
    fontWeight: '700',
  },
  idleTablePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  idleTableTitle: {
    color: '#F4ECE1',
    fontSize: 16,
    fontWeight: '800',
  },
  idleTableSub: {
    color: '#A89984',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  actionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: coffee.surface,
    borderTopWidth: 1,
    borderTopColor: coffee.border,
  },
  quickEmoteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: coffee.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: coffee.button,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  passBtnDisabled: {
    opacity: 0.4,
  },
  passBtnText: {
    color: coffee.buttonText,
    fontSize: 12,
    fontWeight: '800',
  },
  myHandSection: {
    backgroundColor: coffee.surface,
    borderTopWidth: 1,
    borderTopColor: coffee.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
  },
  handHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  handSectionTitle: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  turnPulseBanner: {
    backgroundColor: coffee.button,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  turnPulseText: {
    color: coffee.buttonText,
    fontSize: 10,
    fontWeight: '900',
  },
  handTilesScroll: {
    alignItems: 'center',
    paddingVertical: 4,
    gap: 6,
  },
  floatingEmotesContainer: {
    position: 'absolute',
    top: 100,
    right: 20,
    bottom: 200,
    left: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  floatingEmoteBubble: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  floatingEmoteSender: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
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
    maxWidth: 380,
    backgroundColor: coffee.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  modalTitle: {
    color: coffee.text,
    fontSize: 17,
    fontWeight: '800',
  },
  modalSub: {
    color: coffee.secondary,
    fontSize: 13,
  },
  sideChoiceBtn: {
    flex: 1,
    minHeight: 44,
    backgroundColor: coffee.button,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sideChoiceBtnText: {
    color: coffee.buttonText,
    fontSize: 13,
    fontWeight: '800',
  },
  cancelChoiceBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  scoresListContainer: {
    backgroundColor: coffee.raised,
    borderRadius: 10,
    padding: 12,
    marginVertical: 14,
    gap: 6,
  },
  scoresListTitle: {
    color: coffee.secondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreName: {
    color: coffee.text,
    fontSize: 13,
  },
  scorePips: {
    color: coffee.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  playAgainBtn: {
    minHeight: 44,
    backgroundColor: coffee.button,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playAgainBtnText: {
    color: coffee.buttonText,
    fontSize: 14,
    fontWeight: '800',
  },
  chatModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  chatModalPanel: {
    height: '60%',
    backgroundColor: coffee.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: coffee.border,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
  },
  chatTitle: {
    color: coffee.text,
    fontSize: 15,
    fontWeight: '800',
  },
  chatBubble: {
    backgroundColor: coffee.raised,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  chatSender: {
    color: coffee.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  chatMsgText: {
    color: coffee.text,
    fontSize: 13,
    marginTop: 2,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: coffee.border,
  },
  chatTextInput: {
    flex: 1,
    minHeight: 40,
    backgroundColor: coffee.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    color: coffee.text,
    fontSize: 14,
    outlineStyle: 'none' as any,
  },
  chatSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: coffee.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
