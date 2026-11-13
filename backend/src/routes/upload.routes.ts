import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadFile, downloadPrivateFile } from '../controllers/upload.controller';
import { verifyJWT, AuthRequest } from '../middleware/auth.middleware';
import { uploadLimiter } from '../middleware/rateLimiter';
import {
  generateSafeFilename,
  resolveSafeChildPath,
  validateExtensionAndMime,
} from '../utils/fileSecurity';

const router = Router();

const PUBLIC_UPLOADS_DIR = path.join(__dirname, '../../uploads');
const PRIVATE_UPLOADS_DIR = path.join(__dirname, '../../private_uploads');

const getUploadScope = (req: Request): 'private' | 'public' => {
  const scope = String(req.query?.scope || req.headers['x-upload-scope'] || '').toLowerCase().trim();
  return scope === 'private' ? 'private' : 'public';
};

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const scope = getUploadScope(req);
    if (scope === 'private') {
      const userId = (req as AuthRequest).user?.id || '';
      const userDir = resolveSafeChildPath(PRIVATE_UPLOADS_DIR, userId);
      if (!userDir) {
        return cb(new Error('Unauthorized private upload scope.'), '');
      }
      fs.mkdirSync(userDir, { recursive: true });
      return cb(null, userDir);
    }
    fs.mkdirSync(PUBLIC_UPLOADS_DIR, { recursive: true });
    cb(null, PUBLIC_UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, generateSafeFilename(ext));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_BYTES || 25 * 1024 * 1024),
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const check = validateExtensionAndMime(file.originalname || '', file.mimetype || '');
    if (!check.valid) {
      return cb(new Error(check.reason || 'Tipe file tidak diizinkan.'));
    }
    cb(null, true);
  },
});

const handleUploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
};

router.post('/', verifyJWT, uploadLimiter, handleUploadMiddleware, uploadFile);
router.get('/private/:ownerId/:filename', verifyJWT, downloadPrivateFile);

export default router;
