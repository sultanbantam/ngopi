import { Request, Response } from 'express';
import path from 'path';

export const uploadFile = (req: Request, res: Response): void => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  // Construct a public HTTPS URL for files served from /uploads.
  const host = req.get('host');
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = host === 'api.bamboochat.click' ? 'https' : forwardedProto || req.protocol;
  const publicBaseUrl = process.env.PUBLIC_API_URL || `${protocol}://${host}`;
  const fileUrl = `${publicBaseUrl.replace(/\/$/, '')}/uploads/${req.file.filename}`;

  const ext = path.extname(req.file.originalname || '').toLowerCase();
  const isImage = req.file.mimetype.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.heif', '.svg'].includes(ext);
  const isAudio = req.file.mimetype.startsWith('audio/') || ['.mp3', '.m4a', '.webm', '.wav', '.ogg', '.aac', '.flac'].includes(ext);
  const uploadedType = isImage ? 'image' : isAudio ? 'audio' : 'document';

  res.status(200).json({
    message: 'File uploaded successfully',
    url: fileUrl,
    type: uploadedType,
  });
};
