import { Router, Request, Response } from 'express';
import { prisma } from '../utils/prisma';
const router = Router();
const BASE_URL = 'https://ngopi.top';
const DEFAULT_IMAGE = `${BASE_URL}/ngopi-share-v3.jpg`;
const reserved = new Set(['login', 'register', 'contacts', 'warkop', 'bambupedia', 'chat', 'admin', 'help-center', 'privacy', 'terms', 'test-payment', 'index', 'api']);
const slug = (name: string) => {
  const value = name.normalize('NFKC').trim().toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'pengguna';
  return reserved.has(value) ? `${value}-profil` : value;
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
const avatarUrl = (value: string | null) => {
  if (!value) return DEFAULT_IMAGE;
  try {
    const url = new URL(value, 'https://api.ngopi.top');
    if (!['https:', 'http:'].includes(url.protocol)) return DEFAULT_IMAGE;
    if (url.hostname === 'api.ngopi.top') url.protocol = 'https:';
    return url.href;
  } catch { return DEFAULT_IMAGE; }
};
router.get('/', async (req: Request, res: Response) => {
  const raw = typeof req.query.path === 'string' ? req.query.path : '/';
  const path = '/' + raw.replace(/^\/+/, '').split(/[?#]/)[0];
  let title = 'Ngopi — ngobrol paling intim';
  let description = 'Daftar tanpa nomor HP/email. Nikmati chat aman, voice, video call, kirim gambar, dokumen, dan alihbahasa otomatis.';
  let image = DEFAULT_IMAGE;
  try {
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
    const first = parts[0] || '';
    const target = parts.length === 1 && !reserved.has(first) ? first : parts.length === 2 && first === 'chat' ? (parts[1] || '') : '';
    if (target) {
      // Only public profile fields are selected. Ambiguous display names use the brand image.
      const users = await prisma.user.findMany({ select: { id: true, username: true, display_name: true, avatar_url: true } });
      let matches = users.filter(user => user.id === target || slug(user.username) === slug(target));
      if (!matches.length) matches = users.filter(user => slug(user.display_name || user.username) === slug(target));
      if (matches.length === 1) {
        const user = matches[0]!;
        const name = user.display_name || user.username;
        title = `${name} — Ngopi`;
        description = `Ngobrol dengan ${name} (@${user.username}) di Ngopi.`;
        image = avatarUrl(user.avatar_url);
      }
    }
  } catch (error) {
    console.error('Ngopi social preview lookup failed:', error);
  }
  const url = BASE_URL + path;
  const meta = (attribute: string, key: string, value: string) => `<meta ${attribute}="${key}" content="${escapeHtml(value)}">`;
  const tags = [meta('name', 'description', description), meta('property', 'og:type', 'website'), meta('property', 'og:site_name', 'Ngopi'), meta('property', 'og:url', url), meta('property', 'og:title', title), meta('property', 'og:description', description), meta('property', 'og:image', image), meta('property', 'og:image:alt', title), meta('name', 'twitter:card', 'summary_large_image'), meta('name', 'twitter:title', title), meta('name', 'twitter:description', description), meta('name', 'twitter:image', image)];
  if (image.startsWith('https:')) tags.push(meta('property', 'og:image:secure_url', image));
  if (image === DEFAULT_IMAGE) tags.push(meta('property', 'og:image:type', 'image/jpeg'), meta('property', 'og:image:width', '1000'), meta('property', 'og:image:height', '1000'));
  // Do not let a bot-specific response replace the app shell in a shared CDN cache.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'User-Agent');
  res.type('html').send(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>${tags.join('\n')}</head><body><a href="${escapeHtml(url)}">Buka ${escapeHtml(title)}</a></body></html>`);
});
export default router;
