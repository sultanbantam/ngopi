import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('--- RUNNING SPRINT 10: PANDUAN HT (KONTEN + UI + OFFLINE) ---');
console.log('================================================================\n');

// -------------------------------------------------------------
// Test 1: Validasi File Halaman Panduan HT (Task 6.1 update1.md)
// -------------------------------------------------------------
console.log('Test 1: Validasi File Halaman Panduan HT dan 7 Bagian Utama (Task 6.1)');
const guidePath = path.resolve(__dirname, '../../frontend/app/(main)/guides/ht.tsx');
assert.strictEqual(fs.existsSync(guidePath), true, 'frontend/app/(main)/guides/ht.tsx harus ada');

const guideSource = fs.readFileSync(guidePath, 'utf-8');

// Verifikasi 7 struktur bagian sesuai Task 6.1
assert.ok(guideSource.includes('Pengenalan HT (Handy Talky)'), 'Bagian 1: Pengenalan HT harus ada');
assert.ok(guideSource.includes('VHF vs UHF'), 'Bagian 1 harus memuat penjelasan VHF vs UHF');

assert.ok(guideSource.includes('Legalitas Radio di Indonesia'), 'Bagian 2: Legalitas harus ada');
assert.ok(guideSource.includes('ORARI') && guideSource.includes('RAPI'), 'Bagian 2 harus mencakup ORARI dan RAPI');
assert.ok(guideSource.includes('UU No. 36 Tahun 1999'), 'Bagian 2 harus mencakup UU Telekomunikasi');

assert.ok(guideSource.includes('Cara Menggunakan HT di Ngopi'), 'Bagian 3: Cara Menggunakan HT harus ada');
assert.ok(guideSource.includes('PWA'), 'Bagian 3 harus memuat instalasi PWA');
assert.ok(guideSource.includes('Bluetooth') && guideSource.includes('USB Serial') && guideSource.includes('Akustik'), 'Bagian 3 harus memuat 3 mode HT');
assert.ok(guideSource.includes('145.500 MHz'), 'Bagian 3 harus memuat frekuensi standar');

assert.ok(guideSource.includes('Etika Berkomunikasi Radio'), 'Bagian 4: Etika harus ada');
assert.ok(guideSource.includes('CQ CQ CQ'), 'Bagian 4 harus memuat panggilan CQ');
assert.ok(guideSource.includes('Sandi 10'), 'Bagian 4 harus memuat sandi 10');

assert.ok(guideSource.includes('Frekuensi Penting di Indonesia'), 'Bagian 5: Frekuensi Penting harus ada');
assert.ok(guideSource.includes('145.000 MHz'), 'Bagian 5 harus memuat frekuensi darurat nasional');
assert.ok(guideSource.includes('433.000 MHz'), 'Bagian 5 harus memuat frekuensi UHF');

assert.ok(guideSource.includes('APRS (Automatic Packet Reporting)'), 'Bagian 6: APRS harus ada');
assert.ok(guideSource.includes('144.390 MHz') || guideSource.includes('Bell 202'), 'Bagian 6 harus memuat spesifikasi APRS');

assert.ok(guideSource.includes('Mode Darurat (Emergency / MAYDAY)'), 'Bagian 7: Mode Darurat harus ada');
assert.ok(guideSource.includes('MAYDAY') && guideSource.includes('PAN-PAN'), 'Bagian 7 harus memuat panggilan marabahaya');

console.log('  ✅ PASS: 7 Bagian utama Panduan HT lengkap dan terstruktur sesuai Task 6.1\n');

// -------------------------------------------------------------
// Test 2: Validasi Routing, Stack Screen & PWA Caching
// -------------------------------------------------------------
console.log('Test 2: Validasi Registrasi Route di _layout.tsx dan Service Worker Cache');
const layoutPath = path.resolve(__dirname, '../../frontend/app/(main)/_layout.tsx');
const layoutSource = fs.readFileSync(layoutPath, 'utf-8');
assert.ok(layoutSource.includes('name="guides/ht"'), '_layout.tsx harus meregistrasikan Stack.Screen guides/ht');

const swPath = path.resolve(__dirname, '../../frontend/public/service-worker.js');
const swSource = fs.readFileSync(swPath, 'utf-8');
assert.ok(swSource.includes("'/guides/ht'"), 'service-worker.js harus mem-precaching /guides/ht untuk akses offline');
console.log('  ✅ PASS: Route /guides/ht terdaftar di stack navigasi dan di-cache PWA offline\n');

// -------------------------------------------------------------
// Test 3: Validasi Menu Utama Dropdown (Task 8.1 update1.md)
// -------------------------------------------------------------
console.log('Test 3: Validasi Akses Panduan HT di Menu Utama Dropdown (Task 8.1)');
const contactsPath = path.resolve(__dirname, '../../frontend/app/(main)/contacts.tsx');
const contactsSource = fs.readFileSync(contactsPath, 'utf-8');

assert.ok(contactsSource.includes('Panduan HT'), 'Menu dropdown harus memiliki tautan ke Panduan HT');
assert.ok(contactsSource.includes('/(main)/guides/ht'), 'Tautan harus mengarah ke route /(main)/guides/ht');
assert.ok(contactsSource.includes('Gapleh (Level 1 & Level 2)'), 'Menu dropdown harus memiliki tautan Gapleh L1 & L2 (Task 8.1)');
console.log('  ✅ PASS: Menu dropdown utama mengintegrasikan Panduan HT dan Gapleh L1/L2 sesuai Task 8.1\n');

// -------------------------------------------------------------
// Test 4: Validasi Integrasi Modal Radio HT Langsung dari Panduan
// -------------------------------------------------------------
console.log('Test 4: Validasi Tombol Aksi Buka HT Langsung dari Halaman Panduan');
assert.ok(guideSource.includes('BluetoothHTModal'), 'Halaman panduan harus mengintegrasikan modal radio HT');
assert.ok(guideSource.includes('setHtModalOpen'), 'Harus ada fungsi pembuka modal HT interaktif');
console.log('  ✅ PASS: Pembaca dapat langsung mencoba radio HT dari halaman panduan\n');

console.log('================================================================');
console.log('--- ALL SPRINT 10 HT GUIDE TESTS PASSED (100%) ---');
console.log('================================================================');
