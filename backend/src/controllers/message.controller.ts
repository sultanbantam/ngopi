import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { EncryptionService } from '../services/encryption.service';

const decryptMessageRecord = <T extends { content: string | null }>(message: T): T => ({
  ...message,
  content: EncryptionService.decryptStringSafe(message.content) ?? message.content,
});

const canAccessRoom = async (roomId: string, userId: string) => {
  const group = await prisma.group.findUnique({
    where: { id: roomId },
    include: { members: { where: { user_id: userId }, take: 1 } },
  });

  if (group) return group.members[0]?.status === 'active';
  return roomId.includes(userId);
};

export const getMessagesByRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { room_id } = req.params;
    const userId = (req as any).user?.id as string | undefined;
    
    if (!room_id) {
      res.status(400).json({ error: 'Room ID is required' });
      return;
    }
    if (!userId || !(await canAccessRoom(String(room_id), userId))) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { room_id: room_id as string },
      orderBy: { timestamp: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            display_name: true,
            avatar_url: true,
          }
        }
      },
    });

    res.status(200).json(messages.map(decryptMessageRecord));
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUnreadCounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userGroups = await prisma.groupMember.findMany({
      where: { user_id: userId, status: 'active' },
      select: { group_id: true }
    });
    const groupIds = userGroups.map(g => g.group_id);

    const unreadMessages = await prisma.message.groupBy({
      by: ['room_id'],
      where: {
        is_read: false,
        sender_id: { not: userId },
        OR: [
          { room_id: { contains: userId } }, // 1-on-1 chats
          { room_id: { in: groupIds } } // group chats
        ]
      },
      _count: {
        id: true
      }
    });

    const unreadCounts: Record<string, number> = {};
    for (const group of unreadMessages) {
      unreadCounts[group.room_id] = group._count.id;
    }

    res.status(200).json(unreadCounts);
  } catch (err) {
    console.error('Get unread counts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};