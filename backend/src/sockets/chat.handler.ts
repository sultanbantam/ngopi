import { Server, Socket } from 'socket.io';
import { prisma } from '../utils/prisma';
import { checkTokenGate } from '../middleware/tokenGating.middleware';

export const handleChatEvents = (io: Server, socket: Socket, user: { id: string; username: string }) => {
  // Event to join a specific room (group or 1-on-1 generated room)
  socket.on('join_room', async (roomId: string) => {
    // Check if room is a group and apply token gating
    const group = await prisma.group.findUnique({ where: { id: roomId } });
    if (group) {
      const allowed = await checkTokenGate(user.id, roomId);
      if (!allowed) {
        socket.emit('error', { message: 'Insufficient BMC balance to join this group' });
        return; // Reject join
      }
    }

    socket.join(roomId);
    console.log(`User ${user.username} joined room: ${roomId}`);
  });

  // Event to send a message
  socket.on('send_message', async (data: { room_id: string; receiver_id?: string; content?: string; type?: string; attachment_url?: string }) => {
    try {
      const { room_id, receiver_id, content, type = 'text', attachment_url } = data;

      // Save to database
      const savedMessage = await prisma.message.create({
        data: {
          room_id,
          sender_id: user.id,
          content: content || null, // This should be encrypted ciphertext from frontend (if text)
          type,
          attachment_url: attachment_url || null,
        }
      });

      // Broadcast to the room if it's a group, or directly to receiver if 1-on-1
      if (receiver_id) {
        // Direct message
        io.to(receiver_id).emit('receive_message', savedMessage);
        // Also emit to self (in case user has multiple devices/tabs open)
        io.to(user.id).emit('receive_message', savedMessage);
      } else {
        // Group message
        io.to(room_id).emit('receive_message', savedMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing Indicators
  socket.on('typing_start', (data: { room_id: string; receiver_id?: string }) => {
    if (data.receiver_id) {
      io.to(data.receiver_id).emit('typing_start', { sender_id: user.id, room_id: data.room_id });
    } else {
      socket.to(data.room_id).emit('typing_start', { sender_id: user.id, room_id: data.room_id });
    }
  });

  socket.on('typing_stop', (data: { room_id: string; receiver_id?: string }) => {
    if (data.receiver_id) {
      io.to(data.receiver_id).emit('typing_stop', { sender_id: user.id, room_id: data.room_id });
    } else {
      socket.to(data.room_id).emit('typing_stop', { sender_id: user.id, room_id: data.room_id });
    }
  });

  // Event to mark messages as read
  socket.on('mark_messages_read', async (data: { room_id: string; sender_id: string }) => {
    try {
      const { room_id, sender_id } = data;

      await prisma.message.updateMany({
        where: {
          room_id,
          sender_id,
          is_read: false
        },
        data: {
          is_read: true
        }
      });

      // Notify the sender that their messages were read
      io.to(room_id).emit('messages_read_by_partner', { room_id, read_by: user.id });
    } catch (err) {
      console.error('Mark read error:', err);
    }
  });

  // WhatsApp Features
  socket.on('react_message', async (data: { message_id: string; room_id: string; receiver_id?: string; emoji: string }) => {
    try {
      const { message_id, room_id, receiver_id, emoji } = data;
      
      const message = await prisma.message.findUnique({ where: { id: message_id } });
      if (!message) return;
      
      // Update reactions json
      const currentReactions = (message.reactions as Record<string, string>) || {};
      if (currentReactions[user.id] === emoji) {
        delete currentReactions[user.id]; // toggle off
      } else {
        currentReactions[user.id] = emoji; // set
      }

      const updatedMsg = await prisma.message.update({
        where: { id: message_id },
        data: { reactions: currentReactions }
      });

      io.to(room_id).emit('message_reacted', updatedMsg);
      if (receiver_id) io.to(receiver_id).emit('message_reacted', updatedMsg);
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('edit_message', async (data: { message_id: string; room_id: string; receiver_id?: string; new_content: string }) => {
    try {
      const { message_id, room_id, receiver_id, new_content } = data;
      const updatedMsg = await prisma.message.update({
        where: { id: message_id },
        data: { content: new_content, is_edited: true }
      });
      io.to(room_id).emit('message_edited', updatedMsg);
      if (receiver_id) io.to(receiver_id).emit('message_edited', updatedMsg);
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('pin_message', async (data: { message_id: string; room_id: string; receiver_id?: string; is_pinned: boolean }) => {
    try {
      const { message_id, room_id, receiver_id, is_pinned } = data;
      const updatedMsg = await prisma.message.update({
        where: { id: message_id },
        data: { is_pinned }
      });
      io.to(room_id).emit('message_pinned', updatedMsg);
      if (receiver_id) io.to(receiver_id).emit('message_pinned', updatedMsg);
    } catch (e) {
      console.error(e);
    }
  });
};
