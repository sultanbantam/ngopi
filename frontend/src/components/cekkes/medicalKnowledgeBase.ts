export type ClinicalSeverity = 'normal' | 'perhatian' | 'waspada';

export interface UserHealthProfile {
  age: number;
  weightKg: number;
  allergies: string;
  isPregnantOrBreastfeeding: boolean;
  onBloodThinners: boolean;
  hasGerd: boolean;
  redFlagChestPain: boolean;
  redFlagShortnessOfBreath: boolean;
  redFlagHighFever3Days: boolean;
  redFlagPurulentWound: boolean;
}

export interface DetectedFinding {
  id: string;
  title: string;
  source: 'passive' | 'active';
  severity: ClinicalSeverity;
  category: 'ocular' | 'motor_nerve' | 'vocal_throat' | 'gastric' | 'skin_fungal' | 'skin_wart' | 'skin_eczema' | 'anemia_fatigue' | 'kidney_screen' | 'activity_recovery' | 'sedentary_risk';
  summary: string;
}

export interface OtcRecommendation {
  id: string;
  condition: string;
  activeIngredient: string;
  categoryCircle: 'Hijau (Obat Bebas)' | 'Biru (Obat Bebas Terbatas)';
  dosage: string;
  frequency: string;
  maxDuration: string;
  usageRule: string;
  blockedReason?: string;
}

export interface HerbalRecommendation {
  id: string;
  condition: string;
  plantName: string;
  partUsed: string;
  dosageAmount: string;
  preparation: string;
  schedule: string;
  interactionWarning?: string;
}

export interface NutritionPlan {
  waterMinMl: number;
  waterMaxMl: number;
  recommendedFoods: string[];
  avoidFoods: string[];
}

export interface DailyScheduleItem {
  id: string;
  timeSlot: '07:00 Pagi' | '12:30 Siang' | '16:30 Sore' | '20:30 Malam';
  action: string;
  detail: string;
  type: 'otc' | 'herbal' | 'nutrition' | 'therapy';
}

export interface CarePlanResult {
  hasRedFlag: boolean;
  redFlagReasons: string[];
  safetyWarnings: string[];
  otcList: OtcRecommendation[];
  herbalList: HerbalRecommendation[];
  nutrition: NutritionPlan;
  schedule: DailyScheduleItem[];
}

export function generateAutonomousCarePlan(
  profile: UserHealthProfile,
  findings: DetectedFinding[],
  lang: 'id' | 'en' = 'id'
): CarePlanResult {
  const isEn = lang === 'en';
  const age = Math.max(1, Number(profile.age) || 28);
  const weightKg = Math.max(15, Number(profile.weightKg) || 62);
  const allergyText = (profile.allergies || '').toLowerCase();
  const categories = new Set(findings.map((f) => f.category));

  // If no findings yet, include baseline preventive recommendations for screen/warkop users
  if (categories.size === 0) {
    categories.add('ocular');
    categories.add('motor_nerve');
  }

  const redFlagReasons: string[] = [];
  if (profile.redFlagChestPain) redFlagReasons.push(isEn ? 'Radiating chest pain' : 'Nyeri dada menjalar');
  if (profile.redFlagShortnessOfBreath) redFlagReasons.push(isEn ? 'Severe shortness of breath' : 'Sesak napas berat');
  if (profile.redFlagHighFever3Days) redFlagReasons.push(isEn ? 'High fever > 3 days' : 'Demam tinggi > 3 hari');
  if (profile.redFlagPurulentWound) redFlagReasons.push(isEn ? 'Spreading purulent wound' : 'Luka bernanah luas');

  const safetyWarnings: string[] = [];
  if (profile.onBloodThinners) {
    safetyWarnings.push(
      isEn
        ? 'Blood Thinner Interaction Warning: Avoid high-dose red ginger and concentrated Centella asiatica (Gotu Kola) extract as they may increase bleeding risk.'
        : 'Peringatan Interaksi Pengencer Darah: Hindari jahe merah dosis tinggi dan ekstrak pegagan (Centella asiatica) pekat karena dapat meningkatkan risiko perdarahan.'
    );
  }
  if (profile.hasGerd) {
    safetyWarnings.push(
      isEn
        ? 'Acute GERD/Gastritis Warning: Limit high-dose acidic Vitamin C, avoid strong coffee on an empty stomach, and take Antacids 30 minutes before meals.'
        : 'Peringatan GERD/Maag Akut: Batasi Vitamin C asam dosis tinggi, hindari kopi pekat saat perut kosong, dan utamakan Antasida 30 menit sebelum makan.'
    );
  }
  if (profile.isPregnantOrBreastfeeding) {
    safetyWarnings.push(
      isEn
        ? 'Pregnancy/Breastfeeding Warning: Topical steroids, salicylic acid, and oral antihistamines require physician or midwife approval first.'
        : 'Peringatan Hamil/Menyusui: Penggunaan obat topikal steroid, asam salisilat, dan antihistamin oral wajib dikonsultasikan ke dokter atau bidan terlebih dahulu.'
    );
  }

  const otcList: OtcRecommendation[] = [];
  const herbalList: HerbalRecommendation[] = [];
  const schedule: DailyScheduleItem[] = [];

  if (categories.has('skin_fungal')) {
    const blocked = allergyText.includes('clotrimazole') || allergyText.includes('miconazole');
    otcList.push({
      id: 'otc-fungal',
      condition: isEn ? 'Fungal Skin / Tinea' : 'Jamur / Panu / Kurap (Tinea)',
      activeIngredient: isEn ? 'Clotrimazole 1% or Miconazole Nitrate 2% Cream' : 'Krim Clotrimazole 1% atau Miconazole Nitrate 2%',
      categoryCircle: 'Biru (Obat Bebas Terbatas)',
      dosage: isEn ? 'Apply thin layer on clean, dry skin (+2 cm beyond lesion edge)' : 'Oles tipis merata pada area bersih & kering (+2 cm tepi lesi)',
      frequency: isEn ? '2x daily (morning & night)' : '2x sehari (pagi & malam)',
      maxDuration: isEn ? '2–4 weeks (continue 1 week after fading)' : '2–4 minggu (lanjutkan 1 minggu setelah bercak pudar)',
      usageRule: isEn ? 'External use only; wash hands after applying, keep skin dry.' : 'Pemakaian luar; cuci tangan setelah mengoles, jaga kulit tetap kering.',
      blockedReason: blocked ? (isEn ? 'Auto-blocked due to azole antifungal allergy.' : 'Dihentikan otomatis karena riwayat alergi antijamur azole.') : undefined,
    });
    herbalList.push({
      id: 'herb-fungal',
      condition: isEn ? 'Mild Skin Fungal / Itch' : 'Jamur / Gatal Kulit Ringan',
      plantName: isEn ? 'Red Betel Leaf (Piper crocatum) & Aloe Vera' : 'Daun Sirih Merah (Piper crocatum) & Lidah Buaya',
      partUsed: isEn ? '3–5 fresh red betel leaves / pure Aloe vera gel' : '3–5 lembar daun sirih merah segar / gel Aloe vera murni',
      dosageAmount: isEn ? '500 ml cooled boiled betel water / thin gel layer' : '500 ml air rebusan sirih (setelah dingin) / gel oles tipis',
      preparation: isEn ? 'Boil betel leaves 10 mins, cool before rinsing; apply chilled aloe gel.' : 'Rebus sirih 10 menit lalu dinginkan sebelum membasuh area gatal; oles gel lidah buaya dingin.',
      schedule: isEn ? 'Rinse 1–2x daily; aloe gel 3x daily.' : 'Basuh 1–2x sehari; gel lidah buaya 3x sehari.',
    });
    schedule.push({
      id: 'sch-fungal-am',
      timeSlot: '07:00 Pagi',
      action: isEn ? 'Apply Thin Antifungal Cream' : 'Oles Krim Antijamur Tipis',
      detail: isEn ? 'Clotrimazole 1% / Miconazole 2% after shower on completely dry skin.' : 'Clotrimazole 1% / Miconazole 2% setelah mandi & kulit dikeringkan sempurna.',
      type: 'otc',
    });
  }

  if (categories.has('skin_wart')) {
    otcList.push({
      id: 'otc-wart',
      condition: isEn ? 'Wart / Corn (Clavus)' : 'Kutil / Mata Ikan (Clavus)',
      activeIngredient: isEn ? 'Salicylic Acid 10%–20% Patch / Solution' : 'Plester / Larutan Salicylic Acid 10%–20%',
      categoryCircle: 'Biru (Obat Bebas Terbatas)',
      dosage: isEn ? '1 drop/patch directly on wart (protect surrounding skin with petroleum jelly)' : '1 olesan/plester tepat di titik kutil (lindungi kulit sehat sekitar dengan vaselin)',
      frequency: isEn ? '1x daily at night' : '1x sehari malam hari',
      maxDuration: isEn ? 'Up to 4–6 weeks' : 'Maksimal 4–6 minggu',
      usageRule: isEn ? 'Soak in warm water 5–10 mins before use. Avoid face or diabetic skin without doctor approval.' : 'Rendam air hangat 5–10 menit sebelum aplikasi. Jangan gunakan pada wajah atau penderita diabetes tanpa izin dokter.',
      blockedReason: profile.isPregnantOrBreastfeeding
        ? (isEn ? 'Consult a doctor during pregnancy/breastfeeding.' : 'Perlu konsultasi dokter selama kehamilan/menyusui.')
        : undefined,
    });
    schedule.push({
      id: 'sch-wart-pm',
      timeSlot: '20:30 Malam',
      action: isEn ? 'Local Hyperthermia 43°C + Salicylic Acid' : 'Terapi Hipertermia Lokal 43°C + Salicylic Acid',
      detail: isEn ? 'Use clean warm compress / medical warming patch 42–44°C for 30 mins (never phone body!), then apply Salicylic Acid.' : 'Kompres hangat bersih / medical warming patch 42–44°C selama 30 menit (bukan bodi HP!), lalu aplikasikan Salicylic Acid.',
      type: 'therapy',
    });
  }

  if (categories.has('skin_eczema')) {
    otcList.push({
      id: 'otc-eczema',
      condition: isEn ? 'Mild Eczema / Allergic Dermatitis' : 'Eksim / Gatal Alergi Ringan',
      activeIngredient: isEn ? 'Hydrocortisone 1% Cream (topical) + Cetirizine 10 mg (oral)' : 'Krim Hydrocortisone 1% (topikal) + Cetirizine 10 mg (oral)',
      categoryCircle: 'Biru (Obat Bebas Terbatas)',
      dosage: age < 12 ? (isEn ? 'Cetirizine 5 mg; Calamine lotion preferred' : 'Cetirizine 5 mg (setengah tablet); Calamine losion lebih aman') : (isEn ? 'Thin Hydrocortisone + Cetirizine 10 mg (1 tablet)' : 'Hydrocortisone oles tipis + Cetirizine 10 mg (1 tablet)'),
      frequency: isEn ? 'Hydrocortisone max 2x/day; Cetirizine 1x/day at night' : 'Hydrocortisone maks. 2x/hari; Cetirizine 1x/hari malam hari',
      maxDuration: isEn ? 'Max 5–7 days for Hydrocortisone' : 'Maksimal 5–7 hari untuk Hydrocortisone',
      usageRule: isEn ? 'DO NOT apply heat to acute inflamed eczema. Use cool compress & moisturizer.' : 'DILARANG kompres panas pada eksim meradang akut. Gunakan kompres dingin & pelembap.',
      blockedReason: profile.isPregnantOrBreastfeeding
        ? (isEn ? 'Consult a doctor before using Hydrocortisone/Cetirizine.' : 'Konsultasikan ke dokter sebelum memakai Hydrocortisone/Cetirizine.')
        : undefined,
    });
    herbalList.push({
      id: 'herb-eczema',
      condition: isEn ? 'Soothing Eczema / Irritated Skin' : 'Menenangkan Kulit Eksim/Iritasi',
      plantName: isEn ? 'Aloe Vera Cooling Gel' : 'Gel Lidah Buaya (Aloe vera)',
      partUsed: isEn ? 'Pure inner leaf gel (chilled)' : 'Daging gel bening murni (dingin)',
      dosageAmount: isEn ? 'Thin even layer (3–5 grams per area)' : 'Oles tipis merata (3–5 gram per area)',
      preparation: isEn ? 'Chill gel in fridge for 10 mins, apply gently without rubbing.' : 'Dinginkan gel di kulkas 10 menit lalu oles lembut tanpa menggosok.',
      schedule: isEn ? '3x daily as needed.' : '3x sehari sesuai kebutuhan.',
    });
  }

  if (categories.has('ocular')) {
    otcList.push({
      id: 'otc-ocular',
      condition: isEn ? 'Digital Eye Strain / Dry Eyes' : 'Mata Kering Digital (Digital Eye Strain)',
      activeIngredient: isEn ? 'Sodium Hyaluronate 0.1% or Carboxymethylcellulose Eye Drops' : 'Tetes Mata Sodium Hyaluronate 0,1% atau Carboxymethylcellulose',
      categoryCircle: 'Hijau (Obat Bebas)',
      dosage: isEn ? '1–2 drops per eye' : '1–2 tetes pada masing-masing mata',
      frequency: isEn ? '3–4x daily during heavy screen use' : '3–4x sehari saat layar intensif',
      maxDuration: isEn ? 'Safe for daily use (use preservative-free minidose if >4x/day)' : 'Aman digunakan jangka harian (gunakan minidose bebas pengawet jika >4x/hari)',
      usageRule: isEn ? 'Wash hands before use; avoid touching dropper tip to eye.' : 'Cuci tangan sebelum meneteskan; jangan menyentuhkan ujung botol ke mata.',
    });
    herbalList.push({
      id: 'herb-ocular',
      condition: isEn ? 'Ocular Wellness & Screen Fatigue' : 'Kesehatan Mata & Lelah Layar',
      plantName: isEn ? 'Chrysanthemum Flower (Chrysanthemum morifolium) & Bilberry' : 'Bunga Krisan (Chrysanthemum morifolium) & Ekstrak Bilberry',
      partUsed: isEn ? 'Dried chrysanthemum flowers' : 'Bunga krisan kering',
      dosageAmount: isEn ? '3 grams dried flowers in 200 ml warm water' : '3 gram bunga krisan dalam 200 ml air hangat',
      preparation: isEn ? 'Steep 5–7 mins in 85°C water, strain and drink warm without excess sugar.' : 'Seduh 5–7 menit dalam air 85°C, saring dan minum hangat tanpa gula berlebih.',
      schedule: isEn ? '1–2x daily (noon & afternoon).' : '1–2x sehari (siang & sore).',
    });
    schedule.push({
      id: 'sch-ocular-noon',
      timeSlot: '12:30 Siang',
      action: isEn ? '20-20-20 Eye Rule + Lubricant Drops + Chrysanthemum Tea' : 'Aturan 20-20-20 + Tetes Mata + Teh Krisan',
      detail: isEn ? 'Look 6 meters away for 20s, apply Sodium Hyaluronate 0.1%, steep 3g chrysanthemum tea.' : 'Tatap objek jarak 6 meter selama 20 detik, teteskan Sodium Hyaluronate 0,1%, seduh 3g bunga krisan.',
      type: 'herbal',
    });
  }

  if (categories.has('motor_nerve') || categories.has('anemia_fatigue')) {
    otcList.push({
      id: 'otc-nerve',
      condition: isEn ? 'Finger Nerve Fatigue, Tremor & Motor Strain' : 'Kelelahan Saraf Jari, Tremor & Kelelahan Motorik',
      activeIngredient: isEn ? 'Neurotropic Vitamins (B1 100 mg, B6 100 mg, B12 5000 mcg)' : 'Vitamin Neurotropik (B1 100 mg, B6 100 mg, B12 5000 mcg)',
      categoryCircle: 'Hijau (Obat Bebas)',
      dosage: age < 12 ? (isEn ? '1/2 tablet per pediatrician advice' : '1/2 tablet sesuai anjuran dokter anak') : (isEn ? '1 tablet' : '1 tablet'),
      frequency: isEn ? '1x daily' : '1x sehari',
      maxDuration: isEn ? '14–30 days; re-evaluate if tremor persists' : '14–30 hari, evaluasi ulang bila tremor menetap',
      usageRule: isEn ? 'Take after breakfast or lunch.' : 'Diminum sesudah makan pagi atau siang.',
    });
    herbalList.push({
      id: 'herb-nerve',
      condition: isEn ? 'Nerve Fatigue, Focus & Wrist Strain' : 'Kelelahan Saraf, Kognitif & Pergelangan Tangan',
      plantName: isEn ? 'Gotu Kola Leaf (Centella asiatica) & Citronella Oil' : 'Daun Pegagan (Centella asiatica) & Minyak Sereh Wangi',
      partUsed: isEn ? 'Dried Gotu Kola leaves + topical essential oil' : 'Daun pegagan kering + minyak atsiri topikal',
      dosageAmount: isEn ? '2 grams Gotu Kola steeped in 200 ml warm water' : '2 gram daun pegagan seduh 200 ml air hangat',
      preparation: isEn ? 'Steep in the afternoon; gently massage wrist with citronella / eucalyptus oil.' : 'Seduh sore hari; pijat lembut pergelangan tangan dengan minyak sereh wangi / kayu putih.',
      schedule: isEn ? '1x daily in the afternoon.' : '1x sehari sore hari.',
      interactionWarning: profile.onBloodThinners
        ? (isEn ? 'WARNING: Reduced/held due to blood thinner interaction.' : 'PERINGATAN: Dikurangi/ditunda karena interaksi dengan obat pengencer darah.')
        : undefined,
    });
    schedule.push({
      id: 'sch-nerve-pm',
      timeSlot: '16:30 Sore',
      action: isEn ? 'Wrist Stretch & Neurotropic Vitamin / Gotu Kola' : 'Peregangan Pergelangan & Vitamin Neurotropik/Pegagan',
      detail: isEn ? '3-min finger stretch, gentle citronella wrist massage, 2g Gotu Kola tea (if not on blood thinners).' : 'Lakukan peregangan jari 3 menit, pijat topikal minyak sereh wangi, konsumsi 2g teh pegagan (jika tidak minum pengencer darah).',
      type: 'herbal',
    });
  }

  if (categories.has('vocal_throat')) {
    otcList.push({
      id: 'otc-throat',
      condition: isEn ? 'Hoarse Voice / Throat Irritation (Calls)' : 'Suara Serak / Iritasi Tenggorokan (Aktivitas Telepon)',
      activeIngredient: isEn ? 'Antiseptic Lozenges (Dequalinium Chloride / Amylmetacresol)' : 'Lozenges Antiseptik (Dequalinium Chloride / Amylmetacresol)',
      categoryCircle: 'Hijau (Obat Bebas)',
      dosage: isEn ? '1 lozenge dissolved slowly in mouth' : '1 tablet hisap larut perlahan di mulut',
      frequency: isEn ? 'Every 3–4 hours as needed' : 'Tiap 3–4 jam sesuai keluhan',
      maxDuration: isEn ? 'Max 6–8 lozenges/day for 3–5 days' : 'Maksimal 6–8 tablet/hari selama 3–5 hari',
      usageRule: isEn ? 'Avoid eating/drinking for 15 mins after dissolving.' : 'Jangan langsung minum/makan 15 menit setelah menghisap lozenges.',
    });
    herbalList.push({
      id: 'herb-throat',
      condition: isEn ? 'Vocal Cord & Throat Recovery' : 'Pita Suara & Tenggorokan Pasca Menelepon Lama',
      plantName: isEn ? 'Galangal / Kencur (Kaempferia galanga) & Raw Honey' : 'Rimpang Kencur (Kaempferia galanga) & Madu Murni',
      partUsed: isEn ? 'Fresh kencur rhizome + honey' : 'Rimpang kencur segar + madu',
      dosageAmount: isEn ? '3 grams grated kencur + 150 ml warm water + 1 tsp honey' : '3 gram kencur parut/iris + 150 ml air hangat + 1 sdt madu',
      preparation: isEn ? 'Steep kencur in warm water 5 mins, strain, stir in 1 tsp raw honey.' : 'Seduh kencur dengan air hangat 5 menit, saring, tambahkan 1 sdt madu murni.',
      schedule: isEn ? '2x daily (morning & night).' : '2x sehari (pagi & malam).',
    });
  }

  if (categories.has('gastric')) {
    otcList.push({
      id: 'otc-gastric',
      condition: isEn ? 'Mild Gastric Discomfort / Dyspepsia' : 'Lambung / Dispepsia Ringan',
      activeIngredient: isEn ? 'Antacid (Aluminium Hydroxide 200 mg + Magnesium Hydroxide 200 mg)' : 'Antasida Doen (Aluminium Hydroxide 200 mg + Magnesium Hydroxide 200 mg)',
      categoryCircle: 'Hijau (Obat Bebas)',
      dosage: weightKg < 45 ? (isEn ? '1 chewable tablet' : '1 tablet kunyah') : (isEn ? '1–2 tablets chewed thoroughly' : '1–2 tablet dikunyah halus'),
      frequency: isEn ? '3x daily before meals or at symptom onset' : '3x sehari saat gejala atau sebelum makan',
      maxDuration: isEn ? 'Max 7–14 consecutive days' : 'Maksimal 7–14 hari berturut-turut',
      usageRule: isEn ? 'Chew 30 mins before meals or 1–2h after; space 2h from other meds.' : 'Kunyah 30 menit sebelum makan atau 1–2 jam sesudah makan; beri jarak 2 jam dari obat lain.',
    });
    herbalList.push({
      id: 'herb-gastric',
      condition: isEn ? 'Digestive & Gastric Support' : 'Dukungan Pencernaan & Lambung',
      plantName: isEn ? 'Java Turmeric (Curcuma xanthorrhiza) / Red Ginger' : 'Temulawak (Curcuma xanthorrhiza) / Jahe Merah',
      partUsed: isEn ? 'Fresh or dried rhizome' : 'Rimpang segar atau kering',
      dosageAmount: isEn ? '3 grams Java turmeric (or 2g red ginger) in 150 ml warm water' : '3 gram temulawak (atau 2 gram jahe merah) dalam 150 ml air hangat',
      preparation: isEn ? 'Steep in hot water 10 mins, drink warm before or after meals.' : 'Seduh dengan air panas selama 10 menit, minum hangat sebelum atau sesudah makan.',
      schedule: isEn ? '2x daily.' : '2x sehari.',
      interactionWarning: profile.onBloodThinners
        ? (isEn ? 'WARNING: Avoid high-dose red ginger due to blood thinner interaction; choose mild Java turmeric.' : 'PERINGATAN: Hindari jahe merah dosis tinggi karena berinteraksi dengan pengencer darah; pilih temulawak ringan.')
        : undefined,
    });
  }

  const extraHydrationMl = categories.has('activity_recovery') ? 600 : 0;
  const waterMinMl = Math.round(weightKg * 30) + extraHydrationMl;
  const waterMaxMl = Math.round(weightKg * 35) + extraHydrationMl;

  if (categories.has('activity_recovery')) {
    otcList.push({
      id: 'otc-move-recovery',
      condition: isEn ? 'Post-Run / High-Step Muscle & Calf Recovery' : 'Pemulihan Otot Betis & Sendi Pasca Lari / Langkah Tinggi',
      activeIngredient: isEn ? 'Topical Menthol / Methyl Salicylate Gel + Oral Electrolyte' : 'Gel Topikal Menthol / Methyl Salicylate + Larutan Elektrolit',
      categoryCircle: 'Biru (Obat Bebas Terbatas)',
      dosage: isEn ? 'Apply thin layer on sore calves/thighs + 1 sachet oral electrolyte in 250 ml water' : 'Oles tipis di betis/paha pegal + 1 sachet elektrolit dalam 250 ml air',
      frequency: isEn ? '1–2x after workout' : '1–2x setelah olahraga',
      maxDuration: isEn ? 'Max 5–7 days; avoid broken skin' : 'Maksimal 5–7 hari; jangan dioles pada kulit luka',
      usageRule: isEn ? 'Wash hands after applying topical gel; avoid eyes.' : 'Cuci tangan setelah mengoles gel; hindari area mata.',
    });
    herbalList.push({
      id: 'herb-move-recovery',
      condition: isEn ? 'Post-Exercise Muscle Soreness & Circulation' : 'Pegal Otot & Sirkulasi Pasca Jalan/Lari',
      plantName: isEn ? 'Red Ginger (Zingiber officinale) & Citronella Oil Rub' : 'Jahe Merah Hangat (Zingiber officinale) & Oles Minyak Sereh Wangi',
      partUsed: isEn ? 'Fresh red ginger rhizome + topical essential oil' : 'Rimpang jahe merah + minyak sereh wangi topikal',
      dosageAmount: isEn ? '2 grams sliced red ginger in 200 ml warm water' : '2 gram irisan jahe merah seduh 200 ml air hangat',
      preparation: isEn ? 'Steep 5–8 mins, drink warm; gently massage calves with citronella oil.' : 'Seduh 5–8 menit lalu minum hangat; pijat lembut betis dengan minyak sereh wangi.',
      schedule: isEn ? 'After workout or evening.' : 'Setelah olahraga atau sore/malam.',
      interactionWarning: profile.onBloodThinners
        ? (isEn ? 'WARNING: Limit red ginger if on blood thinners.' : 'PERINGATAN: Batasi jahe merah jika mengonsumsi pengencer darah.')
        : undefined,
    });
    schedule.push({
      id: 'sch-move-recovery',
      timeSlot: '16:30 Sore',
      action: isEn ? 'Post-Workout Electrolyte (+600 ml) & Calf Recovery' : 'Elektrolit Pasca Lari (+600 ml) & Pemulihan Otot',
      detail: isEn
        ? 'Drink 500–600 ml coconut water / light electrolyte, eat banana + protein, steep 2g warm red ginger.'
        : 'Minum 500–600 ml air kelapa murni / elektrolit ringan, makan pisang + protein, seduh 2g jahe merah hangat.',
      type: 'nutrition',
    });
  }

  if (categories.has('sedentary_risk')) {
    schedule.push({
      id: 'sch-sedentary-walk',
      timeSlot: '12:30 Siang',
      action: isEn ? '15-Min Brisk Walk (1,500 Steps) Break' : 'Jalan Kaki Aktif 15 Menit (1.500 Langkah)',
      detail: isEn
        ? 'Stand up and walk 15 mins to boost blood circulation and relieve neck/eye screen tension.'
        : 'Berdiri dan berjalan kaki 15 menit untuk melancarkan sirkulasi darah & menurunkan ketegangan leher/mata.',
      type: 'therapy',
    });
  }

  const recommendedFoods = isEn
    ? [
        `Measured daily water: ${waterMinMl.toLocaleString('en-US')}–${waterMaxMl.toLocaleString('en-US')} ml/day (based on ${weightKg} kg body weight)`,
        'Bananas (1–2 pcs / ~120g) & almonds (25g) rich in Magnesium & Potassium to ease finger fatigue',
      ]
    : [
        `Air putih terukur: ${waterMinMl.toLocaleString('id-ID')}–${waterMaxMl.toLocaleString('id-ID')} ml/hari (berdasarkan berat badan ${weightKg} kg)`,
        'Pisang (1–2 buah / ±120g) & kacang almond (25g) kaya Magnesium & Kalium untuk meredakan tremor kelelahan jari',
      ];
  if (categories.has('anemia_fatigue')) {
    recommendedFoods.push(
      isEn
        ? 'Red spinach (100g) or chicken liver (60g) + Vitamin C citrus for conjunctival pallor & energy'
        : 'Bayam merah (100g) atau hati ayam (60g) + jeruk tinggi Vitamin C untuk pucat konjungtiva & energi'
    );
  }
  if (categories.has('ocular')) {
    recommendedFoods.push(
      isEn
        ? 'Steamed carrots (80g) / sweet potato & mackerel/salmon (100g) rich in Beta-carotene & Omega-3'
        : 'Wortel kukus (80g) / ubi jalar & ikan kembung/salmon (100g) kaya Beta-karoten dan Omega-3 untuk mata'
    );
  }
  if (!profile.hasGerd) {
    recommendedFoods.push(
      isEn
        ? 'Antioxidant-rich fruit (papaya 150g / guava 100g) for tissue recovery'
        : 'Buah tinggi antioksidan (pepaya 150g / jambu biji 100g) untuk pemulihan jaringan'
    );
  }

  const avoidFoods = [
    isEn
      ? 'Limit carbonated & high refined-sugar drinks before bedtime'
      : 'Kurangi minuman bersoda & tinggi gula rafinasi sebelum tidur',
  ];
  if (categories.has('vocal_throat') || categories.has('gastric')) {
    avoidFoods.push(
      isEn
        ? 'Avoid strong coffee on an empty stomach, greasy fried foods, and overly spicy/acidic meals'
        : 'Hindari kopi pekat berlebih saat perut kosong, gorengan berminyak, dan makanan terlalu pedas/asam'
    );
  }

  schedule.push({
    id: 'sch-hydrate-am',
    timeSlot: '07:00 Pagi',
    action: isEn ? 'Morning Hydration & Balanced Breakfast' : 'Hidrasi Awal & Sarapan Seimbang',
    detail: isEn
      ? `Drink 350 ml warm water (daily target ${waterMinMl}–${waterMaxMl} ml) + breakfast before meds/vitamins.`
      : `Minum 350 ml air hangat (target harian ${waterMinMl}–${waterMaxMl} ml) + sarapan sebelum obat/vitamin.`,
    type: 'nutrition',
  });

  if (!schedule.some((s) => s.timeSlot === '20:30 Malam')) {
    schedule.push({
      id: 'sch-night-rest',
      timeSlot: '20:30 Malam',
      action: isEn ? 'Evening Recovery & Quality Sleep Protocol' : 'Protokol Pemulihan Malam & Tidur Berkualitas',
      detail: isEn
        ? 'Enable screen night mode, stop caffeine stimulants, do 5-min neck stretches before bed.'
        : 'Aktifkan mode malam layar, hentikan stimulan kafein, lakukan peregangan leher 5 menit sebelum tidur.',
      type: 'therapy',
    });
  }

  const TIME_SLOT_ORDER: Record<DailyScheduleItem['timeSlot'], number> = {
    '07:00 Pagi': 1,
    '12:30 Siang': 2,
    '16:30 Sore': 3,
    '20:30 Malam': 4,
  };
  schedule.sort((a, b) => (TIME_SLOT_ORDER[a.timeSlot] ?? 99) - (TIME_SLOT_ORDER[b.timeSlot] ?? 99));

  return {
    hasRedFlag: redFlagReasons.length > 0,
    redFlagReasons,
    safetyWarnings,
    otcList,
    herbalList,
    nutrition: {
      waterMinMl,
      waterMaxMl,
      recommendedFoods,
      avoidFoods,
    },
    schedule,
  };
}
