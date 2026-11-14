import assert from 'assert';
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/utils/prisma';
import { verifyMagicBytes, validateExtensionAndMime, resolveSafeChildPath } from '../src/utils/fileSecurity';

process.env.MAX_UPLOAD_BYTES = String(1024 * 100); // 100 KB for test (must be set before importing upload.routes)

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

function makeToken(id: string, username: string, role = 'user') {
  return jwt.sign({ id, username, role, token_type: 'access' }, JWT_SECRET, { expiresIn: '10m' });
}

// Minimal valid 1x1 PNG buffer (with PNG magic signature)
const VALID_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
  'hex'
);

async function runTests() {
  const mockUsers = new Map<string, { id: string; username: string; role: string }>([
    ['user-a-id', { id: 'user-a-id', username: 'usera', role: 'user' }],
    ['user-b-id', { id: 'user-b-id', username: 'userb', role: 'user' }],
    ['merchant-1-id', { id: 'merchant-1-id', username: 'warungcafe', role: 'merchant' }],
    ['admin-1-id', { id: 'admin-1-id', username: 'adminuser', role: 'admin' }],
  ]);

  const origUserFindUnique = (prisma as any).user?.findUnique;
  (prisma as any).user = {
    ...(prisma as any).user,
    findUnique: async (args: any) => {
      const id = args?.where?.id;
      return id ? mockUsers.get(id) || null : null;
    },
  };

  const { default: aiRoutes } = await import('../src/routes/ai.routes');
  const { default: uploadRoutes } = await import('../src/routes/upload.routes');

  const app = express();
  app.use(express.json());
  app.use('/api/ai', aiRoutes);
  app.use('/api/upload', uploadRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const createdFiles: string[] = [];

  try {
    const userAToken = makeToken('user-a-id', 'usera', 'user');
    const userBToken = makeToken('user-b-id', 'userb', 'user');
    const merchantToken = makeToken('merchant-1-id', 'warungcafe', 'merchant');
    const adminToken = makeToken('admin-1-id', 'adminuser', 'admin');

    // 1. Unauthenticated AI requests -> 401
    for (const [method, endpoint, body] of [
      ['POST', '/api/ai/agent/execute', { role: 'user', trigger: 'custom', customPrompt: 'hi' }],
      ['GET', '/api/ai/agent/status', null],
      ['POST', '/api/ai/agent/toggle', { enabled: true }],
      ['POST', '/api/ai/agent/chat', { message: 'halo' }],
    ] as const) {
      const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      assert.strictEqual(res.status, 401, `Expected 401 for unauthenticated ${method} ${endpoint}`);
    }
    console.log('✅ [PASS] 1. Unauthenticated /api/ai/agent/* requests rejected with 401');

    // 2. AI status RBAC (user -> 403, merchant -> 200) & authenticated /chat -> 200
    const statusUserRes = await fetch(`${baseUrl}/api/ai/agent/status`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(statusUserRes.status, 403, 'Regular user must get 403 on /api/ai/agent/status');

    const statusSpoofRes = await fetch(`${baseUrl}/api/ai/agent/status?role=merchant`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(statusSpoofRes.status, 403, 'Regular user cannot spoof merchant role on /status');

    const statusMerchantRes = await fetch(`${baseUrl}/api/ai/agent/status`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    assert.strictEqual(statusMerchantRes.status, 200, 'Authenticated merchant must get 200 on /api/ai/agent/status');

    const chatRes = await fetch(`${baseUrl}/api/ai/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ message: 'Rekomendasi kopi sore', role: 'user' }),
    });
    assert.strictEqual(chatRes.status, 200);
    console.log('✅ [PASS] 2. /api/ai/agent/status restricted to merchant (user=403, merchant=200) & /chat succeeds with 200');

    // 3. Cross-user access & privilege escalation -> 403
    const spoofRes = await fetch(`${baseUrl}/api/ai/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ role: 'user', userId: 'user-b-id', trigger: 'custom', customPrompt: 'spoof' }),
    });
    assert.strictEqual(spoofRes.status, 403, 'Cross-user userId spoofing must return 403');

    const escRes = await fetch(`${baseUrl}/api/ai/agent/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ role: 'merchant', trigger: 'low_traffic' }),
    });
    assert.strictEqual(escRes.status, 403, 'Regular user requesting merchant mode must return 403');

    const toggleUserRes = await fetch(`${baseUrl}/api/ai/agent/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userAToken}` },
      body: JSON.stringify({ enabled: true }),
    });
    assert.strictEqual(toggleUserRes.status, 403, 'Regular user toggling autonomous loop must return 403');

    const toggleMerchantRes = await fetch(`${baseUrl}/api/ai/agent/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${merchantToken}` },
      body: JSON.stringify({ enabled: false }),
    });
    assert.strictEqual(toggleMerchantRes.status, 403, 'Merchant toggling global autonomous loop must return 403 (admin/superadmin only)');

    const toggleAdminRes = await fetch(`${baseUrl}/api/ai/agent/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ enabled: false }),
    });
    assert.strictEqual(toggleAdminRes.status, 200, 'Admin toggling global autonomous loop must succeed');
    console.log('✅ [PASS] 3. Cross-user spoofing, role escalation & non-admin toggle blocked with 403; admin toggle allowed');

    // 4. Invalid upload types (.html, .svg, .exe, .php)
    for (const [fname, mime] of [
      ['xss.html', 'text/html'],
      ['vector.svg', 'image/svg+xml'],
      ['shell.php', 'application/x-php'],
      ['malware.exe', 'application/octet-stream'],
    ]) {
      assert.strictEqual(validateExtensionAndMime(fname, mime).valid, false, `${fname} must be rejected`);
      const form = new FormData();
      form.append('file', new Blob(['<html><script>alert(1)</script></html>'], { type: mime }), fname);
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: form,
      });
      assert.strictEqual(res.status, 400, `Upload of ${fname} must return 400`);
    }
    console.log('✅ [PASS] 4. Invalid/active upload types (.html, .svg, .php, .exe) rejected with 400');

    // 5. MIME/signature mismatch (HTML payload disguised as .png)
    assert.strictEqual(verifyMagicBytes(Buffer.from('<script>alert(1)</script>'), '.png').valid, false);
    {
      const form = new FormData();
      form.append('file', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'fake.png');
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: form,
      });
      assert.strictEqual(res.status, 400, 'Fake PNG with invalid magic bytes must return 400');
    }
    console.log('✅ [PASS] 5. MIME/magic-byte signature mismatch rejected with 400');

    // 6. Oversized file (> 100 KB limit)
    {
      const bigBuf = Buffer.concat([VALID_PNG, Buffer.alloc(120 * 1024, 0x41)]);
      const form = new FormData();
      form.append('file', new Blob([bigBuf], { type: 'image/png' }), 'big.png');
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: form,
      });
      assert.strictEqual(res.status, 400, 'Oversized upload must return 400');
    }
    console.log('✅ [PASS] 6. Oversized upload rejected with 400');

    // 7. Path traversal attempts
    assert.strictEqual(resolveSafeChildPath('/tmp/base', '../etc/passwd'), null);
    assert.strictEqual(resolveSafeChildPath('/tmp/base', 'sub/file.png'), null);
    const travRes = await fetch(`${baseUrl}/api/upload/private/user-a-id/..%2F..%2Fpackage.json`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.ok(travRes.status === 400 || travRes.status === 404, `Path traversal must be blocked, got ${travRes.status}`);
    console.log('✅ [PASS] 7. Path traversal attempts blocked');

    // 8 & 9. Legitimate public upload + private upload & cross-user private access check
    {
      const pubForm = new FormData();
      pubForm.append('file', new Blob([VALID_PNG], { type: 'image/png' }), 'avatar.png');
      const pubRes = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: pubForm,
      });
      assert.strictEqual(pubRes.status, 200);
      const pubJson: any = await pubRes.json();
      assert.ok(pubJson.url.includes('/uploads/'), 'Public upload should return /uploads/ URL');
      const pubFilename = pubJson.url.split('/uploads/')[1];
      if (pubFilename) createdFiles.push(path.join(__dirname, '../uploads', pubFilename));
    }

    let privatePathUrl = '';
    {
      const privForm = new FormData();
      privForm.append('file', new Blob([VALID_PNG], { type: 'image/png' }), 'receipt.png');
      const privRes = await fetch(`${baseUrl}/api/upload?scope=private`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: privForm,
      });
      assert.strictEqual(privRes.status, 200);
      const privJson: any = await privRes.json();
      assert.ok(privJson.url.includes('/api/upload/private/user-a-id/'), 'Private upload should return private URL');
      privatePathUrl = new URL(privJson.url).pathname;
      const privFilename = decodeURIComponent(privatePathUrl.split('/').pop() || '');
      if (privFilename) {
        createdFiles.push(path.join(__dirname, '../private_uploads/user-a-id', privFilename));
        createdFiles.push(path.join(__dirname, '../private_uploads/user-a-id', `${privFilename}.meta.json`));
      }
    }

    // Unauthenticated private file access -> 401
    const unauthPriv = await fetch(`${baseUrl}${privatePathUrl}`);
    assert.strictEqual(unauthPriv.status, 401);

    // Cross-user private file access (user B -> user A) -> 403
    const crossPriv = await fetch(`${baseUrl}${privatePathUrl}`, {
      headers: { Authorization: `Bearer ${userBToken}` },
    });
    assert.strictEqual(crossPriv.status, 403);

    // Owner access -> 200 + nosniff + attachment
    const ownerPriv = await fetch(`${baseUrl}${privatePathUrl}`, {
      headers: { Authorization: `Bearer ${userAToken}` },
    });
    assert.strictEqual(ownerPriv.status, 200);
    assert.strictEqual(ownerPriv.headers.get('x-content-type-options'), 'nosniff');
    assert.ok((ownerPriv.headers.get('content-disposition') || '').includes('attachment'));
    console.log('✅ [PASS] 8 & 9. Legitimate public/private uploads work and private cross-user access is blocked (401/403)');

    // 10. Mobile DocumentPicker compatibility (application/octet-stream)
    const VALID_PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'ascii');
    const VALID_ZIP_PK = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);

    for (const [fname, buf] of [
      ['contract.pdf', VALID_PDF],
      ['proposal.docx', VALID_ZIP_PK],
      ['archive.zip', VALID_ZIP_PK],
    ] as const) {
      const form = new FormData();
      form.append('file', new Blob([buf], { type: 'application/octet-stream' }), fname);
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: form,
      });
      assert.strictEqual(res.status, 200, `Valid ${fname} with application/octet-stream must return 200`);
      const json: any = await res.json();
      const uploadedName = json.url?.split('/uploads/')[1];
      if (uploadedName) createdFiles.push(path.join(__dirname, '../uploads', uploadedName));
    }

    // Reject fake PDF, PNG, HTML, and SVG sent as application/octet-stream
    for (const [fname, buf] of [
      ['fake.pdf', Buffer.from('<script>alert(1)</script>')],
      ['image.png', VALID_PNG],
      ['page.html', Buffer.from('<html><body>xss</body></html>')],
      ['icon.svg', Buffer.from('<svg onload="alert(1)"></svg>')],
    ] as const) {
      const form = new FormData();
      form.append('file', new Blob([buf], { type: 'application/octet-stream' }), fname);
      const res = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
        body: form,
      });
      assert.strictEqual(res.status, 400, `${fname} with application/octet-stream must be rejected with 400`);
    }
    console.log('✅ [PASS] 10. Mobile application/octet-stream allowed only for signature-verified documents/archives');

    console.log('\n🎉 ALL 10 WAVE 0A SECURITY REGRESSION TESTS PASSED!');
  } finally {
    for (const f of createdFiles) {
      try {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
    }
    server.close();
    if (origUserFindUnique) {
      (prisma as any).user.findUnique = origUserFindUnique;
    }
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

