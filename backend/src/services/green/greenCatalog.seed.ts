import { prisma as defaultPrisma } from '../../utils/prisma';

export const GREEN_CATEGORIES_SEED = [
  {
    code: 'mobility',
    name_id: 'Transportasi Ramah Lingkungan',
    name_en: 'Green Mobility',
    description_id: 'Jalan kaki, sepeda, KRL/MRT/LRT, bus/angkot, kapal penumpang, dan kendaraan listrik.',
    description_en: 'Walking, cycling, commuter rail/MRT/LRT, bus/minibus, ferry, and electric vehicles.',
    icon: 'bicycle-outline',
    sort_order: 1,
  },
  {
    code: 'waste',
    name_id: 'Pilah Sampah & Ecobrick',
    name_en: 'Eco Waste & Ecobrick',
    description_id: 'Ecobrick terukur, pilah plastik (PET/HDPE/LDPE/PP), setor bank sampah, kompos, dan e-waste.',
    description_en: 'Measured ecobricks, plastic sorting, bank sampah delivery, composting, and e-waste.',
    icon: 'trash-bin-outline',
    sort_order: 2,
  },
  {
    code: 'food_waste',
    name_id: 'Kurangi Limbah Makanan',
    name_en: 'Zero Food Waste',
    description_id: 'Penyelamatan pangan layak konsumsi, wadah guna ulang, dan pengolahan sisa makanan organik.',
    description_en: 'Edible surplus food rescue, reusable containers, and organic food-scrap processing.',
    icon: 'restaurant-outline',
    sort_order: 3,
  },
  {
    code: 'planting',
    name_id: 'Tanam Pohon & Tanaman',
    name_en: 'Green Planting',
    description_id: 'Penanaman pohon lokal/endemik, buah, mangrove, bambu, dan tanaman pangan terverifikasi.',
    description_en: 'Verified planting of native/endemic, fruit, mangrove, bamboo, and food plants.',
    icon: 'leaf-outline',
    sort_order: 4,
  },
  {
    code: 'plant_care',
    name_id: 'Rawat Pohon & Tanaman',
    name_en: 'Green Care',
    description_id: 'Penyiraman, mulsa, pemupukan organik, pemantauan kesehatan pohon, dan perawatan rumpun bambu.',
    description_en: 'Watering, mulching, organic fertilizing, tree health monitoring, and bamboo grove care.',
    icon: 'water-outline',
    sort_order: 5,
  },
  {
    code: 'eco_report',
    name_id: 'Laporan Lingkungan (Eco Intelligence)',
    name_en: 'Eco Intelligence Reports',
    description_id: 'Pelaporan geospasial pohon tumbang, banjir/rob, jalan rusak, sampah liar, kebakaran, dan pesisir.',
    description_en: 'Geospatial reporting for fallen trees, flooding, road damage, illegal dumping, fire, and coast.',
    icon: 'alert-circle-outline',
    sort_order: 6,
  },
  {
    code: 'energy_water',
    name_id: 'Hemat Energi & Air',
    name_en: 'Energy & Water Saving',
    description_id: 'Penghematan listrik (kWh), lampu LED, efisiensi AC, panen air hujan, dan penghematan air (liter).',
    description_en: 'Electricity saving (kWh), LED upgrades, AC efficiency, rainwater harvesting, and water saving.',
    icon: 'flash-outline',
    sort_order: 7,
  },
];

export const GREEN_ACTIVITY_TYPES_SEED = [
  // 1. Mobility
  { code: 'mobility_walk_cycle', category_code: 'mobility', name_id: 'Jalan Kaki / Sepeda / E-Bike', name_en: 'Walking / Bicycle / E-Bike', unit: 'km', requires_evidence: false, is_green_eligible: true },
  { code: 'mobility_rail_mrt', category_code: 'mobility', name_id: 'KRL / MRT / LRT / Kereta', name_en: 'Commuter Rail / MRT / LRT / Train', unit: 'km', requires_evidence: true, is_green_eligible: true },
  { code: 'mobility_bus_angkot', category_code: 'mobility', name_id: 'Bus Kota / TransJakarta / Angkot', name_en: 'City Bus / BRT / Minibus (Angkot)', unit: 'km', requires_evidence: true, is_green_eligible: true },
  { code: 'mobility_ferry_boat', category_code: 'mobility', name_id: 'Kapal Penumpang / Feri / Waterbus', name_en: 'Passenger Ferry / River Boat', unit: 'km', requires_evidence: true, is_green_eligible: true },
  { code: 'mobility_ev', category_code: 'mobility', name_id: 'Kendaraan Listrik (Mobil/Motor/Bus EV)', name_en: 'Electric Vehicle (Car / Motorcycle / Bus)', unit: 'km', requires_evidence: true, is_green_eligible: true },
  { code: 'mobility_carpool', category_code: 'mobility', name_id: 'Berbagi Kendaraan (Carpool)', name_en: 'Shared Ride / Carpool', unit: 'km', requires_evidence: true, is_green_eligible: true },
  { code: 'mobility_private_motorized', category_code: 'mobility', name_id: 'Mobil/Motor Pribadi, Taksi, Ojek, atau Pesawat (Catat Emisi)', name_en: 'Private Car/Moto, Taxi, Ride-Hail, or Flight (Log Emissions)', unit: 'km', requires_evidence: false, is_green_eligible: false },

  // 2. Eco Waste
  { code: 'waste_ecobrick', category_code: 'waste', name_id: 'Pembuatan Ecobrick (Berat Plastik Terukur)', name_en: 'Ecobrick Creation (Measured Plastic Mass)', unit: 'gram', requires_evidence: true, is_green_eligible: true },
  { code: 'waste_plastic_delivery', category_code: 'waste', name_id: 'Setor Pilah Plastik ke Bank Sampah / Daur Ulang', name_en: 'Sorted Plastic Delivered to Bank Sampah / Recycler', unit: 'gram', requires_evidence: true, is_green_eligible: true },
  { code: 'waste_compost', category_code: 'waste', name_id: 'Kompos Sampah Organik / Sisa Makanan', name_en: 'Organic Waste / Food Scrap Composting', unit: 'gram', requires_evidence: true, is_green_eligible: true },
  { code: 'waste_used_oil_ewaste', category_code: 'waste', name_id: 'Setor Minyak Jelantah / E-Waste ke Mitra Resmi', name_en: 'Used Cooking Oil / E-Waste to Authorized Partner', unit: 'gram', requires_evidence: true, is_green_eligible: true },
  { code: 'waste_cleanup', category_code: 'waste', name_id: 'Aksi Bersih Komunitas (Clean-Up)', name_en: 'Community Clean-Up Event', unit: 'gram', requires_evidence: true, is_green_eligible: true },

  // 3. Zero Food Waste
  { code: 'food_rescue_donate', category_code: 'food_waste', name_id: 'Donasi / Penyelamatan Pangan Layak Konsumsi', name_en: 'Safe Edible Surplus Food Rescue / Donation', unit: 'portion', requires_evidence: true, is_green_eligible: true },
  { code: 'food_reusable_container', category_code: 'food_waste', name_id: 'Gunakan Wadah Makan/Minum Guna Ulang', name_en: 'Reusable Food & Beverage Container', unit: 'portion', requires_evidence: true, is_green_eligible: true },
  { code: 'food_organic_bsf', category_code: 'food_waste', name_id: 'Olah Sisa Makanan Organik / BSF', name_en: 'Food Scrap Processing / BSF', unit: 'gram', requires_evidence: true, is_green_eligible: true },

  // 4. Green Planting
  { code: 'planting_native_conservation', category_code: 'planting', name_id: 'Tanam Pohon Lokal / Endemik / Mangrove / Bambu', name_en: 'Plant Native / Endemic / Mangrove / Bamboo', unit: 'plant', requires_evidence: true, is_green_eligible: true },
  { code: 'planting_fruit_agroforestry', category_code: 'planting', name_id: 'Tanam Pohon Buah / Agroforestri / Pangan', name_en: 'Plant Fruit / Agroforestry / Food Plant', unit: 'plant', requires_evidence: true, is_green_eligible: true },

  // 5. Green Care
  { code: 'care_watering_mulching', category_code: 'plant_care', name_id: 'Siram, Mulsa, Pupuk Organik & Pantau Pohon', name_en: 'Watering, Mulching, Organic Fertilizer & Monitoring', unit: 'session', requires_evidence: true, is_green_eligible: true },
  { code: 'care_bamboo_mangrove', category_code: 'plant_care', name_id: 'Perawatan Rumpun Bambu / Restorasi Mangrove', name_en: 'Bamboo Grove / Mangrove Restoration Care', unit: 'session', requires_evidence: true, is_green_eligible: true },

  // 6. Eco Intelligence Reports
  { code: 'report_environment', category_code: 'eco_report', name_id: 'Laporan Lingkungan & Infrastruktur Publik', name_en: 'Environmental & Public Infrastructure Report', unit: 'report', requires_evidence: true, is_green_eligible: true },

  // 7. Energy & Water Saving
  { code: 'energy_kwh_saving', category_code: 'energy_water', name_id: 'Penghematan Listrik Terukur (kWh)', name_en: 'Measured Electricity Saving (kWh)', unit: 'kwh', requires_evidence: true, is_green_eligible: true },
  { code: 'water_liter_saving', category_code: 'energy_water', name_id: 'Penghematan Air / Panen Hujan (Liter)', name_en: 'Water Saving / Rainwater Harvesting (Liters)', unit: 'liter', requires_evidence: true, is_green_eligible: true },
  { code: 'energy_behavior_action', category_code: 'energy_water', name_id: 'Aksi Perilaku Hemat Energi/Air (Tanpa Meteran)', name_en: 'Behavioral Energy/Water Saving (Unmetered)', unit: 'session', requires_evidence: false, is_green_eligible: true },
];

export const GREEN_EMISSION_FACTORS_SEED = [
  {
    code: 'ef_walk_cycle_v1',
    version: 'v1.0-2026',
    activity_type_code: 'mobility_walk_cycle',
    region: 'Indonesia',
    factor_kgco2e_per_unit: '0.000000',
    baseline_factor_kgco2e_unit: '0.110000', // Conservative Indonesian 110cc-125cc motorcycle baseline ONLY if user confirms replacement
    unit: 'km',
    source_name: 'KLHK / IPCC 2006 Mobile Combustion Provisional Baseline',
    methodology: 'zero_tailpipe_vs_disclosed_baseline',
    confidence: 'estimated',
  },
  {
    code: 'ef_rail_mrt_v1',
    version: 'v1.0-2026',
    activity_type_code: 'mobility_rail_mrt',
    region: 'Indonesia (Java-Bali Grid)',
    factor_kgco2e_per_unit: '0.035000',
    baseline_factor_kgco2e_unit: '0.110000',
    unit: 'km',
    source_name: 'Kementerian ESDM Grid Factor & Rail Occupancy Estimate',
    methodology: 'per_passenger_km_vs_disclosed_baseline',
    confidence: 'estimated',
  },
  {
    code: 'ef_bus_angkot_v1',
    version: 'v1.0-2026',
    activity_type_code: 'mobility_bus_angkot',
    region: 'Indonesia',
    factor_kgco2e_per_unit: '0.068000',
    baseline_factor_kgco2e_unit: '0.175000',
    unit: 'km',
    source_name: 'IPCC / Indonesian Urban Transit Provisional Factor',
    methodology: 'per_passenger_km_vs_disclosed_baseline',
    confidence: 'estimated',
  },
  {
    code: 'ef_private_motorized_v1',
    version: 'v1.0-2026',
    activity_type_code: 'mobility_private_motorized',
    region: 'Indonesia',
    factor_kgco2e_per_unit: '0.150000',
    baseline_factor_kgco2e_unit: null,
    unit: 'km',
    source_name: 'Provisional Motorized Transport Average',
    methodology: 'actual_emissions_only',
    confidence: 'estimated',
  },
  {
    code: 'ef_electricity_id_v1',
    version: 'v1.0-2026',
    activity_type_code: 'energy_kwh_saving',
    region: 'Indonesia (National Grid)',
    factor_kgco2e_per_unit: '0.000000',
    baseline_factor_kgco2e_unit: '0.800000', // Kementerian ESDM Indonesia national grid (~0.80 kgCO2e/kWh)
    unit: 'kwh',
    source_name: 'Kementerian ESDM Indonesia Grid Emission Factor Reference',
    methodology: 'grid_kwh_saved',
    confidence: 'calculated',
  },
];

export const GREEN_REWARD_RULES_SEED = [
  { activity_type_code: 'mobility_walk_cycle', base_points: 2, unit_step: '1.00', max_points_per_submission: 20, daily_cap_points: 20, requires_verification: true, requires_evidence: false },
  { activity_type_code: 'mobility_rail_mrt', base_points: 3, unit_step: '5.00', max_points_per_submission: 15, daily_cap_points: 25, requires_verification: true, requires_evidence: true },
  { activity_type_code: 'mobility_bus_angkot', base_points: 3, unit_step: '5.00', max_points_per_submission: 15, daily_cap_points: 25, requires_verification: true, requires_evidence: true },
  { activity_type_code: 'mobility_ferry_boat', base_points: 3, unit_step: '5.00', max_points_per_submission: 15, daily_cap_points: 20, requires_verification: true, requires_evidence: true },
  { activity_type_code: 'mobility_ev', base_points: 2, unit_step: '5.00', max_points_per_submission: 10, daily_cap_points: 20, requires_verification: true, requires_evidence: true },
  { activity_type_code: 'mobility_carpool', base_points: 2, unit_step: '5.00', max_points_per_submission: 10, daily_cap_points: 20, requires_verification: true, requires_evidence: true },
  { activity_type_code: 'mobility_private_motorized', base_points: 0, unit_step: '1.00', max_points_per_submission: 0, daily_cap_points: 0, requires_verification: true, requires_evidence: false },

  { activity_type_code: 'waste_ecobrick', base_points: 1, unit_step: '100.00', max_points_per_submission: 25, daily_cap_points: 50, requires_verification: true, requires_evidence: true },
  { activity_type_code: 'waste_plastic_delivery', base_points: 1, unit_step: '100.00', max_points_per_submission: 25, daily_cap_points: 50, requires_verification: true, requires_evidence: true },
  { activity_type_code: 'waste_compost', base_points: 1, unit_step: '200.00', max_points_per_submission: 20, daily_cap_points: 40, requires_verification: true, requires_evidence: true },
  { activity_type_code: 'waste_used_oil_ewaste', base_points: 2, unit_step: '250.00', max_points_per_submission: 30, daily_cap_points: 40, requires_verification: true, requires_evidence: true },
  { activity_type_code: 'waste_cleanup', base_points: 2, unit_step: '500.00', max_points_per_submission: 30, daily_cap_points: 40, requires_verification: true, requires_evidence: true },

  { activity_type_code: 'food_rescue_donate', base_points: 5, unit_step: '1.00', max_points_per_submission: 30, daily_cap_points: 40, requires_verification: true, requires_evidence: true },
  { activity_type_code: 'food_reusable_container', base_points: 2, unit_step: '1.00', max_points_per_submission: 10, daily_cap_points: 20, requires_verification: true, requires_evidence: true },
  { activity_type_code: 'food_organic_bsf', base_points: 1, unit_step: '200.00', max_points_per_submission: 20, daily_cap_points: 30, requires_verification: true, requires_evidence: true },

  { activity_type_code: 'planting_native_conservation', base_points: 20, unit_step: '1.00', max_points_per_submission: 100, daily_cap_points: 100, requires_verification: true, requires_evidence: true },
  { activity_type_code: 'planting_fruit_agroforestry', base_points: 10, unit_step: '1.00', max_points_per_submission: 50, daily_cap_points: 60, requires_verification: true, requires_evidence: true },

  { activity_type_code: 'care_watering_mulching', base_points: 3, unit_step: '1.00', max_points_per_submission: 10, daily_cap_points: 20, requires_verification: true, requires_evidence: true },
  { activity_type_code: 'care_bamboo_mangrove', base_points: 5, unit_step: '1.00', max_points_per_submission: 15, daily_cap_points: 30, requires_verification: true, requires_evidence: true },

  { activity_type_code: 'report_environment', base_points: 10, unit_step: '1.00', max_points_per_submission: 20, daily_cap_points: 40, requires_verification: true, requires_evidence: true },

  { activity_type_code: 'energy_kwh_saving', base_points: 2, unit_step: '1.00', max_points_per_submission: 20, daily_cap_points: 30, requires_verification: true, requires_evidence: true },
  { activity_type_code: 'water_liter_saving', base_points: 1, unit_step: '100.00', max_points_per_submission: 15, daily_cap_points: 25, requires_verification: true, requires_evidence: true },
  { activity_type_code: 'energy_behavior_action', base_points: 2, unit_step: '1.00', max_points_per_submission: 4, daily_cap_points: 6, requires_verification: true, requires_evidence: false },
];

let seededOnce = false;

export async function ensureGreenSeeded(db: any = defaultPrisma): Promise<void> {
  if (seededOnce) return;
  try {
    for (const cat of GREEN_CATEGORIES_SEED) {
      await db.greenActivityCategory.upsert({
        where: { code: cat.code },
        create: cat,
        update: cat,
      });
    }
    for (const act of GREEN_ACTIVITY_TYPES_SEED) {
      await db.greenActivityType.upsert({
        where: { code: act.code },
        create: act,
        update: act,
      });
    }
    for (const ef of GREEN_EMISSION_FACTORS_SEED) {
      await db.greenEmissionFactor.upsert({
        where: { code: ef.code },
        create: ef,
        update: ef,
      });
    }
    for (const rule of GREEN_REWARD_RULES_SEED) {
      await db.greenRewardRule.upsert({
        where: { activity_type_code: rule.activity_type_code },
        create: rule,
        update: rule,
      });
    }

    const now = new Date();
    const endMonth = new Date(now.getTime() + 30 * 86400_000);
    await db.greenChallenge.upsert({
      where: { code: 'green_mobility_20km' },
      create: {
        code: 'green_mobility_20km',
        title_id: 'Tantangan Jalan & Sepeda 20 km',
        title_en: '20 km Walk & Bike Challenge',
        description_id: 'Kumpulkan minimal 20 km perjalanan ramah lingkungan terverifikasi bulan ini.',
        description_en: 'Log at least 20 km of verified green mobility trips this month.',
        category_code: 'mobility',
        target_metric: 'km',
        target_value: '20.00',
        reward_points: 25,
        start_date: now,
        end_date: endMonth,
      },
      update: {},
    });
    await db.greenChallenge.upsert({
      where: { code: 'green_ecobrick_1kg' },
      create: {
        code: 'green_ecobrick_1kg',
        title_id: 'Tantangan Ecobrick & Pilah Plastik 1 kg',
        title_en: '1 kg Ecobrick & Plastic Sorting Challenge',
        description_id: 'Kelola minimal 1.000 gram plastik bersih melalui ecobrick atau bank sampah.',
        description_en: 'Process at least 1,000 grams of clean plastic via ecobricks or bank sampah.',
        category_code: 'waste',
        target_metric: 'gram',
        target_value: '1000.00',
        reward_points: 30,
        start_date: now,
        end_date: endMonth,
      },
      update: {},
    });

    seededOnce = true;
  } catch (err) {
    console.warn('NGOPI GREEN seed skipped or deferred:', (err as Error)?.message);
  }
}
