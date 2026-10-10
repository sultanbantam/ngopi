import { Router, Response } from 'express';
import { verifyJWT, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/prisma';

const router = Router();

// POST /api/keys/renegotiate
// Trigger or synchronize E2EE public keys for chat partners
router.post('/renegotiate', verifyJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user?.id;
    if (!currentUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { targetUserId, public_key } = req.body;

    let updatedUser;
    if (public_key && typeof public_key === 'string' && public_key.trim().length > 10) {
      updatedUser = await prisma.user.update({
        where: { id: currentUserId },
        data: { public_key: public_key.trim() },
        select: { id: true, username: true, public_key: true },
      });
    } else {
      updatedUser = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { id: true, username: true, public_key: true },
      });
    }

    let targetUser = null;
    if (targetUserId && typeof targetUserId === 'string') {
      targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, username: true, public_key: true },
      });
    }

    res.status(200).json({
      success: true,
      user: updatedUser,
      targetUser,
      message: 'Kunci enkripsi berhasil disinkronkan',
    });
  } catch (error: any) {
    console.error('Keys renegotiate error:', error);
    res.status(500).json({ error: 'Gagal memperbarui kunci enkripsi' });
  }
});

// GET /api/keys/:userId
router.get('/:userId', verifyJWT, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: userId as string },
      select: { id: true, username: true, display_name: true, public_key: true },
    });
    if (!user) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan' });
      return;
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Gagal mengambil kunci publik' });
  }
});

export default router;
