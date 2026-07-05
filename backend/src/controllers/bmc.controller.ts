import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { checkTokenBalance } from '../utils/blockchain';

export const getBalance = async (req: Request, res: Response): Promise<void> => {
  try {
    const walletAddress = req.params.wallet_address as string;
    if (!walletAddress) {
      res.status(400).json({ error: 'Wallet address is required' });
      return;
    }

    const balance = await checkTokenBalance(walletAddress);
    res.status(200).json({ wallet_address: walletAddress, balance });
  } catch (err) {
    console.error('Get balance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
