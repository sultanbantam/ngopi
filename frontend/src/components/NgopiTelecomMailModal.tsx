import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import axios from 'axios';
import { router } from 'expo-router';
import { coffee } from '../theme/coffee';
import * as SecureStore from '../utils/storage';

const API_URL = 'https://api.ngopi.top/api';
const LOCAL_CUSTOM_NUMBERS_KEY = 'ngopi.telecom.custom_numbers.v1';
const LOCAL_MAILS_KEY = 'ngopi.telecom.mails.v1';

export interface TelecomMemberItem {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  bmc_id?: number | null;
  role?: string | null;
  ngopi_number?: string;
  ngopi_email?: string;
}

interface MailItem {
  id: string;
  from_user_id: string;
  from_username: string;
  from_display_name: string;
  from_email: string;
  from_number: string;
  to_user_id: string;
  to_username: string;
  to_email: string;
  to_number: string;
  subject: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  currentUserId: string;
  currentUsername: string;
  currentDisplayName?: string;
  userPoints?: number;
  members?: TelecomMemberItem[];
  initialTab?: 'dialpad' | 'custom_number' | 'mail';
}

const CONSONANTS = 'bcdfghjklmnpqrstvwxz';

export function generateUglyDefaultNumber(usernameOrId: string): string {
  const clean = String(usernameOrId || 'user').trim().toLowerCase().replace(/^@/, '');
  if (clean === 'warung' || clean === 'founder') return '0';
  let h1 = 2166136261;
  let h2 = 16777619;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ (ch * 31), 2166136261) >>> 0;
  }
  const firstDigits = ['7', '8', '9', '6'];
  let result = firstDigits[h1 % 4];
  let state = (h1 ^ h2) >>> 0;
  for (let i = 1; i < 10; i++) {
    state = (Math.imul(state, 1664525) + 1013904223 + i * 97) >>> 0;
    let d = String((state % 9) + 1);
    if (d === result[result.length - 1]) {
      d = String(((Number(d) + 3) % 9) + 1);
    }
    if (result.length >= 1 && Math.abs(Number(d) - Number(result[result.length - 1])) === 1) {
      d = String(((Number(d) + 4) % 9) + 1);
    }
    result += d;
  }
  return result;
}

export function generateUglyConsonantEmail(usernameOrId: string): string {
  const clean = String(usernameOrId || 'user').trim().toLowerCase().replace(/^@/, '');
  if (clean === 'warung' || clean === 'founder') return 'warung@ngopi.top';
  let h1 = 1315423911;
  let h2 = 2654435761;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761) >>> 0;
    h2 = Math.imul(h2 + ch * (i + 17), 1597334677) >>> 0;
  }
  let prefix = '';
  let state = (h1 ^ h2) >>> 0;
  for (let i = 0; i < 11; i++) {
    state = (Math.imul(state, 22695477) + 1 + i * 53) >>> 0;
    let c = CONSONANTS[state % CONSONANTS.length];
    if (prefix.length > 0 && c === prefix[prefix.length - 1]) {
      c = CONSONANTS[(state + 7) % CONSONANTS.length];
    }
    prefix += c;
  }
  return `${prefix}@ngopi.top`;
}

export function computeDefaultNgopiNumber(
  member: TelecomMemberItem,
  _indexInSorted: number,
  customMap: Record<string, string>
): string {
  if (customMap[member.id]) return customMap[member.id];
  if (member.ngopi_number) return String(member.ngopi_number);
  const uname = String(member.username || '').trim().toLowerCase();
  if (uname === 'warung' || member.bmc_id === 1) {
    return '0';
  }
  return generateUglyDefaultNumber(uname || member.id);
}

export function formatNgopiEmail(username: string, customEmail?: string): string {
  if (customEmail) return customEmail;
  const clean = String(username || 'user').trim().toLowerCase().replace(/^@/, '');
  if (clean === 'warung' || clean === 'founder') {
    return 'warung@ngopi.top';
  }
  return generateUglyConsonantEmail(clean || 'user');
}

export default function NgopiTelecomMailModal({
  visible,
  onClose,
  currentUserId,
  currentUsername,
  currentDisplayName,
  userPoints = 0,
  members = [],
  initialTab = 'dialpad',
}: Props) {
  const [activeTab, setActiveTab] = useState<'dialpad' | 'custom_number' | 'mail'>(initialTab);
  const [customNumbersMap, setCustomNumbersMap] = useState<Record<string, string>>({});
  const [myNumber, setMyNumber] = useState<string>('');
  const [myEmail, setMyEmail] = useState<string>('');
  const [isFounder, setIsFounder] = useState<boolean>(false);

  // Dialpad state
  const [dialedInput, setDialedInput] = useState<string>('');

  // Custom Number Claim state
  const [desiredNumber, setDesiredNumber] = useState<string>('');
  const [availabilityStatus, setAvailabilityStatus] = useState<{
    checked: boolean;
    available: boolean;
    message: string;
    lockedVip?: boolean;
  } | null>(null);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);

  // Custom Email (@ngopi.top) Claim & Lock state
  const [customEmailsMap, setCustomEmailsMap] = useState<Record<string, string>>({});
  const [lockedEmailPrefixes, setLockedEmailPrefixes] = useState<string[]>([
    '0', 'founder', 'warung', 'admin', 'superadmin', 'owner', 'ceo', 'cto', 'cfo',
    'official', 'cs', 'support', 'help', 'info', 'contact', 'billing', 'payment',
    'finance', 'security', 'noc', 'warkop', 'ngopi', 'ngopai', 'bamboochain', 'bmc',
    'mail', 'email', 'postmaster', 'noreply', 'no-reply', 'system', 'root', 'bot',
    'vip', 'vvip', 'premium', 'partner', 'merchant', 'cafe', 'kopi', 'indonesia', 'nusantara',
  ]);
  const [desiredEmailPrefix, setDesiredEmailPrefix] = useState<string>('');
  const [emailAvailabilityStatus, setEmailAvailabilityStatus] = useState<{
    checked: boolean;
    available: boolean;
    message: string;
  } | null>(null);
  const [isClaimingEmail, setIsClaimingEmail] = useState<boolean>(false);

  // Premium Mode state (Managed by Founder #0)
  const [requirePaidCustomNumber, setRequirePaidCustomNumber] = useState<boolean>(true);
  const [requirePaidCustomEmail, setRequirePaidCustomEmail] = useState<boolean>(true);

  // Founder VIP Assign state (1..100 & Locked @ngopi.top Emails)
  const [vipTargetUsername, setVipTargetUsername] = useState<string>('');
  const [vipNumberInput, setVipNumberInput] = useState<string>('');
  const [founderEmailInput, setFounderEmailInput] = useState<string>('');
  const [founderEmailTargetUser, setFounderEmailTargetUser] = useState<string>('');

  // Mail state
  const [mailSubTab, setMailSubTab] = useState<'inbox' | 'sent' | 'compose'>('inbox');
  const [mails, setMails] = useState<MailItem[]>([]);
  const [selectedMail, setSelectedMail] = useState<MailItem | null>(null);
  const [composeTo, setComposeTo] = useState<string>('');
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');
  const [isSendingMail, setIsSendingMail] = useState<boolean>(false);
  const [loadingMail, setLoadingMail] = useState<boolean>(false);

  useEffect(() => {
    if (visible && initialTab) {
      setActiveTab(initialTab);
    }
  }, [visible, initialTab]);

  const showNotice = (title: string, msg: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const copyText = async (text: string, label: string) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        await Clipboard.setStringAsync(text);
      }
      showNotice('Berhasil Disalin', `${label} (${text}) telah disalin ke papan klip.`);
    } catch {
      showNotice(label, text);
    }
  };

  const getToken = async () => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return localStorage.getItem('token') || '';
    }
    return (await SecureStore.getItemAsync('token')) || '';
  };

  // Build full directory with numbers & emails
  const enrichedDirectory = useMemo(() => {
    const list = [...members];
    const hasMe = list.some((m) => m.id === currentUserId || m.username?.toLowerCase() === currentUsername?.toLowerCase());
    if (!hasMe && currentUsername) {
      list.unshift({
        id: currentUserId || 'me',
        username: currentUsername,
        display_name: currentDisplayName || currentUsername,
        bmc_id: currentUsername.toLowerCase() === 'warung' ? 1 : undefined,
      });
    }

    const usedNums = new Set<string>();
    const result: Array<TelecomMemberItem & { ngopi_number: string; ngopi_email: string }> = [];

    // Sort so Founder ('warung') is first, then by bmc_id / username
    const sorted = [...list].sort((a, b) => {
      if (a.username?.toLowerCase() === 'warung') return -1;
      if (b.username?.toLowerCase() === 'warung') return 1;
      return (a.bmc_id || 999999) - (b.bmc_id || 999999);
    });

    sorted.forEach((m) => {
      let num = customNumbersMap[m.id] || m.ngopi_number || '';
      if (!num) {
        if (m.username?.toLowerCase() === 'warung' || m.bmc_id === 1) {
          num = '0';
        } else {
          let candidate = generateUglyDefaultNumber(m.username || m.id);
          let salt = 1;
          while (usedNums.has(candidate)) {
            candidate = generateUglyDefaultNumber(`${m.username}_${salt}`);
            salt += 1;
          }
          num = candidate;
        }
      }
      usedNums.add(num);
      result.push({
        ...m,
        ngopi_number: num,
        ngopi_email: customEmailsMap[m.id] || m.ngopi_email || formatNgopiEmail(m.username),
      });
    });

    return result;
  }, [members, currentUserId, currentUsername, currentDisplayName, customNumbersMap, customEmailsMap]);

  const loadTelecomData = useCallback(async () => {
    const uname = String(currentUsername || '').trim().toLowerCase();
    const founderFlag = uname === 'warung' || uname === 'founder' || uname === 'admin';
    setIsFounder(founderFlag);

    // Load local custom numbers fallback
    let localCustom: Record<string, string> = {};
    try {
      const raw =
        Platform.OS === 'web' && typeof localStorage !== 'undefined'
          ? localStorage.getItem(LOCAL_CUSTOM_NUMBERS_KEY)
          : await SecureStore.getItemAsync(LOCAL_CUSTOM_NUMBERS_KEY);
      if (raw) localCustom = JSON.parse(raw);
    } catch {}
    setCustomNumbersMap(localCustom);

    const meEntry = enrichedDirectory.find(
      (m) => m.id === currentUserId || m.username?.toLowerCase() === uname
    );
    const defaultNum = localCustom[currentUserId] || meEntry?.ngopi_number || (founderFlag ? '0' : '101');
    const defaultEmail = formatNgopiEmail(currentUsername || 'user');
    setMyNumber(defaultNum);
    setMyEmail(defaultEmail);

    // Load mails from local fallback first
    let storedMails: MailItem[] = [];
    try {
      const rawMails =
        Platform.OS === 'web' && typeof localStorage !== 'undefined'
          ? localStorage.getItem(LOCAL_MAILS_KEY)
          : await SecureStore.getItemAsync(LOCAL_MAILS_KEY);
      if (rawMails) storedMails = JSON.parse(rawMails);
    } catch {}

    const welcomeId = `welcome-${currentUserId || uname}`;
    if (!storedMails.some((m) => m.id === welcomeId)) {
      storedMails.unshift({
        id: welcomeId,
        from_user_id: 'founder-0',
        from_username: 'warung',
        from_display_name: 'Founder Ngopi (#0)',
        from_email: 'warung@ngopi.top',
        from_number: '0',
        to_user_id: currentUserId || uname,
        to_username: currentUsername,
        to_email: defaultEmail,
        to_number: defaultNum,
        subject: `Selamat Datang di Nomor Virtual #${defaultNum} & Email ${defaultEmail}! ☕`,
        body: `Halo ${currentDisplayName || currentUsername}!\n\nAkun Anda di ngopi.top kini resmi dilengkapi dengan Nomor HP Virtual & Akun Email:\n\n• Nomor HP Virtual Ngopi: ${defaultNum}\n• Alamat Email Resmi: ${defaultEmail} (alias: ${defaultNum}@ngopi.top)\n\nAturan Penomoran Eksklusif Ngopi:\n- Nomor 0 adalah Nomor Founder (@warung).\n- Nomor 1 s/d 100 dikunci khusus oleh Founder (VIP).\n- Nomor 101 ke atas bebas dipilih atau diganti sesuai keinginan Anda selama belum dipakai orang lain!\n\nSelamat menikmati komunikasi lengkap (Chat, Telepon Dialpad, HT Radio, & Email) dalam satu aplikasi!\n\nSalam hangat,\nFounder Ngopi (#0 • warung@ngopi.top)`,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }
    setMails(storedMails);

    // Try syncing with backend /api/telecom/me & /api/telecom/mail/inbox
    try {
      const token = await getToken();
      if (!token) return;
      const [meRes, inboxRes] = await Promise.all([
        axios.get(`${API_URL}/telecom/me`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/telecom/mail/inbox`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (meRes.data?.ngopi_number) {
        setMyNumber(String(meRes.data.ngopi_number));
        setMyEmail(String(meRes.data.ngopi_email || defaultEmail));
        setIsFounder(Boolean(meRes.data.is_founder || founderFlag));
      }
      if (Array.isArray(meRes.data?.locked_email_prefixes)) {
        setLockedEmailPrefixes(meRes.data.locked_email_prefixes);
      }
      if (meRes.data?.premium_config) {
        setRequirePaidCustomNumber(Boolean(meRes.data.premium_config.requirePaymentForCustomNumber));
        setRequirePaidCustomEmail(Boolean(meRes.data.premium_config.requirePaymentForCustomEmail));
      }
      if (Array.isArray(inboxRes.data?.mails) && inboxRes.data.mails.length > 0) {
        setMails(inboxRes.data.mails);
      }
    } catch {
      // Fallback already populated cleanly
    }
  }, [currentUserId, currentUsername, currentDisplayName, enrichedDirectory]);

  useEffect(() => {
    if (visible) {
      loadTelecomData();
    }
  }, [visible, loadTelecomData]);

  // Dialpad lookup
  const dialedMember = useMemo(() => {
    const clean = dialedInput.trim().replace(/^#/, '');
    if (!clean || clean.startsWith('*')) return null;
    return (
      enrichedDirectory.find(
        (m) =>
          m.ngopi_number === clean ||
          m.username?.toLowerCase() === clean.toLowerCase() ||
          m.ngopi_email?.toLowerCase() === clean.toLowerCase()
      ) || null
    );
  }, [dialedInput, enrichedDirectory]);

  const handleDialKeyPress = (key: string) => {
    setDialedInput((prev) => (prev.length < 15 ? prev + key : prev));
  };

  const handleDialAction = (mode: 'voice' | 'video' | 'chat' | 'mail') => {
    const code = dialedInput.trim();
    if (!code) {
      showNotice('Papan Telepon', 'Ketik Nomor Ngopi tujuan terlebih dahulu (contoh: 0 untuk Founder, atau 101, 102, dst).');
      return;
    }

    // Handle USSD codes (*888#, *112#, *0#)
    if (code === '*888#' || code === '*0#') {
      showNotice(
        '☕ Info Nomor & Pulsa Poin Ngopi',
        `• Nama: ${currentDisplayName || currentUsername}\n• Nomor HP Ngopi: ${myNumber}\n• Email Resmi: ${myEmail}\n• Alias Nomor: ${myNumber}@ngopi.top\n• Saldo Poin Kopi: ${userPoints} Poin\n• Status Jaringan: Aktif (Ngopi Telecom)`
      );
      return;
    }

    if (!dialedMember) {
      const numVal = Number(code);
      if (!Number.isNaN(numVal) && numVal >= 1 && numVal <= 100) {
        showNotice(
          '🔒 Nomor VIP Terkunci (1–100)',
          `Nomor ${code} adalah nomor VIP yang saat ini dikunci oleh Founder (#0) dan belum diaktifkan untuk pengguna.`
        );
      } else {
        showNotice(
          'Nomor Belum Terdaftar',
          `Nomor Ngopi "${code}" belum digunakan oleh siapa pun. Anda bisa mengklaim nomor ini di tab "Pilih Nomor Unik"!`
        );
      }
      return;
    }

    if (mode === 'mail') {
      setComposeTo(dialedMember.ngopi_email);
      setActiveTab('mail');
      setMailSubTab('compose');
      return;
    }

    onClose();
    const targetName = dialedMember.display_name || dialedMember.username;
    if (mode === 'chat') {
      router.push({ pathname: '/(main)/chat/[id]', params: { id: dialedMember.id, name: targetName } });
    } else if (mode === 'voice') {
      router.push({ pathname: '/(main)/call/[id]', params: { id: dialedMember.id, name: targetName, isVideo: 'false' } });
    } else if (mode === 'video') {
      router.push({ pathname: '/(main)/call/[id]', params: { id: dialedMember.id, name: targetName, isVideo: 'true' } });
    }
  };

  // Check & Claim Custom Number
  const validateAndCheckNumber = async (inputNum?: string) => {
    const raw = (inputNum ?? desiredNumber).trim().replace(/^#/, '');
    if (!/^\d+$/.test(raw)) {
      setAvailabilityStatus({
        checked: true,
        available: false,
        message: 'Masukkan angka saja tanpa huruf atau simbol (contoh: 105, 777, 8888).',
      });
      return false;
    }

    const normalized = raw.replace(/^0+/, '') || '0';
    const numericVal = Number(normalized);

    if (numericVal === 0 && !isFounder) {
      setAvailabilityStatus({
        checked: true,
        available: false,
        lockedVip: true,
        message: '🔒 Nomor 0 adalah nomor eksklusif Founder Ngopi.',
      });
      return false;
    }

    if (numericVal >= 1 && numericVal <= 100 && !isFounder) {
      setAvailabilityStatus({
        checked: true,
        available: false,
        lockedVip: true,
        message: '🔒 Nomor 1 sampai 100 dikunci khusus oleh Founder. Silakan pilih nomor mulai dari 101 ke atas!',
      });
      return false;
    }

    const takenBy = enrichedDirectory.find(
      (m) => m.ngopi_number === normalized && m.id !== currentUserId && m.username?.toLowerCase() !== currentUsername?.toLowerCase()
    );

    if (takenBy) {
      setAvailabilityStatus({
        checked: true,
        available: false,
        message: `❌ Nomor ${normalized} sudah dipakai oleh @${takenBy.username}. Coba angka unik lainnya!`,
      });
      return false;
    }

    setAvailabilityStatus({
      checked: true,
      available: true,
      message: `✅ Nomor ${normalized} tersedia dan belum dipakai siapa pun!`,
    });
    return true;
  };

  const handleClaimNumber = async () => {
    if (requirePaidCustomNumber && !isFounder) {
      showNotice(
        '💎 Fitur Premium Berbayar',
        'Ganti Nomor Cantik saat ini berstatus Fitur Premium Berbayar.\n\nNomor bawaan Anda (101+) sudah aktif secara gratis! Untuk mengganti ke Nomor Cantik atau Nomor VIP (1–100), silakan hubungi Founder (#0 • warung@ngopi.top).'
      );
      return;
    }
    const isOk = await validateAndCheckNumber();
    if (!isOk) return;

    const normalized = desiredNumber.trim().replace(/^#/, '').replace(/^0+/, '') || '0';
    setIsClaiming(true);
    try {
      const token = await getToken();
      if (token) {
        await axios
          .post(
            `${API_URL}/telecom/number/claim`,
            { number: normalized },
            { headers: { Authorization: `Bearer ${token}` } }
          )
          .catch(() => {});
      }

      const nextMap = { ...customNumbersMap, [currentUserId]: normalized };
      setCustomNumbersMap(nextMap);
      setMyNumber(normalized);
      const serialized = JSON.stringify(nextMap);
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_CUSTOM_NUMBERS_KEY, serialized);
      } else {
        await SecureStore.setItemAsync(LOCAL_CUSTOM_NUMBERS_KEY, serialized);
      }

      showNotice(
        '🎉 Nomor Ngopi Aktif!',
        `Selamat! Nomor HP Virtual Ngopi Anda sekarang adalah: ${normalized}\nAlias Email: ${normalized}@ngopi.top`
      );
      setDesiredNumber('');
      setAvailabilityStatus(null);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleFounderAssignVip = async () => {
    if (!isFounder) return;
    const cleanTarget = vipTargetUsername.trim().replace(/^@/, '');
    const cleanNum = vipNumberInput.trim().replace(/^#/, '').replace(/^0+/, '') || '0';

    if (!cleanTarget || !/^\d+$/.test(cleanNum)) {
      showNotice('Info', 'Masukkan username tujuan dan nomor VIP (1–100) yang ingin diberikan.');
      return;
    }

    const targetMember = enrichedDirectory.find(
      (m) => m.username?.toLowerCase() === cleanTarget.toLowerCase() || m.id === cleanTarget
    );
    if (!targetMember) {
      showNotice('User Tidak Ditemukan', `Username @${cleanTarget} tidak ditemukan di daftar anggota.`);
      return;
    }

    try {
      const token = await getToken();
      if (token) {
        await axios
          .post(
            `${API_URL}/telecom/number/assign-vip`,
            { target_username: cleanTarget, number: cleanNum },
            { headers: { Authorization: `Bearer ${token}` } }
          )
          .catch(() => {});
      }

      const nextMap = { ...customNumbersMap, [targetMember.id]: cleanNum };
      setCustomNumbersMap(nextMap);
      const serialized = JSON.stringify(nextMap);
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_CUSTOM_NUMBERS_KEY, serialized);
      } else {
        await SecureStore.setItemAsync(LOCAL_CUSTOM_NUMBERS_KEY, serialized);
      }

      showNotice(
        '👑 Nomor VIP Diberikan!',
        `Nomor eksklusif #${cleanNum} berhasil dibuka dan diberikan kepada @${targetMember.username}!`
      );
      setVipTargetUsername('');
      setVipNumberInput('');
    } catch (e: any) {
      showNotice('Gagal', e?.message || 'Gagal menetapkan nomor VIP.');
    }
  };

  // Check & Claim Custom Email (@ngopi.top)
  const validateAndCheckEmail = async (inputVal?: string) => {
    const cleanPrefix = (inputVal ?? desiredEmailPrefix)
      .trim()
      .toLowerCase()
      .replace(/^@/, '')
      .replace(/@ngopi\.top$/i, '');

    if (!cleanPrefix || cleanPrefix.length < 2 || cleanPrefix.length > 30 || !/^[a-z0-9._-]+$/.test(cleanPrefix)) {
      setEmailAvailabilityStatus({
        checked: true,
        available: false,
        message: 'Nama email harus 2–30 karakter (huruf kecil, angka, titik, atau garis bawah).',
      });
      return false;
    }

    const isNumeric0to100 = /^\d+$/.test(cleanPrefix) && Number(cleanPrefix) >= 0 && Number(cleanPrefix) <= 100;
    if (!isFounder && (lockedEmailPrefixes.includes(cleanPrefix) || isNumeric0to100)) {
      setEmailAvailabilityStatus({
        checked: true,
        available: false,
        message: `🔒 Alamat "${cleanPrefix}@ngopi.top" dikunci khusus oleh Founder Ngopi (#0).`,
      });
      return false;
    }

    const fullEmail = `${cleanPrefix}@ngopi.top`;
    const takenBy = enrichedDirectory.find(
      (m) =>
        (m.ngopi_email?.toLowerCase() === fullEmail || m.username?.toLowerCase() === cleanPrefix) &&
        m.id !== currentUserId &&
        m.username?.toLowerCase() !== currentUsername?.toLowerCase()
    );

    if (takenBy) {
      setEmailAvailabilityStatus({
        checked: true,
        available: false,
        message: `❌ Alamat ${fullEmail} sudah dimiliki oleh @${takenBy.username}.`,
      });
      return false;
    }

    setEmailAvailabilityStatus({
      checked: true,
      available: true,
      message: `✅ Alamat ${fullEmail} tersedia dan bisa digunakan!`,
    });
    return true;
  };

  const handleClaimCustomEmail = async () => {
    if (requirePaidCustomEmail && !isFounder) {
      showNotice(
        '💎 Fitur Premium Berbayar',
        'Klaim Nama Email Cantik @ngopi.top saat ini berstatus Fitur Premium Berbayar.\n\nSilakan hubungi Founder (#0 • warung@ngopi.top) untuk aktivasi nama email pilihan Anda!'
      );
      return;
    }
    const ok = await validateAndCheckEmail();
    if (!ok) return;

    const cleanPrefix = desiredEmailPrefix.trim().toLowerCase().replace(/^@/, '').replace(/@ngopi\.top$/i, '');
    const fullEmail = `${cleanPrefix}@ngopi.top`;
    setIsClaimingEmail(true);
    try {
      const token = await getToken();
      if (token) {
        const res = await axios
          .post(
            `${API_URL}/telecom/email/claim`,
            { email: cleanPrefix },
            { headers: { Authorization: `Bearer ${token}` } }
          )
          .catch((e) => e?.response);
        if (res?.status && res.status >= 400 && res?.data?.error) {
          showNotice('Gagal Mengklaim Email', res.data.error);
          return;
        }
      }

      const nextEmailMap = { ...customEmailsMap, [currentUserId]: fullEmail };
      setCustomEmailsMap(nextEmailMap);
      setMyEmail(fullEmail);
      showNotice('🎉 Email Resmi Diperbarui!', `Alamat email resmi Anda sekarang adalah:\n${fullEmail}`);
      setDesiredEmailPrefix('');
      setEmailAvailabilityStatus(null);
    } finally {
      setIsClaimingEmail(false);
    }
  };

  const handleFounderManageEmailLock = async (action: 'lock' | 'unlock_assign') => {
    if (!isFounder) return;
    const cleanPrefix = founderEmailInput.trim().toLowerCase().replace(/^@/, '').replace(/@ngopi\.top$/i, '');
    const cleanTarget = founderEmailTargetUser.trim().replace(/^@/, '');

    if (!cleanPrefix) {
      showNotice('Info', 'Masukkan nama email @ngopi.top yang ingin dikunci atau diberikan (contoh: ceo, direktur, official).');
      return;
    }
    if (action === 'unlock_assign' && !cleanTarget) {
      showNotice('Info', 'Masukkan username tujuan yang akan menerima email khusus tersebut.');
      return;
    }

    try {
      const token = await getToken();
      if (token) {
        await axios
          .post(
            `${API_URL}/telecom/email/manage-lock`,
            { action, email_prefix: cleanPrefix, target_username: cleanTarget },
            { headers: { Authorization: `Bearer ${token}` } }
          )
          .catch(() => {});
      }

      if (action === 'lock') {
        if (!lockedEmailPrefixes.includes(cleanPrefix)) {
          setLockedEmailPrefixes((prev) => [...prev, cleanPrefix]);
        }
        showNotice('🔒 Email Dikunci!', `Alamat "${cleanPrefix}@ngopi.top" berhasil ditambahkan ke daftar email terkunci Founder.`);
      } else {
        showNotice(
          '👑 Email VIP Diberikan!',
          `Alamat eksklusif "${cleanPrefix}@ngopi.top" berhasil dibuka dan diberikan kepada @${cleanTarget}!`
        );
      }
      setFounderEmailInput('');
      setFounderEmailTargetUser('');
    } catch (e: any) {
      showNotice('Gagal', e?.message || 'Gagal memproses kunci email.');
    }
  };

  const handleTogglePremiumMode = async (field: 'number' | 'email') => {
    if (!isFounder) return;
    const nextNum = field === 'number' ? !requirePaidCustomNumber : requirePaidCustomNumber;
    const nextMail = field === 'email' ? !requirePaidCustomEmail : requirePaidCustomEmail;
    setRequirePaidCustomNumber(nextNum);
    setRequirePaidCustomEmail(nextMail);

    try {
      const token = await getToken();
      if (token) {
        await axios
          .post(
            `${API_URL}/telecom/premium-config`,
            {
              requirePaymentForCustomNumber: nextNum,
              requirePaymentForCustomEmail: nextMail,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          )
          .catch(() => {});
      }
      showNotice(
        '💎 Mode Fitur Premium Diperbarui',
        `• Ganti Nomor Cantik: ${nextNum ? 'BERBAYAR (Premium)' : 'GRATIS (Uji Coba)'}\n• Custom Email @ngopi.top: ${nextMail ? 'BERBAYAR (Premium)' : 'GRATIS (Uji Coba)'}`
      );
    } catch {}
  };

  // Send Email (@ngopi.top)
  const handleSendMail = async () => {
    const rawTo = composeTo.trim();
    const cleanSubject = composeSubject.trim() || '(Tanpa Subjek)';
    const cleanBody = composeBody.trim();

    if (!rawTo) {
      showNotice('Alamat Tujuan Kosong', 'Masukkan alamat email tujuan (contoh: warung@ngopi.top) atau Nomor Ngopi (contoh: 0 atau 101).');
      return;
    }
    if (!cleanBody) {
      showNotice('Isi Email Kosong', 'Tulis isi surat elektronik Anda terlebih dahulu.');
      return;
    }

    const cleanKey = rawTo.replace(/^#/, '').replace(/^@/, '').replace(/@ngopi\.top$/i, '').toLowerCase();
    const recipient = enrichedDirectory.find(
      (m) =>
        m.ngopi_email.toLowerCase() === rawTo.toLowerCase() ||
        m.ngopi_number === cleanKey ||
        m.username?.toLowerCase() === cleanKey
    );

    if (!recipient && !rawTo.includes('@')) {
      showNotice('Tujuan Tidak Ditemukan', `Pengguna atau nomor "${rawTo}" belum ditemukan di direktori Ngopi.`);
      return;
    }

    setIsSendingMail(true);
    try {
      const token = await getToken();
      let createdMail: MailItem | null = null;
      if (token) {
        const res = await axios
          .post(
            `${API_URL}/telecom/mail/send`,
            { to: rawTo, subject: cleanSubject, body: cleanBody },
            { headers: { Authorization: `Bearer ${token}` } }
          )
          .catch(() => null);
        if (res?.data?.mail) {
          createdMail = res.data.mail;
        }
      }

      if (!createdMail) {
        createdMail = {
          id: `mail-${Date.now()}`,
          from_user_id: currentUserId || 'me',
          from_username: currentUsername,
          from_display_name: currentDisplayName || currentUsername,
          from_email: myEmail,
          from_number: myNumber,
          to_user_id: recipient?.id || rawTo,
          to_username: recipient?.username || cleanKey,
          to_email: recipient?.ngopi_email || (rawTo.includes('@') ? rawTo : `${cleanKey}@ngopi.top`),
          to_number: recipient?.ngopi_number || cleanKey,
          subject: cleanSubject,
          body: cleanBody,
          is_read: false,
          created_at: new Date().toISOString(),
        };
      }

      const nextMails = [createdMail, ...mails];
      setMails(nextMails);
      const serialized = JSON.stringify(nextMails.slice(0, 200));
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCAL_MAILS_KEY, serialized);
      } else {
        await SecureStore.setItemAsync(LOCAL_MAILS_KEY, serialized);
      }

      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      setMailSubTab('sent');
      showNotice('📧 Email Terkirim!', `Surat elektronik berhasil dikirim ke ${createdMail.to_email}.`);
    } finally {
      setIsSendingMail(false);
    }
  };

  const inboxMails = useMemo(
    () =>
      mails.filter(
        (m) =>
          m.to_user_id === currentUserId ||
          m.to_username?.toLowerCase() === currentUsername?.toLowerCase() ||
          m.to_email?.toLowerCase() === myEmail.toLowerCase() ||
          m.to_number === myNumber
      ),
    [mails, currentUserId, currentUsername, myEmail, myNumber]
  );

  const sentMails = useMemo(
    () =>
      mails.filter(
        (m) =>
          m.from_user_id === currentUserId ||
          m.from_username?.toLowerCase() === currentUsername?.toLowerCase() ||
          m.from_email?.toLowerCase() === myEmail.toLowerCase()
      ),
    [mails, currentUserId, currentUsername, myEmail]
  );

  const unreadInboxCount = useMemo(() => inboxMails.filter((m) => !m.is_read).length, [inboxMails]);

  const suggestedNumbers = useMemo(() => {
    const candidates = ['101', '108', '123', '212', '333', '555', '777', '888', '999', '1945', '2026', '8888'];
    const taken = new Set(enrichedDirectory.map((m) => m.ngopi_number));
    return candidates.filter((c) => !taken.has(c)).slice(0, 6);
  }, [enrichedDirectory]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="call" size={20} color="#10b981" />
                <Text style={styles.headerTitle}>Nomor HP & Email Ngopi</Text>
              </View>
              <Text style={styles.headerSub}>Identitas Telekomunikasi & Surat Elektronik Resmi ngopi.top</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={coffee.text} />
            </TouchableOpacity>
          </View>

          {/* Identity Banner */}
          <View style={styles.identityBanner}>
            <View style={styles.identityCol}>
              <Text style={styles.identityLabel}>NOMOR NGOPI ANDA</Text>
              <View style={styles.identityValRow}>
                <Text style={styles.identityNumber}>
                  {myNumber} {myNumber === '0' ? '👑 (Founder)' : Number(myNumber) <= 100 ? '⭐ (VIP)' : ''}
                </Text>
                <TouchableOpacity onPress={() => copyText(myNumber, 'Nomor Ngopi')} style={styles.copyMiniBtn}>
                  <Ionicons name="copy-outline" size={14} color={coffee.accent} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.identityDivider} />

            <View style={[styles.identityCol, { flex: 1.3 }]}>
              <Text style={styles.identityLabel}>AKUN EMAIL RESMI</Text>
              <View style={styles.identityValRow}>
                <Text style={styles.identityEmail} numberOfLines={1}>
                  {myEmail}
                </Text>
                <TouchableOpacity onPress={() => copyText(myEmail, 'Email Ngopi')} style={styles.copyMiniBtn}>
                  <Ionicons name="copy-outline" size={14} color={coffee.accent} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Main Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'dialpad' && styles.tabBtnActive]}
              onPress={() => setActiveTab('dialpad')}
            >
              <Ionicons name="keypad" size={16} color={activeTab === 'dialpad' ? '#171411' : coffee.accent} />
              <Text style={[styles.tabBtnText, activeTab === 'dialpad' && styles.tabBtnTextActive]}>Dialpad</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'custom_number' && styles.tabBtnActive]}
              onPress={() => setActiveTab('custom_number')}
            >
              <Ionicons name="sparkles" size={16} color={activeTab === 'custom_number' ? '#171411' : coffee.accent} />
              <Text style={[styles.tabBtnText, activeTab === 'custom_number' && styles.tabBtnTextActive]}>
                Nomor Unik
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'mail' && styles.tabBtnActive]}
              onPress={() => setActiveTab('mail')}
            >
              <Ionicons name="mail" size={16} color={activeTab === 'mail' ? '#171411' : coffee.accent} />
              <Text style={[styles.tabBtnText, activeTab === 'mail' && styles.tabBtnTextActive]}>
                Email {unreadInboxCount > 0 ? `(${unreadInboxCount})` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            {/* TAB 1: DIALPAD TELEPON */}
            {activeTab === 'dialpad' && (
              <View>
                <View style={styles.dialDisplayBox}>
                  <TextInput
                    style={styles.dialDisplayInput}
                    value={dialedInput}
                    onChangeText={setDialedInput}
                    placeholder="Ketik nomor (misal: 0 atau 101)"
                    placeholderTextColor={coffee.muted}
                  />
                  {dialedInput.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setDialedInput((prev) => prev.slice(0, -1))}
                      onLongPress={() => setDialedInput('')}
                      style={styles.backspaceBtn}
                    >
                      <Ionicons name="backspace-outline" size={22} color={coffee.accent} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Live Matched User Preview */}
                {dialedMember ? (
                  <View style={styles.matchedUserCard}>
                    <View style={styles.matchedAvatar}>
                      <Text style={styles.matchedAvatarText}>
                        {(dialedMember.display_name || dialedMember.username || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.matchedName}>
                        {dialedMember.display_name || dialedMember.username}{' '}
                        {dialedMember.ngopi_number === '0' ? '👑' : ''}
                      </Text>
                      <Text style={styles.matchedMeta}>
                        Nomor: {dialedMember.ngopi_number} • {dialedMember.ngopi_email}
                      </Text>
                    </View>
                  </View>
                ) : dialedInput.trim().length > 0 ? (
                  <Text style={styles.dialHintText}>
                    {dialedInput.trim() === '*888#'
                      ? '✨ Tekan tombol Telepon untuk cek info Nomor & Saldo Poin Kopi'
                      : Number(dialedInput) >= 1 && Number(dialedInput) <= 100
                      ? '🔒 Nomor 1–100 adalah Nomor VIP yang dikunci oleh Founder (#0)'
                      : 'Nomor belum terdaftar — bisa Anda klaim di tab Nomor Unik!'}
                  </Text>
                ) : (
                  <Text style={styles.dialHintText}>
                    Tips: Ketik <Text style={{ color: coffee.accent, fontWeight: '700' }}>0</Text> untuk menghubungi Founder,{' '}
                    <Text style={{ color: coffee.accent, fontWeight: '700' }}>101+</Text> untuk member, atau{' '}
                    <Text style={{ color: coffee.accent, fontWeight: '700' }}>*888#</Text> untuk cek pulsa poin.
                  </Text>
                )}

                {/* Keypad Grid */}
                <View style={styles.keypadGrid}>
                  {[
                    { k: '1', sub: 'VIP' },
                    { k: '2', sub: 'ABC' },
                    { k: '3', sub: 'DEF' },
                    { k: '4', sub: 'GHI' },
                    { k: '5', sub: 'JKL' },
                    { k: '6', sub: 'MNO' },
                    { k: '7', sub: 'PQRS' },
                    { k: '8', sub: 'TUV' },
                    { k: '9', sub: 'WXYZ' },
                    { k: '*', sub: 'USSD' },
                    { k: '0', sub: 'FOUNDER' },
                    { k: '#', sub: 'ID' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.k}
                      style={styles.keypadButton}
                      onPress={() => handleDialKeyPress(item.k)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.keypadDigit}>{item.k}</Text>
                      <Text style={styles.keypadSub}>{item.sub}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Action Buttons */}
                <View style={styles.dialActionsRow}>
                  <TouchableOpacity
                    style={[styles.dialActionBtn, { backgroundColor: '#10b981' }]}
                    onPress={() => handleDialAction('voice')}
                  >
                    <Ionicons name="call" size={20} color="#fff" />
                    <Text style={styles.dialActionText}>Telepon</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dialActionBtn, { backgroundColor: '#3b82f6' }]}
                    onPress={() => handleDialAction('video')}
                  >
                    <Ionicons name="videocam" size={20} color="#fff" />
                    <Text style={styles.dialActionText}>Video</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dialActionBtn, { backgroundColor: coffee.button }]}
                    onPress={() => handleDialAction('chat')}
                  >
                    <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                    <Text style={styles.dialActionText}>Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.dialActionBtn, { backgroundColor: '#8b5cf6' }]}
                    onPress={() => handleDialAction('mail')}
                  >
                    <Ionicons name="mail" size={20} color="#fff" />
                    <Text style={styles.dialActionText}>Email</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* TAB 2: PILIH NOMOR UNIK & PANEL FOUNDER */}
            {activeTab === 'custom_number' && (
              <View>
                <View style={styles.rulesCard}>
                  <Text style={styles.rulesTitle}>📌 Skema Nomor Acak Bawaan & Upgrade Nomor/Email Cantik</Text>
                  <Text style={styles.ruleItem}>
                    • <Text style={{ fontWeight: '800', color: '#38bdf8' }}>Bawaan Otomatis (Nomor & Email Acak)</Text>: Seluruh user lama & baru otomatis mendapat <Text style={{ fontWeight: '700' }}>Nomor 10-Digit Acak</Text> (misal <Text style={{ fontWeight: '700' }}>7492638517</Text>) & <Text style={{ fontWeight: '700' }}>Email Konsonan Acak</Text> (misal <Text style={{ fontWeight: '700' }}>xkqzvtrmpbn@ngopi.top</Text>) yang susah dihafal.
                  </Text>
                  <Text style={styles.ruleItem}>
                    • <Text style={{ fontWeight: '800', color: '#FFD700' }}>Nomor 0 & Email Resmi</Text>: Nomor <Text style={{ fontWeight: '700' }}>0</Text> serta nama email utama (<Text style={{ fontWeight: '700' }}>founder, warung, admin, official, cs, ceo, owner, warkop, ngopi, bmc</Text>) dikunci eksklusif untuk Founder.
                  </Text>
                  <Text style={styles.ruleItem}>
                    • <Text style={{ fontWeight: '800', color: '#10b981' }}>Upgrade ke Nomor & Email Cantik (💎 Berbayar)</Text>: Untuk mengganti nomor/email acak ke <Text style={{ fontWeight: '700' }}>Nomor Cantik Mudah Dihafal (101+)</Text> atau <Text style={{ fontWeight: '700' }}>Email Sesuai Nama/Brand (@ngopi.top)</Text>, silakan pilih paket di bawah!
                  </Text>
                </View>

                {/* DAFTAR HARGA PAKET UPGRADE PREMIUM (RUPIAH) */}
                <View style={[styles.rulesCard, { borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.09)' }]}>
                  <Text style={[styles.rulesTitle, { color: '#fbbf24' }]}>💎 Daftar Harga Upgrade Nomor & Email Cantik (Sekali Bayar Aktif Selamanya)</Text>
                  <Text style={styles.ruleItem}>• <Text style={{ fontWeight: '800', color: '#fff' }}>Paket Email Cantik Sesuai Nama</Text> (<Text style={{ color: '#fbbf24' }}>nama@ngopi.top</Text>): <Text style={{ fontWeight: '900', color: '#10b981' }}>Rp 25.000</Text></Text>
                  <Text style={styles.ruleItem}>• <Text style={{ fontWeight: '800', color: '#fff' }}>Paket Nomor Cantik Reguler</Text> (4–6 Angka, misal <Text style={{ color: '#fbbf24' }}>1945, 2026</Text>): <Text style={{ fontWeight: '900', color: '#10b981' }}>Rp 35.000</Text></Text>
                  <Text style={styles.ruleItem}>• 🔥 <Text style={{ fontWeight: '900', color: '#FFD700' }}>PAKET BUNDLING HEMAT (Nomor Cantik + Email Cantik)</Text>: <Text style={{ fontWeight: '900', color: '#FFD700' }}>Rp 49.000</Text> <Text style={{ fontSize: 10, color: '#9ca3af' }}>(Hemat Rp 11.000 - Paling Laris!)</Text></Text>
                  <Text style={styles.ruleItem}>• <Text style={{ fontWeight: '800', color: '#fff' }}>Paket Nomor Spesial 3 Angka / Kembar</Text> (<Text style={{ color: '#fbbf24' }}>101–999, 777, 888</Text>): <Text style={{ fontWeight: '900', color: '#10b981' }}>Rp 75.000</Text></Text>
                  <Text style={styles.ruleItem}>• 👑 <Text style={{ fontWeight: '800', color: '#f97316' }}>Nomor Sultan VIP Terkunci (1 s/d 100)</Text>: <Text style={{ fontWeight: '900', color: '#f97316' }}>Rp 250.000</Text></Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>1. Pilih / Ganti Nomor Unik (101+)</Text>
                  <View style={{ backgroundColor: requirePaidCustomNumber ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: requirePaidCustomNumber ? '#f59e0b' : '#10b981' }}>
                    <Text style={{ color: requirePaidCustomNumber ? '#fbbf24' : '#10b981', fontSize: 10, fontWeight: '800' }}>
                      {requirePaidCustomNumber ? '💎 PREMIUM BERBAYAR' : '🎁 PROMO UJI COBA'}
                    </Text>
                  </View>
                </View>
                <View style={styles.claimInputRow}>
                  <TextInput
                    style={styles.claimInput}
                    value={desiredNumber}
                    onChangeText={(val) => {
                      setDesiredNumber(val.replace(/[^0-9]/g, ''));
                      setAvailabilityStatus(null);
                    }}
                    keyboardType="numeric"
                    placeholder="Ketik angka unik (misal: 777 atau 1945)"
                    placeholderTextColor={coffee.muted}
                    maxLength={12}
                  />
                  <TouchableOpacity style={styles.checkBtn} onPress={() => validateAndCheckNumber()}>
                    <Text style={styles.checkBtnText}>Cek Nomor</Text>
                  </TouchableOpacity>
                </View>

                {availabilityStatus && (
                  <View
                    style={[
                      styles.statusBox,
                      {
                        borderColor: availabilityStatus.available ? '#10b981' : '#ef4444',
                        backgroundColor: availabilityStatus.available
                          ? 'rgba(16, 185, 129, 0.12)'
                          : 'rgba(239, 68, 68, 0.12)',
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: availabilityStatus.available ? '#10b981' : '#fca5a5',
                        fontSize: 13,
                        fontWeight: '700',
                      }}
                    >
                      {availabilityStatus.message}
                    </Text>
                  </View>
                )}

                {suggestedNumbers.length > 0 && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.subHintLabel}>Rekomendasi Nomor Cantik yang Masih Kosong:</Text>
                    <View style={styles.suggestionChipsRow}>
                      {suggestedNumbers.map((num) => (
                        <TouchableOpacity
                          key={num}
                          style={styles.suggestionChip}
                          onPress={() => {
                            setDesiredNumber(num);
                            validateAndCheckNumber(num);
                          }}
                        >
                          <Text style={styles.suggestionChipText}>{num}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryClaimBtn, (!desiredNumber.trim() || isClaiming) && { opacity: 0.6 }]}
                  onPress={handleClaimNumber}
                  disabled={!desiredNumber.trim() || isClaiming}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#171411" />
                  <Text style={styles.primaryClaimBtnText}>
                    {isClaiming ? 'Menyimpan Nomor...' : 'Aktifkan Nomor Pilihan Saya'}
                  </Text>
                </TouchableOpacity>

                {/* SECTION 2: CUSTOM EMAIL @NGOPI.TOP */}
                <View style={{ marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: coffee.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>2. Klaim Nama Email Cantik @ngopi.top</Text>
                    <View style={{ backgroundColor: requirePaidCustomEmail ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: requirePaidCustomEmail ? '#f59e0b' : '#10b981' }}>
                      <Text style={{ color: requirePaidCustomEmail ? '#fbbf24' : '#10b981', fontSize: 10, fontWeight: '800' }}>
                        {requirePaidCustomEmail ? '💎 PREMIUM BERBAYAR' : '🎁 PROMO UJI COBA'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.claimInputRow}>
                    <TextInput
                      style={styles.claimInput}
                      value={desiredEmailPrefix}
                      onChangeText={(val) => {
                        setDesiredEmailPrefix(val.toLowerCase().replace(/[^a-z0-9._@-]/g, ''));
                        setEmailAvailabilityStatus(null);
                      }}
                      autoCapitalize="none"
                      placeholder="Ketik nama email (misal: kopi.sultan)"
                      placeholderTextColor={coffee.muted}
                      maxLength={30}
                    />
                    <TouchableOpacity style={styles.checkBtn} onPress={() => validateAndCheckEmail()}>
                      <Text style={styles.checkBtnText}>Cek Email</Text>
                    </TouchableOpacity>
                  </View>

                  {emailAvailabilityStatus && (
                    <View
                      style={[
                        styles.statusBox,
                        {
                          borderColor: emailAvailabilityStatus.available ? '#10b981' : '#ef4444',
                          backgroundColor: emailAvailabilityStatus.available
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'rgba(239, 68, 68, 0.12)',
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: emailAvailabilityStatus.available ? '#10b981' : '#fca5a5',
                          fontSize: 13,
                          fontWeight: '700',
                        }}
                      >
                        {emailAvailabilityStatus.message}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.primaryClaimBtn, (!desiredEmailPrefix.trim() || isClaimingEmail) && { opacity: 0.6 }]}
                    onPress={handleClaimCustomEmail}
                    disabled={!desiredEmailPrefix.trim() || isClaimingEmail}
                  >
                    <Ionicons name="mail" size={18} color="#171411" />
                    <Text style={styles.primaryClaimBtnText}>
                      {isClaimingEmail ? 'Menyimpan Email...' : 'Aktifkan Email @ngopi.top Pilihan Saya'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* FOUNDER EXCLUSIVE VIP UNLOCK PANEL (1..100 & LOCKED EMAILS & PREMIUM SWITCH) */}
                {isFounder && (
                  <View style={styles.founderPanel}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <Text style={{ fontSize: 16 }}>👑</Text>
                      <Text style={styles.founderPanelTitle}>Panel Kendali Founder (#0)</Text>
                    </View>
                    <Text style={styles.founderPanelDesc}>
                      Sebagai pemilik Nomor 0 (Founder), Anda memegang kunci eksklusif Nomor VIP (1–100), Kunci Nama Email @ngopi.top, serta Sakelar Fitur Premium Berbayar.
                    </Text>

                    {/* 1. Buka Kunci Nomor VIP 1-100 */}
                    <Text style={[styles.sectionLabel, { marginTop: 12, marginBottom: 4, color: '#FFD700' }]}>
                      A. Buka & Berikan Nomor VIP (1–100) ke Member
                    </Text>
                    <TextInput
                      style={[styles.claimInput, { marginTop: 4 }]}
                      value={vipTargetUsername}
                      onChangeText={setVipTargetUsername}
                      placeholder="Username penerima (contoh: abah)"
                      placeholderTextColor={coffee.muted}
                    />
                    <View style={[styles.claimInputRow, { marginTop: 8 }]}>
                      <TextInput
                        style={styles.claimInput}
                        value={vipNumberInput}
                        onChangeText={(v) => setVipNumberInput(v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder="Nomor VIP (1 - 100)"
                        placeholderTextColor={coffee.muted}
                      />
                      <TouchableOpacity style={[styles.checkBtn, { backgroundColor: '#FFD700' }]} onPress={handleFounderAssignVip}>
                        <Text style={[styles.checkBtnText, { color: '#171411' }]}>Berikan VIP</Text>
                      </TouchableOpacity>
                    </View>

                    {/* 2. Kunci / Berikan Nama Email @ngopi.top */}
                    <Text style={[styles.sectionLabel, { marginTop: 16, marginBottom: 4, color: '#FFD700' }]}>
                      B. Kunci / Berikan Nama Email @ngopi.top
                    </Text>
                    <Text style={{ color: coffee.secondary, fontSize: 11, marginBottom: 6 }}>
                      Terkunci saat ini: {lockedEmailPrefixes.slice(0, 14).join(', ')}... (+{Math.max(0, lockedEmailPrefixes.length - 14)} lainnya)
                    </Text>
                    <TextInput
                      style={styles.claimInput}
                      value={founderEmailInput}
                      onChangeText={setFounderEmailInput}
                      placeholder="Nama email @ngopi.top (contoh: direktur, sultan)"
                      placeholderTextColor={coffee.muted}
                      autoCapitalize="none"
                    />
                    <TextInput
                      style={[styles.claimInput, { marginTop: 8 }]}
                      value={founderEmailTargetUser}
                      onChangeText={setFounderEmailTargetUser}
                      placeholder="Username penerima (kosongkan jika hanya ingin mengunci)"
                      placeholderTextColor={coffee.muted}
                      autoCapitalize="none"
                    />
                    <View style={[styles.claimInputRow, { marginTop: 8 }]}>
                      <TouchableOpacity
                        style={[styles.checkBtn, { flex: 1, paddingVertical: 10, backgroundColor: '#ef4444' }]}
                        onPress={() => handleFounderManageEmailLock('lock')}
                      >
                        <Text style={[styles.checkBtnText, { color: '#fff' }]}>🔒 Kunci Nama Email</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.checkBtn, { flex: 1, paddingVertical: 10, backgroundColor: '#10b981' }]}
                        onPress={() => handleFounderManageEmailLock('unlock_assign')}
                      >
                        <Text style={[styles.checkBtnText, { color: '#171411' }]}>👑 Berikan ke User</Text>
                      </TouchableOpacity>
                    </View>

                    {/* 3. Sakelar Fitur Premium Berbayar */}
                    <Text style={[styles.sectionLabel, { marginTop: 16, marginBottom: 6, color: '#FFD700' }]}>
                      C. Sakelar Mode Fitur Premium (Berbayar)
                    </Text>
                    <View style={[styles.claimInputRow, { gap: 8 }]}>
                      <TouchableOpacity
                        style={[
                          styles.checkBtn,
                          {
                            flex: 1,
                            paddingVertical: 10,
                            backgroundColor: requirePaidCustomNumber ? '#f59e0b' : coffee.surface,
                            borderWidth: 1,
                            borderColor: '#f59e0b',
                          },
                        ]}
                        onPress={() => handleTogglePremiumMode('number')}
                      >
                        <Text style={{ color: requirePaidCustomNumber ? '#171411' : '#fbbf24', fontSize: 11, fontWeight: '800', textAlign: 'center' }}>
                          Nomor Cantik: {requirePaidCustomNumber ? '💎 BERBAYAR' : '🎁 GRATIS'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.checkBtn,
                          {
                            flex: 1,
                            paddingVertical: 10,
                            backgroundColor: requirePaidCustomEmail ? '#f59e0b' : coffee.surface,
                            borderWidth: 1,
                            borderColor: '#f59e0b',
                          },
                        ]}
                        onPress={() => handleTogglePremiumMode('email')}
                      >
                        <Text style={{ color: requirePaidCustomEmail ? '#171411' : '#fbbf24', fontSize: 11, fontWeight: '800', textAlign: 'center' }}>
                          Custom Email: {requirePaidCustomEmail ? '💎 BERBAYAR' : '🎁 GRATIS'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* TAB 3: EMAIL @NGOPI.TOP */}
            {activeTab === 'mail' && (
              <View>
                <View style={styles.mailSubNav}>
                  <TouchableOpacity
                    style={[styles.mailSubBtn, mailSubTab === 'inbox' && styles.mailSubBtnActive]}
                    onPress={() => {
                      setSelectedMail(null);
                      setMailSubTab('inbox');
                    }}
                  >
                    <Ionicons name="mail-unread-outline" size={15} color={mailSubTab === 'inbox' ? coffee.accent : coffee.secondary} />
                    <Text style={[styles.mailSubText, mailSubTab === 'inbox' && styles.mailSubTextActive]}>
                      Kotak Masuk ({inboxMails.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.mailSubBtn, mailSubTab === 'sent' && styles.mailSubBtnActive]}
                    onPress={() => {
                      setSelectedMail(null);
                      setMailSubTab('sent');
                    }}
                  >
                    <Ionicons name="paper-plane-outline" size={15} color={mailSubTab === 'sent' ? coffee.accent : coffee.secondary} />
                    <Text style={[styles.mailSubText, mailSubTab === 'sent' && styles.mailSubTextActive]}>
                      Terkirim ({sentMails.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.mailSubBtn, mailSubTab === 'compose' && styles.mailSubBtnActive]}
                    onPress={() => {
                      setSelectedMail(null);
                      setMailSubTab('compose');
                    }}
                  >
                    <Ionicons name="create-outline" size={15} color={mailSubTab === 'compose' ? coffee.accent : coffee.secondary} />
                    <Text style={[styles.mailSubText, mailSubTab === 'compose' && styles.mailSubTextActive]}>
                      + Tulis Email
                    </Text>
                  </TouchableOpacity>
                </View>

                {selectedMail ? (
                  <View style={styles.mailDetailCard}>
                    <TouchableOpacity style={styles.backToInboxBtn} onPress={() => setSelectedMail(null)}>
                      <Ionicons name="arrow-back" size={16} color={coffee.accent} />
                      <Text style={{ color: coffee.accent, fontWeight: '700', fontSize: 13 }}>Kembali ke Daftar Email</Text>
                    </TouchableOpacity>

                    <Text style={styles.mailDetailSubject}>{selectedMail.subject}</Text>
                    <View style={styles.mailDetailMetaBox}>
                      <Text style={styles.mailDetailMeta}>
                        Dari: <Text style={{ color: coffee.text, fontWeight: '700' }}>{selectedMail.from_display_name}</Text> ({selectedMail.from_email} • Nomor #{selectedMail.from_number})
                      </Text>
                      <Text style={styles.mailDetailMeta}>
                        Kepada: {selectedMail.to_email} (Nomor #{selectedMail.to_number})
                      </Text>
                      <Text style={styles.mailDetailMeta}>
                        Waktu: {new Date(selectedMail.created_at).toLocaleString('id-ID')}
                      </Text>
                    </View>

                    <Text style={styles.mailDetailBody}>{selectedMail.body}</Text>

                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                      <TouchableOpacity
                        style={styles.replyMailBtn}
                        onPress={() => {
                          setComposeTo(selectedMail.from_email);
                          setComposeSubject(
                            selectedMail.subject.startsWith('Re:') ? selectedMail.subject : `Re: ${selectedMail.subject}`
                          );
                          setSelectedMail(null);
                          setMailSubTab('compose');
                        }}
                      >
                        <Ionicons name="arrow-undo" size={16} color="#171411" />
                        <Text style={styles.replyMailBtnText}>Balas Email</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : mailSubTab === 'compose' ? (
                  <View style={styles.composeBox}>
                    <Text style={styles.inputLabel}>Dari:</Text>
                    <View style={styles.readOnlyField}>
                      <Text style={{ color: coffee.secondary, fontSize: 13 }}>
                        {myEmail} (Nomor Ngopi #{myNumber})
                      </Text>
                    </View>

                    <Text style={styles.inputLabel}>Kepada (Email @ngopi.top atau Nomor Ngopi):</Text>
                    <TextInput
                      style={styles.claimInput}
                      value={composeTo}
                      onChangeText={setComposeTo}
                      placeholder="Contoh: warung@ngopi.top atau ketik 0 / 101"
                      placeholderTextColor={coffee.muted}
                      autoCapitalize="none"
                    />

                    {/* Quick recipient suggestions */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                      {enrichedDirectory.slice(0, 12).map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          style={styles.recipientChip}
                          onPress={() => setComposeTo(m.ngopi_email)}
                        >
                          <Text style={styles.recipientChipText}>
                            #{m.ngopi_number} • {m.ngopi_email}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={styles.inputLabel}>Subjek Surat:</Text>
                    <TextInput
                      style={styles.claimInput}
                      value={composeSubject}
                      onChangeText={setComposeSubject}
                      placeholder="Judul / Subjek Email..."
                      placeholderTextColor={coffee.muted}
                    />

                    <Text style={[styles.inputLabel, { marginTop: 10 }]}>Isi Surat Elektronik:</Text>
                    <TextInput
                      style={[styles.claimInput, { minHeight: 120, textAlignVertical: 'top', paddingTop: 10 }]}
                      value={composeBody}
                      onChangeText={setComposeBody}
                      placeholder="Tulis isi email Anda di sini..."
                      placeholderTextColor={coffee.muted}
                      multiline
                    />

                    <TouchableOpacity
                      style={[styles.primaryClaimBtn, isSendingMail && { opacity: 0.6 }]}
                      onPress={handleSendMail}
                      disabled={isSendingMail}
                    >
                      <Ionicons name="send" size={16} color="#171411" />
                      <Text style={styles.primaryClaimBtnText}>
                        {isSendingMail ? 'Mengirim Email...' : 'Kirim Email Sekarang'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    {loadingMail ? (
                      <ActivityIndicator color={coffee.accent} style={{ marginVertical: 24 }} />
                    ) : (mailSubTab === 'inbox' ? inboxMails : sentMails).length === 0 ? (
                      <View style={styles.emptyMailBox}>
                        <Ionicons name="mail-open-outline" size={38} color={coffee.muted} />
                        <Text style={styles.emptyMailText}>
                          {mailSubTab === 'inbox' ? 'Belum ada email masuk.' : 'Belum ada email terkirim.'}
                        </Text>
                      </View>
                    ) : (
                      (mailSubTab === 'inbox' ? inboxMails : sentMails).map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={[styles.mailRow, !item.is_read && mailSubTab === 'inbox' && styles.mailRowUnread]}
                          onPress={() => {
                            item.is_read = true;
                            setSelectedMail({ ...item, is_read: true });
                          }}
                        >
                          <View style={styles.mailRowHeader}>
                            <Text style={styles.mailRowSender} numberOfLines={1}>
                              {mailSubTab === 'inbox'
                                ? `${item.from_display_name} (${item.from_email})`
                                : `Ke: ${item.to_email}`}
                            </Text>
                            <Text style={styles.mailRowTime}>
                              {new Date(item.created_at).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </Text>
                          </View>
                          <Text style={styles.mailRowSubject} numberOfLines={1}>
                            {item.subject}
                          </Text>
                          <Text style={styles.mailRowPreview} numberOfLines={2}>
                            {item.body}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    height: '88%',
    maxHeight: 740,
    backgroundColor: '#1b1410',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: coffee.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    backgroundColor: '#231a14',
  },
  headerTitle: {
    color: coffee.text,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSub: {
    color: coffee.secondary,
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: coffee.surface,
  },
  identityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 163, 115, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  identityCol: {
    flex: 1,
  },
  identityDivider: {
    width: 1,
    height: 32,
    backgroundColor: coffee.border,
    marginHorizontal: 10,
  },
  identityLabel: {
    color: coffee.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  identityValRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  identityNumber: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '900',
  },
  identityEmail: {
    color: coffee.accent,
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
  },
  copyMiniBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tabBar: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
    backgroundColor: '#17110d',
    borderBottomWidth: 1,
    borderBottomColor: coffee.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: coffee.surface,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  tabBtnActive: {
    backgroundColor: coffee.accent,
    borderColor: coffee.accent,
  },
  tabBtnText: {
    color: coffee.text,
    fontSize: 12,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: '#171411',
    fontWeight: '800',
  },
  dialDisplayBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#120d0a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: coffee.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 10,
  },
  dialDisplayInput: {
    flex: 1,
    color: coffee.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1.5,
    paddingVertical: 6,
  },
  backspaceBtn: {
    padding: 6,
  },
  matchedUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  matchedAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchedAvatarText: {
    color: '#171411',
    fontWeight: '900',
    fontSize: 16,
  },
  matchedName: {
    color: coffee.text,
    fontSize: 14,
    fontWeight: '800',
  },
  matchedMeta: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 2,
  },
  dialHintText: {
    color: coffee.secondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 17,
  },
  keypadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  keypadButton: {
    width: '30%',
    backgroundColor: coffee.surface,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: coffee.border,
  },
  keypadDigit: {
    color: coffee.text,
    fontSize: 22,
    fontWeight: '800',
  },
  keypadSub: {
    color: coffee.muted,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
  dialActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dialActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderRadius: 12,
  },
  dialActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  rulesCard: {
    backgroundColor: 'rgba(212, 163, 115, 0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: coffee.border,
    marginBottom: 14,
  },
  rulesTitle: {
    color: coffee.accent,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  ruleItem: {
    color: coffee.text,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 3,
  },
  sectionLabel: {
    color: coffee.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  claimInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  claimInput: {
    flex: 1,
    backgroundColor: '#120d0a',
    color: coffee.text,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: coffee.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  checkBtn: {
    backgroundColor: coffee.button,
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBtnText: {
    color: coffee.text,
    fontSize: 13,
    fontWeight: '800',
  },
  statusBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  subHintLabel: {
    color: coffee.secondary,
    fontSize: 11,
    marginBottom: 6,
  },
  suggestionChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: coffee.surface,
    borderWidth: 1,
    borderColor: coffee.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  suggestionChipText: {
    color: coffee.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  primaryClaimBtn: {
    marginTop: 16,
    backgroundColor: coffee.accent,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryClaimBtnText: {
    color: '#171411',
    fontSize: 14,
    fontWeight: '800',
  },
  founderPanel: {
    marginTop: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderColor: 'rgba(255, 215, 0, 0.45)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  founderPanelTitle: {
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '800',
  },
  founderPanelDesc: {
    color: coffee.secondary,
    fontSize: 12,
    lineHeight: 17,
  },
  mailSubNav: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  mailSubBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: coffee.surface,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  mailSubBtnActive: {
    borderColor: coffee.accent,
    backgroundColor: 'rgba(212, 163, 115, 0.14)',
  },
  mailSubText: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  mailSubTextActive: {
    color: coffee.accent,
    fontWeight: '800',
  },
  mailRow: {
    backgroundColor: coffee.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  mailRowUnread: {
    borderColor: coffee.accent,
    backgroundColor: 'rgba(212, 163, 115, 0.08)',
  },
  mailRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  mailRowSender: {
    color: coffee.accent,
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
  },
  mailRowTime: {
    color: coffee.muted,
    fontSize: 11,
  },
  mailRowSubject: {
    color: coffee.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
  },
  mailRowPreview: {
    color: coffee.secondary,
    fontSize: 12,
    lineHeight: 16,
  },
  mailDetailCard: {
    backgroundColor: coffee.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  backToInboxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  mailDetailSubject: {
    color: coffee.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  mailDetailMetaBox: {
    backgroundColor: '#120d0a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  mailDetailMeta: {
    color: coffee.secondary,
    fontSize: 11,
    marginBottom: 3,
  },
  mailDetailBody: {
    color: coffee.text,
    fontSize: 13,
    lineHeight: 20,
  },
  replyMailBtn: {
    backgroundColor: coffee.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  replyMailBtnText: {
    color: '#171411',
    fontSize: 12,
    fontWeight: '800',
  },
  composeBox: {
    backgroundColor: coffee.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  inputLabel: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 6,
  },
  readOnlyField: {
    backgroundColor: '#120d0a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  recipientChip: {
    backgroundColor: '#120d0a',
    borderWidth: 1,
    borderColor: coffee.border,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
  },
  recipientChipText: {
    color: coffee.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyMailBox: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  emptyMailText: {
    color: coffee.muted,
    fontSize: 13,
    marginTop: 8,
  },
});

