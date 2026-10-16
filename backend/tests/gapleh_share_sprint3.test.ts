import assert from 'assert';
import { GaplehShareService, HOOK_TEMPLATES } from '../src/games/gapleh/GaplehShareService';

console.log('================================================================');
console.log('--- RUNNING SPRINT 3: FITUR SHARE SOSMED (VIRAL HOOK GAPLEH) ---');
console.log('================================================================\n');

function runTests() {
  // Test 1: Nutup Balak 6 Hook Generation
  console.log('Test 1: Viral Hook untuk Nutup Balak 6 (Nutup Sakti 500 Poin)');
  const resBalak6 = GaplehShareService.generateShareContent({
    winType: 'nutup_balak6',
    username: 'sultanbantam',
    points: 500,
    designTemplate: 'neon_cyberpunk',
  });

  assert(resBalak6.caption.length > 0, 'Caption harus tidak kosong');
  assert(resBalak6.caption.includes('@sultanbantam') || resBalak6.caption.includes('sultanbantam'));
  assert(resBalak6.hashtags.includes('NutupBalak6'), 'Harus menyertakan hashtag #NutupBalak6');
  assert(resBalak6.hashtags.includes('GaplehIndonesia'), 'Harus menyertakan hashtag #GaplehIndonesia');
  console.log(`  ✅ PASS: Contoh Caption Balak 6: "${resBalak6.caption}"`);
  console.log(`  ✅ PASS: Hashtags: ${resBalak6.hashtags.join(', ')}`);

  // Test 2: Nutup Balak 0 Hook Generation
  console.log('\nTest 2: Viral Hook untuk Nutup Balak 0 (Nutup Zero 500 Poin)');
  const resBalak0 = GaplehShareService.generateShareContent({
    winType: 'nutup_balak0',
    username: 'jawara_kopi',
    points: 500,
    designTemplate: 'retro_warkop',
  });

  assert(resBalak0.caption.length > 0);
  assert(resBalak0.hashtags.includes('NutupBalak0'), 'Harus menyertakan hashtag #NutupBalak0');
  console.log(`  ✅ PASS: Contoh Caption Balak 0: "${resBalak0.caption}"`);

  // Test 3: Digapleh Hook Generation (Buntu tapi Menang 75 Poin)
  console.log('\nTest 3: Viral Hook untuk Digapleh (+75 Poin Flat)');
  const resDigapleh = GaplehShareService.generateShareContent({
    winType: 'digapleh',
    username: 'budi_bulu',
    points: 75,
    designTemplate: 'modern_minimalist',
  });

  assert(resDigapleh.caption.length > 0);
  assert(resDigapleh.hashtags.includes('Digapleh'), 'Harus menyertakan hashtag #Digapleh');
  assert(resDigapleh.caption.includes('DIGAPLEH') || resDigapleh.caption.includes('BUNTU'));
  console.log(`  ✅ PASS: Contoh Caption Digapleh: "${resDigapleh.caption}"`);

  // Test 4: First Time Nutup Balak 6 (3x Multiplier = 1.500 Poin)
  console.log('\nTest 4: Viral Hook untuk First Time Nutup (1.500 Poin Momen Bersejarah)');
  const resFirstNutup = GaplehShareService.generateShareContent({
    winType: 'nutup_balak6',
    username: 'pemula_hoki',
    points: 1500,
    isFirstNutup: true,
    designTemplate: 'cinematic_dramatic',
  });

  assert(resFirstNutup.hooks.some((h) => h.includes('PERTAMA KALI NUTUP')), 'Harus memuat hook first time nutup');
  console.log(`  ✅ PASS: Contoh Caption First Time: "${resFirstNutup.caption}"`);

  // Test 5: Streak Nutup Hook Generation
  console.log('\nTest 5: Viral Hook untuk Streak Kemenangan Nutup');
  const resStreak = GaplehShareService.generateShareContent({
    winType: 'nutup_balak6',
    username: 'bang_jago',
    points: 750,
    streakCount: 3,
  });

  assert(resStreak.hashtags.includes('Streak3x'), 'Harus memuat hashtag Streak3x');
  assert(resStreak.hooks.some((h) => h.includes('Streak') || h.includes('3x')), 'Harus memuat hook streak');
  console.log(`  ✅ PASS: Contoh Caption Streak: "${resStreak.caption}"`);

  // Test 6: Validasi Deep Link Sosial Media (WhatsApp, X, Facebook)
  console.log('\nTest 6: Validasi Format Deep Link Share Media Sosial');
  const links = resBalak6.shareLinks;

  assert(links.whatsapp.startsWith('https://wa.me/?text='), 'WhatsApp deep link harus valid');
  assert(links.twitter.startsWith('https://twitter.com/intent/tweet?'), 'Twitter deep link harus valid');
  assert(links.facebook.startsWith('https://www.facebook.com/sharer/sharer.php?'), 'Facebook sharer link harus valid');

  assert(links.whatsapp.includes('https%3A%2F%2Fngopi.top') || links.whatsapp.includes('ngopi.top'), 'WhatsApp link memuat URL ngopi.top');
  assert(links.twitter.includes('NgopiGapleh') || links.twitter.includes('GaplehIndonesia'), 'Twitter link memuat hashtags');

  console.log(`  ✅ PASS: WhatsApp Link: ${links.whatsapp.slice(0, 75)}...`);
  console.log(`  ✅ PASS: X (Twitter) Link: ${links.twitter.slice(0, 75)}...`);
  console.log(`  ✅ PASS: Facebook Link: ${links.facebook.slice(0, 75)}...`);

  // Test 7: Dukungan 4 Template Desain Kartu 9:16
  console.log('\nTest 7: Validasi Dukungan 4 Desain Template Kartu 9:16');
  const templates = ['neon_cyberpunk', 'retro_warkop', 'modern_minimalist', 'cinematic_dramatic'] as const;
  for (const t of templates) {
    const res = GaplehShareService.generateShareContent({
      winType: 'nutup_balak6',
      username: 'user_test',
      points: 500,
      designTemplate: t,
    });
    assert.strictEqual(res.designTemplate, t);
    console.log(`  ✅ PASS: Template '${t}' didukung penuh`);
  }

  console.log('\n================================================================');
  console.log('🎉 SPRINT 3 (FITUR SHARE SOSMED & VIRAL HOOK) 100% PASS!');
  console.log('================================================================');
}

runTests();
