export interface ImpactCalculationInput {
  categoryCode: string;
  activityTypeCode: string;
  quantity: number;
  unit: string;
  metadata?: Record<string, any> | null;
  factor?: {
    code: string;
    version: string;
    factor_kgco2e_per_unit: any;
    baseline_factor_kgco2e_unit: any;
    confidence: string;
    methodology: string;
  } | null;
}

export interface ComputedImpact {
  metric_name: string;
  actual_emissions_kgco2e: string | null;
  baseline_emissions_kgco2e: string | null;
  avoided_emissions_kgco2e: string | null;
  sequestered_carbon_kgco2e: string | null;
  waste_prevented_kg: string | null;
  water_saved_liters: string | null;
  energy_saved_kwh: string | null;
  factor_version: string;
  method_id: string;
  data_quality: 'measured' | 'calculated' | 'estimated' | 'not_calculated';
  notes: string;
}

function fmt4(n: number): string {
  return Number(n).toFixed(4);
}

/**
 * Pure, transparent, versioned impact calculation engine.
 * Never fabricates CO2e or tree sequestration where no defensible factor exists.
 */
export function calculateGreenImpact(input: ImpactCalculationInput): ComputedImpact {
  const qty = Math.max(0, Number(input.quantity) || 0);
  const meta = input.metadata || {};
  const factor = input.factor;

  // 1. Green Mobility
  if (input.categoryCode === 'mobility') {
    if (!factor) {
      return {
        metric_name: 'mobility_trip',
        actual_emissions_kgco2e: null,
        baseline_emissions_kgco2e: null,
        avoided_emissions_kgco2e: null,
        sequestered_carbon_kgco2e: null,
        waste_prevented_kg: null,
        water_saved_liters: null,
        energy_saved_kwh: null,
        factor_version: 'none',
        method_id: 'no_factor_available',
        data_quality: 'not_calculated',
        notes: 'No emission factor configured for this mobility mode; CO2e not fabricated.',
      };
    }

    const actualPerUnit = Number(factor.factor_kgco2e_per_unit);
    const actual = qty * actualPerUnit;
    const replacedPrivate = Boolean(meta.replaced_private_trip);
    const baselinePerUnit =
      factor.baseline_factor_kgco2e_unit != null ? Number(factor.baseline_factor_kgco2e_unit) : null;

    let baseline: number | null = null;
    let avoided: number | null = null;
    if (replacedPrivate && baselinePerUnit !== null) {
      baseline = qty * baselinePerUnit;
      avoided = Math.max(0, baseline - actual);
    }

    return {
      metric_name: 'mobility_emissions_kgco2e',
      actual_emissions_kgco2e: fmt4(actual),
      baseline_emissions_kgco2e: baseline !== null ? fmt4(baseline) : null,
      avoided_emissions_kgco2e: avoided !== null ? fmt4(avoided) : null,
      sequestered_carbon_kgco2e: null,
      waste_prevented_kg: null,
      water_saved_liters: null,
      energy_saved_kwh: null,
      factor_version: `${factor.code}@${factor.version}`,
      method_id: factor.methodology,
      data_quality: 'estimated',
      notes: replacedPrivate
        ? 'Avoided emissions estimated against disclosed private motorized baseline.'
        : 'Actual emissions recorded without avoided-emissions claim (no baseline replacement confirmed).',
    };
  }

  // 2. Eco Waste & Ecobrick
  if (input.categoryCode === 'waste') {
    const kg = input.unit === 'kg' ? qty : qty / 1000;
    return {
      metric_name: 'waste_managed_kg',
      actual_emissions_kgco2e: null,
      baseline_emissions_kgco2e: null,
      avoided_emissions_kgco2e: null,
      sequestered_carbon_kgco2e: null,
      waste_prevented_kg: fmt4(kg),
      water_saved_liters: null,
      energy_saved_kwh: null,
      factor_version: 'mass-direct@v1.0-2026',
      method_id: 'measured_waste_mass_kg',
      data_quality: 'measured',
      notes: 'Recorded measured waste mass in kg without unverified CO2e conversion.',
    };
  }

  // 3. Zero Food Waste
  if (input.categoryCode === 'food_waste') {
    const isGram = input.unit === 'gram';
    const kg = isGram ? qty / 1000 : null;
    return {
      metric_name: isGram ? 'food_waste_processed_kg' : 'food_portions_saved',
      actual_emissions_kgco2e: null,
      baseline_emissions_kgco2e: null,
      avoided_emissions_kgco2e: null,
      sequestered_carbon_kgco2e: null,
      waste_prevented_kg: kg !== null ? fmt4(kg) : null,
      water_saved_liters: null,
      energy_saved_kwh: null,
      factor_version: 'food-direct@v1.0-2026',
      method_id: isGram ? 'measured_food_mass_kg' : 'portion_count_behavioral',
      data_quality: isGram ? 'measured' : 'not_calculated',
      notes: isGram
        ? 'Measured food waste mass processed/saved.'
        : 'Portion-based food waste prevention logged; CO2e not fabricated.',
    };
  }

  // 4 & 5. Tree Planting & Plant Care (NO instant sequestration claim!)
  if (input.categoryCode === 'planting' || input.categoryCode === 'plant_care') {
    return {
      metric_name: input.categoryCode === 'planting' ? 'plants_planted_count' : 'plant_care_sessions',
      actual_emissions_kgco2e: null,
      baseline_emissions_kgco2e: null,
      avoided_emissions_kgco2e: null,
      sequestered_carbon_kgco2e: null, // Explicitly null at planting/care
      waste_prevented_kg: null,
      water_saved_liters: null,
      energy_saved_kwh: null,
      factor_version: 'biodiversity-registry@v1.0-2026',
      method_id: 'no_instant_sequestration_claim',
      data_quality: 'not_calculated',
      notes:
        'Tree planting & care do not claim instant carbon sequestration; requires follow-up survival & biomass monitoring.',
    };
  }

  // 7. Energy & Water Saving
  if (input.categoryCode === 'energy_water') {
    if (input.activityTypeCode === 'energy_kwh_saving' && factor) {
      const baselinePerUnit =
        factor.baseline_factor_kgco2e_unit != null ? Number(factor.baseline_factor_kgco2e_unit) : 0;
      const avoided = Math.max(0, qty * baselinePerUnit);
      return {
        metric_name: 'energy_saved_kwh',
        actual_emissions_kgco2e: fmt4(0),
        baseline_emissions_kgco2e: fmt4(avoided),
        avoided_emissions_kgco2e: fmt4(avoided),
        sequestered_carbon_kgco2e: null,
        waste_prevented_kg: null,
        water_saved_liters: null,
        energy_saved_kwh: fmt4(qty),
        factor_version: `${factor.code}@${factor.version}`,
        method_id: factor.methodology,
        data_quality: 'calculated',
        notes: 'Calculated from measured kWh saved using Indonesia grid emission factor reference.',
      };
    }
    if (input.activityTypeCode === 'water_liter_saving') {
      return {
        metric_name: 'water_saved_liters',
        actual_emissions_kgco2e: null,
        baseline_emissions_kgco2e: null,
        avoided_emissions_kgco2e: null,
        sequestered_carbon_kgco2e: null,
        waste_prevented_kg: null,
        water_saved_liters: Number(qty).toFixed(3),
        energy_saved_kwh: null,
        factor_version: 'water-direct@v1.0-2026',
        method_id: 'measured_water_liters',
        data_quality: 'measured',
        notes: 'Recorded water saved/harvested in liters.',
      };
    }
    return {
      metric_name: 'conservation_behavior_session',
      actual_emissions_kgco2e: null,
      baseline_emissions_kgco2e: null,
      avoided_emissions_kgco2e: null,
      sequestered_carbon_kgco2e: null,
      waste_prevented_kg: null,
      water_saved_liters: null,
      energy_saved_kwh: null,
      factor_version: 'behavioral@v1.0-2026',
      method_id: 'unmetered_behavior_only',
      data_quality: 'not_calculated',
      notes: 'Behavioral conservation logged without fabricated kWh/CO2e savings.',
    };
  }

  // 6. Eco Intelligence Reports
  return {
    metric_name: 'environmental_report_count',
    actual_emissions_kgco2e: null,
    baseline_emissions_kgco2e: null,
    avoided_emissions_kgco2e: null,
    sequestered_carbon_kgco2e: null,
    waste_prevented_kg: null,
    water_saved_liters: null,
    energy_saved_kwh: null,
    factor_version: 'eco-intel@v1.0-2026',
    method_id: 'environmental_reporting_registry',
    data_quality: 'not_calculated',
    notes: 'Environmental report tracked for verification and remediation.',
  };
}
