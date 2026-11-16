# NGOPI GREEN — Phase 0 Repository & Production-Safety Audit

**Date:** 2026-11-17  
**Branch:** `main`  
**Scope:** Direct integration into `ngopi.top` (`backend/` + `frontend/`), strictly reusing existing auth, Ngopi Points ledger, private upload pipeline, global `ID | EN` localization, and Warkop Coffee Lounge UI.

---

## 1. Actual Detected Stack & Versions
- **Backend (`backend/package.json`):**
  - Express + TypeScript (`tsx` / `ts-node`), `multer`, `helmet`, `cors`, `express-rate-limit`
  - **ORM & DB:** Prisma `v7.8.0` (`@prisma/client`, `@prisma/adapter-pg`) with **PostgreSQL** (`backend/prisma/schema.prisma`)
- **Frontend (`frontend/package.json`):**
  - Expo `~57.0.31`, Expo Router `~57.0.29`, React `19.2.3`, React Native `0.86.3`
  - UI & Media: `@expo/vector-icons`, `expo-image-picker ~57.0.20`, `react-native-webview` (Android wrapper loading `https://ngopi.top`)
  - Theme: Dark coffee palette (`frontend/src/theme/coffee.ts`)

---

## 2. Relevant Existing Files, Routes & Components
- **Backend Entry & Routes:** `backend/src/index.ts` (mounts `/api/auth`, `/api/upload`, `/api/ngopinomic`, `/api/cekkes`, etc.)
- **Frontend Navigation & Warkop:**
  - `frontend/app/(main)/_layout.tsx` (Stack routes + global `ID | EN` header button)
  - `frontend/app/(main)/warkop.tsx` (Coffee Lounge right-side drawer menu at lines ~1215–1300)
  - `frontend/app/(main)/ngopinomic.tsx` (Reference for dark-coffee dashboard cards, identity & points UI)

---

## 3. Authentication & RBAC Integration Point
- **Canonical User Auth:** `verifyJWT` and `AuthRequest` (`req.user.id`, `req.user.username`, `req.user.role`) in `backend/src/middleware/auth.middleware.ts`.
- **Canonical User Table:** `User` (`id String @id @default(uuid())`, `username`, `display_name`, `role`) in `backend/prisma/schema.prisma`.
- **Admin Authorization:** `requireDbRole('admin', 'superadmin')` in `backend/src/middleware/rbac.middleware.ts` (always queries PostgreSQL `User.role`, ignoring stale JWT claims).

---

## 4. Existing Ngopi Points Balance & Ledger Integration Point
- **Canonical Database Ledger:** `PointsAccount` & `PointsTransaction` (Prisma) managed via `earnPoints(tx, params)` in `backend/src/services/ngopinomic/ngopinomicEconomy.service.ts`:
  - Enforces positive integer amounts, `idempotency_key @unique` (preventing double-credit), `DAILY_POINTS_EARN_CAP`, and logs `FraudEvent` on duplicates.
- **Warkop Realtime / Legacy Balance Sync:** `pointsEconomyService` (`syncExternalCredit` & `syncWithPointsManager`) in `backend/src/services/points.service.ts` keeps Warkop's `☕ X Poin` display synchronized with PostgreSQL `PointsAccount`.
- **Mapping Decision:** NGOPI GREEN will **never** create a parallel wallet. Every approved submission credits `PointsAccount` via `earnPoints` inside a Prisma `$transaction` using idempotency key `green_approve_<submissionId>`, then syncs `pointsEconomyService.syncExternalCredit(...)`. Reversals post a compensating negative `PointsTransaction` + audit log.

---

## 5. Database & Migration Approach
- **Provider:** PostgreSQL via Prisma (`backend/prisma/migrations/`).
- **Approach:** Strictly additive migrations (new `green_*` tables referencing `User.id` and `PointsTransaction.id` without altering or dropping existing production tables).
- **Planned Entities:**
  - `GreenActivityCategory` (`green_activity_categories`)
  - `GreenActivityType` (`green_activity_types`)
  - `GreenEmissionFactor` (`green_emission_factors`)
  - `GreenRewardRule` (`green_reward_rules`)
  - `GreenSubmission` (`green_submissions`)
  - `GreenEvidence` (`green_evidence`)
  - `GreenVerification` (`green_verifications`)
  - `GreenImpactRecord` (`green_impact_records`)
  - `GreenEnvironmentReport` (`green_environment_reports`)
  - `GreenPlant` (`green_plants`) & `GreenPlantMonitoring` (`green_plant_monitoring`)
  - `GreenChallenge` (`green_challenges`) & `GreenChallengeMember` (`green_challenge_members`)
  - `GreenAuditLog` (`green_audit_logs`)

---

## 6. Upload & Storage Integration Point
- **Existing Endpoint:** `POST /api/upload?scope=private` (`backend/src/routes/upload.routes.ts` & `upload.controller.ts`):
  - Enforces `verifyJWT`, `uploadLimiter`, `validateExtensionAndMime` (safe image/doc/video MIME & extension check), `MAX_UPLOAD_BYTES` (default 25 MB), and stores files in `private_uploads/<userId>/` with randomized safe filenames.
  - Private files are served only to authenticated authorized users via `GET /api/upload/private/:ownerId/:filename`.
- **Integration:** NGOPI GREEN evidence uploads will use `POST /api/upload?scope=private` and record SHA-256 file hash + metadata in `green_evidence` for duplicate-evidence detection.

---

## 7. Localization (`ID | EN`) Approach
- **Existing System:** `LanguageProvider` & `useLanguage()` (`lang: 'id' | 'en'`, `t(id, en)`) in `frontend/src/utils/i18n.tsx`, persisted in `ngopi_lang` (`localStorage` / `SecureStore`) and synchronized with the global `EN | id` header button.
- **Integration:** All NGOPI GREEN routes (`/green`, `/green/admin`, etc.) will use `useLanguage()` + a dedicated bilingual dictionary (`frontend/src/components/green/greenI18n.ts`) with zero hardcoded single-language strings.

---

## 8. Warkop Menu Integration Point
- **File:** `frontend/app/(main)/warkop.tsx` (right-side Coffee Lounge drawer around line 1252, right alongside `NGOPINOMIC`, `ceKKes`, and `Merchant Dashboard`).
- **Entry:** Add **`NGOPI GREEN`** card with leaf icon (`leaf-outline`), localized `ID` / `EN` subtitle, and navigation to `/(main)/green`.

---

## 9. Risks & Constraints
1. **No Fake Points / No Client-Side Credit:** Submissions start as `pending` (`0` points). Points are awarded **only** server-side upon admin/moderator verification.
2. **Evidence Privacy:** Private GPS coordinates and evidence URLs must not be exposed publicly or to other non-admin users.
3. **Carbon Honesty:** Separate `actual_emissions_kgco2e`, `baseline_emissions_kgco2e`, `avoided_emissions_kgco2e`, and `sequestered_carbon_kgco2e` (never claim instant sequestration at tree planting; return `not_calculated` when no valid factor exists).
4. **Environment Variables (by name only):** `DATABASE_URL`, `JWT_SECRET`, `MAX_UPLOAD_BYTES`, `CORS_ORIGIN`.

---

## 10. Phased Implementation Plan
- **Phase A (Foundation):** Prisma schema & additive migration (`green_*` tables), idempotent seed for 7 categories + activity types + versioned emission factors + reward rules, `/green` route + Warkop drawer entry, bilingual shell.
- **Phase B (Working Submissions & Evidence):** Dynamic 7-category submission form, real evidence upload (`POST /api/upload?scope=private`), SHA-256 duplicate check, persisted history + status filters.
- **Phase C (Admin Verification & Canonical Points):** Server-side RBAC (`requireDbRole('admin', 'superadmin')`) review queue, approve/reject/needs-info/reverse with required reason, atomic `earnPoints` + `pointsEconomyService.syncExternalCredit` + `GreenAuditLog`.
- **Phase D (Transparent Carbon & Impact Engine):** Versioned calculation engine (`greenImpact.service.ts`) + Impact summary & Education/Methodology view.
- **Phase E (Eco Map, Plants & Challenges):** Environmental reports map/list view, plant registry & follow-up monitoring, challenges & privacy-respecting leaderboard.
- **Verification:** `tsx` integration & unit tests (auth, IDOR, submission validation, idempotent points, carbon math), `tsc --noEmit`, and production web build.
