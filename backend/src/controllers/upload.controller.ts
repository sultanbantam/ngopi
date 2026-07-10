import { Request, Response } from 'express';

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

  const uploadedType = req.file.mimetype.startsWith('image/')
    ? 'image'
    : req.file.mimetype.startsWith('audio/')
      ? 'audio'
      : 'document';

  res.status(200).json({
    message: 'File uploaded successfully',
    url: fileUrl,
    type: uploadedType,
  });
};
