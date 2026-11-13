import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { compressImage } from '../utils/imageCompressor';
import { AuthRequest } from '../middleware/auth.middleware';
import { hasRole } from '../middleware/rbac.middleware';
import {
  resolveSafeChildPath,
  verifyUploadedFileSignature,
} from '../utils/fileSecurity';

const PRIVATE_UPLOADS_DIR = path.join(__dirname, '../../private_uploads');

export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const ext = path.extname(req.file.originalname || '').toLowerCase();
  const sigCheck = verifyUploadedFileSignature(req.file.path, ext);
  if (!sigCheck.valid) {
    try {
      fs.unlinkSync(req.file.path);
    } catch {}
    res.status(400).json({ error: sigCheck.reason || 'Signature file tidak valid.' });
    return;
  }

  const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.heif'].includes(ext);
  const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
  const isAudio = ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.flac'].includes(ext);
  const uploadedType = isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'document';

  const scope = String(req.query?.scope || req.headers['x-upload-scope'] || '').toLowerCase().trim();
  const isPrivate = scope === 'private';

  // Compress public images server-side for faster delivery (keep private files intact)
  let finalFilename = req.file.filename;
  if (isImage && !isPrivate) {
    try {
      const result = await compressImage(req.file.path, req.file.originalname);
      if (result) {
        finalFilename = result.newFilename;
      }
    } catch (err) {
      console.error('Image compression error (using original):', err);
    }
  }

  const host = req.get('host');
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = host === 'api.bamboochat.click' || host === 'api.ngopi.top' ? 'https' : forwardedProto || req.protocol;
  const publicBaseUrl = process.env.PUBLIC_API_URL || `${protocol}://${host}`;

  if (isPrivate) {
    const authUser = (req as AuthRequest).user;
    if (!authUser?.id) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {}
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const metaPath = `${req.file.path}.meta.json`;
    fs.writeFileSync(
      metaPath,
      JSON.stringify({
        ownerId: authUser.id,
        originalName: path.basename(req.file.originalname || finalFilename),
        mimeType: req.file.mimetype,
        size: req.file.size,
        createdAt: new Date().toISOString(),
      }),
      'utf8'
    );

    const privateUrl = `${publicBaseUrl.replace(/\/$/, '')}/api/upload/private/${encodeURIComponent(authUser.id)}/${encodeURIComponent(finalFilename)}`;
    res.status(200).json({
      message: 'Private file uploaded successfully',
      url: privateUrl,
      scope: 'private',
      type: uploadedType,
      name: path.basename(req.file.originalname),
      size: req.file.size,
      mime_type: req.file.mimetype,
    });
    return;
  }

  const fileUrl = `${publicBaseUrl.replace(/\/$/, '')}/uploads/${finalFilename}`;
  res.status(200).json({
    message: 'File uploaded successfully',
    url: fileUrl,
    scope: 'public',
    type: uploadedType,
    name: path.basename(req.file.originalname),
    size: req.file.size,
    mime_type: req.file.mimetype,
  });
};

export const downloadPrivateFile = async (req: Request, res: Response): Promise<void> => {
  const authUser = (req as AuthRequest).user;
  if (!authUser?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const ownerId = String(req.params.ownerId || '');
  const filename = String(req.params.filename || '');

  const ownerDir = resolveSafeChildPath(PRIVATE_UPLOADS_DIR, ownerId);
  if (!ownerDir) {
    res.status(400).json({ error: 'Invalid path parameter' });
    return;
  }

  const targetFile = resolveSafeChildPath(ownerDir, filename);
  if (!targetFile || filename.endsWith('.meta.json')) {
    res.status(400).json({ error: 'Invalid filename' });
    return;
  }

  if (ownerId !== authUser.id && !hasRole(authUser.role, ['admin', 'superadmin'])) {
    res.status(403).json({ error: 'Forbidden: tidak memiliki izin mengakses berkas ini.' });
    return;
  }

  if (!fs.existsSync(targetFile)) {
    res.status(404).json({ error: 'File tidak ditemukan.' });
    return;
  }

  let downloadName = path.basename(targetFile);
  let mimeType = 'application/octet-stream';
  const metaPath = `${targetFile}.meta.json`;
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (meta.ownerId && meta.ownerId !== authUser.id && !hasRole(authUser.role, ['admin', 'superadmin'])) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      if (meta.originalName) downloadName = path.basename(String(meta.originalName));
      if (meta.mimeType) mimeType = String(meta.mimeType);
    } catch {}
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${downloadName.replace(/"/g, '')}"`);
  res.sendFile(targetFile);
};
