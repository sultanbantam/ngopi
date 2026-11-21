import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '../utils/prisma';

export interface MailAttachment {
  url: string;
  name: string;
  type: 'image' | 'video' | 'document';
  size?: number;
  mime_type?: string;
}

export interface NgopiMailMessage {
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
  read_at?: string | null;
  is_starred?: boolean;
  created_at: string;
}

export interface PremiumTelecomConfig {
  requirePaymentForCustomNumber: boolean;
  requirePaymentForCustomEmail: boolean;
  customEmailPriceIdr: number;
  customNumberRegularPriceIdr: number;
  customNumberSpecialPriceIdr: number;
  bundleNumberAndEmailPriceIdr: number;
  vipNumberPriceIdr: number;
  customNumberPricePoints: number;
  customEmailPricePoints: number;
  paymentInfo?: string;
}

export interface IdentityPackageDTO {
  code: string;
  name: string;
  description: string;
  price_idr: number;
  max_price_idr?: number;
  category: 'number_regular' | 'email_personal' | 'bundle' | 'number_special' | 'vip_inquiry';
  badge?: string;
  active: boolean;
}

export type IdentityOrderStatus =
  | 'pending_payment'
  | 'verifying'
  | 'paid'
  | 'activated'
  | 'expired'
  | 'rejected'
  | 'cancelled';

export interface IdentityOrderDTO {
  id: string;
  order_code: string;
  user_id: string;
  username?: string;
  package_code: string;
  requested_number?: string | null;
  requested_email?: string | null;
  amount_idr: number;
  unique_code: number;
  total_transfer_idr: number;
  payment_method: string;
  payment_reference?: string | null;
  proof_url?: string | null;
  bank_sender_name?: string | null;
  status: IdentityOrderStatus;
  reserved_until: string;
  paid_at?: string | null;
  activated_at?: string | null;
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VipIdentityRequestDTO {
  id: string;
  user_id: string;
  username?: string;
  requested_number?: string | null;
  requested_email?: string | null;
  notes: string;
  status: 'pending' | 'reviewed' | 'approved' | 'rejected';
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdentityAuditLogDTO {
  id: string;
  actor_user_id: string;
  target_user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  detail?: Record<string, unknown>;
  created_at: string;
}

interface TelecomStoreData {
  customNumbers: Record<string, string>; // userId -> ngopi_number
  vipNumbersUnlockedByFounder: Record<string, string>; // number (1..100) -> userId
  customEmails: Record<string, string>; // userId -> email local-part (before @ngopi.top)
  vipEmailsUnlockedByFounder: Record<string, string>; // local-part -> userId
  extraLockedEmails: string[]; // additional email local-parts locked by Founder
  premiumConfig?: PremiumTelecomConfig;
  mails: NgopiMailMessage[];
  packages?: IdentityPackageDTO[];
  orders?: IdentityOrderDTO[];
  vipRequests?: VipIdentityRequestDTO[];
  auditLogs?: IdentityAuditLogDTO[];
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
  let result: string = firstDigits[h1 % 4] || '7';
  let state = (h1 ^ h2) >>> 0;
  for (let i = 1; i < 10; i++) {
    state = (Math.imul(state, 1664525) + 1013904223 + i * 97) >>> 0;
    let d = String((state % 9) + 1);
    const lastChar = result.charAt(result.length - 1);
    if (d === lastChar) {
      d = String(((Number(d) + 3) % 9) + 1);
    }
    if (result.length >= 1 && Math.abs(Number(d) - Number(lastChar)) === 1) {
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
    let c = CONSONANTS.charAt(state % CONSONANTS.length) || 'x';
    if (prefix.length > 0 && c === prefix.charAt(prefix.length - 1)) {
      c = CONSONANTS.charAt((state + 7) % CONSONANTS.length) || 'k';
    }
    prefix += c;
  }
  return `${prefix}@ngopi.top`;
}

export const DEFAULT_LOCKED_EMAIL_PREFIXES = [
  '0',
  'founder',
  'warung',
  'admin',
  'superadmin',
  'owner',
  'ceo',
  'cto',
  'cfo',
  'official',
  'cs',
  'support',
  'help',
  'info',
  'contact',
  'billing',
  'payment',
  'finance',
  'security',
  'noc',
  'legal',
  'hr',
  'pr',
  'marketing',
  'sales',
  'warkop',
  'ngopi',
  'ngopai',
  'bamboochain',
  'bmc',
  'mail',
  'email',
  'postmaster',
  'hostmaster',
  'webmaster',
  'noreply',
  'no-reply',
  'system',
  'root',
  'bot',
  'vip',
  'vvip',
  'premium',
  'partner',
  'merchant',
  'cafe',
  'kopi',
  'indonesia',
  'nusantara',
].map((s) => s.toLowerCase());

export class TelecomService {
  private static instance: TelecomService;
  private dataFilePath: string;
  private customNumbers: Map<string, string> = new Map();
  private vipUnlocked: Map<string, string> = new Map();
  private customEmails: Map<string, string> = new Map();
  private vipEmailsUnlocked: Map<string, string> = new Map();
  private extraLockedEmails: Set<string> = new Set();
  private premiumConfig: PremiumTelecomConfig = {
    requirePaymentForCustomNumber: true,
    requirePaymentForCustomEmail: true,
    customEmailPriceIdr: 25000,
    customNumberRegularPriceIdr: 35000,
    customNumberSpecialPriceIdr: 250000,
    bundleNumberAndEmailPriceIdr: 49000,
    vipNumberPriceIdr: 1000000,
    customNumberPricePoints: 1000,
    customEmailPricePoints: 1000,
    paymentInfo:
      '• Bank Tujuan: Bank BRI\n• Nomor Rekening: 141101000456562\n• Atas Nama: Yayasan Sabumi Nusantara Jaya\n• Konfirmasi Pembayaran: Ke Akun Founder (#0 • warung@ngopi.top) atau WhatsApp: 08174139994',
  };
  private mails: NgopiMailMessage[] = [];
  private packages: IdentityPackageDTO[] = [
    {
      code: 'number_regular',
      name: 'Nomor Pilihan Reguler (4–6 Angka)',
      description: 'Nomor Ngopi pilihan yang mudah diingat (minimal 4–6 angka, mulai dari 101).',
      price_idr: 35000,
      category: 'number_regular',
      badge: 'Populer',
      active: true,
    },
    {
      code: 'email_personal',
      name: 'Email Pilihan Personal (@ngopi.top)',
      description: 'Alamat email sesuai nama atau brand Anda di @ngopi.top.',
      price_idr: 25000,
      category: 'email_personal',
      badge: 'Hemat',
      active: true,
    },
    {
      code: 'bundle_identity',
      name: 'Paket Bundling Identitas (Nomor + Email)',
      description: 'Dapatkan Nomor Pilihan Reguler + Email Pilihan @ngopi.top dalam satu paket.',
      price_idr: 49000,
      category: 'bundle',
      badge: 'Terlaris',
      active: true,
    },
    {
      code: 'number_special',
      name: 'Nomor Pilihan Spesial (3 Angka / Kembar)',
      description: 'Nomor pilihan 3 digit (101–999) atau pola kembar eksklusif (misal 777, 8888, 9999).',
      price_idr: 250000,
      max_price_idr: 1000000,
      category: 'number_special',
      badge: 'Eksklusif',
      active: true,
    },
    {
      code: 'vip_inquiry',
      name: 'Identitas Khusus / Brand & VIP',
      description: 'Untuk permintaan identitas khusus atau nomor singkat 1–100, ajukan ke Tim Ngopi.',
      price_idr: 1000000,
      category: 'vip_inquiry',
      badge: 'Tim Ngopi',
      active: true,
    },
  ];
  private orders: IdentityOrderDTO[] = [];
  private vipRequests: VipIdentityRequestDTO[] = [];
  private auditLogs: IdentityAuditLogDTO[] = [];
  private checkoutLocks: Set<string> = new Set();

  private constructor() {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dataFilePath = path.join(dataDir, 'telecom_store.json');
    this.loadFromDisk();
  }

  public static getInstance(): TelecomService {
    if (!TelecomService.instance) {
      TelecomService.instance = new TelecomService();
    }
    return TelecomService.instance;
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.dataFilePath)) {
        const raw = fs.readFileSync(this.dataFilePath, 'utf8');
        const parsed: TelecomStoreData = JSON.parse(raw);
        if (parsed.customNumbers) {
          Object.entries(parsed.customNumbers).forEach(([uid, num]) => {
            this.customNumbers.set(uid, String(num));
          });
        }
        if (parsed.vipNumbersUnlockedByFounder) {
          Object.entries(parsed.vipNumbersUnlockedByFounder).forEach(([num, uid]) => {
            this.vipUnlocked.set(String(num), uid);
          });
        }
        if (parsed.customEmails) {
          Object.entries(parsed.customEmails).forEach(([uid, handle]) => {
            this.customEmails.set(uid, String(handle).toLowerCase());
          });
        }
        if (parsed.vipEmailsUnlockedByFounder) {
          Object.entries(parsed.vipEmailsUnlockedByFounder).forEach(([handle, uid]) => {
            this.vipEmailsUnlocked.set(String(handle).toLowerCase(), uid);
          });
        }
        if (Array.isArray(parsed.extraLockedEmails)) {
          parsed.extraLockedEmails.forEach((item) => {
            const clean = String(item || '').trim().toLowerCase();
            if (clean) this.extraLockedEmails.add(clean);
          });
        }
        if (parsed.premiumConfig) {
          this.premiumConfig = { ...this.premiumConfig, ...parsed.premiumConfig };
          if (
            !this.premiumConfig.paymentInfo ||
            this.premiumConfig.paymentInfo.includes('Tujuan Transfer (Bank / QRIS')
          ) {
            this.premiumConfig.paymentInfo =
              '• Bank Tujuan: Bank BRI\n• Nomor Rekening: 141101000456562\n• Atas Nama: Yayasan Sabumi Nusantara Jaya\n• Konfirmasi Pembayaran: Ke Akun Founder (#0 • warung@ngopi.top) atau WhatsApp: 08174139994';
          }
        }
        if (Array.isArray(parsed.mails)) {
          this.mails = parsed.mails;
        }
        if (Array.isArray(parsed.packages) && parsed.packages.length > 0) {
          this.packages = parsed.packages;
        }
        if (Array.isArray(parsed.orders)) {
          this.orders = parsed.orders;
        }
        if (Array.isArray(parsed.vipRequests)) {
          this.vipRequests = parsed.vipRequests;
        }
        if (Array.isArray(parsed.auditLogs)) {
          this.auditLogs = parsed.auditLogs;
        }
      }
    } catch (err) {
      console.warn('[TelecomService] Failed to load store from disk:', err);
    }
  }

  private saveToDisk(): void {
    try {
      const payload: TelecomStoreData = {
        customNumbers: Object.fromEntries(this.customNumbers.entries()),
        vipNumbersUnlockedByFounder: Object.fromEntries(this.vipUnlocked.entries()),
        customEmails: Object.fromEntries(this.customEmails.entries()),
        vipEmailsUnlockedByFounder: Object.fromEntries(this.vipEmailsUnlocked.entries()),
        extraLockedEmails: Array.from(this.extraLockedEmails.values()),
        premiumConfig: this.premiumConfig,
        mails: this.mails.slice(0, 5000),
        packages: this.packages,
        orders: this.orders.slice(0, 5000),
        vipRequests: this.vipRequests.slice(0, 2000),
        auditLogs: this.auditLogs.slice(0, 5000),
      };
      fs.writeFileSync(this.dataFilePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      console.warn('[TelecomService] Failed to save store to disk:', err);
    }
  }

  public isFounderUser(user: { username?: string | null; role?: string | null; bmc_id?: number | null }): boolean {
    const uname = String(user.username || '').trim().toLowerCase();
    const role = String(user.role || '').trim().toLowerCase();
    return uname === 'warung' || uname === 'founder' || uname === 'ngopi' || uname === 'admin' || role === 'admin' || role === 'superadmin' || user.bmc_id === 1;
  }

  public getLockedEmailPrefixes(): string[] {
    const combined = new Set<string>([...DEFAULT_LOCKED_EMAIL_PREFIXES, ...this.extraLockedEmails]);
    return Array.from(combined.values());
  }

  public isEmailPrefixLocked(prefixRaw: string, requestingUserId?: string, isFounder?: boolean): boolean {
    if (isFounder) return false;
    const clean = String(prefixRaw || '')
      .trim()
      .toLowerCase()
      .replace(/^@/, '')
      .replace(/@ngopi\.top$/i, '');
    if (!clean) return true;

    if (requestingUserId && this.vipEmailsUnlocked.get(clean) === requestingUserId) {
      return false;
    }

    if (/^\d+$/.test(clean)) {
      const num = Number(clean);
      if (num >= 0 && num <= 100) {
        if (requestingUserId && this.vipUnlocked.get(String(num)) === requestingUserId) {
          return false;
        }
        return true;
      }
    }

    if (DEFAULT_LOCKED_EMAIL_PREFIXES.includes(clean) || this.extraLockedEmails.has(clean)) {
      return true;
    }
    return false;
  }

  /**
   * Default email for regular users is a consonant-only hard-to-memorize email (e.g. xkqzvtrmpbn@ngopi.top)
   * unless they are Founder (warung@ngopi.top) or have a paid/unlocked custom email!
   */
  public formatEmail(username: string, userId?: string): string {
    if (userId && this.customEmails.has(userId)) {
      const customPrefix = this.customEmails.get(userId)!;
      return `${customPrefix}@ngopi.top`;
    }
    const clean = String(username || 'user').trim().toLowerCase().replace(/^@/, '');
    if (clean === 'warung' || clean === 'founder' || clean === 'ngopi') {
      return 'warung@ngopi.top';
    }
    return generateUglyConsonantEmail(clean || userId || 'user');
  }

  public getPremiumConfig(): PremiumTelecomConfig {
    return this.premiumConfig;
  }

  public updatePremiumConfigByFounder(
    founderUser: { id: string; username: string; role?: string | null; bmc_id?: number | null },
    partial: Partial<PremiumTelecomConfig>
  ): { success: boolean; config?: PremiumTelecomConfig; error?: string } {
    if (!this.isFounderUser(founderUser)) {
      return { success: false, error: 'Hanya Founder (#0) yang dapat mengatur harga & mode Fitur Premium.' };
    }
    this.premiumConfig = {
      ...this.premiumConfig,
      ...partial,
    };
    this.saveToDisk();
    return { success: true, config: this.premiumConfig };
  }

  /**
   * Compute a user's active Ngopi Number:
   * - Founder (@ngopi / bmc_id === 1) gets "0" exclusively
   * - Paid/VIP custom number if claimed/assigned
   * - Otherwise deterministic 10-digit automatic number
   */
  public getNumberForUser(
    user: { id: string; username?: string | null; role?: string | null; bmc_id?: number | null }
  ): string {
    const custom = this.customNumbers.get(user.id);
    if (custom !== undefined && custom !== '') {
      return custom;
    }

    const uname = String(user.username || '').trim().toLowerCase();
    if (uname === 'ngopi' || uname === 'founder' || user.bmc_id === 1) {
      return '0';
    }
    if (uname === 'warung') {
      return '100';
    }

    return generateUglyDefaultNumber(uname || user.id);
  }

  private isPrimaryFounderAccount(u: { username?: string | null; bmc_id?: number | null }): boolean {
    const uname = String(u.username || '').trim().toLowerCase();
    return uname === 'ngopi' || uname === 'founder' || u.bmc_id === 1;
  }

  public buildDirectoryMap(
    users: Array<{ id: string; username: string; display_name?: string | null; role?: string | null; bmc_id?: number | null }>
  ): Map<string, { number: string; email: string }> {
    const result = new Map<string, { number: string; email: string }>();
    const usedNumbers = new Set<string>();

    // Determine primary Founder (#0) first so @ngopi / bmc_id === 1 exclusively owns #0
    const primaryFounder = users.find((u) => this.isPrimaryFounderAccount(u));
    if (primaryFounder) {
      const custom = this.customNumbers.get(primaryFounder.id);
      const customEmail = this.customEmails.get(primaryFounder.id);
      const num = custom || '0';
      const email = customEmail ? `${customEmail}@ngopi.top` : 'warung@ngopi.top';
      usedNumbers.add(num);
      result.set(primaryFounder.id, { number: num, email });
    }

    // Next pass: custom numbers & legacy 'warung' account (gets '100' if #0 is already held by @ngopi)
    for (const u of users) {
      if (result.has(u.id)) continue;
      const custom = this.customNumbers.get(u.id);
      const email = this.formatEmail(u.username, u.id);
      const unameLower = u.username.trim().toLowerCase();
      if (custom) {
        usedNumbers.add(custom);
        result.set(u.id, { number: custom, email });
      } else if (unameLower === 'warung') {
        const warungNum = usedNumbers.has('0') ? '100' : '0';
        usedNumbers.add(warungNum);
        result.set(u.id, { number: warungNum, email: this.customEmails.get(u.id) ? `${this.customEmails.get(u.id)}@ngopi.top` : 'warung-ops@ngopi.top' });
      }
    }

    // Final pass: deterministic automatic 10-digit number & automatic email for everyone else
    for (const u of users) {
      if (result.has(u.id)) continue;
      let autoNum = generateUglyDefaultNumber(u.username || u.id);
      let salt = 1;
      while (usedNumbers.has(autoNum)) {
        autoNum = generateUglyDefaultNumber(`${u.username}_${salt}`);
        salt += 1;
      }
      usedNumbers.add(autoNum);
      result.set(u.id, {
        number: autoNum,
        email: this.formatEmail(u.username, u.id),
      });
    }

    return result;
  }

  public normalizeNumberInput(raw: string): { valid: boolean; normalized: string; numericValue: number; error?: string } {
    const trimmed = String(raw ?? '').trim().replace(/^#/, '');
    if (!/^\d+$/.test(trimmed)) {
      return { valid: false, normalized: '', numericValue: -1, error: 'Nomor Ngopi hanya boleh berisi angka (tanpa huruf atau simbol).' };
    }
    if (trimmed.length > 12) {
      return { valid: false, normalized: '', numericValue: -1, error: 'Nomor Ngopi maksimal 12 angka.' };
    }
    const normalized = trimmed.replace(/^0+/, '') || '0';
    const numericValue = Number(normalized);
    if (!Number.isSafeInteger(numericValue) || numericValue < 0) {
      return { valid: false, normalized: '', numericValue: -1, error: 'Nomor tidak valid.' };
    }
    return { valid: true, normalized, numericValue };
  }

  public async checkNumberAvailability(
    rawNumber: string,
    requestingUser: { id: string; username: string; role?: string | null; bmc_id?: number | null }
  ): Promise<{ available: boolean; normalized: string; lockedVip: boolean; reason?: string; ownerUsername?: string; suggestedPriceIdr?: number }> {
    const parsed = this.normalizeNumberInput(rawNumber);
    if (!parsed.valid) {
      return { available: false, normalized: '', lockedVip: false, reason: parsed.error };
    }

    const { normalized, numericValue } = parsed;
    const isFounder = this.isFounderUser(requestingUser);

    if (numericValue === 0 && !isFounder) {
      return {
        available: false,
        normalized,
        lockedVip: true,
        reason: 'Nomor 0 dialokasikan untuk operasional resmi Ngopi.',
      };
    }

    if (numericValue >= 1 && numericValue <= 100 && !isFounder) {
      const unlockedForUser = this.vipUnlocked.get(normalized);
      if (unlockedForUser !== requestingUser.id) {
        return {
          available: false,
          normalized,
          lockedVip: true,
          suggestedPriceIdr: this.premiumConfig.vipNumberPriceIdr,
          reason: `Nomor ${normalized} dialokasikan untuk kebutuhan resmi Ngopi. Untuk permintaan identitas khusus, hubungi Tim Ngopi.`,
        };
      }
    }

    // Check active non-expired reservations
    const activeReservation = this.findActiveOrderReservation('number', normalized, requestingUser.id);
    if (activeReservation) {
      return {
        available: false,
        normalized,
        lockedVip: false,
        reason: `Nomor Pilihan ${normalized} sedang dalam proses reservasi oleh pengguna lain.`,
      };
    }

    const allUsers = await prisma.user.findMany({
      select: { id: true, username: true, display_name: true, role: true, bmc_id: true },
    });
    const dir = this.buildDirectoryMap(allUsers);

    for (const u of allUsers) {
      const entry = dir.get(u.id);
      if (entry && entry.number === normalized) {
        if (u.id === requestingUser.id) {
          return { available: true, normalized, lockedVip: false, reason: 'Ini adalah Nomor Ngopi aktif Anda saat ini.' };
        }
        return {
          available: false,
          normalized,
          lockedVip: false,
          reason: `Nomor ${normalized} sudah digunakan oleh @${u.username}.`,
          ownerUsername: u.username,
        };
      }
    }

    const isSpecial = normalized.length <= 3 || /^(\d)\1+$/.test(normalized);
    const price = isSpecial ? this.premiumConfig.customNumberSpecialPriceIdr : this.premiumConfig.customNumberRegularPriceIdr;

    return {
      available: true,
      normalized,
      lockedVip: false,
      suggestedPriceIdr: price,
    };
  }

  public async claimNumber(
    requestingUser: { id: string; username: string; role?: string | null; bmc_id?: number | null },
    rawNumber: string
  ): Promise<{ success: boolean; number?: string; error?: string }> {
    const isFounder = this.isFounderUser(requestingUser);
    if (this.premiumConfig.requirePaymentForCustomNumber && !isFounder) {
      return {
        success: false,
        error: `Nomor Pilihan tersedia melalui paket upgrade mulai Rp ${this.premiumConfig.customNumberRegularPriceIdr.toLocaleString('id-ID')} atau Paket Bundling Identitas Rp ${this.premiumConfig.bundleNumberAndEmailPriceIdr.toLocaleString('id-ID')}. Silakan buat pesanan pada tab Identitas Ngopi.`,
      };
    }

    const check = await this.checkNumberAvailability(rawNumber, requestingUser);
    if (!check.available) {
      return { success: false, error: check.reason || 'Nomor tidak tersedia.' };
    }

    this.customNumbers.set(requestingUser.id, check.normalized);
    this.saveToDisk();
    return { success: true, number: check.normalized };
  }

  public async checkEmailAvailability(
    rawEmailOrPrefix: string,
    requestingUser: { id: string; username: string; role?: string | null; bmc_id?: number | null }
  ): Promise<{ available: boolean; normalizedEmail: string; prefix: string; lockedVip: boolean; reason?: string; suggestedPriceIdr?: number }> {
    const cleanPrefix = String(rawEmailOrPrefix || '')
      .trim()
      .toLowerCase()
      .replace(/^@/, '')
      .replace(/@ngopi\.top$/i, '');

    if (!cleanPrefix || cleanPrefix.length < 2 || cleanPrefix.length > 30 || !/^[a-z0-9._-]+$/.test(cleanPrefix)) {
      return {
        available: false,
        normalizedEmail: '',
        prefix: cleanPrefix,
        lockedVip: false,
        reason: 'Nama email hanya boleh berisi huruf kecil, angka, titik (.), garis bawah (_), atau strip (-) dengan panjang 2–30 karakter.',
      };
    }

    const isFounder = this.isFounderUser(requestingUser);
    const normalizedEmail = `${cleanPrefix}@ngopi.top`;

    if (this.isEmailPrefixLocked(cleanPrefix, requestingUser.id, isFounder)) {
      return {
        available: false,
        normalizedEmail,
        prefix: cleanPrefix,
        lockedVip: true,
        reason: `Alamat "${normalizedEmail}" dialokasikan untuk operasional resmi Ngopi. Untuk permintaan identitas khusus, hubungi Tim Ngopi.`,
      };
    }

    const activeReservation = this.findActiveOrderReservation('email', cleanPrefix, requestingUser.id);
    if (activeReservation) {
      return {
        available: false,
        normalizedEmail,
        prefix: cleanPrefix,
        lockedVip: false,
        reason: `Alamat ${normalizedEmail} sedang dalam proses reservasi oleh pengguna lain.`,
      };
    }

    const allUsers = await prisma.user.findMany({
      select: { id: true, username: true, display_name: true, role: true, bmc_id: true },
    });
    const dir = this.buildDirectoryMap(allUsers);

    for (const u of allUsers) {
      const entry = dir.get(u.id);
      const uActivePrefix = entry ? entry.email.replace(/@ngopi\.top$/i, '').toLowerCase() : '';
      if (uActivePrefix === cleanPrefix && u.id !== requestingUser.id) {
        return {
          available: false,
          normalizedEmail,
          prefix: cleanPrefix,
          lockedVip: false,
          reason: `Alamat ${normalizedEmail} sudah digunakan oleh @${u.username}.`,
        };
      }
    }

    return {
      available: true,
      normalizedEmail,
      prefix: cleanPrefix,
      lockedVip: false,
      suggestedPriceIdr: this.premiumConfig.customEmailPriceIdr,
      reason: `Alamat ${normalizedEmail} tersedia (Biaya Aktivasi Email Pilihan: Rp ${this.premiumConfig.customEmailPriceIdr.toLocaleString('id-ID')}).`,
    };
  }

  public async claimCustomEmail(
    requestingUser: { id: string; username: string; role?: string | null; bmc_id?: number | null },
    rawEmailOrPrefix: string
  ): Promise<{ success: boolean; email?: string; error?: string }> {
    const isFounder = this.isFounderUser(requestingUser);
    if (this.premiumConfig.requirePaymentForCustomEmail && !isFounder) {
      return {
        success: false,
        error: `Email Pilihan @ngopi.top tersedia melalui paket upgrade Rp ${this.premiumConfig.customEmailPriceIdr.toLocaleString('id-ID')} atau Paket Bundling Identitas Rp ${this.premiumConfig.bundleNumberAndEmailPriceIdr.toLocaleString('id-ID')}. Silakan buat pesanan pada tab Identitas Ngopi.`,
      };
    }

    const check = await this.checkEmailAvailability(rawEmailOrPrefix, requestingUser);
    if (!check.available) {
      return { success: false, error: check.reason || 'Nama email tidak tersedia.' };
    }

    this.customEmails.set(requestingUser.id, check.prefix);
    this.saveToDisk();
    return { success: true, email: check.normalizedEmail };
  }

  public async assignVipNumberByFounder(
    founderUser: { id: string; username: string; role?: string | null; bmc_id?: number | null },
    targetUsernameOrId: string,
    rawNumber: string
  ): Promise<{ success: boolean; number?: string; targetUsername?: string; error?: string }> {
    if (!this.isFounderUser(founderUser)) {
      return { success: false, error: 'Hanya Founder yang dapat membuka dan memberikan nomor kepada member.' };
    }

    const parsed = this.normalizeNumberInput(rawNumber);
    if (!parsed.valid) {
      return { success: false, error: parsed.error };
    }

    const cleanTarget = String(targetUsernameOrId || '').trim().replace(/^@/, '');
    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: cleanTarget },
          { username: { equals: cleanTarget, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true, display_name: true },
    });

    if (!targetUser) {
      return { success: false, error: `User "${cleanTarget}" tidak ditemukan.` };
    }

    for (const [uid, num] of this.customNumbers.entries()) {
      if (num === parsed.normalized && uid !== targetUser.id) {
        this.customNumbers.delete(uid);
      }
    }

    this.vipUnlocked.set(parsed.normalized, targetUser.id);
    this.customNumbers.set(targetUser.id, parsed.normalized);
    this.saveToDisk();

    return {
      success: true,
      number: parsed.normalized,
      targetUsername: targetUser.username,
    };
  }

  public async manageEmailLockByFounder(
    founderUser: { id: string; username: string; role?: string | null; bmc_id?: number | null },
    action: 'lock' | 'unlock_assign',
    emailPrefixRaw: string,
    targetUsernameOrId?: string
  ): Promise<{ success: boolean; email?: string; targetUsername?: string; lockedPrefixes?: string[]; error?: string }> {
    if (!this.isFounderUser(founderUser)) {
      return { success: false, error: 'Hanya Founder (#0) yang dapat mengunci atau memberikan email @ngopi.top.' };
    }

    const cleanPrefix = String(emailPrefixRaw || '')
      .trim()
      .toLowerCase()
      .replace(/^@/, '')
      .replace(/@ngopi\.top$/i, '');

    if (!cleanPrefix || !/^[a-z0-9._-]+$/.test(cleanPrefix)) {
      return { success: false, error: 'Format nama email tidak valid.' };
    }

    if (action === 'lock') {
      this.extraLockedEmails.add(cleanPrefix);
      this.vipEmailsUnlocked.delete(cleanPrefix);
      this.saveToDisk();
      return {
        success: true,
        email: `${cleanPrefix}@ngopi.top`,
        lockedPrefixes: this.getLockedEmailPrefixes(),
      };
    }

    const cleanTarget = String(targetUsernameOrId || '').trim().replace(/^@/, '');
    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: cleanTarget },
          { username: { equals: cleanTarget, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true },
    });

    if (!targetUser) {
      return { success: false, error: `User "${cleanTarget}" tidak ditemukan.` };
    }

    for (const [uid, pref] of this.customEmails.entries()) {
      if (pref === cleanPrefix && uid !== targetUser.id) {
        this.customEmails.delete(uid);
      }
    }

    this.vipEmailsUnlocked.set(cleanPrefix, targetUser.id);
    this.customEmails.set(targetUser.id, cleanPrefix);
    this.saveToDisk();

    return {
      success: true,
      email: `${cleanPrefix}@ngopi.top`,
      targetUsername: targetUser.username,
      lockedPrefixes: this.getLockedEmailPrefixes(),
    };
  }

  public async resolveUserByIdentifier(identifier: string): Promise<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bmc_id: number;
    role: string;
    ngopi_number: string;
    ngopi_email: string;
  } | null> {
    const raw = String(identifier || '').trim();
    if (!raw) return null;

    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        display_name: true,
        avatar_url: true,
        bmc_id: true,
        role: true,
      },
    });
    const dir = this.buildDirectoryMap(allUsers);

    const cleanedNumber = raw.replace(/^#/, '');
    const cleanedEmail = raw.toLowerCase();
    const cleanedUsername = raw.replace(/^@/, '').replace(/@ngopi\.top$/i, '').toLowerCase();

    for (const u of allUsers) {
      const meta = dir.get(u.id) || { number: this.getNumberForUser(u), email: this.formatEmail(u.username, u.id) };
      const numberEmail = `${meta.number}@ngopi.top`;
      if (
        meta.number === cleanedNumber ||
        meta.email.toLowerCase() === cleanedEmail ||
        numberEmail === cleanedEmail ||
        u.username.toLowerCase() === cleanedUsername ||
        u.id === raw
      ) {
        return {
          ...u,
          ngopi_number: meta.number,
          ngopi_email: meta.email,
        };
      }
    }

    return null;
  }

  private sanitizePlainText(input: string): string {
    return String(input || '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim();
  }

  private ensureWelcomeMail(user: { id: string; username: string; display_name?: string | null }, ngopiNumber: string, ngopiEmail: string): void {
    const hasWelcome = this.mails.some((m) => m.to_user_id === user.id && m.id.startsWith('welcome-'));
    if (hasWelcome) return;

    const welcomeMail: NgopiMailMessage = {
      id: `welcome-${user.id}`,
      from_user_id: 'founder-0',
      from_username: 'ngopi',
      from_display_name: 'Tim Ngopi (#0)',
      from_email: 'warung@ngopi.top',
      from_number: '0',
      to_user_id: user.id,
      to_username: user.username,
      to_email: ngopiEmail,
      to_number: ngopiNumber,
      subject: `Selamat Datang di Identitas Ngopi #${ngopiNumber}! ☕`,
      body: `Halo ${user.display_name || user.username}!\n\nBegitu bergabung, kamu langsung mendapat Nomor Ngopi Otomatis (${ngopiNumber}) dan Email Ngopi (${ngopiEmail}). Tidak perlu mengatur apa-apa—langsung bisa dipakai.\n\nMau pakai nomor pilihan sendiri atau nama email yang lebih mudah dikenali? Kamu bisa cek ketersediaannya di tab "Pilih Nomor"!\n\nSalam hangat,\nTim Ngopi (#0 • warung@ngopi.top)`,
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
    };

    this.mails.unshift(welcomeMail);
    this.saveToDisk();
  }

  public isInboxOwnerOfMail(
    mail: NgopiMailMessage,
    user: { id: string; username?: string | null; role?: string | null; bmc_id?: number | null },
    ngopiNumber: string,
    ngopiEmail: string
  ): boolean {
    if (mail.to_user_id === user.id) return true;
    if (mail.to_email.toLowerCase() === ngopiEmail.toLowerCase()) return true;
    if (mail.to_number === ngopiNumber) return true;
    const isFounder = this.isFounderUser(user) || ngopiNumber === '0' || ngopiEmail.toLowerCase() === 'warung@ngopi.top';
    const founderEmails = new Set(['warung@ngopi.top', 'founder@ngopi.top', 'ngopi@ngopi.top', 'admin@ngopi.top', '0@ngopi.top']);
    if (isFounder && (mail.to_number === '0' || founderEmails.has(mail.to_email.toLowerCase()))) {
      return true;
    }
    return false;
  }

  public getInboxForUser(
    user: { id: string; username: string; display_name?: string | null; role?: string | null; bmc_id?: number | null },
    ngopiNumber: string,
    ngopiEmail: string,
    filter: 'all' | 'unread' = 'all'
  ): NgopiMailMessage[] {
    this.ensureWelcomeMail(user, ngopiNumber, ngopiEmail);
    return this.mails
      .filter((m) => {
        if (!this.isInboxOwnerOfMail(m, user, ngopiNumber, ngopiEmail)) return false;
        if (filter === 'unread') {
          return !m.is_read && !m.read_at;
        }
        return true;
      })
      .map((m) => ({
        ...m,
        is_read: Boolean(m.is_read || m.read_at),
        read_at: m.read_at ?? null,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public getUnreadCountForUser(
    user: { id: string; username: string; display_name?: string | null; role?: string | null; bmc_id?: number | null },
    ngopiNumber: string,
    ngopiEmail: string
  ): number {
    return this.getInboxForUser(user, ngopiNumber, ngopiEmail, 'unread').length;
  }

  public getMailDetailForUser(
    user: { id: string; username: string; display_name?: string | null; role?: string | null; bmc_id?: number | null },
    ngopiNumber: string,
    ngopiEmail: string,
    mailId: string
  ): NgopiMailMessage | null {
    const found = this.mails.find((m) => m.id === mailId);
    if (!found) return null;
    const isOwner = this.isInboxOwnerOfMail(found, user, ngopiNumber, ngopiEmail) || found.from_user_id === user.id;
    if (!isOwner) return null;
    return {
      ...found,
      is_read: Boolean(found.is_read || found.read_at),
      read_at: found.read_at ?? null,
    };
  }

  public getSentForUser(userId: string): NgopiMailMessage[] {
    return this.mails
      .filter((m) => m.from_user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async sendMail(
    senderUser: { id: string; username: string; display_name?: string | null; role?: string | null; bmc_id?: number | null },
    toIdentifier: string,
    subject: string,
    body: string,
    rawAttachments?: MailAttachment[]
  ): Promise<{ success: boolean; mail?: NgopiMailMessage; error?: string }> {
    const cleanTo = String(toIdentifier || '').trim();
    const cleanSubject = this.sanitizePlainText(subject) || '(Tanpa Subjek)';
    const cleanBody = this.sanitizePlainText(body);

    const sanitizedAttachments: MailAttachment[] = Array.isArray(rawAttachments)
      ? rawAttachments
          .filter((a) => a && typeof a.url === 'string' && a.url.trim().length > 0)
          .slice(0, 10)
          .map((a) => ({
            url: String(a.url).trim(),
            name: String(a.name || 'Lampiran').trim(),
            type: a.type === 'image' || a.type === 'video' ? a.type : 'document',
            size: typeof a.size === 'number' ? a.size : undefined,
            mime_type: typeof a.mime_type === 'string' ? a.mime_type : undefined,
          }))
      : [];

    if (!cleanTo) {
      return { success: false, error: 'Alamat tujuan (Email @ngopi.top, Email Luar, atau Nomor Ngopi) wajib diisi.' };
    }
    if (!cleanBody && sanitizedAttachments.length === 0) {
      return { success: false, error: 'Isi pesan email atau lampiran berkas tidak boleh kosong.' };
    }

    const senderResolved = await this.resolveUserByIdentifier(senderUser.id);
    const senderNumber = senderResolved?.ngopi_number || this.getNumberForUser(senderUser);
    const senderEmail = senderResolved?.ngopi_email || this.formatEmail(senderUser.username, senderUser.id);

    const isExternalEmail =
      cleanTo.includes('@') &&
      !/@(ngopi\.top|mail\.ngopi\.top)$/i.test(cleanTo);

    if (isExternalEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTo)) {
        return { success: false, error: 'Format alamat email eksternal tidak valid.' };
      }

      const extRes = await this.sendExternalEmailDirect({
        to: cleanTo.toLowerCase(),
        subject: cleanSubject,
        body: cleanBody || `(Melampirkan ${sanitizedAttachments.length} berkas)`,
        fromEmail: senderEmail,
        fromName: senderUser.display_name || senderUser.username,
        replyTo: senderEmail,
      });

      if (!extRes.sent) {
        return {
          success: false,
          error:
            extRes.error === 'SMTP_NOT_CONFIGURED'
              ? 'Gateway email eksternal (RESEND_API_KEY / BREVO_API_KEY / SMTP_HOST) belum dikonfigurasi di server. Email internal @ngopi.top tetap aktif.'
              : `Gagal mengirim email eksternal: ${extRes.error || 'Unknown error'}`,
        };
      }

      const sentExternalMail: NgopiMailMessage = {
        id: `mail-ext-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        from_user_id: senderUser.id,
        from_username: senderUser.username,
        from_display_name: senderUser.display_name || senderUser.username,
        from_email: senderEmail,
        from_number: senderNumber,
        to_user_id: `external:${cleanTo.toLowerCase()}`,
        to_username: cleanTo.toLowerCase(),
        to_email: cleanTo.toLowerCase(),
        to_number: 'EXT',
        subject: cleanSubject,
        body: cleanBody || `(Melampirkan ${sanitizedAttachments.length} berkas)`,
        attachments: sanitizedAttachments.length > 0 ? sanitizedAttachments : undefined,
        is_read: true,
        read_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      this.mails.unshift(sentExternalMail);
      this.saveToDisk();
      return { success: true, mail: sentExternalMail };
    }

    const normalizedInternalTarget = cleanTo.replace(/@mail\.ngopi\.top$/i, '@ngopi.top');
    const recipient = await this.resolveUserByIdentifier(normalizedInternalTarget);
    if (!recipient) {
      return {
        success: false,
        error: `Tujuan "${cleanTo}" tidak ditemukan. Coba periksa kembali alamat atau Nomor Ngopi tujuan.`,
      };
    }

    const newMail: NgopiMailMessage = {
      id: `mail-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      from_user_id: senderUser.id,
      from_username: senderUser.username,
      from_display_name: senderUser.display_name || senderUser.username,
      from_email: senderEmail,
      from_number: senderNumber,
      to_user_id: recipient.id,
      to_username: recipient.username,
      to_email: recipient.ngopi_email,
      to_number: recipient.ngopi_number,
      subject: cleanSubject,
      body: cleanBody || `(Melampirkan ${sanitizedAttachments.length} berkas)`,
      attachments: sanitizedAttachments.length > 0 ? sanitizedAttachments : undefined,
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
    };

    this.mails.unshift(newMail);
    this.saveToDisk();

    return { success: true, mail: newMail };
  }

  public async deliverSystemRecoveryMail(
    user: { id: string; username: string; display_name?: string | null },
    ngopiNumber: string,
    ngopiEmail: string,
    subject: string,
    body: string
  ): Promise<NgopiMailMessage> {
    const recoveryMail: NgopiMailMessage = {
      id: `mail-sec-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      from_user_id: 'system_security',
      from_username: 'security',
      from_display_name: 'Ngopi Security',
      from_email: 'security@ngopi.top',
      from_number: '0',
      to_user_id: user.id,
      to_username: user.username,
      to_email: ngopiEmail,
      to_number: ngopiNumber,
      subject: this.sanitizePlainText(subject),
      body: this.sanitizePlainText(body),
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    this.mails.unshift(recoveryMail);
    this.saveToDisk();
    return recoveryMail;
  }

  public async sendExternalEmailDirect(params: {
    to: string;
    subject: string;
    body: string;
    fromEmail?: string;
    fromName?: string;
    replyTo?: string;
  }): Promise<{ sent: boolean; provider?: string; error?: string }> {
    const { to, subject, body, fromEmail, fromName, replyTo } = params;
    const senderDomain = process.env.EXTERNAL_EMAIL_DOMAIN || 'ngopi.top';
    const configuredFrom =
      process.env.EMAIL_FROM ||
      (fromEmail && fromEmail.endsWith(`@${senderDomain}`) ? fromEmail : `noreply@${senderDomain}`);
    const fromHeader = fromName ? `${fromName} <${configuredFrom}>` : configuredFrom;

    // 1. Resend HTTP API
    if (process.env.RESEND_API_KEY) {
      try {
        await axios.post(
          'https://api.resend.com/emails',
          {
            from: fromHeader,
            to: [to],
            subject,
            text: body,
            reply_to: replyTo || fromEmail || configuredFrom,
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );
        return { sent: true, provider: 'resend' };
      } catch (err: any) {
        return { sent: false, provider: 'resend', error: err?.response?.data?.message || err?.message };
      }
    }

    // 2. Brevo HTTP API
    if (process.env.BREVO_API_KEY) {
      try {
        await axios.post(
          'https://api.brevo.com/v3/smtp/email',
          {
            sender: { name: fromName || 'Ngopi.top', email: configuredFrom },
            to: [{ email: to }],
            subject,
            textContent: body,
            replyTo: replyTo ? { email: replyTo } : undefined,
          },
          {
            headers: {
              'api-key': process.env.BREVO_API_KEY,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          }
        );
        return { sent: true, provider: 'brevo' };
      } catch (err: any) {
        return { sent: false, provider: 'brevo', error: err?.response?.data?.message || err?.message };
      }
    }

    // 3. Standard SMTP via nodemailer (if installed & SMTP_HOST configured)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });
        await transporter.sendMail({
          from: fromHeader,
          to,
          replyTo: replyTo || fromEmail,
          subject,
          text: body,
        });
        return { sent: true, provider: 'smtp' };
      } catch (err: any) {
        return { sent: false, provider: 'smtp', error: err?.message };
      }
    }

    return { sent: false, error: 'SMTP_NOT_CONFIGURED' };
  }

  public async receiveInboundExternalMail(params: {
    from: string;
    to: string;
    subject?: string;
    text?: string;
  }): Promise<{ success: boolean; mail?: NgopiMailMessage; error?: string }> {
    const rawTo = String(params.to || '').trim().toLowerCase();
    const match = rawTo.match(/<([^>]+)>/);
    const cleanTo = (match?.[1] || rawTo).replace(/@mail\.ngopi\.top$/i, '@ngopi.top');

    const recipient = await this.resolveUserByIdentifier(cleanTo);
    if (!recipient) {
      return { success: false, error: `Penerima ${cleanTo} tidak ditemukan di ngopi.top.` };
    }

    const rawFrom = String(params.from || '').trim();
    const fromMatch = rawFrom.match(/^(.*?)<([^>]+)>$/);
    const fromEmail = (fromMatch?.[2] || rawFrom).trim();
    const fromName = (fromMatch?.[1] || fromEmail.split('@')[0] || fromEmail).replace(/["']/g, '').trim() || fromEmail;

    const inboundMail: NgopiMailMessage = {
      id: `mail-in-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      from_user_id: `external:${fromEmail.toLowerCase()}`,
      from_username: fromEmail.toLowerCase(),
      from_display_name: fromName,
      from_email: fromEmail.toLowerCase(),
      from_number: 'EXT',
      to_user_id: recipient.id,
      to_username: recipient.username,
      to_email: recipient.ngopi_email,
      to_number: recipient.ngopi_number,
      subject: this.sanitizePlainText(params.subject || '(Tanpa Subjek)'),
      body: this.sanitizePlainText(params.text || ''),
      is_read: false,
      read_at: null,
      created_at: new Date().toISOString(),
    };

    this.mails.unshift(inboundMail);
    this.saveToDisk();
    return { success: true, mail: inboundMail };
  }

  public markMailRead(
    user: { id: string; username: string; role?: string | null; bmc_id?: number | null },
    ngopiNumber: string,
    ngopiEmail: string,
    mailId: string
  ): { success: boolean; changed: boolean; mail?: NgopiMailMessage; unread_count: number } {
    const found = this.mails.find((m) => m.id === mailId && this.isInboxOwnerOfMail(m, user, ngopiNumber, ngopiEmail));
    if (!found) {
      return { success: false, changed: false, unread_count: this.getUnreadCountForUser(user, ngopiNumber, ngopiEmail) };
    }
    const alreadyRead = Boolean(found.is_read || found.read_at);
    if (!alreadyRead) {
      found.is_read = true;
      found.read_at = new Date().toISOString();
      this.saveToDisk();
    }
    return {
      success: true,
      changed: !alreadyRead,
      mail: { ...found, is_read: true, read_at: found.read_at || new Date().toISOString() },
      unread_count: this.getUnreadCountForUser(user, ngopiNumber, ngopiEmail),
    };
  }

  public markMailUnread(
    user: { id: string; username: string; role?: string | null; bmc_id?: number | null },
    ngopiNumber: string,
    ngopiEmail: string,
    mailId: string
  ): { success: boolean; changed: boolean; mail?: NgopiMailMessage; unread_count: number } {
    const found = this.mails.find((m) => m.id === mailId && this.isInboxOwnerOfMail(m, user, ngopiNumber, ngopiEmail));
    if (!found) {
      return { success: false, changed: false, unread_count: this.getUnreadCountForUser(user, ngopiNumber, ngopiEmail) };
    }
    const wasRead = Boolean(found.is_read || found.read_at);
    if (wasRead) {
      found.is_read = false;
      found.read_at = null;
      this.saveToDisk();
    }
    return {
      success: true,
      changed: wasRead,
      mail: { ...found, is_read: false, read_at: null },
      unread_count: this.getUnreadCountForUser(user, ngopiNumber, ngopiEmail),
    };
  }

  public bulkUpdateMailReadStatus(
    user: { id: string; username: string; role?: string | null; bmc_id?: number | null },
    ngopiNumber: string,
    ngopiEmail: string,
    mailIds: string[],
    isRead: boolean
  ): { success: boolean; updated_count: number; unread_count: number } {
    const idSet = new Set(Array.isArray(mailIds) ? mailIds.map((id) => String(id)) : []);
    let updatedCount = 0;
    const nowIso = new Date().toISOString();

    for (const m of this.mails) {
      if (!idSet.has(m.id)) continue;
      if (!this.isInboxOwnerOfMail(m, user, ngopiNumber, ngopiEmail)) continue;
      const currentlyRead = Boolean(m.is_read || m.read_at);
      if (currentlyRead !== isRead) {
        m.is_read = isRead;
        m.read_at = isRead ? nowIso : null;
        updatedCount += 1;
      }
    }

    if (updatedCount > 0) {
      this.saveToDisk();
    }

    return {
      success: true,
      updated_count: updatedCount,
      unread_count: this.getUnreadCountForUser(user, ngopiNumber, ngopiEmail),
    };
  }

  public deleteMail(userId: string, mailId: string): boolean {
    const idx = this.mails.findIndex((m) => m.id === mailId && (m.to_user_id === userId || m.from_user_id === userId));
    if (idx === -1) return false;
    this.mails.splice(idx, 1);
    this.saveToDisk();
    return true;
  }

  // =========================================================================
  // IDENTITAS NGOPI: PACKAGES, RESERVATIONS, ORDERS, WEBHOOKS & AUDIT LOGS
  // =========================================================================

  private appendAuditLog(
    actorUserId: string,
    action: string,
    entityType: string,
    entityId?: string,
    targetUserId?: string,
    detail?: Record<string, unknown>
  ): void {
    const entry: IdentityAuditLogDTO = {
      id: `audit-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      actor_user_id: actorUserId,
      target_user_id: targetUserId || null,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      detail,
      created_at: new Date().toISOString(),
    };
    this.auditLogs.unshift(entry);
    // Best-effort persist to Prisma if table exists (non-blocking)
    try {
      const p: any = prisma as any;
      if (p.identityAuditLog?.create) {
        p.identityAuditLog
          .create({
            data: {
              actor_id: actorUserId,
              target_user_id: targetUserId || null,
              action,
              identity_type: entityType,
              identity_value: entityId || null,
              metadata: (detail || {}) as any,
            },
          })
          .catch(() => {});
      }
    } catch {
      // Ignore if DB not migrated yet
    }
  }

  public expireStaleReservations(): number {
    const now = Date.now();
    let expiredCount = 0;
    for (const order of this.orders) {
      if (order.status === 'pending_payment' && new Date(order.reserved_until).getTime() <= now) {
        order.status = 'expired';
        order.updated_at = new Date().toISOString();
        expiredCount += 1;
        this.appendAuditLog('system', 'RESERVATION_EXPIRED', 'IdentityOrder', order.id, order.user_id, {
          order_code: order.order_code,
          requested_number: order.requested_number,
          requested_email: order.requested_email,
        });
      }
    }
    if (expiredCount > 0) {
      this.saveToDisk();
    }
    return expiredCount;
  }

  private findActiveOrderReservation(
    kind: 'number' | 'email',
    value: string,
    excludeUserId?: string
  ): IdentityOrderDTO | undefined {
    this.expireStaleReservations();
    const clean = value.trim().toLowerCase();
    return this.orders.find((o) => {
      if (o.status !== 'pending_payment' && o.status !== 'verifying' && o.status !== 'paid') return false;
      if (excludeUserId && o.user_id === excludeUserId) return false;
      if (kind === 'number') return String(o.requested_number || '').trim() === clean;
      return String(o.requested_email || '').replace(/@ngopi\.top$/i, '').trim().toLowerCase() === clean;
    });
  }

  public getPackages(): IdentityPackageDTO[] {
    return this.packages.map((p) => {
      if (p.code === 'number_regular') return { ...p, price_idr: this.premiumConfig.customNumberRegularPriceIdr };
      if (p.code === 'email_personal') return { ...p, price_idr: this.premiumConfig.customEmailPriceIdr };
      if (p.code === 'bundle_identity') return { ...p, price_idr: this.premiumConfig.bundleNumberAndEmailPriceIdr };
      if (p.code === 'number_special') {
        return {
          ...p,
          price_idr: this.premiumConfig.customNumberSpecialPriceIdr,
          max_price_idr: this.premiumConfig.vipNumberPriceIdr,
        };
      }
      return { ...p };
    });
  }

  public updatePackageByAdmin(
    adminUser: { id: string; username: string; role?: string | null; bmc_id?: number | null },
    code: string,
    patch: Partial<Pick<IdentityPackageDTO, 'name' | 'description' | 'price_idr' | 'max_price_idr' | 'active'>>
  ): { success: boolean; package?: IdentityPackageDTO; error?: string } {
    if (!this.isFounderUser(adminUser)) {
      return { success: false, error: 'Hanya tim admin/founder Ngopi yang dapat mengubah paket.' };
    }
    const pkg = this.packages.find((p) => p.code === code);
    if (!pkg) {
      return { success: false, error: `Paket "${code}" tidak ditemukan.` };
    }
    if (typeof patch.name === 'string' && patch.name.trim()) pkg.name = patch.name.trim();
    if (typeof patch.description === 'string' && patch.description.trim()) pkg.description = patch.description.trim();
    if (typeof patch.price_idr === 'number' && patch.price_idr >= 0) {
      pkg.price_idr = Math.round(patch.price_idr);
      if (code === 'number_regular') this.premiumConfig.customNumberRegularPriceIdr = pkg.price_idr;
      if (code === 'email_personal') this.premiumConfig.customEmailPriceIdr = pkg.price_idr;
      if (code === 'bundle_identity') this.premiumConfig.bundleNumberAndEmailPriceIdr = pkg.price_idr;
      if (code === 'number_special') this.premiumConfig.customNumberSpecialPriceIdr = pkg.price_idr;
    }
    if (typeof patch.max_price_idr === 'number' && patch.max_price_idr >= pkg.price_idr) {
      pkg.max_price_idr = Math.round(patch.max_price_idr);
    }
    if (typeof patch.active === 'boolean') pkg.active = patch.active;

    this.appendAuditLog(adminUser.id, 'PACKAGE_UPDATED', 'IdentityPackage', code, undefined, { patch });
    this.saveToDisk();
    return { success: true, package: pkg };
  }

  public async getAvailableRecommendations(
    requestingUser: { id: string; username: string; role?: string | null; bmc_id?: number | null }
  ): Promise<{
    regular_numbers: Array<{ value: string; price_idr: number }>;
    special_numbers: Array<{ value: string; price_idr: number }>;
    emails: Array<{ value: string; price_idr: number }>;
  }> {
    this.expireStaleReservations();
    const regularCandidates = ['101', '108', '1111', '1234', '1945', '2025', '2026', '2407', '7007', '8080', '8899', '9090', '2000', '4545'];
    const specialCandidates = ['111', '222', '333', '555', '777', '888', '999', '7777', '8888', '9999', '123', '321', '789'];
    const cleanUname = String(requestingUser.username || 'kopi').toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const emailCandidates = [
      cleanUname,
      `${cleanUname}.id`,
      `kopi.${cleanUname}`,
      `${cleanUname}99`,
      'barista.id',
      'penikmatkopi',
      'sahabatngopi',
      'juragankopi',
    ].filter((v, idx, arr) => v.length >= 2 && arr.indexOf(v) === idx);

    const regular_numbers: Array<{ value: string; price_idr: number }> = [];
    for (const num of regularCandidates) {
      if (num.length < 4) continue;
      const chk = await this.checkNumberAvailability(num, requestingUser);
      if (chk.available) {
        regular_numbers.push({ value: chk.normalized, price_idr: this.premiumConfig.customNumberRegularPriceIdr });
      }
      if (regular_numbers.length >= 6) break;
    }

    const special_numbers: Array<{ value: string; price_idr: number }> = [];
    for (const num of specialCandidates) {
      const chk = await this.checkNumberAvailability(num, requestingUser);
      if (chk.available) {
        special_numbers.push({ value: chk.normalized, price_idr: this.computeSpecialNumberPrice(chk.normalized) });
      }
      if (special_numbers.length >= 6) break;
    }

    const emails: Array<{ value: string; price_idr: number }> = [];
    for (const pref of emailCandidates) {
      const chk = await this.checkEmailAvailability(pref, requestingUser);
      if (chk.available) {
        emails.push({ value: chk.normalizedEmail, price_idr: this.premiumConfig.customEmailPriceIdr });
      }
      if (emails.length >= 4) break;
    }

    return { regular_numbers, special_numbers, emails };
  }

  public computeSpecialNumberPrice(normalized: string): number {
    if (/^(\d)\1+$/.test(normalized)) {
      if (normalized.length === 3) return 1000000;
      return 500000;
    }
    if (normalized.length === 3) {
      return Math.max(250000, this.premiumConfig.customNumberSpecialPriceIdr);
    }
    return this.premiumConfig.customNumberRegularPriceIdr;
  }

  public async createOrderCheckout(
    user: { id: string; username: string; role?: string | null; bmc_id?: number | null },
    input: {
      package_code: string;
      requested_number?: string;
      requested_email?: string;
      payment_method?: string;
    }
  ): Promise<{ success: boolean; order?: IdentityOrderDTO; error?: string; statusCode?: number }> {
    this.expireStaleReservations();
    const pkg = this.getPackages().find((p) => p.code === input.package_code && p.active);
    if (!pkg) {
      return { success: false, error: 'Paket Identitas Ngopi tidak ditemukan atau sedang nonaktif.', statusCode: 400 };
    }
    if (pkg.code === 'vip_inquiry') {
      return {
        success: false,
        error: 'Untuk permintaan identitas khusus (1–100 / brand resmi), silakan kirim permintaan ke Tim Ngopi melalui form permintaan khusus.',
        statusCode: 400,
      };
    }

    let normalizedNumber: string | null = null;
    let normalizedEmail: string | null = null;
    let serverAmountIdr = pkg.price_idr;

    const needsNumber = pkg.code === 'number_regular' || pkg.code === 'number_special' || pkg.code === 'bundle_identity';
    const needsEmail = pkg.code === 'email_personal' || pkg.code === 'bundle_identity';

    if (needsNumber) {
      const rawNum = String(input.requested_number || '').trim();
      if (!rawNum) {
        return { success: false, error: 'Nomor Pilihan wajib diisi untuk paket ini.', statusCode: 400 };
      }
      const numCheck = await this.checkNumberAvailability(rawNum, user);
      if (!numCheck.available) {
        return { success: false, error: numCheck.reason || 'Nomor Pilihan tidak tersedia.', statusCode: 409 };
      }
      const nVal = Number(numCheck.normalized);
      if (nVal >= 0 && nVal <= 100 && !this.isFounderUser(user)) {
        return {
          success: false,
          error: 'Nomor 1–100 dialokasikan untuk kebutuhan resmi Ngopi. Untuk permintaan identitas khusus, hubungi Tim Ngopi.',
          statusCode: 403,
        };
      }
      if (pkg.code === 'number_regular') {
        if (numCheck.normalized.length < 4 || numCheck.normalized.length > 6) {
          return {
            success: false,
            error: 'Paket Nomor Pilihan Reguler berlaku untuk nomor 4–6 angka (minimal 1010). Untuk 3 angka/kembar, pilih Paket Spesial.',
            statusCode: 400,
          };
        }
        serverAmountIdr = this.premiumConfig.customNumberRegularPriceIdr;
      } else if (pkg.code === 'number_special') {
        const isTwin = /^(\d)\1+$/.test(numCheck.normalized);
        if (numCheck.normalized.length !== 3 && !isTwin) {
          return {
            success: false,
            error: 'Paket Nomor Pilihan Spesial khusus untuk 3 angka (101–999) atau angka kembar (misal 777, 8888).',
            statusCode: 400,
          };
        }
        serverAmountIdr = this.computeSpecialNumberPrice(numCheck.normalized);
      }
      normalizedNumber = numCheck.normalized;
    }

    if (needsEmail) {
      const rawEmail = String(input.requested_email || '').trim();
      if (!rawEmail) {
        return { success: false, error: 'Alamat Email Pilihan @ngopi.top wajib diisi untuk paket ini.', statusCode: 400 };
      }
      const emailCheck = await this.checkEmailAvailability(rawEmail, user);
      if (!emailCheck.available) {
        return { success: false, error: emailCheck.reason || 'Alamat email tidak tersedia.', statusCode: 409 };
      }
      normalizedEmail = emailCheck.normalizedEmail;
    }

    if (pkg.code === 'bundle_identity') {
      serverAmountIdr = this.premiumConfig.bundleNumberAndEmailPriceIdr;
    }

    // Concurrency guard for requested number/email lock
    const lockKeys: string[] = [];
    if (normalizedNumber) lockKeys.push(`num:${normalizedNumber}`);
    if (normalizedEmail) lockKeys.push(`email:${normalizedEmail.toLowerCase()}`);

    for (const k of lockKeys) {
      if (this.checkoutLocks.has(k)) {
        return { success: false, error: 'Identitas sedang diproses oleh transaksi lain. Silakan coba sesaat lagi.', statusCode: 409 };
      }
    }

    lockKeys.forEach((k) => this.checkoutLocks.add(k));
    try {
      // Double-check reservation inside lock
      if (normalizedNumber && this.findActiveOrderReservation('number', normalizedNumber, user.id)) {
        return { success: false, error: `Nomor Pilihan ${normalizedNumber} sedang direservasi oleh pengguna lain.`, statusCode: 409 };
      }
      if (normalizedEmail && this.findActiveOrderReservation('email', normalizedEmail, user.id)) {
        return { success: false, error: `Alamat ${normalizedEmail} sedang direservasi oleh pengguna lain.`, statusCode: 409 };
      }

      const uniqueCode = 101 + (crypto.randomBytes(2).readUInt16BE(0) % 898); // 101..998
      const now = new Date();
      const reservedUntil = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes TTL
      const orderCode = `NGOPI-${now.toISOString().slice(2, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

      const order: IdentityOrderDTO = {
        id: `ord-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        order_code: orderCode,
        user_id: user.id,
        username: user.username,
        package_code: pkg.code,
        requested_number: normalizedNumber,
        requested_email: normalizedEmail,
        amount_idr: serverAmountIdr,
        unique_code: uniqueCode,
        total_transfer_idr: serverAmountIdr + uniqueCode,
        payment_method: String(input.payment_method || 'bank_bri_transfer'),
        status: 'pending_payment',
        reserved_until: reservedUntil.toISOString(),
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      this.orders.unshift(order);
      this.appendAuditLog(user.id, 'ORDER_CREATED', 'IdentityOrder', order.id, user.id, {
        order_code: order.order_code,
        package_code: order.package_code,
        requested_number: normalizedNumber,
        requested_email: normalizedEmail,
        total_transfer_idr: order.total_transfer_idr,
      });
      this.saveToDisk();

      return { success: true, order };
    } finally {
      lockKeys.forEach((k) => this.checkoutLocks.delete(k));
    }
  }

  private async verifyBankMutationAdapter(
    order: IdentityOrderDTO,
    paymentReference?: string
  ): Promise<{ verified: boolean; provider: string; reason?: string }> {
    const mutationApiUrl = process.env.BRI_MUTATION_API_URL;
    const mutationApiKey = process.env.BRI_MUTATION_API_KEY;
    if (!mutationApiUrl || !mutationApiKey) {
      return {
        verified: false,
        provider: 'manual_admin_queue',
        reason: 'Menunggu verifikasi mutasi Bank BRI oleh Tim Ngopi (webhook mutasi bank otomatis belum dikonfigurasi).',
      };
    }

    try {
      const resp = await fetch(mutationApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mutationApiKey}`,
        },
        body: JSON.stringify({
          order_code: order.order_code,
          expected_amount_idr: order.total_transfer_idr,
          account_number: '141101000456562',
          payment_reference: paymentReference || order.payment_reference || null,
        }),
      });
      if (!resp.ok) {
        return { verified: false, provider: 'bri_mutation_api', reason: 'Mutasi belum ditemukan pada API Bank.' };
      }
      const data: any = await resp.json();
      if (data && data.matched === true && Number(data.amount_idr) === order.total_transfer_idr) {
        return { verified: true, provider: 'bri_mutation_api' };
      }
      return { verified: false, provider: 'bri_mutation_api', reason: 'Nominal atau referensi belum cocok di mutasi rekening.' };
    } catch {
      return { verified: false, provider: 'bri_mutation_api', reason: 'Gagal menghubungi layanan mutasi bank; dialihkan ke antrean verifikasi Tim Ngopi.' };
    }
  }

  private async activateOrderIdentityAtomically(
    order: IdentityOrderDTO,
    actorId: string,
    source: string
  ): Promise<{ success: boolean; order?: IdentityOrderDTO; error?: string }> {
    if (order.status === 'activated') {
      return { success: true, order };
    }
    if (order.status === 'expired' || order.status === 'cancelled' || order.status === 'rejected') {
      return { success: false, error: `Pesanan berstatus ${order.status} tidak dapat diaktivasi.` };
    }

    // Re-verify BOTH number and email for all-or-nothing bundling consistency before mutating state
    const targetUser = { id: order.user_id, username: order.username || 'user', role: 'user', bmc_id: null };
    if (order.requested_number) {
      const numCheck = await this.checkNumberAvailability(order.requested_number, targetUser);
      if (!numCheck.available) {
        return { success: false, error: numCheck.reason || 'Nomor Pilihan sudah terpakai.' };
      }
    }
    if (order.requested_email) {
      const emailCheck = await this.checkEmailAvailability(order.requested_email, targetUser);
      if (!emailCheck.available) {
        return { success: false, error: emailCheck.reason || 'Email Pilihan sudah terpakai.' };
      }
    }

    // Commit both atomically
    if (order.requested_number) {
      this.customNumbers.set(order.user_id, order.requested_number);
    }
    if (order.requested_email) {
      const prefix = order.requested_email.replace(/@ngopi\.top$/i, '').toLowerCase();
      this.customEmails.set(order.user_id, prefix);
    }

    const nowIso = new Date().toISOString();
    order.status = 'activated';
    order.paid_at = order.paid_at || nowIso;
    order.activated_at = nowIso;
    order.updated_at = nowIso;

    this.appendAuditLog(actorId, 'ORDER_ACTIVATED', 'IdentityOrder', order.id, order.user_id, {
      source,
      order_code: order.order_code,
      activated_number: order.requested_number,
      activated_email: order.requested_email,
    });
    this.saveToDisk();

    return { success: true, order };
  }

  public async submitOrderProof(
    user: { id: string; username: string },
    orderId: string,
    input: { proof_url?: string; payment_reference?: string; bank_sender_name?: string }
  ): Promise<{ success: boolean; order?: IdentityOrderDTO; autoActivated?: boolean; message?: string; error?: string }> {
    this.expireStaleReservations();
    const order = this.orders.find((o) => (o.id === orderId || o.order_code === orderId) && o.user_id === user.id);
    if (!order) {
      return { success: false, error: 'Pesanan tidak ditemukan.' };
    }
    if (order.status === 'activated') {
      return { success: true, order, autoActivated: true, message: 'Pesanan sudah aktif sebelumnya.' };
    }
    if (order.status === 'expired' || order.status === 'cancelled' || order.status === 'rejected') {
      return { success: false, error: `Pesanan berstatus "${order.status}". Silakan buat pesanan baru.` };
    }

    const cleanProof = String(input.proof_url || '').trim();
    const cleanRef = String(input.payment_reference || '').trim();
    if (!cleanProof && !cleanRef) {
      return { success: false, error: 'Lampirkan URL/foto bukti transfer atau nomor referensi transfer.' };
    }

    order.proof_url = cleanProof || order.proof_url || null;
    order.payment_reference = cleanRef || order.payment_reference || null;
    order.bank_sender_name = String(input.bank_sender_name || '').trim() || order.bank_sender_name || null;
    order.status = 'verifying';
    order.updated_at = new Date().toISOString();

    this.appendAuditLog(user.id, 'PROOF_SUBMITTED', 'IdentityOrder', order.id, user.id, {
      order_code: order.order_code,
      has_proof_url: Boolean(cleanProof),
      payment_reference: cleanRef,
    });

    // Only auto-activate if a real bank mutation verification provider confirms it!
    const mutationCheck = await this.verifyBankMutationAdapter(order, cleanRef);
    if (mutationCheck.verified) {
      const activated = await this.activateOrderIdentityAtomically(order, 'system-bank-mutation', mutationCheck.provider);
      if (activated.success) {
        return {
          success: true,
          order: activated.order,
          autoActivated: true,
          message: 'Pembayaran terverifikasi otomatis melalui mutasi bank dan Identitas Ngopi Anda telah aktif!',
        };
      }
    }

    this.saveToDisk();
    return {
      success: true,
      order,
      autoActivated: false,
      message:
        mutationCheck.reason ||
        'Bukti transfer diterima dan berstatus Menunggu Verifikasi Tim Ngopi (maksimal 1x24 jam). Anda juga dapat konfirmasi ke WA 08174139994.',
    };
  }

  public verifyWebhookSignature(rawPayload: string, signatureHeader?: string): boolean {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET || process.env.JWT_SECRET || '';
    if (!secret || !signatureHeader) return false;
    const expected = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
    const provided = signatureHeader.replace(/^sha256=/i, '').trim();
    if (expected.length !== provided.length) return false;
    try {
      return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(provided, 'utf8'));
    } catch {
      return false;
    }
  }

  public async processPaymentWebhook(
    payload: { order_code?: string; order_id?: string; status?: string; amount_idr?: number; payment_reference?: string },
    rawBody: string,
    signatureHeader?: string
  ): Promise<{ success: boolean; alreadyActivated?: boolean; order?: IdentityOrderDTO; error?: string; statusCode?: number }> {
    if (!this.verifyWebhookSignature(rawBody, signatureHeader)) {
      return { success: false, error: 'Invalid webhook signature', statusCode: 401 };
    }

    const order = this.orders.find(
      (o) =>
        (payload.order_id && o.id === payload.order_id) ||
        (payload.order_code && o.order_code === payload.order_code)
    );
    if (!order) {
      return { success: false, error: 'Order not found', statusCode: 404 };
    }

    if (order.status === 'activated') {
      return { success: true, alreadyActivated: true, order };
    }

    const paidStatus = String(payload.status || '').toLowerCase();
    if (paidStatus !== 'paid' && paidStatus !== 'settlement' && paidStatus !== 'success') {
      return { success: false, error: `Unsupported webhook payment status: ${paidStatus}`, statusCode: 400 };
    }

    if (
      typeof payload.amount_idr === 'number' &&
      payload.amount_idr < order.amount_idr
    ) {
      return { success: false, error: 'Paid amount is less than order price', statusCode: 400 };
    }

    if (payload.payment_reference) {
      order.payment_reference = payload.payment_reference;
    }
    order.status = 'paid';
    order.paid_at = new Date().toISOString();

    const activated = await this.activateOrderIdentityAtomically(order, 'payment-webhook', 'webhook_hmac');
    if (!activated.success) {
      return { success: false, error: activated.error, statusCode: 409 };
    }
    return { success: true, alreadyActivated: false, order: activated.order };
  }

  public async approveOrderByAdmin(
    adminUser: { id: string; username: string; role?: string | null; bmc_id?: number | null },
    orderId: string,
    action: 'approve' | 'reject',
    adminNote?: string
  ): Promise<{ success: boolean; order?: IdentityOrderDTO; error?: string }> {
    if (!this.isFounderUser(adminUser)) {
      return { success: false, error: 'Hanya Tim Ngopi / Founder yang berwenang memverifikasi pesanan.' };
    }
    const order = this.orders.find((o) => o.id === orderId || o.order_code === orderId);
    if (!order) {
      return { success: false, error: 'Pesanan tidak ditemukan.' };
    }

    if (action === 'reject') {
      if (order.status === 'activated') {
        return { success: false, error: 'Pesanan sudah aktif.' };
      }
      order.status = 'rejected';
      order.admin_note = adminNote || 'Pembayaran belum terverifikasi.';
      order.updated_at = new Date().toISOString();
      this.appendAuditLog(adminUser.id, 'ORDER_REJECTED', 'IdentityOrder', order.id, order.user_id, {
        order_code: order.order_code,
        admin_note: order.admin_note,
      });
      this.saveToDisk();
      return { success: true, order };
    }

    order.admin_note = adminNote || 'Diverifikasi oleh Tim Ngopi.';
    return this.activateOrderIdentityAtomically(order, adminUser.id, 'admin_manual_approval');
  }

  public getMyOrders(userId: string): IdentityOrderDTO[] {
    this.expireStaleReservations();
    return this.orders.filter((o) => o.user_id === userId);
  }

  public getAllOrdersForAdmin(adminUser: { username?: string | null; role?: string | null; bmc_id?: number | null }): IdentityOrderDTO[] {
    if (!this.isFounderUser(adminUser)) return [];
    this.expireStaleReservations();
    return this.orders;
  }

  public createVipRequest(
    user: { id: string; username: string },
    input: { requested_number?: string; requested_email?: string; notes?: string }
  ): { success: boolean; request?: VipIdentityRequestDTO; error?: string } {
    const cleanNotes = String(input.notes || '').trim();
    const cleanNum = input.requested_number ? String(input.requested_number).trim() : null;
    const cleanEmail = input.requested_email ? String(input.requested_email).trim().toLowerCase() : null;
    if (!cleanNum && !cleanEmail && !cleanNotes) {
      return { success: false, error: 'Isi nomor/email yang diinginkan atau catatan permintaan Anda.' };
    }
    const now = new Date().toISOString();
    const reqItem: VipIdentityRequestDTO = {
      id: `vipreq-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      user_id: user.id,
      username: user.username,
      requested_number: cleanNum,
      requested_email: cleanEmail,
      notes: cleanNotes || 'Permintaan identitas khusus Ngopi.',
      status: 'pending',
      created_at: now,
      updated_at: now,
    };
    this.vipRequests.unshift(reqItem);
    this.appendAuditLog(user.id, 'VIP_REQUEST_CREATED', 'VipIdentityRequest', reqItem.id, user.id, {
      requested_number: cleanNum,
      requested_email: cleanEmail,
    });
    this.saveToDisk();
    return { success: true, request: reqItem };
  }

  public listVipRequests(user: { id: string; username?: string | null; role?: string | null; bmc_id?: number | null }): VipIdentityRequestDTO[] {
    if (this.isFounderUser(user)) {
      return this.vipRequests;
    }
    return this.vipRequests.filter((r) => r.user_id === user.id);
  }

  public adminUpdateVipRequest(
    adminUser: { id: string; username?: string | null; role?: string | null; bmc_id?: number | null },
    requestId: string,
    status: 'reviewed' | 'approved' | 'rejected',
    adminNote?: string
  ): { success: boolean; request?: VipIdentityRequestDTO; error?: string } {
    if (!this.isFounderUser(adminUser)) {
      return { success: false, error: 'Hanya Tim Ngopi yang dapat memperbarui status permintaan khusus.' };
    }
    const reqItem = this.vipRequests.find((r) => r.id === requestId);
    if (!reqItem) {
      return { success: false, error: 'Permintaan tidak ditemukan.' };
    }
    reqItem.status = status;
    reqItem.admin_note = adminNote || reqItem.admin_note || null;
    reqItem.updated_at = new Date().toISOString();
    this.appendAuditLog(adminUser.id, 'VIP_REQUEST_UPDATED', 'VipIdentityRequest', reqItem.id, reqItem.user_id, {
      status,
      admin_note: reqItem.admin_note,
    });
    this.saveToDisk();
    return { success: true, request: reqItem };
  }

  public getAdminAuditLogs(adminUser: { username?: string | null; role?: string | null; bmc_id?: number | null }): IdentityAuditLogDTO[] {
    if (!this.isFounderUser(adminUser)) return [];
    return this.auditLogs.slice(0, 200);
  }
}

export const telecomService = TelecomService.getInstance();
