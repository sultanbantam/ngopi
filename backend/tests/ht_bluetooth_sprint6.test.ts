import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('--- RUNNING SPRINT 6: HT OFFLINE (WEB BLUETOOTH API) TESTS ---');
console.log('================================================================\n');

async function runTests() {
  const rootDir = path.resolve(__dirname, '../..');
  const frontendDir = path.join(rootDir, 'frontend');

  // ---------------------------------------------------------------------------
  // Test 1: File Existence & Export Structure (Task 5.4.1)
  // ---------------------------------------------------------------------------
  console.log('Test 1: Validasi File bluetoothHT.ts dan services/ht/bluetoothHT.service.ts');
  const htFilePath = path.join(frontendDir, 'src/ht/bluetoothHT.ts');
  const aliasFilePath = path.join(frontendDir, 'services/ht/bluetoothHT.service.ts');

  assert(fs.existsSync(htFilePath), 'frontend/src/ht/bluetoothHT.ts harus ada');
  assert(fs.existsSync(aliasFilePath), 'frontend/services/ht/bluetoothHT.service.ts harus ada sesuai spec prompt 5.4.1');

  const htContent = fs.readFileSync(htFilePath, 'utf8');
  assert(htContent.includes('export class BluetoothHT'), 'Harus mengekspor class BluetoothHT');
  assert(htContent.includes('0000ffe0-0000-1000-8000-00805f9b34fb'), 'Harus menyertakan UUID service standar HT 0000ffe0');
  assert(htContent.includes('0000ffe1-0000-1000-8000-00805f9b34fb'), 'Harus menyertakan UUID karakteristik standar HT 0000ffe1');
  assert(htContent.includes('battery_service'), 'Harus menyertakan optional service battery_service');

  console.log('  ✅ PASS: Modul BluetoothHT dan file alias services/ht tersedia lengkap');

  // ---------------------------------------------------------------------------
  // Test 2: Inisialisasi State, Frekuensi, dan Kontrol PTT
  // ---------------------------------------------------------------------------
  console.log('\nTest 2: Validasi Logika BluetoothHT (Inisialisasi, Frekuensi 145.500 MHz, PTT)');
  // We can import BluetoothHT dynamically via tsx / node
  const { BluetoothHT, HT_BLE_SERVICES } = await import('../../frontend/src/ht/bluetoothHT');

  const client = new BluetoothHT();
  const initialState = client.getState();

  assert.strictEqual(initialState.frequency, 145.500, 'Frekuensi awal harus default 145.500 MHz');
  assert.strictEqual(initialState.powerLevel, 'high', 'Power awal harus high');
  assert.strictEqual(initialState.pttActive, false, 'PTT awal harus false (tidak sedang transmit)');
  assert.strictEqual(initialState.isConnected, false, 'Koneksi awal harus false');

  // Test setFrequency
  await client.setFrequency(145.000);
  assert.strictEqual(client.getState().frequency, 145.000, 'Frekuensi harus berhasil diubah ke 145.000 MHz (SAR/Darurat)');

  // Test setPower
  await client.setPower('low');
  assert.strictEqual(client.getState().powerLevel, 'low', 'Power harus diubah ke low');

  // Test setPTT
  await client.setPTT(true);
  assert.strictEqual(client.getState().pttActive, true, 'PTT harus aktif saat transmit');
  await client.setPTT(false);
  assert.strictEqual(client.getState().pttActive, false, 'PTT harus mati saat lepas tombol');

  console.log('  ✅ PASS: Inisialisasi state, pengaturan frekuensi, dan PTT berfungsi normal');

  // ---------------------------------------------------------------------------
  // Test 3: Event Listeners & Penerimaan Pesan Radio (onReceive)
  // ---------------------------------------------------------------------------
  console.log('\nTest 3: Validasi Event Listeners onMessage & subscribeState');
  let receivedMessageText = '';
  const unsubMsg = client.onMessage((text) => {
    receivedMessageText = text;
  });

  let latestStateMessage = '';
  const unsubState = client.subscribeState((st) => {
    latestStateMessage = st.statusMessage;
  });

  // Simulate receiving radio packet from Bluetooth GATT
  client.onReceive('CQ CQ CQ de YD0NGO Warkop');
  assert.strictEqual(receivedMessageText, 'CQ CQ CQ de YD0NGO Warkop', 'Listener onMessage harus menerima teks radio');
  assert.strictEqual(client.getState().lastReceivedText, 'CQ CQ CQ de YD0NGO Warkop', 'State lastReceivedText harus terupdate');
  assert(latestStateMessage.includes('Diterima dari HT:'), 'Status message harus mengonfirmasi data masuk');

  unsubMsg();
  unsubState();

  console.log('  ✅ PASS: Listener onMessage dan subscribeState berhasil menerima transmisi radio');

  // ---------------------------------------------------------------------------
  // Test 4: Kompatibilitas Browser & Saran Fallback (Task 5.4.2)
  // ---------------------------------------------------------------------------
  console.log('\nTest 4: Validasi Kompatibilitas Browser (Chrome vs Safari iOS fallback)');
  const compat = client.getCompatibilityInfo();
  assert(typeof compat.supported === 'boolean', 'Nilai supported harus boolean');
  assert(typeof compat.browser === 'string', 'Nilai browser harus string');
  assert(typeof compat.advice === 'string' && compat.advice.length > 0, 'Harus menyediakan saran alternatif');

  console.log(`  ✅ PASS: Deteksi kompatibilitas: "${compat.browser}" -> ${compat.advice}`);

  // ---------------------------------------------------------------------------
  // Test 5: UI Modal BluetoothHTModal & Integrasi OfflineBanner (Task 8.3)
  // ---------------------------------------------------------------------------
  console.log('\nTest 5: Validasi Komponen UI BluetoothHTModal.tsx dan Layout');
  const modalPath = path.join(frontendDir, 'src/components/BluetoothHTModal.tsx');
  assert(fs.existsSync(modalPath), 'BluetoothHTModal.tsx harus ada');

  const modalContent = fs.readFileSync(modalPath, 'utf8');
  assert(modalContent.includes('Radio Handy Talky (HT)'), 'Modal harus memiliki judul Radio Handy Talky (HT)');
  assert(modalContent.includes('Sambungkan HT Bluetooth'), 'Modal harus memiliki tombol koneksi');
  assert(modalContent.includes('TEKAN & TAHAN PTT'), 'Modal harus memiliki tombol PTT');
  assert(modalContent.includes('145.500'), 'Modal harus memiliki preset frekuensi 145.500');
  assert(modalContent.includes('playRogerBeep'), 'Modal harus memanggil roger beep saat lepas PTT');

  const layoutPath = path.join(frontendDir, 'app/(main)/_layout.tsx');
  const layoutContent = fs.readFileSync(layoutPath, 'utf8');
  assert(layoutContent.includes('BluetoothHTModal'), '_layout.tsx harus mengimpor dan merender BluetoothHTModal');
  assert(layoutContent.includes('onPressHT'), '_layout.tsx harus meneruskan onPressHT ke OfflineBanner');

  console.log('  ✅ PASS: UI BluetoothHTModal lengkap dengan PTT, Roger Beep, dan terhubung ke OfflineBanner');

  console.log('\n================================================================');
  console.log('--- ALL SPRINT 6 HT BLUETOOTH TESTS PASSED (100%) ---');
  console.log('================================================================');
}

runTests().catch((e) => {
  console.error('❌ Test failed with error:', e);
  process.exit(1);
});
