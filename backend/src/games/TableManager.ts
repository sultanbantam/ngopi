import crypto from 'crypto';
import { BaseGame } from './engine/BaseGame';
import { GameRegistry } from './engine/GameRegistry';
import {
  ActionResult,
  GamePlayerInfo,
  GameSpectatorInfo,
  GameTableData,
  GameType,
  TableConfig,
  TableStatus,
} from './engine/types';
import { GaplehGame } from './gapleh/GaplehGame';
import { prisma } from '../utils/prisma';

const makeId = (prefix = 'id') => `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

// Register built-in games
GameRegistry.register('gapleh', GaplehGame);

interface ActiveTable {
  data: GameTableData;
  gameInstance: BaseGame | null;
  turnTimer: NodeJS.Timeout | null;
  chatMessages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    message: string;
    timestamp: string;
  }>;
}

const BOT_NAMES = [
  'Kang Kopi Bot ☕',
  'Mang Udin Bot 🎲',
  'Bang Jago Bot 🔥',
  'Pak RT Bot 🁫',
];

export class TableManager {
  private static tables = new Map<string, ActiveTable>();

  // Create Table
  public static async createTable(params: {
    gameType: GameType;
    name: string;
    host: { id: string; username: string; display_name: string; avatar_url?: string | null };
    maxPlayers?: number;
    minPlayers?: number;
    isPrivate?: boolean;
    password?: string;
    warungId?: string | null;
    config?: TableConfig;
  }): Promise<GameTableData> {
    const tableId = makeId('tbl');
    const maxPlayers = params.maxPlayers || (params.gameType === 'catur' ? 2 : 4);
    const minPlayers = params.minPlayers || 2;

    const hostPlayer: GamePlayerInfo = {
      id: makeId('p'),
      user_id: params.host.id,
      username: params.host.username,
      display_name: params.host.display_name,
      avatar_url: params.host.avatar_url ?? null,
      seat_number: 0,
      is_ready: true, // Host is ready by default
      is_active: true,
      is_bot: false,
    };

    const tableData: GameTableData = {
      id: tableId,
      warung_id: params.warungId || null,
      game_type: params.gameType,
      name: params.name || `Meja ${params.gameType.toUpperCase()}`,
      max_players: maxPlayers,
      min_players: minPlayers,
      status: 'waiting',
      is_private: !!params.isPrivate,
      has_password: !!params.password,
      host_id: params.host.id,
      created_at: new Date().toISOString(),
      players: [hostPlayer],
      spectators: [],
      config: {
        turnTimeLimitSec: 30,
        ...params.config,
        password: params.password ?? undefined,
      },
    };

    const activeTable: ActiveTable = {
      data: tableData,
      gameInstance: null,
      turnTimer: null,
      chatMessages: [],
    };

    this.tables.set(tableId, activeTable);

    // Optional async DB save in background
    this.persistTableToDb(tableData).catch((err) =>
      console.warn('DB table sync error (falling back to memory):', err?.message)
    );

    return this.sanitizeTableData(tableData);
  }

  // Get single table
  public static getTable(tableId: string): GameTableData | null {
    const active = this.tables.get(tableId);
    return active ? this.sanitizeTableData(active.data) : null;
  }

  // List public or filtered tables
  public static listTables(filter?: { gameType?: string; warungId?: string }): GameTableData[] {
    const list: GameTableData[] = [];
    for (const active of this.tables.values()) {
      if (filter?.gameType && active.data.game_type !== filter.gameType) {
        continue;
      }
      if (filter?.warungId && active.data.warung_id !== filter.warungId) {
        continue;
      }
      list.push(this.sanitizeTableData(active.data));
    }
    return list;
  }

  // Join table as player
  public static joinTable(
    tableId: string,
    user: { id: string; username: string; display_name: string; avatar_url?: string | null },
    password?: string
  ): { success: boolean; error?: string; table?: GameTableData } {
    const active = this.tables.get(tableId);
    if (!active) {
      return { success: false, error: 'Meja tidak ditemukan.' };
    }

    if (active.data.status !== 'waiting') {
      return { success: false, error: 'Permainan di meja ini sudah dimulai.' };
    }

    if (active.data.is_private && active.data.config?.password && active.data.config.password !== password) {
      return { success: false, error: 'Kata sandi meja salah.' };
    }

    // Check if player is already seated
    const existingPlayer = active.data.players.find((p) => p.user_id === user.id);
    if (existingPlayer) {
      return { success: true, table: this.sanitizeTableData(active.data) };
    }

    if (active.data.players.length >= active.data.max_players) {
      return { success: false, error: 'Meja sudah penuh.' };
    }

    // Determine lowest available seat number
    const takenSeats = new Set(active.data.players.map((p) => p.seat_number));
    let nextSeat = 0;
    while (takenSeats.has(nextSeat)) {
      nextSeat++;
    }

    const newPlayer: GamePlayerInfo = {
      id: makeId('p'),
      user_id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url ?? null,
      seat_number: nextSeat,
      is_ready: false,
      is_active: true,
      is_bot: false,
    };

    active.data.players.push(newPlayer);
    return { success: true, table: this.sanitizeTableData(active.data) };
  }

  // Add bot player for instant testing/play
  public static addBot(
    tableId: string,
    hostUserId: string
  ): { success: boolean; error?: string; bot?: GamePlayerInfo; table?: GameTableData } {
    const active = this.tables.get(tableId);
    if (!active) return { success: false, error: 'Meja tidak ditemukan.' };
    if (active.data.host_id !== hostUserId) return { success: false, error: 'Hanya host yang bisa menambah bot.' };
    if (active.data.status !== 'waiting') return { success: false, error: 'Permainan sudah dimulai.' };
    if (active.data.players.length >= active.data.max_players) return { success: false, error: 'Meja sudah penuh.' };

    const takenSeats = new Set(active.data.players.map((p) => p.seat_number));
    let nextSeat = 0;
    while (takenSeats.has(nextSeat)) nextSeat++;

    const botIndex = active.data.players.filter((p) => p.is_bot).length;
    const botName = BOT_NAMES[botIndex % BOT_NAMES.length] || 'Kang Kopi Bot ☕';
    const botId = makeId('bot');

    const botPlayer: GamePlayerInfo = {
      id: makeId('p'),
      user_id: botId,
      username: `bot_${nextSeat + 1}`,
      display_name: botName,
      avatar_url: null,
      seat_number: nextSeat,
      is_ready: true,
      is_active: true,
      is_bot: true,
    };

    active.data.players.push(botPlayer);
    return { success: true, bot: botPlayer, table: this.sanitizeTableData(active.data) };
  }

  // Set ready status
  public static setReady(
    tableId: string,
    userId: string,
    isReady: boolean
  ): { success: boolean; error?: string; table?: GameTableData } {
    const active = this.tables.get(tableId);
    if (!active) return { success: false, error: 'Meja tidak ditemukan.' };

    const player = active.data.players.find((p) => p.user_id === userId);
    if (!player) return { success: false, error: 'Pemain tidak ditemukan di meja ini.' };

    player.is_ready = isReady;
    return { success: true, table: this.sanitizeTableData(active.data) };
  }

  // Start Game
  public static startGame(
    tableId: string,
    hostUserId: string
  ): { success: boolean; error?: string; table?: GameTableData; state?: any } {
    const active = this.tables.get(tableId);
    if (!active) return { success: false, error: 'Meja tidak ditemukan.' };
    if (active.data.host_id !== hostUserId) return { success: false, error: 'Hanya host yang bisa memulai permainan.' };
    if (active.data.players.length < active.data.min_players) {
      return { success: false, error: `Minimal butuh ${active.data.min_players} pemain untuk memulai.` };
    }

    try {
      const gameInstance = GameRegistry.create(
        active.data.game_type,
        active.data.players,
        active.data.config || {}
      );

      active.gameInstance = gameInstance;
      active.data.status = 'playing';

      return {
        success: true,
        table: this.sanitizeTableData(active.data),
        state: gameInstance.getRawState(),
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Gagal memulai permainan.' };
    }
  }

  // Handle Game Action
  public static handleAction(
    tableId: string,
    userId: string,
    action: string,
    payload: any
  ): ActionResult {
    const active = this.tables.get(tableId);
    if (!active || !active.gameInstance) {
      return { success: false, error: 'Permainan belum aktif di meja ini.' };
    }

    const result = active.gameInstance.handleAction(userId, action, payload);

    if (result.finished) {
      active.data.status = 'finished';
      if (active.turnTimer) clearTimeout(active.turnTimer);
    }

    return result;
  }

  // Get state tailored for a player or spectator
  public static getGameState(tableId: string, userId: string, isSpectator = false): any {
    const active = this.tables.get(tableId);
    if (!active || !active.gameInstance) return null;

    if (isSpectator) {
      return active.gameInstance.getStateForSpectator();
    }
    return active.gameInstance.getStateForPlayer(userId);
  }

  // Check if current turn is a bot and get their action
  public static getBotAction(tableId: string): { botId: string; action: string; payload: any } | null {
    const active = this.tables.get(tableId);
    if (!active || !active.gameInstance) return null;

    const raw = active.gameInstance.getRawState();
    const currentTurn = raw?.currentTurn;
    if (!currentTurn) return null;

    const botPlayer = active.data.players.find((p) => p.user_id === currentTurn && p.is_bot);
    if (!botPlayer) return null;

    if (typeof active.gameInstance.getBotAction === 'function') {
      const botMove = active.gameInstance.getBotAction(botPlayer.user_id);
      if (botMove) {
        return { botId: botPlayer.user_id, ...botMove };
      }
    }
    return null;
  }

  // Leave Table
  public static leaveTable(
    tableId: string,
    userId: string
  ): { success: boolean; error?: string; tableDeleted?: boolean; table?: GameTableData } {
    const active = this.tables.get(tableId);
    if (!active) return { success: false, error: 'Meja tidak ditemukan.' };

    const playerIndex = active.data.players.findIndex((p) => p.user_id === userId);
    if (playerIndex !== -1) {
      active.data.players.splice(playerIndex, 1);
    }

    // Remove from spectators if present
    const specIndex = active.data.spectators.findIndex((s) => s.user_id === userId);
    if (specIndex !== -1) {
      active.data.spectators.splice(specIndex, 1);
    }

    // If host leaves and there are other human players, promote next human
    if (active.data.host_id === userId) {
      const nextHuman = active.data.players.find((p) => !p.is_bot);
      if (nextHuman) {
        active.data.host_id = nextHuman.user_id;
      } else {
        // No human players left => delete table
        if (active.turnTimer) clearTimeout(active.turnTimer);
        this.tables.delete(tableId);
        return { success: true, tableDeleted: true };
      }
    }

    // If table is empty
    if (active.data.players.length === 0) {
      if (active.turnTimer) clearTimeout(active.turnTimer);
      this.tables.delete(tableId);
      return { success: true, tableDeleted: true };
    }

    return { success: true, table: this.sanitizeTableData(active.data) };
  }

  // Spectate
  public static spectateTable(
    tableId: string,
    user: { id: string; username: string; display_name: string; avatar_url?: string | null }
  ): { success: boolean; error?: string; table?: GameTableData } {
    const active = this.tables.get(tableId);
    if (!active) return { success: false, error: 'Meja tidak ditemukan.' };

    const exists = active.data.spectators.some((s) => s.user_id === user.id);
    if (!exists) {
      active.data.spectators.push({
        id: makeId('s'),
        user_id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url ?? null,
        joined_at: new Date().toISOString(),
      });
    }

    return { success: true, table: this.sanitizeTableData(active.data) };
  }

  // In-table chat
  public static addChatMessage(
    tableId: string,
    sender: { id: string; name: string },
    message: string
  ): any {
    const active = this.tables.get(tableId);
    if (!active) return null;

    const chatItem = {
      id: makeId('chat'),
      senderId: sender.id,
      senderName: sender.name,
      message,
      timestamp: new Date().toISOString(),
    };

    active.chatMessages.push(chatItem);
    if (active.chatMessages.length > 100) {
      active.chatMessages.shift();
    }

    return chatItem;
  }

  public static getChatMessages(tableId: string): any[] {
    const active = this.tables.get(tableId);
    return active ? [...active.chatMessages] : [];
  }

  // Remove secret password before sending to client
  private static sanitizeTableData(data: GameTableData): GameTableData {
    const clone = { ...data };
    if (clone.config) {
      clone.config = { ...clone.config };
      delete clone.config.password;
    }
    return clone;
  }

  // Background DB sync helper
  private static async persistTableToDb(tableData: GameTableData): Promise<void> {
    try {
      if ((prisma as any).gameTable) {
        await (prisma as any).gameTable.create({
          data: {
            id: tableData.id,
            warung_id: tableData.warung_id,
            game_type: tableData.game_type,
            name: tableData.name,
            max_players: tableData.max_players,
            min_players: tableData.min_players,
            status: tableData.status,
            is_private: tableData.is_private,
            host_id: tableData.host_id,
          },
        });
      }
    } catch (e) {
      // Table may not exist yet in DB or migration not run
    }
  }
}
