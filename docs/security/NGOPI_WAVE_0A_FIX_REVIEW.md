# NGOPI — Wave 0A Fix Review (Mobile Upload Compatibility & AI Status Access)

- **Document ID:** `NGOPI-SEC-FIX-WAVE0A-2026-11-13`
- **Reference Audit:** `docs/security/NGOPI_WAVE_0A_INDEPENDENT_REVIEW.md`
- **Implementation State:** **Local Only** (No commit, no push, no deployment, no DB changes)

---

## 1. Perubahan yang Dilakukan

1. **FIX 1 — Mobile Document Upload Compatibility (`backend/src/utils/fileSecurity.ts`):**
   - Menambahkan `'application/octet-stream'` **secara selektif** pada `EXTENSION_TO_MIMES` hanya untuk 10 ekstensi dokumen/arsip yang memiliki verifikasi magic-byte biner kuat:
     `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.zip`, `.rar`, `.7z`.
   - Gambar (`.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`, `.heic`, `.heif`), audio, video, teks, dan ekstensi aktif berbahaya (`.html`, `.svg`, `.js`, `.php`, `.exe`, dll.) tetap **menolak** `application/octet-stream`.
   - `verifyUploadedFileSignature` tetap dijalankan setelah upload; jika magic bytes tidak cocok dengan ekstensi, file dihapus dan request ditolak **HTTP 400**.
2. **FIX 2 — AI Agent Global Status Access (`backend/src/routes/ai.routes.ts`, `backend/src/controllers/agent.controller.ts`):**
   - Menambahkan middleware `requireMerchant` pada `GET /api/ai/agent/status` (`verifyJWT`, `aiLimiter`, `requireMerchant`).
   - Menambahkan pemeriksaan RBAC di `AgentController.getStatus` (`hasRole(authUser.role, ['merchant', 'admin', 'superadmin'])`) berbasis role JWT terverifikasi (`req.user`), mengembalikan **HTTP 403** untuk user biasa.
3. **Regression Tests (`backend/tests/wave0a_security.test.ts`):**
   - Memperbarui test #2 untuk memverifikasi `GET /api/ai/agent/status` (`user -> 403`, `spoof ?role=merchant -> 403`, `merchant -> 200`).
   - Menambahkan test #10 untuk memverifikasi upload `application/octet-stream` pada `.pdf`, `.docx`, `.zip` valid (`200`), serta penolakan (`400`) pada `fake.pdf`, `image.png`, `page.html`, dan `icon.svg` dengan `application/octet-stream`.

---

## 2. Hasil Test Sebelum dan Sesudah

| Pengujian | Sebelum Fix | Sesudah Fix |
| :--- | :---: | :---: |
| `npx --prefix backend tsx backend/tests/wave0a_security.test.ts` (`BypassSandbox: true`) | **9/9 PASS** | **10/10 PASS** |
| `npx --prefix backend tsx backend/tests/telecom_identity.test.ts` | **16/16 PASS** | **16/16 PASS** |
| TypeScript Check (`tsc --noEmit` filter file Wave 0A) | **0 error** | **0 error** *(file lama di luar Wave 0A tetap memiliki error pre-existing)* |

---

## 3. Bukti Pembatasan Akses AI Status

Dari eksekusi aktual `wave0a_security.test.ts` (Test #1 & #2):
- Tanpa token (`GET /api/ai/agent/status`) → **HTTP 401** (`Access denied. No token provided.`)
- Token user biasa (`role: 'user'`) → **HTTP 403** (`Forbidden. Insufficient role.`)
- Token user biasa dengan spoofing `?role=merchant` → **HTTP 403**
- Token merchant terautentikasi (`role: 'merchant'`) → **HTTP 200** (`{ success: true, ...status }`)

---

## 4. Bukti Kompatibilitas Upload Mobile

Dari eksekusi aktual `wave0a_security.test.ts` (Test #10):
- `contract.pdf` (`application/octet-stream` + header `%PDF-1.4`) → **HTTP 200**
- `proposal.docx` (`application/octet-stream` + header ZIP `PK\x03\x04`) → **HTTP 200**
- `archive.zip` (`application/octet-stream` + header ZIP `PK\x03\x04`) → **HTTP 200**
- `fake.pdf` (`application/octet-stream` + `<script>alert(1)</script>`) → **HTTP 400**
- `image.png` (`application/octet-stream` + PNG bytes) → **HTTP 400**
- `page.html` (`application/octet-stream` + `<html>...`) → **HTTP 400**
- `icon.svg` (`application/octet-stream` + `<svg...>`) → **HTTP 400**

---

## 5. Hasil Pemeriksaan Folder `uploads/` di Root Workspace

Pemeriksaan `Get-ChildItem -Force -Recurse uploads` menemukan **1 file saja**:
- **Path:** `C:\Users\dummy\Documents\Projects\ngopi\uploads\ht_store.json`
- **Ukuran:** `1.673 bytes`
- **Timestamp:** `11/13/2026 2:37:11 PM`
- **Identifikasi:** Bukan data pengguna maupun aset aplikasi; file ini adalah **artefak runtime otomatis** dari `HTService` ketika skrip test backend dijalankan dari direktori root workspace (`process.cwd()`).
- **Tindakan & Rekomendasi:** Folder/file **tidak dihapus** pada tahap ini sesuai aturan. **Rekomendasi:** Hapus folder `uploads/` di root workspace (dan/atau tambahkan `uploads/` ke `.gitignore`) sebelum melakukan commit agar tidak ada file runtime test yang ikut ter-track di Git.

---

## 6. Risiko yang Masih Tersisa

1. **Lampiran Email v1 (`NgopiTelecomMailModal.tsx:1309`)** masih menggunakan endpoint default `/api/upload` (scope publik `/uploads/`) hingga frontend diarahkan ke `?scope=private` / Private File Vault (Wave 3 R2/S3).
2. **File Publik Lama di VPS `/opt/ngopi/backend/uploads/`** tetap dapat diakses lewat URL langsung, meskipun risiko inline XSS sudah dimitigasi melalui header `X-Content-Type-Options: nosniff` dan `Content-Disposition: attachment`.
3. **Live Voice/Video Call E2E** tetap di luar cakupan pengujian otomatis lokal Wave 0A.

---

## 7. Status Akhir

### **`READY FOR COMMIT REVIEW`**

Kedua temuan **MEDIUM** dari audit independen telah diperbaiki secara lokal, seluruh 10 skenario test keamanan Wave 0A dan 16 skenario telecom lulus penuh, serta `uploads/ht_store.json` telah teridentifikasi aman untuk dibersihkan atas persetujuan Anda. Menunggu persetujuan berikutnya sebelum commit/push/deploy. ☕

---

## 8. Hasil Verifikasi Terakhir (Final Verification — 13 Nov 2026 16:51 WIB)

### 8.1 TypeScript Verification (`backend/tsconfig.json`)
- **Konfigurasi:** `backend/tsconfig.json` menggunakan `"strict": true`, `"noUncheckedIndexedAccess": true`, `"rootDir": "./src"`, `"include": ["src/**/*"]`, serta `"ts-node": { "transpileOnly": true }` (selaras dengan cara PM2 menjalankan `src/index.ts` di production).
- **Command:** `cd backend; .\node_modules\.bin\tsc --noEmit`
- **Exit Code:** **`1`** (Gagal lulus global typecheck karena **error TypeScript pre-existing** pada file lama di luar cakupan Wave 0A).
- **Rincian Output:** Seluruh error berasal dari file lama (`group.controller.ts`, `merchant.controller.ts`, `message.controller.ts`, `partnership.controller.ts`, `ticket.controller.ts`, `games/pokemon/PokemonGame.ts`, `games/TableManager.ts`, `games/truf/TrufGame.ts`, `bmc.routes.ts`, `emergency.routes.ts`, `moderation.routes.ts`, `og.routes.ts`, `pokemon.routes.ts`, `ai.service.ts`, `chessPro.service.ts`, `event.service.ts`, `merchant.service.ts`, `partnership.service.ts`, `points.service.ts`).
- **Status File Wave 0A:** **Tidak ada satu pun error** yang dilaporkan pada `src/utils/fileSecurity.ts`, `src/routes/ai.routes.ts`, `src/controllers/agent.controller.ts`, `src/routes/upload.routes.ts`, `src/controllers/upload.controller.ts`, maupun `src/index.ts`.

### 8.2 Regression Tests
| Perintah | Exit Code | Hasil Aktual |
| :--- | :---: | :--- |
| `npx --prefix backend tsx backend/tests/wave0a_security.test.ts` (`BypassSandbox: true`) | **`0`** | **10/10 PASS** (`ALL 10 WAVE 0A SECURITY REGRESSION TESTS PASSED!`) |
| `npx --prefix backend tsx backend/tests/telecom_identity.test.ts` | **`0`** | **16/16 PASS** (`ALL 16 TESTS PASSED SUCCESSFULLY!`) |

### 8.3 Git Scope & Kebersihan
- **Branch / HEAD:** `main` / `5b0f281` (`v1.1.0-mail-read-unread` lokal)
- **Modified (5 file):** `backend/src/controllers/agent.controller.ts`, `backend/src/controllers/upload.controller.ts`, `backend/src/index.ts`, `backend/src/routes/ai.routes.ts`, `backend/src/routes/upload.routes.ts`
- **New Wave 0A Files:** `backend/src/utils/fileSecurity.ts`, `backend/tests/wave0a_security.test.ts`, `docs/security/*`
- **`uploads/ht_store.json`:** **Masih ada** (`True`), tidak dihapus.

### 8.4 Keputusan Final Verifikasi
- **`READY FOR COMMIT REVIEW`** *(dengan catatan jujur bahwa `tsc --noEmit` global backend masih ber-exit code `1` akibat error pre-existing pada modul lain di luar Wave 0A, sedangkan seluruh file Wave 0A bersih dan seluruh 26 test regresi lulus dengan exit code `0`).*


