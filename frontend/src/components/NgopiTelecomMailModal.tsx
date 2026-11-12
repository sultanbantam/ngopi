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
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import { router } from 'expo-router';
import { coffee } from '../theme/coffee';
import * as SecureStore from '../utils/storage';
import { socketService } from '../utils/socket';

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

export interface MailAttachment {
  url: string;
  name: string;
  type: 'image' | 'video' | 'document';
  size?: number;
  mime_type?: string;
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
  attachments?: MailAttachment[];
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
  if (clean === 'warung' || clean === 'founder' || clean === 'ngopi') return '0';
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
  if (clean === 'warung' || clean === 'founder' || clean === 'ngopi') return 'warung@ngopi.top';
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
  if (uname === 'ngopi' || uname === 'founder' || member.bmc_id === 1) {
    return '0';
  }
  if (uname === 'warung') {
    return '100';
  }
  return generateUglyDefaultNumber(uname || member.id);
}

export function formatNgopiEmail(username: string, customEmail?: string): string {
  if (customEmail) return customEmail;
  const clean = String(username || 'user').trim().toLowerCase().replace(/^@/, '');
  if (clean === 'ngopi' || clean === 'founder') {
    return 'warung@ngopi.top';
  }
  if (clean === 'warung') {
    return 'warung-ops@ngopi.top';
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
  const [paymentInfo, setPaymentInfo] = useState<string>(
    '• Bank Tujuan: Bank BRI\n• Nomor Rekening: 141101000456562\n• Atas Nama: Yayasan Sabumi Nusantara Jaya\n• Konfirmasi Pembayaran: Ke Akun Founder (#0 • warung@ngopi.top) atau WhatsApp: 08174139994'
  );
  const [httpDirectory, setHttpDirectory] = useState<TelecomMemberItem[]>([]);

  // Founder VIP Assign state (1..100 & Locked @ngopi.top Emails)
  const [vipTargetUsername, setVipTargetUsername] = useState<string>('');
  const [vipNumberInput, setVipNumberInput] = useState<string>('');
  const [founderEmailInput, setFounderEmailInput] = useState<string>('');
  const [founderEmailTargetUser, setFounderEmailTargetUser] = useState<string>('');

  // Identitas Ngopi Checkout, Orders & VIP Request state
  const [selectedPackageCode, setSelectedPackageCode] = useState<
    'number_regular' | 'email_personal' | 'bundle_identity' | 'number_special'
  >('bundle_identity');
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [adminOrders, setAdminOrders] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [proofRefInput, setProofRefInput] = useState<string>('');
  const [proofSenderInput, setProofSenderInput] = useState<string>('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [vipReqNotes, setVipReqNotes] = useState<string>('');
  const [isSubmittingVipReq, setIsSubmittingVipReq] = useState<boolean>(false);

  // Mail state
  const [mailSubTab, setMailSubTab] = useState<'inbox' | 'sent' | 'compose'>('inbox');
  const [mails, setMails] = useState<MailItem[]>([]);
  const [selectedMail, setSelectedMail] = useState<MailItem | null>(null);
  const [composeTo, setComposeTo] = useState<string>('');
  const [composeSubject, setComposeSubject] = useState<string>('');
  const [composeBody, setComposeBody] = useState<string>('');
  const [composeAttachments, setComposeAttachments] = useState<MailAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState<boolean>(false);
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

  // Build full directory with numbers & emails (combining props + HTTP fallback directory)
  const enrichedDirectory = useMemo(() => {
    const mergedMap = new Map<string, TelecomMemberItem>();
    [...httpDirectory, ...members].forEach((m) => {
      if (m && m.id) {
        mergedMap.set(m.id, { ...mergedMap.get(m.id), ...m });
      }
    });
    const list = Array.from(mergedMap.values());
    const hasMe = list.some((m) => m.id === currentUserId || m.username?.toLowerCase() === currentUsername?.toLowerCase());
    if (!hasMe && currentUsername) {
      const unameLower = currentUsername.toLowerCase();
      list.unshift({
        id: currentUserId || 'me',
        username: currentUsername,
        display_name: currentDisplayName || currentUsername,
        bmc_id: unameLower === 'ngopi' || unameLower === 'founder' ? 1 : undefined,
      });
    }

    const usedNums = new Set<string>();
    const result: Array<TelecomMemberItem & { ngopi_number: string; ngopi_email: string }> = [];

    // Sort so Primary Founder ('ngopi' / 'founder' / bmc_id === 1) is first, then 'warung', then by bmc_id
    const isPrimaryFounder = (m: TelecomMemberItem) => {
      const u = m.username?.toLowerCase();
      return u === 'ngopi' || u === 'founder' || m.bmc_id === 1;
    };
    const sorted = [...list].sort((a, b) => {
      if (isPrimaryFounder(a) && !isPrimaryFounder(b)) return -1;
      if (!isPrimaryFounder(a) && isPrimaryFounder(b)) return 1;
      if (a.username?.toLowerCase() === 'warung') return -1;
      if (b.username?.toLowerCase() === 'warung') return 1;
      return (a.bmc_id || 999999) - (b.bmc_id || 999999);
    });

    sorted.forEach((m) => {
      let num = customNumbersMap[m.id] || m.ngopi_number || '';
      if (!num) {
        if (isPrimaryFounder(m) && !usedNums.has('0')) {
          num = '0';
        } else if (m.username?.toLowerCase() === 'warung') {
          num = usedNums.has('0') ? '100' : '0';
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
  }, [httpDirectory, members, currentUserId, currentUsername, currentDisplayName, customNumbersMap, customEmailsMap]);

  const loadTelecomData = useCallback(async () => {
    const uname = String(currentUsername || '').trim().toLowerCase();
    const founderFlag = uname === 'warung' || uname === 'founder' || uname === 'ngopi' || uname === 'admin';
    setIsFounder(founderFlag);

    // Always fetch resilient directory so HP/Mobile has all members even before Socket connects
    axios
      .get(`${API_URL}/telecom/directory`)
      .then((res) => {
        if (Array.isArray(res.data?.members) && res.data.members.length > 0) {
          setHttpDirectory(res.data.members);
        }
        if (res.data?.premium_config?.paymentInfo) {
          setPaymentInfo(String(res.data.premium_config.paymentInfo));
        }
      })
      .catch(() => {});

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
    const defaultNum = localCustom[currentUserId] || meEntry?.ngopi_number || (founderFlag ? '0' : generateUglyDefaultNumber(uname || currentUserId));
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
        subject: `Selamat Datang di Identitas Ngopi #${defaultNum} & Email ${defaultEmail}! ☕`,
        body: `Halo ${currentDisplayName || currentUsername}!\n\nAkun Anda di ngopi.top kini resmi dilengkapi dengan Identitas Ngopi:\n\n• Nomor Otomatis Ngopi: ${defaultNum}\n• Email Otomatis: ${defaultEmail} (alias: ${defaultNum}@ngopi.top)\n\nInformasi Penomoran:\n- Nomor 0 s/d 100 dialokasikan untuk operasional resmi Ngopi.\n- Nomor 101 ke atas dapat Anda pilih sesuai keinginan melalui paket Identitas Ngopi!\n\nSelamat menikmati komunikasi lengkap (Chat, Telepon Dialpad, HT Radio, & Email) dalam satu aplikasi!\n\nSalam hangat,\nTim Ngopi (#0 • warung@ngopi.top)`,
        is_read: false,
        created_at: new Date().toISOString(),
      });
    }
    setMails(storedMails);

    // Sync with backend /api/telecom/me, /api/telecom/mail/inbox & /api/telecom/mail/sent
    try {
      const token = await getToken();
      if (!token) return;
      setLoadingMail(true);
      const [meRes, inboxRes, sentRes] = await Promise.all([
        axios.get(`${API_URL}/telecom/me`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        axios.get(`${API_URL}/telecom/mail/inbox`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        axios.get(`${API_URL}/telecom/mail/sent`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);
      if (meRes?.data?.ngopi_number) {
        setMyNumber(String(meRes.data.ngopi_number));
        setMyEmail(String(meRes.data.ngopi_email || defaultEmail));
        setIsFounder(Boolean(meRes.data.is_founder || founderFlag));
      }
      if (Array.isArray(meRes?.data?.locked_email_prefixes)) {
        setLockedEmailPrefixes(meRes.data.locked_email_prefixes);
      }
      if (meRes?.data?.premium_config) {
        setRequirePaidCustomNumber(Boolean(meRes.data.premium_config.requirePaymentForCustomNumber));
        setRequirePaidCustomEmail(Boolean(meRes.data.premium_config.requirePaymentForCustomEmail));
        if (meRes.data.premium_config.paymentInfo) {
          setPaymentInfo(String(meRes.data.premium_config.paymentInfo));
        }
      }
      const serverInbox: MailItem[] = Array.isArray(inboxRes?.data?.mails) ? inboxRes.data.mails : [];
      const serverSent: MailItem[] = Array.isArray(sentRes?.data?.mails) ? sentRes.data.mails : [];

      // Auto-sync any locally stored sent mails (e.g. mail-17944...) that haven't been pushed to server yet
      const unsyncedLocalSent = storedMails.filter(
        (m) =>
          /^mail-\d+$/.test(m.id) &&
          (m.from_user_id === currentUserId ||
            m.from_username?.toLowerCase() === uname ||
            m.from_email?.toLowerCase() === defaultEmail.toLowerCase())
      );
      if (unsyncedLocalSent.length > 0) {
        for (const pending of unsyncedLocalSent) {
          try {
            const syncRes = await axios.post(
              `${API_URL}/telecom/mail/send`,
              {
                to: pending.to_email || pending.to_number || pending.to_username,
                subject: pending.subject,
                body: pending.body,
                attachments: pending.attachments,
              },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (syncRes.data?.mail) {
              serverSent.unshift(syncRes.data.mail);
              storedMails = storedMails.filter((sm) => sm.id !== pending.id);
            }
          } catch {}
        }
        try {
          const serialized = JSON.stringify(storedMails.slice(0, 200));
          if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
            localStorage.setItem(LOCAL_MAILS_KEY, serialized);
          } else {
            await SecureStore.setItemAsync(LOCAL_MAILS_KEY, serialized);
          }
        } catch {}
      }

      if (serverInbox.length > 0 || serverSent.length > 0) {
        const combinedMap = new Map<string, MailItem>();
        [...serverInbox, ...serverSent, ...storedMails].forEach((m) => {
          if (m && m.id && !combinedMap.has(m.id)) {
            combinedMap.set(m.id, m);
          }
        });
        const mergedMails = Array.from(combinedMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setMails(mergedMails);
      }

      // Fetch user's Identity Orders (and Admin Orders if Founder/Admin)
      const ordersRes = await axios
        .get(`${API_URL}/telecom/orders/my`, { headers: { Authorization: `Bearer ${token}` } })
        .catch(() => null);
      if (Array.isArray(ordersRes?.data?.orders)) {
        setMyOrders(ordersRes.data.orders);
        const pendingOrVerifying = ordersRes.data.orders.find(
          (o: any) => o.status === 'pending_payment' || o.status === 'verifying'
        );
        setActiveOrder(pendingOrVerifying || null);
      }

      if (Boolean(meRes?.data?.is_founder || founderFlag)) {
        const adminOrdRes = await axios
          .get(`${API_URL}/telecom/admin/orders`, { headers: { Authorization: `Bearer ${token}` } })
          .catch(() => null);
        if (Array.isArray(adminOrdRes?.data?.orders)) {
          setAdminOrders(adminOrdRes.data.orders);
        }
      }
    } catch {
      // Fallback already populated cleanly
    } finally {
      setLoadingMail(false);
    }
  }, [currentUserId, currentUsername, currentDisplayName]);

  const handleCreateOrderCheckout = async () => {
    const needsNum =
      selectedPackageCode === 'number_regular' ||
      selectedPackageCode === 'number_special' ||
      selectedPackageCode === 'bundle_identity';
    const needsEmail =
      selectedPackageCode === 'email_personal' || selectedPackageCode === 'bundle_identity';

    if (needsNum && !desiredNumber.trim()) {
      showNotice('Nomor Pilihan Diperlukan', 'Masukkan Nomor Pilihan (misal 1945 atau 777) terlebih dahulu.');
      return;
    }
    if (needsEmail && !desiredEmailPrefix.trim()) {
      showNotice('Email Pilihan Diperlukan', 'Masukkan nama Email Pilihan @ngopi.top terlebih dahulu.');
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const token = await getToken();
      if (!token) {
        showNotice('Login Diperlukan', 'Silakan login kembali untuk membuat pesanan.');
        return;
      }
      const res = await axios.post(
        `${API_URL}/telecom/orders/checkout`,
        {
          package_code: selectedPackageCode,
          requested_number: needsNum ? desiredNumber.trim() : undefined,
          requested_email: needsEmail ? desiredEmailPrefix.trim() : undefined,
          payment_method: 'bank_bri_transfer',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.order) {
        setActiveOrder(res.data.order);
        setMyOrders((prev) => [res.data.order, ...prev]);
        showNotice(
          'Pesanan & Reservasi Berhasil',
          `Kode Pesanan: ${res.data.order.order_code}\nTotal Transfer: Rp ${Number(res.data.order.total_transfer_idr).toLocaleString('id-ID')}\nIdentitas direservasi selama 30 menit.`
        );
      }
    } catch (err: any) {
      showNotice('Gagal Membuat Pesanan', err?.response?.data?.error || 'Periksa kembali nomor/email pilihan Anda.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleSubmitOrderProof = async () => {
    if (!activeOrder) return;
    if (!proofRefInput.trim()) {
      showNotice('Referensi Transfer Diperlukan', 'Masukkan nomor referensi / catatan transfer Bank BRI.');
      return;
    }
    setIsSubmittingOrder(true);
    try {
      const token = await getToken();
      const res = await axios.post(
        `${API_URL}/telecom/orders/${activeOrder.id}/submit-proof`,
        {
          payment_reference: proofRefInput.trim(),
          bank_sender_name: proofSenderInput.trim() || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.order) {
        setActiveOrder(res.data.order);
        setMyOrders((prev) => prev.map((o) => (o.id === res.data.order.id ? res.data.order : o)));
        setProofRefInput('');
        setProofSenderInput('');
        if (res.data.auto_activated) {
          await loadTelecomData();
        }
        showNotice('Konfirmasi Diterima', res.data.message || 'Bukti transfer berhasil dikirim.');
      }
    } catch (err: any) {
      showNotice('Gagal Kirim Bukti', err?.response?.data?.error || 'Silakan coba lagi.');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const handleSendVipRequest = async () => {
    if (!vipReqNotes.trim() && !desiredNumber.trim() && !desiredEmailPrefix.trim()) {
      showNotice('Isi Permintaan', 'Tuliskan nomor/email khusus yang diinginkan atau catatan untuk Tim Ngopi.');
      return;
    }
    setIsSubmittingVipReq(true);
    try {
      const token = await getToken();
      const res = await axios.post(
        `${API_URL}/telecom/vip-requests`,
        {
          requested_number: desiredNumber.trim() || undefined,
          requested_email: desiredEmailPrefix.trim() || undefined,
          notes: vipReqNotes.trim() || 'Permintaan identitas khusus Ngopi.',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setVipReqNotes('');
      showNotice('Permintaan Terkirim', res.data?.message || 'Permintaan Anda telah diteruskan ke Tim Ngopi.');
    } catch (err: any) {
      showNotice('Gagal Mengirim', err?.response?.data?.error || 'Silakan coba lagi.');
    } finally {
      setIsSubmittingVipReq(false);
    }
  };

  const handleAdminApproveOrder = async (orderId: string, action: 'approve' | 'reject') => {
    try {
      const token = await getToken();
      const res = await axios.post(
        `${API_URL}/telecom/admin/orders/${orderId}/approve`,
        { action },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.order) {
        setAdminOrders((prev) => prev.map((o) => (o.id === orderId ? res.data.order : o)));
        await loadTelecomData();
        showNotice('Sukses', res.data.message || 'Status pesanan diperbarui.');
      }
    } catch (err: any) {
      showNotice('Gagal Memproses', err?.response?.data?.error || 'Terjadi kesalahan.');
    }
  };

  useEffect(() => {
    if (visible) {
      loadTelecomData();
    }
  }, [visible, loadTelecomData]);

  // Real-time Socket listener for incoming @ngopi.top emails
  useEffect(() => {
    const socket = socketService.socket;
    if (!socket) return;
    const handleNewMail = (newMail: MailItem) => {
      if (!newMail || !newMail.id) return;
      setMails((prev) => {
        if (prev.some((m) => m.id === newMail.id)) return prev;
        return [newMail, ...prev];
      });
    };
    socket.on('telecom_new_mail', handleNewMail);
    return () => {
      socket.off('telecom_new_mail', handleNewMail);
    };
  }, [visible]);

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

  const handleDialAction = async (mode: 'voice' | 'video' | 'chat' | 'mail') => {
    const code = dialedInput.trim();
    if (!code) {
      showNotice('Papan Telepon', 'Ketik Nomor Ngopi tujuan terlebih dahulu (contoh: 0 untuk Founder, atau nomor member tujuan).');
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

    let targetMember: (TelecomMemberItem & { ngopi_number: string; ngopi_email: string }) | null = dialedMember;

    // Fallback: query backend /api/telecom/public-lookup/:identifier if local directory doesn't have it yet
    if (!targetMember) {
      try {
        const cleanCode = code.replace(/^#/, '');
        const lookupRes = await axios.get(`${API_URL}/telecom/public-lookup/${encodeURIComponent(cleanCode)}`);
        if (lookupRes.data?.id) {
          targetMember = {
            id: lookupRes.data.id,
            username: lookupRes.data.username,
            display_name: lookupRes.data.display_name || lookupRes.data.username,
            avatar_url: lookupRes.data.avatar_url,
            bmc_id: lookupRes.data.bmc_id,
            role: lookupRes.data.role,
            ngopi_number: String(lookupRes.data.ngopi_number || cleanCode),
            ngopi_email: String(lookupRes.data.ngopi_email || formatNgopiEmail(lookupRes.data.username)),
          };
        }
      } catch {}
    }

    if (!targetMember) {
      const numVal = Number(code);
      if (!Number.isNaN(numVal) && numVal >= 1 && numVal <= 100) {
        showNotice(
          'Alokasi Resmi Ngopi',
          `Nomor ${code} dialokasikan untuk kebutuhan resmi Ngopi. Untuk permintaan identitas khusus, hubungi Tim Ngopi.`
        );
      } else {
        showNotice(
          'Nomor Belum Terdaftar',
          `Nomor Ngopi "${code}" belum digunakan. Anda bisa mengecek ketersediaannya di tab "Identitas Ngopi"!`
        );
      }
      return;
    }

    if (mode === 'mail') {
      setComposeTo(targetMember.ngopi_email);
      setActiveTab('mail');
      setMailSubTab('compose');
      return;
    }

    onClose();
    const targetName = targetMember.display_name || targetMember.username;
    if (mode === 'chat') {
      router.push({ pathname: '/(main)/chat/[id]', params: { id: targetMember.id, name: targetName } });
    } else if (mode === 'voice') {
      router.push({ pathname: '/(main)/call/[id]', params: { id: targetMember.id, name: targetName, isVideo: 'false' } });
    } else if (mode === 'video') {
      router.push({ pathname: '/(main)/call/[id]', params: { id: targetMember.id, name: targetName, isVideo: 'true' } });
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
        message: 'Nomor 0 dialokasikan untuk operasional resmi Ngopi.',
      });
      return false;
    }

    if (numericVal >= 1 && numericVal <= 100 && !isFounder) {
      setAvailabilityStatus({
        checked: true,
        available: false,
        lockedVip: true,
        message: 'Nomor ini dialokasikan untuk kebutuhan resmi Ngopi. Untuk permintaan identitas khusus, hubungi Tim Ngopi.',
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
        message: `Nomor ${normalized} sudah digunakan oleh @${takenBy.username}. Coba angka pilihan lainnya!`,
      });
      return false;
    }

    const isSpecial3DigitOrTwin = normalized.length <= 3 || /^(\d)\1+$/.test(normalized);
    setAvailabilityStatus({
      checked: true,
      available: true,
      message: isSpecial3DigitOrTwin
        ? `Tersedia — Nomor Pilihan Spesial 3 Angka/Kembar (Rp 250.000 – Rp 1.000.000).`
        : `Tersedia — Nomor Pilihan Reguler (Rp 35.000 atau Bundling + Email Rp 49.000).`,
    });
    return true;
  };

  const handleClaimNumber = async () => {
    if (requirePaidCustomNumber && !isFounder) {
      showNotice(
        'Paket Identitas Ngopi',
        'Upgrade Nomor Pilihan tersedia melalui:\n• Nomor Pilihan Reguler (4–6 Angka): Rp 35.000\n• Bundling Identitas (Nomor + Email Pilihan): Rp 49.000\n• Nomor Pilihan Spesial (3 Angka / Kembar): Rp 250.000 – Rp 1.000.000\n• Identitas Khusus (1–100): Hubungi Tim Ngopi\n\nSilakan buat pesanan checkout di bawah untuk mengunci nomor selama 30 menit!'
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

  const handleSavePaymentInfo = async () => {
    if (!isFounder) return;
    try {
      const token = await getToken();
      if (token) {
        await axios
          .post(
            `${API_URL}/telecom/premium-config`,
            { paymentInfo },
            { headers: { Authorization: `Bearer ${token}` } }
          )
          .catch(() => {});
      }
      showNotice('✅ Info Pembayaran Disimpan', 'Informasi tujuan transfer rekening / QRIS berhasil diperbarui untuk seluruh pengguna.');
    } catch {}
  };

  const handleOrderUpgradeToFounder = () => {
    const numPart = desiredNumber.trim() ? `• Nomor Cantik Pilihan: #${desiredNumber.trim()}\n` : '';
    const emailPart = desiredEmailPrefix.trim()
      ? `• Email Cantik Pilihan: ${desiredEmailPrefix.trim().replace(/@ngopi\.top$/i, '')}@ngopi.top\n`
      : '';
    setComposeTo('warung@ngopi.top');
    setComposeSubject(`Konfirmasi Upgrade Nomor / Email Cantik (@${currentUsername})`);
    setComposeBody(
      `Halo Founder Ngopi (#0),\n\nSaya (@${currentUsername} • Nomor Bawaan #${myNumber}) ingin memesan / mengonfirmasi pembayaran upgrade:\n${numPart}${emailPart || '• Paket: Nomor & Email Cantik\n'}\nBerikut saya lampirkan bukti transfer pembayarannya. Mohon bantuannya untuk diaktifkan.\n\nTerima kasih! ☕`
    );
    setActiveTab('mail');
    setMailSubTab('compose');
  };

  // Upload attachment (Document / Image / Video) for @ngopi.top Email
  const uploadMailAttachment = async (
    uri: string,
    fallbackCategory: 'image' | 'video' | 'document',
    originalName?: string,
    mimeType?: string,
    rawFile?: any,
    fileSize?: number
  ): Promise<MailAttachment | null> => {
    if (fileSize && fileSize > 25 * 1024 * 1024) {
      showNotice('Ukuran File Terlalu Besar', 'Batas ukuran per lampiran adalah maksimal 25 MB.');
      return null;
    }
    setIsUploadingAttachment(true);
    try {
      const extFromName = originalName?.split('.').pop()?.toLowerCase() || '';
      const resolvedMime =
        mimeType ||
        (fallbackCategory === 'image'
          ? 'image/jpeg'
          : fallbackCategory === 'video'
          ? 'video/mp4'
          : extFromName === 'pdf'
          ? 'application/pdf'
          : 'application/octet-stream');
      const fallbackName =
        originalName ||
        `lampiran_${Date.now()}.${
          extFromName || (fallbackCategory === 'image' ? 'jpg' : fallbackCategory === 'video' ? 'mp4' : 'pdf')
        }`;

      const formData = new FormData();
      if (Platform.OS === 'web') {
        let fileObj: File;
        if (rawFile && (rawFile instanceof File || rawFile instanceof Blob)) {
          fileObj = new File([rawFile], fallbackName, { type: resolvedMime || rawFile.type || 'application/octet-stream' });
        } else if (uri.startsWith('data:')) {
          const arr = uri.split(',');
          const mimeMatch = arr[0].match(/:(.*?);/);
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: resolvedMime || mimeMatch?.[1] || 'application/octet-stream' });
          fileObj = new File([blob], fallbackName, { type: blob.type });
        } else {
          const response = await fetch(uri);
          const blob = await response.blob();
          fileObj = new File([blob], fallbackName, { type: resolvedMime || blob.type || 'application/octet-stream' });
        }
        formData.append('file', fileObj);
      } else {
        formData.append('file', {
          uri,
          name: fallbackName,
          type: resolvedMime,
        } as any);
      }

      const token = await getToken();
      const headers: Record<string, string> = {};
      if (Platform.OS !== 'web') {
        headers['Content-Type'] = 'multipart/form-data';
      }
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await axios.post(`${API_URL}/upload`, formData, { headers });
      if (res.data?.url) {
        const returnedType = res.data.type === 'image' || res.data.type === 'video' ? res.data.type : fallbackCategory;
        return {
          url: String(res.data.url),
          name: String(res.data.name || fallbackName),
          type: returnedType,
          size: typeof res.data.size === 'number' ? res.data.size : fileSize,
          mime_type: String(res.data.mime_type || resolvedMime),
        };
      }
      return null;
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.message || 'Gagal mengunggah berkas lampiran.';
      showNotice('Gagal Upload Lampiran', String(errMsg));
      return null;
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handlePickMailImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];
        const fileName = asset.fileName || `gambar_${Date.now()}.${asset.mimeType?.split('/')[1] || 'jpg'}`;
        const uploaded = await uploadMailAttachment(
          asset.uri,
          'image',
          fileName,
          asset.mimeType,
          (asset as any).file,
          asset.fileSize
        );
        if (uploaded) {
          setComposeAttachments((prev) => [...prev, uploaded]);
        }
      }
    } catch (e: any) {
      showNotice('Gagal Memilih Gambar', e?.message || 'Tidak dapat membuka galeri gambar.');
    }
  };

  const handlePickMailVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const asset = result.assets[0];
        const fileName = asset.fileName || `video_${Date.now()}.${asset.mimeType?.split('/')[1] || 'mp4'}`;
        const uploaded = await uploadMailAttachment(
          asset.uri,
          'video',
          fileName,
          asset.mimeType || 'video/mp4',
          (asset as any).file,
          asset.fileSize
        );
        if (uploaded) {
          setComposeAttachments((prev) => [...prev, uploaded]);
        }
      }
    } catch (e: any) {
      showNotice('Gagal Memilih Video', e?.message || 'Tidak dapat membuka galeri video.');
    }
  };

  const handlePickMailDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: '*/*',
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const doc = result.assets[0];
        const mime = doc.mimeType || '';
        const category: 'image' | 'video' | 'document' = mime.startsWith('image/')
          ? 'image'
          : mime.startsWith('video/')
          ? 'video'
          : 'document';
        const uploaded = await uploadMailAttachment(
          doc.uri,
          category,
          doc.name || `dokumen_${Date.now()}`,
          doc.mimeType,
          (doc as any).file,
          doc.size
        );
        if (uploaded) {
          setComposeAttachments((prev) => [...prev, uploaded]);
        }
      }
    } catch (e: any) {
      showNotice('Gagal Memilih Dokumen', e?.message || 'Tidak dapat membuka pemilih berkas.');
    }
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
    if (!cleanBody && composeAttachments.length === 0) {
      showNotice('Isi Email Kosong', 'Tulis isi surat elektronik Anda atau lampirkan berkas (dokumen/gambar/video) terlebih dahulu.');
      return;
    }

    const cleanKey = rawTo.replace(/^#/, '').replace(/^@/, '').replace(/@ngopi\.top$/i, '').toLowerCase();
    const recipient = enrichedDirectory.find(
      (m) =>
        m.ngopi_email.toLowerCase() === rawTo.toLowerCase() ||
        m.ngopi_number === cleanKey ||
        m.username?.toLowerCase() === cleanKey
    );

    if (!recipient && !rawTo.includes('@') && !/^\d+$/.test(cleanKey)) {
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
            {
              to: rawTo,
              subject: cleanSubject,
              body: cleanBody || `(Melampirkan ${composeAttachments.length} berkas)`,
              attachments: composeAttachments.length > 0 ? composeAttachments : undefined,
            },
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
          body: cleanBody || `(Melampirkan ${composeAttachments.length} berkas)`,
          attachments: composeAttachments.length > 0 ? composeAttachments : undefined,
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
      setComposeAttachments([]);
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
                Identitas Ngopi
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
                      ? 'Nomor ini dialokasikan untuk kebutuhan resmi Ngopi.'
                      : 'Nomor belum terdaftar — bisa Anda cek ketersediaannya di tab Identitas Ngopi!'}
                  </Text>
                ) : (
                  <Text style={styles.dialHintText}>
                    Tips: Ketik <Text style={{ color: coffee.accent, fontWeight: '700' }}>0</Text> untuk menghubungi Tim Ngopi,{' '}
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

            {/* TAB 2: IDENTITAS NGOPI (NOMOR PILIHAN & EMAIL PILIHAN) */}
            {activeTab === 'custom_number' && (
              <View>
                <View style={styles.rulesCard}>
                  <Text style={styles.rulesTitle}>☕ Skema Identitas Otomatis & Upgrade Identitas Ngopi</Text>
                  <Text style={styles.ruleItem}>
                    • <Text style={{ fontWeight: '800', color: '#38bdf8' }}>Nomor & Email Otomatis</Text>: Setiap member baru maupun lama otomatis mendapatkan <Text style={{ fontWeight: '700' }}>Nomor Otomatis 10-Digit</Text> & <Text style={{ fontWeight: '700' }}>Email Otomatis</Text> (@ngopi.top).
                  </Text>
                  <Text style={styles.ruleItem}>
                    • <Text style={{ fontWeight: '800', color: '#FFD700' }}>Alokasi Resmi Ngopi</Text>: Nomor <Text style={{ fontWeight: '700' }}>0</Text>, <Text style={{ fontWeight: '700' }}>1–100</Text>, serta alamat operasional resmi dialokasikan untuk kebutuhan resmi Ngopi.
                  </Text>
                  <Text style={styles.ruleItem}>
                    • <Text style={{ fontWeight: '800', color: '#10b981' }}>Upgrade Identitas Ngopi</Text>: Ganti ke <Text style={{ fontWeight: '700' }}>Nomor Pilihan Mudah Diingat (101+)</Text> atau <Text style={{ fontWeight: '700' }}>Email Pilihan Sesuai Nama/Brand (@ngopi.top)</Text> dengan paket di bawah.
                  </Text>
                </View>

                {/* DAFTAR HARGA PAKET IDENTITAS NGOPI */}
                <View style={[styles.rulesCard, { borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.09)' }]}>
                  <Text style={[styles.rulesTitle, { color: '#fbbf24' }]}>💎 Daftar Paket Identitas Ngopi</Text>
                  <Text style={styles.ruleItem}>• <Text style={{ fontWeight: '800', color: '#fff' }}>Paket Email Pilihan Personal</Text> (<Text style={{ color: '#fbbf24' }}>nama@ngopi.top</Text>): <Text style={{ fontWeight: '900', color: '#10b981' }}>Rp 25.000</Text></Text>
                  <Text style={styles.ruleItem}>• <Text style={{ fontWeight: '800', color: '#fff' }}>Paket Nomor Pilihan Reguler</Text> (4–6 Angka, misal <Text style={{ color: '#fbbf24' }}>1945, 2026</Text>): <Text style={{ fontWeight: '900', color: '#10b981' }}>Rp 35.000</Text></Text>
                  <Text style={styles.ruleItem}>• 🔥 <Text style={{ fontWeight: '900', color: '#FFD700' }}>PAKET BUNDLING IDENTITAS (Nomor + Email Pilihan)</Text>: <Text style={{ fontWeight: '900', color: '#FFD700' }}>Rp 49.000</Text> <Text style={{ fontSize: 10, color: '#9ca3af' }}>(Hemat Rp 11.000 - Terlaris)</Text></Text>
                  <Text style={styles.ruleItem}>• <Text style={{ fontWeight: '800', color: '#fff' }}>Paket Nomor Pilihan Spesial (3 Angka / Kembar)</Text> (<Text style={{ color: '#fbbf24' }}>101–999, 777, 888</Text>): <Text style={{ fontWeight: '900', color: '#10b981' }}>Rp 250.000 – Rp 1.000.000</Text></Text>
                  <Text style={styles.ruleItem}>• 👑 <Text style={{ fontWeight: '800', color: '#f97316' }}>Identitas Khusus / Brand & VIP</Text>: <Text style={{ fontWeight: '900', color: '#FFD700' }}>Untuk permintaan identitas khusus, hubungi Tim Ngopi.</Text></Text>
                </View>

                {/* INFO TUJUAN TRANSFER & KONFIRMASI PEMBAYARAN KE FOUNDER (#0) & WA */}
                <View style={[styles.rulesCard, { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.08)' }]}>
                  <Text style={[styles.rulesTitle, { color: '#10b981' }]}>💳 Informasi Rekening Transfer & Konfirmasi Pembayaran</Text>
                  <View
                    style={{
                      backgroundColor: '#120d0a',
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: coffee.border,
                      padding: 12,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ color: coffee.secondary, fontSize: 11, fontWeight: '700' }}>BANK TUJUAN TRANSFER:</Text>
                    <Text style={{ color: '#38bdf8', fontSize: 15, fontWeight: '900', marginTop: 2 }}>BANK BRI</Text>

                    <Text style={{ color: coffee.secondary, fontSize: 11, fontWeight: '700', marginTop: 8 }}>NOMOR REKENING:</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text style={{ color: '#FFD700', fontSize: 17, fontWeight: '900', letterSpacing: 1 }}>141101000456562</Text>
                      <TouchableOpacity
                        style={{
                          backgroundColor: 'rgba(255, 215, 0, 0.16)',
                          borderWidth: 1,
                          borderColor: '#FFD700',
                          borderRadius: 8,
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        onPress={() => copyText('141101000456562', 'Nomor Rekening BRI Yayasan Sabumi Nusantara Jaya')}
                      >
                        <Ionicons name="copy-outline" size={13} color="#FFD700" />
                        <Text style={{ color: '#FFD700', fontSize: 11, fontWeight: '800' }}>Salin No. Rek</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={{ color: coffee.secondary, fontSize: 11, fontWeight: '700', marginTop: 8 }}>NAMA REKENING:</Text>
                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 2 }}>
                      Yayasan Sabumi Nusantara Jaya
                    </Text>

                    <View style={{ height: 1, backgroundColor: coffee.border, marginVertical: 10 }} />

                    <Text style={{ color: coffee.secondary, fontSize: 11, fontWeight: '700' }}>KONFIRMASI PEMBAYARAN:</Text>
                    <Text style={{ color: coffee.text, fontSize: 12, marginTop: 3, lineHeight: 18 }}>
                      • Akun Founder Ngopi: <Text style={{ color: '#10b981', fontWeight: '800' }}>#0 • warung@ngopi.top</Text>{'\n'}
                      • WhatsApp Resmi: <Text style={{ color: '#22c55e', fontWeight: '800' }}>08174139994</Text>
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        minWidth: 160,
                        backgroundColor: '#10b981',
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      onPress={handleOrderUpgradeToFounder}
                    >
                      <Ionicons name="mail" size={16} color="#171411" />
                      <Text style={{ color: '#171411', fontSize: 12, fontWeight: '900' }}>
                        Kirim Bukti ke Email #0
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flex: 1,
                        minWidth: 160,
                        backgroundColor: '#25D366',
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      onPress={() => {
                        const numPart = desiredNumber.trim() ? `Nomor Cantik #${desiredNumber.trim()}` : '';
                        const mailPart = desiredEmailPrefix.trim()
                          ? `Email ${desiredEmailPrefix.trim().replace(/@ngopi\.top$/i, '')}@ngopi.top`
                          : '';
                        const orderText = [numPart, mailPart].filter(Boolean).join(' & ') || 'Paket Nomor/Email Cantik';
                        const waMsg = encodeURIComponent(
                          `Halo Admin/Founder Ngopi, saya @${currentUsername} (Nomor bawaan #${myNumber}) ingin konfirmasi transfer ke Bank BRI 141101000456562 (Yayasan Sabumi Nusantara Jaya) untuk pemesanan: ${orderText}.`
                        );
                        Linking.openURL(`https://wa.me/628174139994?text=${waMsg}`);
                      }}
                    >
                      <Ionicons name="logo-whatsapp" size={16} color="#171411" />
                      <Text style={{ color: '#171411', fontSize: 12, fontWeight: '900' }}>
                        WA: 08174139994
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        backgroundColor: coffee.surface,
                        borderWidth: 1,
                        borderColor: coffee.accent,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                      onPress={() => {
                        const founderEntry = enrichedDirectory.find(
                          (m) => m.ngopi_number === '0' || m.username?.toLowerCase() === 'warung' || m.username?.toLowerCase() === 'ngopi'
                        );
                        if (founderEntry) {
                          onClose();
                          router.push({
                            pathname: '/(main)/chat/[id]',
                            params: { id: founderEntry.id, name: founderEntry.display_name || founderEntry.username },
                          });
                        } else {
                          handleOrderUpgradeToFounder();
                        }
                      }}
                    >
                      <Ionicons name="chatbubble-ellipses" size={16} color={coffee.accent} />
                      <Text style={{ color: coffee.accent, fontSize: 12, fontWeight: '800' }}>Chat Founder (#0)</Text>
                    </TouchableOpacity>
                  </View>
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

                {/* SECTION 3: CHECKOUT & RESERVASI IDENTITAS NGOPI */}
                <View style={{ marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: coffee.border }}>
                  <Text style={styles.sectionLabel}>3. Pesan & Reservasi Identitas Ngopi (30 Menit)</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    {[
                      { code: 'number_regular' as const, label: 'Nomor Reguler (Rp 35rb)' },
                      { code: 'email_personal' as const, label: 'Email Personal (Rp 25rb)' },
                      { code: 'bundle_identity' as const, label: 'Bundling Hemat (Rp 49rb)' },
                      { code: 'number_special' as const, label: 'Nomor Spesial (Rp 250rb+)' },
                    ].map((pkgOpt) => (
                      <TouchableOpacity
                        key={pkgOpt.code}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 7,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: selectedPackageCode === pkgOpt.code ? '#f59e0b' : coffee.border,
                          backgroundColor:
                            selectedPackageCode === pkgOpt.code ? 'rgba(245, 158, 11, 0.18)' : coffee.surface,
                        }}
                        onPress={() => setSelectedPackageCode(pkgOpt.code)}
                      >
                        <Text
                          style={{
                            color: selectedPackageCode === pkgOpt.code ? '#fbbf24' : coffee.text,
                            fontSize: 11,
                            fontWeight: '800',
                          }}
                        >
                          {pkgOpt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryClaimBtn, isSubmittingOrder && { opacity: 0.6 }]}
                    onPress={handleCreateOrderCheckout}
                    disabled={isSubmittingOrder}
                  >
                    <Ionicons name="cart" size={18} color="#171411" />
                    <Text style={styles.primaryClaimBtnText}>
                      {isSubmittingOrder ? 'Memproses Reservasi...' : 'Buat Pesanan & Reservasi'}
                    </Text>
                  </TouchableOpacity>

                  {activeOrder && (
                    <View
                      style={{
                        marginTop: 12,
                        backgroundColor: '#120d0a',
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: '#f59e0b',
                        padding: 12,
                      }}
                    >
                      <Text style={{ color: '#fbbf24', fontSize: 13, fontWeight: '900' }}>
                        🧾 Pesanan Aktif: {activeOrder.order_code} ({activeOrder.status.toUpperCase()})
                      </Text>
                      <Text style={{ color: coffee.text, fontSize: 12, marginTop: 4 }}>
                        • Total Transfer BRI: Rp {Number(activeOrder.total_transfer_idr).toLocaleString('id-ID')} (termasuk kode unik {activeOrder.unique_code}){'\n'}
                        {activeOrder.requested_number ? `• Nomor Pilihan: ${activeOrder.requested_number}\n` : ''}
                        {activeOrder.requested_email ? `• Email Pilihan: ${activeOrder.requested_email}` : ''}
                      </Text>

                      {activeOrder.status === 'pending_payment' && (
                        <View style={{ marginTop: 10, gap: 8 }}>
                          <TextInput
                            style={styles.claimInput}
                            value={proofRefInput}
                            onChangeText={setProofRefInput}
                            placeholder="Nomor Referensi / Catatan Transfer BRI"
                            placeholderTextColor={coffee.muted}
                          />
                          <TextInput
                            style={styles.claimInput}
                            value={proofSenderInput}
                            onChangeText={setProofSenderInput}
                            placeholder="Nama Pengirim Rekening (Opsional)"
                            placeholderTextColor={coffee.muted}
                          />
                          <TouchableOpacity
                            style={[styles.primaryClaimBtn, isSubmittingOrder && { opacity: 0.6 }]}
                            onPress={handleSubmitOrderProof}
                            disabled={isSubmittingOrder}
                          >
                            <Ionicons name="cloud-upload" size={16} color="#171411" />
                            <Text style={styles.primaryClaimBtnText}>Kirim Bukti Pembayaran</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Form Permintaan Identitas Khusus */}
                  <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: coffee.border }}>
                    <Text style={styles.subHintLabel}>
                      Untuk permintaan identitas khusus (1–100 / brand resmi), hubungi Tim Ngopi:
                    </Text>
                    <View style={styles.claimInputRow}>
                      <TextInput
                        style={styles.claimInput}
                        value={vipReqNotes}
                        onChangeText={setVipReqNotes}
                        placeholder="Tulis permintaan identitas khusus Anda..."
                        placeholderTextColor={coffee.muted}
                      />
                      <TouchableOpacity
                        style={styles.checkBtn}
                        onPress={handleSendVipRequest}
                        disabled={isSubmittingVipReq}
                      >
                        <Text style={styles.checkBtnText}>
                          {isSubmittingVipReq ? 'Mengirim...' : 'Hubungi Tim Ngopi'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {isFounder && adminOrders.length > 0 && (
                  <View style={{ marginTop: 18, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)' }}>
                    <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '900', marginBottom: 8 }}>
                      🛡️ Antrean Verifikasi Pesanan Tim Ngopi ({adminOrders.length})
                    </Text>
                    {adminOrders.slice(0, 5).map((ord) => (
                      <View key={ord.id} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: coffee.border }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
                          {ord.order_code} • @{ord.username} • {ord.status}
                        </Text>
                        <Text style={{ color: coffee.secondary, fontSize: 11 }}>
                          Rp {Number(ord.total_transfer_idr).toLocaleString('id-ID')} | {ord.requested_number || '-'} | {ord.requested_email || '-'}
                          {ord.payment_reference ? ` | Ref: ${ord.payment_reference}` : ''}
                        </Text>
                        {(ord.status === 'pending_payment' || ord.status === 'verifying') && (
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                            <TouchableOpacity
                              style={{ backgroundColor: '#10b981', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                              onPress={() => handleAdminApproveOrder(ord.id, 'approve')}
                            >
                              <Text style={{ color: '#171411', fontSize: 11, fontWeight: '900' }}>Setujui & Aktifkan</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                              onPress={() => handleAdminApproveOrder(ord.id, 'reject')}
                            >
                              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>Tolak</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

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

                    {/* 4. Atur Info Rekening / QRIS Tujuan Transfer */}
                    <Text style={[styles.sectionLabel, { marginTop: 16, marginBottom: 6, color: '#FFD700' }]}>
                      D. Atur Info Rekening / QRIS Tujuan Transfer Pembayaran
                    </Text>
                    <TextInput
                      style={[styles.claimInput, { minHeight: 74, textAlignVertical: 'top', paddingTop: 8 }]}
                      value={paymentInfo}
                      onChangeText={setPaymentInfo}
                      placeholder="Masukkan nomor rekening Bank / E-Wallet / instruksi QRIS..."
                      placeholderTextColor={coffee.muted}
                      multiline
                    />
                    <TouchableOpacity
                      style={[styles.checkBtn, { marginTop: 8, paddingVertical: 10, backgroundColor: '#10b981' }]}
                      onPress={handleSavePaymentInfo}
                    >
                      <Text style={[styles.checkBtnText, { color: '#171411' }]}>💾 Simpan Info Rekening / Pembayaran</Text>
                    </TouchableOpacity>
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
                      loadTelecomData();
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
                      loadTelecomData();
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

                  <TouchableOpacity
                    style={[styles.mailSubBtn, { flex: 0, paddingHorizontal: 10 }]}
                    onPress={() => loadTelecomData()}
                    accessibilityLabel="Segarkan Email"
                  >
                    <Ionicons name="refresh" size={15} color={coffee.accent} />
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

                    {/* Render Email Attachments (Documents, Images, Videos) */}
                    {Array.isArray(selectedMail.attachments) && selectedMail.attachments.length > 0 && (
                      <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: coffee.border }}>
                        <Text style={{ color: coffee.accent, fontSize: 12, fontWeight: '800', marginBottom: 8 }}>
                          📎 Lampiran Berkas ({selectedMail.attachments.length}):
                        </Text>
                        {selectedMail.attachments.map((att, idx) => (
                          <View
                            key={`${att.url}-${idx}`}
                            style={{
                              backgroundColor: '#120d0a',
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: coffee.border,
                              padding: 10,
                              marginBottom: 8,
                            }}
                          >
                            {att.type === 'image' && (
                              <TouchableOpacity onPress={() => Linking.openURL(att.url)} activeOpacity={0.85}>
                                <Image
                                  source={{ uri: att.url }}
                                  style={{ width: '100%', height: 190, borderRadius: 8, marginBottom: 8, backgroundColor: '#000' }}
                                  resizeMode="contain"
                                />
                              </TouchableOpacity>
                            )}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                <Ionicons
                                  name={
                                    att.type === 'image'
                                      ? 'image-outline'
                                      : att.type === 'video'
                                      ? 'videocam-outline'
                                      : 'document-text-outline'
                                  }
                                  size={20}
                                  color={att.type === 'image' ? '#10b981' : att.type === 'video' ? '#38bdf8' : '#fbbf24'}
                                />
                                <View style={{ flex: 1 }}>
                                  <Text style={{ color: coffee.text, fontSize: 12, fontWeight: '700' }} numberOfLines={1}>
                                    {att.name || 'Lampiran Berkas'}
                                  </Text>
                                  <Text style={{ color: coffee.muted, fontSize: 10 }}>
                                    {att.type === 'image' ? 'Gambar' : att.type === 'video' ? 'Video' : 'Dokumen'}
                                    {att.size ? ` • ${(att.size / 1024).toFixed(1)} KB` : ''}
                                  </Text>
                                </View>
                              </View>
                              <TouchableOpacity
                                style={{
                                  backgroundColor: coffee.accent,
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                                onPress={() => Linking.openURL(att.url)}
                              >
                                <Ionicons name="download-outline" size={14} color="#171411" />
                                <Text style={{ color: '#171411', fontSize: 11, fontWeight: '800' }}>
                                  {att.type === 'video' ? 'Putar / Unduh' : 'Buka / Unduh'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

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
                      style={[styles.claimInput, { minHeight: 110, textAlignVertical: 'top', paddingTop: 10 }]}
                      value={composeBody}
                      onChangeText={setComposeBody}
                      placeholder="Tulis isi email Anda di sini..."
                      placeholderTextColor={coffee.muted}
                      multiline
                    />

                    {/* FITUR LAMPIRAN FILE (DOKUMEN, GAMBAR, VIDEO) */}
                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                      📎 Lampirkan Berkas (Dokumen, Gambar, atau Video — Maks 25 MB/file):
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          backgroundColor: '#120d0a',
                          borderWidth: 1,
                          borderColor: '#10b981',
                          paddingVertical: 9,
                          borderRadius: 10,
                        }}
                        onPress={handlePickMailImage}
                        disabled={isUploadingAttachment}
                      >
                        <Ionicons name="image-outline" size={16} color="#10b981" />
                        <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '800' }}>Gambar</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          backgroundColor: '#120d0a',
                          borderWidth: 1,
                          borderColor: '#38bdf8',
                          paddingVertical: 9,
                          borderRadius: 10,
                        }}
                        onPress={handlePickMailVideo}
                        disabled={isUploadingAttachment}
                      >
                        <Ionicons name="videocam-outline" size={16} color="#38bdf8" />
                        <Text style={{ color: '#38bdf8', fontSize: 11, fontWeight: '800' }}>Video</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          backgroundColor: '#120d0a',
                          borderWidth: 1,
                          borderColor: '#fbbf24',
                          paddingVertical: 9,
                          borderRadius: 10,
                        }}
                        onPress={handlePickMailDocument}
                        disabled={isUploadingAttachment}
                      >
                        <Ionicons name="document-attach-outline" size={16} color="#fbbf24" />
                        <Text style={{ color: '#fbbf24', fontSize: 11, fontWeight: '800' }}>Dokumen</Text>
                      </TouchableOpacity>
                    </View>

                    {isUploadingAttachment && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <ActivityIndicator size="small" color={coffee.accent} />
                        <Text style={{ color: coffee.accent, fontSize: 12 }}>Mengunggah lampiran berkas...</Text>
                      </View>
                    )}

                    {composeAttachments.length > 0 && (
                      <View style={{ marginTop: 10, gap: 6 }}>
                        {composeAttachments.map((att, idx) => (
                          <View
                            key={`${att.url}-${idx}`}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              backgroundColor: '#120d0a',
                              borderWidth: 1,
                              borderColor: coffee.border,
                              borderRadius: 8,
                              paddingHorizontal: 10,
                              paddingVertical: 7,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                              <Ionicons
                                name={
                                  att.type === 'image'
                                    ? 'image'
                                    : att.type === 'video'
                                    ? 'videocam'
                                    : 'document-text'
                                }
                                size={16}
                                color={att.type === 'image' ? '#10b981' : att.type === 'video' ? '#38bdf8' : '#fbbf24'}
                              />
                              <Text style={{ color: coffee.text, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                                {att.name}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() =>
                                setComposeAttachments((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))
                              }
                              style={{ padding: 4 }}
                            >
                              <Ionicons name="close-circle" size={18} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.primaryClaimBtn, (isSendingMail || isUploadingAttachment) && { opacity: 0.6 }]}
                      onPress={handleSendMail}
                      disabled={isSendingMail || isUploadingAttachment}
                    >
                      <Ionicons name="send" size={16} color="#171411" />
                      <Text style={styles.primaryClaimBtnText}>
                        {isSendingMail
                          ? 'Mengirim Email...'
                          : composeAttachments.length > 0
                          ? `Kirim Email (+${composeAttachments.length} Lampiran)`
                          : 'Kirim Email Sekarang'}
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
                            getToken().then((token) => {
                              if (token) {
                                axios
                                  .post(
                                    `${API_URL}/telecom/mail/${encodeURIComponent(item.id)}/read`,
                                    {},
                                    { headers: { Authorization: `Bearer ${token}` } }
                                  )
                                  .catch(() => {});
                              }
                            });
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
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <Text style={[styles.mailRowSubject, { flex: 1 }]} numberOfLines={1}>
                              {item.subject}
                            </Text>
                            {Array.isArray(item.attachments) && item.attachments.length > 0 && (
                              <View
                                style={{
                                  backgroundColor: 'rgba(16, 185, 129, 0.16)',
                                  borderRadius: 6,
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                }}
                              >
                                <Text style={{ color: '#10b981', fontSize: 10, fontWeight: '800' }}>
                                  📎 {item.attachments.length} file
                                </Text>
                              </View>
                            )}
                          </View>
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

