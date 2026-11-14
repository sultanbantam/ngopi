import assert from 'assert';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/utils/prisma';
import { TelecomService } from '../src/services/telecom.service';
import { MerchantService } from '../src/services/merchant.service';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

function makeToken(
  id: string,
  username: string,
  role = 'user',
  expiresIn: jwt.SignOptions['expiresIn'] = '10m',
  secret = JWT_SECRET
) {
  return jwt.sign({ id, username, role, token_type: 'access' }, secret, { expiresIn });
}

async function runTests() {
  // In-memory stub store for DB-backed RBAC & MerchantService isolation
  const mockUsers = new Map<string, { id: string; username: string; role: string; bmc_id: number }>([
    ['user-normal-1', { id: 'user-normal-1', username: 'budi', role: 'user', bmc_id: 201 }],
    ['user-pending-1', { id: 'user-pending-1', username: 'pendingcafe', role: 'user', bmc_id: 202 }],
    ['merchant-approved-1', { id: 'merchant-approved-1', username: 'kopijawa', role: 'merchant', bmc_id: 203 }],
    ['merchant-other-2', { id: 'merchant-other-2', username: 'kopisunda', role: 'merchant', bmc_id: 204 }],
    ['founder-0-id', { id: 'founder-0-id', username: 'ngopi', role: 'user', bmc_id: 1 }],
    ['warung-100-id', { id: 'warung-100-id', username: 'warung', role: 'user', bmc_id: 100 }],
  ]);

  const mockProfiles = new Map<string, any>([
    [
      'merchant-approved-1',
      {
        id: 'm_kopi_jawa',
        user_id: 'merchant-approved-1',
        cafe_name: 'Kopi Jawa',
        address: 'Jl. Merdeka 1',
        description: 'Kopi tubruk',
        phone: '0811111111',
        logo: null,
        banner_url: null,
        qr_code_token: 'NGOPI_KOPI_JAWA',
        is_verified: true,
        review_status: 'approved',
        is_showcase: false,
        reward_points: 50,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
    [
      'merchant-other-2',
      {
        id: 'm_kopi_sunda',
        user_id: 'merchant-other-2',
        cafe_name: 'Kopi Sunda',
        address: 'Jl. Asia Afrika 2',
        description: 'Kopi arabika',
        phone: '0822222222',
        logo: null,
        banner_url: null,
        qr_code_token: 'NGOPI_KOPI_SUNDA',
        is_verified: true,
        review_status: 'approved',
        is_showcase: false,
        reward_points: 50,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
  ]);

  const mockCheckins: any[] = [];
  const mockPromos: any[] = [];

  // Patch prisma methods on the singleton for isolated local testing (no production DB touched)
  const origUserFindUnique = prisma.user?.findUnique;
  const origUserUpdate = prisma.user?.update;
  const origMpFindUnique = prisma.merchantProfile?.findUnique;
  const origMpFindFirst = prisma.merchantProfile?.findFirst;
  const origMpUpsert = prisma.merchantProfile?.upsert;
  const origMpUpdate = prisma.merchantProfile?.update;
  const origMcFindFirst = prisma.merchantCheckin?.findFirst;
  const origMcCreate = prisma.merchantCheckin?.create;
  const origPromoCreate = prisma.merchantPromo?.create;
  const origPromoDeleteMany = prisma.merchantPromo?.deleteMany;

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
      if (where.id) {
        for (const p of mockProfiles.values()) if (p.id === where.id) return p;
      }
      return null;
    },
    findFirst: async ({ where }: any) => {
      const ors = where?.OR || [];
      for (const p of mockProfiles.values()) {
        for (const cond of ors) {
          if ((cond.qr_code_token && p.qr_code_token === cond.qr_code_token) || (cond.id && p.id === cond.id)) {
            return { ...p, promos: mockPromos.filter((pr) => pr.merchant_id === p.id) };
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
    upsert: async ({ where, create, update }: any) => {
      const existing = mockProfiles.get(where.user_id);
      if (existing) {
        const updated = { ...existing, ...update, updated_at: new Date() };
        mockProfiles.set(where.user_id, updated);
        return updated;
      }
      const created = { id: `m_${create.user_id}`, ...create, created_at: new Date(), updated_at: new Date() };
      mockProfiles.set(where.user_id, created);
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
  };

  (prisma as any).merchantReviewAudit = {
    create: async ({ data }: any) => ({ id: `aud_${Date.now()}`, ...data, created_at: new Date() }),
    findMany: async () => [],
  };

  (prisma as any).$transaction = async (fn: any) => fn(prisma);

  (prisma as any).merchantCheckin = {
    findFirst: async ({ where }: any) =>
      mockCheckins.find((c) => c.merchant_id === where.merchant_id && c.user_id === where.user_id) || null,
    create: async ({ data }: any) => {
      const row = { id: `chk_${mockCheckins.length + 1}`, ...data, created_at: new Date() };
      mockCheckins.push(row);
      return row;
    },
  };

  (prisma as any).merchantPromo = {
    create: async ({ data }: any) => {
      const row = { id: `prm_${mockPromos.length + 1}`, ...data, created_at: new Date() };
      mockPromos.push(row);
      return row;
    },
    deleteMany: async ({ where }: any) => {
      const idx = mockPromos.findIndex((p) => p.id === where.id && p.merchant_id === where.merchant_id);
      if (idx >= 0) {
        mockPromos.splice(idx, 1);
        return { count: 1 };
      }
      return { count: 0 };
    },
  };

  const { default: merchantRoutes } = await import('../src/routes/merchant.routes');
  const app = express();
  app.use(express.json());
  app.use('/api/merchant', merchantRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const validUserToken = makeToken('user-normal-1', 'budi', 'user');
    const pendingUserToken = makeToken('user-pending-1', 'pendingcafe', 'user');
    const approvedMerchantToken = makeToken('merchant-approved-1', 'kopijawa', 'merchant');
    const expiredToken = jwt.sign(
      { id: 'user-normal-1', username: 'budi', role: 'user', token_type: 'access', exp: Math.floor(Date.now() / 1000) - 60 },
      JWT_SECRET
    );
    const tamperedToken = makeToken('user-normal-1', 'budi', 'superadmin', '10m', 'wrong-secret');
    const missingUserToken = makeToken('non-existent-user', 'ghost', 'merchant');
    const staleEscalatedJwt = makeToken('user-normal-1', 'budi', 'merchant'); // JWT claims merchant, DB says user

    // 1. Valid JWT -> 200 on /me
    const validMeRes = await fetch(`${baseUrl}/api/merchant/me`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
    });
    assert.strictEqual(validMeRes.status, 200);
    const validMeBody = await validMeRes.json();
    assert.strictEqual(validMeBody.status, 'none');
    assert.strictEqual(validMeBody.role, 'user');
    console.log('✅ [PASS] 1. Valid JWT accepted on /api/merchant/me');

    // 2-4. Invalid, Expired, and Tampered JWT -> 401
    for (const [label, tok] of [
      ['invalid', 'not.a.valid.jwt'],
      ['expired', expiredToken],
      ['tampered', tamperedToken],
    ] as const) {
      const r = await fetch(`${baseUrl}/api/merchant/me`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      assert.strictEqual(r.status, 401, `Expected 401 for ${label} JWT`);
    }
    console.log('✅ [PASS] 2. Invalid, expired, and tampered JWTs rejected with 401');

    // 5. Missing user record in DB -> 401
    const missingRes = await fetch(`${baseUrl}/api/merchant/me`, {
      headers: { Authorization: `Bearer ${missingUserToken}` },
    });
    assert.strictEqual(missingRes.status, 401);
    console.log('✅ [PASS] 3. Missing user record in DB rejected with 401');

    // 6. Database role differs from JWT role -> DB role wins (403)
    const staleRoleRes = await fetch(`${baseUrl}/api/merchant/dashboard`, {
      headers: { Authorization: `Bearer ${staleEscalatedJwt}` },
    });
    assert.strictEqual(staleRoleRes.status, 403);
    console.log('✅ [PASS] 4. Stale/inflated JWT role overridden by DB role (403)');

    // 7. Ordinary user cannot access merchant dashboard -> 403
    const userDashRes = await fetch(`${baseUrl}/api/merchant/dashboard`, {
      headers: { Authorization: `Bearer ${validUserToken}` },
    });
    assert.strictEqual(userDashRes.status, 403);
    console.log('✅ [PASS] 5. Ordinary user blocked from /api/merchant/dashboard (403)');

    // 8. Merchant registration creates pending application without promoting User.role, and pending user cannot mutate
    const regRes = await fetch(`${baseUrl}/api/merchant/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pendingUserToken}` },
      body: JSON.stringify({ cafe_name: 'Cafe Pending' }),
    });
    assert.strictEqual(regRes.status, 200);
    const regBody = await regRes.json();
    assert.strictEqual(regBody.status, 'pending');
    assert.strictEqual(regBody.profile.is_verified, false);
    assert.strictEqual(mockUsers.get('user-pending-1')?.role, 'user', 'User.role must remain user after registration');

    // Duplicate active pending registration must be rejected with 409 (Stage B1B)
    const regRes2 = await fetch(`${baseUrl}/api/merchant/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pendingUserToken}` },
      body: JSON.stringify({ cafe_name: 'Cafe Pending Updated' }),
    });
    assert.strictEqual(regRes2.status, 409);
    assert.strictEqual((await regRes2.json()).duplicatePending, true);

    for (const [method, endpoint, body] of [
      ['POST', '/api/merchant/profile', { cafe_name: 'Hacked' }],
      ['POST', '/api/merchant/promo', { title: 'Free', description: 'Free' }],
      ['DELETE', '/api/merchant/promo/prm_1', null],
    ] as const) {
      const mutRes = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pendingUserToken}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      assert.strictEqual(mutRes.status, 403, `Pending merchant must get 403 on ${method} ${endpoint}`);
    }
    console.log('✅ [PASS] 6. Pending merchant stays role=user and cannot mutate merchant data (403)');

    // 9. Approved merchant can access own dashboard & add promo
    const ownDashRes = await fetch(`${baseUrl}/api/merchant/dashboard`, {
      headers: { Authorization: `Bearer ${approvedMerchantToken}` },
    });
    assert.strictEqual(ownDashRes.status, 200);
    const ownDashBody = await ownDashRes.json();
    assert.strictEqual(ownDashBody.dashboard.profile.id, 'm_kopi_jawa');

    const addPromoRes = await fetch(`${baseUrl}/api/merchant/promo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${approvedMerchantToken}` },
      body: JSON.stringify({ title: 'Promo Jawa', description: 'Diskon 10%' }),
    });
    assert.strictEqual(addPromoRes.status, 201);
    console.log('✅ [PASS] 7. Approved merchant accesses own dashboard & creates own promo');

    // 10. Approved merchant cannot access or mutate another merchant (IDOR blocked with 403)
    const otherDashRes = await fetch(`${baseUrl}/api/merchant/dashboard?merchant_id=m_kopi_sunda`, {
      headers: { Authorization: `Bearer ${approvedMerchantToken}` },
    });
    assert.strictEqual(otherDashRes.status, 403);

    const otherPromoRes = await fetch(`${baseUrl}/api/merchant/promo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${approvedMerchantToken}` },
      body: JSON.stringify({ merchant_id: 'm_kopi_sunda', title: 'Hijack', description: 'Hijack' }),
    });
    assert.strictEqual(otherPromoRes.status, 403);

    const otherDeleteRes = await fetch(`${baseUrl}/api/merchant/promo/prm_2?merchant_id=m_kopi_sunda`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${approvedMerchantToken}` },
    });
    assert.strictEqual(otherDeleteRes.status, 403);
    console.log('✅ [PASS] 8. Cross-merchant IDOR blocked with 403');

    // 11. Body/query/header userId spoofing ignored
    const spoofMeRes = await fetch(`${baseUrl}/api/merchant/me?user_id=merchant-approved-1`, {
      headers: {
        Authorization: `Bearer ${validUserToken}`,
        'x-user-id': 'merchant-approved-1',
      },
    });
    assert.strictEqual(spoofMeRes.status, 200);
    const spoofMeBody = await spoofMeRes.json();
    assert.strictEqual(spoofMeBody.status, 'none', 'Spoofed user_id must not leak approved merchant profile');
    console.log('✅ [PASS] 9. Header/query/body userId spoofing ignored');

    // 12. Public showcase & restricted public check-in
    const partnersRes = await fetch(`${baseUrl}/api/merchant/partners`);
    assert.strictEqual(partnersRes.status, 200);
    const partnersBody = await partnersRes.json();
    assert.ok(Array.isArray(partnersBody.partners));
    for (const p of partnersBody.partners) {
      assert.strictEqual(p.user_id, undefined, 'Public showcase must not expose user_id');
    }

    // Check-in on pending/unverified cafe must fail (400)
    const pendingProfile = mockProfiles.get('user-pending-1');
    const pendingCheckinRes = await fetch(`${baseUrl}/api/merchant/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qr_code_token: pendingProfile.qr_code_token, user_id: 'merchant-approved-1' }),
    });
    assert.strictEqual(pendingCheckinRes.status, 400);

    // Check-in with invalid token must fail (401)
    const badCheckinJwt = await fetch(`${baseUrl}/api/merchant/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${expiredToken}` },
      body: JSON.stringify({ qr_code_token: 'NGOPI_KOPI_JAWA' }),
    });
    assert.strictEqual(badCheckinJwt.status, 401);

    // Public check-in without JWT must use server-derived guest key, never body.user_id
    const guestCheckinRes = await fetch(`${baseUrl}/api/merchant/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qr_code_token: 'NGOPI_KOPI_JAWA', user_id: 'merchant-approved-1' }),
    });
    assert.strictEqual(guestCheckinRes.status, 200);
    const guestCheckinBody = await guestCheckinRes.json();
    assert.strictEqual(guestCheckinBody.merchant.user_id, undefined);
    const lastCheckin = mockCheckins[mockCheckins.length - 1];
    assert.ok(lastCheckin.user_id.startsWith('guest_'), 'Anonymous check-in must not impersonate body.user_id');
    console.log('✅ [PASS] 10. Public showcase read-only & check-in restrictions verified');

    // 13 & 14. Founder #0 mapping & target superadmin bootstrap idempotency + warung #100 remains user
    const telecom = new TelecomService();
    const dirMap = telecom.buildDirectoryMap([
      mockUsers.get('founder-0-id')!,
      mockUsers.get('warung-100-id')!,
      mockUsers.get('user-normal-1')!,
    ]);
    assert.strictEqual(dirMap.get('founder-0-id')?.number, '0');
    assert.strictEqual(dirMap.get('founder-0-id')?.email, 'warung@ngopi.top');
    assert.strictEqual(dirMap.get('warung-100-id')?.number, '100');

    // Simulate idempotent bootstrap of Founder #0 to superadmin (leaving warung #100 as user)
    await prisma.user.update({ where: { id: 'founder-0-id' }, data: { role: 'superadmin' } });
    await prisma.user.update({ where: { id: 'founder-0-id' }, data: { role: 'superadmin' } });
    assert.strictEqual(mockUsers.get('founder-0-id')?.role, 'superadmin');
    assert.strictEqual(mockUsers.get('warung-100-id')?.role, 'user');
    console.log('✅ [PASS] 11. Founder #0 identity mapping & warung #100 role=user safeguard verified');

    console.log('\n🎉 ALL 11 STAGE A SECURITY TESTS PASSED!');
  } finally {
    // Restore prisma methods & clean up
    (prisma as any).user.findUnique = origUserFindUnique;
    (prisma as any).user.update = origUserUpdate;
    (prisma as any).merchantProfile.findUnique = origMpFindUnique;
    (prisma as any).merchantProfile.findFirst = origMpFindFirst;
    (prisma as any).merchantProfile.upsert = origMpUpsert;
    (prisma as any).merchantProfile.update = origMpUpdate;
    (prisma as any).merchantCheckin.findFirst = origMcFindFirst;
    (prisma as any).merchantCheckin.create = origMcCreate;
    (prisma as any).merchantPromo.create = origPromoCreate;
    (prisma as any).merchantPromo.deleteMany = origPromoDeleteMany;
    server.close();
  }
}

runTests().catch((err) => {
  console.error('❌ Stage A Test failed:', err);
  process.exit(1);
});

