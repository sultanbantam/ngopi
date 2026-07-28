import { Server, Socket } from 'socket.io';
import { prisma } from '../utils/prisma';
import { checkTokenGate } from '../middleware/tokenGating.middleware';
import { EncryptionService } from '../services/encryption.service';

const getSenderSelect = () => ({
  id: true,
  username: true,
  display_name: true,
  avatar_url: true,
});

const encryptAtRest = (content?: string | null) => content ? EncryptionService.encryptString(content) : null;

const decryptMessageRecord = <T extends { content?: string | null }>(message: T): T => ({
  ...message,
  content: EncryptionService.decryptStringSafe(message.content) ?? message.content,
});

const getActiveGroupMember = async (groupId: string, userId: string) => {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        where: { user_id: userId },
        take: 1,
      }
    }
  });

  return { group, member: group?.members?.[0] || null };
};

const emitGroupAccessError = (socket: Socket, member: any) => {
  if (!member) {
    socket.emit('error', { message: 'Anda belum menjadi anggota rumpun ini. Silakan join dulu.' });
    return true;
  }
  if (member.status === 'pending') {
    socket.emit('error', { message: 'Permintaan join masih menunggu persetujuan admin.' });
    return true;
  }
  if (member.status !== 'active') {
    socket.emit('error', { message: 'Akses rumpun tidak aktif.' });
    return true;
  }
  return false;
};

export const handleChatEvents = (io: Server, socket: Socket, user: { id: string; username: string }) => {
  socket.on('join_room', async (roomId: string) => {
    const { group, member } = await getActiveGroupMember(roomId, user.id);
    if (group) {
      if (emitGroupAccessError(socket, member)) return;

      const allowed = await checkTokenGate(user.id, roomId);
      if (!allowed) {
        socket.emit('error', { message: 'Saldo BMC belum memenuhi syarat untuk masuk rumpun ini.' });
        return;
      }
    }

    socket.join(roomId);
    console.log(`User ${user.username} joined room: ${roomId}`);
  });

  socket.on('send_message', async (data: { room_id: string; receiver_id?: string; content?: string; type?: string; attachment_url?: string; parent_message_id?: string }) => {
    try {
      const { room_id, receiver_id, content, type = 'text', attachment_url, parent_message_id } = data;
      const { group, member } = await getActiveGroupMember(room_id, user.id);

      if (group) {
        if (emitGroupAccessError(socket, member)) return;
        const isAdmin = member?.role === 'admin' || group.created_by === user.id;
        if (group.only_admins_can_send && !isAdmin) {
          socket.emit('error', { message: 'Hanya admin yang dapat mengirim pesan di rumpun ini.' });
          return;
        }
      }

      const savedMessage = await prisma.message.create({
        data: {
          room_id,
          sender_id: user.id,
          content: encryptAtRest(content),
          type,
          attachment_url: attachment_url || null,
          parent_message_id: parent_message_id || null,
        },
        include: {
          sender: {
            select: getSenderSelect()
          }
        }
      });

      if (receiver_id) {
        const outboundMessage = decryptMessageRecord(savedMessage);
        io.to(receiver_id).emit('receive_message', outboundMessage);
        io.to(user.id).emit('receive_message', outboundMessage);
      } else {
        io.to(room_id).emit('receive_message', decryptMessageRecord(savedMessage));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

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

      io.to(room_id).emit('messages_read_by_partner', { room_id, read_by: user.id });
    } catch (err) {
      console.error('Mark read error:', err);
    }
  });

  socket.on('react_message', async (data: { message_id: string; room_id: string; receiver_id?: string; emoji: string }) => {
    try {
      const { message_id, room_id, receiver_id, emoji } = data;
      const message = await prisma.message.findUnique({ where: { id: message_id } });
      if (!message) return;

      const currentReactions = (message.reactions as Record<string, string>) || {};
      if (currentReactions[user.id] === emoji) {
        delete currentReactions[user.id];
      } else {
        currentReactions[user.id] = emoji;
      }

      const updatedMsg = await prisma.message.update({
        where: { id: message_id },
        data: { reactions: currentReactions },
        include: { sender: { select: getSenderSelect() } }
      });

      const outboundMessage = {
        ...decryptMessageRecord(updatedMsg),
        reacted_by: { id: user.id, username: user.username },
      };
      io.to(receiver_id ? [room_id, receiver_id] : room_id).emit('message_reacted', outboundMessage);
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('edit_message', async (data: { message_id: string; room_id: string; receiver_id?: string; new_content: string }) => {
    try {
      const { message_id, room_id, receiver_id, new_content } = data;
      const updatedMsg = await prisma.message.update({
        where: { id: message_id },
        data: { content: encryptAtRest(new_content), is_edited: true },
        include: { sender: { select: getSenderSelect() } }
      });
      const outboundMessage = decryptMessageRecord(updatedMsg);
      io.to(room_id).emit('message_edited', outboundMessage);
      if (receiver_id) io.to(receiver_id).emit('message_edited', outboundMessage);
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('delete_message', async (data: { message_id: string; room_id: string; receiver_id?: string; for_all: boolean }) => {
    try {
      const { message_id, room_id, receiver_id, for_all } = data;
      const message = await prisma.message.findUnique({ where: { id: message_id } });
      if (!message) return;
      if (for_all && message.sender_id !== user.id) return;

      await prisma.message.update({
        where: { id: message_id },
        data: {
          is_deleted: true,
          deleted_for_all: for_all,
          content: for_all ? null : message.content
        }
      });

      const deleteEvent = { message_id, room_id, deleted_by: user.id, for_all };
      io.to(room_id).emit('message_deleted', deleteEvent);
      if (receiver_id) io.to(receiver_id).emit('message_deleted', deleteEvent);
    } catch (e) {
      console.error('Delete message error:', e);
    }
  });

  socket.on('forward_message', async (data: { original_message_id: string; target_room_id: string; target_receiver_id?: string }) => {
    try {
      const { original_message_id, target_room_id, target_receiver_id } = data;
      const originalMsg = await prisma.message.findUnique({ where: { id: original_message_id } });
      if (!originalMsg) return;

      const { group, member } = await getActiveGroupMember(target_room_id, user.id);
      if (group) {
        if (emitGroupAccessError(socket, member)) return;
        const isAdmin = member?.role === 'admin' || group.created_by === user.id;
        if (group.only_admins_can_send && !isAdmin) {
          socket.emit('error', { message: 'Hanya admin yang dapat mengirim pesan di rumpun ini.' });
          return;
        }
      }

      const forwardedMsg = await prisma.message.create({
        data: {
          room_id: target_room_id,
          sender_id: user.id,
          content: encryptAtRest(originalMsg.content),
          type: originalMsg.type,
          attachment_url: originalMsg.attachment_url,
          forwarded_from_id: original_message_id
        },
        include: { sender: { select: getSenderSelect() } }
      });

      if (target_receiver_id) {
        const outboundMessage = decryptMessageRecord(forwardedMsg);
        io.to(target_receiver_id).emit('receive_message', outboundMessage);
        io.to(user.id).emit('receive_message', outboundMessage);
      } else {
        io.to(target_room_id).emit('receive_message', decryptMessageRecord(forwardedMsg));
      }
    } catch (e) {
      console.error('Forward message error:', e);
    }
  });

  socket.on('pin_message', async (data: { message_id: string; room_id: string; receiver_id?: string; is_pinned: boolean }) => {
    try {
      const { message_id, room_id, receiver_id, is_pinned } = data;
      const updatedMsg = await prisma.message.update({
        where: { id: message_id },
        data: { is_pinned },
        include: { sender: { select: getSenderSelect() } }
      });
      const outboundMessage = decryptMessageRecord(updatedMsg);
      io.to(room_id).emit('message_pinned', outboundMessage);
      if (receiver_id) io.to(receiver_id).emit('message_pinned', outboundMessage);
    } catch (e) {
      console.error(e);
    }
  });
};
