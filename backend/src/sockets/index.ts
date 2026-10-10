import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { handleChatEvents } from './chat.handler';
import { emitBambupediaMembers, handleBambupediaEvents, startBambupediaEcosystemInfo, startBambupediaTips } from './bambupedia.handler';
import { handleTicketEvents } from './ticket.handler';
import { prisma } from '../utils/prisma';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';
const DEFAULT_ICE_SERVERS = [
  { urls: ['stun:stun.l.google.com:19302'] },
  { urls: ['stun:stun1.l.google.com:19302'] },
  { urls: ['stun:stun2.l.google.com:19302'] },
  { urls: ['stun:stun3.l.google.com:19302'] },
  { urls: ['stun:stun4.l.google.com:19302'] },
  { urls: ['stun:stun.services.mozilla.com'] },
];

const createIceServers = (userId: string) => {
  const sharedSecret = process.env.TURN_SHARED_SECRET;
  const turnHost = process.env.TURN_HOST;
  if (!sharedSecret || !turnHost) return DEFAULT_ICE_SERVERS;

  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const username = expiresAt + ':' + userId;
  const credential = crypto.createHmac('sha1', sharedSecret).update(username).digest('base64');
  return [
    ...DEFAULT_ICE_SERVERS,
    {
      urls: [
        'turn:' + turnHost + ':3478?transport=udp',
        'turn:' + turnHost + ':3478?transport=tcp',
      ],
      username,
      credential,
    },
  ];
};

type SocketTokenPayload = {
  id: string;
  username: string;
  role?: string;
  token_type?: string;
};

const readSingleValue = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === 'string' && item.trim().length > 0) || null;
  }
  return null;
};

const decodeCookieValue = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const getCookieValue = (cookieHeader: string | string[] | undefined, name: string) => {
  const header = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader;
  if (!header) return null;

  for (const cookie of header.split(';')) {
    const [rawName, ...rawValueParts] = cookie.trim().split('=');
    if (rawName === name && rawValueParts.length > 0) {
      return decodeCookieValue(rawValueParts.join('='));
    }
  }

  return null;
};

const getSocketAuthToken = (socket: Socket) => {
  const auth = socket.handshake.auth as Record<string, unknown> | undefined;
  const authToken = readSingleValue(auth?.token);
  const queryToken = readSingleValue(socket.handshake.query.token);
  const cookieToken = getCookieValue(socket.handshake.headers.cookie, 'token');
  return authToken || queryToken || cookieToken;
};

const broadcastOnlineList = async (io: Server) => {
  try {
    const onlineUsers = await prisma.user.findMany({
      where: { is_online: true },
      select: {
        id: true,
        username: true,
        display_name: true,
        avatar_url: true,
      }
    });
    io.emit('online_list', onlineUsers);
  } catch (e) {
    console.error('Error broadcasting online list:', e);
  }
};

export const setupSocket = (io: Server) => {
  const recentCallEvents = new Map<string, number>();
  // Start scheduled ecosystem platform messages and BambooChat usage tips for Bambupedia room
  startBambupediaEcosystemInfo(io);
  startBambupediaTips(io);
  // Middleware for authentication
  io.use((socket: Socket, next) => {
    const token = getSocketAuthToken(socket);

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as SocketTokenPayload;
      if (decoded.token_type && decoded.token_type !== 'access') {
        return next(new Error('Authentication error: Invalid token type'));
      }

      // Attach user info to socket
      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`User connected: ${user.username} (${socket.id})`);

    // Fetch full user profile for Bambupedia
    let fullUser: { id: string; username: string; display_name?: string | null; avatar_url?: string | null } = user;
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, username: true, display_name: true, avatar_url: true }
      });
      if (dbUser) fullUser = dbUser;
    } catch (e) {
      console.error('Error fetching user for bambupedia:', e);
    }

    // Let the user join a personal room with their own ID to receive direct messages easily
    socket.join(user.id);

    // Update online status
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { is_online: true },
      });
      io.emit('user_status_change', { user_id: user.id, is_online: true });
      // Broadcast updated online list
      await broadcastOnlineList(io);
      await emitBambupediaMembers(io);
    } catch (e) {
      console.error('Error updating online status:', e);
    }

    // Register chat handlers
    handleChatEvents(io, socket, user);
    handleTicketEvents(io, socket, user);

    // Register Bambupedia community lobby handler
    handleBambupediaEvents(io, socket, fullUser);

    // WebRTC Signaling
    socket.on('get_ice_servers', (callback) => {
      if (typeof callback === 'function') callback({ iceServers: createIceServers(user.id) });
    });

    socket.on('call_user', (data) => {
      const callId = typeof data?.call_id === 'string' ? data.call_id.trim() : '';
      const recipientId = typeof data?.userToCall === 'string' ? data.userToCall.trim() : '';
      if (!callId || !recipientId) return;
      const dedupeKey = `${user.id}:${recipientId}:${callId}`;
      const now = Date.now();
      if (now - (recentCallEvents.get(dedupeKey) || 0) < 3_000) return;
      recentCallEvents.set(dedupeKey, now);
      if (recentCallEvents.size > 1_000) {
        recentCallEvents.forEach((createdAt, key) => { if (now - createdAt > 10_000) recentCallEvents.delete(key); });
      }
      // Emits to the recipient's personal room
      socket.to(recipientId).emit('call_incoming', {
        signal: data.signalData, 
        from: user.id, 
        name: user.username,
        room_id: data.room_id,
        isVideo: data.isVideo,
        call_id: callId
      });
    });

    socket.on('answer_call', (data) => {
      socket.to(data.to).emit('call_accepted', { signal: data.signal, call_id: data.call_id, room_id: data.room_id });
    });

    socket.on('restart_call', (data) => {
      socket.to(data.to).emit('call_restart_offer', { signal: data.signal, call_id: data.call_id, room_id: data.room_id });
    });

    socket.on('answer_restart_call', (data) => {
      socket.to(data.to).emit('call_restart_answer', { signal: data.signal, call_id: data.call_id, room_id: data.room_id });
    });

    socket.on('end_call', (data) => {
      socket.to(data.to).emit('call_ended', { call_id: data.call_id });
    });

    socket.on('ice_candidate', (data) => {
      socket.to(data.to).emit('ice_candidate', { candidate: data.candidate, call_id: data.call_id, room_id: data.room_id });
    });

    // Jukebox Warung real-time events
    socket.on('jukebox:track_changed', (data: { warung_id: string; track: any }) => {
      io.to(data.warung_id).emit('jukebox:track_changed', data.track);
    });

    socket.on('jukebox:sync', (data: { warung_id: string; position: number; is_playing: boolean; track_id?: string }) => {
      socket.to(data.warung_id).emit('jukebox:sync', data);
    });

    // Real-time E2EE Key Renegotiation notify
    socket.on('keys:renegotiate', (data: { target_user_id: string; public_key?: string }) => {
      if (data.target_user_id) {
        socket.to(data.target_user_id).emit('keys:updated', {
          user_id: user.id,
          public_key: data.public_key,
        });
      }
    });

    // Request online list on demand
    socket.on('request_online_list', async () => {
      await broadcastOnlineList(io);
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${user.username} (${socket.id})`);
      try {
        const lastSeen = new Date();
        await prisma.user.update({
          where: { id: user.id },
          data: { is_online: false, last_seen: lastSeen },
        });
        io.emit('user_status_change', { user_id: user.id, is_online: false, last_seen: lastSeen });
        // Broadcast updated online list
        await broadcastOnlineList(io);
        await emitBambupediaMembers(io);
      } catch (e) {
        console.error('Error updating offline status:', e);
      }
    });
  });
};
