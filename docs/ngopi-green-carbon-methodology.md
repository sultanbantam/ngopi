# NGOPI GREEN — Carbon & Environmental Impact Methodology (`v1.0-2026`)

## 1. Core Principles
- **Separation of Metrics:** Ngopi Points (in-app loyalty rewards), Carbon Impact (`kgCO2e`), and BMC (separate utility token) are strictly distinct.
- **No Fabricated Savings:** Unmetered behavioral actions (e.g., turning off an unmeasured light) and tree planting do **not** invent `kgCO2e` savings.
- **Conservative Baselines:** Avoided emissions for Green Mobility are computed **only** when the user explicitly confirms replacing a private motorized trip (`replaced_private_trip: true`) and a disclosed baseline factor exists:
  $$\text{avoided\_emissions\_kgco2e} = \max(0,\ (\text{baseline\_factor} - \text{actual\_factor}) \times \text{quantity})$$

## 2. Disclosed Emission Factors (`v1.0-2026`)
| Code | Activity | Actual Factor | Baseline Factor | Unit | Region | Source / Reference | Quality |
|---|---|---:|---:|---|---|---|---|
| `ef_walk_cycle_v1` | Walking / Bicycle / E-Bike | `0.0000` | `0.1100` | `km` | Indonesia | KLHK / IPCC 2006 Mobile Combustion Provisional Baseline (110–125cc motorcycle) | `estimated` |
| `ef_rail_mrt_v1` | Commuter Rail / MRT / LRT | `0.0350` | `0.1100` | `km` | Indonesia (Java-Bali Grid) | Kementerian ESDM Grid Factor & Rail Occupancy Estimate | `estimated` |
| `ef_bus_angkot_v1` | City Bus / BRT / Angkot | `0.0680` | `0.1750` | `km` | Indonesia | IPCC / Indonesian Urban Transit Provisional Factor | `estimated` |
| `ef_private_motorized_v1` | Private Car / Moto / Taxi / Flight | `0.1500` | `null` | `km` | Indonesia | Provisional Motorized Transport Average (actual emissions only; 0 green points) | `estimated` |
| `ef_electricity_id_v1` | Measured Electricity Saving | `0.0000` | `0.8000` | `kwh` | Indonesia (National Grid) | Kementerian ESDM Indonesia Grid Emission Factor Reference | `calculated` |

## 3. Non-CO2e Direct & Unsupported Calculations
- **Eco Waste & Ecobrick:** Records measured mass in `waste_prevented_kg = grams / 1000`. The `0.33 g/ml` ecobrick density is referenced as a configurable guideline, not a legal standard. Paper, glass, metal, organic, and hazardous waste are rejected as ecobrick filler.
- **Tree Planting & Care (`planting`, `plant_care`):** `sequestered_carbon_kgco2e` is **`null`** at planting. Survival & growth require follow-up monitoring (`green_plant_monitoring`).
- **Water Saving:** Records `water_saved_liters` directly (`measured`).
- **Unmetered Behavioral Actions:** Recorded with `data_quality: 'not_calculated'` and modest daily-capped behavior points only.
