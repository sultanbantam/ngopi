# NGOPI GREEN — Deployment & Rollback Guide

## 1. Environment Variables (Names Only)
- Backend: `DATABASE_URL`, `JWT_SECRET`, `MAX_UPLOAD_BYTES`, `CORS_ORIGIN`
- Frontend: Expo public API base (`https://api.ngopi.top/api`)

## 2. Database Migration & Verification
1. Verify Prisma schema: `npx prisma validate`
2. Apply additive migration on production PostgreSQL:
   `npx prisma migrate deploy`
3. Verify status: `npx prisma migrate status`
   - Expected new migration: `20261117053500_add_ngopi_green` (adds 14 `green_*` tables; zero destructive changes to existing tables).

## 3. Backend Build, Test & Deploy (Contabo VPS)
1. Run NGOPI GREEN backend tests:
   `npx tsx tests/green.test.ts`
2. Sync updated `backend/` to VPS `/opt/ngopi/backend`, run `npx prisma generate`, `npx prisma migrate deploy`, and `pm2 reload ngopi-api`.
3. Verify `/api/green/catalog` returns HTTP `200` and `/api/green/dashboard` returns HTTP `401` without JWT.

## 4. Frontend Build & Deploy (Vercel)
1. Run TypeScript check: `npx --prefix frontend tsc -p frontend/tsconfig.json --noEmit`
2. Run production web build: `EXPO_NO_TELEMETRY=1 npm --prefix frontend run build`
3. Deploy to Vercel: `npx vercel --prod --yes`

## 5. Rollback Procedure
- **Frontend:** Instant rollback to previous Vercel deployment via `vercel rollback` or Vercel dashboard.
- **Backend:** Restore previous PM2 release snapshot (`pm2 reload ngopi-api`).
- **Database:** Migration `20261117053500_add_ngopi_green` is purely additive (`green_*` tables only); existing `User`, `PointsAccount`, `PointsTransaction`, and Warkop tables remain untouched. If needed, drop only the new `green_*` tables in reverse foreign-key order.
