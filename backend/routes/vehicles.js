const router = require('express').Router();
const db     = require('../db');
const authMW = require('../middleware/auth');

// GET /api/vehicles
router.get('/', authMW(), async (req, res) => {
  try {
    const [vehicles] = await db.query(
      `SELECT v.*, ft.fuel_name, COALESCE(v.is_default, 0) AS is_default
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
    const { plate_number, make, model, year, fuel_type_id, fuel_preference, color, tank_size } = req.body;
    if (!plate_number) return res.status(400).json({ error: 'Plate number required' });
    const resolvedFuelId = await resolveFuelTypeId(fuel_type_id || fuel_preference);
    const [r] = await db.query(
      'INSERT INTO vehicles (user_id, plate_number, make, model, year, fuel_type_id, color, tank_size) VALUES (?,?,?,?,?,?,?,?)',
      [req.user.user_id, plate_number.toUpperCase(), make, model, year, resolvedFuelId, color, tank_size || null]
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
    const { plate_number, make, model, year, fuel_type_id, fuel_preference, color, tank_size } = req.body;
    const resolvedFuelId = await resolveFuelTypeId(fuel_type_id || fuel_preference);
    const [result] = await db.query(
      `UPDATE vehicles SET plate_number=COALESCE(?,plate_number), make=?, model=?, year=?, fuel_type_id=?, color=?, tank_size=?
       WHERE vehicle_id=? AND user_id=?`,
      [plate_number?.toUpperCase(), make, model, year, resolvedFuelId, color, tank_size ?? null, req.params.id, req.user.user_id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Vehicle not found' });
    const [[vehicle]] = await db.query(
      'SELECT v.*, ft.fuel_name, COALESCE(v.is_default,0) AS is_default FROM vehicles v LEFT JOIN fuel_types ft ON v.fuel_type_id=ft.fuel_type_id WHERE v.vehicle_id=?',
      [req.params.id]
    );
    res.json(vehicle);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/vehicles/:id/default
router.put('/:id/default', authMW(), async (req, res) => {
  try {
    // Clear existing default for this user, then set new default
    await db.query('UPDATE vehicles SET is_default=0 WHERE user_id=?', [req.user.user_id]);
    const [result] = await db.query(
      'UPDATE vehicles SET is_default=1 WHERE vehicle_id=? AND user_id=?',
      [req.params.id, req.user.user_id]
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
