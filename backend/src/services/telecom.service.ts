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
  customNumberPricePoints: number;
  customNumberPriceIdr: number;
  vipNumberPriceIdr: number;
  customEmailPricePoints: number;
  customEmailPriceIdr: number;
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
  'VVIP',
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
    requirePaymentForCustomNumber: false, // Free during trial, Founder can toggle ON anytime
    requirePaymentForCustomEmail: false,
    customNumberPricePoints: 500,
    customNumberPriceIdr: 25000,
    vipNumberPriceIdr: 250000,
    customEmailPricePoints: 500,
    customEmailPriceIdr: 25000,
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

    // Check if unlocked specifically for this user by Founder
    if (requestingUserId && this.vipEmailsUnlocked.get(clean) === requestingUserId) {
      return false;
    }

    // Numbers 0..100 as email handles (0@ngopi.top .. 100@ngopi.top) are also locked
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

  public formatEmail(username: string, userId?: string): string {
    if (userId && this.customEmails.has(userId)) {
      const customPrefix = this.customEmails.get(userId)!;
      return `${customPrefix}@ngopi.top`;
    }
    const clean = String(username || 'user')
      .trim()
      .toLowerCase()
      .replace(/^@/, '')
      .replace(/@ngopi\.top$/i, '')
      .replace(/[^a-z0-9._-]/g, '');
    return `${clean || 'user'}@ngopi.top`;
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
   * - Founder gets "0" (unless they explicitly set another custom number)
   * - Locked VIP numbers 1..100 if assigned by Founder
   * - Custom number >= 101 if claimed by user
   * - Otherwise deterministic default starting from 101 (100 + bmc_id)
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
      const zeroTakenByOther = Array.from(this.customNumbers.entries()).some(
        ([uid, num]) => num === '0' && uid !== user.id
      );
      if (!zeroTakenByOther) {
        return '0';
      }
    }

    const baseBmc = typeof user.bmc_id === 'number' && user.bmc_id > 0 ? user.bmc_id : 1;
    let candidateNum = 100 + baseBmc;
    if (candidateNum < 101) candidateNum = 101;
    const claimedSet = new Set<string>();
    for (const [uid, num] of this.customNumbers.entries()) {
      if (uid !== user.id) claimedSet.add(num);
    }

    while (claimedSet.has(String(candidateNum))) {
      candidateNum += 1;
    }
    return String(candidateNum);
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
          result.set(u.id, { number: '0', email });
        }
      }
    }

    // Second pass: deterministic >= 101 for everyone else (existing users automatically get 101+)
    const sorted = [...users].sort((a, b) => (a.bmc_id || 999999) - (b.bmc_id || 999999));
    for (const u of sorted) {
      if (result.has(u.id)) continue;
      let candidate = 100 + (u.bmc_id && u.bmc_id > 0 ? u.bmc_id : 1);
      if (candidate < 101) candidate = 101;
      while (usedNumbers.has(String(candidate))) {
        candidate += 1;
      }
      const numStr = String(candidate);
      usedNumbers.add(numStr);
      result.set(u.id, { number: numStr, email: this.formatEmail(u.username, u.id) });
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
  ): Promise<{ available: boolean; normalized: string; lockedVip: boolean; reason?: string; ownerUsername?: string }> {
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
          reason: 'Nomor 1 sampai 100 dikunci khusus oleh Founder (VIP). Silakan pilih nomor mulai dari 101 ke atas atau hubungi Founder.',
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

    return { available: true, normalized, lockedVip: false };
  }

  public async claimNumber(
    requestingUser: { id: string; username: string; role?: string | null; bmc_id?: number | null },
    rawNumber: string
  ): Promise<{ success: boolean; number?: string; error?: string }> {
    const isFounder = this.isFounderUser(requestingUser);
    if (this.premiumConfig.requirePaymentForCustomNumber && !isFounder) {
      return {
        success: false,
        error: `Fitur Ganti Nomor Cantik saat ini berstatus FITUR PREMIUM (Biaya: Rp ${this.premiumConfig.customNumberPriceIdr.toLocaleString('id-ID')} atau ${this.premiumConfig.customNumberPricePoints} Poin Kopi). Silakan hubungi Founder (#0 / warung@ngopi.top) untuk aktivasi.`,
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
  ): Promise<{ available: boolean; normalizedEmail: string; prefix: string; lockedVip: boolean; reason?: string }> {
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
      const uDefaultPrefix = u.username.trim().toLowerCase();
      const uActivePrefix = entry ? entry.email.replace(/@ngopi\.top$/i, '').toLowerCase() : uDefaultPrefix;
      if ((uActivePrefix === cleanPrefix || uDefaultPrefix === cleanPrefix) && u.id !== requestingUser.id) {
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
      reason: `✅ Alamat ${normalizedEmail} tersedia dan siap digunakan!`,
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
        error: `Fitur Custom Nama Email @ngopi.top saat ini berstatus FITUR PREMIUM (Biaya: Rp ${this.premiumConfig.customEmailPriceIdr.toLocaleString('id-ID')} atau ${this.premiumConfig.customEmailPricePoints} Poin Kopi). Silakan hubungi Founder (#0) untuk aktivasi.`,
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
      return { success: false, error: 'Hanya Founder yang dapat membuka dan memberikan nomor terkunci (0-100).' };
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
      return { success: false, error: 'Hanya Founder (#0) yang dapat mengunci atau membuka email @ngopi.top.' };
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

    // unlock_assign to a specific user
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
      const defaultUserEmail = `${u.username.toLowerCase()}@ngopi.top`;
      if (
        meta.number === cleanedNumber ||
        meta.email.toLowerCase() === cleanedEmail ||
        defaultUserEmail === cleanedEmail ||
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

  // ============================================================================
  // NGOPI MAIL (@ngopi.top)
  // ============================================================================
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
      body: `Halo ${user.display_name || user.username}!\n\nAkun Anda kini telah dilengkapi secara otomatis dengan Identitas Telekomunikasi & Email resmi ekosistem ngopi.top:\n\n• Nomor HP Virtual Ngopi: ${ngopiNumber}\n• Alamat Email Resmi: ${ngopiEmail} (atau ${ngopiNumber}@ngopi.top)\n\nAnda dapat:\n1. Menghubungi teman cukup dengan mengetik Nomor Ngopi mereka di Papan Telepon (Dialpad).\n2. Mengganti Nomor Ngopi Anda ke nomor cantik pilihan Anda sendiri (mulai dari 101 ke atas) atau mengklaim nama email cantik @ngopi.top.\n3. Mengirim dan menerima surat elektronik resmi antar sesama pengguna @ngopi.top.\n\nSalam hangat,\nFounder Ngopi (#0 - warung@ngopi.top)`,
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
        error: `Tujuan "${cleanTo}" tidak ditemukan. Masukkan alamat seperti username@ngopi.top atau Nomor Ngopi yang terdaftar.`,
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
