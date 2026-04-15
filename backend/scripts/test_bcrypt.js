const mysql = require('mysql2/promise');
const bcrypt = require('../node_modules/bcryptjs');
(async ()=>{
  try {
    const c = await mysql.createConnection({host:'localhost',user:'fuelgo',password:'FuelGO@2025!',database:'fuelgo_db'});
    const [rows] = await c.query("SELECT email,password_hash,CHAR_LENGTH(password_hash) len FROM users LIMIT 5");
    for (const r of rows) {
      console.log('EMAIL:', r.email);
      console.log('HASH:', r.password_hash);
      console.log('LENGTH:', r.len);
      console.log('compare demo123 =>', await bcrypt.compare('demo123', r.password_hash));
      console.log('compare Admin@2025 =>', await bcrypt.compare('Admin@2025', r.password_hash));
      console.log('---');
    }
    await c.end();
  } catch (e) { console.error('ERR', e.message); process.exit(1); }
})();
