import { prisma } from '../utils/prisma';
import { ECOSYSTEM_PLATFORMS, getPlatformDirectoryText } from '../data/ecosystem';

type PlatformRecord = {
  id: string;
  name: string;
  display_name: string;
  description: string;
  website_url: string;
  icon: string | null;
};

type FaqRecord = {
  id: string;
  platform_id: string;
  question: string;
  answer: string;
  keywords: string[];
  platform: PlatformRecord;
};

const CONFIDENT_THRESHOLD = 0.8;

const STOP_WORDS = new Set([
  'apa', 'apakah', 'yang', 'di', 'ke', 'dari', 'dan', 'atau', 'untuk', 'cara', 'bagaimana',
  'kenapa', 'mengapa', 'saya', 'aku', 'kami', 'kita', 'bisa', 'dapat', 'mau', 'ingin', 'itu',
  'ini', 'the', 'a', 'an', 'is', 'are', 'how', 'what', 'why', 'to', 'of', 'in', 'on', 'for',
]);

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value: string) =>
  normalize(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

const unique = (items: string[]) => Array.from(new Set(items));

const getSeedAliases = (platformName: string) =>
  ECOSYSTEM_PLATFORMS.find((platform) => platform.name === platformName)?.aliases || [];

const getPlatformAliases = (platform: PlatformRecord) =>
  unique([
    platform.name,
    platform.display_name,
    platform.website_url.replace(/^https?:\/\//, ''),
    ...getSeedAliases(platform.name),
  ]).map(normalize);

const overlapScore = (left: string[], right: string[]) => {
  if (left.length === 0 || right.length === 0) return 0;

  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }

  return (2 * intersection) / (leftSet.size + rightSet.size);
};

const keywordScore = (questionTokens: string[], keywords: string[]) => {
  if (keywords.length === 0) return 0;

  const normalizedQuestion = ` ${normalize(questionTokens.join(' '))} `;
  const hits = keywords.filter((keyword) => {
    const normalizedKeyword = normalize(keyword);
    if (!normalizedKeyword) return false;
    if (normalizedQuestion.includes(` ${normalizedKeyword} `)) return true;
    return normalizedKeyword.split(' ').some((part) => questionTokens.includes(part));
  }).length;

  return Math.min(1, hits / Math.min(3, keywords.length));
};

export const getPlatformDirectoryMessage = () =>
  `Daftar platform ekosistem Bambu:\n${getPlatformDirectoryText()}\n\nCommand: !list atau !info nama_platform. Untuk bantuan personal, buka Pusat Bantuan atau ketik /cs.`;

export const findPlatformByText = async (text: string, platforms?: PlatformRecord[]) => {
  const allPlatforms = platforms || await prisma.platform.findMany({ orderBy: { display_name: 'asc' } });
  const normalizedText = normalize(text);

  let best: { platform: PlatformRecord; score: number } | null = null;

  for (const platform of allPlatforms) {
    const aliases = getPlatformAliases(platform);
    const score = aliases.reduce((highest, alias) => {
      if (!alias) return highest;
      if (normalizedText === alias) return Math.max(highest, 1);
      if (normalizedText.includes(alias)) return Math.max(highest, Math.min(1, alias.length / Math.max(8, normalizedText.length) + 0.5));
      return highest;
    }, 0);

    if (!best || score > best.score) {
      best = { platform, score };
    }
  }

  return best && best.score > 0.18 ? best.platform : null;
};

export const getPlatformInfoText = async (platformInput: string) => {
  const platforms = await prisma.platform.findMany({ orderBy: { display_name: 'asc' } });
  const platform = await findPlatformByText(platformInput, platforms);

  if (!platform) {
    return `Platform "${platformInput}" belum ditemukan. Gunakan !list untuk melihat daftar platform yang tersedia.`;
  }

  return `${platform.display_name}\n${platform.description}\nLink: ${platform.website_url}\nTag: #${platform.display_name.replace(/\s+/g, '')}`;
};

export const answerQuestion = async (question: string, platformId?: string | null) => {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    return {
      answer: 'Pertanyaan masih kosong. Tulis pertanyaan tentang salah satu platform ekosistem Bambu.',
      confidence: 0,
      suggest_ticket: false,
      platform: null,
      matched_faq: null,
    };
  }

  const platforms = await prisma.platform.findMany({ orderBy: { display_name: 'asc' } });
  const selectedPlatform = platformId
    ? platforms.find((platform) => platform.id === platformId) || null
    : await findPlatformByText(trimmedQuestion, platforms);

  const faqQuery: any = {
    include: { platform: true },
    orderBy: { created_at: 'asc' },
  };
  if (selectedPlatform) faqQuery.where = { platform_id: selectedPlatform.id };

  const faqs = await prisma.faq.findMany(faqQuery) as unknown as FaqRecord[];

  if (faqs.length === 0) {
    return {
      answer: selectedPlatform
        ? `Knowledge base untuk ${selectedPlatform.display_name} belum tersedia. Saya akan menghubungkan Anda dengan CS kami. Mohon tunggu.`
        : `Saya belum menemukan knowledge base yang cocok. Gunakan !list untuk melihat platform atau buat tiket CS.`,
      confidence: 0,
      suggest_ticket: true,
      platform: selectedPlatform,
      matched_faq: null,
    };
  }

  const questionTokens = tokenize(trimmedQuestion);
  const normalizedQuestion = normalize(trimmedQuestion);

  const ranked = faqs
    .map((faq) => {
      const faqQuestionTokens = tokenize(faq.question);
      const faqAllTokens = tokenize(`${faq.question} ${faq.keywords.join(' ')}`);
      const directPhrase = normalize(faq.question);
      const platformAliases = getPlatformAliases(faq.platform);
      const platformSignal = platformAliases.some((alias) => alias && normalizedQuestion.includes(alias)) ? 0.05 : 0;
      const directScore = normalizedQuestion.includes(directPhrase) || directPhrase.includes(normalizedQuestion)
        ? 0.95
        : 0;
      const tokenScore = overlapScore(questionTokens, faqAllTokens);
      const keywordMatch = keywordScore(questionTokens, faq.keywords);
      const score = Math.max(directScore, Math.min(1, (tokenScore * 0.72) + (keywordMatch * 0.23) + platformSignal));

      return { faq, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const confidence = best ? Number(best.score.toFixed(2)) : 0;
  const suggestTicket = confidence < CONFIDENT_THRESHOLD;
  const platform = selectedPlatform || best?.faq.platform || null;

  if (!best || suggestTicket) {
    return {
      answer: `Untuk pertanyaan ini, saya akan menghubungkan Anda dengan CS kami. Mohon tunggu. Anda juga bisa membuat tiket agar tim ${platform?.display_name || 'BambooCS'} dapat menindaklanjuti.`,
      confidence,
      suggest_ticket: true,
      platform,
      matched_faq: best?.faq || null,
    };
  }

  return {
    answer: `${best.faq.answer}\n\n#${best.faq.platform.display_name.replace(/\s+/g, '')}`,
    confidence,
    suggest_ticket: false,
    platform: best.faq.platform,
    matched_faq: {
      id: best.faq.id,
      question: best.faq.question,
    },
  };
};