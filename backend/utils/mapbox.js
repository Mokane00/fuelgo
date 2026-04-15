// ================================================
// FuelGO — utils/mapbox.js
// Description: Mapbox Distance Matrix — sort stations by driving distance
// Env vars needed:
//   MAPBOX_ACCESS_TOKEN
// ================================================

const MAPBOX_BASE = 'https://api.mapbox.com';

/**
 * Get driving distances from one origin to multiple destinations.
 * Uses Mapbox Matrix API (free up to 100k req/month).
 *
 * @param {{ lat: number, lng: number }} origin
 * @param {Array<{ lat: number, lng: number, station_id: number }>} destinations
 * @returns {Array<{ station_id, distance_m, duration_s }>} sorted nearest-first
 */
async function getDrivingDistances(origin, destinations) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token || !destinations.length) return [];

  // Mapbox Matrix allows max 25 coords total; chunk if needed
  const chunks = [];
  for (let i = 0; i < destinations.length; i += 24) {
    chunks.push(destinations.slice(i, i + 24));
  }

  const results = [];

  for (const chunk of chunks) {
    // Coordinates: origin first, then destinations
    const coords = [
      `${origin.lng},${origin.lat}`,
      ...chunk.map(d => `${d.lng},${d.lat}`),
    ].join(';');

    // sources=0 (origin), destinations=1..N
    const sources      = '0';
    const dests        = chunk.map((_, i) => i + 1).join(';');
    const url = `${MAPBOX_BASE}/directions-matrix/v1/mapbox/driving/${coords}?sources=${sources}&destinations=${dests}&annotations=distance,duration&access_token=${token}`;

    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();

      const distances = data.distances?.[0] || [];
      const durations = data.durations?.[0] || [];

      chunk.forEach((dest, i) => {
        results.push({
          station_id: dest.station_id,
          distance_m: distances[i] ?? null,
          duration_s: durations[i] ?? null,
        });
      });
    } catch { /* skip chunk on network error */ }
  }

  return results.sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity));
}

/**
 * Format distance_m into a human-readable string.
 * e.g. 350 → "350 m"  |  1500 → "1.5 km"
 */
function formatDistance(meters) {
  if (meters === null || meters === undefined) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format duration_s into minutes string.
 */
function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) return '';
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '< 1 min';
  return `${mins} min`;
}

module.exports = { getDrivingDistances, formatDistance, formatDuration };
