import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Chess, Square } from 'chess.js';
import axios from 'axios';
import { coffee as baseCoffee } from '../theme/coffee';
import { getAuthHeaders } from '../utils/api';
import * as SecureStore from '../utils/storage';

const coffee = {
  ...baseCoffee,
  cream: baseCoffee.text,
  textSecondary: baseCoffee.secondary,
  primary: baseCoffee.accent,
};

const API_URL = 'https://api.ngopi.top/api';

// Chess Unicode pieces
const CHESS_UNICODE: Record<string, string> = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟',
};

export interface BotProfile {
  level: number;
  name: string;
  class_title: string;
  stake: number;
  description: string;
  elo_estimate: number;
  avatar: string;
  quotes?: {
    start: string;
    blunder: string;
    winning: string;
    losing: string;
    game_over: string;
  };
}

export interface ChessProMatchData {
  id: string;
  bot_level: number;
  bot_name: string;
  stake_points: number;
  result: 'win' | 'lose' | 'draw' | 'in_progress';
  points_changed: number;
  user_balance_after: number;
  pgn?: string;
  created_at: string;
}

interface ChessProArenaModalProps {
  visible: boolean;
  onClose: () => void;
  onPointsUpdated?: (newPoints: number) => void;
}

export default function ChessProArenaModal({
  visible,
  onClose,
  onPointsUpdated,
}: ChessProArenaModalProps) {
  // Navigation / View State: 'lobby' | 'playing' | 'game_over'
  const [viewState, setViewState] = useState<'lobby' | 'playing' | 'game_over'>('lobby');

  // Bots and user balance
  const [bots, setBots] = useState<BotProfile[]>([]);
  const [userBalance, setUserBalance] = useState<number>(0);
  const [isNegative, setIsNegative] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [history, setHistory] = useState<ChessProMatchData[]>([]);

  // Active Match State
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [activeBot, setActiveBot] = useState<BotProfile | null>(null);
  const [userColor, setUserColor] = useState<'white' | 'black'>('white');
  const [chessInstance, setChessInstance] = useState<Chess>(new Chess());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<string[]>([]);
  const [flipBoard, setFlipBoard] = useState<boolean>(false);
  const [isBotThinking, setIsBotThinking] = useState<boolean>(false);
  const [botComment, setBotComment] = useState<string>('');
  const [inCheck, setInCheck] = useState<boolean>(false);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);

  // Game Over Details
  const [gameOverResult, setGameOverResult] = useState<{
    result: 'win' | 'lose' | 'draw';
    pointsChanged: number;
    newBalance: number;
    warningMsg?: string;
    botQuote?: string;
    reason?: string;
  } | null>(null);

  // Load bots and points on open
  useEffect(() => {
    if (visible) {
      loadBotsAndUserData();
    }
  }, [visible]);

  const loadBotsAndUserData = async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const storedUsername = (await SecureStore.getItemAsync('username')) || '';
      const storedUserId = (await SecureStore.getItemAsync('userId')) || '';

      const res = await axios.get(`${API_URL}/chess/pro/bots`, {
        headers,
        params: {
          username: storedUsername,
          user_id: storedUserId,
        },
      });

      if (res.data?.success) {
        setBots(res.data.bots || []);
        const pts = Number(res.data.user_points ?? 0);
        setUserBalance(pts);
        setIsNegative(pts < 0);
        if (onPointsUpdated) onPointsUpdated(pts);
      }

      // Also fetch match history
      const histRes = await axios.get(`${API_URL}/chess/pro/history`, {
        headers,
        params: {
          username: storedUsername,
          user_id: storedUserId,
        },
      }).catch(() => null);

      if (histRes?.data?.success) {
        setHistory(histRes.data.history || []);
      }
    } catch (err: any) {
      console.warn('Gagal memuat bot catur pro:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Start match against a bot
  const handleStartMatch = async (bot: BotProfile) => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const storedUsername = (await SecureStore.getItemAsync('username')) || '';
      const storedUserId = (await SecureStore.getItemAsync('userId')) || '';

      const res = await axios.post(
        `${API_URL}/chess/pro/start`,
        {
          bot_level: bot.level,
          user_color: 'white',
          username: storedUsername,
          user_id: storedUserId,
        },
        { headers }
      );

      if (res.data?.success) {
        const game = new Chess();
        setChessInstance(game);
        setActiveMatchId(res.data.match_id);
        setActiveBot(bot);
        setUserColor('white');
        setSelectedSquare(null);
        setLegalMoves([]);
        setLastMove(null);
        setInCheck(false);
        setBotComment(bot.quotes?.start || `Ayo tanding, ${storedUsername || 'Kawan'}!`);
        setUserBalance(res.data.current_points ?? userBalance);
        setIsNegative((res.data.current_points ?? userBalance) < 0);
        setViewState('playing');
      } else {
        Alert.alert('Gagal Memulai', res.data?.error || 'Tidak dapat memulai pertandingan.');
      }
    } catch (err: any) {
      Alert.alert('Kesalahan', err.response?.data?.error || err.message || 'Gagal memulai pertandingan.');
    } finally {
      setLoading(false);
    }
  };

  // Square Press on Board
  const handleSquarePress = (square: Square) => {
    if (viewState !== 'playing' || isBotThinking) return;

    const piece = chessInstance.get(square);
    const isUserPiece = piece && piece.color === (userColor === 'white' ? 'w' : 'b');

    // Case 1: Select or change selection of user's piece
    if (isUserPiece) {
      setSelectedSquare(square);
      const moves = chessInstance.moves({ square, verbose: true });
      setLegalMoves(moves.map((m) => m.to));
      return;
    }

    // Case 2: If a piece is already selected and target is a legal move
    if (selectedSquare && legalMoves.includes(square)) {
      executeUserMove(selectedSquare, square);
      return;
    }

    // Clear selection
    setSelectedSquare(null);
    setLegalMoves([]);
  };

  // Execute User Move and Request Bot Response
  const executeUserMove = async (from: Square, to: Square) => {
    try {
      // Determine if pawn promotion occurs
      const piece = chessInstance.get(from);
      const isPromotion =
        piece?.type === 'p' &&
        ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'));
      const promotion = isPromotion ? 'q' : undefined;

      // Make client move first for instantaneous visual feedback
      const moveResult = chessInstance.move({ from, to, promotion });
      if (!moveResult) return;

      const updatedGame = new Chess(chessInstance.fen());
      setChessInstance(updatedGame);
      setSelectedSquare(null);
      setLegalMoves([]);
      setLastMove({ from, to });
      setInCheck(updatedGame.inCheck());

      // If user move checkmated the bot:
      if (updatedGame.isCheckmate()) {
        finishWithResult('win', 'Skakmat! Anda memenangkan pertandingan.');
        return;
      }
      if (updatedGame.isDraw()) {
        finishWithResult('draw', 'Pertandingan berakhir remis (seri).');
        return;
      }

      // Bot thinking phase
      setIsBotThinking(true);
      const headers = await getAuthHeaders();
      const storedUsername = (await SecureStore.getItemAsync('username')) || '';
      const storedUserId = (await SecureStore.getItemAsync('userId')) || '';

      const apiRes = await axios.post(
        `${API_URL}/chess/pro/move`,
        {
          match_id: activeMatchId,
          move: { from, to, promotion },
          username: storedUsername,
          user_id: storedUserId,
        },
        { headers }
      );

      setIsBotThinking(false);

      if (apiRes.data?.success) {
        if (apiRes.data.bot_comment) {
          setBotComment(apiRes.data.bot_comment);
        }

        // Apply bot move on local board
        if (apiRes.data.bot_move) {
          const bMove = apiRes.data.bot_move;
          try {
            updatedGame.move({
              from: bMove.from,
              to: bMove.to,
              promotion: bMove.promotion || undefined,
            });
            const afterBotGame = new Chess(updatedGame.fen());
            setChessInstance(afterBotGame);
            setLastMove({ from: bMove.from, to: bMove.to });
            setInCheck(afterBotGame.inCheck());
          } catch (mErr) {
            console.warn('Bot move sync fallback:', mErr);
            if (apiRes.data.current_fen) {
              setChessInstance(new Chess(apiRes.data.current_fen));
            }
          }
        }

        // Check if game concluded
        if (apiRes.data.status === 'finished') {
          const res = apiRes.data.winner === userColor ? 'win' : apiRes.data.winner === 'draw' ? 'draw' : 'lose';
          const ptsResult = apiRes.data.points_result;
          handleMatchConclusion(
            res,
            ptsResult?.points_changed ?? (res === 'win' ? (activeBot?.stake || 50) : -(activeBot?.stake || 50)),
            ptsResult?.new_balance ?? userBalance,
            ptsResult?.warning_message,
            apiRes.data.bot_comment
          );
        }
      } else {
        Alert.alert('Gagal Gerak', apiRes.data?.error || 'Langkah tidak valid.');
      }
    } catch (err: any) {
      setIsBotThinking(false);
      Alert.alert('Kesalahan', err.response?.data?.error || err.message || 'Gagal memproses langkah.');
    }
  };

  // Surrender / Resign button
  const handleResign = () => {
    Alert.alert(
      'Menyerah?',
      `Apakah Anda yakin ingin menyerah melawan ${activeBot?.name || 'Bot'}? Taruhan ${activeBot?.stake || 50} poin akan dipotong dari saldo Anda.`,
      [
        { text: 'Lanjut Main', style: 'cancel' },
        {
          text: 'Ya, Menyerah',
          style: 'destructive',
          onPress: () => finishWithResult('lose', 'Anda menyerah.'),
        },
      ]
    );
  };

  // Conclude match via /finish API
  const finishWithResult = async (result: 'win' | 'lose' | 'draw', reason?: string) => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      const storedUsername = (await SecureStore.getItemAsync('username')) || '';
      const storedUserId = (await SecureStore.getItemAsync('userId')) || '';

      const res = await axios.post(
        `${API_URL}/chess/pro/finish`,
        {
          match_id: activeMatchId,
          result,
          pgn: chessInstance.pgn(),
          username: storedUsername,
          user_id: storedUserId,
        },
        { headers }
      );

      if (res.data?.success) {
        const ptsResult = res.data.points_result;
        handleMatchConclusion(
          result,
          ptsResult?.points_changed ?? 0,
          ptsResult?.new_balance ?? userBalance,
          ptsResult?.warning_message,
          activeBot?.quotes?.game_over,
          reason
        );
      }
    } catch (err: any) {
      console.warn('Gagal mengakhiri pertandingan:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchConclusion = (
    result: 'win' | 'lose' | 'draw',
    pointsChanged: number,
    newBalance: number,
    warningMsg?: string,
    botQuote?: string,
    reason?: string
  ) => {
    setUserBalance(newBalance);
    setIsNegative(newBalance < 0);
    if (onPointsUpdated) onPointsUpdated(newBalance);

    setGameOverResult({
      result,
      pointsChanged,
      newBalance,
      warningMsg,
      botQuote,
      reason,
    });
    setViewState('game_over');
    loadBotsAndUserData(); // Refresh stats & history
  };

  // Render 8x8 Chessboard
  const renderBoard = () => {
    const boardState = chessInstance.board();
    const rows = flipBoard ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    const cols = flipBoard ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

    const screenWidth = Dimensions.get('window').width;
    const boardSize = Math.min(screenWidth - 36, 360);
    const squareSize = boardSize / 8;

    return (
      <View
        style={{
          width: boardSize,
          height: boardSize,
          borderWidth: 3,
          borderColor: '#451a03',
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: '#b88b4a',
          alignSelf: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        {rows.map((rIdx) => (
          <View key={rIdx} style={{ flexDirection: 'row', height: squareSize }}>
            {cols.map((cIdx) => {
              const file = String.fromCharCode(97 + cIdx);
              const rank = 8 - rIdx;
              const squareName = `${file}${rank}` as Square;
              const piece = boardState[rIdx][cIdx];
              const isDarkSquare = (rIdx + cIdx) % 2 === 1;

              const isSelected = selectedSquare === squareName;
              const isLegal = legalMoves.includes(squareName);
              const isLastMoveSquare =
                lastMove && (lastMove.from === squareName || lastMove.to === squareName);

              // Background highlight
              let bg = isDarkSquare ? '#b88b4a' : '#f5e6cc';
              if (isSelected) bg = '#fde047';
              else if (isLastMoveSquare) bg = isDarkSquare ? '#a37e3d' : '#e6d4b5';

              const pieceKey = piece ? `${piece.color}${piece.type.toUpperCase()}` : null;
              const pieceSymbol = pieceKey ? CHESS_UNICODE[pieceKey] : null;
              const isPieceWhite = piece?.color === 'w';

              return (
                <TouchableOpacity
                  key={cIdx}
                  activeOpacity={0.75}
                  onPress={() => handleSquarePress(squareName)}
                  style={{
                    width: squareSize,
                    height: squareSize,
                    backgroundColor: bg,
                    justifyContent: 'center',
                    alignItems: 'center',
                    position: 'relative',
                  }}
                >
                  {/* Rank / File notations on edge squares */}
                  {cIdx === 0 && (
                    <Text
                      style={{
                        position: 'absolute',
                        top: 1,
                        left: 2,
                        fontSize: 9,
                        fontWeight: '800',
                        color: isDarkSquare ? '#f5e6cc' : '#78350f',
                        opacity: 0.7,
                      }}
                    >
                      {rank}
                    </Text>
                  )}
                  {rIdx === 7 && (
                    <Text
                      style={{
                        position: 'absolute',
                        bottom: 1,
                        right: 2,
                        fontSize: 9,
                        fontWeight: '800',
                        color: isDarkSquare ? '#f5e6cc' : '#78350f',
                        opacity: 0.7,
                      }}
                    >
                      {file}
                    </Text>
                  )}

                  {/* Legal Move Dot */}
                  {isLegal && !piece && (
                    <View
                      style={{
                        width: squareSize * 0.32,
                        height: squareSize * 0.32,
                        borderRadius: (squareSize * 0.32) / 2,
                        backgroundColor: 'rgba(22, 101, 52, 0.55)',
                      }}
                    />
                  )}

                  {/* Piece Symbol */}
                  {pieceSymbol && (
                    <Text
                      style={{
                        fontSize: squareSize * 0.74,
                        lineHeight: squareSize * 0.82,
                        color: isPieceWhite ? '#ffffff' : '#111827',
                        textShadowColor: isPieceWhite ? '#000000' : 'rgba(255,255,255,0.7)',
                        textShadowOffset: { width: 1, height: 1 },
                        textShadowRadius: 2,
                      }}
                    >
                      {pieceSymbol}
                    </Text>
                  )}

                  {/* Target capture ring indicator */}
                  {isLegal && piece && (
                    <View
                      style={{
                        position: 'absolute',
                        width: squareSize * 0.88,
                        height: squareSize * 0.88,
                        borderRadius: (squareSize * 0.88) / 2,
                        borderWidth: 3,
                        borderColor: '#dc2626',
                      }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (viewState === 'playing') {
                Alert.alert(
                  'Keluar Pertandingan?',
                  'Pertandingan sedang berjalan. Jika keluar sekarang, Anda dianggap menyerah!',
                  [
                    { text: 'Tetap Main', style: 'cancel' },
                    {
                      text: 'Keluar & Menyerah',
                      style: 'destructive',
                      onPress: () => {
                        finishWithResult('lose', 'Pemain meninggalkan papan.');
                        setViewState('lobby');
                      },
                    },
                  ]
                );
              } else {
                onClose();
              }
            }}
          >
            <Ionicons name="chevron-back" size={24} color={coffee.accent} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons name="chess-king" size={20} color={coffee.accent} />
              <Text style={styles.headerTitle}>CATUR PROFESIONAL</Text>
            </View>
            <Text style={styles.headerSubtitle}>Stockfish 19 WASM • 9 Bot Berjenjang</Text>
          </View>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={loadBotsAndUserData}
            disabled={loading}
          >
            <Ionicons name="refresh" size={20} color={coffee.accent} />
          </TouchableOpacity>
        </View>

        {/* User Balance Bar */}
        <View style={[styles.balanceCard, isNegative && styles.balanceCardNegative]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 20 }}>{isNegative ? '⚠️' : '🪙'}</Text>
            <View>
              <Text style={styles.balanceLabel}>Saldo Poin Warkop Anda</Text>
              <Text
                style={[
                  styles.balanceValue,
                  isNegative ? { color: '#ef4444' } : { color: '#22c55e' },
                ]}
              >
                {userBalance > 0 ? `+${userBalance.toLocaleString('id-ID')}` : userBalance.toLocaleString('id-ID')} Poin
              </Text>
            </View>
          </View>

          {isNegative ? (
            <View style={styles.minusBadge}>
              <Text style={styles.minusBadgeText}>SALDO MINUS</Text>
            </View>
          ) : (
            <View style={styles.normalBadge}>
              <Text style={styles.normalBadgeText}>SIAP TANDING</Text>
            </View>
          )}
        </View>

        {/* Negative Warning Banner (Loss Aversion) */}
        {isNegative && (
          <View style={styles.lossAversionBanner}>
            <Ionicons name="alert-circle" size={16} color="#fbbf24" />
            <Text style={styles.lossAversionText}>
              Poin Anda negatif ({userBalance}). Anda tetap bebas menantang bot catur profesional untuk memenangkan kembali poin Anda!
            </Text>
          </View>
        )}

        {/* MAIN BODY CONTENT */}
        {loading && viewState === 'lobby' && bots.length === 0 ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={coffee.accent} />
            <Text style={{ color: coffee.secondary, marginTop: 12, fontSize: 13 }}>
              Menghubungkan ke Stockfish Engine & Memuat 9 Bot...
            </Text>
          </View>
        ) : viewState === 'lobby' ? (
          /* ================= LOBBY SCREEN (BOT SELECTOR) ================= */
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Arena Intro Banner */}
            <View style={styles.arenaBanner}>
              <Text style={styles.arenaBannerTitle}>🏆 Arena Taruhan Catur Stockfish</Text>
              <Text style={styles.arenaBannerDesc}>
                Setiap bot memiliki kedalaman analisis taktik catur yang berbeda. Menangkan pertandingan untuk meraup poin warkop, atau hadapi resiko pengurangan poin jika kalah. Saldo 0 atau minus tetap bisa bermain!
              </Text>
            </View>

            {/* 9 Bot Cards Grid */}
            <Text style={styles.sectionTitle}>PILIH BOT LAWAN (9 TINGKATAN)</Text>

            <View style={{ gap: 12, marginTop: 8 }}>
              {bots.map((bot) => {
                const isTopTier = bot.level >= 6;
                const isMax = bot.level === 8;

                return (
                  <View
                    key={bot.level}
                    style={[
                      styles.botCard,
                      isTopTier && styles.botCardTopTier,
                      isMax && styles.botCardMessi,
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {/* Avatar */}
                      <View style={styles.botAvatarContainer}>
                        <Text style={{ fontSize: 28 }}>{bot.avatar}</Text>
                        <View style={styles.levelBadge}>
                          <Text style={styles.levelBadgeText}>Lv.{bot.level}</Text>
                        </View>
                      </View>

                      {/* Bot Info */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text style={styles.botName}>{bot.name}</Text>
                          <View style={styles.classBadge}>
                            <Text style={styles.classBadgeText}>{bot.class_title}</Text>
                          </View>
                        </View>
                        <Text style={styles.botDesc} numberOfLines={2}>
                          {bot.description}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                          <Text style={styles.botElo}>🎯 Elo ~{bot.elo_estimate}</Text>
                          <Text style={[styles.botStake, isMax && { color: '#fbbf24', fontWeight: '900' }]}>
                            💰 Taruhan: ±{bot.stake.toLocaleString('id-ID')} Poin
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Challenge Button */}
                    <TouchableOpacity
                      style={[
                        styles.challengeBtn,
                        isMax && { backgroundColor: '#eab308' },
                      ]}
                      activeOpacity={0.8}
                      onPress={() => handleStartMatch(bot)}
                    >
                      <MaterialCommunityIcons
                        name="sword-cross"
                        size={16}
                        color={isMax ? '#1e293b' : coffee.buttonText}
                      />
                      <Text
                        style={[
                          styles.challengeBtnText,
                          isMax && { color: '#1e293b', fontWeight: '900' },
                        ]}
                      >
                        Tantang ({bot.stake > 0 ? `±${bot.stake}` : '0'})
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            {/* Match History Table */}
            {history.length > 0 && (
              <View style={{ marginTop: 24 }}>
                <Text style={styles.sectionTitle}>RIWAYAT PERTANDINGAN TERAKHIR</Text>
                <View style={styles.historyContainer}>
                  {history.slice(0, 10).map((item, idx) => {
                    const isWin = item.result === 'win';
                    const isDraw = item.result === 'draw';
                    return (
                      <View key={item.id || idx} style={styles.historyRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 16 }}>
                            {isWin ? '🏆' : isDraw ? '🤝' : '💔'}
                          </Text>
                          <View>
                            <Text style={styles.historyBotName}>
                              vs {item.bot_name} (Lv.{item.bot_level})
                            </Text>
                            <Text style={styles.historyDate}>
                              {new Date(item.created_at).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.historyPoints,
                            isWin ? { color: '#22c55e' } : isDraw ? { color: coffee.accent } : { color: '#ef4444' },
                          ]}
                        >
                          {item.points_changed > 0 ? `+${item.points_changed}` : item.points_changed} Poin
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>
        ) : viewState === 'playing' ? (
          /* ================= LIVE MATCH PLAYING ARENA ================= */
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Bot Profile Bar (Opponent) */}
            <View style={styles.opponentBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.opponentAvatar}>
                  <Text style={{ fontSize: 24 }}>{activeBot?.avatar || '🤖'}</Text>
                </View>
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.opponentName}>{activeBot?.name || 'Stockfish'}</Text>
                    <View style={styles.classBadge}>
                      <Text style={styles.classBadgeText}>{activeBot?.class_title}</Text>
                    </View>
                  </View>
                  <Text style={styles.opponentElo}>
                    Elo ~{activeBot?.elo_estimate} • Taruhan: ±{activeBot?.stake} Poin
                  </Text>
                </View>
              </View>

              {/* Thinking Indicator */}
              {isBotThinking ? (
                <View style={styles.thinkingPill}>
                  <ActivityIndicator size="small" color="#f59e0b" />
                  <Text style={styles.thinkingText}>Berpikir...</Text>
                </View>
              ) : (
                <View style={styles.readyPill}>
                  <Text style={styles.readyText}>⚫ Hitam</Text>
                </View>
              )}
            </View>

            {/* Bot Speech Bubble */}
            {botComment ? (
              <View style={styles.speechBubble}>
                <Ionicons name="chatbubble-ellipses" size={14} color={coffee.accent} />
                <Text style={styles.speechBubbleText}>"{botComment}"</Text>
              </View>
            ) : null}

            {/* Check Warning Banner */}
            {inCheck && (
              <View style={styles.checkAlertBanner}>
                <Text style={styles.checkAlertText}>🚨 SKAK! RAJA DALAM ANCAMAN BAHAYA!</Text>
              </View>
            )}

            {/* 8x8 Chessboard */}
            <View style={{ marginVertical: 10 }}>
              {renderBoard()}
            </View>

            {/* Player Info Bar */}
            <View style={styles.playerBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.playerAvatar}>
                  <Text style={{ fontSize: 22 }}>☕</Text>
                </View>
                <View>
                  <Text style={styles.playerName}>Anda (Bidak Putih ⚪)</Text>
                  <Text
                    style={[
                      styles.playerBalance,
                      isNegative ? { color: '#ef4444' } : { color: '#22c55e' },
                    ]}
                  >
                    Saldo: {userBalance.toLocaleString('id-ID')} Poin
                  </Text>
                </View>
              </View>

              {/* Turn Status */}
              <View
                style={[
                  styles.turnBadge,
                  !isBotThinking ? styles.myTurnBadge : styles.botTurnBadge,
                ]}
              >
                <Text style={styles.turnBadgeText}>
                  {!isBotThinking ? 'Giliran Anda!' : 'Menunggu Bot...'}
                </Text>
              </View>
            </View>

            {/* Controls Bar */}
            <View style={styles.gameControlsRow}>
              <TouchableOpacity
                style={styles.gameControlBtn}
                onPress={() => setFlipBoard((f) => !f)}
              >
                <Ionicons name="swap-vertical" size={16} color={coffee.text} />
                <Text style={styles.gameControlBtnText}>Balik Papan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.gameControlBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: '#ef4444' }]}
                onPress={handleResign}
              >
                <Ionicons name="flag" size={16} color="#ef4444" />
                <Text style={[styles.gameControlBtnText, { color: '#ef4444' }]}>Menyerah</Text>
              </TouchableOpacity>
            </View>

            {/* Hint Text */}
            <Text style={styles.instructionText}>
              Sentuh bidak Anda untuk melihat titik kemungkinan gerak legal, lalu sentuh kotak tujuan.
            </Text>
          </ScrollView>
        ) : (
          /* ================= GAME OVER SCREEN ================= */
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20, alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={styles.gameOverCard}>
              <Text style={{ fontSize: 50, marginBottom: 8 }}>
                {gameOverResult?.result === 'win'
                  ? '🏆'
                  : gameOverResult?.result === 'draw'
                  ? '🤝'
                  : '💔'}
              </Text>

              <Text style={styles.gameOverTitle}>
                {gameOverResult?.result === 'win'
                  ? 'KEMENANGAN GEMILANG!'
                  : gameOverResult?.result === 'draw'
                  ? 'PERTANDINGAN REMIS'
                  : 'KEKALAHAN'}
              </Text>

              {gameOverResult?.reason && (
                <Text style={styles.gameOverReason}>{gameOverResult.reason}</Text>
              )}

              {/* Bot Comment */}
              {gameOverResult?.botQuote && (
                <View style={styles.gameOverQuoteBox}>
                  <Text style={styles.gameOverQuoteAuthor}>Komentar {activeBot?.name}:</Text>
                  <Text style={styles.gameOverQuoteText}>"{gameOverResult.botQuote}"</Text>
                </View>
              )}

              {/* Points Adjustment Box */}
              <View style={styles.outcomePointsBox}>
                <Text style={styles.outcomePointsLabel}>HASIL TARUHAN POIN</Text>
                <Text
                  style={[
                    styles.outcomePointsVal,
                    (gameOverResult?.pointsChanged || 0) > 0
                      ? { color: '#22c55e' }
                      : (gameOverResult?.pointsChanged || 0) < 0
                      ? { color: '#ef4444' }
                      : { color: coffee.accent },
                  ]}
                >
                  {(gameOverResult?.pointsChanged || 0) > 0
                    ? `+${gameOverResult?.pointsChanged.toLocaleString('id-ID')}`
                    : gameOverResult?.pointsChanged?.toLocaleString('id-ID')}{' '}
                  Poin
                </Text>

                <View style={styles.outcomeDivider} />

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                  <Text style={{ color: coffee.secondary, fontSize: 13 }}>Saldo Poin Baru:</Text>
                  <Text
                    style={{
                      color: (gameOverResult?.newBalance || 0) < 0 ? '#ef4444' : '#22c55e',
                      fontWeight: '800',
                      fontSize: 14,
                    }}
                  >
                    {gameOverResult?.newBalance?.toLocaleString('id-ID')} Poin
                  </Text>
                </View>
              </View>

              {/* Negative Balance Loss Aversion Warning */}
              {(gameOverResult?.newBalance || 0) < 0 && (
                <View style={styles.negativeWarningBox}>
                  <Ionicons name="warning" size={20} color="#f59e0b" />
                  <Text style={styles.negativeWarningText}>
                    {gameOverResult?.warningMsg ||
                      `Poin Anda sekarang ${gameOverResult?.newBalance}. Terus main dan menangkan kembali poin Anda!`}
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={{ width: '100%', gap: 10, marginTop: 20 }}>
                {activeBot && (
                  <TouchableOpacity
                    style={styles.rematchBtn}
                    onPress={() => handleStartMatch(activeBot)}
                  >
                    <Ionicons name="reload" size={18} color={coffee.buttonText} />
                    <Text style={styles.rematchBtnText}>Tanding Ulang Lawan {activeBot.name}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.backLobbyBtn}
                  onPress={() => setViewState('lobby')}
                >
                  <MaterialCommunityIcons name="view-grid" size={18} color={coffee.accent} />
                  <Text style={styles.backLobbyBtnText}>Pilih Bot Lawan Lainnya</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#17120e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2b1e16',
    backgroundColor: '#1f1611',
  },
  backButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 163, 115, 0.1)',
  },
  refreshBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 163, 115, 0.1)',
  },
  headerTitle: {
    color: coffee.accent,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: coffee.secondary,
    fontSize: 11,
    marginTop: 2,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#261b14',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3d281c',
  },
  balanceCardNegative: {
    borderColor: '#dc2626',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  balanceLabel: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: '600',
  },
  balanceValue: {
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
  minusBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  minusBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  normalBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: '#22c55e',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  normalBadgeText: {
    color: '#22c55e',
    fontSize: 10,
    fontWeight: '800',
  },
  lossAversionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  lossAversionText: {
    color: '#fef3c7',
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  arenaBanner: {
    backgroundColor: '#241710',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 16,
  },
  arenaBannerTitle: {
    color: coffee.accent,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  arenaBannerDesc: {
    color: coffee.secondary,
    fontSize: 11,
    lineHeight: 16,
  },
  sectionTitle: {
    color: coffee.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  botCard: {
    backgroundColor: '#241a13',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#382619',
    gap: 10,
  },
  botCardTopTier: {
    borderColor: '#78350f',
    backgroundColor: '#281a11',
  },
  botCardMessi: {
    borderColor: '#eab308',
    backgroundColor: '#2d1f0e',
    borderWidth: 1.5,
  },
  botAvatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#382619',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: coffee.accent,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  levelBadgeText: {
    color: coffee.buttonText,
    fontSize: 9,
    fontWeight: '900',
  },
  botName: {
    color: coffee.text,
    fontSize: 14,
    fontWeight: '800',
  },
  classBadge: {
    backgroundColor: 'rgba(212, 163, 115, 0.15)',
    borderColor: coffee.accent,
    borderWidth: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  classBadgeText: {
    color: coffee.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  botDesc: {
    color: coffee.secondary,
    fontSize: 11,
    marginTop: 2,
  },
  botElo: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  botStake: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
  },
  challengeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: coffee.accent,
    paddingVertical: 8,
    borderRadius: 8,
  },
  challengeBtnText: {
    color: coffee.buttonText,
    fontSize: 12,
    fontWeight: '800',
  },
  historyContainer: {
    backgroundColor: '#201610',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#382619',
    marginTop: 8,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2b1d14',
  },
  historyBotName: {
    color: coffee.text,
    fontSize: 12,
    fontWeight: '700',
  },
  historyDate: {
    color: coffee.secondary,
    fontSize: 10,
    marginTop: 1,
  },
  historyPoints: {
    fontSize: 13,
    fontWeight: '800',
  },
  opponentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#241a13',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#382619',
  },
  opponentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#382619',
    justifyContent: 'center',
    alignItems: 'center',
  },
  opponentName: {
    color: coffee.text,
    fontSize: 13,
    fontWeight: '800',
  },
  opponentElo: {
    color: coffee.secondary,
    fontSize: 10,
    marginTop: 1,
  },
  thinkingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  thinkingText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '800',
  },
  readyPill: {
    backgroundColor: '#382619',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  readyText: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  speechBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2d1f15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: coffee.accent,
  },
  speechBubbleText: {
    color: coffee.accent,
    fontSize: 11,
    fontStyle: 'italic',
    flex: 1,
  },
  checkAlertBanner: {
    backgroundColor: 'rgba(220, 38, 38, 0.25)',
    borderColor: '#dc2626',
    borderWidth: 1,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 6,
  },
  checkAlertText: {
    color: '#f87171',
    fontWeight: '900',
    fontSize: 11,
  },
  playerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#241a13',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#382619',
  },
  playerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#382619',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerName: {
    color: coffee.text,
    fontSize: 13,
    fontWeight: '800',
  },
  playerBalance: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  turnBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  myTurnBadge: {
    backgroundColor: '#22c55e',
  },
  botTurnBadge: {
    backgroundColor: '#475569',
  },
  turnBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  gameControlsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  gameControlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2a1e16',
    borderWidth: 1,
    borderColor: '#3d281c',
    paddingVertical: 8,
    borderRadius: 8,
  },
  gameControlBtnText: {
    color: coffee.text,
    fontSize: 12,
    fontWeight: '700',
  },
  instructionText: {
    color: coffee.muted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },
  gameOverCard: {
    width: '100%',
    backgroundColor: '#241a13',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3d281c',
  },
  gameOverTitle: {
    color: coffee.text,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  gameOverReason: {
    color: coffee.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  gameOverQuoteBox: {
    backgroundColor: '#1b120c',
    borderRadius: 10,
    padding: 10,
    width: '100%',
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: coffee.accent,
  },
  gameOverQuoteAuthor: {
    color: coffee.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  gameOverQuoteText: {
    color: coffee.text,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  outcomePointsBox: {
    width: '100%',
    backgroundColor: '#1b130e',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#382619',
  },
  outcomePointsLabel: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  outcomePointsVal: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  outcomeDivider: {
    height: 1,
    backgroundColor: '#2b1d14',
    width: '100%',
    marginVertical: 10,
  },
  negativeWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    width: '100%',
  },
  negativeWarningText: {
    color: '#fef3c7',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  rematchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: coffee.accent,
    paddingVertical: 12,
    borderRadius: 10,
  },
  rematchBtnText: {
    color: coffee.buttonText,
    fontSize: 14,
    fontWeight: '800',
  },
  backLobbyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2a1e16',
    borderWidth: 1,
    borderColor: coffee.accent,
    paddingVertical: 12,
    borderRadius: 10,
  },
  backLobbyBtnText: {
    color: coffee.accent,
    fontSize: 13,
    fontWeight: '800',
  },
});
