import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('--- RUNNING SPRINT 11: PANDUAN P3K (KONTEN + UI + OFFLINE) ---');
console.log('================================================================\n');

// -------------------------------------------------------------
// Test 1: Validasi Schema Prisma untuk Emergency (Task 7.3 update1.md)
// -------------------------------------------------------------
console.log('Test 1: Validasi Database Schema EmergencyContact & EmergencyLog (Task 7.3)');
const prismaSchemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
assert.strictEqual(fs.existsSync(prismaSchemaPath), true, 'prisma/schema.prisma harus ada');

const schemaContent = fs.readFileSync(prismaSchemaPath, 'utf-8');
assert.ok(schemaContent.includes('model EmergencyContact'), 'Prisma harus memiliki model EmergencyContact');
assert.ok(/phone\s+String/.test(schemaContent), 'EmergencyContact harus memiliki field phone');
assert.ok(/is_primary\s+Boolean/.test(schemaContent), 'EmergencyContact harus memiliki is_primary');

assert.ok(schemaContent.includes('model EmergencyLog'), 'Prisma harus memiliki model EmergencyLog');
assert.ok(/type\s+String/.test(schemaContent), 'EmergencyLog harus memiliki field type');
assert.ok(/status\s+String/.test(schemaContent), 'EmergencyLog harus memiliki status');
assert.ok(/responded_by\s+String\[\]/.test(schemaContent), 'EmergencyLog harus memiliki responded_by');
console.log('  ✅ PASS: Model EmergencyContact dan EmergencyLog di Prisma schema valid sesuai Task 7.3\n');

// -------------------------------------------------------------
// Test 2: Validasi 10 Modul Lengkap Panduan P3K (Task 7.1)
// -------------------------------------------------------------
console.log('Test 2: Validasi 10 Modul Lengkap Panduan P3K di first-aid.tsx (Task 7.1)');
const firstAidPath = path.resolve(__dirname, '../../frontend/app/(main)/guides/first-aid.tsx');
assert.strictEqual(fs.existsSync(firstAidPath), true, 'frontend/app/(main)/guides/first-aid.tsx harus ada');

const firstAidSource = fs.readFileSync(firstAidPath, 'utf-8');

// 1. Prinsip Dasar P3K (DRSABCD)
assert.ok(firstAidSource.includes('Prinsip Dasar P3K (DRSABCD)'), 'Modul 1: DRSABCD harus ada');
assert.ok(firstAidSource.includes('Danger') && firstAidSource.includes('Response'), 'Modul 1 harus memuat urutan DRSABCD');

// 2. Kecelakaan Lalu Lintas
assert.ok(firstAidSource.includes('Kecelakaan Lalu Lintas'), 'Modul 2: Kecelakaan Lalu Lintas harus ada');
assert.ok(firstAidSource.includes('tulang belakang') || firstAidSource.includes('helm'), 'Modul 2 harus memuat peringatan cedera leher/helm');

// 3. Luka Bakar (derajat 1/2/3)
assert.ok(firstAidSource.includes('Luka Bakar'), 'Modul 3: Luka Bakar harus ada');
assert.ok(firstAidSource.includes('pasta gigi') || firstAidSource.includes('mentega'), 'Modul 3 harus melarang pasta gigi/mentega');

// 4. CPR / RJP
assert.ok(firstAidSource.includes('Serangan Jantung & CPR') || firstAidSource.includes('RJP'), 'Modul 4: CPR harus ada');
assert.ok(firstAidSource.includes('100 - 120') || firstAidSource.includes('Stayin'), 'Modul 4 harus memuat rasio/ritme kompresi');

// 5. Tersedak (Heimlich)
assert.ok(firstAidSource.includes('Tersedak (Heimlich Maneuver)'), 'Modul 5: Tersedak Heimlich harus ada');

// 6. Pendarahan (tekan langsung, tourniquet)
assert.ok(firstAidSource.includes('Pendarahan Berat & Tourniquet'), 'Modul 6: Pendarahan Tourniquet harus ada');

// 7. Tenggelam
assert.ok(firstAidSource.includes('Tenggelam'), 'Modul 7: Tenggelam harus ada');
assert.ok(firstAidSource.includes('Reach') && firstAidSource.includes('Throw'), 'Modul 7 harus memuat prinsip penyelamatan air');

// 8. Bencana Alam
assert.ok(firstAidSource.includes('Bencana Alam'), 'Modul 8: Bencana Alam harus ada');
assert.ok(firstAidSource.includes('HOLD ON') || firstAidSource.includes('20-20-20'), 'Modul 8 harus memuat protokol gempa/tsunami');

// 9. Evakuasi & Shelter
assert.ok(firstAidSource.includes('Evakuasi & Tempat Pengungsian') || firstAidSource.includes('Shelter'), 'Modul 9: Evakuasi harus ada');

// 10. Kontak Darurat Indonesia
assert.ok(firstAidSource.includes('Kontak Darurat Resmi Indonesia'), 'Modul 10: Kontak Darurat harus ada');
assert.ok(firstAidSource.includes('112') && firstAidSource.includes('119') && firstAidSource.includes('115'), 'Modul 10 harus memuat 112, 119, 115');

console.log('  ✅ PASS: Seluruh 10 Modul Panduan P3K terstruktur lengkap sesuai Task 7.1\n');

// -------------------------------------------------------------
// Test 3: Validasi Routing, Stack Screen & PWA Caching
// -------------------------------------------------------------
console.log('Test 3: Validasi Registrasi Route di _layout.tsx dan Service Worker Cache');
const layoutPath = path.resolve(__dirname, '../../frontend/app/(main)/_layout.tsx');
const layoutSource = fs.readFileSync(layoutPath, 'utf-8');
assert.ok(layoutSource.includes('name="guides/first-aid"'), '_layout.tsx harus meregistrasikan Stack.Screen guides/first-aid');

const swPath = path.resolve(__dirname, '../../frontend/public/service-worker.js');
const swSource = fs.readFileSync(swPath, 'utf-8');
assert.ok(swSource.includes("'/guides/first-aid'"), 'service-worker.js harus mem-precaching /guides/first-aid');
console.log('  ✅ PASS: Route /guides/first-aid terdaftar dan di-cache PWA untuk akses offline\n');

// -------------------------------------------------------------
// Test 4: Validasi Menu Utama Dropdown di contacts.tsx (Task 8.1)
// -------------------------------------------------------------
console.log('Test 4: Validasi Menu P3K Darurat di Dropdown Utama (Task 8.1)');
const contactsPath = path.resolve(__dirname, '../../frontend/app/(main)/contacts.tsx');
const contactsSource = fs.readFileSync(contactsPath, 'utf-8');

assert.ok(contactsSource.includes('Panduan P3K & Darurat'), 'Menu dropdown harus memiliki tautan P3K Darurat');
assert.ok(contactsSource.includes('/(main)/guides/first-aid'), 'Tautan harus mengarah ke route /(main)/guides/first-aid');
console.log('  ✅ PASS: Menu dropdown utama mengintegrasikan Panduan P3K Darurat sesuai Task 8.1\n');

// -------------------------------------------------------------
// Test 5: Validasi Integrasi Panggilan Cepat & SOS Radio
// -------------------------------------------------------------
console.log('Test 5: Validasi Panggilan Cepat Darurat (112, 119, 115) & SOS Radio HT');
assert.ok(firstAidSource.includes('tel:'), 'Harus mendukung direct dial tel:');
assert.ok(firstAidSource.includes('BluetoothHTModal'), 'Halaman P3K harus mengintegrasikan modal radio HT untuk SOS');
console.log('  ✅ PASS: Panggilan darurat langsung dan tombol SOS Radio HT terintegrasi aktif\n');

console.log('================================================================');
console.log('--- ALL SPRINT 11 FIRST AID GUIDE TESTS PASSED (100%) ---');
console.log('================================================================');
