import { Server, Socket } from 'socket.io';
import { answerQuestion, getPlatformDirectoryMessage, getPlatformInfoText } from '../services/ai.service';
import { prisma } from '../utils/prisma';
import { WARKOP_TEBAK_TEBAKAN, TebakTebakan } from '../data/tebakTebakan';

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

const FEATURE_TIPS = [
  `⚙️ Pengaturan Akun: Anda dapat mengubah nama tampilan (display name), foto avatar, dan bio dengan mengetuk ikon roda gigi (⚙️) di pojok kanan atas, lalu pilih "Pengaturan Profil".`,
  `🔒 Kebijakan Privasi (E2EE): Seluruh pesan pribadi di Ngopi dilindungi enkripsi ujung-ke-ujung (End-to-End Encryption). Kunci rahasia tersimpan di perangkat Anda dan server Ngopi tidak dapat membaca pesan Anda.`,
  `📜 Syarat & Ketentuan Warkop: Warkop adalah ruang publik yang santai, bersahabat, dan inklusif. Dilarang melakukan spam, pelecehan, atau menyebarkan konten berbahaya demi menjaga kenyamanan bersama.`,
  `🔄 Muat Ulang Kunci: Jika pesan pribadi bertuliskan "Gagal mendekripsi" setelah berganti HP/perangkat, ketuk tombol "🔄 Muat Ulang Kunci" di atas ruang chat untuk menyinkronkan kembali kunci aman.`,
  `☕ Suasana Warkop: Dengarkan suara gerimis hujan, obrolan kafe, deburan ombak, atau jangkrik malam dengan mengetuk menu "Suasana Warkop" di atas tanpa perlu unduh file apapun.`,
  `🎵 Jukebox Warung: Cari dan putar lagu favorit Anda atau masukkan ke antrian musik warung bersama teman nongkrong di Jukebox Warkop.`,
  `🎲 Game Tebak-tebakan: Ikuti tebak-tebakan seru dari WarkopBot di chat room! Tebak dengan benar untuk mendapatkan +10 Poin Kopi ☕ yang tercatat di akunmu.`,
  `☕ Reaksi Emoji Kopi: Ketuk emoji warkop cepat (☕, 🍵, 🚬, 🎵, 🍜, 🌙) di samping kolom pesan atau ketuk tombol 😊 untuk membuka puluhan pilihan emoji populer lainnya.`,
  `📎 Kirim Berkas & Gambar: Kirim foto dan dokumen kerja secara aman dari tombol attachment (📎 dan 📷). Gambar dan dokumen dapat langsung dibuka atau diunduh.`,
  `🎙️ Pesan Suara (Voice Message): Tahan tombol mikrofon untuk merekam dan mengirimkan pesan suara hangat kepada teman warkop.`,
  `👥 Kontak & Komunitas: Buka menu Kontak untuk memulai obrolan pribadi atau membuat Rumpun komunitas baru secara bebas.`,
  `✓ Tanda Centang Terbaca: Centang satu (✓) menandakan pesan terkirim ke server, dan centang ganda (✓✓) menandakan pesan telah dibaca oleh teman bicara.`,
  `🔍 Pencarian Pesan: Gunakan ikon pencarian (🔍) di atas layar untuk menemukan pesan teks, nama teman, atau percakapan lama dengan cepat.`,
  `🌙 Mode Malam Nyaman: Tema kopi gelap dirancang khusus agar mata tetap nyaman dan santai saat mengobrol hingga larut malam.`,
  `💡 Bantuan & Panduan: Anda dapat membaca detail Kebijakan Privasi di /privacy dan Syarat Ketentuan di /terms kapan saja dari menu drawer.`,
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
let currentRiddleIndex = 0;
let currentRiddle: TebakTebakan | null = null;
let riddleAnswered = false;
let riddleTimeout: ReturnType<typeof setTimeout> | null = null;
let riddleInterval: ReturnType<typeof setInterval> | null = null;
const userPoints = new Map<string, number>();

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


const formatRiddleMessage = (riddle: TebakTebakan) =>
  `🎯 [TEBAK-TEBAKAN WARKOP]\n${riddle.question}\n\nKetik jawabanmu langsung di chat! Jawaban benar dapat +10 Poin Kopi ☕!`;

export const emitWarkopRiddle = (io: Server) => {
  if (WARKOP_TEBAK_TEBAKAN.length === 0) return;
  const riddle = WARKOP_TEBAK_TEBAKAN[currentRiddleIndex % WARKOP_TEBAK_TEBAKAN.length];
  currentRiddleIndex = (currentRiddleIndex + 1) % WARKOP_TEBAK_TEBAKAN.length;
  currentRiddle = riddle;
  riddleAnswered = false;

  const message = createSystemMessage('sys-tebak', 'system', formatRiddleMessage(riddle), 'WarkopBot');
  io.to(BAMBUPEDIA_ROOM).emit('system_message', message);
  io.to(BAMBUPEDIA_ROOM).emit('bambupedia_message', message);
  console.log(`[WarkopGame] Riddle broadcasted: ${riddle.question}`);
};

export const startBambupediaEcosystemInfo = (io: Server) => {
  if (riddleTimeout || riddleInterval) return;

  riddleTimeout = setTimeout(() => {
    emitWarkopRiddle(io);
    riddleTimeout = null;
    riddleInterval = setInterval(() => {
      if (bambupediaSessions.size > 0 && !riddleAnswered) {
        emitWarkopRiddle(io);
      }
    }, 2.5 * 60 * 1000);
  }, 10 * 1000);
};

export const stopBambupediaEcosystemInfo = () => {
  if (riddleTimeout) {
    clearTimeout(riddleTimeout);
    riddleTimeout = null;
  }
  if (riddleInterval) {
    clearInterval(riddleInterval);
    riddleInterval = null;
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
  return `${BOT_ICON} NgopiCS AI (${Math.round(result.confidence * 100)}%)\n${result.answer}`;
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

  if (currentRiddle && !riddleAnswered) {
    socket.emit('bambupedia_message', createSystemMessage('sys-tebak', 'system', formatRiddleMessage(currentRiddle), 'WarkopBot'));
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

    const cleanUserText = trimmed.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

    // Command /tebak or /game
    if (cleanUserText === '/tebak' || cleanUserText === '!tebak' || cleanUserText === '/game') {
      if (currentRiddle) {
        const msg = createSystemMessage('sys-tebak', 'system', formatRiddleMessage(currentRiddle), 'WarkopBot');
        io.to(BAMBUPEDIA_ROOM).emit('bambupedia_message', msg);
      } else {
        emitWarkopRiddle(io);
      }
      return;
    }

    // Command /poin or /skor
    if (cleanUserText === '/poin' || cleanUserText === '!poin' || cleanUserText === '/skor') {
      const pts = userPoints.get(member.username) || 0;
      const msg = createSystemMessage('sys-poin', 'system', `⭐ Poin Kopi @${member.username}: ${pts} Poin ☕\nJawab tebak-tebakan dari WarkopBot untuk menambah poinmu!`, 'WarkopBot');
      io.to(BAMBUPEDIA_ROOM).emit('bambupedia_message', msg);
      return;
    }

    // Check answer for active riddle
    if (currentRiddle && !riddleAnswered) {
      const isMatch = currentRiddle.synonyms.some(synonym => {
        const cleanSyn = synonym.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        return cleanUserText === cleanSyn || cleanUserText.includes(cleanSyn);
      });

      if (isMatch) {
        riddleAnswered = true;
        const currentPts = userPoints.get(member.username) || 0;
        const newPts = currentPts + 10;
        userPoints.set(member.username, newPts);

        const winMsg = createSystemMessage(
          'sys-tebak-win',
          'system',
          `🎉 SELAMAT @${member.username}! Jawaban kamu BENAR!\n✅ Jawaban: ${currentRiddle.answer}\n⭐ Kamu mendapatkan +10 Poin Kopi ☕! (Total Poin Kamu: ${newPts} Poin)\n\nNantikan tebak-tebakan berikutnya sebentar lagi!`
        );
        io.to(BAMBUPEDIA_ROOM).emit('bambupedia_message', winMsg);

        io.to(BAMBUPEDIA_ROOM).emit('warkop_user_points', {
          username: member.username,
          points: newPts,
        });

        setTimeout(() => {
          if (bambupediaSessions.size > 0) {
            emitWarkopRiddle(io);
          }
        }, 20 * 1000);
        return;
      }
    }

    try {
      const botContent = await resolveBotResponse(content);
      if (!botContent) return;
      const botMessage = createSystemMessage('sys-bot', 'system', botContent);
      io.to(BAMBUPEDIA_ROOM).emit('bambupedia_message', botMessage);
    } catch (error) {
      console.error('Bambupedia command error:', error);
      const botMessage = createSystemMessage('sys-bot-error', 'system', 'NgopiCS AI sedang tidak bisa memproses command. Coba lagi sebentar lagi.');
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

