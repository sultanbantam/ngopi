# NGOPI — FINAL RELEASE CHECKLIST (WAVE 0A – STAGE C + RESIDUAL AUTH CLOSURE)

- **Document ID:** `NGOPI-FINAL-RELEASE-CHECKLIST-2026-11-14`
- **Production Baseline:** `5b0f281` (`v1.1.0-mail-read-unread`)
- **Wave 0A Commit:** `5f476986c5c52e64f6f25212289152a13183093a`
- **Recommended Release Tag:** `v1.2.0-security-merchant-lifecycle`
- **Final Verdict:** **`READY FOR PRODUCTION`** *(execute strictly in order using the runbook steps below; no production changes have been executed yet)*

---

## 1. Residual Authentication Findings — CLOSED

1. **Album Routes (`backend/src/routes/album.routes.ts`): CLOSED**
   - Removed local `extractUser()` and body/header/query fallback (`userId`, `username`, `listenerId`, `listenerUsername`).
   - Protected `POST /api/albums` and `POST /api/albums/:id/play` with `verifyJWT` + `requireDbUser`, resolving creator/listener identity strictly from verified JWT and PostgreSQL `"User"`.
   - Public read-only endpoints (`GET /stream`, `GET /search-tracks`, `GET /`, `GET /:id`) remain unchanged.
2. **Socket.IO Auth (`backend/src/sockets/index.ts`): CLOSED**
   - Removed `TokenExpiredError` `ignoreExpiration: true` fallback.
   - Enforces `jwt.verify()` (with optional `JWT_ISSUER` / `JWT_AUDIENCE`), strict `id` payload validation, and `token_type === 'access'`.
   - Expired tokens return `Authentication error: Token expired` (`connect_error`), preserving standard client refresh + reconnect flows.

---

## 2. Final Verification Summary

| Suite / Check | Result | Exit Code | Notes |
|---|---|---|---|
| `residual_auth_closure.test.ts` | **4 / 4 groups PASS** | `0` | Album routes + Socket.IO expired/refresh/valid token handshake |
| `wave0a_security.test.ts` | **10 / 10 PASS** | `0` | Upload magic-byte, private access & AI auth |
| `stage_a_security.test.ts` | **11 / 11 PASS** | `0` | JWT, DB RBAC, IDOR, Founder `#0` & `warung` `#100` |
| `stage_b1a_security.test.ts` | **10 / 10 PASS** | `0` | Partnership non-promotion & showcase isolation |
| `stage_b1b_workflow.test.ts` | **22 / 22 PASS** | `0` | Merchant application, review, approve/reject |
| `stage_b1d_remediation.test.ts` | **6 / 6 PASS** | `0` | `reviewAudits`, `supporting_docs`, DTO, `$transaction`, `verify-sign` `400` |
| `stage_c_security.test.ts` | **8 / 8 PASS** | `0` | Stage C AI Agent DB-RBAC, IDOR, showcase & toggle |
| `stage_b2b_postgres_integration.test.ts` | **7 / 7 phases PASS** | `0` | **Real PostgreSQL 16.16** (`ngopi_merchant_stage_b2_test`) |
| `prisma validate` & `prisma generate` | **PASS** | `0` | `Prisma Client v7.8.0` |
| `tsc --noEmit -p backend/tsconfig.json` | **0 errors in changed files** | `1` *(pre-existing)* | Pre-existing errors only in unrelated modules (`games/`, `chessPro.service.ts`, `bmc.routes.ts`, etc.) |
| `npm --prefix frontend run build` | **PASS** | `0` | `expo export -p web && node scripts/social-meta.cjs` (`dist/`) |

---

## 3. Release File Inventory (`5f47698` → Release Candidate)

*(All unrelated user files and working-tree items are excluded.)*

### Modified Tracked Files (`18` files since `5f47698`)
- `backend/prisma/schema.prisma`
- `backend/src/controllers/agent.controller.ts`
- `backend/src/controllers/merchant.controller.ts`
- `backend/src/controllers/partnership.controller.ts`
- `backend/src/middleware/auth.middleware.ts`
- `backend/src/middleware/rbac.middleware.ts`
- `backend/src/models/merchant.types.ts`
- `backend/src/routes/ai.routes.ts`
- `backend/src/routes/album.routes.ts`
- `backend/src/routes/merchant.routes.ts`
- `backend/src/routes/partnership.routes.ts`
- `backend/src/services/agent.service.ts`
- `backend/src/services/merchant.service.ts`
- `backend/src/services/partnership.service.ts`
- `backend/src/sockets/index.ts`
- `backend/tests/merchant.test.ts`
- `backend/tests/wave0a_security.test.ts`
- `frontend/src/components/MerchantDashboardModal.tsx`

### New Release-Scoped Files
- `backend/prisma/migrations/migration_lock.toml`
- `backend/prisma/migrations/20261113234500_merchant_lifecycle_audit/migration.sql`
- `backend/tests/stage_a_security.test.ts`
- `backend/tests/stage_b1a_security.test.ts`
- `backend/tests/stage_b1b_workflow.test.ts`
- `backend/tests/stage_b1d_remediation.test.ts`
- `backend/tests/stage_b2b_postgres_integration.test.ts`
- `backend/tests/stage_c_security.test.ts`
- `backend/tests/residual_auth_closure.test.ts`
- `docs/security/NGOPI_FINAL_PRODUCTION_READINESS.md`
- `docs/security/NGOPI_PRODUCTION_MIGRATION_RUNBOOK.md`
- `docs/security/NGOPI_PRODUCTION_ROLLBACK_RUNBOOK.md`
- `docs/security/NGOPI_FINAL_SECURITY_CLOSURE.md`
- `docs/security/NGOPI_RELEASE_CANDIDATE_REPORT.md`
- `docs/security/NGOPI_FINAL_RELEASE_CHECKLIST.md`

---

## 4. Commit & Tag Commands (Run Only When Authorized)

```powershell
git add `
  backend/prisma/schema.prisma `
  backend/prisma/migrations/migration_lock.toml `
  backend/prisma/migrations/20261113234500_merchant_lifecycle_audit/migration.sql `
  backend/src/controllers/agent.controller.ts `
  backend/src/controllers/merchant.controller.ts `
  backend/src/controllers/partnership.controller.ts `
  backend/src/middleware/auth.middleware.ts `
  backend/src/middleware/rbac.middleware.ts `
  backend/src/models/merchant.types.ts `
  backend/src/routes/ai.routes.ts `
  backend/src/routes/album.routes.ts `
  backend/src/routes/merchant.routes.ts `
  backend/src/routes/partnership.routes.ts `
  backend/src/services/agent.service.ts `
  backend/src/services/merchant.service.ts `
  backend/src/services/partnership.service.ts `
  backend/src/sockets/index.ts `
  backend/tests/merchant.test.ts `
  backend/tests/wave0a_security.test.ts `
  backend/tests/stage_a_security.test.ts `
  backend/tests/stage_b1a_security.test.ts `
  backend/tests/stage_b1b_workflow.test.ts `
  backend/tests/stage_b1d_remediation.test.ts `
  backend/tests/stage_b2b_postgres_integration.test.ts `
  backend/tests/stage_c_security.test.ts `
  backend/tests/residual_auth_closure.test.ts `
  frontend/src/components/MerchantDashboardModal.tsx `
  docs/security/NGOPI_FINAL_PRODUCTION_READINESS.md `
  docs/security/NGOPI_PRODUCTION_MIGRATION_RUNBOOK.md `
  docs/security/NGOPI_PRODUCTION_ROLLBACK_RUNBOOK.md `
  docs/security/NGOPI_FINAL_SECURITY_CLOSURE.md `
  docs/security/NGOPI_RELEASE_CANDIDATE_REPORT.md `
  docs/security/NGOPI_FINAL_RELEASE_CHECKLIST.md

git commit -m "security(ngopi): complete Wave 0A-Stage C remediation and merchant lifecycle release"
git tag -a v1.2.0-security-merchant-lifecycle -m "Ngopi Security Closure & Merchant Lifecycle (Wave 0A - Stage C)"
```

---

## 5. Production Deployment & Rollback Summary

- **Full Migration & Deployment Runbook:** [NGOPI_PRODUCTION_MIGRATION_RUNBOOK.md](file:///c:/Users/dummy/Documents/Projects/ngopi/docs/security/NGOPI_PRODUCTION_MIGRATION_RUNBOOK.md)
  1. Read-only pre-flight queries on Contabo VPS (`_prisma_migrations`, `"User"` roles for Founder `#0` & `warung` `#100`, existing `merchant_profiles` list).
  2. Full `pg_dump` (custom + SQL) + SHA-256 + `/opt/ngopi/backend/{src,prisma,package.json}` backup.
  3. `pm2 stop ngopi-api` → deploy backend files → reconcile historical migrations (`prisma migrate resolve --applied` only if already present) → `npx prisma migrate deploy` → `prisma validate` & `prisma generate`.
  4. Post-migration data reconciliation: ensure showcase rows (`m_warkop_sahabat`, `m_kenangan_senja`, `m_barista_corner`) are `is_showcase = true, user_id = NULL` and reconcile verified legitimate pre-existing merchants (`review_status = 'approved'`).
  5. `pm2 start ngopi-api` → `cd frontend && vercel --prod` (`https://ngopi.top`) → run post-deploy smoke tests.
- **Full Rollback Runbook:** [NGOPI_PRODUCTION_ROLLBACK_RUNBOOK.md](file:///c:/Users/dummy/Documents/Projects/ngopi/docs/security/NGOPI_PRODUCTION_ROLLBACK_RUNBOOK.md)
  - Vercel `vercel rollback --prod` (or Dashboard Instant Rollback) + `pm2 stop ngopi-api` → `pg_restore --clean --if-exists` → restore backend files → `npx prisma generate` → `pm2 start ngopi-api`.

