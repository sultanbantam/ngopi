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