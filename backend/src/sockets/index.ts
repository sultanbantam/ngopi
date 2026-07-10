import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { handleChatEvents } from './chat.handler';
import { emitBambupediaMembers, handleBambupediaEvents, startBambupediaTips } from './bambupedia.handler';
import { handleTicketEvents } from './ticket.handler';
import { prisma } from '../utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

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
  // Start rotating feature tips for Bambupedia room
  startBambupediaTips(io);
  // Middleware for authentication
  io.use((socket: Socket, next) => {
    const token = socket.handshake.query.token as string;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string };
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
    socket.on('call_user', (data) => {
      // Emits to the recipient's personal room
      socket.to(data.userToCall).emit('call_incoming', { 
        signal: data.signalData, 
        from: user.id, 
        name: user.username,
        room_id: data.room_id,
        isVideo: data.isVideo
      });
    });

    socket.on('answer_call', (data) => {
      socket.to(data.to).emit('call_accepted', data.signal);
    });

    socket.on('end_call', (data) => {
      socket.to(data.to).emit('call_ended');
    });

    socket.on('ice_candidate', (data) => {
      socket.to(data.to).emit('ice_candidate', data.candidate);
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



