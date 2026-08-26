import { Request, Response } from 'express';
import axios from 'axios';

const PI_API_URL = 'https://api.minepi.com/v2';

export const approvePayment = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;
    
    if (!paymentId) {
      return res.status(400).json({ error: 'paymentId is required' });
    }

    const apiKey = process.env.PI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server API Key is not configured' });
    }

    const response = await axios.post(
      `${PI_API_URL}/payments/${paymentId}/approve`,
      {},
      {
        headers: {
          Authorization: `Key ${apiKey}`,
        },
      }
    );

    res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Approve Payment Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Failed to approve payment' });
  }
};

export const completePayment = async (req: Request, res: Response) => {
  try {
    const { paymentId, txid } = req.body;

    if (!paymentId || !txid) {
      return res.status(400).json({ error: 'paymentId and txid are required' });
    }

    const apiKey = process.env.PI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server API Key is not configured' });
    }

    const response = await axios.post(
      `${PI_API_URL}/payments/${paymentId}/complete`,
      { txid },
      {
        headers: {
          Authorization: `Key ${apiKey}`,
        },
      }
    );

    res.status(200).json(response.data);
  } catch (error: any) {
    console.error('Complete Payment Error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Failed to complete payment' });
  }
};
