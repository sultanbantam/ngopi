# NGOPI — PRODUCTION MIGRATION & DEPLOYMENT RUNBOOK

- **Document ID:** `NGOPI-PROD-RUNBOOK-W0A-B2B-2026-11-14`
- **Target Services:**
  - **Database:** Production PostgreSQL (`DATABASE_URL` on Contabo VPS `62.169.23.77`)
  - **Backend:** `/opt/ngopi/backend` (PM2 `ngopi-api`, `https://api.ngopi.top`)
  - **Frontend:** Vercel (`https://ngopi.top`, `frontend/vercel.json`)
- **Migration Target:** `20261113234500_merchant_lifecycle_audit`

> [!CAUTION]
> **Do not skip Phase 1 (Read-Only Pre-Flight) or Phase 2 (Backup & Restore Verification).** Never run `prisma migrate reset` or `prisma db push --force-reset` in production.

---

## Phase 1 — Read-Only Production Pre-Flight (No Changes)

Connect to the Contabo VPS (`62.169.23.77`) and run **read-only** checks against PostgreSQL (using the existing `DATABASE_URL` in `/opt/ngopi/backend/.env`, without printing secrets):

```bash
cd /opt/ngopi/backend
set -a && source .env && set +a

# 1. Verify DB identity & current schema state
psql "$DATABASE_URL" -c "SELECT current_database(), current_user, version();"

# 2. Check whether _prisma_migrations exists and which migrations are recorded
psql "$DATABASE_URL" -c "SELECT to_regclass('public._prisma_migrations');"
psql "$DATABASE_URL" -c "SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;" 2>/dev/null || true

# 3. Verify historical tables exist (from the 5 pre-B0 migrations)
psql "$DATABASE_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('User','merchant_profiles','merchant_agreements','Platform','Faq','Group','Message') ORDER BY table_name;"

# 4. Read-only role & merchant inventory (counts and non-PII IDs/roles only)
psql "$DATABASE_URL" -c "SELECT role, COUNT(*) FROM \"User\" GROUP BY role ORDER BY role;"
psql "$DATABASE_URL" -c "SELECT id, username, role, bmc_id FROM \"User\" WHERE LOWER(username) IN ('ngopi','founder','warung') OR bmc_id = 1 OR role IN ('admin','superadmin','merchant') ORDER BY bmc_id NULLS LAST, id;"
psql "$DATABASE_URL" -c "SELECT id, user_id, is_verified, created_at FROM merchant_profiles ORDER BY created_at;"
```

**Pre-Flight Pass Criteria:**
- Founder `#0` has `role = 'superadmin'`.
- `warung` `#100` has `role = 'user'`.
- Record the exact list of `merchant_profiles.id` values that represent **legitimate active merchants** vs **showcase profiles** (`m_warkop_sahabat`, `m_kenangan_senja`, `m_barista_corner`) vs **unverified/unauthorized** entries.

---

## Phase 2 — Mandatory Full Backup & Recovery Validation

```bash
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_ROOT="/opt/ngopi/backups/rollout-w0a-b2b-$TS"
mkdir -p "$BACKUP_ROOT/db" "$BACKUP_ROOT/backend"

# 1. Full PostgreSQL custom-format dump + plain SQL dump
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl -f "$BACKUP_ROOT/db/ngopi_prod_pre_b2b.dump"
pg_dump "$DATABASE_URL" --format=plain --no-owner --no-acl -f "$BACKUP_ROOT/db/ngopi_prod_pre_b2b.sql"

# 2. Verify dump integrity and generate SHA-256 checksums
pg_restore --list "$BACKUP_ROOT/db/ngopi_prod_pre_b2b.dump" > "$BACKUP_ROOT/db/dump_toc.txt"
sha256sum "$BACKUP_ROOT/db/ngopi_prod_pre_b2b.dump" "$BACKUP_ROOT/db/ngopi_prod_pre_b2b.sql" > "$BACKUP_ROOT/db/SHA256SUMS.txt"

# 3. Backup current backend source, prisma, and package files (preserve .env untouched)
cp -a /opt/ngopi/backend/src "$BACKUP_ROOT/backend/src"
cp -a /opt/ngopi/backend/prisma "$BACKUP_ROOT/backend/prisma"
cp -a /opt/ngopi/backend/package.json "$BACKUP_ROOT/backend/package.json"
```

*(Recommended Recovery Validation: Verify `pg_restore --list` succeeds with non-zero table entries and, if a scratch database is available on VPS, test `pg_restore` into a temporary DB and drop it afterwards.)*

---

## Phase 3 — Maintenance Window: Deploy Backend Files & Reconcile Migrations

1. **Stop `ngopi-api` briefly during schema migration & file swap:**
   ```bash
   pm2 stop ngopi-api
   ```

2. **Deploy updated backend files (`src/`, `prisma/schema.prisma`, `prisma/migrations/`)** from the verified release commit/artifact into `/opt/ngopi/backend/` (do **not** overwrite `/opt/ngopi/backend/.env` or `/opt/ngopi/backend/uploads/`).

3. **Reconcile historical migrations (ONLY if `_prisma_migrations` is missing or lacks the 5 pre-B0 entries verified in Phase 1):**
   ```bash
   cd /opt/ngopi/backend

   # Only mark historical migrations that Phase 1 confirmed are already present in production DB:
   npx prisma migrate resolve --applied 20260709093000_cs_hub
   npx prisma migrate resolve --applied 20260710110000_private_chat_schema_sync
   npx prisma migrate resolve --applied 20260710185000_add_group_created_at
   npx prisma migrate resolve --applied 20260710193000_group_admin_controls
   npx prisma migrate resolve --applied 20260711102000_security_auth_foundation
   ```

4. **Check status and apply `20261113234500_merchant_lifecycle_audit`:**
   ```bash
   npx prisma migrate status
   # Expected: 20261113234500_merchant_lifecycle_audit listed as pending

   npx prisma migrate deploy
   npx prisma migrate status
   # Expected: Database schema is up to date!

   npx prisma validate
   npx prisma generate
   ```

---

## Phase 4 — Post-Migration Merchant & Showcase Data Reconciliation

Immediately after `npx prisma migrate deploy`, reconcile existing records identified in Phase 1:

```bash
# 1. Ensure any DB-stored showcase profiles are marked public read-only (if present in merchant_profiles)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
UPDATE merchant_profiles
SET user_id = NULL,
    is_showcase = true,
    is_verified = true,
    review_status = 'approved'
WHERE id IN ('m_warkop_sahabat', 'm_kenangan_senja', 'm_barista_corner');
"

# 2. ONLY for explicitly verified legitimate pre-existing merchants identified in Phase 1:
# Replace <LEGIT_ID_1>, <LEGIT_ID_2> with verified IDs from Phase 1 (skip if none exist).
# psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
# UPDATE merchant_profiles
# SET review_status = 'approved',
#     is_verified = true,
#     is_showcase = false
# WHERE id IN ('<LEGIT_ID_1>', '<LEGIT_ID_2>')
#   AND is_showcase = false;
# "

# 3. Verify invariants after reconciliation
psql "$DATABASE_URL" -c "SELECT id, user_id, is_showcase, is_verified, review_status, deleted_at FROM merchant_profiles ORDER BY created_at;"
psql "$DATABASE_URL" -c "SELECT id, username, role FROM \"User\" WHERE LOWER(username) IN ('ngopi','founder','warung') OR bmc_id = 1;"
```

---

## Phase 5 — Start Backend & Deploy Frontend (Vercel)

1. **Restart backend API:**
   ```bash
   pm2 start ngopi-api
   pm2 status
   pm2 logs ngopi-api --lines 30 --nostream
   ```

2. **Deploy Frontend to Vercel (`https://ngopi.top`):**
   From the local release commit (or Vercel Git integration on `main`):
   ```bash
   cd frontend
   vercel --prod
   ```
   *(Verify build runs `expo export -p web && node scripts/social-meta.cjs` cleanly and aliases `https://ngopi.top`.)*

---

## Phase 6 — Mandatory Post-Deploy Smoke Tests

```bash
# 1. Health check -> HTTP 200
curl -fsS https://api.ngopi.top/api/health

# 2. Public showcase endpoints -> HTTP 200 (must NOT expose user_id, supporting_docs, reviewed_by, review_status)
curl -fsS https://api.ngopi.top/api/merchant/partners
curl -fsS https://api.ngopi.top/api/merchant/cafe/m_warkop_sahabat

# 3. Protected merchant & admin endpoints without token -> HTTP 401
curl -s -o /dev/null -w "%{http_code}\n" https://api.ngopi.top/api/merchant/dashboard
curl -s -o /dev/null -w "%{http_code}\n" https://api.ngopi.top/api/merchant/admin/applications
curl -s -o /dev/null -w "%{http_code}\n" https://api.ngopi.top/api/partnership/status

# 4. AI endpoints without token -> HTTP 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.ngopi.top/api/ai/agent/execute -H "Content-Type: application/json" -d '{}'
```

**Interactive UI Smoke Tests (`https://ngopi.top`):**
1. Login as Founder `#0` (`warung@ngopi.top`) → open Merchant Dashboard → verify Admin Review Queue is visible and loads `GET /api/merchant/admin/applications`.
2. Login as regular `user` (e.g. `warung` `#100`) → open Merchant Dashboard → verify registration form (`none`) or pending status (`pending`), **no** access to `m_warkop_sahabat` dashboard.
3. Verify `/api/upload` rejects `.html`/`.svg`/spoofed `.png` with `400`, and allows normal `.jpg`/`.png`/`.pdf` uploads.
4. Verify chat, Socket.IO `Live` status, and Ngopi Mail inbox work normally.

