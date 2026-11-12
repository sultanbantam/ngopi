import { Request, Response } from 'express';
import path from 'path';
import { compressImage } from '../utils/imageCompressor';

export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const ext = path.extname(req.file.originalname || '').toLowerCase();
  const isImage = req.file.mimetype.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.heif', '.svg'].includes(ext);
  const isVideo = req.file.mimetype.startsWith('video/') || ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
  const isAudio = req.file.mimetype.startsWith('audio/') || ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.flac'].includes(ext);
  const uploadedType = isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'document';

  // Compress images server-side for faster delivery
  let finalFilename = req.file.filename;
  if (isImage) {
    try {
      const result = await compressImage(req.file.path, req.file.originalname);
      if (result) {
        finalFilename = result.newFilename;
      }
    } catch (err) {
      console.error('Image compression error (using original):', err);
    }
  }

  // Construct a public HTTPS URL for files served from /uploads.
  const host = req.get('host');
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = host === 'api.bamboochat.click' || host === 'api.ngopi.top' ? 'https' : forwardedProto || req.protocol;
  const publicBaseUrl = process.env.PUBLIC_API_URL || `${protocol}://${host}`;
  const fileUrl = `${publicBaseUrl.replace(/\/$/, '')}/uploads/${finalFilename}`;

  res.status(200).json({
    message: 'File uploaded successfully',
    url: fileUrl,
    type: uploadedType,
    name: req.file.originalname,
    size: req.file.size,
    mime_type: req.file.mimetype,
  });
};

