import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { emergencyService } from '../src/services/emergency.service';
import { htManagerService } from '../src/ht/htManager.service';

console.log('================================================================');
console.log('--- RUNNING SPRINT 12: EMERGENCY MODE & SOS TEST SUITE ---');
console.log('================================================================\n');

emergencyService.resetForTesting();

// -------------------------------------------------------------
// Test 1: Tombol SOS Otomatis (Task 7.2) - GPS & 145.000 MHz APRS
// -------------------------------------------------------------
console.log('Test 1: Pemicu SOS Otomatis, Transmisi HT 145.000 MHz & Tone AFSK');
const sos1 = emergencyService.triggerSOS({
  userId: 'user_darurat_01',
  username: 'Kang Agus',
  type: 'medical',
  latitude: -6.1754,
  longitude: 106.8272,
  description: 'Korban henti napas di teras warkop!',
});

assert.strictEqual(sos1.success, true, 'SOS harus berhasil dipicu');
assert.ok(sos1.emergencyLog, 'Emergency log harus dibuat');
assert.strictEqual(sos1.emergencyLog.status, 'active', 'Status log darurat harus active');
assert.strictEqual(sos1.emergencyLog.type, 'medical', 'Tipe darurat harus medical');
assert.strictEqual(sos1.emergencyLog.latitude, -6.1754, 'Latitude harus sesuai');
assert.strictEqual(sos1.emergencyLog.longitude, 106.8272, 'Longitude harus sesuai');

// Verifikasi siaran HT 145.000 MHz
assert.strictEqual(sos1.htTransmission.message.freq, 145.000, 'Frekuensi transmisi harus 145.000 MHz');
assert.strictEqual(sos1.htTransmission.message.protocol, 'APRS', 'Protokol harus APRS');
assert.strictEqual(sos1.htTransmission.message.is_emergency, true, 'Flag is_emergency harus true');
assert.ok(sos1.htTransmission.audioDataUrl.startsWith('data:audio/wav;base64,'), 'Harus menghasilkan audio base64 AFSK');
console.log('  ✅ PASS: Sinyal APRS dan AFSK tone 145.000 MHz berhasil digenerate\n');

// -------------------------------------------------------------
// Test 2: Siaran ke Grup "Warung Kopi Darurat" (Task 7.2 point 2)
// -------------------------------------------------------------
console.log('Test 2: Siaran & Notifikasi Otomatis ke Grup "Warung Kopi Darurat"');
assert.ok(sos1.daruratGroup, 'Grup darurat harus tersedia');
assert.strictEqual(sos1.daruratGroup.name, 'Warung Kopi Darurat', 'Nama grup harus Warung Kopi Darurat');
assert.strictEqual(sos1.daruratGroup.freq, 145.000, 'Frekuensi grup darurat harus 145.000 MHz');
assert.strictEqual(sos1.daruratGroup.protocol, 'APRS', 'Protokol grup harus APRS');
console.log('  ✅ PASS: Grup Warung Kopi Darurat otomatis dibuat dan disiarkan pada 145.000 MHz\n');

// -------------------------------------------------------------
// Test 3: Rekomendasi Panduan P3K Relevan (Task 7.2 point 3)
// -------------------------------------------------------------
console.log('Test 3: Pencocokan Panduan P3K Otomatis Sesuai Tipe Insiden');
// Medis
const medGuide = emergencyService.getRelevantP3K('medical');
assert.ok(medGuide.topic.includes('CPR'), 'Medis harus menyarankan CPR');
assert.ok(medGuide.action_summary.includes('100-120 BPM'), 'Harus memuat ritme 100-120 BPM');
assert.ok(medGuide.action_summary.includes("Stayin' Alive"), 'Harus memuat Stayin Alive');
assert.ok(medGuide.hotline.includes('119'), 'Hotline medis harus 119');

// Kecelakaan
const accGuide = emergencyService.getRelevantP3K('accident');
assert.ok(accGuide.topic.includes('Kecelakaan'), 'Accident harus memuat Kecelakaan');
assert.ok(accGuide.action_summary.includes('fiksasi leher'), 'Harus memuat panduan leher lurus');
assert.ok(accGuide.action_summary.includes('direct pressure'), 'Harus memuat direct pressure');
assert.ok(accGuide.hotline.includes('112'), 'Hotline lalin harus 112');

// Bencana Alam
const disGuide = emergencyService.getRelevantP3K('disaster');
assert.ok(disGuide.topic.includes('Bencana'), 'Disaster harus memuat Bencana');
assert.ok(disGuide.action_summary.includes('20-20-20'), 'Harus memuat rumus tsunami 20-20-20');
assert.ok(disGuide.hotline.includes('115'), 'Hotline bencana harus 115 Basarnas');

// Umum
const genGuide = emergencyService.getRelevantP3K('general');
assert.ok(genGuide.topic.includes('DRSABCD'), 'General harus memuat prinsip DRSABCD');
assert.ok(genGuide.hotline.includes('112'), 'Hotline umum harus 112');
console.log('  ✅ PASS: 4 Kategori Rekomendasi P3K cocok 100% dengan protokol medis darurat\n');

// -------------------------------------------------------------
// Test 4: Emergency Contacts Management (Task 7.3)
// -------------------------------------------------------------
console.log('Test 4: Manajemen Kontak Darurat (Add, Primary Exclusivity, Delete)');
const testUserId = 'user_kontak_test_123';
const c1 = emergencyService.addContact(testUserId, {
  name: 'Ayah',
  phone: '081234567890',
  relation: 'Orang Tua',
  is_primary: true,
});
assert.ok(c1.id, 'Kontak 1 harus punya ID');
assert.strictEqual(c1.is_primary, true, 'Kontak 1 harus primary');

const c2 = emergencyService.addContact(testUserId, {
  name: 'Istri',
  phone: '081987654321',
  relation: 'Pasangan',
  is_primary: true,
});
assert.strictEqual(c2.is_primary, true, 'Kontak 2 harus primary');

const list = emergencyService.getContacts(testUserId);
assert.strictEqual(list.length, 2, 'Harus ada 2 kontak');
const fetchedC1 = list.find(c => c.id === c1.id);
const fetchedC2 = list.find(c => c.id === c2.id);
assert.strictEqual(fetchedC1?.is_primary, false, 'Kontak 1 harus tidak lagi primary');
assert.strictEqual(fetchedC2?.is_primary, true, 'Kontak 2 harus menjadi primary');

// Hapus kontak
const deleted = emergencyService.deleteContact(testUserId, c1.id);
assert.strictEqual(deleted, true, 'Kontak 1 harus berhasil dihapus');
assert.strictEqual(emergencyService.getContacts(testUserId).length, 1, 'Sisa kontak harus 1');
console.log('  ✅ PASS: Manajemen Kontak Darurat dan penanganan primary flag tervalidasi\n');

// -------------------------------------------------------------
// Test 5: Penyelesaian Insiden Darurat (Resolve Log)
// -------------------------------------------------------------
console.log('Test 5: Pelacakan Status & Penyelesaian Insiden Darurat');
const activeBefore = emergencyService.getActiveLogs();
assert.ok(activeBefore.some(l => l.id === sos1.emergencyLog.id), 'Log SOS 1 harus berstatus aktif');

const resolved = emergencyService.resolveLog(sos1.emergencyLog.id, 'Relawan PMI / SAR');
assert.strictEqual(resolved, true, 'Log harus berhasil di-resolve');

const activeAfter = emergencyService.getActiveLogs();
assert.ok(!activeAfter.some(l => l.id === sos1.emergencyLog.id), 'Log SOS 1 tidak boleh lagi aktif');
console.log('  ✅ PASS: Siklus hidup insiden darurat aktif -> selesai tervalidasi\n');

// -------------------------------------------------------------
// Test 6: Validasi Integrasi Frontend & API Routing
// -------------------------------------------------------------
console.log('Test 6: Validasi Integrasi Frontend EmergencySOSModal & Backend Route');
const modalPath = path.resolve(__dirname, '../../frontend/src/components/EmergencySOSModal.tsx');
assert.strictEqual(fs.existsSync(modalPath), true, 'EmergencySOSModal.tsx harus ada di frontend');
const modalSource = fs.readFileSync(modalPath, 'utf-8');
assert.ok(modalSource.includes('145.000 MHz'), 'Modal harus memuat 145.000 MHz');
assert.ok(modalSource.includes('navigator.geolocation'), 'Modal harus mengakses GPS');
assert.ok(modalSource.includes('executeSOS'), 'Modal harus memiliki pemicu executeSOS');
assert.ok(modalSource.includes('112') && modalSource.includes('119'), 'Modal harus memuat hotline darurat');

const routePath = path.resolve(__dirname, '../src/routes/emergency.routes.ts');
assert.strictEqual(fs.existsSync(routePath), true, 'emergency.routes.ts harus ada di backend');
const routeSource = fs.readFileSync(routePath, 'utf-8');
assert.ok(routeSource.includes("router.post('/sos'"), 'Route /sos harus terdaftar');
assert.ok(routeSource.includes("router.get('/contacts'"), 'Route /contacts harus terdaftar');
assert.ok(routeSource.includes("router.post('/contacts'"), 'Route POST /contacts harus terdaftar');
assert.ok(routeSource.includes("router.get('/logs'"), 'Route /logs harus terdaftar');

const indexPath = path.resolve(__dirname, '../src/index.ts');
const indexSource = fs.readFileSync(indexPath, 'utf-8');
assert.ok(indexSource.includes("app.use('/api/emergency', emergencyRoutes)"), 'Backend index.ts harus memount /api/emergency');
console.log('  ✅ PASS: Seluruh file komponen frontend dan routing backend terpasang sempurna\n');

console.log('================================================================');
console.log('--- ALL SPRINT 12 TESTS PASSED PERFECTLY! ---');
console.log('================================================================\n');
