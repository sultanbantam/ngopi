import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const DEFAULT_TITLE = 'BaMbooChat';
const DEFAULT_DESC = 'Chat aman tanpa nomor HP/email. Bisa voice, video call, kirim gambar, dokumen, dan alihbahasa otomatis.';
const DEFAULT_IMAGE = 'https://www.bamboochat.click/assets/icon.png';
const BASE_URL = 'https://www.bamboochat.click';

router.get('/', async (req: Request, res: Response) => {
  const path = (req.query.path as string) || '/';
  
  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESC;
  let image = DEFAULT_IMAGE;

  try {
    // Profil user
    if (path.startsWith('/chat/')) {
      const parts = path.split('/');
      const targetId = parts[2]; // /chat/:id
      if (targetId) {
        // Cek apakah targetId adalah user
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { id: targetId },
              { username: targetId }
            ]
          }
        });

        if (user) {
          title = `${user.display_name || user.username} - BaMbooChat`;
          description = `Chat dengan ${user.display_name || user.username} di BaMbooChat.`;
          if (user.avatar_url) {
            image = user.avatar_url.startsWith('http') ? user.avatar_url : `https://api.bamboochat.click${user.avatar_url}`;
          }
        } else {
          // Jika tidak ada user, cek apakah itu grup (tapi grup belum tentu punya avatar pubik)
          const group = await prisma.group.findUnique({
            where: { id: targetId }
          });
          if (group) {
            title = `${group.name} - BaMbooChat`;
            description = group.description || `Gabung dengan grup ${group.name} di BaMbooChat.`;
            if (group.avatar_url) {
              image = group.avatar_url.startsWith('http') ? group.avatar_url : `https://api.bamboochat.click${group.avatar_url}`;
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error generating OG tags:', error);
  }

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="${description}">
  
  <meta property="og:type" content="website">
  <meta property="og:url" content="${BASE_URL}${path}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${BASE_URL}${path}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">
</head>
<body>
  <script>
    // Redirect bot ke halaman asli jika kebetulan termuat di browser
    window.location.replace("${BASE_URL}${path}");
  </script>
</body>
</html>`;

  res.send(html);
});

export default router;
