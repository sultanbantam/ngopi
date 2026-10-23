import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { uploadFile } from '../controllers/upload.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { uploadLimiter } from '../middleware/rateLimiter';

const router = Router();

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/heic',
  'image/heif',
  'image/svg+xml',
  'image/x-icon',

  // Documents & Text
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/html',
  'text/markdown',
  'application/rtf',
  'application/json',
  'application/xml',

  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/webm',
  'audio/wav',
  'audio/ogg',
  'audio/aac',
  'audio/flac',

  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',

  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/octet-stream',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.heif', '.svg', '.ico',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf', '.json', '.md', '.xml',
  '.mp3', '.m4a', '.webm', '.wav', '.ogg', '.aac', '.flac',
  '.mp4', '.mov', '.avi', '.mkv',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bin',
]);

const DANGEROUS_EXTENSIONS = new Set([
  '.php', '.phtml', '.php3', '.php4', '.php5', '.php7', '.php8', '.phar', '.inc',
  '.sh', '.bash', '.exe', '.bat', '.cmd', '.com', '.vbs', '.ps1',
  '.py', '.pl', '.cgi', '.jsp', '.asp', '.aspx', '.shtml', '.htaccess',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeExt = path.extname(file.originalname).replace(/[^.A-Za-z0-9]/g, '').slice(0, 12);
    cb(null, `${file.fieldname}-${uniqueSuffix}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_BYTES || 25 * 1024 * 1024),
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (DANGEROUS_EXTENSIONS.has(ext)) {
      return cb(new Error(`File berekstensi '${ext}' dilarang demi keamanan!`));
    }
    if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipe file tidak didukung (${file.mimetype || 'unknown'})`));
    }
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

export default router;