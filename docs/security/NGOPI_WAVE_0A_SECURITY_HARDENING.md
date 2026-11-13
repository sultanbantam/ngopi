# NGOPI — Wave 0A: Security Hardening Report

- **Document ID:** `NGOPI-SEC-WAVE0A-2026-11-13`
- **Baseline Production:** `v1.1.0-mail-read-unread` (Commit `5b0f281`, **local milestone tag only**)
- **Implementation State:** **Implemented & Tested Locally Only** (**NOT** committed, pushed, or deployed to production)

---

## 1. Confirmed Vulnerabilities Remediated Locally

1. **Unauthenticated & Unprotected `/api/ai/agent/*` Endpoints (`ai.routes.ts`, `agent.controller.ts`):**
   - `POST /execute`, `GET /status`, `POST /toggle`, and `POST /chat` lacked `verifyJWT` and `aiLimiter`.
   - `AgentController.execute` trusted `req.body.userId` before `req.user.id` (cross-user IDOR / identity spoofing) and allowed any caller to set `role: 'merchant'` or target arbitrary `cafeId` without RBAC verification.
   - `POST /api/ai/agent/toggle` allowed unauthenticated callers to toggle the platform autonomous loop.
2. **Stored XSS & Permissive File Upload Validation (`upload.routes.ts`, `upload.controller.ts`, `index.ts`):**
   - `ALLOWED_MIME_TYPES` and `ALLOWED_EXTENSIONS` previously permitted `text/html` and `image/svg+xml` while serving `/uploads/*` publicly without `X-Content-Type-Options: nosniff` or `Content-Disposition: attachment` for non-media documents.
   - `fileFilter` used logical `OR` (`ALLOWED_MIME_TYPES || ALLOWED_EXTENSIONS`) and did not inspect file **magic bytes** (allowing HTML/script payloads disguised as `.png`).
   - `upload.routes.ts` used `req.file.fieldname` in disk filenames and had no private file isolation scope.

---

## 2. Changes Made (Local Workspace Only)

### AI Endpoint Security
- **`backend/src/routes/ai.routes.ts`:**
  - Enforced `verifyJWT` and `aiLimiter` on all 4 `/api/ai/agent/*` routes (`/execute`, `/status`, `/toggle`, `/chat`).
  - Enforced `requireMerchant` (`merchant | admin | superadmin`) on `POST /api/ai/agent/toggle`.
- **`backend/src/controllers/agent.controller.ts`:**
  - Bound execution strictly to authenticated `req.user.id`; rejected cross-user `req.body.userId` spoofing with `403 Forbidden`.
  - Enforced RBAC check when `role === 'merchant'` is requested (`403 Forbidden` for regular users) and verified `MerchantProfile` ownership on non-default `cafeId`.
  - Validated `trigger` allowlist, `enabled` boolean type, and `MAX_PROMPT_LENGTH = 2000`; sanitized error logs to avoid logging prompts/tokens.

### File Upload Security
- **`backend/src/utils/fileSecurity.ts` (New):**
  - Strict `EXTENSION_TO_MIMES` map requiring **both** extension and MIME type to match (`validateExtensionAndMime`).
  - Expanded `DANGEROUS_EXTENSIONS` to block `.html`, `.htm`, `.xhtml`, `.svg`, `.svgz`, `.js`, `.mjs`, `.cjs`, `.ts`, `.jsx`, `.tsx`, `.xml`, `.php`, `.sh`, `.exe`, etc.
  - Added `verifyMagicBytes` / `verifyUploadedFileSignature` for JPEG, PNG, GIF, WebP, BMP, PDF, ZIP/Office OOXML, legacy Office OLE, MP4/MOV/M4A/HEIC, WebM/MKV, WAV/AVI, OGG, FLAC, MP3, RAR, 7z, GZ, and plain-text null-byte/HTML checks.
  - Added `generateSafeFilename` (`Date.now() + crypto.randomUUID() + ext`) and `resolveSafeChildPath` against path traversal.
- **`backend/src/routes/upload.routes.ts` & `backend/src/controllers/upload.controller.ts`:**
  - Replaced legacy `fileFilter` and filename generator with `fileSecurity.ts` helpers.
  - Added post-upload magic-byte verification (auto-deletes invalid temp file and returns `400`).
  - Added optional `?scope=private` / `x-upload-scope: private` storing files in `backend/private_uploads/<userId>/` with `.meta.json` ownership and authenticated download route `GET /api/upload/private/:ownerId/:filename` (`verifyJWT` + owner/admin check + `nosniff` + `Content-Disposition: attachment`).
- **`backend/src/index.ts`:**
  - Added `X-Content-Type-Options: nosniff` on `/uploads` static serving and `Content-Disposition: attachment` for non-inline-media documents.

---

## 3. Files Modified & Created

| File | Action | Purpose |
| :--- | :---: | :--- |
| `backend/src/utils/fileSecurity.ts` | Created | Extension/MIME pairing, magic-byte signatures, UUID filenames, path traversal guard |
| `backend/src/routes/ai.routes.ts` | Modified | `verifyJWT`, `aiLimiter`, and `requireMerchant` on `/api/ai/agent/*` |
| `backend/src/controllers/agent.controller.ts` | Modified | Anti-IDOR `userId` check, merchant role/cafe check, input validation, safe logging |
| `backend/src/routes/upload.routes.ts` | Modified | Strict upload filter, UUID filenames, private upload scope & download route |
| `backend/src/controllers/upload.controller.ts` | Modified | Magic-byte check after upload, private metadata sidecar & `downloadPrivateFile` |
| `backend/src/index.ts` | Modified | `X-Content-Type-Options: nosniff` & `Content-Disposition: attachment` on `/uploads` |
| `backend/tests/wave0a_security.test.ts` | Created | 9 automated security regression test cases |

---

## 4. Test Results (Local Verification)

1. **Wave 0A Security Regression (`npx --prefix backend tsx backend/tests/wave0a_security.test.ts`):** **9/9 PASS**
   - Unauthenticated `/api/ai/agent/*` → `401`
   - Authenticated `/api/ai/agent/status` & `/chat` → `200`
   - Cross-user `userId` spoofing & `merchant` role escalation → `403`; merchant `/toggle` → `200`
   - Active/dangerous uploads (`.html`, `.svg`, `.php`, `.exe`) → `400`
   - MIME/magic-byte mismatch (`fake.png` with `<script>`) → `400`
   - Oversized upload (`> MAX_UPLOAD_BYTES`) → `400`
   - Path traversal attempts → blocked (`400`/`404`)
   - Legitimate public & private uploads → `200`; unauthorized private download (`unauth` → `401`, cross-user → `403`, owner → `200` with `nosniff` & `attachment`)
2. **Telecom & Email Identity Regression (`npx --prefix backend tsx backend/tests/telecom_identity.test.ts`):** **16/16 PASS**
3. **TypeScript Check (`tsc --noEmit`):** **0 errors** across all modified/created Wave 0A files.

---

## 5. Remaining Risks & Architectural Notes

- **Local vs Production Gap:** All Wave 0A changes are **local only**; production VPS (`62.169.23.77`) still runs commit `5b0f281` until deployment is approved.
- **Full Private File Vault (Future Wave 3):** Current `scope=private` stores files on local VPS disk (`private_uploads/`). For multi-worker PM2 scaling and zero VPS disk bloat, migrating private uploads to **Cloudflare R2 / S3 presigned URLs** remains planned in **Wave 3** (`NGOPI_MAIL_2_TECHNICAL_DESIGN.md`).
- **Pre-existing Legacy TS Errors:** Unrelated files in `backend/src/games/`, `merchant.controller.ts`, etc., still have pre-existing TS errors (unchanged by Wave 0A).

---

## 6. Backward Compatibility Assessment

- **Frontend AI Consumers:** Verified `MerchantDashboardModal.tsx` and `NgopAIFloatingAgent.tsx` already send `getAuthHeaders()` (`Authorization` header), so adding `verifyJWT` is **100% backward compatible** for logged-in users.
- **Public Chat & Profile Uploads:** Default `POST /api/upload` (without `scope=private`) continues writing to `uploads/` and returning `/uploads/<filename>` URLs with `Access-Control-Allow-Origin: *`, preserving all existing chat, avatar, and email attachment links.

---

## 7. Deployment Instructions (When Approved)

1. Review `git diff` locally, commit & push to `origin/main`.
2. On VPS `62.169.23.77`, back up `/opt/ngopi/backend/src/{index.ts,routes/ai.routes.ts,routes/upload.routes.ts,controllers/agent.controller.ts,controllers/upload.controller.ts}` to `/opt/ngopi/backups/wave0a/`.
3. Upload the 6 Wave 0A backend files (`index.ts`, `ai.routes.ts`, `upload.routes.ts`, `agent.controller.ts`, `upload.controller.ts`, `utils/fileSecurity.ts`).
4. Run `pm2 restart ngopi-api`, verify `pm2 status`, `/api/health`, unauthenticated `401` on `/api/ai/agent/status`, and legitimate upload `200`.

## 8. Rollback Procedure

1. Copy the backed-up 5 original files from `/opt/ngopi/backups/wave0a/` back into `/opt/ngopi/backend/src/` (and remove `utils/fileSecurity.ts`).
2. Run `pm2 restart ngopi-api` and verify `/api/health` returns `200`.

