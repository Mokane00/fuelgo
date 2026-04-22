const db = require('../db');

/**
 * Insert one audit log row. Fire-and-forget — never throws so callers aren't disrupted.
 *
 * @param {object} opts
 * @param {object}  opts.req          - Express request (for actor + IP)
 * @param {string}  opts.action       - e.g. 'CREATE_USER', 'DELETE_STATION', 'LOGIN_SUCCESS'
 * @param {string}  [opts.targetType] - e.g. 'user', 'station', 'fuel_type'
 * @param {number}  [opts.targetId]
 * @param {string}  [opts.targetLabel]
 * @param {object}  [opts.metadata]   - any extra JSON (before/after values etc.)
 */
async function audit({ req, action, targetType = '', targetId = null, targetLabel = '', metadata = null }) {
  try {
    const actor      = req?.user ?? null;
    const actorId    = actor?.id ?? actor?.user_id ?? null;
    const actorEmail = actor?.email ?? '';
    const actorRole  = actor?.role  ?? '';
    const ip         = (req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '').split(',')[0].trim();

    await db.query(
      `INSERT INTO audit_logs (actor_id, actor_email, actor_role, action, target_type, target_id, target_label, ip_address, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [actorId, actorEmail, actorRole, action, targetType, targetId, targetLabel, ip, metadata ? JSON.stringify(metadata) : null]
    );
  } catch (e) {
    console.error('[audit] Failed to write log:', e.message);
  }
}

module.exports = audit;
