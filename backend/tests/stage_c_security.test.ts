import assert from 'assert';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

function makeToken(id: string, username: string, role = 'user') {
  return jwt.sign({ id, username, role, token_type: 'access' }, JWT_SECRET, { expiresIn: '10m' });
}

async function runTests() {
  const mockUsers = new Map<string, { id: string; username: string; role: string }>([
    ['user-normal-1', { id: 'user-normal-1', username: 'budi', role: 'user' }],
    ['warung-100', { id: 'warung-100', username: 'warung', role: 'user' }],
    ['merchant-approved-1', { id: 'merchant-approved-1', username: 'kopijawa', role: 'merchant' }],
    ['merchant-other-2', { id: 'merchant-other-2', username: 'kopisunda', role: 'merchant' }],
    ['merchant-pending-3', { id: 'merchant-pending-3', username: 'kopipending', role: 'merchant' }],
    ['admin-1', { id: 'admin-1', username: 'adminops', role: 'admin' }],
    ['founder-0', { id: 'founder-0', username: 'ngopi', role: 'superadmin' }],
  ]);

  const mockProfiles = new Map<string, any>([
    [
      'm_kopi_jawa',
      {
        id: 'm_kopi_jawa',
        user_id: 'merchant-approved-1',
        cafe_name: 'Kopi Jawa',
        is_showcase: false,
        is_verified: true,
        review_status: 'approved',
        deleted_at: null,
      },
    ],
    [
      'm_kopi_sunda',
      {
        id: 'm_kopi_sunda',
        user_id: 'merchant-other-2',
        cafe_name: 'Kopi Sunda',
        is_showcase: false,
        is_verified: true,
        review_status: 'approved',
        deleted_at: null,
      },
    ],
    [
      'm_kopi_pending',
      {
        id: 'm_kopi_pending',
        user_id: 'merchant-pending-3',
        cafe_name: 'Kopi Pending',
        is_showcase: false,
        is_verified: false,
        review_status: 'pending',
        deleted_at: null,
      },
    ],
    [
      'm_warkop_sahabat',
      {
        id: 'm_warkop_sahabat',
        user_id: null,
        cafe_name: 'Warkop Seduh Sahabat',
        is_showcase: true,
        is_verified: true,
        review_status: 'approved',
        deleted_at: null,
      },
    ],
  ]);

  const origUser = (prisma as any).user;
  const origMerchantProfile = (prisma as any).merchantProfile;

  (prisma as any).user = {
    ...origUser,
    findUnique: async (args: any) => {
      const id = args?.where?.id;
      return id ? mockUsers.get(id) || null : null;
    },
  };

  (prisma as any).merchantProfile = {
    ...origMerchantProfile,
    findUnique: async (args: any) => {
      if (args?.where?.id) {
        return mockProfiles.get(args.where.id) || null;
      }
      if (args?.where?.user_id) {
        for (const p of mockProfiles.values()) {
          if (p.user_id === args.where.user_id) return p;
        }
      }
      return null;
    },
  };

  const { default: aiRoutes } = await import('../src/routes/ai.routes');
  const app = express();
  app.use(express.json());
  app.use('/api/ai', aiRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const userToken = makeToken('user-normal-1', 'budi', 'user');
    const staleWarungAdminToken = makeToken('warung-100', 'warung', 'admin'); // stale JWT claiming admin
    const merchant1Token = makeToken('merchant-approved-1', 'kopijawa', 'merchant');
    const merchantPendingToken = makeToken('merchant-pending-3', 'kopipending', 'merchant');
    const adminToken = makeToken('admin-1', 'adminops', 'admin');
    const superadminToken = makeToken('founder-0', 'ngopi', 'superadmin');

    // 1. /agent/toggle restricted to DB admin/superadmin only
    for (const [label, token, expected] of [
      ['regular user', userToken, 403],
      ['stale warung #100 JWT claiming admin', staleWarungAdminToken, 403],
      ['merchant', merchant1Token, 403],
      ['admin', adminToken, 200],
      ['superadmin Founder #0', superadminToken, 200],
    ] as const) {
      const res = await fetch(`${baseUrl}/api/ai/agent/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: true }),
      });
      assert.strictEqual(res.status, expected, `${label} on /agent/toggle must return ${expected}, got ${res.status}`);
    }
    console.log('✅ [PASS] 1. /api/ai/agent/toggle strictly requires DB admin/superadmin (user/merchant/stale-JWT = 403)');

    // 2. /agent/status rejects stale JWT role escalation
    const staleStatusRes = await fetch(`${baseUrl}/api/ai/agent/status`, {
      headers: { Authorization: `Bearer ${staleWarungAdminToken}` },
    });
    assert.strictEqual(staleStatusRes.status, 403, 'Stale JWT claiming admin for DB user must get 403 on /status');
    console.log('✅ [PASS] 2. /api/ai/agent/status enforces DB-backed role');

    // 3. Regular user cannot run merchant triggers even if role is omitted
    const userMerchantTrigRes = await fetch(`${baseUrl}/api/ai/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ trigger: 'low_traffic', cafeId: 'm_kopi_jawa' }),
    });
    assert.strictEqual(userMerchantTrigRes.status, 403);
    console.log('✅ [PASS] 3. Regular user blocked from merchant-only triggers even when role field omitted');

    // 4. Showcase cafe m_warkop_sahabat cannot be targeted in merchant mode (even by merchant or admin)
    for (const [label, token] of [
      ['merchant', merchant1Token],
      ['admin', adminToken],
    ] as const) {
      const execShowcase = await fetch(`${baseUrl}/api/ai/agent/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: 'merchant', trigger: 'low_traffic', cafeId: 'm_warkop_sahabat' }),
      });
      assert.strictEqual(execShowcase.status, 403, `${label} execute on showcase must return 403`);

      const chatShowcase = await fetch(`${baseUrl}/api/ai/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: 'merchant', message: 'Buat promo', cafeId: 'm_warkop_sahabat' }),
      });
      assert.strictEqual(chatShowcase.status, 403, `${label} chat on showcase must return 403`);
    }
    console.log('✅ [PASS] 4. Showcase cafe m_warkop_sahabat blocked from merchant AI execute & chat (403)');

    // 5. Cross-merchant IDOR blocked on both /execute and /chat
    const idorExec = await fetch(`${baseUrl}/api/ai/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchant1Token}` },
      body: JSON.stringify({ role: 'merchant', trigger: 'low_traffic', cafeId: 'm_kopi_sunda' }),
    });
    assert.strictEqual(idorExec.status, 403);

    const idorChat = await fetch(`${baseUrl}/api/ai/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchant1Token}` },
      body: JSON.stringify({ role: 'merchant', message: 'Cek analitik', cafeId: 'm_kopi_sunda' }),
    });
    assert.strictEqual(idorChat.status, 403);
    console.log('✅ [PASS] 5. Cross-merchant IDOR on /execute and /chat blocked with 403');

    // 6. Pending/unapproved merchant profile blocked from merchant AI execution
    const pendingExec = await fetch(`${baseUrl}/api/ai/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantPendingToken}` },
      body: JSON.stringify({ role: 'merchant', trigger: 'low_traffic' }),
    });
    assert.strictEqual(pendingExec.status, 403);
    console.log('✅ [PASS] 6. Unapproved/pending merchant profile blocked with 403');

    // 7. Approved merchant executes on own cafe (both explicit cafeId without role, and omitted cafeId resolved from DB)
    const dashboardStyleRes = await fetch(`${baseUrl}/api/ai/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchant1Token}` },
      body: JSON.stringify({ trigger: 'low_traffic', cafeId: 'm_kopi_jawa' }),
    });
    assert.strictEqual(dashboardStyleRes.status, 200);
    const dashboardJson: any = await dashboardStyleRes.json();
    assert.strictEqual(dashboardJson.success, true);
    assert.strictEqual(dashboardJson.role, 'merchant');
    assert.strictEqual(dashboardJson.steps?.[1]?.params?.cafe_id, 'm_kopi_jawa');

    const dbResolvedRes = await fetch(`${baseUrl}/api/ai/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchant1Token}` },
      body: JSON.stringify({ role: 'merchant', trigger: 'ambience_autopilot' }),
    });
    assert.strictEqual(dbResolvedRes.status, 200);
    const dbResolvedJson: any = await dbResolvedRes.json();
    assert.strictEqual(dbResolvedJson.success, true);
    assert.notStrictEqual(dbResolvedJson.steps?.[1]?.params?.cafe_id, 'm_warkop_sahabat');
    console.log('✅ [PASS] 7. Approved merchant resolves own cafe from DB without m_warkop_sahabat fallback');

    // 8. User concierge read-only mode succeeds without mutating showcase
    const conciergeRes = await fetch(`${baseUrl}/api/ai/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ role: 'user', trigger: 'user_concierge_cafe' }),
    });
    assert.strictEqual(conciergeRes.status, 200);
    const conciergeJson: any = await conciergeRes.json();
    assert.strictEqual(conciergeJson.success, true);
    assert.strictEqual(conciergeJson.createdArtifacts?.promo, undefined, 'User concierge must be read-only');
    console.log('✅ [PASS] 8. User concierge cafe lookup is read-only and returns 200');

    console.log('\n🎉 ALL 8 STAGE C AI AGENT SECURITY TESTS PASSED!');
  } finally {
    server.close();
    (prisma as any).user = origUser;
    (prisma as any).merchantProfile = origMerchantProfile;
  }
}

runTests().catch((err) => {
  console.error('❌ Stage C test failed:', err);
  process.exit(1);
});

