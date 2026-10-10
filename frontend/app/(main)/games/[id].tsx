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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { io, Socket } from 'socket.io-client';
import { coffee } from '../../../src/theme/coffee';
import { DominoTile } from '../../../src/components/DominoTile';
import axios from 'axios';
import { getAuthHeaders } from '../../../src/utils/api';
import * as SecureStore from '../../../src/utils/storage';

const SOCKET_URL = 'https://api.ngopi.top/games';
const API_URL = 'https://api.ngopi.top/api';

const QUICK_EMOTES = ['☕', '👏', '😂', '🔥', '💩', '😎'];

export default function GameTableScreen() {
  const { id: tableId, spectate } = useLocalSearchParams<{ id: string; spectate?: string }>();
  const { width } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [table, setTable] = useState<any>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [isSpectator, setIsSpectator] = useState<boolean>(spectate === '1');

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
        headers,
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

    socket.on('game:state_update', (data: { tableId: string; state: any }) => {
      if (data?.state) {
        setGameState(data.state);
        if (data.state.isFinished) {
          setGameResult({
            winners: [data.state.winnerId],
            scores: data.state.scores,
            summary: data.state.deadlock
              ? 'Gaple Buntu! Pemenang ditentukan oleh sisa kartu dengan poin terkecil.'
              : 'Permainan Selesai!',
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
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [tableId, currentUserId, currentUsername, fetchTableState]);

  // Host Action: Add Bot
  const handleAddBot = () => {
    if (!socketRef.current || !tableId) return;
    socketRef.current.emit('table:add_bot', { tableId }, (res: any) => {
      if (!res?.success) {
        Alert.alert('Gagal', res?.error || 'Gagal menambahkan bot.');
      }
    });
  };

  // Host Action: Start Game
  const handleStartGame = () => {
    if (!socketRef.current || !tableId) return;
    socketRef.current.emit('table:start', { tableId }, (res: any) => {
      if (!res?.success) {
        Alert.alert('Gagal Mulai', res?.error || 'Gagal memulai permainan.');
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

  // Player Action: Leave Table
  const handleLeaveTable = () => {
    Alert.alert('Keluar Meja', 'Apakah Anda yakin ingin meninggalkan meja ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: () => {
          if (socketRef.current && tableId) {
            socketRef.current.emit('table:leave', { tableId });
          }
          router.back();
        },
      },
    ]);
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
  const myHand: Array<[number, number]> = gameState?.myHand || [];
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
            {isPlaying ? '🟢 Pertandingan Berlangsung' : '🟡 Menunggu Pemain'} • {table.players?.length}/{table.max_players} Kursi
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
              ? `Menunggu minimal ${table.min_players} pemain untuk mulai.`
              : 'Semua pemain sudah siap. Host dapat memulai pertandingan!'}
          </Text>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {isHost && table.players?.length < table.max_players && (
              <TouchableOpacity style={styles.addBotBtn} onPress={handleAddBot}>
                <Ionicons name="hardware-chip-outline" size={16} color={coffee.accent} />
                <Text style={styles.addBotBtnText}>+ Tambah Bot</Text>
              </TouchableOpacity>
            )}

            {isHost && (
              <TouchableOpacity
                style={[
                  styles.startBtn,
                  table.players?.length < table.min_players && { opacity: 0.5 },
                ]}
                onPress={handleStartGame}
                disabled={table.players?.length < table.min_players}
              >
                <Ionicons name="play" size={16} color={coffee.buttonText} />
                <Text style={styles.startBtnText}>Mulai Main 🁫</Text>
              </TouchableOpacity>
            )}

            {!isHost && myPlayer && (
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
          </View>
        </View>
      )}

      {/* Seated Players Avatars Bar */}
      <View style={styles.seatsRow}>
        {table.players?.map((player: any) => {
          const isTurn = isPlaying && gameState?.currentTurn === player.user_id;
          const isMe = player.user_id === currentUserId;
          const cardCount = isMe
            ? myHand.length
            : gameState?.opponents?.[player.user_id]?.cardCount ?? 7;

          return (
            <View
              key={player.user_id}
              style={[styles.playerSeatCard, isTurn && styles.playerSeatCardActive]}
            >
              <View
                style={[
                  styles.seatAvatar,
                  isTurn && { borderColor: coffee.accent, borderWidth: 2 },
                ]}
              >
                <Text style={styles.seatAvatarText}>
                  {player.display_name.charAt(0) || 'U'}
                </Text>
              </View>
              <Text style={styles.seatName} numberOfLines={1}>
                {player.display_name} {isMe ? '(Anda)' : ''}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={styles.cardCountText}>
                  {player.is_bot ? '🤖 Bot' : '🁫'} {isPlaying ? `${cardCount} kartu` : player.is_ready ? 'Siap' : 'Menunggu'}
                </Text>
              </View>
              {isTurn && <Text style={styles.turnIndicatorBadge}>Gilirannya</Text>}
            </View>
          );
        })}
      </View>

      {/* Area Meja Permainan Warkop (Oval Felt Coffee Table) */}
      <View style={styles.tableArenaWrapper}>
        <View style={styles.tableFelt}>
          {isPlaying && gameState?.board ? (
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
          ) : (
            <View style={styles.idleTablePlaceholder}>
              <Text style={{ fontSize: 38, marginBottom: 8 }}>☕🁫</Text>
              <Text style={styles.idleTableTitle}>Meja Siap Digelar</Text>
              <Text style={styles.idleTableSub}>
                Tarik kursi warkop, nikmati kopi hangat, dan bersiap kocok domino!
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

        {/* Pass Button if user has turn but no valid cards */}
        {isMyTurn && (
          <TouchableOpacity
            style={[styles.passBtn, !gameState?.canPass && styles.passBtnDisabled]}
            onPress={handlePass}
            disabled={!gameState?.canPass}
          >
            <Ionicons name="play-forward" size={16} color={coffee.buttonText} />
            <Text style={styles.passBtnText}>Lewat (Pass)</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Player's Secret Hand (Bawah) */}
      {isPlaying && !isSpectator && (
        <View style={styles.myHandSection}>
          <View style={styles.handHeaderRow}>
            <Text style={styles.handSectionTitle}>
              Kartu di Tangan Anda ({myHand.length})
            </Text>
            {isMyTurn && (
              <View style={styles.turnPulseBanner}>
                <Text style={styles.turnPulseText}>✨ GILIRAN ANDA</Text>
              </View>
            )}
          </View>

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

      {/* Game Over Results Modal */}
      <Modal visible={resultModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={{ fontSize: 44, textAlign: 'center', marginBottom: 8 }}>🏆</Text>
            <Text style={[styles.modalTitle, { textAlign: 'center' }]}>Permainan Selesai</Text>
            <Text style={[styles.modalSub, { textAlign: 'center', marginTop: 4 }]}>
              {gameResult?.summary || 'Pertandingan selesai.'}
            </Text>

            {gameResult?.scores && (
              <View style={styles.scoresListContainer}>
                <Text style={styles.scoresListTitle}>Sisa Poin Balak:</Text>
                {Object.entries(gameResult.scores).map(([uid, pips]) => {
                  const p = table.players?.find((pl: any) => pl.user_id === uid);
                  const isWinner = gameResult.winners?.includes(uid);
                  return (
                    <View key={uid} style={styles.scoreRow}>
                      <Text style={[styles.scoreName, isWinner && { color: coffee.accent, fontWeight: '800' }]}>
                        {p?.display_name || uid} {isWinner ? '👑 Pemenang' : ''}
                      </Text>
                      <Text style={styles.scorePips}>{pips as number} Poin</Text>
                    </View>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={styles.playAgainBtn}
              onPress={() => {
                setResultModalVisible(false);
                fetchTableState();
              }}
            >
              <Text style={styles.playAgainBtnText}>Tutup & Siap Main Lagi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
