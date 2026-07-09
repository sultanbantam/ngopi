import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

const DAILY_AIRDROP_AMOUNT = 0.1; // BMC per claim

export const claimAirdrop = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check if user has a wallet address
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.wallet_address) {
      res.status(400).json({ error: 'Wallet address required. Please update your profile first.' });
      return;
    }

    // Check if already claimed today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const existingClaim = await prisma.airdropClaim.findFirst({
      where: {
        user_id: userId,
        claimed_at: {
          gte: today,
          lt: tomorrow
        }
      }
    });

    if (existingClaim) {
      res.status(429).json({ 
        error: 'Already claimed today. Come back tomorrow!',
        next_claim: tomorrow.toISOString()
      });
      return;
    }

    // Create claim record
    const claim = await prisma.airdropClaim.create({
      data: {
        user_id: userId,
        amount: DAILY_AIRDROP_AMOUNT,
      }
    });

    // Get total claimed
    const totalClaims = await prisma.airdropClaim.aggregate({
      where: { user_id: userId },
      _sum: { amount: true },
      _count: true
    });

    res.status(200).json({
      message: `Successfully claimed ${DAILY_AIRDROP_AMOUNT} BMC!`,
      claim,
      total_claimed: totalClaims._sum.amount || 0,
      total_claims: totalClaims._count,
      wallet_address: user.wallet_address
    });
  } catch (error) {
    console.error('Claim airdrop error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAirdropHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const claims = await prisma.airdropClaim.findMany({
      where: { user_id: userId },
      orderBy: { claimed_at: 'desc' },
      take: 30
    });

    const total = await prisma.airdropClaim.aggregate({
      where: { user_id: userId },
      _sum: { amount: true },
      _count: true
    });

    // Check if can claim today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const claimedToday = await prisma.airdropClaim.findFirst({
      where: {
        user_id: userId,
        claimed_at: { gte: today, lt: tomorrow }
      }
    });

    res.status(200).json({
      claims,
      total_claimed: total._sum.amount || 0,
      total_claims: total._count,
      can_claim_today: !claimedToday,
      daily_amount: DAILY_AIRDROP_AMOUNT
    });
  } catch (error) {
    console.error('Get airdrop history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
