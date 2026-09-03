import { Server, Socket } from 'socket.io';
import { answerQuestion, getPlatformDirectoryMessage, getPlatformInfoText } from '../services/ai.service';
import { prisma } from '../utils/prisma';

const BAMBUPEDIA_ROOM = 'bambupedia-room';
const BAMBUPEDIA_ROOM_NAME = 'Rumpun Bambupedia';
const TIP_INTERVAL_MS = 3 * 60 * 1000;

const BAMBOO_ICON = '\uD83C\uDF8B';
const TIP_ICON = '\uD83D\uDCA1';
const WAVE_ICON = '\uD83D\uDC4B';
const LOCK_ICON = '\uD83D\uDD12';
const PHONE_ICON = '\uD83D\uDCDE';
const GEM_ICON = '\uD83D\uDC8E';
const PAPERCLIP_ICON = '\uD83D\uDCCE';
const PEOPLE_ICON = '\uD83D\uDC65';
const BELL_ICON = '\uD83D\uDD14';
const PIN_ICON = '\uD83D\uDCCC';
const SMILE_ICON = '\uD83D\uDE0A';
const BOT_ICON = '\uD83E\uDD16';
const ECOSYSTEM_INFO_INTERVAL_MS = 60 * 1000;
const ECOSYSTEM_INFO_INITIAL_DELAY_MS = 60 * 1000;
const LINK_ICON = '\uD83D\uDD17';
const LEAF_ICON = '\uD83C\uDF3F';
const ROBOT_ICON = '\uD83E\uDD16';
const BALLOT_ICON = '\uD83D\uDDF3\uFE0F';
const GAME_ICON = '\uD83C\uDFAE';
const BUILDING_ICON = '\uD83C\uDFD7\uFE0F';
const CHART_ICON = '\uD83D\uDCC8';
const WHALE_ICON = '\uD83D\uDC0B';

type EcosystemInfoPlatform = {
  icon: string;
  name: string;
  url: string;
  description: string;
};

const ECOSYSTEM_INFO_PLATFORMS: EcosystemInfoPlatform[] = [
  {
    icon: LEAF_ICON,
    name: 'BaMbooChain ID',
    url: 'https://www.bamboochain.id',
    description: 'BambooChain adalah super app ekonomi hijau yang menghubungkan pengetahuan, teknologi, pasar, komunitas, dan pendanaan dalam satu ekosistem bambu terintegrasi. Melalui BambooChain, petani, peneliti, pelaku usaha, pemerintah, komunitas, dan masyarakat dapat belajar, berkolaborasi, mengelola proyek, memperdagangkan produk, serta membangun solusi berkelanjutan untuk lingkungan dan ekonomi masa depan.',
  },
  {
    icon: ROBOT_ICON,
    name: 'AdViPI',
    url: 'https://www.advipi.click',
    description: 'Platform AI yang membantu membuat iklan gambar dan video pendek secara otomatis. Cukup masukkan informasi produk atau layanan, AdViPI akan menghasilkan copywriting, desain visual, dan konten promosi siap tayang untuk media sosial, marketplace, dan ekosistem Pi Network.',
  },
  {
    icon: BALLOT_ICON,
    name: 'VotiVa',
    url: 'https://www.votiva.click',
    description: 'Platform AI Election Intelligence yang membantu kandidat, partai politik, dan tim kampanye mengelola pemilih, relawan, analisis sentimen, peta geospasial, serta komunikasi digital dalam satu dashboard cerdas untuk mendukung strategi pemenangan yang lebih tepat, cepat, dan berbasis data.',
  },
  {
    icon: GAME_ICON,
    name: 'BambooGame',
    url: 'https://www.bamboogame.click',
    description: 'Permainan konstruksi bambu 3D yang mengajak pemain menyusun profil dan panel Modular BlockBamboo menjadi berbagai desain bangunan secara kreatif, edukatif, dan menyenangkan.',
  },
  {
    icon: BUILDING_ICON,
    name: 'AIchitect',
    url: 'https://www.aichitect.click',
    description: 'Platform cerdas untuk planner, arsitek, engineer, dan tim manajemen proyek dalam merencanakan, merancang, menghitung, serta mengendalikan proyek secara terintegrasi. Didukung teknologi AI, AIchitect membantu mempercepat kolaborasi, meningkatkan akurasi, dan menghasilkan keputusan proyek yang lebih efektif dari tahap konsep hingga pelaksanaan.',
  },
  {
    icon: CHART_ICON,
    name: 'XignalX',
    url: 'https://www.xignalx.click',
    description: 'Aplikasi signal trading crypto dan saham yang membantu pengguna membaca peluang pasar melalui analisis data, indikator teknikal, dan notifikasi sinyal secara cepat. Dengan XignalX, pengguna dapat memantau tren, menemukan momentum beli atau jual, serta mengambil keputusan trading dengan lebih terukur.',
  },
  {
    icon: WHALE_ICON,
    name: 'Whale of Savu',
    url: 'https://www.whaleofsavu.org',
    description: 'Platform digital ekowisata dan konservasi laut yang menghubungkan wisatawan dengan pengalaman melihat paus hidup di Laut Sawu, menjelajahi Pulau Lembata, serta mendukung pelestarian alam dan pemberdayaan masyarakat lokal melalui teknologi, AI, dan Web3.',
  },
];

const FEATURE_TIPS = [
  `${LOCK_ICON} Keamanan: BambooChat mendukung percakapan terenkripsi untuk pesan pribadi. Tetap gunakan akun sendiri dan jangan bagikan kode login kepada orang lain.`,
  `${BAMBOO_ICON} Cara mulai: setelah login, buka Kontak untuk private message atau masuk ke Rumpun Bambupedia untuk ngobrol bersama komunitas.`,
  `${PEOPLE_ICON} Cara buat rumpun/grup: buka Kontak, pilih tab Rumpun, lalu tekan Buat Rumpun. Biaya minimum bisa dibuat 0 BMC untuk grup terbuka.`,
  `${GEM_ICON} Pengaturan rumpun: admin bisa mengatur nama, avatar, deskripsi, biaya join BMC, approval anggota, undangan, dan daftar anggota.`,
  `${PEOPLE_ICON} Admin rumpun dapat menambahkan anggota, menyetujui permintaan join, dan membagikan link undangan ke media sosial lain.`,
  `${SMILE_ICON} Mention teman dengan format @username. Saat mengetik @, pilih nama dari suggestion agar user yang dituju mudah melihat sapaanmu.`,
  `${PAPERCLIP_ICON} Kirim file dari tombol attachment. Gambar bisa dibuka langsung, sedangkan dokumen dapat dibuka atau diunduh dari menu file.`,
  `${PHONE_ICON} Voice call dan video call tersedia dari chat pribadi. Pastikan izin microphone dan kamera browser sudah aktif.`,
  `${BELL_ICON} Aktifkan notifikasi browser agar pesan pribadi, mention, file, panggilan, dan sapaan penting tidak terlewat.`,
  `${PIN_ICON} Pin pesan penting di chat pribadi supaya informasi utama mudah ditemukan lagi.`,
];

type BambupediaUser = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  is_online?: boolean | null;
  last_seen?: Date | string | null;
};

type BambupediaMember = {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  room_id: string;
  room_name: string;
  is_online: boolean;
  user_status: 'online' | 'offline';
  last_seen: string | null;
};

type BambupediaMessage = {
  id: string;
  message_id: string;
  room_id: string;
  room_name: string;
  type: 'user' | 'system' | 'tip' | 'pinned';
  message_type: 'text' | 'audio' | 'image' | 'file' | 'document' | 'system';
  content: string;
  message_text: string;
  sender_id: string;
  user_id?: string;
  sender_name: string;
  username?: string;
  avatar_url?: string | null;
  attachment_url?: string | null;
  mentioned_users: string[];
  created_at: string;
};

const bambupediaSessions = new Map<string, { member: BambupediaMember; socketIds: Set<string> }>();
let tipIndex = 0;
let tipsInterval: ReturnType<typeof setInterval> | null = null;
let ecosystemInfoIndex = 0;
let ecosystemInfoInitialTimeout: ReturnType<typeof setTimeout> | null = null;
let ecosystemInfoInterval: ReturnType<typeof setInterval> | null = null;
let lastEcosystemInfoMessage: BambupediaMessage | null = null;

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const toIso = (value?: Date | string | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeMember = (user: BambupediaUser): BambupediaMember => {
  const isOnline = Boolean(user.is_online);
  return {
    id: user.id,
    user_id: user.id,
    username: user.username,
    display_name: user.display_name || user.username,
    avatar_url: user.avatar_url || null,
    room_id: BAMBUPEDIA_ROOM,
    room_name: BAMBUPEDIA_ROOM_NAME,
    is_online: isOnline,
    user_status: isOnline ? 'online' : 'offline',
    last_seen: toIso(user.last_seen),
  };
};

const getFallbackMembers = () => Array.from(bambupediaSessions.values()).map(({ member }) => ({ ...member, is_online: true, user_status: 'online' as const }));

const getRoomMembers = async () => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      display_name: true,
      avatar_url: true,
      is_online: true,
      last_seen: true,
    },
  });

  return users
    .map(normalizeMember)
    .sort((a, b) => {
      if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
      return a.display_name.localeCompare(b.display_name);
    });
};

export const emitBambupediaMembers = async (io: Server) => {
  try {
    const members = await getRoomMembers();
    io.to(BAMBUPEDIA_ROOM).emit('bambupedia_online_users', members);
    io.to(BAMBUPEDIA_ROOM).emit('bambupedia_members', members);
  } catch (error) {
    console.error('Error broadcasting Bambupedia members:', error);
    const fallback = getFallbackMembers();
    io.to(BAMBUPEDIA_ROOM).emit('bambupedia_online_users', fallback);
    io.to(BAMBUPEDIA_ROOM).emit('bambupedia_members', fallback);
  }
};

const emitBambupediaMembersToSocket = async (socket: Socket) => {
  try {
    const members = await getRoomMembers();
    socket.emit('bambupedia_online_users', members);
    socket.emit('bambupedia_members', members);
  } catch (error) {
    console.error('Error sending Bambupedia members:', error);
    const fallback = getFallbackMembers();
    socket.emit('bambupedia_online_users', fallback);
    socket.emit('bambupedia_members', fallback);
  }
};

const sanitizeMessageType = (type: unknown): BambupediaMessage['message_type'] => {
  if (type === 'audio' || type === 'image' || type === 'file' || type === 'document' || type === 'system') return type;
  return 'text';
};

const extractMentionedUsers = (content: string) => {
  const matches = content.match(/@([A-Za-z0-9_.-]+)/g) || [];
  return Array.from(new Set(matches.map((match) => match.slice(1).toLowerCase())));
};

const notifyMentionedUsers = async (io: Server, message: BambupediaMessage, senderId: string) => {
  if (message.mentioned_users.length === 0) return;

  try {
    const users = await prisma.user.findMany({
      select: { id: true, username: true, display_name: true },
    });
    const mentioned = new Set(message.mentioned_users.map((username) => username.toLowerCase()));

    users
      .filter((user) => user.id !== senderId && mentioned.has(user.username.toLowerCase()))
      .forEach((user) => {
        io.to(user.id).emit('bambupedia_mention', {
          ...message,
          mentioned_user_id: user.id,
          mentioned_username: user.username,
          mentioned_display_name: user.display_name,
        });
      });
  } catch (error) {
    console.error('Bambupedia mention notification error:', error);
  }
};

const createSystemMessage = (prefix: string, type: 'system' | 'tip' | 'pinned', content: string, senderName?: string): BambupediaMessage => {
  const id = makeId(prefix);
  return {
    id,
    message_id: id,
    room_id: BAMBUPEDIA_ROOM,
    room_name: BAMBUPEDIA_ROOM_NAME,
    type,
    message_type: 'system',
    content,
    message_text: content,
    sender_id: 'system',
    sender_name: senderName || (type === 'pinned' ? 'BAMBOO HUB' : 'SISTEM'),
    mentioned_users: extractMentionedUsers(content),
    created_at: new Date().toISOString(),
  };
};


const formatEcosystemInfoMessage = (platform: EcosystemInfoPlatform) => `${platform.icon} ${platform.name}\n${LINK_ICON} ${platform.url}\n${platform.description}`;

const emitEcosystemInfoMessage = (io: Server) => {
  const platform = ECOSYSTEM_INFO_PLATFORMS[ecosystemInfoIndex % ECOSYSTEM_INFO_PLATFORMS.length] || ECOSYSTEM_INFO_PLATFORMS[0];
  if (!platform) return;

  ecosystemInfoIndex = (ecosystemInfoIndex + 1) % ECOSYSTEM_INFO_PLATFORMS.length;
  const message = createSystemMessage('sys-ecosystem', 'system', formatEcosystemInfoMessage(platform), 'BambooBot');
  lastEcosystemInfoMessage = message;
  io.to(BAMBUPEDIA_ROOM).emit('system_message', message);
  io.to(BAMBUPEDIA_ROOM).emit('bambupedia_message', message);
  console.log(`[Bambupedia] ecosystem info sent: ${platform.name}`);
};

export const startBambupediaEcosystemInfo = (io: Server) => {
  if (ecosystemInfoInitialTimeout || ecosystemInfoInterval) return;

  ecosystemInfoInitialTimeout = setTimeout(() => {
    emitEcosystemInfoMessage(io);
    ecosystemInfoInitialTimeout = null;
    ecosystemInfoInterval = setInterval(() => emitEcosystemInfoMessage(io), ECOSYSTEM_INFO_INTERVAL_MS);
  }, ECOSYSTEM_INFO_INITIAL_DELAY_MS);
};

export const stopBambupediaEcosystemInfo = () => {
  if (ecosystemInfoInitialTimeout) {
    clearTimeout(ecosystemInfoInitialTimeout);
    ecosystemInfoInitialTimeout = null;
  }
  if (ecosystemInfoInterval) {
    clearInterval(ecosystemInfoInterval);
    ecosystemInfoInterval = null;
  }
};
const looksLikePlatformQuestion = (content: string) => {
  const lower = content.toLowerCase();
  const hasQuestionMark = content.includes('?');
  const hasQuestionWord = /\b(apa|apakah|bagaimana|kenapa|mengapa|cara|why|how|what)\b/.test(lower);
  const hasPlatformWord = /\b(bamboochain|bamboogame|xignalx|votiva|aichitect|whale|savu|bmc|wallet|vote|voting|game|reward|generate|sinyal)\b/.test(lower);
  return (hasQuestionMark || hasQuestionWord) && hasPlatformWord;
};

const resolveBotResponse = async (content: string) => {
  const trimmed = content.trim();
  const lower = trimmed.toLowerCase();

  if (lower === '!list') return getPlatformDirectoryMessage();

  if (lower.startsWith('!info')) {
    const platformInput = trimmed.slice('!info'.length).trim();
    if (!platformInput) return 'Format: !info nama_platform. Contoh: !info bamboogame';
    return getPlatformInfoText(platformInput);
  }

  if (lower === '/cs') {
    return 'Saya siap bantu. Buka Pusat Bantuan untuk membuat tiket CS dengan platform yang sesuai, atau jelaskan masalahmu di sini agar AI mencoba mencocokkan FAQ terlebih dahulu.';
  }

  if (!looksLikePlatformQuestion(trimmed)) return null;

  const result = await answerQuestion(trimmed);
  if (!result.platform && result.confidence < 0.5) return null;
  return `${BOT_ICON} BambooCS AI (${Math.round(result.confidence * 100)}%)\n${result.answer}`;
};

export const handleBambupediaEvents = (io: Server, socket: Socket, user: BambupediaUser) => {
  const member = normalizeMember({ ...user, is_online: true });

  socket.join(BAMBUPEDIA_ROOM);

  const existingSession = bambupediaSessions.get(member.id);
  const isFirstJoin = !existingSession || existingSession.socketIds.size === 0;

  if (existingSession) {
    existingSession.member = member;
    existingSession.socketIds.add(socket.id);
  } else {
    bambupediaSessions.set(member.id, { member, socketIds: new Set([socket.id]) });
  }

  void emitBambupediaMembers(io);

  if (lastEcosystemInfoMessage) {
    socket.emit('bambupedia_message', lastEcosystemInfoMessage);
  }

  if (isFirstJoin) {
    const welcomeMessage = createSystemMessage('sys-welcome', 'system', `${BAMBOO_ICON} Selamat datang, ${member.display_name}! Senang kamu bergabung di ${BAMBUPEDIA_ROOM_NAME}! ${WAVE_ICON}`);
    io.to(BAMBUPEDIA_ROOM).emit('bambupedia_user_joined', { user: member, message: welcomeMessage, created_at: welcomeMessage.created_at });
  }

  const handleIncomingMessage = async (data: { content?: unknown; message_text?: unknown; type?: unknown; message_type?: unknown; attachment_url?: unknown }) => {
    const rawContent = typeof data?.content === 'string' ? data.content : typeof data?.message_text === 'string' ? data.message_text : '';
    const messageType = sanitizeMessageType(data?.message_type || data?.type);
    const attachmentUrl = typeof data?.attachment_url === 'string' ? data.attachment_url : null;
    const trimmed = rawContent.trim();
    if (!trimmed && !attachmentUrl) return;

    const content = trimmed || (messageType === 'audio' ? 'Voice message' : messageType === 'image' ? 'Image' : 'Attachment');
    const messageId = makeId(`msg-${member.id}`);
    const message: BambupediaMessage = {
      id: messageId,
      message_id: messageId,
      room_id: BAMBUPEDIA_ROOM,
      room_name: BAMBUPEDIA_ROOM_NAME,
      type: 'user',
      message_type: messageType,
      content,
      message_text: content,
      sender_id: member.id,
      user_id: member.id,
      sender_name: member.display_name,
      username: member.username,
      avatar_url: member.avatar_url,
      attachment_url: attachmentUrl,
      mentioned_users: extractMentionedUsers(content),
      created_at: new Date().toISOString(),
    };

    io.to(BAMBUPEDIA_ROOM).emit('bambupedia_message', message);
    void notifyMentionedUsers(io, message, member.id);

    if (messageType !== 'text') return;

    try {
      const botContent = await resolveBotResponse(content);
      if (!botContent) return;
      const botMessage = createSystemMessage('sys-bot', 'system', botContent);
      io.to(BAMBUPEDIA_ROOM).emit('bambupedia_message', botMessage);
    } catch (error) {
      console.error('Bambupedia command error:', error);
      const botMessage = createSystemMessage('sys-bot-error', 'system', 'BambooCS AI sedang tidak bisa memproses command. Coba lagi sebentar lagi.');
      socket.emit('bambupedia_message', botMessage);
    }
  };

  socket.on('bambupedia_message', handleIncomingMessage);
  socket.on('bambupedia_send_message', handleIncomingMessage);
  socket.on('request_bambupedia_members', () => void emitBambupediaMembersToSocket(socket));

  socket.on('disconnect', () => {
    const session = bambupediaSessions.get(member.id);
    if (!session) return;
    session.socketIds.delete(socket.id);
    if (session.socketIds.size === 0) bambupediaSessions.delete(member.id);
    setTimeout(() => void emitBambupediaMembers(io), 300);
  });
};

export const startBambupediaTips = (io: Server) => {
  if (tipsInterval) return;

  tipsInterval = setInterval(() => {
    if (bambupediaSessions.size === 0) return;
    const tip = FEATURE_TIPS[tipIndex % FEATURE_TIPS.length];
    tipIndex += 1;
    const tipMessage = createSystemMessage('sys-tip', 'tip', `${TIP_ICON} Tips Fitur: ${tip}`);
    io.to(BAMBUPEDIA_ROOM).emit('bambupedia_system_tip', tipMessage);
    io.to(BAMBUPEDIA_ROOM).emit('bambupedia_message', tipMessage);
  }, TIP_INTERVAL_MS);
};

