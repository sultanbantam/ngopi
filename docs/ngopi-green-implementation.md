# NGOPI GREEN — Implementation Summary

## Backend Files Created / Modified
- `backend/prisma/schema.prisma`: Added 14 additive `green_*` models (`GreenActivityCategory`, `GreenActivityType`, `GreenEmissionFactor`, `GreenRewardRule`, `GreenSubmission`, `GreenEvidence`, `GreenVerification`, `GreenImpactRecord`, `GreenPlant`, `GreenPlantMonitoring`, `GreenEnvironmentReport`, `GreenChallenge`, `GreenChallengeMember`, `GreenAuditLog`).
- `backend/prisma/migrations/20261117053500_add_ngopi_green/migration.sql`: Reversible additive PostgreSQL DDL for all `green_*` tables and indexes.
- `backend/src/services/green/greenCatalog.seed.ts`: Idempotent seeding for all 7 environmental categories, 23 activity types, versioned emission factors (`v1.0-2026`), configurable reward rules, and active challenges.
- `backend/src/services/green/greenImpact.service.ts`: Transparent, versioned impact calculation engine (`calculateGreenImpact`) separating actual, baseline, avoided, and sequestered emissions, waste kg, water liters, and electricity kWh.
- `backend/src/services/green/greenSubmission.service.ts`: Server-side submission validation, ecobrick rules, SHA-256 duplicate-evidence detection, and transactional admin verification (`verifyGreenSubmission`) connected to canonical `earnPoints` + `pointsEconomyService.syncExternalCredit` + `GreenAuditLog`.
- `backend/src/routes/green.routes.ts`: Express API routes (`/api/green/catalog`, `/dashboard`, `/submissions`, `/reports`, `/plants/:id/monitor`, `/challenges/:id/join`, `/admin/submissions`, `/admin/submissions/:id/verify`, `/admin/audit-logs`) protected by `verifyJWT` and `requireDbRole('admin', 'superadmin')`.
- `backend/src/index.ts`: Mounted `app.use('/api/green', greenRoutes)`.
- `backend/tests/green.test.ts`: Unit & integration tests covering carbon accounting, reward rules, validation, duplicate detection, idempotent approval, and audit reversals.

## Frontend Files Created / Modified
- `frontend/src/components/green/greenApi.ts`: Authenticated API & private evidence upload client (`POST /api/upload?scope=private`).
- `frontend/src/components/green/GreenPage.tsx`: Dark-coffee themed mobile/desktop UI with 5 tabs (`Home`, `Submit`, `History`, `Map & Edu`, `Admin`), full `ID | EN` bilingual support via `useLanguage()`, dynamic 7-category forms, real upload, plant monitoring, and admin verification queue.
- `frontend/app/(main)/green.tsx` & `frontend/app/(main)/green/admin.tsx`: Expo Router routes for `/green` and `/green/admin`.
- `frontend/app/(main)/_layout.tsx`: Registered `green` and `green/admin` stack screens (`headerShown: false`).
- `frontend/app/(main)/warkop.tsx`: Added **`NGOPI GREEN`** entry in the Coffee Lounge additional menu drawer.
