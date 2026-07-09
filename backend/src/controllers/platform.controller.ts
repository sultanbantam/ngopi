import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const getPlatforms = async (_req: Request, res: Response): Promise<void> => {
  try {
    const platforms = await prisma.platform.findMany({
      orderBy: { display_name: 'asc' },
      select: {
        id: true,
        name: true,
        display_name: true,
        description: true,
        website_url: true,
        icon: true,
        created_at: true,
      },
    });

    res.json(platforms);
  } catch (error) {
    console.error('Get platforms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getFaqs = async (req: Request, res: Response): Promise<void> => {
  try {
    const platformId = typeof req.query.platform_id === 'string' ? req.query.platform_id : undefined;
    const platformName = typeof req.query.platform === 'string' ? req.query.platform : undefined;

    const platform = platformName
      ? await prisma.platform.findUnique({ where: { name: platformName } })
      : null;

    const query: any = {
      include: {
        platform: {
          select: {
            id: true,
            name: true,
            display_name: true,
            website_url: true,
          },
        },
      },
      orderBy: [{ platform_id: 'asc' }, { created_at: 'asc' }],
    };
    const selectedPlatformId = platformId || platform?.id;
    if (selectedPlatformId) query.where = { platform_id: selectedPlatformId };

    const faqs = await prisma.faq.findMany(query);

    res.json(faqs);
  } catch (error) {
    console.error('Get FAQs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};