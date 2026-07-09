import { Request, Response } from 'express';
import { answerQuestion } from '../services/ai.service';

export const queryAi = async (req: Request, res: Response): Promise<void> => {
  try {
    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    const platformId = typeof req.body?.platform_id === 'string' ? req.body.platform_id : null;

    if (!question) {
      res.status(400).json({ error: 'Question is required' });
      return;
    }

    const result = await answerQuestion(question, platformId);
    res.json(result);
  } catch (error) {
    console.error('AI query error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};