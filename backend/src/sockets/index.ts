import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { handleChatEvents } from './chat.handler';
import { prisma } from '../utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

export const setupSocket = (io: Server) => {
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

    // Let the user join a personal room with their own ID to receive direct messages easily
    socket.join(user.id);

    // Update online status
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { is_online: true },
      });
      io.emit('user_status_change', { user_id: user.id, is_online: true });
    } catch (e) {
      console.error('Error updating online status:', e);
    }

    // Register chat handlers
    handleChatEvents(io, socket, user);

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

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${user.username} (${socket.id})`);
      try {
        const lastSeen = new Date();
        await prisma.user.update({
          where: { id: user.id },
          data: { is_online: false, last_seen: lastSeen },
        });
        io.emit('user_status_change', { user_id: user.id, is_online: false, last_seen: lastSeen });
      } catch (e) {
        console.error('Error updating offline status:', e);
      }
    });
  });
};
