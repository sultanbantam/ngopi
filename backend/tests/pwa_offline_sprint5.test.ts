import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('--- RUNNING SPRINT 5: PWA + SERVICE WORKER (FONDASI OFFLINE) ---');
console.log('================================================================\n');

async function runTests() {
  const rootDir = path.resolve(__dirname, '../..');
  const frontendDir = path.join(rootDir, 'frontend');
  const publicDir = path.join(frontendDir, 'public');

  // ---------------------------------------------------------------------------
  // Test 1: PWA Manifest File Validation (Task 5.3.1)
  // ---------------------------------------------------------------------------
  console.log('Test 1: Validasi File manifest.json (Spesifikasi PWA Ngopi & Izin Hardware)');
  const manifestPath = path.join(publicDir, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'manifest.json harus ada di frontend/public');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.name, 'Ngopi - Warung Kopi Digital');
  assert.strictEqual(manifest.short_name, 'Ngopi');
  assert.strictEqual(manifest.display, 'standalone');
  assert.strictEqual(manifest.start_url, '/');
  assert.strictEqual(manifest.background_color, '#3E2723');
  assert.strictEqual(manifest.theme_color, '#8B5E3C');

  // Validate Icons
  assert(Array.isArray(manifest.icons), 'manifest.icons harus berupa array');
  const icon192 = manifest.icons.find((i: any) => i.sizes === '192x192');
  const icon512 = manifest.icons.find((i: any) => i.sizes === '512x512');
  assert(icon192, 'Harus memuat icon ukuran 192x192');
  assert(icon512, 'Harus memuat icon ukuran 512x512');

  const icon192Path = path.join(publicDir, icon192.src.replace(/^\//, ''));
  const icon512Path = path.join(publicDir, icon512.src.replace(/^\//, ''));
  assert(fs.existsSync(icon192Path), `Asset icon 192x192 harus ada pada: ${icon192Path}`);
  assert(fs.existsSync(icon512Path), `Asset icon 512x512 harus ada pada: ${icon512Path}`);

  // Validate Hardware Permissions for HT & Audio
  assert(Array.isArray(manifest.permissions), 'manifest.permissions harus ada untuk fitur HT');
  assert(manifest.permissions.includes('bluetooth'), 'Izin bluetooth wajib untuk HT Bluetooth');
  assert(manifest.permissions.includes('serial'), 'Izin serial wajib untuk HT USB dongle');
  assert(manifest.permissions.includes('microphone'), 'Izin microphone wajib untuk mode akustik & voice');

  console.log('  ✅ PASS: manifest.json valid dengan properti standalone, tema warkop, dan izin bluetooth/serial/mic');

  // ---------------------------------------------------------------------------
  // Test 2: Service Worker Validation (Task 5.3.1)
  // ---------------------------------------------------------------------------
  console.log('\nTest 2: Validasi File service-worker.js (Caching App Shell & Offline HT)');
  const swPath = path.join(publicDir, 'service-worker.js');
  assert(fs.existsSync(swPath), 'service-worker.js harus ada di frontend/public');

  const swContent = fs.readFileSync(swPath, 'utf8');
  assert(swContent.includes("CACHE_NAME = 'ngopi-v3'"), 'Harus menggunakan CACHE_NAME ngopi-v3');
  assert(swContent.includes('/offline.html'), 'Harus menyertakan fallback /offline.html');
  assert(swContent.includes('/games/gapleh'), 'Harus meng-cache halaman /games/gapleh');
  assert(swContent.includes('/guides/ht'), 'Harus meng-cache halaman /guides/ht');
  assert(swContent.includes('/guides/first-aid'), 'Harus meng-cache halaman /guides/first-aid');

  // Event listeners
  assert(swContent.includes("addEventListener('install'"), 'Harus memiliki event listener install');
  assert(swContent.includes("addEventListener('activate'"), 'Harus memiliki event listener activate');
  assert(swContent.includes("addEventListener('fetch'"), 'Harus memiliki event listener fetch');
  assert(swContent.includes('skipWaiting()'), 'Harus mengaktifkan skipWaiting');
  assert(swContent.includes('clients.claim()'), 'Harus mengaktifkan clients.claim');

  console.log('  ✅ PASS: service-worker.js mencakup precaching rute-rute utama, gapleh, dan panduan HT');

  // ---------------------------------------------------------------------------
  // Test 3: Offline HTML Fallback Page Validation
  // ---------------------------------------------------------------------------
  console.log('\nTest 3: Validasi File offline.html (Halaman Fallback Cantik Khas Warkop)');
  const offlineHtmlPath = path.join(publicDir, 'offline.html');
  assert(fs.existsSync(offlineHtmlPath), 'offline.html harus ada di frontend/public');

  const offlineHtml = fs.readFileSync(offlineHtmlPath, 'utf8');
  assert(offlineHtml.includes('Mode Offline Aktif — HT Siap'), 'Harus memuat judul banner Mode Offline Aktif — HT Siap');
  assert(offlineHtml.includes('OFFLINE'), 'Harus menampilkan badge status OFFLINE');
  assert(offlineHtml.includes('145.500 MHz'), 'Harus memuat frekuensi default HT 145.500 MHz');
  assert(offlineHtml.includes('Bluetooth Mesh'), 'Harus menyebutkan kesiapan Bluetooth Mesh');
  assert(offlineHtml.includes("addEventListener('online'"), 'Harus memuat script auto-reload saat internet pulih');

  console.log('  ✅ PASS: offline.html estetis dengan info radio HT, status offline, dan auto-reload');

  // ---------------------------------------------------------------------------
  // Test 4: Service Worker Registration Module (Task 5.3.2)
  // ---------------------------------------------------------------------------
  console.log('\nTest 4: Validasi Modul serviceWorkerRegistration.ts');
  const regPath = path.join(frontendDir, 'src/serviceWorkerRegistration.ts');
  assert(fs.existsSync(regPath), 'serviceWorkerRegistration.ts harus ada');

  const regContent = fs.readFileSync(regPath, 'utf8');
  assert(regContent.includes('export function register()'), 'Harus mengekspor fungsi register()');
  assert(regContent.includes('export function unregister()'), 'Harus mengekspor fungsi unregister()');
  assert(regContent.includes("navigator.serviceWorker.register('/service-worker.js'"), 'Harus mendaftarkan /service-worker.js');

  console.log('  ✅ PASS: serviceWorkerRegistration.ts terverifikasi');

  // ---------------------------------------------------------------------------
  // Test 5: Offline Banner & Header Indicator (Task 8.3)
  // ---------------------------------------------------------------------------
  console.log('\nTest 5: Validasi UI Offline Indicator (Task 8.3)');
  const bannerPath = path.join(frontendDir, 'src/components/OfflineBanner.tsx');
  const bannerContent = fs.readFileSync(bannerPath, 'utf8');

  assert(bannerContent.includes('📡 Mode Offline Aktif — HT Siap'), 'Banner harus memuat: "📡 Mode Offline Aktif — HT Siap"');
  assert(bannerContent.includes('OFFLINE'), 'Header badge harus memuat: "OFFLINE"');
  assert(bannerContent.includes('Pesan akan disinkronkan saat online.'), 'Subtext harus memuat: "Pesan akan disinkronkan saat online."');

  console.log('  ✅ PASS: OfflineBanner mengimplementasikan teks persis Task 8.3');

  // ---------------------------------------------------------------------------
  // Test 6: Permissions Policy in vercel.json
  // ---------------------------------------------------------------------------
  console.log('\nTest 6: Validasi Permissions Policy di vercel.json');
  const vercelPath = path.join(frontendDir, 'vercel.json');
  const vercelContent = fs.readFileSync(vercelPath, 'utf8');

  assert(vercelContent.includes('bluetooth=(self)'), 'Permissions-Policy harus mengizinkan bluetooth=(self)');
  assert(vercelContent.includes('serial=(self)'), 'Permissions-Policy harus mengizinkan serial=(self)');
  assert(vercelContent.includes('service-worker.js'), 'vercel.json harus memiliki header Service-Worker-Allowed');

  console.log('  ✅ PASS: vercel.json mendukung Web Bluetooth, Web Serial, dan Service Worker');

  console.log('\n================================================================');
  console.log('--- ALL SPRINT 5 PWA & OFFLINE FOUNDATION TESTS PASSED (100%) ---');
  console.log('================================================================');
}

runTests().catch((e) => {
  console.error('❌ Test failed with error:', e);
  process.exit(1);
});
