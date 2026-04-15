// ================================================
// FuelGO — utils/weather.js
// Description: OpenWeatherMap + ipapi helpers
// ================================================

/**
 * Get current weather for a lat/lng.
 * Returns { temp, feels_like, description, icon, humidity, wind_speed }
 */
async function getWeather(lat, lng) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return null;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${key}&units=metric`;
  const res  = await fetch(url);
  if (!res.ok) return null;
  const d = await res.json();
  return {
    temp:        Math.round(d.main.temp),
    feels_like:  Math.round(d.main.feels_like),
    description: d.weather[0]?.description || '',
    icon:        d.weather[0]?.icon        || '',
    humidity:    d.main.humidity,
    wind_speed:  Math.round(d.wind.speed * 3.6), // m/s → km/h
  };
}

/**
 * Get approximate location from an IP address via ipapi.co (no key needed).
 * Returns { city, region, country, latitude, longitude } or null on failure.
 */
async function getLocationFromIP(ip) {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!res.ok) return null;
    const d = await res.json();
    if (d.error) return null;
    return { city: d.city, region: d.region, country: d.country_name,
             latitude: d.latitude, longitude: d.longitude };
  } catch { return null; }
}

module.exports = { getWeather, getLocationFromIP };
