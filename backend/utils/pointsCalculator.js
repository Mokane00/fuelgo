// ================================================
// FuelGO — pointsCalculator.js
// Description: Loyalty points and tier calculation
// Author: FuelGO Dev
// ================================================
function calcPoints(totalAmount) { return Math.floor(parseFloat(totalAmount) / 10); }
function calcTier(totalSpent) {
  const s = parseFloat(totalSpent);
  if (s >= 50000) return 'Platinum';
  if (s >= 20000) return 'Gold';
  if (s >= 5000)  return 'Silver';
  return 'Bronze';
}
module.exports = { calcPoints, calcTier };
