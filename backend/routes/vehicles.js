const router = require('express').Router();
const db     = require('../db');
const authMW = require('../middleware/auth');

// GET /api/vehicles
router.get('/', authMW(), async (req, res) => {
  try {
    const [vehicles] = await db.query(
      `SELECT v.*, ft.fuel_name
       FROM vehicles v LEFT JOIN fuel_types ft ON v.fuel_type_id = ft.fuel_type_id
       WHERE v.user_id = ? ORDER BY v.created_at DESC`,
      [req.user.user_id]
    );
    res.json(vehicles);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Helper: resolve fuel_type_id from either an id or a name string
async function resolveFuelTypeId(fuelTypeIdOrName) {
  if (!fuelTypeIdOrName) return null;
  if (!isNaN(fuelTypeIdOrName)) return parseInt(fuelTypeIdOrName);
  const [[ft]] = await db.query('SELECT fuel_type_id FROM fuel_types WHERE fuel_name = ? LIMIT 1', [fuelTypeIdOrName]);
  return ft ? ft.fuel_type_id : null;
}

// POST /api/vehicles
router.post('/', authMW(), async (req, res) => {
  try {
    const { plate_number, make, model, year, fuel_type_id, fuel_preference, color } = req.body;
    if (!plate_number) return res.status(400).json({ error: 'Plate number required' });
    const resolvedFuelId = await resolveFuelTypeId(fuel_type_id || fuel_preference);
    const [r] = await db.query(
      'INSERT INTO vehicles (user_id, plate_number, make, model, year, fuel_type_id, color) VALUES (?,?,?,?,?,?,?)',
      [req.user.user_id, plate_number.toUpperCase(), make, model, year, resolvedFuelId, color]
    );
    const [[vehicle]] = await db.query(
      'SELECT v.*, ft.fuel_name FROM vehicles v LEFT JOIN fuel_types ft ON v.fuel_type_id = ft.fuel_type_id WHERE v.vehicle_id = ?',
      [r.insertId]
    );
    res.status(201).json(vehicle);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/vehicles/:id
router.put('/:id', authMW(), async (req, res) => {
  try {
    const { plate_number, make, model, year, fuel_type_id, fuel_preference, color } = req.body;
    const resolvedFuelId = await resolveFuelTypeId(fuel_type_id || fuel_preference);
    const [result] = await db.query(
      `UPDATE vehicles SET plate_number=COALESCE(?,plate_number), make=?, model=?, year=?, fuel_type_id=?, color=?
       WHERE vehicle_id=? AND user_id=?`,
      [plate_number?.toUpperCase(), make, model, year, resolvedFuelId, color, req.params.id, req.user.user_id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/vehicles/:id
router.delete('/:id', authMW(), async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM vehicles WHERE vehicle_id=? AND user_id=?',
      [req.params.id, req.user.user_id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
