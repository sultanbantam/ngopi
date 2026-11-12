import rateLimit from 'express-rate-limit';

const getClientIp = (req: any): string => {
  const cf = req.headers?.['cf-connecting-ip'];
  if (typeof cf === 'string' && cf.trim()) return cf.trim();
  const realIp = req.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  const xff = req.headers?.['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0]?.trim() || req.ip || '127.0.0.1';
  return req.ip || '127.0.0.1';
};

const createLimiter = (windowMs: number, max: number, message: string) => rateLimit({
  windowMs,
  max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: false,
  keyGenerator: getClientIp,
  message: { error: message },
});

export const apiLimiter = createLimiter(15 * 60 * 1000, 50000, 'Too many API requests. Please try again later.');
export const authLimiter = createLimiter(5 * 60 * 1000, 500, 'Too many authentication attempts. Please wait and try again.');
export const messageLimiter = createLimiter(60 * 1000, 1000, 'Message rate limit exceeded. Please slow down.');
export const uploadLimiter = createLimiter(10 * 60 * 1000, 500, 'Upload rate limit exceeded. Please try again later.');
export const aiLimiter = createLimiter(60 * 1000, 200, 'AI request rate limit exceeded. Please try again later.');