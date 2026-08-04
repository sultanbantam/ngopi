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
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
    
    if (!room_id) {
      res.status(400).json({ error: 'Room ID is required' });
      return;
    }
    if (!userId || !(await canAccessRoom(String(room_id), userId))) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Fetch one extra to determine if there are more messages
    const fetchCount = limit + 1;

    const messages = await prisma.message.findMany({
      where: {
        room_id: room_id as string,
        ...(cursor ? { timestamp: { lt: (await prisma.message.findUnique({ where: { id: cursor } }))?.timestamp ?? new Date() } } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: fetchCount,
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

    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;
    // Reverse to return in ascending chronological order
    resultMessages.reverse();

    const nextCursor = hasMore ? resultMessages[0]?.id : undefined;

    res.status(200).json({
      messages: resultMessages.map(decryptMessageRecord),
      hasMore,
      nextCursor,
    });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};