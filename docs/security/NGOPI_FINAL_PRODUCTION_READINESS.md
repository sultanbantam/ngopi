# NGOPI — FINAL PRODUCTION ROLLOUT READINESS ASSESSMENT

- **Document ID:** `NGOPI-PROD-READY-W0A-B2B-2026-11-14`
- **Assessment Scope:** Wave 0A (`5f47698`) through Stage B2B (current local working tree)
- **Production Baseline:** `5b0f281` (`v1.1.0-mail-read-unread`)
- **Repository / Branch:** `sultanbantam/ngopi` (`main`)
- **Final Verdict:** **`READY WITH CONDITIONS`**

> [!IMPORTANT]
> **Strict Boundaries Observed:** No production SSH connection, no production SQL or Prisma migration execution, no production data modification or PII exposure, no deployment, and no git commit, push, or tagging were performed during this assessment.

---

## 1. Executive Verdict & Release Scope

**Verdict: `READY WITH CONDITIONS`**

All security, identity, RBAC, partnership, merchant lifecycle, Prisma schema, and real PostgreSQL 16 integration checks (E1–E7) for **Wave 0A through Stage B2B** have passed locally. The release is eligible for production rollout **only when all 5 mandatory conditions below are satisfied**:

1. **Read-Only Production Pre-Flight:** Verify `_prisma_migrations` state, `User.role` mappings (Founder `#0` = `superadmin`, `warung` `#100` = `user`), and existing `merchant_profiles` rows before cutover.
2. **Verified Full Backups:** Complete and checksum-verify a PostgreSQL `pg_dump` backup and VPS backend file backup before any file or schema change.
3. **Migration Reconciliation & Existing Merchant Data Reconciliation:** Reconcile historical migrations if needed, run `npx prisma migrate deploy`, and explicitly reconcile any pre-existing legitimate verified merchants (since `review_status` defaults to `'pending'`).
4. **Coordinated Backend + Frontend Deployment:** Deploy both Contabo VPS (`ngopi-api`) and Vercel (`https://ngopi.top`), because `MerchantDashboardModal.tsx` has breaking-contract UX updates.
5. **Post-Deploy Smoke Tests & Stage C Risk Acceptance:** Execute the smoke test suite immediately after cutover and schedule Stage C (`agent.controller.ts` / `ai.routes.ts`) remediation.

---

## 2. Final Git Diff Audit (`5b0f281` → Working Tree)

Between production baseline `5b0f281` and the current working tree (`19` tracked files modified + new migration/security/test files), all product changes fall strictly within Wave 0A and Stage A–B2B:

| Area | Files | Key Changes Verified |
|---|---|---|
| **Wave 0A Upload & Static Hardening** | `backend/src/utils/fileSecurity.ts`, `backend/src/controllers/upload.controller.ts`, `backend/src/routes/upload.routes.ts`, `backend/src/index.ts` | Magic-byte validation; blocks `.html`/`.htm`/`.svg`/`.js`/`.xml` and MIME-spoofed uploads (`400`); sets `X-Content-Type-Options: nosniff` and `Content-Disposition: attachment` for non-media `/uploads/*`. |
| **Wave 0A AI Route Protection** | `backend/src/routes/ai.routes.ts`, `backend/src/controllers/agent.controller.ts` | Adds `verifyJWT` + `aiLimiter` to all `/api/ai/agent/*` routes; adds `requireMerchant` to `/status` and `/toggle`; blocks cross-user `userId` spoofing; validates `trigger` allowlist and `customPrompt` length (`<= 2000`). |
| **Authentication & DB-Backed RBAC** | `backend/src/middleware/auth.middleware.ts`, `backend/src/middleware/rbac.middleware.ts` | Removes `ignoreExpiration: true` fallback in `verifyJWT`; enforces strict `jwt.verify()` + `token_type === 'access'` + optional `JWT_ISSUER`/`JWT_AUDIENCE`. Adds `requireDbRole`, `requireDbUser`, `requireDbMerchant`, `requireDbAdmin`, `requireDbSuperadmin` resolving roles from PostgreSQL rather than stale JWT claims. |
| **Merchant Lifecycle, Showcase & Audit** | `backend/prisma/schema.prisma`, `backend/prisma/migrations/migration_lock.toml`, `backend/prisma/migrations/20261113234500_merchant_lifecycle_audit/migration.sql`, `backend/src/models/merchant.types.ts`, `backend/src/routes/merchant.routes.ts`, `backend/src/controllers/merchant.controller.ts`, `backend/src/services/merchant.service.ts` | Removes `extractUser()`, `'usr_partner_1'`, and `'m_warkop_sahabat'` fallbacks. Enforces public read-only showcase (`is_showcase = true`, `user_id = null`), allowlist DTO (`sanitizePublicMerchant`), `supporting_docs` JSONB sanitization, pending-by-default registration, and atomic `$transaction` admin approval/rejection (`updateMany` concurrency guard + `MerchantReviewAudit` + role promotion only from `'user'` to `'merchant'`). |
| **Partnership Remediation** | `backend/src/routes/partnership.routes.ts`, `backend/src/controllers/partnership.controller.ts`, `backend/src/services/partnership.service.ts` | Protects all `/api/partnership/*` routes with `verifyJWT` + `requireDbUser`; removes automatic `User.role = 'merchant'` and `is_verified = true` promotion in `verifyAndSignAgreement()`; propagates HTTP `400`/error status codes cleanly. |
| **Frontend Merchant & Admin UI** | `frontend/src/components/MerchantDashboardModal.tsx` | Removes `role: 'merchant'` payload spoof and `m_warkop_sahabat` fallback; gates dashboard via `/api/merchant/me` and `/api/merchant/application/status`; adds `business_category` & `supporting_docs` inputs; adds Admin Review Queue UI for `admin`/`superadmin`. |

**Dependency Impact:** `backend/package.json` and `frontend/package.json` have **0 new npm dependencies** relative to `5b0f281`.

---

## 3. Production Architecture, Runtime & Environment Requirements

### 3.1 Architecture & Runtime
- **Frontend:** Vercel (`https://ngopi.top`), configured via `frontend/vercel.json` (`outputDirectory: "dist"`, build script `expo export -p web && node scripts/social-meta.cjs`).
- **Backend:** Contabo VPS (`62.169.23.77`, `/opt/ngopi/backend`), PM2 service `ngopi-api` on port `3000` (`ts-node` with `transpileOnly: true` per `backend/tsconfig.json`), fronted by HTTPS reverse proxy (`https://api.ngopi.top`).
- **Database:** PostgreSQL accessed via `DATABASE_URL` (`@prisma/adapter-pg` + `pg.Pool` in `backend/src/utils/prisma.ts`, and `backend/prisma.config.ts`).

### 3.2 Environment Variables Checklist
Verify in `/opt/ngopi/backend/.env` (do not log secret values):
- **Required (existing):** `PORT`, `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `CORS_ORIGINS`, `PUBLIC_API_URL`, `MAX_UPLOAD_BYTES`.
- **Optional (newly supported by `auth.middleware.ts`):** `JWT_ISSUER`, `JWT_AUDIENCE` (leave unset unless already configured in token signing).
- **Important Auth Behavior Change:** Removing `ignoreExpiration: true` means expired access tokens now strictly return `HTTP 401`. Clients must obtain a fresh access token via refresh/re-login.

---

## 4. Production Database Migration Impact

Migration file: `backend/prisma/migrations/20261113234500_merchant_lifecycle_audit/migration.sql`

- **Destructive Operations:** **None** (no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `DELETE`).
- **Schema Changes:**
  - Creates enum `"MerchantReviewStatus"` (`'pending'`, `'approved'`, `'rejected'`).
  - Alters `"merchant_profiles"`: adds 9 columns (`business_category`, `is_showcase BOOLEAN NOT NULL DEFAULT false`, `rejection_reason`, `review_status "MerchantReviewStatus" NOT NULL DEFAULT 'pending'`, `reviewed_at`, `reviewed_by`, `submitted_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`, `supporting_docs JSONB`, `deleted_at TIMESTAMP(3)`), drops `NOT NULL` on `user_id`, sets `is_verified` default to `false`.
  - Creates table `"merchant_review_audits"`, 4 indexes, and 3 foreign keys (`reviewed_by` `ON DELETE SET NULL`; `merchant_id` & `actor_id` `ON DELETE RESTRICT`).
- **Historical Migration Lineage Caveat:** Production PostgreSQL was originally provisioned via `prisma db push` prior to `2026-07-09`. `_prisma_migrations` must be inspected before running `npx prisma migrate deploy` so that any already-applied historical migrations (`20260709093000_cs_hub` through `20260711102000_security_auth_foundation`) are reconciled via `prisma migrate resolve --applied` rather than re-executed.

---

## 5. Production Data Compatibility & Identity Invariants

*(No production PII was accessed or copied.)*

1. **Identity Invariants:**
   - Founder `#0` (`warung@ngopi.top`, `ngopi`/`founder`/`bmc_id = 1`) must remain `superadmin`.
   - `warung` `#100` must remain `user` (never promoted).
   - Showcase profiles (`m_warkop_sahabat`, `m_kenangan_senja`, `m_barista_corner`) must remain public read-only (`user_id = NULL`, `is_showcase = true`).
2. **Existing `merchant_profiles` Compatibility Impact (CRITICAL):**
   - Because `migration.sql` adds `review_status` with `DEFAULT 'pending'` and `is_showcase` with `DEFAULT false`, **every pre-existing row in `"merchant_profiles"` will become `review_status = 'pending'` immediately after migration**.
   - `MerchantService.isApprovedMerchantProfile()` requires `is_showcase === false && is_verified === true && review_status === 'approved'`.
   - **Operational Impact:** Any legitimate pre-existing verified merchant in PostgreSQL will lose `/api/merchant/dashboard`, `/profile`, `/promo`, and `/partners` visibility until either reconciled in SQL (for verified legitimate merchants only) or approved via the Admin Review Queue. Conversely, any previously auto-promoted/unverified profiles are safely suspended until reviewed.

---

## 6. Frontend vs Backend Deployment Necessity

**Both Backend (VPS) and Frontend (Vercel) deployment are REQUIRED.**

- **Why Backend-Only Is Insufficient:** The production frontend (`5b0f281`) in `MerchantDashboardModal.tsx` still calls `/api/merchant/dashboard` directly without checking `/api/merchant/me` or `/api/merchant/application/status`, sends `role: 'merchant'` + fallback `cafeId: 'm_warkop_sahabat'` to `/api/ai/agent/execute`, has no `business_category`/`supporting_docs` application fields, and lacks the Admin Review Queue UI.
- **Cutover Order:** Deploy database migration + backend (`ngopi-api`) first, verify health and APIs, then deploy frontend to Vercel (`https://ngopi.top`) immediately in the same maintenance window.

---

## 7. Remaining Security Risks & Blockers

| ID | Severity | Status | Description & Mitigation |
|---|---|---|---|
| **RISK-01 (Stage C Scope)** | **Medium-High** | Deferred (Pre-existing in `5f47698`) | `backend/src/controllers/agent.controller.ts:59, 78` still exempts `cleanCafeId !== 'm_warkop_sahabat'` from ownership checks and defaults `cafeId` to `'m_warkop_sahabat'`. `backend/src/routes/ai.routes.ts:17-18` still uses JWT-claim `requireMerchant` rather than `requireDbAdmin` on `/agent/toggle`. **Action:** Schedule Stage C immediately after this rollout (or hold rollout if strict Stage C closure is required first). |
| **BLOCKER-01 (Pre-Flight DB State)** | **High (Pre-Deploy Gate)** | Unverified locally | Production `_prisma_migrations`, `"User"` roles, and existing `"merchant_profiles"` rows have not been inspected. **Action:** Run read-only pre-flight queries in `NGOPI_PRODUCTION_MIGRATION_RUNBOOK.md` before cutover. |
| **BLOCKER-02 (Existing Merchant `review_status`)** | **High (Operational)** | Deterministic from `migration.sql` | Pre-existing `"merchant_profiles"` rows default to `review_status = 'pending'`. **Action:** Explicitly approve/reconcile legitimate merchants during the migration window. |
| **RISK-02 (Uncommitted Local Changes)** | **Medium (Release Hygiene)** | Local working tree only | Stage A–B2B changes are currently uncommitted in the local workspace. **Action:** Create a clean release commit/tag (when authorized) before pushing/deploying to Vercel and VPS. |
| **RISK-03 (Strict JWT Expiration)** | **Low-Medium (UX)** | Intentional security fix | `verifyJWT` no longer ignores expired tokens (`ignoreExpiration: true` removed). Users with expired cached tokens will receive `401` and must refresh/re-login. |

---

## 8. Exact Next Actions

1. Review and approve the migration and rollback runbooks:
   - [NGOPI_PRODUCTION_MIGRATION_RUNBOOK.md](file:///c:/Users/dummy/Documents/Projects/ngopi/docs/security/NGOPI_PRODUCTION_MIGRATION_RUNBOOK.md)
   - [NGOPI_PRODUCTION_ROLLBACK_RUNBOOK.md](file:///c:/Users/dummy/Documents/Projects/ngopi/docs/security/NGOPI_PRODUCTION_ROLLBACK_RUNBOOK.md)
2. Commit and tag the verified Wave 0A–Stage B2B changes cleanly (when authorized).
3. Execute the read-only production pre-flight queries and full backups in the migration runbook.
4. Execute the coordinated migration, VPS backend deploy, post-migration merchant reconciliation, Vercel frontend deploy, and smoke tests.
5. Proceed to **Stage C (AI Agent Remediation)** to close `RISK-01`.

