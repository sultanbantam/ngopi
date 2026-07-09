import { Server, Socket } from 'socket.io';
import { answerQuestion, getPlatformDirectoryMessage, getPlatformInfoText } from '../services/ai.service';

const BAMBUPEDIA_ROOM = 'bambupedia-room';
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

const FEATURE_TIPS = [
  `${LOCK_ICON} Tahukah kamu? BambooChat mendukung enkripsi end-to-end untuk pesan pribadimu.`,
  `${PHONE_ICON} Kamu bisa memakai voice call dan video call langsung dari halaman kontak.`,
  `${BAMBOO_ICON} Rumpun Bambupedia adalah lobby publik untuk menyapa anggota BambooChat lain.`,
  `${GEM_ICON} BMC Token dapat dipakai untuk mengakses grup eksklusif dengan token gating.`,
  `${PAPERCLIP_ICON} Pesan pribadi mendukung pengiriman gambar, audio, video, dan dokumen.`,
  `${PEOPLE_ICON} Buat rumpun/grup baru dari tab Rumpun di daftar kontak.`,
  `${BELL_ICON} Aktifkan notifikasi browser agar tidak ketinggalan pesan penting.`,
  `${PIN_ICON} Pin pesan penting di chat pribadi supaya mudah ditemukan lagi.`,
  `${SMILE_ICON} Beri reaksi emoji pada pesan untuk merespons lebih cepat.`,
];

type BambupediaUser = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
};

type BambupediaMember = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

type BambupediaMessage = {
  id: string;
  type: 'user' | 'system' | 'tip' | 'pinned';
  content: string;
  sender_id: string;
  sender_name: string;
  avatar_url?: string | null;
  created_at: string;
};

const bambupediaSessions = new Map<
  string,
  { member: BambupediaMember; socketIds: Set<string> }
>();

let tipIndex = 0;
let tipsInterval: ReturnType<typeof setInterval> | null = null;

const makeId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const normalizeMember = (user: BambupediaUser): BambupediaMember => ({
  id: user.id,
  username: user.username,
  display_name: user.display_name || user.username,
  avatar_url: user.avatar_url || null,
});

const getOnlineMembers = () =>
  Array.from(bambupediaSessions.values()).map(({ member }) => member);

const emitOnlineMembers = (io: Server) => {
  const members = getOnlineMembers();
  io.to(BAMBUPEDIA_ROOM).emit('bambupedia_online_users', members);
  io.to(BAMBUPEDIA_ROOM).emit('bambupedia_members', members);
};

const emitOnlineMembersToSocket = (socket: Socket) => {
  const members = getOnlineMembers();
  socket.emit('bambupedia_online_users', members);
  socket.emit('bambupedia_members', members);
};

const createSystemMessage = (
  prefix: string,
  type: 'system' | 'tip' | 'pinned',
  content: string
): BambupediaMessage => ({
  id: makeId(prefix),
  type,
  content,
  sender_id: 'system',
  sender_name: type === 'pinned' ? 'BAMBOO HUB' : 'SISTEM',
  created_at: new Date().toISOString(),
});

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

  if (lower === '!list') {
    return getPlatformDirectoryMessage();
  }

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

export const handleBambupediaEvents = (
  io: Server,
  socket: Socket,
  user: BambupediaUser
) => {
  const member = normalizeMember(user);

  socket.join(BAMBUPEDIA_ROOM);

  const existingSession = bambupediaSessions.get(member.id);
  if (existingSession) {
    existingSession.member = member;
    existingSession.socketIds.add(socket.id);
  } else {
    bambupediaSessions.set(member.id, {
      member,
      socketIds: new Set([socket.id]),
    });
  }

  emitOnlineMembers(io);

  const pinnedMessage = createSystemMessage(
    'sys-pinned',
    'pinned',
    getPlatformDirectoryMessage()
  );
  socket.emit('bambupedia_pinned_message', pinnedMessage);

  const welcomeMessage = createSystemMessage(
    'sys-welcome',
    'system',
    `${BAMBOO_ICON} Selamat datang, ${member.display_name}! Senang kamu bergabung di Rumpun Bambupedia! ${WAVE_ICON}`
  );

  io.to(BAMBUPEDIA_ROOM).emit('bambupedia_user_joined', {
    user: member,
    message: welcomeMessage,
    created_at: welcomeMessage.created_at,
  });
  io.to(BAMBUPEDIA_ROOM).emit('bambupedia_message', welcomeMessage);

  const handleIncomingMessage = async (data: { content?: unknown }) => {
    if (typeof data?.content !== 'string') return;

    const content = data.content.trim();
    if (!content) return;

    const message: BambupediaMessage = {
      id: makeId(`msg-${member.id}`),
      type: 'user',
      content,
      sender_id: member.id,
      sender_name: member.display_name,
      avatar_url: member.avatar_url,
      created_at: new Date().toISOString(),
    };

    io.to(BAMBUPEDIA_ROOM).emit('bambupedia_message', message);

    try {
      const botContent = await resolveBotResponse(content);
      if (!botContent) return;

      const botMessage = createSystemMessage('sys-bot', 'system', botContent);
      io.to(BAMBUPEDIA_ROOM).emit('bambupedia_message', botMessage);
    } catch (error) {
      console.error('Bambupedia command error:', error);
      const botMessage = createSystemMessage(
        'sys-bot-error',
        'system',
        'BambooCS AI sedang tidak bisa memproses command. Coba lagi sebentar lagi.'
      );
      socket.emit('bambupedia_message', botMessage);
    }
  };

  socket.on('bambupedia_message', handleIncomingMessage);
  socket.on('bambupedia_send_message', handleIncomingMessage);

  socket.on('request_bambupedia_members', () => {
    emitOnlineMembersToSocket(socket);
  });

  socket.on('disconnect', () => {
    const session = bambupediaSessions.get(member.id);
    if (!session) return;

    session.socketIds.delete(socket.id);

    if (session.socketIds.size === 0) {
      bambupediaSessions.delete(member.id);
    }

    emitOnlineMembers(io);
  });
};

export const startBambupediaTips = (io: Server) => {
  if (tipsInterval) return;

  tipsInterval = setInterval(() => {
    if (bambupediaSessions.size === 0) return;

    const tip = FEATURE_TIPS[tipIndex % FEATURE_TIPS.length];
    tipIndex += 1;

    const tipMessage = createSystemMessage(
      'sys-tip',
      'tip',
      `${TIP_ICON} Tips Fitur: ${tip}`
    );

    io.to(BAMBUPEDIA_ROOM).emit('bambupedia_system_tip', tipMessage);
    io.to(BAMBUPEDIA_ROOM).emit('bambupedia_message', tipMessage);
  }, TIP_INTERVAL_MS);
};