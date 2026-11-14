import assert from 'assert';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import merchantRoutes from '../src/routes/merchant.routes';
import { MerchantService } from '../src/services/merchant.service';
import { prisma } from '../src/utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'stage_b2_local_jwt_secret_key_not_prod';

function signToken(payload: Record<string, any>) {
  return jwt.sign({ token_type: 'access', ...payload }, JWT_SECRET, { expiresIn: '1h' });
}

async function runTests() {
  console.log('=== STAGE B2B REAL POSTGRESQL INTEGRATION TESTS (E1-E7) ===');

  // Verify we are connected ONLY to isolated Stage B2 test DB
  const dbCheck: any[] = await prisma.$queryRawUnsafe(
    `SELECT current_database() AS db, inet_server_port() AS port`
  );
  assert.strictEqual(dbCheck[0]?.db, 'ngopi_merchant_stage_b2_test', 'Must run against ngopi_merchant_stage_b2_test ONLY');
  console.log(`Connected to isolated PostgreSQL DB: ${dbCheck[0].db} (port ${dbCheck[0].port})`);

  const prefix = `b2b_${Date.now()}`;
  const ids = {
    founder: `${prefix}_founder0`,
    admin1: `${prefix}_admin1`,
    admin2: `${prefix}_admin2`,
    warung100: `${prefix}_warung100`,
    user1: `${prefix}_user1`,
    user2: `${prefix}_user2`,
    race1: `${prefix}_race1`,
    race2: `${prefix}_race2`,
    deletedOwner: `${prefix}_delowner`,
  };
  const showcaseIds = ['m_warkop_sahabat', 'm_kenangan_senja', 'm_barista_corner'];
  const createdMerchantIds: string[] = [];

  const app = express();
  app.use(express.json());
  app.use('/api/merchant', merchantRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // Seed synthetic users
    await prisma.user.createMany({
      data: [
        { id: ids.founder, username: `${prefix}_ngopi`, password_hash: 'x', display_name: 'Founder #0 Synthetic', role: 'superadmin' },
        { id: ids.admin1, username: `${prefix}_adm1`, password_hash: 'x', display_name: 'Admin 1', role: 'admin' },
        { id: ids.admin2, username: `${prefix}_adm2`, password_hash: 'x', display_name: 'Admin 2', role: 'admin' },
        { id: ids.warung100, username: `${prefix}_warung`, password_hash: 'x', display_name: 'Warung #100 Synthetic', role: 'user' },
        { id: ids.user1, username: `${prefix}_u1`, password_hash: 'x', display_name: 'User 1', role: 'user' },
        { id: ids.user2, username: `${prefix}_u2`, password_hash: 'x', display_name: 'User 2', role: 'user' },
        { id: ids.race1, username: `${prefix}_r1`, password_hash: 'x', display_name: 'Race 1', role: 'user' },
        { id: ids.race2, username: `${prefix}_r2`, password_hash: 'x', display_name: 'Race 2', role: 'user' },
        { id: ids.deletedOwner, username: `${prefix}_do`, password_hash: 'x', display_name: 'Deleted Owner', role: 'merchant' },
      ],
    });

    // Seed 3 showcase profiles (nullable user_id, is_showcase = true)
    for (const scId of showcaseIds) {
      await prisma.merchantProfile.upsert({
        where: { id: scId },
        update: { user_id: null, is_showcase: true, is_verified: true, review_status: 'approved' },
        create: {
          id: scId,
          user_id: null,
          cafe_name: `Showcase ${scId}`,
          qr_code_token: `TOKEN_${scId}`,
          is_verified: true,
          review_status: 'approved',
          is_showcase: true,
        },
      });
    }

    // E1. Schema & persistence (JSONB, nullable user_id, enum defaults, relations)
    const appRes = await MerchantService.submitApplication(ids.user1, {
      cafe_name: 'B2B Kopi Nusantara',
      business_category: 'Coffee Shop',
      address: 'Jl. Postgres No. 16',
      phone: '08123456789',
      supporting_docs: { nib: 'NIB-PG-16', document_url: 'https://ngopi.top/docs/pg16.pdf' },
    });
    assert.strictEqual(appRes.success, true);
    assert.strictEqual(appRes.status, 'pending');
    createdMerchantIds.push(appRes.profile!.id);

    const persisted = await prisma.merchantProfile.findUnique({
      where: { id: appRes.profile!.id },
      include: { reviewAudits: true },
    });
    assert(persisted, 'Profile must persist in PostgreSQL');
    assert.strictEqual(persisted!.review_status, 'pending');
    assert.strictEqual(persisted!.is_verified, false);
    assert.strictEqual(persisted!.is_showcase, false);
    assert.strictEqual(persisted!.deleted_at, null);
    assert.deepStrictEqual(persisted!.supporting_docs, { nib: 'NIB-PG-16', document_url: 'https://ngopi.top/docs/pg16.pdf' });
    assert.strictEqual(persisted!.reviewAudits.length, 1);

    const scRow = await prisma.merchantProfile.findUnique({ where: { id: 'm_warkop_sahabat' } });
    assert.strictEqual(scRow?.user_id, null, 'Showcase user_id must be NULL in PostgreSQL');
    console.log('✅ [PASS] E1: Schema, JSONB supporting_docs, nullable user_id, enum defaults & relations');

    // E2. Referential integrity (ON DELETE RESTRICT on merchant_id and actor_id)
    let profileDeleteBlocked = false;
    try {
      await prisma.merchantProfile.delete({ where: { id: persisted!.id } });
    } catch (e: any) {
      profileDeleteBlocked = true;
    }
    assert.strictEqual(profileDeleteBlocked, true, 'PostgreSQL ON DELETE RESTRICT must block MerchantProfile deletion with audits');

    let actorDeleteBlocked = false;
    try {
      await prisma.user.delete({ where: { id: ids.user1 } });
    } catch (e: any) {
      actorDeleteBlocked = true;
    }
    assert.strictEqual(actorDeleteBlocked, true, 'PostgreSQL ON DELETE RESTRICT must block User deletion referenced by audit actor_id');
    console.log('✅ [PASS] E2: PostgreSQL ON DELETE RESTRICT enforced on merchant_id and actor_id');

    // E3. Application workflow (no auto-promote, duplicate pending 409, invalid docs 400, showcase blocked 403)
    const user1Row = await prisma.user.findUnique({ where: { id: ids.user1 } });
    assert.strictEqual(user1Row?.role, 'user', 'submitApplication must not promote User.role');

    const dupPending = await MerchantService.submitApplication(ids.user1, { cafe_name: 'Dup' });
    assert.strictEqual(dupPending.statusCode, 409);

    const badDoc = await MerchantService.submitApplication(ids.user2, {
      cafe_name: 'Bad Doc',
      supporting_docs: { document_url: 'javascript:alert(1)' },
    });
    assert.strictEqual(badDoc.statusCode, 400);
    console.log('✅ [PASS] E3: Application workflow, duplicate pending 409, and supporting_docs validation');

    // E4. Approval, rejection, reapplication, self-review, non-admin RBAC
    const admin1Token = signToken({ id: ids.admin1, role: 'admin' });
    const user2Token = signToken({ id: ids.user2, role: 'user' });
    const founderToken = signToken({ id: ids.founder, role: 'superadmin' });

    // Non-admin blocked from admin endpoints (403)
    const nonAdminRes = await fetch(`${baseUrl}/api/merchant/admin/applications`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    assert.strictEqual(nonAdminRes.status, 403);

    // Rejection requires reason (400)
    const emptyRej = await MerchantService.rejectApplication(persisted!.id, ids.admin1, '   ');
    assert.strictEqual(emptyRej.statusCode, 400);

    // Reject with reason
    const rejRes = await MerchantService.rejectApplication(persisted!.id, ids.admin1, 'Foto kurang jelas');
    assert.strictEqual(rejRes.statusCode, 200);
    assert.strictEqual((await prisma.user.findUnique({ where: { id: ids.user1 } }))?.role, 'user');

    // Reapply after rejection -> preserves prior audits + adds resubmitted
    const reapplyRes = await MerchantService.submitApplication(ids.user1, { cafe_name: 'B2B Kopi Nusantara V2' });
    assert.strictEqual(reapplyRes.statusCode, 200);
    const auditsAfterReapply = await prisma.merchantReviewAudit.findMany({ where: { merchant_id: persisted!.id } });
    assert.strictEqual(auditsAfterReapply.length, 3, 'Must preserve submitted + rejected + resubmitted audits');

    // Approve pending -> promotes user->merchant, sets reviewed_by/at
    const approveRes = await MerchantService.approveApplication(persisted!.id, ids.admin1);
    assert.strictEqual(approveRes.statusCode, 200);
    assert.strictEqual((await prisma.user.findUnique({ where: { id: ids.user1 } }))?.role, 'merchant');
    assert.strictEqual(approveRes.profile.is_verified, true);
    assert.strictEqual(approveRes.profile.reviewed_by, ids.admin1);

    // Duplicate approved application rejected (409)
    const dupApproved = await MerchantService.submitApplication(ids.user1, { cafe_name: 'Dup Approved' });
    assert.strictEqual(dupApproved.statusCode, 409);

    // Self-approval blocked (403) + admin/superadmin role preservation
    const founderApp = await MerchantService.submitApplication(ids.founder, { cafe_name: 'Founder Cafe' });
    createdMerchantIds.push(founderApp.profile!.id);
    const selfApprove = await MerchantService.approveApplication(founderApp.profile!.id, ids.founder);
    assert.strictEqual(selfApprove.statusCode, 403);
    const approveFounder = await MerchantService.approveApplication(founderApp.profile!.id, ids.admin1);
    assert.strictEqual(approveFounder.statusCode, 200);
    assert.strictEqual((await prisma.user.findUnique({ where: { id: ids.founder } }))?.role, 'superadmin', 'Founder #0 superadmin role must be preserved');
    console.log('✅ [PASS] E4: Approval, rejection, reapplication, self-review block, and superadmin preservation');

    // E5. Real PostgreSQL Concurrency Tests
    const r1App = await MerchantService.submitApplication(ids.race1, { cafe_name: 'Race PG 1' });
    createdMerchantIds.push(r1App.profile!.id);
    const [cApp1, cApp2] = await Promise.all([
      MerchantService.approveApplication(r1App.profile!.id, ids.admin1),
      MerchantService.approveApplication(r1App.profile!.id, ids.admin2),
    ]);
    assert.deepStrictEqual([cApp1.statusCode, cApp2.statusCode].sort(), [200, 409]);
    const r1Audits = await prisma.merchantReviewAudit.findMany({ where: { merchant_id: r1App.profile!.id, action: 'approved' } });
    assert.strictEqual(r1Audits.length, 1);

    const r2App = await MerchantService.submitApplication(ids.race2, { cafe_name: 'Race PG 2' });
    createdMerchantIds.push(r2App.profile!.id);
    const [cRaceApp, cRaceRej] = await Promise.all([
      MerchantService.approveApplication(r2App.profile!.id, ids.admin1),
      MerchantService.rejectApplication(r2App.profile!.id, ids.admin2, 'Concurrent reject'),
    ]);
    assert.deepStrictEqual([cRaceApp.statusCode, cRaceRej.statusCode].sort(), [200, 409]);
    const r2Decisions = await prisma.merchantReviewAudit.findMany({
      where: { merchant_id: r2App.profile!.id, action: { in: ['approved', 'rejected'] } },
    });
    assert.strictEqual(r2Decisions.length, 1);
    console.log('✅ [PASS] E5: Real PostgreSQL concurrent approve/approve and approve/reject atomic');

    // E6. Public access & identity isolation
    const pendingU2 = await MerchantService.submitApplication(ids.user2, {
      cafe_name: 'Pending Private',
      supporting_docs: { nib: 'PRIVATE-U2' },
    });
    createdMerchantIds.push(pendingU2.profile!.id);

    const delProf = await prisma.merchantProfile.create({
      data: {
        user_id: ids.deletedOwner,
        cafe_name: 'Deleted Cafe',
        qr_code_token: `NGOPI_DEL_${Date.now()}`,
        is_verified: true,
        review_status: 'approved',
        is_showcase: false,
        deleted_at: new Date(),
      },
    });
    createdMerchantIds.push(delProf.id);

    assert.strictEqual((await fetch(`${baseUrl}/api/merchant/cafe/${pendingU2.profile!.id}`)).status, 404);
    assert.strictEqual((await fetch(`${baseUrl}/api/merchant/cafe/${delProf.id}`)).status, 404);
    const pubOk = await fetch(`${baseUrl}/api/merchant/cafe/${persisted!.id}`);
    assert.strictEqual(pubOk.status, 200);
    const pubBody = await pubOk.json();
    assert.strictEqual(pubBody.cafe.user_id, undefined);
    assert.strictEqual(pubBody.cafe.supporting_docs, undefined);
    assert.strictEqual(pubBody.cafe.reviewed_by, undefined);
    assert.strictEqual(pubBody.cafe.review_status, undefined);

    // Cross-user dashboard spoofing blocked (403)
    const user1Token = signToken({ id: ids.user1, role: 'merchant' });
    const spoofDash = await fetch(`${baseUrl}/api/merchant/dashboard?merchant_id=${founderApp.profile!.id}`, {
      headers: { Authorization: `Bearer ${user1Token}`, 'x-user-id': ids.founder },
    });
    assert.strictEqual(spoofDash.status, 403);
    console.log('✅ [PASS] E6: Public filtering, DTO allowlist, and identity spoofing protection');

    // E7. Synthetic Identity Invariants (warung #100 + 3 showcase profiles)
    const w100App = await MerchantService.submitApplication(ids.warung100, { cafe_name: 'Warung 100 App' });
    createdMerchantIds.push(w100App.profile!.id);
    assert.strictEqual((await prisma.user.findUnique({ where: { id: ids.warung100 } }))?.role, 'user');

    for (const scId of showcaseIds) {
      const scApprove = await fetch(`${baseUrl}/api/merchant/admin/applications/${scId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${founderToken}` },
      });
      assert.strictEqual(scApprove.status, 403);
      const scPub = await fetch(`${baseUrl}/api/merchant/cafe/${scId}`);
      assert.strictEqual(scPub.status, 200);
    }
    console.log('✅ [PASS] E7: Synthetic Founder #0, warung #100, and 3 showcase invariants verified in PostgreSQL');

    console.log('\n🎉 ALL STAGE B2B REAL POSTGRESQL INTEGRATION TESTS (E1-E7) PASSED! 🎉\n');
  } finally {
    server.close();
    // Clean up only synthetic test fixtures in FK-safe order
    if (createdMerchantIds.length > 0) {
      await prisma.merchantReviewAudit.deleteMany({ where: { merchant_id: { in: createdMerchantIds } } }).catch(() => {});
      await prisma.merchantProfile.deleteMany({ where: { id: { in: createdMerchantIds } } }).catch(() => {});
    }
    await prisma.merchantProfile.deleteMany({ where: { id: { in: showcaseIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } }).catch(() => {});
    await prisma.$disconnect().catch(() => {});
  }
}

runTests().catch((err) => {
  console.error('❌ Stage B2B PostgreSQL integration test failed:', err);
  process.exit(1);
});

