import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let settings = await prisma.userSettings.findUnique({
      where: { user_id: userId }
    });

    // Create default settings if not exists
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { user_id: userId }
      });
    }

    res.status(200).json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { hide_name, hide_contacts, hide_groups, preferred_language } = req.body;

    const updateData: any = {};
    if (hide_name !== undefined) updateData.hide_name = hide_name;
    if (hide_contacts !== undefined) updateData.hide_contacts = hide_contacts;
    if (hide_groups !== undefined) updateData.hide_groups = hide_groups;
    if (preferred_language !== undefined) updateData.preferred_language = preferred_language;

    const settings = await prisma.userSettings.upsert({
      where: { user_id: userId },
      update: updateData,
      create: {
        user_id: userId,
        ...updateData
      }
    });

    res.status(200).json({ message: 'Settings updated', settings });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
