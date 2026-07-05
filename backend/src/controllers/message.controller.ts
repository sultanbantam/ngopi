import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const getMessagesByRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { room_id } = req.params;
    
    if (!room_id) {
      res.status(400).json({ error: 'Room ID is required' });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { room_id: room_id as string },
      orderBy: { timestamp: 'asc' },
    });

    res.status(200).json(messages);
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
