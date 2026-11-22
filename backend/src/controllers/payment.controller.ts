import { Request, Response } from 'express';
import axios from 'axios';
import { pointsEconomyService } from '../services/points.service';
import { PointsManager } from '../utils/pointsManager';

const PI_API_URL = 'https://api.minepi.com/v2';
const creditedPaymentIds = new Set<string>();

export const approvePayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;

    if (!paymentId) {
      return res.status(400).json({ error: 'paymentId is required' });
    }

    const apiKey = process.env.PI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'PI_API_KEY is not configured on server' });
    }

    const response = await axios.post(
      `${PI_API_URL}/payments/${paymentId}/approve`,
      {},
      {
        headers: {
          Authorization: `Key ${apiKey}`,
        },
        timeout: 15000,
      }
    );

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Approve Payment Error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.error_message || 'Failed to approve payment',
    });
  }
};

export const completePayment = async (req: Request, res: Response) => {
  try {
    const { paymentId, txid, userId: bodyUserId, username: bodyUsername } = req.body;

    if (!paymentId || !txid) {
      return res.status(400).json({ error: 'paymentId and txid are required' });
    }

    const apiKey = process.env.PI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'PI_API_KEY is not configured on server' });
    }

    const response = await axios.post(
      `${PI_API_URL}/payments/${paymentId}/complete`,
      { txid },
      {
        headers: {
          Authorization: `Key ${apiKey}`,
        },
        timeout: 15000,
      }
    );

    const payment = response.data || {};
    const metadata = payment.metadata || {};
    const targetUserId = String(metadata.userId || bodyUserId || '').trim();
    const targetUsername = String(metadata.username || bodyUsername || '').trim();
    const pointsAmount = Math.floor(Number(metadata.points_amount || 0));

    let newBalance: number | undefined;
    if (
      targetUserId &&
      pointsAmount > 0 &&
      !creditedPaymentIds.has(String(paymentId))
    ) {
      creditedPaymentIds.add(String(paymentId));
      try {
        pointsEconomyService.syncWithPointsManager(targetUserId, targetUsername || undefined);
        newBalance = pointsEconomyService.addDirectPoints(
          targetUserId,
          pointsAmount,
          'daily_mission',
          `Top-up Poin via Pi Network (${payment.amount || '?'} Pi)`,
          `PI-${paymentId}`
        );
        PointsManager.setPoints(targetUserId, newBalance, true, true);
        if (targetUsername) {
          PointsManager.setPoints(targetUsername, newBalance, true, true);
        }
      } catch (ptsErr) {
        console.warn('[PiPayment] Failed crediting Ngopi Points:', ptsErr);
      }
    }

    return res.status(200).json({
      ...payment,
      points_credited: newBalance !== undefined ? pointsAmount : 0,
      new_balance: newBalance,
    });
  } catch (error: any) {
    console.error('Complete Payment Error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.error_message || 'Failed to complete payment',
    });
  }
};
