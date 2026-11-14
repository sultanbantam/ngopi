import assert from 'assert';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import merchantRoutes from '../src/routes/merchant.routes';
import { prisma } from '../src/utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

function signToken(payload: Record<string, any>) {
  return jwt.sign({ token_type: 'access', ...payload }, JWT_SECRET, { expiresIn: '1h' });
}

async function runTests() {
  console.log('=== STAGE B1B MERCHANT WORKFLOW & APPROVAL TESTS ===');

  const mockUsers = new Map<string, any>([
    ['usr_founder_0', { id: 'usr_founder_0', bmc_id: 1, name: 'Founder #0', username: 'ngopi', email: 'warung@ngopi.top', role: 'superadmin' }],
    ['usr_admin_1', { id: 'usr_admin_1', bmc_id: 2, name: 'Admin Reviewer', username: 'admin1', email: 'admin@ngopi.top', role: 'admin' }],
    ['usr_warung_100', { id: 'usr_warung_100', bmc_id: 100, name: 'Warung #100', username: 'warung', email: 'warung100@ngopi.top', role: 'user' }],
    ['usr_applicant_1', { id: 'usr_applicant_1', bmc_id: 101, name: 'Applicant One', username: 'app1', email: 'app1@ngopi.top', role: 'user' }],
    ['usr_applicant_2', { id: 'usr_applicant_2', bmc_id: 102, name: 'Applicant Two', username: 'app2', email: 'app2@ngopi.top', role: 'user' }],
    ['usr_existing_merchant', { id: 'usr_existing_merchant', bmc_id: 103, name: 'Existing Merchant', username: 'merch1', email: 'merch1@ngopi.top', role: 'merchant' }],
    ['usr_rollback_1', { id: 'usr_rollback_1', bmc_id: 104, name: 'Rollback User', username: 'rb1', email: 'rb1@ngopi.top', role: 'user' }],
  ]);

  const showcaseProfile = {
    id: 'm_warkop_sahabat',
    user_id: null,
    cafe_name: 'Warkop Sahabat',
    business_category: 'Warkop',
    qr_code_token: 'NGOPI_WARKOP_SAHABAT_01',
    reward_points: 50,
    is_verified: true,
    review_status: 'approved',
    is_showcase: true,
    submitted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockProfiles = new Map<string, any>([[showcaseProfile.id, showcaseProfile]]);
  const mockAudits: any[] = [];
  let failNextAuditCreate = false;

  const origUser = (prisma as any).user;
  const origMp = (prisma as any).merchantProfile;
  const origAudit = (prisma as any).merchantReviewAudit;
  const origTx = (prisma as any).$transaction;
  const origCheckin = (prisma as any).merchantCheckin;
  const origPromo = (prisma as any).merchantPromo;

  const makeTxClient = (usersMap: Map<string, any>, profilesMap: Map<string, any>, auditsArr: any[]) => ({
    user: {
      findUnique: async ({ where }: any) => usersMap.get(where.id) || null,
      update: async ({ where, data }: any) => {
        const u = usersMap.get(where.id);
        if (!u) throw new Error('User not found');
        const updated = { ...u, ...data };
        usersMap.set(where.id, updated);
        return updated;
      },
    },
    merchantProfile: {
      findUnique: async ({ where }: any) => {
        if (where.id) return profilesMap.get(where.id) || null;
        if (where.user_id) {
          for (const p of profilesMap.values()) {
            if (p.user_id === where.user_id) return p;
          }
        }
        return null;
      },
      findMany: async ({ where }: any) => {
        const list = Array.from(profilesMap.values()).filter((p) => {
          if (where?.is_showcase !== undefined && p.is_showcase !== where.is_showcase) return false;
          if (where?.review_status !== undefined && p.review_status !== where.review_status) return false;
          return true;
        });
        return list.map((p) => ({
          ...p,
          user: p.user_id ? usersMap.get(p.user_id) || null : null,
          reviewAudits: auditsArr.filter((a) => a.merchant_id === p.id),
        }));
      },
      create: async ({ data }: any) => {
        const created = {
          id: `m_${data.user_id}`,
          ...data,
          created_at: new Date(),
          updated_at: new Date(),
        };
        profilesMap.set(created.id, created);
        return created;
      },
      update: async ({ where, data }: any) => {
        const existing = where.id
          ? profilesMap.get(where.id)
          : Array.from(profilesMap.values()).find((p) => p.user_id === where.user_id);
        if (!existing) throw new Error('Profile not found');
        const updated = { ...existing, ...data, updated_at: new Date() };
        profilesMap.set(updated.id, updated);
        return updated;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const [id, p] of profilesMap.entries()) {
          if (where.id && p.id !== where.id) continue;
          if (where.review_status && p.review_status !== where.review_status) continue;
          if (where.is_showcase !== undefined && p.is_showcase !== where.is_showcase) continue;
          profilesMap.set(id, { ...p, ...data, updated_at: new Date() });
          count++;
        }
        return { count };
      },
    },
    merchantReviewAudit: {
      create: async ({ data }: any) => {
        if (failNextAuditCreate) {
          failNextAuditCreate = false;
          throw new Error('Simulated audit DB failure');
        }
        const row = { id: `aud_${auditsArr.length + 1}`, ...data, created_at: new Date() };
        auditsArr.push(row);
        return row;
      },
      findMany: async ({ where }: any) => auditsArr.filter((a) => a.merchant_id === where.merchant_id),
    },
  });

  const rootClient = makeTxClient(mockUsers, mockProfiles, mockAudits);
  (prisma as any).user = rootClient.user;
  (prisma as any).merchantProfile = {
    ...rootClient.merchantProfile,
    findUnique: async ({ where, include }: any) => {
      const p = await rootClient.merchantProfile.findUnique({ where });
      if (!p) return null;
      if (!include) return p;
      return {
        ...p,
        user: p.user_id ? mockUsers.get(p.user_id) || null : null,
        reviewAudits: mockAudits.filter((a) => a.merchant_id === p.id),
      };
    },
  };
  (prisma as any).merchantReviewAudit = rootClient.merchantReviewAudit;
  (prisma as any).merchantCheckin = { findMany: async () => [] };
  (prisma as any).merchantPromo = { findMany: async () => [] };
  (prisma as any).$transaction = async (fn: any) => {
    // Snapshot for atomic rollback simulation
    const snapUsers = new Map(Array.from(mockUsers.entries()).map(([k, v]) => [k, { ...v }]));
    const snapProfiles = new Map(Array.from(mockProfiles.entries()).map(([k, v]) => [k, { ...v }]));
    const snapAudits = mockAudits.map((a) => ({ ...a }));
    const txClient = makeTxClient(snapUsers, snapProfiles, snapAudits);
    const result = await fn(txClient);
    // Commit snapshot back
    mockUsers.clear();
    snapUsers.forEach((v, k) => mockUsers.set(k, v));
    mockProfiles.clear();
    snapProfiles.forEach((v, k) => mockProfiles.set(k, v));
    mockAudits.length = 0;
    mockAudits.push(...snapAudits);
    return result;
  };

  const app = express();
  app.use(express.json());
  app.use('/api/merchant', merchantRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${port}`;

  const founderToken = signToken({ id: 'usr_founder_0', role: 'superadmin' });
  const adminToken = signToken({ id: 'usr_admin_1', role: 'admin' });
  const warung100Token = signToken({ id: 'usr_warung_100', role: 'user' });
  const applicant1Token = signToken({ id: 'usr_applicant_1', role: 'user' });
  const applicant2Token = signToken({ id: 'usr_applicant_2', role: 'user' });
  const merchantToken = signToken({ id: 'usr_existing_merchant', role: 'merchant' });

  try {
    // 1. User submits valid application -> pending, is_verified=false, role stays user, audit 'submitted'
    const r1 = await fetch(`${baseUrl}/api/merchant/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${applicant1Token}` },
      body: JSON.stringify({
        cafe_name: 'Kopi Senja Nusantara',
        business_category: 'Coffee Shop',
        address: 'Jl. Kopi No. 1',
        phone: '0811111111',
        supporting_docs: { nib: 'NIB-12345' },
      }),
    });
    assert.strictEqual(r1.status, 200);
    const b1 = await r1.json();
    assert.strictEqual(b1.status, 'pending');
    assert.strictEqual(b1.profile.is_verified, false);
    assert.strictEqual(b1.profile.business_category, 'Coffee Shop');
    assert.strictEqual(mockUsers.get('usr_applicant_1')?.role, 'user');
    assert.strictEqual(mockAudits.filter((a) => a.merchant_id === 'm_usr_applicant_1' && a.action === 'submitted').length, 1);
    console.log('✅ [PASS] 1. Valid application creates pending profile + submitted audit without promoting role');

    // 2. Duplicate active pending application rejected (409)
    const r2 = await fetch(`${baseUrl}/api/merchant/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${applicant1Token}` },
      body: JSON.stringify({ cafe_name: 'Kopi Senja Duplicate' }),
    });
    assert.strictEqual(r2.status, 409);
    const b2 = await r2.json();
    assert.strictEqual(b2.duplicatePending, true);
    console.log('✅ [PASS] 2. Duplicate active pending application rejected (409)');

    // 3. Missing cafe_name rejected (400)
    const r3 = await fetch(`${baseUrl}/api/merchant/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${applicant2Token}` },
      body: JSON.stringify({ cafe_name: '   ' }),
    });
    assert.strictEqual(r3.status, 400);
    console.log('✅ [PASS] 3. Missing/empty cafe_name rejected (400)');

    // 4. GET /api/merchant/application/status returns own status + audits
    const r4 = await fetch(`${baseUrl}/api/merchant/application/status`, {
      headers: { Authorization: `Bearer ${applicant1Token}` },
    });
    assert.strictEqual(r4.status, 200);
    const b4 = await r4.json();
    assert.strictEqual(b4.hasApplication, true);
    assert.strictEqual(b4.status, 'pending');
    assert.strictEqual(b4.audits.length, 1);
    console.log('✅ [PASS] 4. GET /api/merchant/application/status returns own status and audits');

    // 5. warung #100 remains role=user after submitting application and gets 403 on /dashboard
    const r5a = await fetch(`${baseUrl}/api/merchant/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${warung100Token}` },
      body: JSON.stringify({ cafe_name: 'Warung 100 Pending' }),
    });
    assert.strictEqual(r5a.status, 200);
    assert.strictEqual(mockUsers.get('usr_warung_100')?.role, 'user');
    const r5b = await fetch(`${baseUrl}/api/merchant/dashboard`, {
      headers: { Authorization: `Bearer ${warung100Token}` },
    });
    assert.strictEqual(r5b.status, 403);
    console.log('✅ [PASS] 5. warung #100 stays role=user and is blocked from /dashboard (403)');

    // 6-8. Non-admin / merchant / unauthenticated blocked from admin review routes
    assert.strictEqual((await fetch(`${baseUrl}/api/merchant/admin/applications`, { headers: { Authorization: `Bearer ${applicant1Token}` } })).status, 403);
    assert.strictEqual((await fetch(`${baseUrl}/api/merchant/admin/applications`, { headers: { Authorization: `Bearer ${merchantToken}` } })).status, 403);
    assert.strictEqual((await fetch(`${baseUrl}/api/merchant/admin/applications`)).status, 401);
    console.log('✅ [PASS] 6-8. User (403), merchant (403), and unauthenticated (401) blocked from admin queue');

    // 9. Admin lists pending applications (showcase excluded)
    const r9 = await fetch(`${baseUrl}/api/merchant/admin/applications?status=pending`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(r9.status, 200);
    const b9 = await r9.json();
    assert(b9.applications.some((a: any) => a.id === 'm_usr_applicant_1'));
    assert(!b9.applications.some((a: any) => a.id === 'm_warkop_sahabat'), 'Showcase must be excluded');
    console.log('✅ [PASS] 9. Admin lists pending applications with showcase excluded');

    // 10. Superadmin (Founder #0) views application detail
    const r10 = await fetch(`${baseUrl}/api/merchant/admin/applications/m_usr_applicant_1`, {
      headers: { Authorization: `Bearer ${founderToken}` },
    });
    assert.strictEqual(r10.status, 200);
    const b10 = await r10.json();
    assert.strictEqual(b10.application.id, 'm_usr_applicant_1');
    console.log('✅ [PASS] 10. Superadmin (Founder #0) views application detail');

    // 11-12. Self-approval & self-rejection blocked (403)
    const adminOwnReg = await fetch(`${baseUrl}/api/merchant/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ cafe_name: 'Admin Own Cafe' }),
    });
    assert.strictEqual(adminOwnReg.status, 200);
    const r11 = await fetch(`${baseUrl}/api/merchant/admin/applications/m_usr_admin_1/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(r11.status, 403);
    const r12 = await fetch(`${baseUrl}/api/merchant/admin/applications/m_usr_admin_1/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: 'Self reject test' }),
    });
    assert.strictEqual(r12.status, 403);
    console.log('✅ [PASS] 11-12. Self-approval and self-rejection blocked (403)');

    // 13. Showcase profile approval/rejection blocked (403)
    const r13a = await fetch(`${baseUrl}/api/merchant/admin/applications/m_warkop_sahabat/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${founderToken}` },
    });
    assert.strictEqual(r13a.status, 403);
    const r13b = await fetch(`${baseUrl}/api/merchant/admin/applications/m_warkop_sahabat/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${founderToken}` },
      body: JSON.stringify({ reason: 'Cannot reject showcase' }),
    });
    assert.strictEqual(r13b.status, 403);
    console.log('✅ [PASS] 13. Showcase profile cannot be approved or rejected (403)');

    // 14. Reject with empty reason -> 400
    const r14 = await fetch(`${baseUrl}/api/merchant/admin/applications/m_usr_applicant_1/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: '   ' }),
    });
    assert.strictEqual(r14.status, 400);
    console.log('✅ [PASS] 14. Rejection with empty reason rejected (400)');

    // 15. Admin rejects pending application with valid reason
    const r15 = await fetch(`${baseUrl}/api/merchant/admin/applications/m_usr_applicant_1/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ reason: 'Foto lokasi usaha belum jelas' }),
    });
    assert.strictEqual(r15.status, 200);
    const b15 = await r15.json();
    assert.strictEqual(b15.profile.review_status, 'rejected');
    assert.strictEqual(b15.profile.is_verified, false);
    assert.strictEqual(b15.profile.rejection_reason, 'Foto lokasi usaha belum jelas');
    assert.strictEqual(mockUsers.get('usr_applicant_1')?.role, 'user');
    assert.strictEqual(mockAudits.filter((a) => a.merchant_id === 'm_usr_applicant_1' && a.action === 'rejected').length, 1);
    console.log('✅ [PASS] 15. Admin rejection sets rejected status, preserves user role, writes audit');

    // 16. Reapplication after rejection -> pending, prior audit preserved, 'resubmitted' added
    const r16 = await fetch(`${baseUrl}/api/merchant/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${applicant1Token}` },
      body: JSON.stringify({
        cafe_name: 'Kopi Senja Nusantara V2',
        business_category: 'Specialty Coffee',
        supporting_docs: { nib: 'NIB-12345-UPDATED' },
      }),
    });
    assert.strictEqual(r16.status, 200);
    const b16 = await r16.json();
    assert.strictEqual(b16.status, 'pending');
    assert.strictEqual(b16.profile.rejection_reason, null);
    const app1Audits = mockAudits.filter((a) => a.merchant_id === 'm_usr_applicant_1');
    assert.strictEqual(app1Audits.length, 3, 'Must preserve submitted + rejected + resubmitted audits');
    assert.strictEqual(app1Audits[2].action, 'resubmitted');
    console.log('✅ [PASS] 16. Reapplication after rejection resets to pending and preserves audit history');

    // 17. Admin approves pending application -> approved, is_verified=true, role='merchant', audit 'approved'
    const r17 = await fetch(`${baseUrl}/api/merchant/admin/applications/m_usr_applicant_1/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(r17.status, 200);
    const b17 = await r17.json();
    assert.strictEqual(b17.profile.review_status, 'approved');
    assert.strictEqual(b17.profile.is_verified, true);
    assert.strictEqual(mockUsers.get('usr_applicant_1')?.role, 'merchant');
    assert.strictEqual(mockAudits.filter((a) => a.merchant_id === 'm_usr_applicant_1' && a.action === 'approved').length, 1);
    console.log('✅ [PASS] 17. Admin approval promotes user->merchant and writes approved audit');

    // 18. Newly approved merchant accesses /api/merchant/dashboard (200)
    const r18 = await fetch(`${baseUrl}/api/merchant/dashboard`, {
      headers: { Authorization: `Bearer ${applicant1Token}` },
    });
    assert.strictEqual(r18.status, 200);
    console.log('✅ [PASS] 18. Newly approved merchant accesses /api/merchant/dashboard (200)');

    // 19-20. Double approval and rejecting already-approved blocked (409)
    const r19 = await fetch(`${baseUrl}/api/merchant/admin/applications/m_usr_applicant_1/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${founderToken}` },
    });
    assert.strictEqual(r19.status, 409);
    const r20 = await fetch(`${baseUrl}/api/merchant/admin/applications/m_usr_applicant_1/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${founderToken}` },
      body: JSON.stringify({ reason: 'Too late' }),
    });
    assert.strictEqual(r20.status, 409);
    console.log('✅ [PASS] 19-20. Non-pending approve/reject blocked (409)');

    // 21. Superadmin approving an admin's own application must NOT downgrade admin role to merchant
    const r21 = await fetch(`${baseUrl}/api/merchant/admin/applications/m_usr_admin_1/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${founderToken}` },
    });
    assert.strictEqual(r21.status, 200);
    assert.strictEqual(mockUsers.get('usr_admin_1')?.role, 'admin', 'Admin role must not be downgraded to merchant');
    console.log('✅ [PASS] 21. Approving admin applicant preserves admin role');

    // 22. $transaction rollback verification
    const rbToken = signToken({ id: 'usr_rollback_1', role: 'user' });
    await fetch(`${baseUrl}/api/merchant/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${rbToken}` },
      body: JSON.stringify({ cafe_name: 'Rollback Cafe' }),
    });
    failNextAuditCreate = true;
    const r22 = await fetch(`${baseUrl}/api/merchant/admin/applications/m_usr_rollback_1/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(r22.status, 500);
    assert.strictEqual(mockProfiles.get('m_usr_rollback_1')?.review_status, 'pending', 'Profile status must roll back to pending');
    assert.strictEqual(mockProfiles.get('m_usr_rollback_1')?.is_verified, false, 'is_verified must roll back to false');
    assert.strictEqual(mockUsers.get('usr_rollback_1')?.role, 'user', 'User.role must roll back to user');
    console.log('✅ [PASS] 22. Atomic $transaction rollback verified on audit write failure');

    console.log('\n🎉 ALL 22 STAGE B1B WORKFLOW TESTS PASSED! 🎉\n');
  } finally {
    server.close();
    (prisma as any).user = origUser;
    (prisma as any).merchantProfile = origMp;
    (prisma as any).merchantReviewAudit = origAudit;
    (prisma as any).$transaction = origTx;
    (prisma as any).merchantCheckin = origCheckin;
    (prisma as any).merchantPromo = origPromo;
  }
}

runTests().catch((err) => {
  console.error('❌ Stage B1B test failed:', err);
  process.exit(1);
});
