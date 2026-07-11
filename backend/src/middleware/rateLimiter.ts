import rateLimit from 'express-rate-limit';

const isProduction = process.env.NODE_ENV === 'production';

const createLimiter = (windowMs: number, max: number, message: string) => rateLimit({
  windowMs,
  max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: message },
  skip: (req) => !isProduction && req.ip === '::1',
});

export const apiLimiter = createLimiter(15 * 60 * 1000, 900, 'Too many API requests. Please try again later.');
export const authLimiter = createLimiter(15 * 60 * 1000, 12, 'Too many authentication attempts. Please wait and try again.');
export const messageLimiter = createLimiter(60 * 1000, 120, 'Message rate limit exceeded. Please slow down.');
export const uploadLimiter = createLimiter(10 * 60 * 1000, 40, 'Upload rate limit exceeded. Please try again later.');
export const aiLimiter = createLimiter(60 * 1000, 30, 'AI request rate limit exceeded. Please try again later.');