import assert from 'assert';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/utils/prisma';
import { MerchantService } from '../src/services/merchant.service';
import { TelecomService } from '../src/services/telecom.service';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

function makeToken(id: string, username: string, role = 'user') {
  return jwt.sign({ id, username, role, token_type: 'access' }, JWT_SECRET, { expiresIn: '10m' });
}

async function runTests() {
  const mockUsers = new Map<string, { id: string; username: string; role: string; bmc_id: number }>([
    ['user-mou-1', { id: 'user-mou-1', username: 'mouuser', role: 'user', bmc_id: 301 }],
    ['merchant-pending-1', { id: 'merchant-pending-1', username: 'pend', role: 'merchant', bmc_id: 302 }],
    ['merchant-rejected-1', { id: 'merchant-rejected-1', username: 'rej', role: 'merchant', bmc_id: 303 }],
    ['merchant-verified-only-1', { id: 'merchant-verified-only-1', username: 'veronly', role: 'merchant', bmc_id: 304 }],
    ['merchant-approved-1', { id: 'merchant-approved-1', username: 'app1', role: 'merchant', bmc_id: 305 }],
    ['merchant-approved-2', { id: 'merchant-approved-2', username: 'app2', role: 'merchant', bmc_id: 306 }],
    ['admin-1', { id: 'admin-1', username: 'adminop', role: 'admin', bmc_id: 307 }],
    ['founder-0-id', { id: 'founder-0-id', username: 'ngopi', role: 'superadmin', bmc_id: 1 }],
    ['warung-100-id', { id: 'warung-100-id', username: 'warung', role: 'user', bmc_id: 100 }],
  ]);

  const mockProfiles = new Map<string, any>([
    [
      'merchant-pending-1',
      {
        id: 'm_pending_1',
        user_id: 'merchant-pending-1',
        cafe_name: 'Cafe Pending',
        qr_code_token: 'NGOPI_PEND_1',
        is_verified: false,
        review_status: 'pending',
        is_showcase: false,
        reward_points: 50,
      },
    ],
    [
      'merchant-rejected-1',
      {
        id: 'm_rejected_1',
        user_id: 'merchant-rejected-1',
        cafe_name: 'Cafe Rejected',
        qr_code_token: 'NGOPI_REJ_1',
        is_verified: false,
        review_status: 'rejected',
        is_showcase: false,
        reward_points: 50,
      },
    ],
    [
      'merchant-verified-only-1',
      {
        id: 'm_ver_only_1',
        user_id: 'merchant-verified-only-1',
        cafe_name: 'Cafe Verified Only',
        qr_code_token: 'NGOPI_VER_1',
        is_verified: true,
        review_status: 'pending',
        is_showcase: false,
        reward_points: 50,
      },
    ],
    [
      'merchant-approved-1',
      {
        id: 'm_app_1',
        user_id: 'merchant-approved-1',
        cafe_name: 'Cafe Approved 1',
        qr_code_token: 'NGOPI_APP_1',
        is_verified: true,
        review_status: 'approved',
        is_showcase: false,
        reward_points: 50,
      },
    ],
    [
      'merchant-approved-2',
      {
        id: 'm_app_2',
        user_id: 'merchant-approved-2',
        cafe_name: 'Cafe Approved 2',
        qr_code_token: 'NGOPI_APP_2',
        is_verified: true,
        review_status: 'approved',
        is_showcase: false,
        reward_points: 50,
      },
    ],
  ]);

  const showcaseProfile = {
    id: 'm_warkop_sahabat',
    user_id: null,
    cafe_name: 'Warkop Seduh Sahabat',
    qr_code_token: 'NGOPI_WARKOP_SEDUH',
    is_verified: true,
    review_status: 'approved',
    is_showcase: true,
    reward_points: 50,
    promos: [],
  };

  const mockAgreements = new Map<string, any>();

  (prisma as any).user = {
    findUnique: async ({ where }: any) => mockUsers.get(where.id) || null,
    update: async ({ where, data }: any) => {
      const existing = mockUsers.get(where.id);
      if (!existing) throw new Error('User not found');
      const updated = { ...existing, ...data };
      mockUsers.set(where.id, updated);
      return updated;
    },
  };

  (prisma as any).merchantProfile = {
    findUnique: async ({ where }: any) => {
      if (where.user_id) return mockProfiles.get(where.user_id) || null;
      if (where.id === showcaseProfile.id) return showcaseProfile;
      for (const p of mockProfiles.values()) if (p.id === where.id) return p;
      return null;
    },
    findFirst: async ({ where }: any) => {
      const ors = where?.OR || [];
      for (const p of [showcaseProfile, ...mockProfiles.values()]) {
        for (const cond of ors) {
          if ((cond.qr_code_token && p.qr_code_token === cond.qr_code_token) || (cond.id && p.id === cond.id)) {
            return { ...p, promos: [] };
          }
        }
      }
      return null;
    },
    create: async ({ data }: any) => {
      const created = { id: `m_${data.user_id}`, ...data, created_at: new Date(), updated_at: new Date() };
      mockProfiles.set(data.user_id, created);
      return created;
    },
    update: async ({ where, data }: any) => {
      const existing = where.user_id
        ? mockProfiles.get(where.user_id)
        : Array.from(mockProfiles.values()).find((p) => p.id === where.id);
      if (!existing) throw new Error('Profile not found');
      const updated = { ...existing, ...data, updated_at: new Date() };
      mockProfiles.set(existing.user_id, updated);
      return updated;
    },
    upsert: async ({ where, create, update }: any) => {
      const existing = mockProfiles.get(where.user_id);
      if (existing) {
        const updated = { ...existing, ...update };
        mockProfiles.set(where.user_id, updated);
        return updated;
      }
      const created = { id: `m_${create.user_id}`, ...create };
      mockProfiles.set(where.user_id, created);
      return created;
    },
  };

  (prisma as any).merchantReviewAudit = {
    create: async ({ data }: any) => ({ id: `aud_${Date.now()}`, ...data, created_at: new Date() }),
    findMany: async () => [],
  };

  (prisma as any).$transaction = async (fn: any) => fn(prisma);

  (prisma as any).merchantAgreement = {
    findUnique: async ({ where }: any) => mockAgreements.get(where.user_id) || null,
    upsert: async ({ where, create, update }: any) => {
      const existing = mockAgreements.get(where.user_id);
      const next = existing ? { ...existing, ...update } : { id: `agr_${where.user_id}`, ...create };
      mockAgreements.set(where.user_id, next);
      return next;
    },
    update: async ({ where, data }: any) => {
      const existing = mockAgreements.get(where.user_id);
      if (!existing) throw new Error('Agreement not found');
      const next = { ...existing, ...data };
      mockAgreements.set(where.user_id, next);
      return next;
    },
  };

  (prisma as any).group = {
    create: async ({ data }: any) => ({ id: 'grp_test_1', ...data }),
  };

  (prisma as any).message = {
    create: async ({ data }: any) => ({ id: 'msg_test_1', ...data }),
  };

  const { default: merchantRoutes } = await import('../src/routes/merchant.routes');
  const { default: partnershipRoutes } = await import('../src/routes/partnership.routes');

  const app = express();
  app.use(express.json());
  app.use('/api/merchant', merchantRoutes);
  app.use('/api/partnership', partnershipRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1 & 2. Partnership endpoints require verified JWT (no x-user-id / jwt.decode spoofing)
    const unauthStatus = await fetch(`${baseUrl}/api/partnership/status`, {
      headers: { 'x-user-id': 'user-mou-1' },
    });
    assert.strictEqual(unauthStatus.status, 401);

    const mouToken = makeToken('user-mou-1', 'mouuser', 'user');
    const submitRes = await fetch(`${baseUrl}/api/partnership/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mouToken}` },
      body: JSON.stringify({
        owner_name: 'Pak Mou',
        cafe_name: 'Warkop MoU',
        address: 'Jl. Kemerdekaan 10',
        phone: '08123456789',
      }),
    });
    assert.strictEqual(submitRes.status, 200);

    const signRes = await fetch(`${baseUrl}/api/partnership/verify-sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${mouToken}` },
    });
    assert.strictEqual(signRes.status, 200);
    const signBody = await signRes.json();
    assert.strictEqual(signBody.success, true);
    assert.strictEqual(signBody.agreement.is_agreed, true);

    // Must NOT promote User.role or auto-approve MerchantProfile
    assert.strictEqual(mockUsers.get('user-mou-1')?.role, 'user', 'Agreement signing must not promote User.role');
    const syncedProfile = mockProfiles.get('user-mou-1');
    assert.ok(syncedProfile, 'Pending profile should exist');
    assert.strictEqual(syncedProfile.is_verified, false);
    assert.strictEqual(syncedProfile.review_status, 'pending');
    console.log('✅ [PASS] 1 & 2. Partnership MoU preserved, requires JWT, and does not promote role or auto-approve');

    // 3 & 4. Nullable showcase user_id & showcase cannot enter merchant dashboard
    const partners = await MerchantService.listPartners();
    for (const p of partners) {
      if (['m_warkop_sahabat', 'm_kenangan_senja', 'm_barista_corner'].includes(p.id)) {
        assert.strictEqual(p.user_id, null);
        assert.strictEqual(p.is_showcase, true);
      }
    }
    const showcaseDash = await MerchantService.getDashboard('m_warkop_sahabat');
    assert.strictEqual(showcaseDash, null, 'Showcase ID must not resolve a merchant dashboard');

    const adminToken = makeToken('admin-1', 'adminop', 'admin');
    const adminShowcaseRes = await fetch(`${baseUrl}/api/merchant/dashboard?merchant_id=m_warkop_sahabat`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(adminShowcaseRes.status, 403, 'Showcase profile must be blocked from dashboard');
    console.log('✅ [PASS] 3 & 4. Showcase profiles have user_id=null and cannot enter merchant dashboard');

    // 5. Cross-merchant dashboard access blocked
    const app1Token = makeToken('merchant-approved-1', 'app1', 'merchant');
    const crossDashRes = await fetch(`${baseUrl}/api/merchant/dashboard?merchant_id=m_app_2`, {
      headers: { Authorization: `Bearer ${app1Token}` },
    });
    assert.strictEqual(crossDashRes.status, 403);
    console.log('✅ [PASS] 5. Cross-merchant dashboard access blocked with 403');

    // 6, 7 & 8. Approved required; is_verified=true alone, pending, and rejected all blocked (403)
    const ownDashRes = await fetch(`${baseUrl}/api/merchant/dashboard`, {
      headers: { Authorization: `Bearer ${app1Token}` },
    });
    assert.strictEqual(ownDashRes.status, 200);

    for (const [uid, uname] of [
      ['merchant-verified-only-1', 'veronly'],
      ['merchant-pending-1', 'pend'],
      ['merchant-rejected-1', 'rej'],
    ] as const) {
      const tok = makeToken(uid, uname, 'merchant');
      const dashRes = await fetch(`${baseUrl}/api/merchant/dashboard`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      assert.strictEqual(dashRes.status, 403, `Expected 403 on /dashboard for ${uid}`);

      const promoRes = await fetch(`${baseUrl}/api/merchant/promo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ title: 'Test', description: 'Test' }),
      });
      assert.strictEqual(promoRes.status, 403, `Expected 403 on POST /promo for ${uid}`);
    }
    console.log('✅ [PASS] 6, 7 & 8. is_verified=true alone, pending, and rejected profiles blocked from management (403)');

    // 9 & 10. Founder #0 & warung #100 safeguards
    const telecom = new TelecomService();
    const map = telecom.buildDirectoryMap([
      mockUsers.get('founder-0-id')!,
      mockUsers.get('warung-100-id')!,
    ]);
    assert.strictEqual(map.get('founder-0-id')?.number, '0');
    assert.strictEqual(map.get('founder-0-id')?.email, 'warung@ngopi.top');
    assert.strictEqual(mockUsers.get('founder-0-id')?.role, 'superadmin');
    assert.strictEqual(map.get('warung-100-id')?.number, '100');
    assert.strictEqual(mockUsers.get('warung-100-id')?.role, 'user');
    console.log('✅ [PASS] 9 & 10. Founder #0 and warung #100 identity safeguards intact');

    console.log('\n🎉 ALL STAGE B1A TESTS PASSED!');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Stage B1A Test failed:', err);
  process.exit(1);
});
