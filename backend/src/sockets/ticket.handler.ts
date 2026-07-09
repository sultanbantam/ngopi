import { Server, Socket } from 'socket.io';
import { prisma } from '../utils/prisma';

const STAFF_ROLES = ['admin', 'agent'];
const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

const getRole = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role || 'user';
};

const isStaff = (role: string) => STAFF_ROLES.includes(role);

const canAccessTicket = async (ticketId: string, userId: string, role: string) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;
  if (isStaff(role) || ticket.user_id === userId || ticket.assigned_agent_id === userId) return ticket;
  return null;
};

const emitTicketUpdate = (io: Server, ticket: { id: string; user_id: string; assigned_agent_id: string | null }) => {
  io.to(`ticket:${ticket.id}`).emit('ticket_updated', { ticket_id: ticket.id });
  io.to(ticket.user_id).emit('ticket_updated', { ticket_id: ticket.id });
  if (ticket.assigned_agent_id) {
    io.to(ticket.assigned_agent_id).emit('ticket_updated', { ticket_id: ticket.id });
  }
};

export const handleTicketEvents = (io: Server, socket: Socket, user: { id: string; username: string }) => {
  socket.on('join_ticket', async (ticketId: string) => {
    try {
      if (!ticketId) return;
      const role = await getRole(user.id);
      const ticket = await canAccessTicket(ticketId, user.id, role);

      if (!ticket) {
        socket.emit('ticket_error', { message: 'Ticket not found or forbidden' });
        return;
      }

      socket.join(`ticket:${ticket.id}`);
      socket.emit('ticket_joined', { ticket_id: ticket.id });
    } catch (error) {
      console.error('Join ticket error:', error);
      socket.emit('ticket_error', { message: 'Failed to join ticket' });
    }
  });

  socket.on('ticket_send_message', async (data: { ticket_id?: string; content?: string; is_internal?: boolean }) => {
    try {
      const ticketId = typeof data?.ticket_id === 'string' ? data.ticket_id : '';
      const content = typeof data?.content === 'string' ? data.content.trim() : '';

      if (!ticketId || !content) return;

      const role = await getRole(user.id);
      const ticket = await canAccessTicket(ticketId, user.id, role);

      if (!ticket) {
        socket.emit('ticket_error', { message: 'Ticket not found or forbidden' });
        return;
      }
      if (ticket.status === 'closed') {
        socket.emit('ticket_error', { message: 'Ticket is closed' });
        return;
      }

      const internalRequested = Boolean(data?.is_internal);
      const isInternal = isStaff(role) && internalRequested;

      if (!isStaff(role) && ticket.user_id !== user.id) {
        socket.emit('ticket_error', { message: 'Forbidden' });
        return;
      }

      const message = await prisma.ticketMessage.create({
        data: {
          ticket_id: ticket.id,
          sender_id: user.id,
          content,
          is_internal: isInternal,
        },
        include: {
          sender: { select: { id: true, username: true, display_name: true, role: true } },
        },
      });

      const updateData: any = { updated_at: new Date() };
      if (isStaff(role)) {
        if (!ticket.assigned_agent_id) updateData.assigned_agent_id = user.id;
        if (ticket.status === 'open') updateData.status = 'in_progress';
      }

      const updatedTicket = await prisma.ticket.update({ where: { id: ticket.id }, data: updateData });
      await prisma.ticketAuditLog.create({
        data: {
          ticket_id: ticket.id,
          actor_id: user.id,
          action: isInternal ? 'internal_note_added' : isStaff(role) ? 'agent_replied' : 'user_replied',
        },
      });

      io.to(`ticket:${ticket.id}`).emit('ticket_message', message);
      emitTicketUpdate(io, updatedTicket);
    } catch (error) {
      console.error('Ticket send message error:', error);
      socket.emit('ticket_error', { message: 'Failed to send ticket message' });
    }
  });

  socket.on('ticket_update_status', async (data: { ticket_id?: string; status?: string }) => {
    try {
      const ticketId = typeof data?.ticket_id === 'string' ? data.ticket_id : '';
      const status = typeof data?.status === 'string' ? data.status : '';
      const role = await getRole(user.id);

      if (!isStaff(role)) {
        socket.emit('ticket_error', { message: 'Staff access required' });
        return;
      }
      if (!ticketId || !TICKET_STATUSES.includes(status)) {
        socket.emit('ticket_error', { message: 'Invalid ticket status payload' });
        return;
      }

      const ticket = await prisma.ticket.update({
        where: { id: ticketId },
        data: { status: status as any },
      });

      await prisma.ticketAuditLog.create({
        data: {
          ticket_id: ticket.id,
          actor_id: user.id,
          action: 'status_changed',
          metadata: { status },
        },
      });

      io.to(`ticket:${ticket.id}`).emit('ticket_status_changed', { ticket_id: ticket.id, status });
      emitTicketUpdate(io, ticket);
    } catch (error) {
      console.error('Ticket status update error:', error);
      socket.emit('ticket_error', { message: 'Failed to update ticket status' });
    }
  });
};