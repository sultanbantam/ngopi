import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { getBmcBalance } from '../utils/blockchain';

export const createGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, minBmcBalance } = req.body;
    const userId = (req as any).user?.id as string; // from auth middleware

    if (!name) {
      res.status(400).json({ error: 'Group name is required' });
      return;
    }

    const group = await prisma.group.create({
      data: {
        name,
        min_bmc_balance: parseFloat(minBmcBalance) || 0,
        created_by: userId!,
        members: {
          create: {
            user_id: userId!
          }
        }
      }
    });

    res.status(201).json(group);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const listGroups = async (req: Request, res: Response): Promise<void> => {
  try {
    const groups = await prisma.group.findMany({
      include: {
        _count: {
          select: { members: true }
        }
      }
    });
    res.json(groups);
  } catch (error) {
    console.error('List groups error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const joinGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).user?.id as string;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const group = await prisma.group.findUnique({
      where: { id }
    });

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // Check if already member
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        group_id_user_id: {
          group_id: id,
          user_id: userId
        }
      }
    });

    if (existingMember) {
      res.status(400).json({ error: 'Already a member of this group' });
      return;
    }

    // TOKEN GATING LOGIC
    if (group.min_bmc_balance > 0) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user?.wallet_address) {
        res.status(403).json({ 
          error: 'Wallet address is required to join this token-gated group. Please update your profile.' 
        });
        return;
      }

      const balance = await getBmcBalance(user.wallet_address);
      if (balance < group.min_bmc_balance) {
        res.status(403).json({ 
          error: `Insufficient BMC balance. You need at least ${group.min_bmc_balance} BMC to join this group. Current balance: ${balance} BMC` 
        });
        return;
      }
    }

    // Join group
    await prisma.groupMember.create({
      data: {
        group_id: id,
        user_id: userId
      }
    });

    res.status(200).json({ message: 'Successfully joined group' });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
