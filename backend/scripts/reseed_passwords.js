/* Re-seed demo user passwords with bcrypt hashes.
   Usage: node backend/scripts/reseed_passwords.js
   Reads DB connection from backend/.env
*/
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const demoUsers = [
  { email: 'admin@fuelgo.ls', password: 'Admin@2025' },
  { email: 'sarah@fuelgo.ls', password: 'demo123' },
  { email: 'justin@fuelgo.ls', password: 'demo123' },
];

(async function main() {
  const db = await mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'fuelgo',
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    for (const u of demoUsers) {
      const hash = await bcrypt.hash(u.password, 12);
      const [res] = await db.query('UPDATE users SET password_hash = ? WHERE email = ?', [hash, u.email]);
      console.log(`Updated ${u.email}: affectedRows=${res.affectedRows}`);
    }
  } catch (err) {
    console.error('Error reseeding passwords:', err);
    process.exit(1);
  } finally {
    await db.end();
  }
})();
