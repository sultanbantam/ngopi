# NGOPI — Wave 0A Independent Security Review

- **Document ID:** `NGOPI-SEC-REVIEW-WAVE0A-2026-11-13`
- **Reviewer Role:** Independent Security Auditor
- **Reviewed Baseline:** Branch `main`, HEAD `5b0f281`, Local Milestone Tag `v1.1.0-mail-read-unread`
- **Reviewed Report:** `docs/security/NGOPI_WAVE_0A_SECURITY_HARDENING.md`

---

## 1. Executive Summary

Implementasi **Wave 0A Security Hardening** berhasil menutup kerentanan **Critical/High** utama pada endpoint `/api/ai/agent/*` (sebelumnya tanpa autentikasi, rentan spoofing `userId`, dan rentan eskalasi role) serta kerentanan **Stored XSS / Active Content** pada `/api/upload` dan `/uploads` (penghapusan `text/html` & `image/svg+xml`, validasi pairing ekstensi + MIME, verifikasi magic bytes, UUID filename, anti path traversal, dan isolasi `?scope=private`).

Namun, audit independen terhadap kode aktual dan konsumen frontend menemukan **2 temuan Medium** dan **2 temuan Low** yang perlu ditindaklanjuti (khususnya dukungan aman untuk MIME fallback `application/octet-stream` dari mobile DocumentPicker dan pembatasan akses `/api/ai/agent/status`) sebelum disetujui untuk commit dan deployment production.

---

## 2. Git Status & Scope Perubahan

- **Branch / HEAD:** `main` pada `5b0f281` (`v1.1.0-mail-read-unread`, tag lokal).
- **Modified Tracked Files (5 file, seluruhnya dalam cakupan Wave 0A):**
  - `backend/src/routes/ai.routes.ts`
  - `backend/src/controllers/agent.controller.ts`
  - `backend/src/routes/upload.routes.ts`
  - `backend/src/controllers/upload.controller.ts`
  - `backend/src/index.ts`
- **New Untracked Code/Test/Doc Files (Wave 0A):**
  - `backend/src/utils/fileSecurity.ts`
  - `backend/tests/wave0a_security.test.ts`
  - `docs/security/NGOPI_WAVE_0A_SECURITY_HARDENING.md`
- **Catatan Kebersihan Workspace (Low):** Terdapat folder untracked `uploads/` di root workspace (`git status -s`) serta beberapa file untracked lama (`1.png`–`10.png`, `prompt-*.md`, `docs/*`). Tidak ada perubahan pada `prisma/schema.prisma`, `telecom_store.json`, ataupun kode frontend.

---

## 3. Temuan Keamanan AI (`/api/ai/agent/*`)

### Yang Sudah Terverifikasi Kuat
- `backend/src/routes/ai.routes.ts:16-19`: Keempat route (`/execute`, `/status`, `/toggle`, `/chat`) terlindungi `verifyJWT` dan `aiLimiter`. `/toggle` terlindungi `requireMerchant` (`merchant | admin | superadmin`).
- `backend/src/controllers/agent.controller.ts:28-39`: `userId` diambil eksklusif dari `authUser.id` (`req.user`), spoofing `req.body.userId` ditolak `403`, eskalasi `role: 'merchant'` oleh user biasa ditolak `403`.
- `backend/src/controllers/agent.controller.ts:41-50`: `trigger` divalidasi allowlist, `customPrompt` / `message` dibatasi `2000` karakter, error log tidak mencetak prompt/token.

### Temuan Baru
- **[MEDIUM] `AgentController.getStatus` Mengembalikan Status Global Agen ke User Reguler (`backend/src/controllers/agent.controller.ts:81-91` & `ai.routes.ts:17`):**
  - Route `GET /api/ai/agent/status` mengizinkan user biasa (`role: 'user'`) membaca `AgentService.getStatus()` (log & metrik intervensi otonom merchant/platform) selama sudah login.
  - **Rekomendasi:** Terapkan `requireMerchant` pada `GET /api/ai/agent/status` atau filter response agar user reguler hanya menerima `{ running: boolean }` tanpa log operasional merchant.

---

## 4. Temuan Keamanan Upload (`/api/upload` & `/uploads`)

### Yang Sudah Terverifikasi Kuat
- `backend/src/utils/fileSecurity.ts:4-10, 68-94`: `.html`, `.htm`, `.svg`, `.js`, `.php`, `.exe`, dll. diblokir; `validateExtensionAndMime` mewajibkan kecocokan **AND** antara ekstensi dan MIME.
- `backend/src/utils/fileSecurity.ts:96-198` & `upload.controller.ts:20-27`: Verifikasi magic bytes dijalankan setelah upload; file yang tidak cocok langsung dihapus (`fs.unlinkSync`) dan dikembalikan `400`.
- `backend/src/routes/upload.routes.ts:36-39`: Nama file disk selalu dibuat server-side (`Date.now()-UUID.ext`).
- `backend/src/controllers/upload.controller.ts:105-149`: `downloadPrivateFile` memvalidasi `verifyJWT`, `resolveSafeChildPath`, kepemilikan `ownerId === authUser.id` (atau admin), dan mengatur `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, serta `Content-Disposition: attachment`.
- `backend/src/index.ts:83-97`: Static serving `/uploads` menambahkan `X-Content-Type-Options: nosniff` dan `Content-Disposition: attachment` untuk dokumen non-media.

### Temuan Baru
- **[MEDIUM] Potensi Penolakan Upload Dokumen Mobile dengan MIME `application/octet-stream` (`backend/src/utils/fileSecurity.ts:11-64`):**
  - Sebagian perangkat Android/iOS (`DocumentPicker` pada `NgopiTelecomMailModal.tsx:1298` / `chat/[id].tsx`) mengirimkan MIME `application/octet-stream` untuk file `.pdf`, `.docx`, `.xlsx`, atau `.zip`. Karena `EXTENSION_TO_MIMES` tidak mengizinkan `application/octet-stream`, upload dokumen sah dari device tersebut akan ditolak `400`.
  - **Rekomendasi:** Izinkan `application/octet-stream` **khusus** untuk ekstensi dokumen/arsip yang memiliki verifikasi magic-byte kuat (`.pdf`, `.docx`, `.xlsx`, `.pptx`, `.zip`, `.rar`, `.7z`, `.doc`, `.xls`, `.ppt`) karena `verifyMagicBytes` tetap memverifikasi header biner sebenarnya.
- **[LOW] Risiko File Publik Lama & Lampiran Mail v1 (`uploads/` & `NgopiTelecomMailModal.tsx:1309`):**
  - File lama yang sudah terunggah ke `uploads/` sebelum Wave 0A (jika pernah ada `.html` atau `.svg`) kini tetap dilayani dengan `X-Content-Type-Options: nosniff` dan `Content-Disposition: attachment` (dimitigasi dari inline XSS), namun URL publik `/uploads/*` tetap dapat diakses tanpa JWT hingga migrasi ke Private File Vault (Wave 3).
  - Selain itu, `NgopiTelecomMailModal.tsx:1309` masih memanggil `POST /api/upload` tanpa `?scope=private` sehingga lampiran email baru tetap masuk ke folder publik `/uploads` selama frontend belum diarahkan ke private vault.

---

## 5. Temuan Kompatibilitas Frontend

- **`NgopAIFloatingAgent.tsx` (lines 136, 220) & `MerchantDashboardModal.tsx` (line 85):** Keduanya sudah mengirim `headers = await getAuthHeaders()` (`Authorization: Bearer ...`) saat memanggil `/api/ai/agent/execute` dan `/api/ai/agent/chat`. Penambahan `verifyJWT` **kompatibel** untuk user yang sudah login.
- **`profileUpload.ts` (line 20) & `chat/[id].tsx` (lines 798, 942):** Upload avatar (`.jpg`, `.png`, `.webp`) dan voice note (`upload.webm` dengan `audio/webm`) cocok dengan `EXTENSION_TO_MIMES` dan `verifyMagicBytes` — **kompatibel**.
- **`NgopiTelecomMailModal.tsx` (line 1309):** Kompatibel untuk gambar/video/dokumen dengan MIME standar, namun berisiko gagal (`400`) pada device mobile yang mengirim `application/octet-stream` (lihat temuan Medium di atas).

---

## 6. Hasil Pengujian Aktual (Dijalankan Ulang Saat Audit)

| Perintah Uji | Hasil Aktual | Catatan |
| :--- | :---: | :--- |
| `npx --prefix backend tsx backend/tests/wave0a_security.test.ts` (`BypassSandbox: true`) | **9/9 PASS** | Menguji auth AI, anti-IDOR, role escalation, upload `.html/.svg/.php/.exe`, fake PNG magic bytes, oversized, path traversal, public/private upload & isolation |
| `npx --prefix backend tsx backend/tests/telecom_identity.test.ts` | **16/16 PASS** | Menguji Founder `#0`, nomor unik, order, webhook HMAC, BRI proof, dan Email Read/Unread |
| `npx --prefix backend tsc --noEmit -p backend/tsconfig.json \| Select-String "<wave0a files>"` | **0 error** | Seluruh file Wave 0A bersih dari error TypeScript *(file lama di luar Wave 0A masih memiliki error TS pre-existing)* |

---

## 7. Daftar Risiko yang Belum Terselesaikan

1. **MIME `application/octet-stream` pada Mobile DocumentPicker** dapat menolak upload PDF/DOCX/ZIP sah dari sebagian HP Android/iOS.
2. **Global Status Exposure** pada `GET /api/ai/agent/status` bagi user non-merchant.
3. **Private Email Attachments Belum Aktif Secara Default** di `NgopiTelecomMailModal.tsx` (lampiran email baru masih mengarah ke `/uploads` publik sampai penyesuaian frontend / Wave 3 R2/S3 Vault).
4. **Live Voice/Video Call E2E** belum termasuk cakupan pengujian otomatis Wave 0A.

---

## 8. Keputusan Akhir

### **Keputusan:** **`NEEDS FIXES`** *(Minor Fixes Sebelum Commit & Deployment)*

Implementasi Wave 0A sudah solid secara arsitektur dan menutup celah kritis dengan sangat baik, namun **perlu 2 perbaikan ringan sebelum commit & deploy**:
1. Izinkan fallback `application/octet-stream` pada `validateExtensionAndMime` **khusus** untuk ekstensi dokumen/arsip yang diverifikasi magic bytes (`.pdf`, `.docx`, `.xlsx`, `.pptx`, `.zip`, `.rar`, `.7z`, `.doc`, `.xls`, `.ppt`) agar tidak memutus upload dokumen dari HP.
2. Terapkan `requireMerchant` (atau filter output) pada `GET /api/ai/agent/status` agar user reguler tidak membaca log operasional global merchant, lalu bersihkan folder untracked `uploads/` di root workspace sebelum commit.

*(Audit selesai tanpa mengubah kode apa pun. Menunggu persetujuan eksplisit Anda untuk menerapkan kedua perbaikan di atas.)*

