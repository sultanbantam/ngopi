import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { verifyJWT, AuthRequest } from '../middleware/auth.middleware';
import { requireDbUser } from '../middleware/rbac.middleware';
import { pointsEconomyService } from '../services/points.service';
import { PointsManager } from '../utils/pointsManager';

const router = Router();

// GET /api/library/works - List published works (+ own drafts if authenticated query)
router.get('/works', async (req: Request, res: Response) => {
  try {
    const category = req.query.category ? String(req.query.category).trim().toLowerCase() : '';
    const q = req.query.q ? String(req.query.q).trim() : '';
    const authorId = req.query.authorId ? String(req.query.authorId).trim() : '';

    const where: any = {};
    if (authorId) {
      where.author_id = authorId;
    } else {
      where.status = 'published';
    }
    if (category && category !== 'all') {
      where.category = category;
    }
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { synopsis: { contains: q, mode: 'insensitive' } },
        { author_name: { contains: q, mode: 'insensitive' } },
      ];
    }

    const works = await prisma.libraryWork.findMany({
      where,
      orderBy: [{ updated_at: 'desc' }],
      take: 60,
      include: {
        _count: { select: { chapters: true, tips: true } },
      },
    });

    res.json({ success: true, works });
  } catch (err: any) {
    console.error('[LibraryRoutes] GET /works error:', err);
    res.status(500).json({ success: false, error: err?.message || 'Gagal memuat daftar perpustakaan.' });
  }
});

// GET /api/library/works/:id - Detail karya + daftar bab
router.get('/works/:id', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '');
    const work = await prisma.libraryWork.findUnique({
      where: { id },
      include: {
        chapters: { orderBy: { chapter_number: 'asc' } },
        _count: { select: { tips: true } },
      },
    });
    if (!work) {
      return res.status(404).json({ success: false, error: 'Karya tidak ditemukan.' });
    }

    await prisma.libraryWork.update({
      where: { id },
      data: { views_count: { increment: 1 } },
    });

    return res.json({ success: true, work: { ...work, views_count: work.views_count + 1 } });
  } catch (err: any) {
    console.error('[LibraryRoutes] GET /works/:id error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Gagal memuat detail karya.' });
  }
});

// POST /api/library/works - Terbitkan karya baru (buku, novel, esai, puisi, artikel)
router.post('/works', verifyJWT, requireDbUser, async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthRequest).user;
    if (!authUser?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, username: true, display_name: true },
    });
    if (!dbUser) return res.status(401).json({ success: false, error: 'Akun tidak ditemukan.' });

    const title = String(req.body?.title || '').trim();
    const synopsis = String(req.body?.synopsis || '').trim();
    const category = String(req.body?.category || 'fiksi').trim().toLowerCase();
    const coverEmoji = String(req.body?.cover_emoji || '📚').trim().slice(0, 8) || '📚';
    const firstChapterTitle = String(req.body?.first_chapter_title || 'Bab 1').trim();
    const firstChapterContent = String(req.body?.first_chapter_content || '').trim();

    if (!title || title.length < 3) {
      return res.status(400).json({ success: false, error: 'Judul karya minimal 3 karakter.' });
    }
    if (!synopsis || synopsis.length < 10) {
      return res.status(400).json({ success: false, error: 'Sinopsis atau deskripsi karya minimal 10 karakter.' });
    }

    const allowedCategories = ['fiksi', 'esai', 'puisi', 'edukasi', 'komunitas'];
    const safeCategory = allowedCategories.includes(category) ? category : 'fiksi';

    const work = await prisma.libraryWork.create({
      data: {
        author_id: dbUser.id,
        author_username: dbUser.username,
        author_name: dbUser.display_name || dbUser.username,
        title: title.slice(0, 150),
        synopsis: synopsis.slice(0, 1200),
        category: safeCategory,
        cover_emoji: coverEmoji,
        status: 'published',
        chapters: firstChapterContent
          ? {
              create: {
                chapter_number: 1,
                title: firstChapterTitle.slice(0, 150),
                content: firstChapterContent,
                word_count: firstChapterContent.split(/\s+/).filter(Boolean).length,
              },
            }
          : undefined,
      },
      include: { chapters: true },
    });

    // Author writing reward (+25 Ngopi Points)
    try {
      pointsEconomyService.syncWithPointsManager(dbUser.id, dbUser.username);
      const newBal = pointsEconomyService.addDirectPoints(
        dbUser.id,
        25,
        'daily_mission',
        `Menerbitkan karya di Ngopi Pustaka: ${work.title}`
      );
      PointsManager.setPoints(dbUser.id, newBal, true, true);
      PointsManager.setPoints(dbUser.username, newBal, true, true);
    } catch (_) {}

    return res.status(201).json({ success: true, work, message: 'Karya berhasil diterbitkan di Perpustakaan Ngopi! (+25 Poin)' });
  } catch (err: any) {
    console.error('[LibraryRoutes] POST /works error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Gagal menerbitkan karya.' });
  }
});

// POST /api/library/works/:id/chapters - Tambah bab baru pada karya milik sendiri
router.post('/works/:id/chapters', verifyJWT, requireDbUser, async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthRequest).user;
    if (!authUser?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const workId = String(req.params.id || '');
    const work = await prisma.libraryWork.findUnique({
      where: { id: workId },
      include: { chapters: { orderBy: { chapter_number: 'desc' }, take: 1 } },
    });
    if (!work) return res.status(404).json({ success: false, error: 'Karya tidak ditemukan.' });
    if (work.author_id !== authUser.id) {
      return res.status(403).json({ success: false, error: 'Hanya penulis asli yang dapat menambah bab.' });
    }

    const title = String(req.body?.title || '').trim();
    const content = String(req.body?.content || '').trim();
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Judul bab dan isi tulisan wajib diisi.' });
    }

    const nextNumber = (work.chapters[0]?.chapter_number || 0) + 1;
    const chapter = await prisma.libraryChapter.create({
      data: {
        work_id: workId,
        chapter_number: nextNumber,
        title: title.slice(0, 150),
        content,
        word_count: content.split(/\s+/).filter(Boolean).length,
      },
    });

    await prisma.libraryWork.update({
      where: { id: workId },
      data: { updated_at: new Date() },
    });

    return res.status(201).json({ success: true, chapter, message: `Bab ${nextNumber} berhasil ditambahkan!` });
  } catch (err: any) {
    console.error('[LibraryRoutes] POST /works/:id/chapters error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Gagal menambah bab.' });
  }
});

// POST /api/library/works/:id/tip - Apresiasi Poin Ngopi untuk Penulis
router.post('/works/:id/tip', verifyJWT, requireDbUser, async (req: Request, res: Response) => {
  try {
    const authUser = (req as AuthRequest).user;
    if (!authUser?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const workId = String(req.params.id || '');
    const amount = Math.floor(Number(req.body?.amount || 0));
    const message = String(req.body?.message || '').trim().slice(0, 160);

    if (!Number.isFinite(amount) || amount < 10 || amount > 50000) {
      return res.status(400).json({ success: false, error: 'Tip apresiasi minimal 10 Poin dan maksimal 50.000 Poin.' });
    }

    const work = await prisma.libraryWork.findUnique({ where: { id: workId } });
    if (!work) return res.status(404).json({ success: false, error: 'Karya tidak ditemukan.' });
    if (work.author_id === authUser.id) {
      return res.status(400).json({ success: false, error: 'Tidak dapat memberi tip ke karya sendiri.' });
    }

    pointsEconomyService.syncWithPointsManager(authUser.id, authUser.username);
    const readerPoints = pointsEconomyService.getOrCreateUserPoints(authUser.id);
    if (readerPoints.balance < amount) {
      return res.status(400).json({ error: `Saldo Poin tidak mencukupi (${readerPoints.balance} Poin).` });
    }

    const ref = `TIP-${Date.now().toString(36).toUpperCase()}`;
    const readerBal = pointsEconomyService.addDirectPoints(
      authUser.id,
      -amount,
      'purchase_badge' as any,
      `Apresiasi Penulis @${work.author_username} untuk "${work.title}"`,
      ref
    );
    PointsManager.setPoints(authUser.id, readerBal, true, true);
    PointsManager.setPoints(authUser.username, readerBal, true, true);

    pointsEconomyService.syncWithPointsManager(work.author_id, work.author_username);
    const authorBal = pointsEconomyService.addDirectPoints(
      work.author_id,
      amount,
      'daily_mission',
      `Tip Pembaca untuk karya "${work.title}"`,
      ref
    );
    PointsManager.setPoints(work.author_id, authorBal, true, true);
    PointsManager.setPoints(work.author_username, authorBal, true, true);

    await prisma.$transaction([
      prisma.libraryTip.create({
        data: {
          work_id: workId,
          from_user_id: authUser.id,
          to_user_id: work.author_id,
          amount,
          message: message || null,
        },
      }),
      prisma.libraryWork.update({
        where: { id: workId },
        data: { total_tip_points: { increment: amount } },
      }),
    ]);

    return res.json({
      success: true,
      reader_balance: readerBal,
      total_tip_points: work.total_tip_points + amount,
      message: `Terima kasih! ${amount} Poin berhasil dikirim ke penulis @${work.author_username}.`,
    });
  } catch (err: any) {
    console.error('[LibraryRoutes] POST /works/:id/tip error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Gagal mengirim tip.' });
  }
});

export default router;
