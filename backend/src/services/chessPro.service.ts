import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Chess } from 'chess.js';
import { prisma } from '../utils/prisma';
import { PointsManager } from '../utils/pointsManager';

// Safe Stockfish loader
let stockfishModule: any = null;
try {
  stockfishModule = require('stockfish');
} catch (e) {
  console.warn('[ChessPro] stockfish module not found, will use internal engine fallback:', e);
}

export interface ChessBotConfig {
  level: number;
  name: string;
  className: string;
  stake: number;
  skillLevel: number;
  depth: number;
  timeMs: number;
  eloEst: number;
  personality: string;
  avatar: string;
  description: string;
}

export const CHESS_BOTS: ChessBotConfig[] = [
  {
    level: 0,
    name: 'Tonah',
    className: 'Kelas Bulu',
    stake: 50,
    skillLevel: 0,
    depth: 1,
    timeMs: 60,
    eloEst: 600,
    personality: 'Ayo main, aku masih belajar nih...',
    avatar: '🐣',
    description: 'Sering melakukan blunder & langkah ceroboh. Cocok untuk latihan pemula.',
  },
  {
    level: 1,
    name: "Pe'i",
    className: 'Kelas Dasar',
    stake: 75,
    skillLevel: 3,
    depth: 2,
    timeMs: 120,
    eloEst: 1000,
    personality: 'Jangan remehkan aku ya.',
    avatar: '🐱',
    description: 'Sudah mengerti dasar pembukaan & gerakan pion, tapi belum matang taktikalnya.',
  },
  {
    level: 2,
    name: 'Juned',
    className: 'Kelas Menengah',
    stake: 100,
    skillLevel: 7,
    depth: 4,
    timeMs: 300,
    eloEst: 1400,
    personality: 'Catur itu soal sabar.',
    avatar: '🦊',
    description: 'Pemain warkop berpengalaman. Disiplin posisi dan jarang melepas perwira gratis.',
  },
  {
    level: 3,
    name: "To'ip",
    className: 'Kelas Atas',
    stake: 125,
    skillLevel: 10,
    depth: 6,
    timeMs: 500,
    eloEst: 1800,
    personality: 'Langkahmu sudah kubaca.',
    avatar: '🐺',
    description: 'Kombinasi taktik agresif, penguasaan petak tengah dan serangan garpu kuda tajam.',
  },
  {
    level: 4,
    name: "Su'eb",
    className: 'Kelas Diploma',
    stake: 150,
    skillLevel: 13,
    depth: 8,
    timeMs: 800,
    eloEst: 2000,
    personality: 'Menarik... tapi kurang tajam.',
    avatar: '🦅',
    description: 'Level setara master nasional. Struktur pion solid dan transisi babak akhir presisi.',
  },
  {
    level: 5,
    name: 'Keting',
    className: 'Kelas Tinggi',
    stake: 175,
    skillLevel: 16,
    depth: 10,
    timeMs: 1200,
    eloEst: 2200,
    personality: 'Kau bermain bagus, tapi belum cukup.',
    avatar: '🐯',
    description: 'Kalkulasi tajam hingga 10 langkah ke depan. Memanfaatkan kelemahan sekecil apapun.',
  },
  {
    level: 6,
    name: 'Gudal',
    className: 'Kelas Master',
    stake: 200,
    skillLevel: 18,
    depth: 12,
    timeMs: 2000,
    eloEst: 2400,
    personality: 'Skakmat dalam 10 langkah.',
    avatar: '🦁',
    description: 'Level International Master. Sangat jarang membuat kesalahan posisi maupun taktik.',
  },
  {
    level: 7,
    name: 'Petoak',
    className: 'Kelas Doktor',
    stake: 500,
    skillLevel: 20,
    depth: 15,
    timeMs: 3000,
    eloEst: 2600,
    personality: 'Analisis posisimu sudah selesai.',
    avatar: '🐉',
    description: 'Grandmaster dunia. Pertahanan baja, teknik endgame sempurna, dan evaluasi mendalam.',
  },
  {
    level: 8,
    name: 'Messi',
    className: 'Kelas Professor',
    stake: 1000,
    skillLevel: 20,
    depth: 20,
    timeMs: 5000,
    eloEst: 3000,
    personality: 'Tidak ada yang bisa mengalahkanku di papan ini.',
    avatar: '🐐',
    description: 'Stockfish Level Maksimal (Super Grandmaster 3000+ ELO). Nyaris mustahil dikalahkan manusia!',
  },
];

export interface ActiveMatch {
  id: string;
  userId: string;
  username: string;
  botLevel: number;
  botName: string;
  stake: number;
  userColor: 'white' | 'black';
  fen: string;
  pgn: string;
  history: string[];
  status: 'playing' | 'win' | 'lose' | 'draw';
  startTime: number;
}

const MATCHES_FILE = path.join(__dirname, '../../uploads/chess_pro_matches.json');
const BOT_PROFILES_FILE = path.join(__dirname, '../../uploads/chess_pro_bot_profiles.json');

class PersistentStockfish {
  private engine: any = null;
  private pendingCallback: ((line: string) => void) | null = null;
  private queue: Array<() => Promise<void>> = [];
  private isProcessing: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      if (stockfishModule && typeof stockfishModule === 'function') {
        this.engine = stockfishModule();
        this.engine.listener = (line: string) => {
          if (this.pendingCallback) {
            this.pendingCallback(line);
          }
        };
        this.engine.processCommand('uci');
      }
    } catch (e) {
      console.warn('[PersistentStockfish] Init warning:', e);
    }
  }

  public async computeMove(fen: string, botConfig: ChessBotConfig): Promise<{ from: string; to: string; promotion?: string }> {
    return new Promise((resolve) => {
      this.queue.push(async () => {
        const move = await this.executeMove(fen, botConfig);
        resolve(move);
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const task = this.queue.shift();
    if (task) {
      try {
        await task();
      } catch (_) {}
    }
    this.isProcessing = false;
    this.processQueue();
  }

  private executeMove(fen: string, botConfig: ChessBotConfig): Promise<{ from: string; to: string; promotion?: string }> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingCallback = null;
        resolve(this.fallback(fen));
      }, Math.max(botConfig.timeMs + 1000, 2000));

      if (!this.engine) {
        clearTimeout(timeout);
        return resolve(this.fallback(fen));
      }

      this.pendingCallback = (line: string) => {
        if (typeof line === 'string' && line.startsWith('bestmove')) {
          clearTimeout(timeout);
          this.pendingCallback = null;
          const parts = line.split(' ');
          const raw = parts[1];
          if (raw && raw !== '(none)' && raw.length >= 4) {
            const from = raw.slice(0, 2);
            const to = raw.slice(2, 4);
            const promotion = raw.length > 4 ? raw.charAt(4) : undefined;
            return resolve({ from, to, promotion });
          }
          return resolve(this.fallback(fen));
        }
      };

      try {
        if (botConfig.level < 8) {
          this.engine.processCommand(`setoption name Skill Level value ${botConfig.skillLevel}`);
          this.engine.processCommand(`setoption name UCI_LimitStrength value true`);
          this.engine.processCommand(`setoption name UCI_Elo value ${botConfig.eloEst}`);
        } else {
          this.engine.processCommand('setoption name Skill Level value 20');
          this.engine.processCommand('setoption name UCI_LimitStrength value false');
        }
        this.engine.processCommand(`position fen ${fen}`);
        this.engine.processCommand(`go depth ${botConfig.depth} movetime ${botConfig.timeMs}`);
      } catch (e) {
        clearTimeout(timeout);
        this.pendingCallback = null;
        resolve(this.fallback(fen));
      }
    });
  }

  public fallback(fen: string): { from: string; to: string; promotion?: string } {
    try {
      const chess = new Chess(fen);
      const moves = chess.moves({ verbose: true });
      if (moves.length === 0) return { from: 'e7', to: 'e5' };
      const captures = moves.filter((m) => m.captured || m.san.includes('+'));
      const chosen = (captures.length > 0 ? captures[Math.floor(Math.random() * captures.length)] : null) ||
        moves[Math.floor(Math.random() * moves.length)]!;
      return { from: chosen.from, to: chosen.to, promotion: chosen.promotion };
    } catch (_) {
      return { from: 'e7', to: 'e5' };
    }
  }
}

export class ChessProServiceClass {
  private activeMatches: Map<string, ActiveMatch> = new Map();

  constructor() {
    this.initStorage();
  }

  private initStorage() {
    try {
      const dir = path.dirname(MATCHES_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (_) {}
  }

  public getBotsList(userIdOrUsername?: string) {
    const balance = userIdOrUsername ? PointsManager.getPoints(userIdOrUsername) : 0;
    return {
      bots: CHESS_BOTS,
      user_balance: balance,
      can_play_negative: true,
    };
  }

  public getBotConfig(level: number): ChessBotConfig {
    const sanitized = Math.max(0, Math.min(8, Math.floor(level)));
    return CHESS_BOTS[sanitized] || CHESS_BOTS[0]!;
  }

  private stockfishEngine = new PersistentStockfish();

  /**
   * Calculate best move using Stockfish WASM engine
   */
  public async getStockfishMove(fen: string, botConfig: ChessBotConfig): Promise<{ from: string; to: string; promotion?: string }> {
    return this.stockfishEngine.computeMove(fen, botConfig);
  }

  public getFallbackMove(fen: string): { from: string; to: string; promotion?: string } {
    return this.stockfishEngine.fallback(fen);
  }

  /**
   * Reliable fallback move generator via chess.js
   */
  private getFallbackMove(fen: string): { from: string; to: string; promotion?: string } {
    try {
      const chess = new Chess(fen);
      const moves = chess.moves({ verbose: true });
      if (moves.length === 0) return { from: 'e7', to: 'e5' };

      // Prefer captures or checks if available
      const captures = moves.filter((m) => m.captured || m.san.includes('+'));
      const chosen = (captures.length > 0 ? captures[Math.floor(Math.random() * captures.length)] : null) ||
        moves[Math.floor(Math.random() * moves.length)]!;

      return {
        from: chosen.from,
        to: chosen.to,
        promotion: chosen.promotion,
      };
    } catch (_) {
      return { from: 'e7', to: 'e5' };
    }
  }

  /**
   * 3.A. Endpoint Memulai Game (POST /api/chess/pro/start)
   * User boleh mulai meskipun saldo 0 atau minus!
   */
  public async startMatch(params: {
    userId: string;
    username: string;
    botLevel: number;
    userColor?: 'white' | 'black';
  }) {
    const botConfig = this.getBotConfig(params.botLevel);
    const userColor = params.userColor || 'white';
    const matchId = `cpro_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    const match: ActiveMatch = {
      id: matchId,
      userId: params.userId,
      username: params.username,
      botLevel: botConfig.level,
      botName: botConfig.name,
      stake: botConfig.stake,
      userColor,
      fen: initialFen,
      pgn: '',
      history: [],
      status: 'playing',
      startTime: Date.now(),
    };

    this.activeMatches.set(matchId, match);

    // If bot plays White (user selected Black), compute first bot move
    let firstBotMove: any = null;
    if (userColor === 'black') {
      const move = await this.getStockfishMove(initialFen, botConfig);
      const chess = new Chess(initialFen);
      const executed = chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
      if (executed) {
        match.fen = chess.fen();
        match.pgn = chess.pgn();
        match.history.push(executed.san);
        firstBotMove = {
          from: move.from,
          to: move.to,
          san: executed.san,
          promotion: move.promotion,
        };
      }
    }

    const currentPoints = PointsManager.getPoints(params.username) || PointsManager.getPoints(params.userId);

    return {
      success: true,
      match_id: matchId,
      fen: match.fen,
      pgn: match.pgn,
      user_color: userColor,
      bot_info: botConfig,
      first_bot_move: firstBotMove,
      user_points: currentPoints,
      stake: botConfig.stake,
      allow_negative: true,
    };
  }

  /**
   * 3.C. Endpoint Melakukan Langkah (POST /api/chess/pro/move)
   */
  public async handleMove(params: {
    matchId: string;
    userId: string;
    username: string;
    move: { from: string; to: string; promotion?: string } | string;
  }) {
    const match = this.activeMatches.get(params.matchId);
    if (!match) {
      throw new Error('Pertandingan catur pro tidak ditemukan atau sudah berakhir.');
    }

    const chess = new Chess(match.fen);
    const botConfig = this.getBotConfig(match.botLevel);

    // 1. Execute & validate User Move
    let userExecuted: any = null;
    try {
      if (typeof params.move === 'string') {
        userExecuted = chess.move(params.move);
      } else {
        userExecuted = chess.move({
          from: params.move.from,
          to: params.move.to,
          promotion: params.move.promotion || 'q',
        });
      }
    } catch (e: any) {
      throw new Error(`Langkah user tidak sah: ${e.message}`);
    }

    if (!userExecuted) {
      throw new Error('Langkah catur tidak valid menurut aturan resmi.');
    }

    match.fen = chess.fen();
    match.pgn = chess.pgn();
    match.history.push(userExecuted.san);

    // Check if user won or draw on this move
    if (chess.isGameOver()) {
      let finalResult: 'win' | 'lose' | 'draw' = 'draw';
      if (chess.isCheckmate()) {
        finalResult = 'win'; // Bot checkmated -> User won!
      }
      match.status = finalResult;

      const finishData = await this.finishMatch({
        matchId: match.id,
        userId: params.userId,
        username: params.username,
        result: finalResult,
        pgn: match.pgn,
        durationSec: Math.round((Date.now() - match.startTime) / 1000),
      });

      return {
        success: true,
        user_move: userExecuted,
        bot_move: null,
        fen: match.fen,
        pgn: match.pgn,
        is_check: chess.inCheck(),
        is_checkmate: chess.isCheckmate(),
        is_draw: chess.isDraw(),
        is_game_over: true,
        result: finalResult,
        finish_data: finishData,
        bot_comment: finalResult === 'win' ? 'Luar biasa... langkahmu sangat brilian!' : 'Pertandingan berakhir remis.',
      };
    }

    // 2. Bot Move Calculation (Stockfish)
    const botRawMove = await this.getStockfishMove(chess.fen(), botConfig);
    let botExecuted: any = null;

    try {
      botExecuted = chess.move({
        from: botRawMove.from,
        to: botRawMove.to,
        promotion: botRawMove.promotion || 'q',
      });
    } catch (_) {
      // In case of any edge promotion anomaly, pick first valid legal move
      const fallback = chess.moves({ verbose: true })[0]!;
      botExecuted = chess.move(fallback);
    }

    match.fen = chess.fen();
    match.pgn = chess.pgn();
    if (botExecuted) {
      match.history.push(botExecuted.san);
    }

    // Check if bot won or draw on bot move
    let isGameOver = chess.isGameOver();
    let finalResult: 'win' | 'lose' | 'draw' | null = null;
    let finishData: any = null;

    if (isGameOver) {
      if (chess.isCheckmate()) {
        finalResult = 'lose'; // User checkmated -> User lost!
      } else {
        finalResult = 'draw';
      }
      match.status = finalResult;

      finishData = await this.finishMatch({
        matchId: match.id,
        userId: params.userId,
        username: params.username,
        result: finalResult,
        pgn: match.pgn,
        durationSec: Math.round((Date.now() - match.startTime) / 1000),
      });
    }

    // Generate personality flavor comment
    let botComment = botConfig.personality;
    if (chess.isCheckmate()) {
      botComment = botConfig.level >= 6 ? 'Skakmat! Strategi tanpa celah.' : 'Skakmat! Terima kasih atas pertandingannya.';
    } else if (chess.inCheck()) {
      botComment = 'Awas, Rajamu sedang dalam posisi Skak!';
    } else if (botExecuted?.captured) {
      botComment = botConfig.level <= 2 ? 'Hehe, perwiramu aku ambil ya.' : 'Pengorbananmu tidak cukup menguntungkan.';
    }

    return {
      success: true,
      user_move: userExecuted,
      bot_move: botExecuted ? {
        from: botExecuted.from,
        to: botExecuted.to,
        san: botExecuted.san,
        promotion: botExecuted.promotion,
      } : null,
      fen: match.fen,
      pgn: match.pgn,
      is_check: chess.inCheck(),
      is_checkmate: chess.isCheckmate(),
      is_draw: chess.isDraw(),
      is_game_over: isGameOver,
      result: finalResult,
      finish_data: finishData,
      bot_comment: botComment,
    };
  }

  /**
   * 3.B. Endpoint Menyelesaikan Game & Poin Minus (POST /api/chess/pro/finish)
   */
  public async finishMatch(params: {
    matchId: string;
    userId: string;
    username: string;
    result: 'win' | 'lose' | 'draw';
    pgn?: string;
    durationSec?: number;
  }) {
    const match = this.activeMatches.get(params.matchId);
    const botLevel = match ? match.botLevel : 0;
    const botConfig = this.getBotConfig(botLevel);
    const stake = botConfig.stake;

    let pointsChanged = 0;
    if (params.result === 'win') pointsChanged = stake;
    else if (params.result === 'lose') pointsChanged = -stake;
    else pointsChanged = 0; // draw

    const pointsKey = params.username || params.userId;
    const pointsBefore = PointsManager.getPoints(pointsKey);
    const pointsAfter = pointsBefore + pointsChanged;

    // Update Points with allowNegative = true!
    PointsManager.setPoints(pointsKey, pointsAfter, true);
    if (params.userId && params.userId !== pointsKey) {
      PointsManager.setPoints(params.userId, pointsAfter, true);
    }

    // Sync to pointsEconomyService and record transaction for Points Hub
    try {
      const { pointsEconomyService } = require('./points.service');
      if (pointsEconomyService) {
        const targetUserId = params.userId || pointsKey;
        const up = pointsEconomyService.getOrCreateUserPoints(targetUserId);
        up.balance = pointsAfter;
        if (pointsAfter > up.lifetime) {
          up.lifetime = pointsAfter;
        }
        up.updated_at = Date.now();
        if (pointsChanged !== 0) {
          pointsEconomyService.recordTransaction(
            targetUserId,
            pointsChanged,
            pointsChanged > 0 ? 'game_won' : 'custom_reward',
            params.matchId,
            pointsChanged > 0
              ? `Kemenangan Catur Pro vs ${botConfig.name} (${botConfig.class_title}) (+${pointsChanged})`
              : `Penalti Catur Pro vs ${botConfig.name} (${botConfig.class_title}) (${pointsChanged})`
          );
        }
        pointsEconomyService.saveToDisk();
      }
    } catch (e) {
      console.warn('Sync chess points to economy service warning:', e);
    }

    const duration = params.durationSec || (match ? Math.round((Date.now() - match.startTime) / 1000) : 60);

    // Save to Database (Prisma) with fallback
    try {
      await prisma.chessProMatch.create({
        data: {
          user_id: params.userId,
          bot_level: botConfig.level,
          bot_name: botConfig.name,
          result: params.result,
          points_changed: pointsChanged,
          user_points_before: pointsBefore,
          user_points_after: pointsAfter,
          pgn: params.pgn || match?.pgn || null,
          duration_sec: duration,
        },
      });

      // Update bot statistics
      await prisma.botChessProfile.upsert({
        where: { level: botConfig.level },
        create: {
          name: botConfig.name,
          level: botConfig.level,
          total_matches: 1,
          total_wins: params.result === 'lose' ? 1 : 0, // Bot wins if user loses
          total_losses: params.result === 'win' ? 1 : 0,
        },
        update: {
          total_matches: { increment: 1 },
          total_wins: params.result === 'lose' ? { increment: 1 } : undefined,
          total_losses: params.result === 'win' ? { increment: 1 } : undefined,
        },
      });
    } catch (dbErr) {
      // Non-critical local JSON backup fallback
      this.saveLocalMatchFallback({
        id: params.matchId,
        user_id: params.userId,
        bot_level: botConfig.level,
        bot_name: botConfig.name,
        result: params.result,
        points_changed: pointsChanged,
        user_points_before: pointsBefore,
        user_points_after: pointsAfter,
        pgn: params.pgn || match?.pgn || null,
        duration_sec: duration,
        created_at: new Date().toISOString(),
      });
    }

    this.activeMatches.delete(params.matchId);

    const isNegative = pointsAfter < 0;
    const warningMessage = isNegative
      ? `Poin Anda sekarang ${pointsAfter}. Terus main dan menangkan kembali poin Anda!`
      : null;

    return {
      success: true,
      match_id: params.matchId,
      result: params.result,
      bot_name: botConfig.name,
      bot_level: botConfig.level,
      stake,
      points_changed: pointsChanged,
      user_points_before: pointsBefore,
      user_points_after: pointsAfter,
      is_negative: isNegative,
      warning_message: warningMessage,
    };
  }

  private saveLocalMatchFallback(record: any) {
    try {
      let list = [];
      if (fs.existsSync(MATCHES_FILE)) {
        list = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf-8'));
      }
      list.unshift(record);
      fs.writeFileSync(MATCHES_FILE, JSON.stringify(list.slice(0, 100), null, 2), 'utf-8');
    } catch (_) {}
  }
}

export const ChessProService = new ChessProServiceClass();
