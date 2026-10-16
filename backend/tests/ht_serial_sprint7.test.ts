import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('--- RUNNING SPRINT 7: HT OFFLINE (WEB SERIAL API DONGLE USB) ---');
console.log('================================================================\n');

async function runTests() {
  const rootDir = path.resolve(__dirname, '../..');
  const frontendDir = path.join(rootDir, 'frontend');

  // ---------------------------------------------------------------------------
  // Test 1: File Existence & Export Structure (Task 5.5)
  // ---------------------------------------------------------------------------
  console.log('Test 1: Validasi File serialHT.ts dan services/ht/serialHT.service.ts');
  const serialFilePath = path.join(frontendDir, 'src/ht/serialHT.ts');
  const aliasFilePath = path.join(frontendDir, 'services/ht/serialHT.service.ts');

  assert(fs.existsSync(serialFilePath), 'frontend/src/ht/serialHT.ts harus ada');
  assert(fs.existsSync(aliasFilePath), 'frontend/services/ht/serialHT.service.ts harus ada sesuai spec prompt 5.5');

  const serialContent = fs.readFileSync(serialFilePath, 'utf8');
  assert(serialContent.includes('export class SerialHT'), 'Harus mengekspor class SerialHT');
  assert(serialContent.includes('export class SerialHTClient') || serialContent.includes('export const SerialHTClient = SerialHT'), 'Harus kompatibel dengan SerialHTClient');
  assert(serialContent.includes('startPTT()'), 'Harus mengimplementasikan startPTT()');
  assert(serialContent.includes('stopPTT()'), 'Harus mengimplementasikan stopPTT()');
  assert(serialContent.includes('sendText('), 'Harus mengimplementasikan sendText()');
  assert(serialContent.includes('readLoop()'), 'Harus mengimplementasikan readLoop()');
  assert(serialContent.includes('onReceive('), 'Harus mengimplementasikan onReceive()');

  console.log('  ✅ PASS: Modul SerialHT dan file alias services/ht tersedia lengkap');

  // ---------------------------------------------------------------------------
  // Test 2: Inisialisasi State, Frekuensi, dan Kontrol PTT
  // ---------------------------------------------------------------------------
  console.log('\nTest 2: Validasi Logika SerialHT (Inisialisasi, Frekuensi 145.500 MHz, PTT ON/OFF)');
  const { SerialHT, serialHT } = await import('../../frontend/src/ht/serialHT');

  const client = new SerialHT();
  const initialState = client.getState();

  assert.strictEqual(initialState.frequency, 145.500, 'Frekuensi awal harus default 145.500 MHz');
  assert.strictEqual(initialState.baudRate, 9600, 'Baud rate default harus 9600');
  assert.strictEqual(initialState.pttActive, false, 'PTT awal harus false (tidak sedang transmit)');
  assert.strictEqual(initialState.isConnected, false, 'Koneksi serial awal harus false');

  // Test setFrequency
  await client.setFrequency(433.000);
  assert.strictEqual(client.getState().frequency, 433.000, 'Frekuensi harus berhasil disetel ke 433.000 MHz (UHF)');

  // Test startPTT & stopPTT
  await client.startPTT();
  assert.strictEqual(client.getState().pttActive, true, 'PTT harus aktif (true) saat startPTT() dipanggil');
  await client.stopPTT();
  assert.strictEqual(client.getState().pttActive, false, 'PTT harus nonaktif (false) saat stopPTT() dipanggil');

  // Test Static Delegations
  await SerialHT.setFrequency(145.500);
  assert.strictEqual(serialHT.getState().frequency, 145.500, 'Static setFrequency harus sinkron dengan singleton');
  await SerialHT.setPtt(true);
  assert.strictEqual(serialHT.getState().pttActive, true, 'Static setPtt(true) harus mengaktifkan PTT');
  await SerialHT.setPtt(false);
  assert.strictEqual(serialHT.getState().pttActive, false, 'Static setPtt(false) harus mematikan PTT');

  console.log('  ✅ PASS: Pengaturan frekuensi, startPTT, stopPTT, dan delegasi statis berfungsi normal');

  // ---------------------------------------------------------------------------
  // Test 3: Event Listeners & Penerimaan Data Masuk (onReceive)
  // ---------------------------------------------------------------------------
  console.log('\nTest 3: Validasi Event Listeners onMessage & subscribeState pada SerialHT');
  let receivedText = '';
  const unsubMsg = client.onMessage((text) => {
    receivedText = text;
  });

  let latestStatus = '';
  const unsubState = client.subscribeState((st) => {
    latestStatus = st.statusMessage;
  });

  // Simulate streaming data received from USB TNC / Dongle
  client.onReceive('SEND 10-4 Dimengerti Kawan Warkop\n');
  assert(receivedText.includes('10-4 Dimengerti'), 'Listener onMessage harus menangkap teks serial');
  assert.strictEqual(client.getState().lastReceivedText, 'SEND 10-4 Dimengerti Kawan Warkop\n');
  assert(latestStatus.includes('Diterima dari USB HT:'), 'Status message harus mengonfirmasi data serial masuk');

  unsubMsg();
  unsubState();

  console.log('  ✅ PASS: Listener onMessage dan subscribeState menangkap aliran data serial streaming');

  // ---------------------------------------------------------------------------
  // Test 4: Kompatibilitas Browser (Task 5.5)
  // ---------------------------------------------------------------------------
  console.log('\nTest 4: Validasi Kompatibilitas Browser untuk Web Serial');
  const compat = client.getCompatibilityInfo();
  assert(typeof compat.supported === 'boolean', 'Nilai supported harus boolean');
  assert(typeof compat.browser === 'string', 'Nilai browser harus string');
  assert(typeof compat.advice === 'string' && compat.advice.length > 0, 'Harus menyediakan saran alternatif');

  console.log(`  ✅ PASS: Deteksi kompatibilitas serial: "${compat.browser}" -> ${compat.advice}`);

  // ---------------------------------------------------------------------------
  // Test 5: UI Modal Integrasi Dual-Mode (Bluetooth & USB Serial)
  // ---------------------------------------------------------------------------
  console.log('\nTest 5: Validasi Integrasi Antarmuka Dual-Mode di BluetoothHTModal.tsx');
  const modalPath = path.join(frontendDir, 'src/components/BluetoothHTModal.tsx');
  const modalContent = fs.readFileSync(modalPath, 'utf8');

  assert(modalContent.includes('serialHT'), 'Modal harus mengimpor serialHT');
  assert(modalContent.includes("connectionMode === 'serial'"), 'Modal harus mendukung mode serial');
  assert(modalContent.includes('Pilih Port USB Serial HT') || modalContent.includes('USB Serial'), 'Modal harus memiliki opsi koneksi USB Serial');
  assert(modalContent.includes('modeTabsRow'), 'Modal harus memiliki tab pemilih Bluetooth vs USB Serial');

  console.log('  ✅ PASS: Antarmuka terpadu mendukung perpindahan mulus antara Bluetooth dan USB Serial');

  console.log('\n================================================================');
  console.log('--- ALL SPRINT 7 HT SERIAL TESTS PASSED (100%) ---');
  console.log('================================================================');
}

runTests().catch((e) => {
  console.error('❌ Test failed with error:', e);
  process.exit(1);
});
