import { Request, Response } from 'express';
import axios from 'axios';
import { pointsEconomyService } from '../services/points.service';
import { PointsManager } from '../utils/pointsManager';
import { telecomService } from '../services/telecom.service';
import { prisma } from '../utils/prisma';

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
      console.error('[PiPayment] Approve failed: PI_API_KEY is missing from backend .env');
      return res.status(500).json({ error: 'PI_API_KEY belum dikonfigurasi di server (/opt/ngopi/backend/.env).' });
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
      error: error.response?.data?.error_message || error.response?.data?.error || 'Failed to approve payment',
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
      console.error('[PiPayment] Complete failed: PI_API_KEY is missing from backend .env');
      return res.status(500).json({ error: 'PI_API_KEY belum dikonfigurasi di server (/opt/ngopi/backend/.env).' });
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
    const paymentType = String(metadata.type || 'ngopi_points_topup');
    const pointsAmount = Math.floor(Number(metadata.points_amount || 0));

    let newBalance: number | undefined;
    let activatedIdentity: { number?: string; email?: string } | undefined;

    if (targetUserId && !creditedPaymentIds.has(String(paymentId))) {
      creditedPaymentIds.add(String(paymentId));

      // 1. Points Top-up
      if (pointsAmount > 0) {
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

      // 2. Custom Identity Activation (Nomor Cantik / Email @ngopi.top / Bundling)
      if (
        paymentType === 'ngopi_identity_number' ||
        paymentType === 'ngopi_identity_email' ||
        paymentType === 'ngopi_identity_bundle'
      ) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, username: true, role: true, bmc_id: true },
          });
          if (dbUser) {
            const actRes = await telecomService.activatePaidIdentityViaPi(dbUser, {
              desiredNumber: metadata.desired_number ? String(metadata.desired_number) : undefined,
              desiredEmail: metadata.desired_email ? String(metadata.desired_email) : undefined,
            });
            if (actRes.success) {
              activatedIdentity = { number: actRes.number, email: actRes.email };
            } else {
              console.warn('[PiPayment] Identity activation warning:', actRes.error);
            }
          }
        } catch (idErr) {
          console.warn('[PiPayment] Failed activating Ngopi identity:', idErr);
        }
      }
    }

    return res.status(200).json({
      ...payment,
      points_credited: newBalance !== undefined ? pointsAmount : 0,
      new_balance: newBalance,
      activated_identity: activatedIdentity,
    });
  } catch (error: any) {
    console.error('Complete Payment Error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json({
      error: error.response?.data?.error_message || error.response?.data?.error || 'Failed to complete payment',
    });
  }
};
