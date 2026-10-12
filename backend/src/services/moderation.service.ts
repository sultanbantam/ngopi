import {
  ModerationAction,
  ModerationActionType,
  ModerationClassificationResult,
  ModerationReport,
  BlacklistEntry,
  SpamHashRecord,
} from '../models/moderation.types';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const RATE_LIMITS = {
  messages_per_second: 10,
  messages_per_minute: 60,
  messages_per_hour: 500,
  warung_joins_per_minute: 3,
  file_uploads_per_hour: 20,
};

export class ModerationService {
  private actions: ModerationAction[] = [];
  private blacklist: Map<string, BlacklistEntry> = new Map(); // key = user_id
  private reports: ModerationReport[] = [];
  private spamHashCache: Map<string, SpamHashRecord> = new Map(); // key = hash
  private userRateBuckets: Map<string, {
    messageTimestamps: number[];
    joinTimestamps: number[];
    uploadTimestamps: number[];
  }> = new Map();

  private storageFile: string;

  constructor(storageDir?: string) {
    const dir = storageDir || path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    }
    this.storageFile = path.join(dir, 'moderation_storage.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf-8');
        const data = JSON.parse(raw);
        if (data.actions && Array.isArray(data.actions)) {
          this.actions = data.actions;
        }
        if (data.blacklist && Array.isArray(data.blacklist)) {
          data.blacklist.forEach((b: BlacklistEntry) => this.blacklist.set(b.user_id, b));
        }
        if (data.reports && Array.isArray(data.reports)) {
          this.reports = data.reports;
        }
      }
    } catch {
      // Fallback
    }
  }

  private saveToDisk(): void {
    try {
      const data = {
        actions: this.actions.slice(-3000),
        blacklist: Array.from(this.blacklist.values()),
        reports: this.reports.slice(-1000),
        updatedAt: Date.now(),
      };
      fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Non-critical persistence
    }
  }

  // --- LAPISAN 1: RATE LIMITING (Server-Side) ---
  public checkRateLimit(
    userId: string,
    actionType: 'message' | 'warung_join' | 'file_upload'
  ): { allowed: boolean; reason?: string } {
    const now = Date.now();
    let bucket = this.userRateBuckets.get(userId);
    if (!bucket) {
      bucket = { messageTimestamps: [], joinTimestamps: [], uploadTimestamps: [] };
      this.userRateBuckets.set(userId, bucket);
    }

    if (actionType === 'message') {
      // Clean timestamps older than 1 hour
      bucket.messageTimestamps = bucket.messageTimestamps.filter(t => now - t < 3600000);

      const inLastSecond = bucket.messageTimestamps.filter(t => now - t < 1000).length;
      if (inLastSecond >= RATE_LIMITS.messages_per_second) {
        return { allowed: false, reason: 'Terlalu cepat: Maksimum 10 pesan per detik (Anti-Flooding).' };
      }

      const inLastMinute = bucket.messageTimestamps.filter(t => now - t < 60000).length;
      if (inLastMinute >= RATE_LIMITS.messages_per_minute) {
        return { allowed: false, reason: 'Batas pesan per menit tercapai (Maksimum 60 pesan/menit).' };
      }

      const inLastHour = bucket.messageTimestamps.length;
      if (inLastHour >= RATE_LIMITS.messages_per_hour) {
        return { allowed: false, reason: 'Batas pesan per jam tercapai (Maksimum 500 pesan/jam).' };
      }

      bucket.messageTimestamps.push(now);
      return { allowed: true };
    }

    if (actionType === 'warung_join') {
      bucket.joinTimestamps = bucket.joinTimestamps.filter(t => now - t < 60000);
      if (bucket.joinTimestamps.length >= RATE_LIMITS.warung_joins_per_minute) {
        return { allowed: false, reason: 'Terlalu sering berpindah warkop: Maksimum 3 join per menit.' };
      }
      bucket.joinTimestamps.push(now);
      return { allowed: true };
    }

    if (actionType === 'file_upload') {
      bucket.uploadTimestamps = bucket.uploadTimestamps.filter(t => now - t < 3600000);
      if (bucket.uploadTimestamps.length >= RATE_LIMITS.file_uploads_per_hour) {
        return { allowed: false, reason: 'Batas upload per jam tercapai (Maksimum 20 file/jam).' };
      }
      bucket.uploadTimestamps.push(now);
      return { allowed: true };
    }

    return { allowed: true };
  }

  // --- LAPISAN 2: FILTER PRE-AI (Rules & Hash Flooding) ---
  public checkPreAiRules(content: string, userId: string): { isSpam: boolean; reason?: string } {
    if (!content || !content.trim()) return { isSpam: false };

    // 1. Multi-link spam detection: 3+ links in 1 message
    const urlMatches = content.match(/https?:\/\/[^\s]+/gi);
    if (urlMatches && urlMatches.length >= 3) {
      return { isSpam: true, reason: 'Terdeteksi spam multi-link (3+ tautan dalam 1 pesan).' };
    }

    // 2. Karakter berulang 20+ kali (e.g. aaaaaaaaaaaaaaaaaaaaa)
    if (/(.)\1{20,}/.test(content)) {
      return { isSpam: true, reason: 'Terdeteksi spam karakter berulang (> 20 karakter identik berurutan).' };
    }

    // 3. Zero-width character obfuscation hiding
    if (/[\u200B-\u200D\uFEFF]/.test(content)) {
      return { isSpam: true, reason: 'Terdeteksi karakter tersembunyi zero-width (upaya penghindaran filter).' };
    }

    // 4. Kata berulang 3x berurutan (e.g. spam spam spam)
    if (/(\b\w+\b)\s+\1\s+\1/i.test(content)) {
      return { isSpam: true, reason: 'Terdeteksi pengulangan kata berulang-ulang tanpa makna.' };
    }

    // 5. Mention spam: Max 5 mentions
    const mentions = content.match(/@\w+/g);
    if (mentions && mentions.length > 5) {
      return { isSpam: true, reason: 'Terdeteksi mention spam (maksimum 5 mention per pesan).' };
    }

    // 6. Emoji spam: Max 30 emojis
    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
    const emojis = content.match(emojiRegex);
    if (emojis && emojis.length > 30) {
      return { isSpam: true, reason: 'Terdeteksi emoji spam (> 30 emoji dalam 1 pesan).' };
    }

    // 7. Hash Deduplication: Check if identical message sent > 3 times within 5 minutes
    const hash = crypto.createHash('sha256').update(content.trim().toLowerCase()).digest('hex');
    const now = Date.now();
    const existingHash = this.spamHashCache.get(hash);

    if (existingHash && existingHash.user_id === userId) {
      if (now - existingHash.first_seen < 300000) { // 5 minutes window
        existingHash.count += 1;
        existingHash.last_seen = now;
        if (existingHash.count > 3) {
          return { isSpam: true, reason: 'Terdeteksi pengiriman pesan identik berulang (spam flooding > 3x).' };
        }
      } else {
        // Reset window after 5 mins
        existingHash.count = 1;
        existingHash.first_seen = now;
        existingHash.last_seen = now;
      }
    } else {
      this.spamHashCache.set(hash, {
        hash,
        count: 1,
        first_seen: now,
        last_seen: now,
        user_id: userId,
      });
    }

    return { isSpam: false };
  }

  // --- LAPISAN 3: AGEN AI KLASIFIKASI KONTEN (Toxicity & Harassment) ---
  public async classifyContent(content: string): Promise<ModerationClassificationResult> {
    if (!content || !content.trim()) {
      return {
        isHarmful: false,
        confidence: 0,
        categories: { spam: false, hate_speech: false, sexual: false, violence: false, gambling: false },
        detected_by: 'CLEAN',
      };
    }

    const lower = content.toLowerCase();

    // Regex / Semantic Rule Classifier for Indonesian online warkop safety
    const gamblingKeywords = ['judi slot', 'slot gacor', 'zeus slot', 'pragmatic gacor', 'togel online', 'depo pulsa tanpa potongan', 'maxwin'];
    const hateKeywords = ['mati lu', 'bunuh diri', 'dasar babi', 'kaum kotor', 'anjing lu monyet'];
    const sexualKeywords = ['bokep', 'open bo', 'vcs berbayar', 'video porno', 'link bokep'];
    const scamKeywords = ['pinjaman online ilegal', 'transfer pulsa gratis', 'klaim hadiah telegram', 'klik link dapat uang tunai'];

    const hasGambling = gamblingKeywords.some(kw => lower.includes(kw));
    const hasHate = hateKeywords.some(kw => lower.includes(kw));
    const hasSexual = sexualKeywords.some(kw => lower.includes(kw));
    const hasScam = scamKeywords.some(kw => lower.includes(kw));

    if (hasGambling || hasHate || hasSexual || hasScam) {
      const confidence = 0.95; // High confidence match
      return {
        isHarmful: true,
        confidence,
        categories: {
          spam: hasScam,
          hate_speech: hasHate,
          sexual: hasSexual,
          violence: false,
          gambling: hasGambling,
        },
        recommended_action: hasGambling || hasSexual ? 'ban' : 'mute',
        detected_by: 'AI_AGENT',
        details: hasGambling ? 'Promosi judi online ilegal' : hasSexual ? 'Konten seksual eksplisit' : hasHate ? 'Ujaran kebencian / pelecehan' : 'Spam / Penipuan finansial',
      };
    }

    return {
      isHarmful: false,
      confidence: 0.1,
      categories: { spam: false, hate_speech: false, sexual: false, violence: false, gambling: false },
      detected_by: 'CLEAN',
    };
  }

  // --- PIPELINE LENGKAP: moderateMessage ---
  public async moderateMessage(
    userId: string,
    content: string,
    warungId?: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    actionTaken?: ModerationActionType;
    classification?: ModerationClassificationResult;
  }> {
    // 0. Cek Blacklist & Ban Status
    if (this.isUserBlacklisted(userId)) {
      return { allowed: false, reason: 'Akun Anda telah masuk dalam daftar hitam permanen (Blacklist) karena pelanggaran berat.' };
    }

    const banStatus = this.isUserBanned(userId);
    if (banStatus.banned) {
      return { allowed: false, reason: `Akun Anda sedang dibekukan sementara hingga ${banStatus.expiresAt}. Alasan: ${banStatus.reason}` };
    }

    const muteStatus = this.isUserMuted(userId);
    if (muteStatus.muted) {
      return { allowed: false, reason: `Anda sedang dibisukan (mute) hingga ${muteStatus.expiresAt}. Alasan: ${muteStatus.reason}` };
    }

    // 1. Lapisan 1: Rate Limiting
    const rateCheck = this.checkRateLimit(userId, 'message');
    if (!rateCheck.allowed) {
      return { allowed: false, reason: rateCheck.reason };
    }

    // 2. Lapisan 2: Pre-AI Heuristics
    const preAi = this.checkPreAiRules(content, userId);
    if (preAi.isSpam) {
      const escalated = this.recordViolation(userId, warungId, 'Spam Heuristik: ' + preAi.reason, 'medium', content);
      return { allowed: false, reason: preAi.reason, actionTaken: escalated.action_type };
    }

    // 3. Lapisan 3: AI Classifier
    const aiResult = await this.classifyContent(content);
    if (aiResult.isHarmful && aiResult.confidence > 0.9) {
      const severity = aiResult.categories.gambling || aiResult.categories.sexual ? 'critical' : 'high';
      const escalated = this.recordViolation(userId, warungId, aiResult.details || 'Konten berbahaya terdeteksi AI', severity, content);
      return { allowed: false, reason: aiResult.details || 'Pesan diblokir karena melanggar pedoman komunitas warkop.', actionTaken: escalated.action_type, classification: aiResult };
    }

    return { allowed: true, classification: aiResult };
  }

  // --- LAPISAN 4: ESKALASI TINDAKAN MODERASI ---
  public recordViolation(
    userId: string,
    warungId: string | undefined,
    reason: string,
    severity: ModerationAction['severity'],
    contentSnapshot?: string
  ): ModerationAction {
    // Count previous violations
    const userPastActions = this.actions.filter(a => a.user_id === userId);
    const violationCount = userPastActions.length + 1;

    let actionType: ModerationActionType = 'warning';
    let expiresAt: string | null = null;

    if (severity === 'critical') {
      // Direct ban or blacklist for severe violations (e.g. gambling spam bot)
      actionType = violationCount >= 2 ? 'blacklist' : 'ban';
      expiresAt = actionType === 'ban' ? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() : null;
    } else {
      // Escalation Matrix (9.2 Lapisan 4)
      if (violationCount === 1) {
        actionType = 'warning';
      } else if (violationCount === 2) {
        actionType = 'mute';
        expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour mute
      } else if (violationCount === 3) {
        actionType = 'kick';
      } else if (violationCount >= 4) {
        actionType = 'ban';
        expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(); // 7 days ban
      }
    }

    if (actionType === 'blacklist') {
      this.blacklist.set(userId, {
        id: 'bl_' + crypto.randomBytes(6).toString('hex'),
        user_id: userId,
        reason,
        is_permanent: true,
        created_at: new Date().toISOString(),
      });
    }

    const action: ModerationAction = {
      id: 'mod_' + crypto.randomBytes(8).toString('hex'),
      user_id: userId,
      warung_id: warungId || null,
      action_type: actionType,
      reason,
      severity,
      evidence: { content: contentSnapshot },
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };

    this.actions.push(action);
    this.saveToDisk();
    return action;
  }

  // --- STATUS CHECKERS & BLACKLIST MANAGEMENT ---
  public getBlacklist(): BlacklistEntry[] {
    return Array.from(this.blacklist.values());
  }

  public addToBlacklist(userId: string, reason: string, ipAddress?: string): BlacklistEntry {
    const entry: BlacklistEntry = {
      id: 'bl_' + crypto.randomBytes(6).toString('hex'),
      user_id: userId,
      ip_address: ipAddress || null,
      reason,
      is_permanent: true,
      created_at: new Date().toISOString(),
    };
    this.blacklist.set(userId, entry);
    this.saveToDisk();
    return entry;
  }

  public removeFromBlacklist(userId: string): boolean {
    const removed = this.blacklist.delete(userId);
    if (removed) this.saveToDisk();
    return removed;
  }

  public isUserBlacklisted(userId: string, ipAddress?: string): boolean {
    if (this.blacklist.has(userId)) return true;
    if (ipAddress) {
      for (const entry of this.blacklist.values()) {
        if (entry.ip_address === ipAddress) return true;
      }
    }
    return false;
  }

  public isUserBanned(userId: string): { banned: boolean; expiresAt?: string; reason?: string } {
    const now = Date.now();
    const banAction = this.actions
      .filter(a => a.user_id === userId && a.action_type === 'ban')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    if (banAction && banAction.expires_at) {
      const exp = new Date(banAction.expires_at).getTime();
      if (now < exp) {
        return { banned: true, expiresAt: new Date(exp).toLocaleDateString(), reason: banAction.reason };
      }
    }
    return { banned: false };
  }

  public isUserMuted(userId: string): { muted: boolean; expiresAt?: string; reason?: string } {
    const now = Date.now();
    const muteAction = this.actions
      .filter(a => a.user_id === userId && a.action_type === 'mute')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    if (muteAction && muteAction.expires_at) {
      const exp = new Date(muteAction.expires_at).getTime();
      if (now < exp) {
        return { muted: true, expiresAt: new Date(exp).toLocaleTimeString(), reason: muteAction.reason };
      }
    }
    return { muted: false };
  }

  public getUserModerationHistory(userId: string): ModerationAction[] {
    return this.actions
      .filter(a => a.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // --- LAPORAN PENGGUNA & REVIEW QUEUE ---
  public submitReport(params: {
    reporterId: string;
    reporterName?: string;
    reportedUserId: string;
    reportedUserName?: string;
    reason: string;
    warungId?: string | null;
    messageContent?: string;
  }): ModerationReport {
    const report: ModerationReport = {
      id: 'rep_' + crypto.randomBytes(8).toString('hex'),
      reporter_id: params.reporterId,
      reporter_name: params.reporterName,
      reported_user_id: params.reportedUserId,
      reported_user_name: params.reportedUserName,
      warung_id: params.warungId || null,
      reason: params.reason,
      message_content: params.messageContent,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    this.reports.push(report);
    this.saveToDisk();
    return report;
  }

  public getReviewQueue(): ModerationReport[] {
    return this.reports.filter(r => r.status === 'pending');
  }

  public resolveReport(reportId: string, action: ModerationActionType | 'dismiss', reviewerId?: string): boolean {
    const report = this.reports.find(r => r.id === reportId);
    if (!report) return false;

    if (action === 'dismiss') {
      report.status = 'dismissed';
    } else {
      report.status = 'resolved';
      report.action_taken = action;
      this.recordViolation(report.reported_user_id, report.warung_id || undefined, 'Laporan pengguna: ' + report.reason, 'high', report.message_content);
    }

    this.saveToDisk();
    return true;
  }

  // --- CRON JOBS & MAINTENANCE ---
  public cleanExpiredHashCache(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [hash, record] of this.spamHashCache.entries()) {
      if (now - record.last_seen > 3600000) { // 1 hour
        this.spamHashCache.delete(hash);
        cleaned++;
      }
    }
    return cleaned;
  }

  public resetForTesting(): void {
    this.actions = [];
    this.blacklist.clear();
    this.reports = [];
    this.spamHashCache.clear();
    this.userRateBuckets.clear();
  }
}

export const moderationService = new ModerationService();
