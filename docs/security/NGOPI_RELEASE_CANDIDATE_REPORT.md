# NGOPI — RELEASE CANDIDATE REPORT (WAVE 0A – STAGE C)

- **Document ID:** `NGOPI-RC-W0A-C-2026-11-14`
- **Production Baseline:** `5b0f281` (`v1.1.0-mail-read-unread`)
- **Wave 0A Commit:** `5f476986c5c52e64f6f25212289152a13183093a`
- **Target Branch:** `main` (`sultanbantam/ngopi`)
- **Final Verdict:** **`READY WITH CONDITIONS`**

---

## 1. Release Candidate File Inventory (`5b0f281` → Working Tree)

### Modified Tracked Files (`20` files)
- **Prisma & Migrations:**
  - `backend/prisma/schema.prisma`
- **Backend Middleware & Utils:**
  - `backend/src/middleware/auth.middleware.ts`
  - `backend/src/middleware/rbac.middleware.ts`
  - `backend/src/utils/fileSecurity.ts` *(added in `5f47698`)*
- **Backend Routes, Controllers, Models & Services:**
  - `backend/src/index.ts`
  - `backend/src/routes/ai.routes.ts`
  - `backend/src/routes/upload.routes.ts`
  - `backend/src/routes/merchant.routes.ts`
  - `backend/src/routes/partnership.routes.ts`
  - `backend/src/controllers/agent.controller.ts`
  - `backend/src/controllers/upload.controller.ts`
  - `backend/src/controllers/merchant.controller.ts`
  - `backend/src/controllers/partnership.controller.ts`
  - `backend/src/models/merchant.types.ts`
  - `backend/src/services/agent.service.ts`
  - `backend/src/services/merchant.service.ts`
  - `backend/src/services/partnership.service.ts`
- **Frontend:**
  - `frontend/src/components/MerchantDashboardModal.tsx`
- **Test Suites Updated:**
  - `backend/tests/merchant.test.ts`
  - `backend/tests/wave0a_security.test.ts`

### New Release-Scoped Untracked Files
- `backend/prisma/migrations/migration_lock.toml`
- `backend/prisma/migrations/20261113234500_merchant_lifecycle_audit/migration.sql`
- `backend/tests/stage_a_security.test.ts`
- `backend/tests/stage_b1a_security.test.ts`
- `backend/tests/stage_b1b_workflow.test.ts`
- `backend/tests/stage_b1d_remediation.test.ts`
- `backend/tests/stage_b2b_postgres_integration.test.ts`
- `backend/tests/stage_c_security.test.ts`
- Security & Runbook Docs under `docs/security/` (including `NGOPI_FINAL_PRODUCTION_READINESS.md`, `NGOPI_PRODUCTION_MIGRATION_RUNBOOK.md`, `NGOPI_PRODUCTION_ROLLBACK_RUNBOOK.md`, `NGOPI_FINAL_SECURITY_CLOSURE.md`, `NGOPI_RELEASE_CANDIDATE_REPORT.md`).

*(All unrelated user untracked files and working-tree artifacts were preserved untouched.)*

---

## 2. Verification, Test & Build Results

| Suite / Check | Result | Exit Code | Scope / Environment |
|---|---|---|---|
| `stage_c_security.test.ts` | **8/8 PASS** | `0` | Stage C AI Agent RBAC, IDOR, showcase & toggle |
| `wave0a_security.test.ts` | **10/10 PASS** | `0` | Wave 0A upload magic-byte, private access & AI auth |
| `stage_a_security.test.ts` | **11/11 PASS** | `0` | JWT, DB RBAC, IDOR, Founder `#0` & `warung` `#100` |
| `stage_b1a_security.test.ts` | **10/10 PASS** | `0` | Partnership non-promotion & showcase isolation |
| `stage_b1b_workflow.test.ts` | **22/22 PASS** | `0` | Full merchant application, review, approve/reject |
| `stage_b1d_remediation.test.ts` | **6/6 PASS** | `0` | `reviewAudits`, `supporting_docs`, DTO, `$transaction`, `verify-sign` `400` |
| `stage_b2b_postgres_integration.test.ts` | **7/7 phases PASS** | `0` | **Real PostgreSQL 16.16** (`ngopi_merchant_stage_b2_test`) |
| `telecom_identity.test.ts` | **16/16 PASS** | `0` | Founder `#0`, telecom identity & mail |
| `merchant.test.ts` | **7/7 PASS** | `0` | Merchant service lifecycle & showcase |
| `gapleh_partnership.test.ts` | **47/47 PASS** | `0` | Gapleh game & partnership unit tests |
| `compliance.test.ts` | **8/8 PASS** | `0` | UU PDP / compliance unit tests |
| `moderation.test.ts` | **9/9 PASS** | `0` | Anti-spam & AI moderation unit tests |
| `ht.test.ts` | **9/9 PASS** | `0` | Handy Talky unit tests |
| `prisma validate` & `prisma generate` | **PASS** | `0` | `Prisma Client v7.8.0` |
| `tsc --noEmit -p backend/tsconfig.json` | **0 errors in modified files** | `1` *(pre-existing)* | Pre-existing errors only in unrelated modules (`games/`, `chessPro`, etc.) |
| `npm --prefix frontend run build` | **PASS** | `0` | `expo export -p web && node scripts/social-meta.cjs` (`dist/`) |

---

## 3. Recommended Release Commit Plan (Requires Explicit User Authorization)

1. Stage **only** the release-scoped files above (do **not** `git add -A`, so unrelated untracked screenshots/notes/patches remain excluded):
   - Commit 1 (Code + Migrations + Tests):
     `security(merchant,ai): complete Wave 0A-Stage C remediation and merchant lifecycle audit`
   - Commit 2 (Security & Operations Docs):
     `docs(security): add Stage B-C closure, readiness, migration, and rollback runbooks`
2. Tag the release commit (e.g., `v1.2.0-security-merchant-lifecycle`).

---

## 4. Ordered Production Deployment Sequence

Execute strictly per [NGOPI_PRODUCTION_MIGRATION_RUNBOOK.md](file:///c:/Users/dummy/Documents/Projects/ngopi/docs/security/NGOPI_PRODUCTION_MIGRATION_RUNBOOK.md):
1. **Read-Only Production Pre-Flight:** Inspect `_prisma_migrations`, `"User"` roles (Founder `#0` = `superadmin`, `warung` `#100` = `user`), and existing `"merchant_profiles"` rows.
2. **Full Backup & Integrity Check:** `pg_dump` (custom + plain SQL) + SHA-256 checksums + VPS `/opt/ngopi/backend/{src,prisma,package.json}` backup.
3. **Maintenance Window (`pm2 stop ngopi-api`):** Deploy backend files, reconcile historical migrations (`prisma migrate resolve --applied` only if already present in DB), run `npx prisma migrate deploy`, `prisma validate`, and `prisma generate`.
4. **Post-Migration Data Reconciliation:** Mark any DB showcase rows (`is_showcase = true, user_id = NULL`) and explicitly reconcile verified legitimate pre-existing merchants (`review_status = 'approved'`).
5. **Backend Start & Frontend Deploy:** `pm2 start ngopi-api`, then `cd frontend && vercel --prod` (`https://ngopi.top`).
6. **Smoke Tests:** Run API & UI smoke tests; if any P0/P1 failure occurs, execute [NGOPI_PRODUCTION_ROLLBACK_RUNBOOK.md](file:///c:/Users/dummy/Documents/Projects/ngopi/docs/security/NGOPI_PRODUCTION_ROLLBACK_RUNBOOK.md).

