# NGOPI — FINAL SECURITY CLOSURE REPORT (WAVE 0A – STAGE C)

- **Document ID:** `NGOPI-SEC-CLOSURE-W0A-C-2026-11-14`
- **Scope:** Wave 0A (`5f47698`) through Stage C (AI Agent Remediation)
- **Baseline:** `5b0f281` (`v1.1.0-mail-read-unread`)
- **Final Security Verdict:** **`CLOSED (IN-SCOPE WAVE 0A–STAGE C) / READY WITH CONDITIONS`**

> [!NOTE]
> All Wave 0A, Stage A, Stage B1A–B1E, Stage B2B (real PostgreSQL 16), and Stage C security controls are implemented and verified. Unrelated pre-existing findings outside the Wave 0A–Stage C scope are documented transparently in Section 4.

---

## 1. Stage C — AI Agent Remediation Summary

### Files Remediated
- [ai.routes.ts](file:///c:/Users/dummy/Documents/Projects/ngopi/backend/src/routes/ai.routes.ts)
- [agent.controller.ts](file:///c:/Users/dummy/Documents/Projects/ngopi/backend/src/controllers/agent.controller.ts)
- [agent.service.ts](file:///c:/Users/dummy/Documents/Projects/ngopi/backend/src/services/agent.service.ts)
- [wave0a_security.test.ts](file:///c:/Users/dummy/Documents/Projects/ngopi/backend/tests/wave0a_security.test.ts)
- [stage_c_security.test.ts](file:///c:/Users/dummy/Documents/Projects/ngopi/backend/tests/stage_c_security.test.ts) (new)

### Controls Enforced
1. **DB-Backed RBAC on All AI Agent Routes:**
   - `POST /api/ai/agent/execute` → `verifyJWT, aiLimiter, requireDbUser`
   - `POST /api/ai/agent/chat` → `verifyJWT, aiLimiter, requireDbUser`
   - `GET /api/ai/agent/status` → `verifyJWT, aiLimiter, requireDbMerchant`
   - `POST /api/ai/agent/toggle` → `verifyJWT, aiLimiter, requireDbAdmin` (global toggle strictly restricted to DB `admin` / `superadmin`).
2. **Elimination of Hardcoded `m_warkop_sahabat` Exemptions & Fallbacks:**
   - Removed `cleanCafeId !== 'm_warkop_sahabat'` ownership bypass and `cafeId: cleanCafeId || 'm_warkop_sahabat'` fallback in `AgentController.execute` and `AgentController.chat`.
   - Removed `'m_warkop_sahabat'` default parameters and `'usr_guest'` fallback in `AgentService`.
   - User concierge mode (`user_concierge_cafe`) now reads public partners via `MerchantService.listPartners()` (read-only) instead of calling `createPromo('m_warkop_sahabat', 20)`.
   - Background daemon skips showcase profiles (`!p.is_showcase`) and calls `.unref()` on its interval timer.
3. **Merchant & Cafe Ownership Verification:**
   - `resolveAuthorizedMerchantCafeId()` resolves the target `MerchantProfile` from PostgreSQL, rejecting showcase profiles (`403`), unapproved/pending/rejected/deleted profiles (`403`/`404`), and cross-merchant IDOR (`403`), and failing closed on DB errors (`500`).
   - Merchant-only triggers (`low_traffic`, `ambience_autopilot`, `mou_automation`, `supply_chain_autopilot`) are blocked (`403`) for regular users even if `role` is omitted from the request body, while verified merchants calling from `MerchantDashboardModal.tsx` (which omits `role`) succeed (`200`).

---

## 2. Final Security Audit Matrix (Wave 0A – Stage C)

| Control Domain | Verification & Implementation Evidence | Status |
|---|---|---|
| **Authentication & JWT Expiration** | `verifyJWT` (`auth.middleware.ts`) enforces `jwt.verify()` without `ignoreExpiration: true`, validates `token_type === 'access'`, and supports `JWT_ISSUER`/`JWT_AUDIENCE`. | **PASS** |
| **DB-Backed RBAC & Anti-Escalation** | `requireDbUser`, `requireDbMerchant`, `requireDbAdmin`, `requireDbSuperadmin` (`rbac.middleware.ts`) resolve `User.role` from PostgreSQL on every request, ignoring stale JWT claims. | **PASS** |
| **IDOR & Identity Spoofing** | `extractUser()`, `'usr_partner_1'`, and header/body/query `userId` fallbacks removed across `merchant.controller.ts`, `partnership.controller.ts`, and `agent.controller.ts`. | **PASS** |
| **Rate Limiting** | `apiLimiter` global (`/api`), `aiLimiter` (`/api/ai/*`), `uploadLimiter` (`/api/upload`), and `checkinLimiter` (`20/min` on `/api/merchant/checkin`). | **PASS** |
| **Upload Validation & Static Serving** | `fileSecurity.ts` + `upload.controller.ts` + `index.ts`: magic-byte verification, `.html`/`.svg`/`.php`/`.exe` blocked (`400`), `nosniff` + `Content-Disposition: attachment` for non-media, private file owner-only access (`401`/`403`). | **PASS** |
| **Public / Private Data Exposure** | `sanitizePublicMerchant()` allowlist DTO strips `user_id`, `supporting_docs`, `reviewed_by`, `reviewed_at`, `rejection_reason`, `review_status`, and `reviewAudits`; `getPublicCafeByTokenOrId()` hides pending/rejected/deleted profiles. | **PASS** |
| **Merchant Ownership & Lifecycle** | `registerApplication` & `verifyAndSignAgreement` keep `User.role = 'user'` and `review_status = 'pending'`. Approval/rejection runs atomically in `prisma.$transaction` with `updateMany` concurrency guard, self-review block (`403`), and `MerchantReviewAudit` (`ON DELETE RESTRICT`). | **PASS** |
| **Showcase Isolation** | `m_warkop_sahabat`, `m_kenangan_senja`, `m_barista_corner` remain `user_id = null, is_showcase = true` read-only; blocked from admin review (`403`), dashboard mutations (`403`), and merchant AI execution (`403`). | **PASS** |
| **AI Agent Access Control** | Stage C (`ai.routes.ts`, `agent.controller.ts`, `agent.service.ts`) closes all IDOR, showcase targeting, and `/agent/toggle` privilege gaps (`stage_c_security.test.ts` 8/8 PASS). | **PASS** |

---

## 3. Identity & Policy Invariants

- **Founder `#0` (`warung@ngopi.top`, `ngopi`/`founder`/`bmc_id = 1`):** Preserved as `superadmin`; never downgraded by merchant approval.
- **`warung` `#100`:** Preserved as `user`; blocked from `/api/merchant/dashboard`, `/api/merchant/admin/*`, and `/api/ai/agent/toggle`.
- **Showcase Cafes (`m_warkop_sahabat`, `m_kenangan_senja`, `m_barista_corner`):** Public read-only (`user_id = null`, `is_showcase = true`).

---

## 4. Residual Findings Outside Wave 0A–Stage C Scope (Informational)

The following pre-existing patterns exist in unrelated modules not modified by Wave 0A–Stage C and are documented for future hardening (Stage D / Maintenance):
1. **`backend/src/routes/album.routes.ts:14`:** Still defines a local `extractUser(req)` helper using header/fallback parsing for album routes.
2. **`backend/src/sockets/index.ts:128-132`:** Socket.IO auth middleware still contains a `TokenExpiredError` `ignoreExpiration: true` fallback for websocket handshakes.
3. **Pre-existing `tsc --noEmit` errors:** Unrelated modules (`games/`, `chessPro.service.ts`, `bmc.routes.ts`, `emergency.routes.ts`, `event.routes.ts`, `leaderboard.routes.ts`, `mesh.routes.ts`, `moderation.routes.ts`, `og.routes.ts`, `pokemon.routes.ts`, `ai.service.ts`, `points.service.ts`, `group.controller.ts`, `message.controller.ts`, `ticket.controller.ts`) have pre-existing TypeScript errors; `ngopi-api` runs via `ts-node` (`transpileOnly: true`). **Zero TypeScript errors exist in any Wave 0A–Stage C modified file.**

