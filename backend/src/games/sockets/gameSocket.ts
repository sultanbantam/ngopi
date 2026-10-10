import { Namespace, Server, Socket } from 'socket.io';
import { TableManager } from '../TableManager';
import { prisma } from '../../utils/prisma';
import { PointsManager } from '../../utils/pointsManager';

export const setupGameSocket = (io: Server) => {
  const gamesNamespace: Namespace = io.of('/games');

  // Helper to emit personalized state to each seated player and spectators
  const broadcastGameState = (tableId: string) => {
    const table = TableManager.getTable(tableId);
    if (!table) return;

    // Send state to each seated player
    for (const player of table.players) {
      if (player.is_bot) continue;
      const playerState = TableManager.getGameState(tableId, player.user_id, false);
      if (playerState) {
        gamesNamespace.to(`user:${player.user_id}`).emit('game:state_update', {
          tableId,
          state: playerState,
        });

        if (playerState.currentTurn === player.user_id) {
          gamesNamespace.to(`user:${player.user_id}`).emit('game:your_turn', {
            tableId,
            validMoves: playerState.validMoves,
            canPass: playerState.canPass,
          });
        }
      }
    }

    // Send state to spectators
    const spectatorState = TableManager.getGameState(tableId, '', true);
    if (spectatorState) {
      gamesNamespace.to(`table_specs:${tableId}`).emit('game:state_update', {
        tableId,
        state: spectatorState,
      });
    }

    // Also emit general table metadata
    gamesNamespace.to(`table:${tableId}`).emit('table:state', { table });

    // Check if current turn is a bot and trigger bot move
    triggerBotTurnIfNeeded(tableId);
  };

  // Bot AI automated execution
  const notifyGameFinished = (tableId: string, results: any) => {
    const table = TableManager.getTable(tableId);
    const awardedMap: Record<string, number> = {};

    if (results?.winners && Array.isArray(results.winners)) {
      for (const winnerId of results.winners) {
        const player = table?.players?.find((p) => p.user_id === winnerId);
        if (player && !player.is_bot) {
          const newPts = PointsManager.addPoints(player.username, 50);
          PointsManager.addPoints(player.user_id, 50);
          awardedMap[player.user_id] = newPts;
        }
      }
    }

    gamesNamespace.to(`table:${tableId}`).emit('game:finished', {
      tableId,
      results: {
        ...results,
        pointsAwarded: 50,
        playerPoints: awardedMap,
      },
    });
  };

  const triggerBotTurnIfNeeded = (tableId: string) => {
    const botActionData = TableManager.getBotAction(tableId);
    if (!botActionData) return;

    // Give bot a natural delay (1200ms - 1800ms)
    setTimeout(() => {
      // Re-check if still valid
      const currentBotAction = TableManager.getBotAction(tableId);
      if (!currentBotAction || currentBotAction.botId !== botActionData.botId) return;

      const result = TableManager.handleAction(
        tableId,
        currentBotAction.botId,
        currentBotAction.action,
        currentBotAction.payload
      );

      if (result.success) {
        broadcastGameState(tableId);

        if (result.finished && result.results) {
          notifyGameFinished(tableId, result.results);
        }
      }
    }, 1300);
  };

  gamesNamespace.on('connection', async (socket: Socket) => {
    const user = (socket as any).user;
    const userId = user?.id || (socket.handshake.query.userId as string);
    const username = user?.username || (socket.handshake.query.username as string) || 'Tamu';
    const displayName = user?.display_name || username;

    if (userId) {
      socket.join(`user:${userId}`);
    }

    // Join / listen to a specific table room
    socket.on('table:subscribe', ({ tableId }: { tableId: string }) => {
      if (tableId) {
        socket.join(`table:${tableId}`);
        const table = TableManager.getTable(tableId);
        if (table) {
          socket.emit('table:state', { table });
          if (table.status === 'playing') {
            const isPlayer = table.players.some((p) => p.user_id === userId);
            const state = TableManager.getGameState(tableId, userId, !isPlayer);
            if (state) {
              socket.emit('game:state_update', { tableId, state });
            }
          }
        }
      }
    });

    // Create Table
    socket.on('table:create', async (data, callback) => {
      try {
        const table = await TableManager.createTable({
          gameType: data.gameType || 'gapleh',
          name: data.name,
          host: { id: userId, username, display_name: displayName, avatar_url: user?.avatar_url },
          maxPlayers: data.maxPlayers,
          minPlayers: data.minPlayers,
          isPrivate: data.isPrivate,
          password: data.password,
          warungId: data.warungId,
          config: data.config,
        });

        socket.join(`table:${table.id}`);
        if (typeof callback === 'function') callback({ success: true, table });
        gamesNamespace.emit('table:created', { table });
      } catch (err: any) {
        if (typeof callback === 'function') callback({ success: false, error: err.message });
      }
    });

    // Join Table
    socket.on('table:join', (data: { tableId: string; password?: string }, callback) => {
      const res = TableManager.joinTable(data.tableId, {
        id: userId,
        username,
        display_name: displayName,
        avatar_url: user?.avatar_url,
      }, data.password);

      if (res.success && res.table) {
        socket.join(`table:${data.tableId}`);
        gamesNamespace.to(`table:${data.tableId}`).emit('table:player_joined', {
          player: res.table.players.find((p) => p.user_id === userId),
          table: res.table,
        });
        if (typeof callback === 'function') callback({ success: true, table: res.table });
      } else {
        if (typeof callback === 'function') callback({ success: false, error: res.error });
      }
    });

    // Add Bot Player
    socket.on('table:add_bot', (data: { tableId: string }, callback) => {
      const res = TableManager.addBot(data.tableId, userId);
      if (res.success && res.table) {
        gamesNamespace.to(`table:${data.tableId}`).emit('table:player_joined', {
          player: res.bot,
          table: res.table,
        });
        if (typeof callback === 'function') callback({ success: true, table: res.table, bot: res.bot });
      } else {
        if (typeof callback === 'function') callback({ success: false, error: res.error });
      }
    });

    // Toggle Ready
    socket.on('table:ready', (data: { tableId: string; isReady: boolean }, callback) => {
      const res = TableManager.setReady(data.tableId, userId, data.isReady);
      if (res.success && res.table) {
        gamesNamespace.to(`table:${data.tableId}`).emit('table:state', { table: res.table });
        if (typeof callback === 'function') callback({ success: true, table: res.table });
      } else {
        if (typeof callback === 'function') callback({ success: false, error: res.error });
      }
    });

    // Start Game
    socket.on('table:start', (data: { tableId: string }, callback) => {
      const res = TableManager.startGame(data.tableId, userId);
      if (res.success && res.table) {
        gamesNamespace.to(`table:${data.tableId}`).emit('game:started', { table: res.table });
        broadcastGameState(data.tableId);
        if (typeof callback === 'function') callback({ success: true, table: res.table });
      } else {
        if (typeof callback === 'function') callback({ success: false, error: res.error });
      }
    });

    // Handle Game Action (Card play / Pass)
    socket.on('game:action', (data: { tableId: string; action: string; payload: any }, callback) => {
      const res = TableManager.handleAction(data.tableId, userId, data.action, data.payload);

      if (res.success) {
        if (typeof callback === 'function') callback({ success: true, data: res.data });
        broadcastGameState(data.tableId);

        if (res.finished && res.results) {
          notifyGameFinished(data.tableId, res.results);
        }
      } else {
        if (typeof callback === 'function') callback({ success: false, error: res.error });
      }
    });

    // Get Points
    socket.on('game:get_points', (callback) => {
      const pts = PointsManager.getPoints(username) || PointsManager.getPoints(userId);
      if (typeof callback === 'function') callback({ success: true, points: pts });
    });

    // Spectate Table
    socket.on('table:spectate', (data: { tableId: string }, callback) => {
      const res = TableManager.spectateTable(data.tableId, {
        id: userId,
        username,
        display_name: displayName,
        avatar_url: user?.avatar_url,
      });

      if (res.success && res.table) {
        socket.join(`table:${data.tableId}`);
        socket.join(`table_specs:${data.tableId}`);
        const state = TableManager.getGameState(data.tableId, userId, true);
        if (state) {
          socket.emit('game:state_update', { tableId: data.tableId, state });
        }
        if (typeof callback === 'function') callback({ success: true, table: res.table });
      } else {
        if (typeof callback === 'function') callback({ success: false, error: res.error });
      }
    });

    // Leave Table
    socket.on('table:leave', (data: { tableId: string }, callback) => {
      const res = TableManager.leaveTable(data.tableId, userId);
      socket.leave(`table:${data.tableId}`);
      socket.leave(`table_specs:${data.tableId}`);

      if (res.success) {
        if (res.tableDeleted) {
          gamesNamespace.emit('table:deleted', { tableId: data.tableId });
        } else if (res.table) {
          gamesNamespace.to(`table:${data.tableId}`).emit('table:player_left', {
            userId,
            table: res.table,
          });
        }
        if (typeof callback === 'function') callback({ success: true });
      }
    });

    // In-table Chat
    socket.on('game:chat', (data: { tableId: string; message: string }) => {
      if (!data.message || !data.message.trim()) return;
      const msg = TableManager.addChatMessage(
        data.tableId,
        { id: userId, name: displayName },
        data.message.trim()
      );
      if (msg) {
        gamesNamespace.to(`table:${data.tableId}`).emit('game:chat_message', msg);
      }
    });

    // Quick Emote (👏, 😂, ☕, 🔥, 💩)
    socket.on('game:emote', (data: { tableId: string; emote: string }) => {
      if (!data.emote) return;
      gamesNamespace.to(`table:${data.tableId}`).emit('game:emote_received', {
        senderId: userId,
        senderName: displayName,
        emote: data.emote,
      });
    });
  });
};
