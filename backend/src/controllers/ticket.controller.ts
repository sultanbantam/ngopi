import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { EncryptionService } from '../services/encryption.service';

const STAFF_ROLES = ['agent_cs', 'admin', 'superadmin'];
const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

const encryptAtRest = (content: string) => EncryptionService.encryptString(content) as string;

const decryptTicketMessage = <T extends { content: string }>(message: T): T => ({
  ...message,
  content: EncryptionService.decryptStringSafe(message.content) || message.content,
});

const decryptTicketPreview = <T>(ticket: T): T => {
  const ticketWithMessages = ticket as T & { messages?: Array<{ content: string }> };
  if (!Array.isArray(ticketWithMessages.messages)) return ticket;
  return {
    ...ticketWithMessages,
    messages: ticketWithMessages.messages.map(decryptTicketMessage),
  } as T;
};

const ticketInclude = {
  platform: {
    select: {
      id: true,
      name: true,
      display_name: true,
      website_url: true,
      icon: true,
    },
  },
  user: {
    select: {
      id: true,
      username: true,
      display_name: true,
    },
  },
  assigned_agent: {
    select: {
      id: true,
      username: true,
      display_name: true,
      role: true,
    },
  },
  _count: {
    select: { messages: true },
  },
};

const getRole = async (req: AuthRequest) => {
  if (req.user?.role) return req.user.role;
  if (!req.user?.id) return null;

  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
  return user?.role || null;
};

const isStaff = (role: string | null | undefined) => Boolean(role && STAFF_ROLES.includes(role));

const writeAudit = async (ticketId: string, actorId: string, action: string, metadata?: Record<string, unknown>) => {
  const data: any = {
    ticket_id: ticketId,
    actor_id: actorId,
    action,
  };
  if (metadata) data.metadata = metadata;

  await prisma.ticketAuditLog.create({ data });
};

const findFallbackAgentId = async (platformId: string) => {
  const platform = await prisma.platform.findUnique({ where: { id: platformId }, select: { support_agent_id: true } });
  if (platform?.support_agent_id) return platform.support_agent_id;

  const agent = await prisma.user.findFirst({
    where: { role: { in: STAFF_ROLES } },
    orderBy: { created_at: 'asc' },
    select: { id: true },
  });

  return agent?.id || null;
};

export const createTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const platformId = typeof req.body?.platform_id === 'string' ? req.body.platform_id : '';
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const isEscalated = Boolean(req.body?.is_escalated);

    if (!platformId || !title || !message) {
      res.status(400).json({ error: 'platform_id, title, and message are required' });
      return;
    }

    const platform = await prisma.platform.findUnique({ where: { id: platformId } });
    if (!platform) {
      res.status(404).json({ error: 'Platform not found' });
      return;
    }

    const assignedAgentId = await findFallbackAgentId(platformId);

    const ticket = await prisma.ticket.create({
      data: {
        user_id: userId,
        platform_id: platformId,
        title: title.slice(0, 160),
        assigned_agent_id: assignedAgentId,
        is_escalated: isEscalated,
        messages: {
          create: {
            sender_id: userId,
            content: encryptAtRest(message),
          },
        },
        auditLogs: {
          create: {
            actor_id: userId,
            action: isEscalated ? 'created_from_ai' : 'created',
            metadata: { assigned_agent_id: assignedAgentId },
          },
        },
      },
      include: ticketInclude,
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Create ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listMyTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const tickets = await prisma.ticket.findMany({
      where: { user_id: userId },
      include: ticketInclude,
      orderBy: { updated_at: 'desc' },
    });

    res.json(tickets.map(decryptTicketPreview));
  } catch (error) {
    console.error('List my tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTicketMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const role = await getRole(req);
    const ticket = await prisma.ticket.findUnique({ where: { id: String(req.params.id || '') } });

    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    const canAccess = ticket.user_id === userId || ticket.assigned_agent_id === userId || isStaff(role);
    if (!canAccess) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const messages = await prisma.ticketMessage.findMany({
      where: {
        ticket_id: ticket.id,
        ...(isStaff(role) ? {} : { is_internal: false }),
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            display_name: true,
            role: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    res.json(messages.map(decryptTicketMessage));
  } catch (error) {
    console.error('Get ticket messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addUserTicketMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: String(req.params.id || '') } });
    if (!ticket || ticket.user_id !== userId) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }
    if (ticket.status === 'closed') {
      res.status(400).json({ error: 'Ticket is closed' });
      return;
    }

    const message = await prisma.ticketMessage.create({
      data: {
        ticket_id: ticket.id,
        sender_id: userId,
        content: encryptAtRest(content),
      },
      include: {
        sender: { select: { id: true, username: true, display_name: true, role: true } },
      },
    });

    await prisma.ticket.update({ where: { id: ticket.id }, data: { updated_at: new Date() } });
    await writeAudit(ticket.id, userId, 'user_replied');

    res.status(201).json(decryptTicketMessage(message));
  } catch (error) {
    console.error('Add user ticket message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const closeMyTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: String(req.params.id || '') } });
    if (!ticket || ticket.user_id !== userId) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    const updated = await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'closed' },
      include: ticketInclude,
    });
    await writeAudit(ticket.id, userId, 'closed_by_user');

    res.json(updated);
  } catch (error) {
    console.error('Close ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listAdminTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const platformId = typeof req.query.platform_id === 'string' ? req.query.platform_id : undefined;

    const where: any = {};
    if (status && TICKET_STATUSES.includes(status)) where.status = status;
    if (platformId) where.platform_id = platformId;

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        ...ticketInclude,
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: {
            sender: { select: { id: true, username: true, display_name: true, role: true } },
          },
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    res.json(tickets.map(decryptTicketPreview));
  } catch (error) {
    console.error('List admin tickets error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTicketStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const status = typeof req.body?.status === 'string' ? req.body.status : '';

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!TICKET_STATUSES.includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    const ticket = await prisma.ticket.update({
      where: { id: String(req.params.id || '') },
      data: { status: status as any },
      include: ticketInclude,
    });
    await writeAudit(ticket.id, userId, 'status_changed', { status });

    res.json(ticket);
  } catch (error) {
    console.error('Update ticket status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const assignTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const agentId = typeof req.body?.agent_id === 'string' ? req.body.agent_id : userId;

    if (!userId || !agentId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const agent = await prisma.user.findUnique({ where: { id: agentId }, select: { id: true, role: true } });
    if (!agent || !STAFF_ROLES.includes(agent.role)) {
      res.status(400).json({ error: 'Agent not found or invalid role' });
      return;
    }

    const ticket = await prisma.ticket.update({
      where: { id: String(req.params.id || '') },
      data: {
        assigned_agent_id: agent.id,
        status: 'in_progress',
      },
      include: ticketInclude,
    });
    await writeAudit(ticket.id, userId, 'assigned', { assigned_agent_id: agent.id });

    res.json(ticket);
  } catch (error) {
    console.error('Assign ticket error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const addAdminTicketMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const isInternal = Boolean(req.body?.is_internal);

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: String(req.params.id || '') } });
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    const message = await prisma.ticketMessage.create({
      data: {
        ticket_id: ticket.id,
        sender_id: userId,
        content: encryptAtRest(content),
        is_internal: isInternal,
      },
      include: {
        sender: { select: { id: true, username: true, display_name: true, role: true } },
      },
    });

    const updateData: any = { updated_at: new Date() };
    if (!ticket.assigned_agent_id) updateData.assigned_agent_id = userId;
    if (ticket.status === 'open') updateData.status = 'in_progress';
    await prisma.ticket.update({ where: { id: ticket.id }, data: updateData });
    await writeAudit(ticket.id, userId, isInternal ? 'internal_note_added' : 'agent_replied');

    res.status(201).json(decryptTicketMessage(message));
  } catch (error) {
    console.error('Add admin ticket message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const upsertAdminFaq = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const platformId = typeof req.body?.platform_id === 'string' ? req.body.platform_id : '';
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    const answer = typeof req.body?.answer === 'string' ? req.body.answer.trim() : '';
    const keywords = Array.isArray(req.body?.keywords)
      ? req.body.keywords.filter((keyword: unknown) => typeof keyword === 'string').map((keyword: string) => keyword.trim()).filter(Boolean)
      : [];

    if (!platformId || !question || !answer) {
      res.status(400).json({ error: 'platform_id, question, and answer are required' });
      return;
    }

    const faq = await prisma.faq.upsert({
      where: {
        platform_id_question: {
          platform_id: platformId,
          question,
        },
      },
      update: { answer, keywords },
      create: { platform_id: platformId, question, answer, keywords },
      include: { platform: true },
    });

    res.status(201).json(faq);
  } catch (error) {
    console.error('Upsert FAQ error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getTicketStats = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [byStatus, byPlatform, tickets] = await Promise.all([
      prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ['platform_id'], _count: { _all: true } }),
      prisma.ticket.findMany({
        select: {
          platform_id: true,
          created_at: true,
          messages: {
            where: { sender: { role: { in: STAFF_ROLES } }, is_internal: false },
            orderBy: { created_at: 'asc' },
            take: 1,
            select: { created_at: true },
          },
        },
      }),
    ]);

    const platforms = await prisma.platform.findMany({
      where: { id: { in: byPlatform.map((item) => item.platform_id) } },
      select: { id: true, name: true, display_name: true },
    });

    const responseTimes = tickets
      .map((ticket) => {
        const firstResponse = ticket.messages[0]?.created_at;
        if (!firstResponse) return null;
        return firstResponse.getTime() - ticket.created_at.getTime();
      })
      .filter((value): value is number => typeof value === 'number');

    const averageResponseMs = responseTimes.length
      ? Math.round(responseTimes.reduce((total, value) => total + value, 0) / responseTimes.length)
      : null;

    res.json({
      by_status: byStatus.map((item) => ({ status: item.status, count: item._count._all })),
      by_platform: byPlatform.map((item) => {
        const platform = platforms.find((candidate) => candidate.id === item.platform_id);
        return {
          platform_id: item.platform_id,
          platform_name: platform?.name || item.platform_id,
          display_name: platform?.display_name || item.platform_id,
          count: item._count._all,
        };
      }),
      average_response_ms: averageResponseMs,
    });
  } catch (error) {
    console.error('Ticket stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};