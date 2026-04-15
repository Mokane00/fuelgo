// ================================================
// FuelGO — utils/carbon.js
// Description: Carbon Interface API — real CO₂ estimates
// Env vars needed:
//   CARBON_INTERFACE_API_KEY
// ================================================

// Carbon Interface fuel type names
const FUEL_MAP = {
  Petrol:   'petrol',
  Gasoline: 'petrol',
  Diesel:   'diesel',
  Premium:  'petrol',    // premium unleaded is still petrol
  LPG:      'lpg',
  Paraffin: 'kerosene',
};

/**
 * Get CO₂ estimate from Carbon Interface.
 * @param {string} fuelType  - FuelGO fuel name e.g. "Petrol", "Diesel"
 * @param {number} litres    - Quantity in litres
 * @returns {{ co2_kg: number, co2_g: number }|null}
 */
async function getCarbonEstimate(fuelType, litres) {
  const apiKey = process.env.CARBON_INTERFACE_API_KEY;
  if (!apiKey) return null;

  const carbonFuelType = FUEL_MAP[fuelType] || 'petrol';

  try {
    const res = await fetch('https://www.carboninterface.com/api/v1/estimates', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type:      'fuel_combustion',
        fuel_source_type: carbonFuelType,
        fuel_source_unit: 'l',
        fuel_source_value: parseFloat(litres),
      }),
    });

    if (!res.ok) return null;
    const d = await res.json();
    const kg = d.data?.attributes?.carbon_kg ?? null;
    if (kg === null) return null;
    return { co2_kg: +kg.toFixed(2), co2_g: Math.round(kg * 1000) };
  } catch { return null; }
}

module.exports = { getCarbonEstimate };
