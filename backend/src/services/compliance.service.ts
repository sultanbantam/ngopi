import {
  UserConsentRecord,
  UserDeletionRequest,
  AuditLogEntry,
  DataExportPayload,
  SecurityBreachAlert,
} from '../models/compliance.types';
import { pointsEconomyService } from './points.service';
import { PokemonService } from './pokemon.service';
import { EventService } from './event.service';
import { prisma } from '../utils/prisma';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const CURRENT_POLICY_VERSION = 'v3.0-2026';
export const CURRENT_TERMS_VERSION = 'v3.0-2026';
export const DPO_EMAIL = 'founder@ngopi.top';
export const CONTROLLER_NAME = 'Yayasan Sabumi Nusantara Jaya';

export class ComplianceService {
  private consents: Map<string, UserConsentRecord> = new Map();
  private deletionRequests: Map<string, UserDeletionRequest> = new Map();
  private auditLogs: AuditLogEntry[] = [];
  private breachAlerts: SecurityBreachAlert[] = [];
  private storageFile: string;

  constructor(storageDir?: string) {
    const dir = storageDir || path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    }
    this.storageFile = path.join(dir, 'compliance_storage.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf-8');
        const data = JSON.parse(raw);
        if (data.consents && Array.isArray(data.consents)) {
          data.consents.forEach((c: UserConsentRecord) => this.consents.set(c.user_id, c));
        }
        if (data.deletionRequests && Array.isArray(data.deletionRequests)) {
          data.deletionRequests.forEach((d: UserDeletionRequest) => this.deletionRequests.set(d.user_id, d));
        }
        if (data.auditLogs && Array.isArray(data.auditLogs)) {
          this.auditLogs = data.auditLogs;
        }
        if (data.breachAlerts && Array.isArray(data.breachAlerts)) {
          this.breachAlerts = data.breachAlerts;
        }
      }
    } catch {
      // Fallback
    }
  }

  private saveToDisk(): void {
    try {
      const data = {
        consents: Array.from(this.consents.values()),
        deletionRequests: Array.from(this.deletionRequests.values()),
        auditLogs: this.auditLogs.slice(-2000), // Keep latest 2000
        breachAlerts: this.breachAlerts,
        updatedAt: Date.now(),
      };
      fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Non-critical persistence
    }
  }

  // --- AUDIT LOGGING (ISO 27001 Control A.8.16) ---
  public logAudit(params: {
    userId: string;
    action: AuditLogEntry['action'];
    resource: string;
    ipAddress?: string;
    userAgent?: string;
    details?: Record<string, any>;
  }): AuditLogEntry {
    const entry: AuditLogEntry = {
      id: 'audit_' + crypto.randomBytes(8).toString('hex'),
      user_id: params.userId,
      action: params.action,
      resource: params.resource,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
      timestamp: new Date().toISOString(),
      details: params.details,
    };
    this.auditLogs.push(entry);
    this.saveToDisk();
    return entry;
  }

  public getAuditLogs(userId?: string): AuditLogEntry[] {
    if (userId) {
      return this.auditLogs.filter(a => a.user_id === userId);
    }
    return this.auditLogs;
  }

  // --- CONSENT MANAGEMENT (UU PDP Pasal 20 & 22) ---
  public recordConsent(params: {
    userId: string;
    policyVersion?: string;
    termsVersion?: string;
    ipAddress?: string;
    userAgent?: string;
  }): UserConsentRecord {
    const record: UserConsentRecord = {
      user_id: params.userId,
      has_consented: true,
      policy_version: params.policyVersion || CURRENT_POLICY_VERSION,
      terms_version: params.termsVersion || CURRENT_TERMS_VERSION,
      consented_at: new Date().toISOString(),
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    };

    this.consents.set(params.userId, record);
    this.logAudit({
      userId: params.userId,
      action: 'CONSENT_GRANTED',
      resource: 'PRIVACY_POLICY_AND_TERMS',
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      details: { policy_version: record.policy_version },
    });

    this.saveToDisk();
    return record;
  }

  public getConsentStatus(userId: string): {
    has_consented: boolean;
    needs_reconsent: boolean;
    record: UserConsentRecord | null;
  } {
    const record = this.consents.get(userId) || null;
    if (!record || !record.has_consented) {
      return { has_consented: false, needs_reconsent: true, record: null };
    }

    const needsReconsent =
      record.policy_version !== CURRENT_POLICY_VERSION ||
      record.terms_version !== CURRENT_TERMS_VERSION;

    return {
      has_consented: true,
      needs_reconsent: needsReconsent,
      record,
    };
  }

  // --- DATA EXPORT / HAK AKSES & PORTABILITAS DATA (UU PDP Pasal 7 & 8) ---
  public async exportUserData(userId: string, username?: string, ipAddress?: string): Promise<DataExportPayload> {
    const consentRecord = this.consents.get(userId) || null;

    // Fetch Points & Economy data
    const pointsData = pointsEconomyService.getOrCreateUserPoints(userId);
    const transactions = pointsEconomyService.getTransactions(userId);

    // Fetch Pokemon TCG data
    const collection = PokemonService.getUserCollection(userId, username || 'User');

    // Fetch Game Events data
    const hostedEvents = EventService.getMyEvents(userId);
    const invitations = EventService.getInvitedEvents(userId);

    // Attempt to query user from database if prisma is available
    let dbUser: any = null;
    if (prisma && prisma.user) {
      try {
        dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, username: true, display_name: true, avatar_url: true, created_at: true }
        });
      } catch {
        // Fallback
      }
    }

    const payload: DataExportPayload = {
      export_metadata: {
        export_id: 'exp_' + crypto.randomBytes(8).toString('hex'),
        generated_at: new Date().toISOString(),
        format_version: '1.0',
        controller: CONTROLLER_NAME,
        regulatory_framework: 'UU No. 27/2022 tentang Perlindungan Data Pribadi (UU PDP)',
      },
      profile: {
        user_id: userId,
        username: dbUser?.username || username || 'kawan_ngopi',
        display_name: dbUser?.display_name || username || 'Kawan Warkop',
        created_at: dbUser?.created_at?.toISOString() || new Date().toISOString(),
        avatar_url: dbUser?.avatar_url || null,
      },
      consents: consentRecord,
      points_economy: {
        balance: pointsData.balance,
        lifetime: pointsData.lifetime,
        streak_days: pointsData.streak_days,
        transactions,
      },
      pokemon_tcg: {
        cards_count: collection.cards.reduce((sum, c) => sum + (c.quantity || 1), 0),
        cards: collection.cards,
      },
      game_events: {
        hosted_events: hostedEvents,
        invitations,
      },
      chats_metadata: {
        rooms_participated: [userId],
        total_messages_sent: pointsData.daily_chat_count,
        note: 'Isi pesan terlindungi dengan Enkripsi Ujung-ke-Ujung (E2EE X25519/AES-256-GCM) dan hanya tersimpan terdekripsi di perangkat lokal Anda.',
      },
    };

    this.logAudit({
      userId,
      action: 'DATA_EXPORT',
      resource: 'USER_DATA_FULL',
      ipAddress,
      details: { export_id: payload.export_metadata.export_id },
    });

    return payload;
  }

  // --- HAK PENGHAPUSAN / RIGHT TO BE FORGOTTEN (UU PDP Pasal 9) ---
  public requestAccountDeletion(params: {
    userId: string;
    reason?: string;
    ipAddress?: string;
  }): UserDeletionRequest {
    const GRACE_PERIOD_DAYS = 30;
    const scheduledDate = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const request: UserDeletionRequest = {
      user_id: params.userId,
      requested_at: new Date().toISOString(),
      grace_period_days: GRACE_PERIOD_DAYS,
      scheduled_purge_at: scheduledDate,
      status: 'pending_deletion',
      reason: params.reason,
    };

    this.deletionRequests.set(params.userId, request);

    this.logAudit({
      userId: params.userId,
      action: 'ACCOUNT_DELETE_REQUESTED',
      resource: 'USER_ACCOUNT',
      ipAddress: params.ipAddress,
      details: { scheduled_purge_at: scheduledDate, reason: params.reason },
    });

    this.saveToDisk();
    return request;
  }

  public cancelAccountDeletion(userId: string, ipAddress?: string): boolean {
    const existing = this.deletionRequests.get(userId);
    if (!existing || existing.status !== 'pending_deletion') {
      return false;
    }

    existing.status = 'cancelled';
    this.deletionRequests.set(userId, existing);

    this.logAudit({
      userId,
      action: 'ACCOUNT_DELETE_CANCELLED',
      resource: 'USER_ACCOUNT',
      ipAddress,
    });

    this.saveToDisk();
    return true;
  }

  public getDeletionStatus(userId: string): UserDeletionRequest | null {
    return this.deletionRequests.get(userId) || null;
  }

  // --- BREACH NOTIFICATION (UU PDP Pasal 46: Pemberitahuan 3x24 Jam) ---
  public reportSecurityIncident(params: {
    severity: SecurityBreachAlert['severity'];
    description: string;
    affectedCount: number;
    reporterUserId?: string;
  }): SecurityBreachAlert {
    const detectedAt = new Date();
    // 3 x 24 jam = 72 hours deadline
    const deadline = new Date(detectedAt.getTime() + 72 * 60 * 60 * 1000);

    const alert: SecurityBreachAlert = {
      incident_id: 'inc_' + crypto.randomBytes(8).toString('hex'),
      severity: params.severity,
      detected_at: detectedAt.toISOString(),
      affected_accounts_count: params.affectedCount,
      description: params.description,
      containment_status: 'INVESTIGATING',
      notification_deadline_kominfo: deadline.toISOString(),
      dpo_contact: DPO_EMAIL,
    };

    this.breachAlerts.push(alert);
    this.logAudit({
      userId: params.reporterUserId || 'SYSTEM',
      action: 'BREACH_ALERT',
      resource: 'SECURITY_MONITORING',
      details: { incident_id: alert.incident_id, severity: alert.severity },
    });

    this.saveToDisk();
    return alert;
  }

  public getBreachAlerts(): SecurityBreachAlert[] {
    return this.breachAlerts;
  }

  public resetForTesting(): void {
    this.consents.clear();
    this.deletionRequests.clear();
    this.auditLogs = [];
    this.breachAlerts = [];
  }
}

export const complianceService = new ComplianceService();
