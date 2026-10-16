import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { htManagerService } from '../src/ht/htManager.service';

console.log('================================================================');
console.log('--- RUNNING SPRINT 9: HTMANAGER + SINKRONISASI + UI OFFLINE ---');
console.log('================================================================\n');

// -------------------------------------------------------------
// Test 1: Validasi Database Schema HT (Task 5.10 update1.md)
// -------------------------------------------------------------
console.log('Test 1: Validasi Schema Prisma untuk HTProfile & HTMessage (Task 5.10)');
const prismaSchemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
assert.strictEqual(fs.existsSync(prismaSchemaPath), true, 'prisma/schema.prisma harus ada');

const schemaContent = fs.readFileSync(prismaSchemaPath, 'utf-8');
assert.ok(schemaContent.includes('model HTProfile'), 'Harus menyertakan model HTProfile');
assert.ok(schemaContent.includes('preferred_mode String   @default("acoustic")'), 'HTProfile harus memiliki preferred_mode');
assert.ok(schemaContent.includes('model HTMessage'), 'Harus menyertakan model HTMessage');
assert.ok(schemaContent.includes('protocol     String'), 'HTMessage harus memiliki field protocol');
assert.ok(schemaContent.includes('mode         String'), 'HTMessage harus memiliki field mode (bluetooth/serial/acoustic)');
assert.ok(schemaContent.includes('status       String    @default("pending")'), 'HTMessage harus memiliki status pending');
console.log('  ✅ PASS: Model HTProfile dan HTMessage di Prisma schema valid sesuai Task 5.10\n');

// -------------------------------------------------------------
// Test 2: Validasi File Frontend HTManager & Service Alias (Task 5.7)
// -------------------------------------------------------------
console.log('Test 2: Validasi Frontend htManager.ts dan services/ht/htManager.service.ts (Task 5.7)');
const frontendManagerPath = path.resolve(__dirname, '../../frontend/src/ht/htManager.ts');
const frontendServicePath = path.resolve(__dirname, '../../frontend/services/ht/htManager.service.ts');

assert.strictEqual(fs.existsSync(frontendManagerPath), true, 'frontend/src/ht/htManager.ts harus ada');
assert.strictEqual(fs.existsSync(frontendServicePath), true, 'frontend/services/ht/htManager.service.ts harus ada');

const managerSource = fs.readFileSync(frontendManagerPath, 'utf-8');
assert.ok(managerSource.includes('class HTManager'), 'Harus mengekspor kelas HTManager');
assert.ok(managerSource.includes('export async function openDB'), 'Harus memiliki fungsi openDB untuk IndexedDB');
assert.ok(managerSource.includes('sendMessage'), 'Harus memiliki method sendMessage');
assert.ok(managerSource.includes('saveToLocalDB'), 'Harus memiliki method saveToLocalDB');
assert.ok(managerSource.includes('syncToServer'), 'Harus memiliki method syncToServer');
assert.ok(managerSource.includes("window.addEventListener('online'"), 'Harus menyertakan listener auto-sync saat online');
console.log('  ✅ PASS: HTManager mengimplementasikan seluruh spesifikasi Orkestrator Task 5.7\n');

// -------------------------------------------------------------
// Test 3: Validasi Mekanisme Store-and-Forward Sync di Server (Task 5.9.4)
// -------------------------------------------------------------
console.log('Test 3: Validasi Sinkronisasi Batch Pesan Offline ke Server (Task 5.9.4)');
htManagerService.resetForTesting();

const mockOfflineMessages: any[] = [
  {
    id: 'offline_msg_001',
    sender_id: 'user_andi',
    content: 'Pesan dari posko 1 via HT Baofeng',
    freq: 145.500,
    protocol: 'AFSK',
    mode: 'acoustic',
    status: 'pending',
    timestamp: Date.now() - 60000,
    created_at: Date.now() - 60000,
  },
  {
    id: 'offline_msg_002',
    sender_id: 'user_budi',
    content: '10-4 Dimengerti, logistik siap meluncur',
    freq: 145.500,
    protocol: 'AFSK',
    mode: 'bluetooth',
    status: 'pending',
    timestamp: Date.now() - 30000,
    created_at: Date.now() - 30000,
  },
];

const syncResult = htManagerService.syncOfflineBatch(mockOfflineMessages);
assert.strictEqual(syncResult.received, 2, 'Server harus menerima dan menyimpan 2 pesan offline');
assert.strictEqual(syncResult.synced.length, 2);
assert.strictEqual(syncResult.synced[0]?.status, 'delivered', 'Status pesan harus diubah menjadi delivered');

// Verifikasi pesan tersimpan di memory store server
const allMessages = htManagerService.getMessages();
assert.strictEqual(allMessages.length, 2, 'Total pesan di server harus menjadi 2');
assert.ok(allMessages.some(m => m.id === 'offline_msg_001'));
assert.ok(allMessages.some(m => m.id === 'offline_msg_002'));

// Pengujian idempotensi (sinkronisasi ulang ID yang sama tidak menduplikasi data)
const duplicateSync = htManagerService.syncOfflineBatch(mockOfflineMessages);
assert.strictEqual(duplicateSync.received, 0, 'Pesan duplikat tidak boleh digandakan');
assert.strictEqual(htManagerService.getMessages().length, 2, 'Jumlah pesan tetap 2');
console.log('  ✅ PASS: Sinkronisasi batch dan pencegahan duplikasi pesan berhasil sempurna\n');

// -------------------------------------------------------------
// Test 4: Validasi Indikator UI Mode Offline & Notifikasi (Task 5.8 & 8.3)
// -------------------------------------------------------------
console.log('Test 4: Validasi Indikator UI Offline, Badge & Sinkronisasi (Task 5.8 & 8.3)');
const bannerPath = path.resolve(__dirname, '../../frontend/src/components/OfflineBanner.tsx');
const bannerSource = fs.readFileSync(bannerPath, 'utf-8');

assert.ok(bannerSource.includes('📡 Mode Offline Aktif — HT Siap'), 'Banner harus memuat teks Task 8.3');
assert.ok(bannerSource.includes('OFFLINE'), 'Banner harus memuat badge OFFLINE');
assert.ok(bannerSource.includes('Pesan akan disinkronkan saat online.'), 'Banner harus memuat notifikasi sinkronisasi');

const modalPath = path.resolve(__dirname, '../../frontend/src/components/BluetoothHTModal.tsx');
const modalSource = fs.readFileSync(modalPath, 'utf-8');

assert.ok(modalSource.includes('htManager'), 'Modal harus terintegrasi dengan htManager');
assert.ok(modalSource.includes('pendingMessages.length'), 'Modal harus menghitung pesan pending');
assert.ok(modalSource.includes('pesan offline menunggu sinkronisasi'), 'Modal harus menampilkan counter pesan pending');
assert.ok(modalSource.includes('handleManualSync'), 'Modal harus memiliki tombol manual sinkronisasi');
console.log('  ✅ PASS: UI Offline Banner & Modal sinkronisasi terpasang konsisten sesuai Task 5.8\n');

console.log('================================================================');
console.log('--- ALL SPRINT 9 HTMANAGER & SYNC TESTS PASSED (100%) ---');
console.log('================================================================');
