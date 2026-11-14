import { prisma as defaultPrisma } from '../../utils/prisma';
import { ensureUserIdentity, getActiveCommissionRule } from './ngopinomicEconomy.service';
import { generateReferenceCode } from './ngopinomicLedger.service';

export const DEFAULT_ECOSYSTEM_APPS = [
  {
    app_code: 'boomboom',
    name: 'BoomBoom Transport & Logistics',
    category: 'transport_logistics',
    allowed_scopes: ['identity:basic', 'identity:email', 'boomboom:role_hint'],
    is_active: true,
  },
  {
    app_code: 'bamboochain_marketplace',
    name: 'BaMbooChain Marketplace',
    category: 'marketplace',
    allowed_scopes: ['identity:basic', 'identity:email'],
    is_active: true,
  },
  {
    app_code: 'bamboochain_academy',
    name: 'BaMbooChain Academy',
    category: 'education',
    allowed_scopes: ['identity:basic'],
    is_active: true,
  },
];

export async function ensureEcosystemApps(db: any = defaultPrisma) {
  for (const app of DEFAULT_ECOSYSTEM_APPS) {
    const existing = await db.ecosystemApplication.findUnique({ where: { app_code: app.app_code } });
    if (!existing) {
      await db.ecosystemApplication.create({ data: app });
    }
  }
}

export async function getBmcGatewayStatus(db: any = defaultPrisma, userId: string) {
  const rule = await getActiveCommissionRule(db);
  const recentBmc = await db.bmcTransaction.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
    take: 10,
  });

  return {
    mode: rule.bmc_utility_enabled ? 'controlled_live' : 'configuration_only',
    bmc_utility_enabled: rule.bmc_utility_enabled,
    compliance_notice:
      'Manfaat BMC berjalan dalam mode terkendali dan terpisah dari Poin Ngopi serta Rupiah. Fitur pertukaran atau penukaran token memerlukan persetujuan hukum dan regulasi Indonesia.',
    recent_transactions: recentBmc,
  };
}

export async function recordBmcUtilityPreview(
  db: any = defaultPrisma,
  params: { userId: string; utilityCode: string; amountBmc: number; idempotencyKey: string }
) {
  const rule = await getActiveCommissionRule(db);
  if (!rule.bmc_utility_enabled) {
    return db.bmcTransaction.create({
      data: {
        user_id: params.userId,
        utility_code: params.utilityCode,
        amount_bmc: params.amountBmc,
        mode: 'configuration_only',
        status: 'blocked_config_only',
        reference_code: generateReferenceCode('BMC'),
        idempotency_key: params.idempotencyKey,
        metadata: { reason: 'BMC utility is in configuration-only mode pending legal approval' },
      },
    });
  }

  return db.bmcTransaction.create({
    data: {
      user_id: params.userId,
      utility_code: params.utilityCode,
      amount_bmc: params.amountBmc,
      mode: 'live',
      status: 'recorded',
      reference_code: generateReferenceCode('BMC'),
      idempotency_key: params.idempotencyKey,
    },
  });
}

export async function setEcosystemConsent(
  db: any = defaultPrisma,
  params: { userId: string; appCode: string; grantedScopes: string[]; revoke?: boolean }
) {
  await ensureEcosystemApps(db);
  const app = await db.ecosystemApplication.findUnique({ where: { app_code: params.appCode } });
  if (!app || !app.is_active) {
    throw new Error('Aplikasi ekosistem tidak ditemukan atau tidak aktif.');
  }

  const validScopes = params.grantedScopes.filter((s) => app.allowed_scopes.includes(s));

  if (params.revoke) {
    return db.userConsent.upsert({
      where: { user_id_app_id: { user_id: params.userId, app_id: app.id } },
      update: { granted_scopes: [], revoked_at: new Date() },
      create: { user_id: params.userId, app_id: app.id, granted_scopes: [], revoked_at: new Date() },
    });
  }

  return db.userConsent.upsert({
    where: { user_id_app_id: { user_id: params.userId, app_id: app.id } },
    update: { granted_scopes: validScopes, revoked_at: null, granted_at: new Date() },
    create: { user_id: params.userId, app_id: app.id, granted_scopes: validScopes },
  });
}

export type BoomBoomRole =
  | 'passenger'
  | 'driver'
  | 'courier'
  | 'sender'
  | 'receiver'
  | 'logistics_partner';

/**
 * BoomBoom Identity Gateway:
 * Provides scoped Ngopi ID authentication ONLY if UserConsent is active.
 * Explicitly returns operational_authorized: false so BoomBoom enforces its own safety,
 * licensing, KYC, and insurance checks independently.
 */
export async function authorizeBoomBoomIdentity(
  db: any = defaultPrisma,
  params: {
    user: { id: string; username: string; display_name?: string; bmc_id?: number };
    requestedRole: BoomBoomRole;
    requiredScope?: string;
  }
) {
  await ensureEcosystemApps(db);
  const app = await db.ecosystemApplication.findUnique({ where: { app_code: 'boomboom' } });
  if (!app || !app.is_active) {
    throw new Error('Integrasi BoomBoom belum aktif.');
  }

  const consent = await db.userConsent.findUnique({
    where: { user_id_app_id: { user_id: params.user.id, app_id: app.id } },
  });
  const requiredScope = params.requiredScope || 'identity:basic';

  if (!consent || consent.revoked_at || !consent.granted_scopes.includes(requiredScope)) {
    throw new Error('Izin aplikasi BoomBoom belum diberikan atau telah dicabut.');
  }

  const identity = await ensureUserIdentity(db, params.user);
  const payload: Record<string, any> = {
    app_code: 'boomboom',
    requested_role: params.requestedRole,
    ngopi_id: identity.ngopi_id,
    display_name: params.user.display_name || params.user.username,
    granted_scopes: consent.granted_scopes,
    operational_authorized: false,
    operational_notice:
      'Ngopi ID hanya memverifikasi identitas dasar. Otorisasi operasional pengemudi/kurir/mitra (SIM, STNK, asuransi, keselamatan) tetap berada di bawah sistem BoomBoom.',
  };

  if (consent.granted_scopes.includes('identity:email')) {
    payload.basic_email = identity.basic_email;
  }

  return payload;
}
