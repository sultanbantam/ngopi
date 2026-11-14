# NGOPI — PRODUCTION ROLLBACK RUNBOOK

- **Document ID:** `NGOPI-PROD-ROLLBACK-W0A-B2B-2026-11-14`
- **Target Baseline:** `5b0f281` (pre-Wave 0A / pre-B0)
- **Backup Location:** `/opt/ngopi/backups/rollout-w0a-b2b-<TIMESTAMP>/` (created in Phase 2 of the Migration Runbook)

> [!WARNING]
> **Database Rollback Principle:** Because `20261113234500_merchant_lifecycle_audit` alters `"merchant_profiles"` (`user_id DROP NOT NULL`), creates `"MerchantReviewStatus"` enum, and adds `"merchant_review_audits"` with `ON DELETE RESTRICT`, **restoring the verified `pg_dump` backup is the authoritative database rollback procedure**. Only use `pg_restore` after stopping `ngopi-api` to prevent partial writes.

---

## 1. Rollback Trigger Criteria

Initiate rollback immediately if any of the following occur during or after rollout:
- `ngopi-api` fails to start or throws Prisma schema/client errors after `pm2 start ngopi-api`.
- `https://api.ngopi.top/api/health` fails to return `200` within 60 seconds of restart.
- Legitimate core functionality (login, chat, uploads, mail, or reconciled merchants) suffers a P1/P0 outage that cannot be resolved via data reconciliation in under 10 minutes.
- Unexpected data integrity error on `"User"` or `"merchant_profiles"`.

---

## 2. Frontend Rollback (Vercel `https://ngopi.top`)

If the new frontend deployment was pushed to Vercel:
1. In the **Vercel Dashboard** (`ngopi` project → **Deployments**), locate the previous production deployment (`5b0f281`) and click **Instant Rollback** (or **Promote to Production**).
2. Or via Vercel CLI:
   ```bash
   cd frontend
   vercel rollback --prod
   ```
3. Verify `https://ngopi.top` loads cleanly with no console errors.

---

## 3. Backend & Database Rollback (Contabo VPS `62.169.23.77`)

Set `BACKUP_ROOT` to the exact timestamped directory created in Phase 2 of the Migration Runbook:

```bash
export BACKUP_ROOT="/opt/ngopi/backups/rollout-w0a-b2b-<TIMESTAMP>"
cd /opt/ngopi/backend
set -a && source .env && set +a

# 1. Verify backup files and checksums before touching anything
cd "$BACKUP_ROOT/db" && sha256sum -c SHA256SUMS.txt
cd /opt/ngopi/backend

# 2. Stop backend API to prevent writes during restore
pm2 stop ngopi-api

# 3. Restore PostgreSQL database from pre-migration custom dump
# (--clean --if-exists drops objects created after the dump before restoring baseline objects)
pg_restore --clean --if-exists --no-owner --no-acl -d "$DATABASE_URL" "$BACKUP_ROOT/db/ngopi_prod_pre_b2b.dump"

# 4. Restore original backend source & prisma directories
rm -rf /opt/ngopi/backend/src /opt/ngopi/backend/prisma
cp -a "$BACKUP_ROOT/backend/src" /opt/ngopi/backend/src
cp -a "$BACKUP_ROOT/backend/prisma" /opt/ngopi/backend/prisma
cp -a "$BACKUP_ROOT/backend/package.json" /opt/ngopi/backend/package.json

# 5. Regenerate Prisma Client matching the restored 5b0f281 schema
npx prisma generate

# 6. Restart PM2 service
pm2 start ngopi-api
pm2 status
pm2 logs ngopi-api --lines 30 --nostream
```

---

## 4. Post-Rollback Verification

```bash
# 1. API health check
curl -fsS https://api.ngopi.top/api/health

# 2. Verify restored schema does NOT contain B0 columns/tables
psql "$DATABASE_URL" -c "SELECT to_regclass('public.merchant_review_audits');"
# Expected: NULL (empty)

psql "$DATABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'merchant_profiles' AND column_name IN ('review_status','is_showcase','supporting_docs','deleted_at');"
# Expected: 0 rows

# 3. Verify Founder #0 and warung #100 roles remain intact
psql "$DATABASE_URL" -c "SELECT id, username, role FROM \"User\" WHERE LOWER(username) IN ('ngopi','founder','warung') OR bmc_id = 1;"
```

Confirm `https://ngopi.top` login, chat, Warkop, and existing merchant endpoints return to normal baseline behavior, and document the rollback incident before attempting another rollout.

