import assert from 'assert';
import fs from 'fs';
import path from 'path';
import express from 'express';
import http from 'http';
import jwt from 'jsonwebtoken';
import merchantRoutes from '../src/routes/merchant.routes';
import partnershipRoutes from '../src/routes/partnership.routes';
import { MerchantService } from '../src/services/merchant.service';
import { PartnershipService } from '../src/services/partnership.service';
import { prisma } from '../src/utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

function signToken(payload: Record<string, any>) {
  return jwt.sign({ token_type: 'access', ...payload }, JWT_SECRET, { expiresIn: '1h' });
}

async function runTests() {
  console.log('=== STAGE B1D CRITICAL SECURITY & DATA INTEGRITY REMEDIATION TESTS ===');

  const mockUsers = new Map<string, any>([
    ['usr_admin_1', { id: 'usr_admin_1', bmc_id: 2, name: 'Admin 1', username: 'admin1', email: 'admin1@ngopi.top', role: 'admin' }],
    ['usr_admin_2', { id: 'usr_admin_2', bmc_id: 3, name: 'Admin 2', username: 'admin2', email: 'admin2@ngopi.top', role: 'superadmin' }],
    ['usr_pending_pub', { id: 'usr_pending_pub', bmc_id: 301, name: 'Pending Owner', username: 'pendpub', email: 'pend@ngopi.top', role: 'user' }],
    ['usr_rejected_pub', { id: 'usr_rejected_pub', bmc_id: 302, name: 'Rejected Owner', username: 'rejpub', email: 'rej@ngopi.top', role: 'user' }],
    ['usr_approved_pub', { id: 'usr_approved_pub', bmc_id: 303, name: 'Approved Owner', username: 'apppub', email: 'app@ngopi.top', role: 'merchant' }],
    ['usr_race_1', { id: 'usr_race_1', bmc_id: 304, name: 'Race User 1', username: 'race1', email: 'race1@ngopi.top', role: 'user' }],
    ['usr_race_2', { id: 'usr_race_2', bmc_id: 305, name: 'Race User 2', username: 'race2', email: 'race2@ngopi.top', role: 'user' }],
    ['usr_partner_fail', { id: 'usr_partner_fail', bmc_id: 306, name: 'Partner Fail', username: 'pfail', email: 'pfail@ngopi.top', role: 'user' }],
    ['usr_partner_ok', { id: 'usr_partner_ok', bmc_id: 307, name: 'Partner Ok', username: 'pok', email: 'pok@ngopi.top', role: 'user' }],
  ]);

  const mockProfiles = new Map<string, any>([
    [
      'm_pending_pub',
      {
        id: 'm_pending_pub',
        user_id: 'usr_pending_pub',
        cafe_name: 'Secret Pending Cafe',
        qr_code_token: 'NGOPI_SECRET_PENDING',
        is_verified: false,
        review_status: 'pending',
        is_showcase: false,
        supporting_docs: { nib: 'SECRET-NIB-999', document_url: 'https://example.com/private.pdf' },
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
        deleted_at: null,
        reward_points: 50,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
    [
      'm_rejected_pub',
      {
        id: 'm_rejected_pub',
        user_id: 'usr_rejected_pub',
        cafe_name: 'Rejected Secret Cafe',
        qr_code_token: 'NGOPI_SECRET_REJECTED',
        is_verified: false,
        review_status: 'rejected',
        is_showcase: false,
        supporting_docs: { reference_note: 'Private rejected doc' },
        reviewed_by: 'usr_admin_1',
        reviewed_at: new Date(),
        rejection_reason: 'Dokumen palsu',
        deleted_at: null,
        reward_points: 50,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
    [
      'm_approved_pub',
      {
        id: 'm_approved_pub',
        user_id: 'usr_approved_pub',
        cafe_name: 'Public Approved Cafe',
        business_category: 'Roastery',
        qr_code_token: 'NGOPI_PUBLIC_APPROVED',
        is_verified: true,
        review_status: 'approved',
        is_showcase: false,
        supporting_docs: { nib: 'PRIVATE-NIB-APPROVED' },
        reviewed_by: 'usr_admin_1',
        reviewed_at: new Date(),
        rejection_reason: null,
        deleted_at: null,
        reward_points: 50,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
  ]);

  const mockAudits: any[] = [];
  const mockAgreements = new Map<string, any>([
    [
      'usr_partner_fail',
      {
        id: 'agr_fail',
        user_id: 'usr_partner_fail',
        username: 'pfail',
        cafe_name: '   ', // invalid empty cafe_name triggers submitApplication failure
        address: 'Jl. Gagal',
        phone: '08111',
        commercial_model: 'model_a',
        agreement_text: 'MoU',
        is_agreed: false,
        signed_at: null,
        created_at: new Date(),
      },
    ],
    [
      'usr_partner_ok',
      {
        id: 'agr_ok',
        user_id: 'usr_partner_ok',
        username: 'pok',
        cafe_name: 'Warung Sukses B1D',
        address: 'Jl. Sukses No. 1',
        phone: '08222',
        commercial_model: 'model_a',
        agreement_text: 'MoU',
        is_agreed: false,
        signed_at: null,
        created_at: new Date(),
      },
    ],
  ]);

  const origUser = (prisma as any).user;
  const origMp = (prisma as any).merchantProfile;
  const origAudit = (prisma as any).merchantReviewAudit;
  const origAgr = (prisma as any).merchantAgreement;
  const origTx = (prisma as any).$transaction;
  const origGroup = (prisma as any).group;
  const origMsg = (prisma as any).message;

  // Simulate atomic concurrency lock on updateMany while allowing concurrent transactions to race on initial findUnique
  const makeClient = (usersMap: Map<string, any>, profilesMap: Map<string, any>, auditsArr: any[]) => ({
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
      findUnique: async ({ where, include }: any) => {
        if (include && 'review_audits' in include) {
          throw new Error('PrismaClientValidationError: Unknown field review_audits');
        }
        let found: any = null;
        if (where.id) found = profilesMap.get(where.id) || null;
        else if (where.user_id) {
          for (const p of profilesMap.values()) {
            if (p.user_id === where.user_id) {
              found = p;
              break;
            }
          }
        }
        if (!found) return null;
        if (!include) return { ...found };
        return {
          ...found,
          user: found.user_id ? usersMap.get(found.user_id) || null : null,
          reviewAudits: include.reviewAudits ? auditsArr.filter((a) => a.merchant_id === found.id) : undefined,
        };
      },
      findFirst: async ({ where }: any) => {
        const ors = where?.OR || [];
        for (const p of profilesMap.values()) {
          for (const cond of ors) {
            if ((cond.qr_code_token && p.qr_code_token === cond.qr_code_token) || (cond.id && p.id === cond.id)) {
              return { ...p, promos: [] };
            }
          }
        }
        return null;
      },
      findMany: async ({ where, include }: any) => {
        if (include && 'review_audits' in include) {
          throw new Error('PrismaClientValidationError: Unknown field review_audits');
        }
        const list = Array.from(profilesMap.values()).filter((p) => {
          if (where?.is_showcase !== undefined && p.is_showcase !== where.is_showcase) return false;
          if (where?.review_status !== undefined && p.review_status !== where.review_status) return false;
          return true;
        });
        return list.map((p) => ({
          ...p,
          user: p.user_id ? usersMap.get(p.user_id) || null : null,
          reviewAudits: include?.reviewAudits ? auditsArr.filter((a) => a.merchant_id === p.id) : undefined,
        }));
      },
      create: async ({ data }: any) => {
        if (data.supporting_docs !== null && data.supporting_docs !== undefined && typeof data.supporting_docs !== 'object') {
          throw new Error('supporting_docs must be Json object or null');
        }
        const created = { id: `m_${data.user_id}`, ...data, created_at: new Date(), updated_at: new Date() };
        profilesMap.set(created.id, created);
        return created;
      },
      updateMany: async ({ where, data }: any) => {
        // Atomic check against live shared mockProfiles to simulate DB row lock on updateMany!
        const live = mockProfiles.get(where.id);
        if (!live) return { count: 0 };
        if (where.review_status && live.review_status !== where.review_status) return { count: 0 };
        if (where.is_showcase !== undefined && live.is_showcase !== where.is_showcase) return { count: 0 };
        const updated = { ...live, ...data, updated_at: new Date() };
        mockProfiles.set(where.id, updated);
        profilesMap.set(where.id, updated);
        return { count: 1 };
      },
      update: async ({ where, data }: any) => {
        const existing = where.id ? profilesMap.get(where.id) : null;
        if (!existing) throw new Error('Profile not found');
        const updated = { ...existing, ...data, updated_at: new Date() };
        profilesMap.set(updated.id, updated);
        return updated;
      },
    },
    merchantReviewAudit: {
      create: async ({ data }: any) => {
        const row = { id: `aud_${auditsArr.length + 1}`, ...data, created_at: new Date() };
        auditsArr.push(row);
        return row;
      },
      findMany: async ({ where }: any) => auditsArr.filter((a) => a.merchant_id === where.merchant_id),
    },
  });

  const root = makeClient(mockUsers, mockProfiles, mockAudits);
  (prisma as any).user = root.user;
  (prisma as any).merchantProfile = root.merchantProfile;
  (prisma as any).merchantReviewAudit = root.merchantReviewAudit;
  (prisma as any).merchantAgreement = {
    findUnique: async ({ where }: any) => mockAgreements.get(where.user_id) || null,
    update: async ({ where, data }: any) => {
      const existing = mockAgreements.get(where.user_id);
      const updated = { ...existing, ...data };
      mockAgreements.set(where.user_id, updated);
      return updated;
    },
  };
  (prisma as any).group = { create: async () => ({ id: 'grp_b1d' }) };
  (prisma as any).message = { create: async () => ({ id: 'msg_b1d' }) };
  (prisma as any).$transaction = async (fn: any) => fn(root);

  const app = express();
  app.use(express.json());
  app.use('/api/merchant', merchantRoutes);
  app.use('/api/partnership', partnershipRoutes);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${port}`;

  const admin1Token = signToken({ id: 'usr_admin_1', role: 'admin' });
  const race1Token = signToken({ id: 'usr_race_1', role: 'user' });
  const race2Token = signToken({ id: 'usr_race_2', role: 'user' });

  try {
    // B1D-1: Prisma relation name reviewAudits works without review_audits error
    const listRes = await fetch(`${baseUrl}/api/merchant/admin/applications`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert.strictEqual(listRes.status, 200);
    const listBody = await listRes.json();
    assert(Array.isArray(listBody.applications));
    const detailRes = await fetch(`${baseUrl}/api/merchant/admin/applications/m_pending_pub`, {
      headers: { Authorization: `Bearer ${admin1Token}` },
    });
    assert.strictEqual(detailRes.status, 200);
    const detailBody = await detailRes.json();
    assert(Array.isArray(detailBody.application.reviewAudits));
    console.log('✅ [PASS] B1D-1: Admin list/detail use Prisma reviewAudits relation');

    // B1D-2: supporting_docs validation (rejects XSS/unsafe URLs/unknown keys; accepts valid metadata/string)
    const badDoc1 = await fetch(`${baseUrl}/api/merchant/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${race1Token}` },
      body: JSON.stringify({
        cafe_name: 'Bad Doc Cafe',
        supporting_docs: { document_url: 'javascript:alert(1)' },
      }),
    });
    assert.strictEqual(badDoc1.status, 400);
    const badDoc2 = await fetch(`${baseUrl}/api/merchant/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${race1Token}` },
      body: JSON.stringify({
        cafe_name: 'Bad Key Cafe',
        supporting_docs: { executable_payload: 'rm -rf' },
      }),
    });
    assert.strictEqual(badDoc2.status, 400);
    const goodDoc = await fetch(`${baseUrl}/api/merchant/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${race1Token}` },
      body: JSON.stringify({
        cafe_name: 'Race Cafe 1',
        supporting_docs: { nib: 'NIB-001', document_url: 'https://ngopi.top/docs/1.pdf' },
      }),
    });
    assert.strictEqual(goodDoc.status, 200);
    console.log('✅ [PASS] B1D-2: supporting_docs validates safe JSON metadata and rejects unsafe input');

    // B1D-3: Public endpoints never expose pending/rejected profiles or private fields
    const pubPending = await fetch(`${baseUrl}/api/merchant/cafe/NGOPI_SECRET_PENDING`);
    assert.strictEqual(pubPending.status, 404, 'Pending profile must not be exposed publicly');
    const pubRejected = await fetch(`${baseUrl}/api/merchant/cafe/m_rejected_pub`);
    assert.strictEqual(pubRejected.status, 404, 'Rejected profile must not be exposed publicly');
    const pubApproved = await fetch(`${baseUrl}/api/merchant/cafe/NGOPI_PUBLIC_APPROVED`);
    assert.strictEqual(pubApproved.status, 200);
    const pubApprovedBody = await pubApproved.json();
    assert.strictEqual(pubApprovedBody.cafe.user_id, undefined);
    assert.strictEqual(pubApprovedBody.cafe.supporting_docs, undefined);
    assert.strictEqual(pubApprovedBody.cafe.reviewed_by, undefined);
    assert.strictEqual(pubApprovedBody.cafe.reviewed_at, undefined);
    assert.strictEqual(pubApprovedBody.cafe.rejection_reason, undefined);
    assert.strictEqual(pubApprovedBody.cafe.review_status, undefined);
    console.log('✅ [PASS] B1D-3: Public cafe endpoint blocks pending/rejected and strips private fields via DTO');

    // B1D-4: Schema & migration SQL enforce ON DELETE RESTRICT and deleted_at
    const schemaTxt = fs.readFileSync(path.join(__dirname, '../prisma/schema.prisma'), 'utf-8');
    const migTxt = fs.readFileSync(
      path.join(__dirname, '../prisma/migrations/20261113234500_merchant_lifecycle_audit/migration.sql'),
      'utf-8'
    );
    assert(schemaTxt.includes('deleted_at        DateTime?'), 'Schema must include deleted_at soft-delete column');
    assert(schemaTxt.includes('onDelete: Restrict'), 'Schema must enforce onDelete: Restrict on MerchantReviewAudit.merchant');
    assert(migTxt.includes('ON DELETE RESTRICT ON UPDATE CASCADE'), 'Migration SQL must use ON DELETE RESTRICT');
    assert(migTxt.includes('"supporting_docs" JSONB'), 'Migration SQL must use JSONB for supporting_docs');
    console.log('✅ [PASS] B1D-4: Audit trail retention (ON DELETE RESTRICT + deleted_at + JSONB) verified');

    // B1D-5a: Two simultaneous approveApplication calls -> 1 wins (200), 1 conflicts (409), 1 audit
    const [resA, resB] = await Promise.all([
      MerchantService.approveApplication('m_usr_race_1', 'usr_admin_1'),
      MerchantService.approveApplication('m_usr_race_1', 'usr_admin_2'),
    ]);
    const statuses1 = [resA.statusCode, resB.statusCode].sort();
    assert.deepStrictEqual(statuses1, [200, 409], 'Concurrent approvals must yield exactly one 200 and one 409');
    assert.strictEqual(
      mockAudits.filter((a) => a.merchant_id === 'm_usr_race_1' && a.action === 'approved').length,
      1,
      'Exactly one approved audit record must be created'
    );
    assert.strictEqual(mockUsers.get('usr_race_1')?.role, 'merchant');

    // B1D-5b: approveApplication racing against rejectApplication -> 1 wins (200), 1 conflicts (409), 1 decision audit
    await MerchantService.submitApplication('usr_race_2', { cafe_name: 'Race Cafe 2' });
    const [raceApp, raceRej] = await Promise.all([
      MerchantService.approveApplication('m_usr_race_2', 'usr_admin_1'),
      MerchantService.rejectApplication('m_usr_race_2', 'usr_admin_2', 'Race rejection reason'),
    ]);
    const statuses2 = [raceApp.statusCode, raceRej.statusCode].sort();
    assert.deepStrictEqual(statuses2, [200, 409], 'Approve vs reject race must yield one 200 and one 409');
    const decisionAudits = mockAudits.filter(
      (a) => a.merchant_id === 'm_usr_race_2' && (a.action === 'approved' || a.action === 'rejected')
    );
    assert.strictEqual(decisionAudits.length, 1, 'Exactly one decision audit must exist');
    const expectedRole = raceApp.statusCode === 200 ? 'merchant' : 'user';
    assert.strictEqual(mockUsers.get('usr_race_2')?.role, expectedRole, 'User.role must match winning decision');
    console.log('✅ [PASS] B1D-5: Concurrent approve/approve and approve/reject races are atomic and conflict-safe');

    // B1D-6: PartnershipService.verifyAndSignAgreement propagates submitApplication failure and succeeds cleanly on valid app
    const failSign = await PartnershipService.verifyAndSignAgreement('usr_partner_fail');
    assert.strictEqual(failSign.success, false, 'Failed submitApplication must fail verifyAndSignAgreement');
    assert.strictEqual(mockAgreements.get('usr_partner_fail')?.is_agreed, false, 'Agreement must remain unsigned on failure');
    assert.strictEqual(mockUsers.get('usr_partner_fail')?.role, 'user');

    const failSignHttp = await fetch(`${baseUrl}/api/partnership/verify-sign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken({ id: 'usr_partner_fail', role: 'user' })}` },
    });
    assert.strictEqual(failSignHttp.status, 400, 'PartnershipController.verifySign must return HTTP 400 on failure');

    const okSign = await PartnershipService.verifyAndSignAgreement('usr_partner_ok');
    assert.strictEqual(okSign.success, true, 'Valid verifyAndSignAgreement must succeed');
    assert.strictEqual(mockAgreements.get('usr_partner_ok')?.is_agreed, true);
    assert.strictEqual(mockUsers.get('usr_partner_ok')?.role, 'user', 'Signing agreement must never promote User.role');
    console.log('✅ [PASS] B1D-6: Partnership error propagation & non-promotion verified');

    console.log('\n🎉 ALL STAGE B1D REMEDIATION TESTS PASSED! 🎉\n');
  } finally {
    server.close();
    (prisma as any).user = origUser;
    (prisma as any).merchantProfile = origMp;
    (prisma as any).merchantReviewAudit = origAudit;
    (prisma as any).merchantAgreement = origAgr;
    (prisma as any).$transaction = origTx;
    (prisma as any).group = origGroup;
    (prisma as any).message = origMsg;
  }
}

runTests().catch((err) => {
  console.error('❌ Stage B1D test failed:', err);
  process.exit(1);
});
