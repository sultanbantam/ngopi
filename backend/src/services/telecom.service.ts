import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';

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
  is_read: boolean;
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
}

interface TelecomStoreData {
  customNumbers: Record<string, string>; // userId -> ngopi_number
  vipNumbersUnlockedByFounder: Record<string, string>; // number (1..100) -> userId
  customEmails: Record<string, string>; // userId -> email local-part (before @ngopi.top)
  vipEmailsUnlockedByFounder: Record<string, string>; // local-part -> userId
  extraLockedEmails: string[]; // additional email local-parts locked by Founder
  premiumConfig?: PremiumTelecomConfig;
  mails: NgopiMailMessage[];
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
    customNumberSpecialPriceIdr: 75000,
    bundleNumberAndEmailPriceIdr: 49000,
    vipNumberPriceIdr: 250000,
    customNumberPricePoints: 1000,
    customEmailPricePoints: 1000,
  };
  private mails: NgopiMailMessage[] = [];

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
        }
        if (Array.isArray(parsed.mails)) {
          this.mails = parsed.mails;
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
      };
      fs.writeFileSync(this.dataFilePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      console.warn('[TelecomService] Failed to save store to disk:', err);
    }
  }

  public isFounderUser(user: { username?: string | null; role?: string | null; bmc_id?: number | null }): boolean {
    const uname = String(user.username || '').trim().toLowerCase();
    const role = String(user.role || '').trim().toLowerCase();
    return uname === 'warung' || uname === 'founder' || uname === 'admin' || role === 'admin' || role === 'superadmin' || user.bmc_id === 1;
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
    if (clean === 'warung' || clean === 'founder') {
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
   * - Founder gets "0"
   * - Paid/VIP custom number if claimed/assigned
   * - Otherwise deterministic 10-digit random-looking hard-to-memorize number (e.g. 7492638517)
   */
  public getNumberForUser(
    user: { id: string; username?: string | null; role?: string | null; bmc_id?: number | null }
  ): string {
    const custom = this.customNumbers.get(user.id);
    if (custom !== undefined && custom !== '') {
      return custom;
    }

    const uname = String(user.username || '').trim().toLowerCase();
    if (uname === 'warung' || user.bmc_id === 1) {
      return '0';
    }

    return generateUglyDefaultNumber(uname || user.id);
  }

  public buildDirectoryMap(
    users: Array<{ id: string; username: string; display_name?: string | null; role?: string | null; bmc_id?: number | null }>
  ): Map<string, { number: string; email: string }> {
    const result = new Map<string, { number: string; email: string }>();
    const usedNumbers = new Set<string>();

    // First pass: custom numbers & Founder "0"
    for (const u of users) {
      const custom = this.customNumbers.get(u.id);
      const email = this.formatEmail(u.username, u.id);
      if (custom) {
        usedNumbers.add(custom);
        result.set(u.id, { number: custom, email });
      } else if (u.username.trim().toLowerCase() === 'warung' || u.bmc_id === 1) {
        if (!usedNumbers.has('0')) {
          usedNumbers.add('0');
          result.set(u.id, { number: '0', email: 'warung@ngopi.top' });
        }
      }
    }

    // Second pass: deterministic ugly 10-digit random number & consonant-only email for everyone else
    for (const u of users) {
      if (result.has(u.id)) continue;
      let uglyNum = generateUglyDefaultNumber(u.username || u.id);
      let salt = 1;
      while (usedNumbers.has(uglyNum)) {
        uglyNum = generateUglyDefaultNumber(`${u.username}_${salt}`);
        salt += 1;
      }
      usedNumbers.add(uglyNum);
      result.set(u.id, {
        number: uglyNum,
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
        reason: 'Nomor 0 adalah nomor eksklusif Founder Ngopi.',
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
          reason: `🔒 Nomor ${normalized} adalah Nomor Sultan VIP (1–100) yang dikunci oleh Founder (Biaya Aktivasi VIP: Rp ${this.premiumConfig.vipNumberPriceIdr.toLocaleString('id-ID')}).`,
        };
      }
    }

    const allUsers = await prisma.user.findMany({
      select: { id: true, username: true, display_name: true, role: true, bmc_id: true },
    });
    const dir = this.buildDirectoryMap(allUsers);

    for (const u of allUsers) {
      const entry = dir.get(u.id);
      if (entry && entry.number === normalized) {
        if (u.id === requestingUser.id) {
          return { available: true, normalized, lockedVip: false, reason: 'Ini adalah nomor aktif Anda saat ini.' };
        }
        return {
          available: false,
          normalized,
          lockedVip: false,
          reason: `Nomor ${normalized} sudah dipakai oleh @${u.username}.`,
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
        error: `Fitur Ganti Nomor Cantik adalah FITUR PREMIUM BERBAYAR (Mulai Rp ${this.premiumConfig.customNumberRegularPriceIdr.toLocaleString('id-ID')} atau Paket Bundling Nomor + Email Cantik Rp ${this.premiumConfig.bundleNumberAndEmailPriceIdr.toLocaleString('id-ID')}). Silakan hubungi Founder (#0 / warung@ngopi.top) untuk aktivasi!`,
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
        reason: `🔒 Alamat "${normalizedEmail}" dikunci secara eksklusif oleh Founder Ngopi.`,
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
          reason: `❌ Alamat ${normalizedEmail} sudah dimiliki oleh @${u.username}.`,
        };
      }
    }

    return {
      available: true,
      normalizedEmail,
      prefix: cleanPrefix,
      lockedVip: false,
      suggestedPriceIdr: this.premiumConfig.customEmailPriceIdr,
      reason: `✅ Alamat ${normalizedEmail} tersedia! (Biaya Aktivasi Email Cantik: Rp ${this.premiumConfig.customEmailPriceIdr.toLocaleString('id-ID')})`,
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
        error: `Fitur Ganti Email Cantik @ngopi.top adalah FITUR PREMIUM BERBAYAR (Rp ${this.premiumConfig.customEmailPriceIdr.toLocaleString('id-ID')} atau Paket Bundling Nomor + Email Cantik Rp ${this.premiumConfig.bundleNumberAndEmailPriceIdr.toLocaleString('id-ID')}). Silakan hubungi Founder (#0) untuk aktivasi!`,
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

  private ensureWelcomeMail(user: { id: string; username: string; display_name?: string | null }, ngopiNumber: string, ngopiEmail: string): void {
    const hasWelcome = this.mails.some((m) => m.to_user_id === user.id && m.id.startsWith('welcome-'));
    if (hasWelcome) return;

    const welcomeMail: NgopiMailMessage = {
      id: `welcome-${user.id}`,
      from_user_id: 'founder-0',
      from_username: 'warung',
      from_display_name: 'Founder Ngopi (#0)',
      from_email: 'warung@ngopi.top',
      from_number: '0',
      to_user_id: user.id,
      to_username: user.username,
      to_email: ngopiEmail,
      to_number: ngopiNumber,
      subject: `Selamat Datang di Ngopi Mail & Nomor Virtual #${ngopiNumber}! ☕`,
      body: `Halo ${user.display_name || user.username}!\n\nAkun Anda telah mendapatkan Nomor HP Virtual & Email bawaan (acak):\n• Nomor Virtual Bawaan: ${ngopiNumber}\n• Email Bawaan: ${ngopiEmail}\n\nIngin mengganti ke Nomor Cantik yang mudah dihafal (misal 101, 777, 1945) dan Email Cantik sesuai nama Anda (${user.username.toLowerCase()}@ngopi.top)?\nSilakan buka tab "Nomor & Email Cantik" untuk memilih paket upgrade Premium!\n\nSalam hangat,\nFounder Ngopi (#0 - warung@ngopi.top)`,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    this.mails.unshift(welcomeMail);
    this.saveToDisk();
  }

  public getInboxForUser(user: { id: string; username: string; display_name?: string | null }, ngopiNumber: string, ngopiEmail: string): NgopiMailMessage[] {
    this.ensureWelcomeMail(user, ngopiNumber, ngopiEmail);
    return this.mails
      .filter((m) => m.to_user_id === user.id || m.to_email.toLowerCase() === ngopiEmail.toLowerCase() || m.to_number === ngopiNumber)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
    body: string
  ): Promise<{ success: boolean; mail?: NgopiMailMessage; error?: string }> {
    const cleanTo = String(toIdentifier || '').trim();
    const cleanSubject = String(subject || '').trim() || '(Tanpa Subjek)';
    const cleanBody = String(body || '').trim();

    if (!cleanTo) {
      return { success: false, error: 'Alamat tujuan (Email @ngopi.top atau Nomor Ngopi) wajib diisi.' };
    }
    if (!cleanBody) {
      return { success: false, error: 'Isi pesan email tidak boleh kosong.' };
    }

    const recipient = await this.resolveUserByIdentifier(cleanTo);
    if (!recipient) {
      return {
        success: false,
        error: `Tujuan "${cleanTo}" tidak ditemukan. Masukkan alamat @ngopi.top atau Nomor Ngopi yang terdaftar.`,
      };
    }

    const senderResolved = await this.resolveUserByIdentifier(senderUser.id);
    const senderNumber = senderResolved?.ngopi_number || this.getNumberForUser(senderUser);
    const senderEmail = senderResolved?.ngopi_email || this.formatEmail(senderUser.username, senderUser.id);

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
      body: cleanBody,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    this.mails.unshift(newMail);
    this.saveToDisk();

    return { success: true, mail: newMail };
  }

  public markMailRead(userId: string, mailId: string): boolean {
    const found = this.mails.find((m) => m.id === mailId && m.to_user_id === userId);
    if (!found) return false;
    found.is_read = true;
    this.saveToDisk();
    return true;
  }

  public deleteMail(userId: string, mailId: string): boolean {
    const idx = this.mails.findIndex((m) => m.id === mailId && (m.to_user_id === userId || m.from_user_id === userId));
    if (idx === -1) return false;
    this.mails.splice(idx, 1);
    this.saveToDisk();
    return true;
  }
}

export const telecomService = TelecomService.getInstance();
