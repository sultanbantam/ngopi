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
  category: 'ocular' | 'motor_nerve' | 'vocal_throat' | 'gastric' | 'skin_fungal' | 'skin_wart' | 'skin_eczema' | 'anemia_fatigue' | 'kidney_screen';
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
  findings: DetectedFinding[]
): CarePlanResult {
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
  if (profile.redFlagChestPain) redFlagReasons.push('Nyeri dada menjalar');
  if (profile.redFlagShortnessOfBreath) redFlagReasons.push('Sesak napas berat');
  if (profile.redFlagHighFever3Days) redFlagReasons.push('Demam tinggi > 3 hari');
  if (profile.redFlagPurulentWound) redFlagReasons.push('Luka bernanah luas');

  const safetyWarnings: string[] = [];
  if (profile.onBloodThinners) {
    safetyWarnings.push(
      'Peringatan Interaksi Pengencer Darah: Hindari jahe merah dosis tinggi dan ekstrak pegagan (Centella asiatica) pekat karena dapat meningkatkan risiko perdarahan.'
    );
  }
  if (profile.hasGerd) {
    safetyWarnings.push(
      'Peringatan GERD/Maag Akut: Batasi Vitamin C asam dosis tinggi, hindari kopi pekat saat perut kosong, dan utamakan Antasida 30 menit sebelum makan.'
    );
  }
  if (profile.isPregnantOrBreastfeeding) {
    safetyWarnings.push(
      'Peringatan Hamil/Menyusui: Penggunaan obat topikal steroid, asam salisilat, dan antihistamin oral wajib dikonsultasikan ke dokter atau bidan terlebih dahulu.'
    );
  }

  const otcList: OtcRecommendation[] = [];
  const herbalList: HerbalRecommendation[] = [];
  const schedule: DailyScheduleItem[] = [];

  if (categories.has('skin_fungal')) {
    const blocked = allergyText.includes('clotrimazole') || allergyText.includes('miconazole');
    otcList.push({
      id: 'otc-fungal',
      condition: 'Jamur / Panu / Kurap (Tinea)',
      activeIngredient: 'Krim Clotrimazole 1% atau Miconazole Nitrate 2%',
      categoryCircle: 'Biru (Obat Bebas Terbatas)',
      dosage: 'Oles tipis merata pada area bersih & kering (+2 cm tepi lesi)',
      frequency: '2x sehari (pagi & malam)',
      maxDuration: '2–4 minggu (lanjutkan 1 minggu setelah bercak pudar)',
      usageRule: 'Pemakaian luar; cuci tangan setelah mengoles, jaga kulit tetap kering.',
      blockedReason: blocked ? 'Dihentikan otomatis karena riwayat alergi antijamur azole.' : undefined,
    });
    herbalList.push({
      id: 'herb-fungal',
      condition: 'Jamur / Gatal Kulit Ringan',
      plantName: 'Daun Sirih Merah (Piper crocatum) & Lidah Buaya',
      partUsed: '3–5 lembar daun sirih merah segar / gel Aloe vera murni',
      dosageAmount: '500 ml air rebusan sirih (setelah dingin) / gel oles tipis',
      preparation: 'Rebus sirih 10 menit lalu dinginkan sebelum membasuh area gatal; oles gel lidah buaya dingin.',
      schedule: 'Basuh 1–2x sehari; gel lidah buaya 3x sehari.',
    });
    schedule.push({
      id: 'sch-fungal-am',
      timeSlot: '07:00 Pagi',
      action: 'Oles Krim Antijamur Tipis',
      detail: 'Clotrimazole 1% / Miconazole 2% setelah mandi & kulit dikeringkan sempurna.',
      type: 'otc',
    });
  }

  if (categories.has('skin_wart')) {
    otcList.push({
      id: 'otc-wart',
      condition: 'Kutil / Mata Ikan (Clavus)',
      activeIngredient: 'Plester / Larutan Salicylic Acid 10%–20%',
      categoryCircle: 'Biru (Obat Bebas Terbatas)',
      dosage: '1 olesan/plester tepat di titik kutil (lindungi kulit sehat sekitar dengan vaselin)',
      frequency: '1x sehari malam hari',
      maxDuration: 'Maksimal 4–6 minggu',
      usageRule: 'Rendam air hangat 5–10 menit sebelum aplikasi. Jangan gunakan pada wajah atau penderita diabetes tanpa izin dokter.',
      blockedReason: profile.isPregnantOrBreastfeeding
        ? 'Perlu konsultasi dokter selama kehamilan/menyusui.'
        : undefined,
    });
    schedule.push({
      id: 'sch-wart-pm',
      timeSlot: '20:30 Malam',
      action: 'Terapi Hipertermia Lokal 43°C + Salicylic Acid',
      detail: 'Kompres hangat bersih / medical warming patch 42–44°C selama 30 menit (bukan bodi HP!), lalu aplikasikan Salicylic Acid.',
      type: 'therapy',
    });
  }

  if (categories.has('skin_eczema')) {
    otcList.push({
      id: 'otc-eczema',
      condition: 'Eksim / Gatal Alergi Ringan',
      activeIngredient: 'Krim Hydrocortisone 1% (topikal) + Cetirizine 10 mg (oral)',
      categoryCircle: 'Biru (Obat Bebas Terbatas)',
      dosage: age < 12 ? 'Cetirizine 5 mg (setengah tablet); Calamine losion lebih aman' : 'Hydrocortisone oles tipis + Cetirizine 10 mg (1 tablet)',
      frequency: 'Hydrocortisone maks. 2x/hari; Cetirizine 1x/hari malam hari',
      maxDuration: 'Maksimal 5–7 hari untuk Hydrocortisone',
      usageRule: 'DILARANG kompres panas pada eksim meradang akut. Gunakan kompres dingin & pelembap.',
      blockedReason: profile.isPregnantOrBreastfeeding
        ? 'Konsultasikan ke dokter sebelum memakai Hydrocortisone/Cetirizine.'
        : undefined,
    });
    herbalList.push({
      id: 'herb-eczema',
      condition: 'Menenangkan Kulit Eksim/Iritasi',
      plantName: 'Gel Lidah Buaya (Aloe vera)',
      partUsed: 'Daging gel bening murni (dingin)',
      dosageAmount: 'Oles tipis merata (3–5 gram per area)',
      preparation: 'Dinginkan gel di kulkas 10 menit lalu oles lembut tanpa menggosok.',
      schedule: '3x sehari sesuai kebutuhan.',
    });
  }

  if (categories.has('ocular')) {
    otcList.push({
      id: 'otc-ocular',
      condition: 'Mata Kering Digital (Digital Eye Strain)',
      activeIngredient: 'Tetes Mata Sodium Hyaluronate 0,1% atau Carboxymethylcellulose',
      categoryCircle: 'Hijau (Obat Bebas)',
      dosage: '1–2 tetes pada masing-masing mata',
      frequency: '3–4x sehari saat layar intensif',
      maxDuration: 'Aman digunakan jangka harian (gunakan minidose bebas pengawet jika >4x/hari)',
      usageRule: 'Cuci tangan sebelum meneteskan; jangan menyentuhkan ujung botol ke mata.',
    });
    herbalList.push({
      id: 'herb-ocular',
      condition: 'Kesehatan Mata & Lelah Layar',
      plantName: 'Bunga Krisan (Chrysanthemum morifolium) & Ekstrak Bilberry',
      partUsed: 'Bunga krisan kering',
      dosageAmount: '3 gram bunga krisan dalam 200 ml air hangat',
      preparation: 'Seduh 5–7 menit dalam air 85°C, saring dan minum hangat tanpa gula berlebih.',
      schedule: '1–2x sehari (siang & sore).',
    });
    schedule.push({
      id: 'sch-ocular-noon',
      timeSlot: '12:30 Siang',
      action: 'Aturan 20-20-20 + Tetes Mata + Teh Krisan',
      detail: 'Tatap objek jarak 6 meter selama 20 detik, teteskan Sodium Hyaluronate 0,1%, seduh 3g bunga krisan.',
      type: 'herbal',
    });
  }

  if (categories.has('motor_nerve') || categories.has('anemia_fatigue')) {
    otcList.push({
      id: 'otc-nerve',
      condition: 'Kelelahan Saraf Jari, Tremor & Kelelahan Motorik',
      activeIngredient: 'Vitamin Neurotropik (B1 100 mg, B6 100 mg, B12 5000 mcg)',
      categoryCircle: 'Hijau (Obat Bebas)',
      dosage: age < 12 ? '1/2 tablet sesuai anjuran dokter anak' : '1 tablet',
      frequency: '1x sehari',
      maxDuration: '14–30 hari, evaluasi ulang bila tremor menetap',
      usageRule: 'Diminum sesudah makan pagi atau siang.',
    });
    herbalList.push({
      id: 'herb-nerve',
      condition: 'Kelelahan Saraf, Kognitif & Pergelangan Tangan',
      plantName: 'Daun Pegagan (Centella asiatica) & Minyak Sereh Wangi',
      partUsed: 'Daun pegagan kering + minyak atsiri topikal',
      dosageAmount: '2 gram daun pegagan seduh 200 ml air hangat',
      preparation: 'Seduh sore hari; pijat lembut pergelangan tangan dengan minyak sereh wangi / kayu putih.',
      schedule: '1x sehari sore hari.',
      interactionWarning: profile.onBloodThinners
        ? 'PERINGATAN: Dikurangi/ditunda karena interaksi dengan obat pengencer darah.'
        : undefined,
    });
    schedule.push({
      id: 'sch-nerve-pm',
      timeSlot: '16:30 Sore',
      action: 'Peregangan Pergelangan & Vitamin Neurotropik/Pegagan',
      detail: 'Lakukan peregangan jari 3 menit, pijat topikal minyak sereh wangi, konsumsi 2g teh pegagan (jika tidak minum pengencer darah).',
      type: 'herbal',
    });
  }

  if (categories.has('vocal_throat')) {
    otcList.push({
      id: 'otc-throat',
      condition: 'Suara Serak / Iritasi Tenggorokan (Aktivitas Telepon)',
      activeIngredient: 'Lozenges Antiseptik (Dequalinium Chloride / Amylmetacresol)',
      categoryCircle: 'Hijau (Obat Bebas)',
      dosage: '1 tablet hisap larut perlahan di mulut',
      frequency: 'Tiap 3–4 jam sesuai keluhan',
      maxDuration: 'Maksimal 6–8 tablet/hari selama 3–5 hari',
      usageRule: 'Jangan langsung minum/makan 15 menit setelah menghisap lozenges.',
    });
    herbalList.push({
      id: 'herb-throat',
      condition: 'Pita Suara & Tenggorokan Pasca Menelepon Lama',
      plantName: 'Rimpang Kencur (Kaempferia galanga) & Madu Murni',
      partUsed: 'Rimpang kencur segar + madu',
      dosageAmount: '3 gram kencur parut/iris + 150 ml air hangat + 1 sdt madu',
      preparation: 'Seduh kencur dengan air hangat 5 menit, saring, tambahkan 1 sdt madu murni.',
      schedule: '2x sehari (pagi & malam).',
    });
  }

  if (categories.has('gastric')) {
    otcList.push({
      id: 'otc-gastric',
      condition: 'Lambung / Dispepsia Ringan',
      activeIngredient: 'Antasida Doen (Aluminium Hydroxide 200 mg + Magnesium Hydroxide 200 mg)',
      categoryCircle: 'Hijau (Obat Bebas)',
      dosage: weightKg < 45 ? '1 tablet kunyah' : '1–2 tablet dikunyah halus',
      frequency: '3x sehari saat gejala atau sebelum makan',
      maxDuration: 'Maksimal 7–14 hari berturut-turut',
      usageRule: 'Kunyah 30 menit sebelum makan atau 1–2 jam sesudah makan; beri jarak 2 jam dari obat lain.',
    });
    herbalList.push({
      id: 'herb-gastric',
      condition: 'Dukungan Pencernaan & Lambung',
      plantName: 'Temulawak (Curcuma xanthorrhiza) / Jahe Merah',
      partUsed: 'Rimpang segar atau kering',
      dosageAmount: '3 gram temulawak (atau 2 gram jahe merah) dalam 150 ml air hangat',
      preparation: 'Seduh dengan air panas selama 10 menit, minum hangat sebelum atau sesudah makan.',
      schedule: '2x sehari.',
      interactionWarning: profile.onBloodThinners
        ? 'PERINGATAN: Hindari jahe merah dosis tinggi karena berinteraksi dengan pengencer darah; pilih temulawak ringan.'
        : undefined,
    });
  }

  const waterMinMl = Math.round(weightKg * 30);
  const waterMaxMl = Math.round(weightKg * 35);

  const recommendedFoods = [
    `Air putih terukur: ${waterMinMl.toLocaleString('id-ID')}–${waterMaxMl.toLocaleString('id-ID')} ml/hari (berdasarkan berat badan ${weightKg} kg)`,
    'Pisang (1–2 buah / ±120g) & kacang almond (25g) kaya Magnesium & Kalium untuk meredakan tremor kelelahan jari',
  ];
  if (categories.has('anemia_fatigue')) {
    recommendedFoods.push('Bayam merah (100g) atau hati ayam (60g) + jeruk tinggi Vitamin C untuk pucat konjungtiva & energi');
  }
  if (categories.has('ocular')) {
    recommendedFoods.push('Wortel kukus (80g) / ubi jalar & ikan kembung/salmon (100g) kaya Beta-karoten dan Omega-3 untuk mata');
  }
  if (!profile.hasGerd) {
    recommendedFoods.push('Buah tinggi antioksidan (pepaya 150g / jambu biji 100g) untuk pemulihan jaringan');
  }

  const avoidFoods = ['Kurangi minuman bersoda & tinggi gula rafinasi sebelum tidur'];
  if (categories.has('vocal_throat') || categories.has('gastric')) {
    avoidFoods.push('Hindari kopi pekat berlebih saat perut kosong, gorengan berminyak, dan makanan terlalu pedas/asam');
  }

  schedule.push({
    id: 'sch-hydrate-am',
    timeSlot: '07:00 Pagi',
    action: 'Hidrasi Awal & Sarapan Seimbang',
    detail: `Minum 350 ml air hangat (target harian ${waterMinMl}–${waterMaxMl} ml) + sarapan sebelum obat/vitamin.`,
    type: 'nutrition',
  });

  if (!schedule.some((s) => s.timeSlot === '20:30 Malam')) {
    schedule.push({
      id: 'sch-night-rest',
      timeSlot: '20:30 Malam',
      action: 'Protokol Pemulihan Malam & Tidur Berkualitas',
      detail: 'Aktifkan mode malam layar, hentikan stimulan kafein, lakukan peregangan leher 5 menit sebelum tidur.',
      type: 'therapy',
    });
  }

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
