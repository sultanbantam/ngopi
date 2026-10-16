import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { AcousticModem } from '../src/ht/acousticModem.service';

console.log('================================================================');
console.log('--- RUNNING SPRINT 8: HT OFFLINE (MODE AKUSTIK FSK 1200/2200) ---');
console.log('================================================================\n');

// -------------------------------------------------------------
// Test 1: Validasi File Frontend acousticModem.ts dan services/ht
// -------------------------------------------------------------
console.log('Test 1: Validasi File acousticModem.ts dan services/ht/acousticModem.service.ts');
const frontendAcousticPath = path.resolve(__dirname, '../../frontend/src/ht/acousticModem.ts');
const frontendServicePath = path.resolve(__dirname, '../../frontend/services/ht/acousticModem.service.ts');

assert.strictEqual(fs.existsSync(frontendAcousticPath), true, 'frontend/src/ht/acousticModem.ts harus ada');
assert.strictEqual(fs.existsSync(frontendServicePath), true, 'frontend/services/ht/acousticModem.service.ts harus ada');

const acousticSource = fs.readFileSync(frontendAcousticPath, 'utf-8');
assert.ok(acousticSource.includes('class AcousticModem'), 'Harus mendefinisikan kelas AcousticModem');
assert.ok(acousticSource.includes('class AcousticModemFrontend'), 'Harus mengekspor AcousticModemFrontend untuk kompatibilitas');
assert.ok(acousticSource.includes('detectFrequency'), 'Harus menyertakan detectFrequency');
assert.ok(acousticSource.includes('textToBits'), 'Harus menyertakan textToBits');
assert.ok(acousticSource.includes('bitsToText'), 'Harus menyertakan bitsToText');
assert.ok(acousticSource.includes('startListening'), 'Harus menyertakan startListening RX demodulator');
console.log('  ✅ PASS: Modul AcousticModem dan file alias services/ht tersedia lengkap\n');

// -------------------------------------------------------------
// Test 2: Validasi Algoritma Bit Conversion (Task 5.6.1)
// -------------------------------------------------------------
console.log('Test 2: Validasi Algoritma textToBits dan bitsToText (Task 5.6.1)');
const sampleText = 'NGOPI 10-4';
const bits = AcousticModem.textToBits(sampleText);
assert.strictEqual(bits.length, sampleText.length * 8, `Panjang bits harus 8 x ${sampleText.length} = ${sampleText.length * 8}`);

// Pastikan semua nilai adalah 0 atau 1
for (const b of bits) {
  assert.ok(b === 0 || b === 1, 'Setiap bit harus bernilai 0 atau 1');
}

const reconstructedText = AcousticModem.bitsToText(bits);
assert.strictEqual(reconstructedText, sampleText, `Hasil dekonstruksi bits harus sama persis dengan "${sampleText}"`);

// Uji coba sandi darurat
const emergencyText = 'SOS DARURAT!';
const emergencyBits = AcousticModem.textToBits(emergencyText);
assert.strictEqual(AcousticModem.bitsToText(emergencyBits), emergencyText);
console.log('  ✅ PASS: textToBits dan bitsToText 100% akurat bolak-balik\n');

// -------------------------------------------------------------
// Test 3: Validasi Zero-Crossing Frequency Detection (Task 5.6.1)
// -------------------------------------------------------------
console.log('Test 3: Validasi Deteksi Frekuensi Zero-Crossing (1200 Hz Mark & 2200 Hz Space)');
const sampleRate = 44100;
const numSamples = Math.round(sampleRate / 1200) * 10; // 10 bit windows

// Buat gelombang sinus 1200 Hz (Mark - bit 1)
const markSamples = new Float32Array(numSamples);
for (let i = 0; i < numSamples; i++) {
  markSamples[i] = Math.sin((2 * Math.PI * 1200 * i) / sampleRate);
}
const detectedMarkFreq = AcousticModem.detectFrequency(markSamples, sampleRate);
const markDiff = Math.abs(detectedMarkFreq - 1200);
assert.ok(markDiff < 60, `Deteksi 1200 Hz harus akurat (terdeteksi: ${detectedMarkFreq.toFixed(1)} Hz)`);

// Buat gelombang sinus 2200 Hz (Space - bit 0)
const spaceSamples = new Float32Array(numSamples);
for (let i = 0; i < numSamples; i++) {
  spaceSamples[i] = Math.sin((2 * Math.PI * 2200 * i) / sampleRate);
}
const detectedSpaceFreq = AcousticModem.detectFrequency(spaceSamples, sampleRate);
const spaceDiff = Math.abs(detectedSpaceFreq - 2200);
assert.ok(spaceDiff < 60, `Deteksi 2200 Hz harus akurat (terdeteksi: ${detectedSpaceFreq.toFixed(1)} Hz)`);

// Validasi threshold 1700 Hz
assert.ok(detectedMarkFreq < 1700, 'Frekuensi Mark (1200 Hz) harus < 1700 Hz threshold');
assert.ok(detectedSpaceFreq > 1700, 'Frekuensi Space (2200 Hz) harus > 1700 Hz threshold');
console.log(`  ✅ PASS: Deteksi frekuensi akurat: Mark=${detectedMarkFreq.toFixed(1)} Hz (<1700), Space=${detectedSpaceFreq.toFixed(1)} Hz (>1700)\n`);

// -------------------------------------------------------------
// Test 4: Validasi Modulasi & Demodulasi FSK Round-Trip
// -------------------------------------------------------------
console.log('Test 4: Validasi Modulasi & Demodulasi Sinyal FSK Audio');
const testWord = 'KOP';
const simpleSamples = AcousticModem.encodeSimple(testWord, sampleRate);
assert.ok(simpleSamples.length > 0, 'Sinyal sampel audio hasil encode harus ada');

const decodedWord = AcousticModem.decodeSimple(simpleSamples, sampleRate);
assert.strictEqual(decodedWord, testWord, `Hasil decode sinyal sederhana harus "${testWord}"`);

// Uji juga Bell 202 framing lengkap dengan Goertzel & CRC16
const packetMsg = 'CQ CQ CQ DE YB0KOP';
const robustSamples = AcousticModem.encodeTextToSamples(packetMsg);
const decodedPacket = AcousticModem.decodeSamplesToText(robustSamples);
assert.strictEqual(decodedPacket, packetMsg, `Hasil decode Bell 202 harus tepat "${packetMsg}"`);
console.log('  ✅ PASS: Round-trip FSK modulation & demodulation sukses sempurna\n');

// -------------------------------------------------------------
// Test 5: Validasi Integrasi Tri-Mode pada BluetoothHTModal.tsx
// -------------------------------------------------------------
console.log('Test 5: Validasi Integrasi Tri-Mode (Bluetooth, Serial, Akustik) di Modal UI');
const modalPath = path.resolve(__dirname, '../../frontend/src/components/BluetoothHTModal.tsx');
const modalSource = fs.readFileSync(modalPath, 'utf-8');

assert.ok(modalSource.includes("'bluetooth' | 'serial' | 'acoustic'"), 'Modal harus mendukung 3 mode komunikasi');
assert.ok(modalSource.includes('🔊 Akustik (Semua HP)'), 'Modal harus memiliki tab Akustik');
assert.ok(modalSource.includes('handleToggleMic'), 'Modal harus mendukung toggle mikrofon RX');
assert.ok(modalSource.includes('playAfsktone'), 'Modal harus memanggil playAfsktone saat transmit akustik');
assert.ok(modalSource.includes('stopListening'), 'Modal harus menghentikan listening saat unmount');
console.log('  ✅ PASS: Antarmuka Tri-Mode dan kontrol mikrofon RX terintegrasi rapi\n');

console.log('================================================================');
console.log('--- ALL SPRINT 8 HT ACOUSTIC TESTS PASSED (100%) ---');
console.log('================================================================');
