/**
 * FuelGO Database Seeder
 * Run: node seed.js
 * Requires schema.sql to have been executed first.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const DB_CONFIG = {
  host:     process.env.DB_HOST || 'localhost',
  port:     process.env.DB_PORT || 3306,
  user:     process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'fuelgo',
  multipleStatements: true,
};

// ── Helper ────────────────────────────────────────────────
const rnd  = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = arr => arr[rnd(0, arr.length - 1)];

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(rnd(5, 22), rnd(0, 59), rnd(0, 59));
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function seed() {
  const db = await mysql.createConnection(DB_CONFIG);
  console.log('🌱 Seeding FuelGO database…');

  // ── Clean slate ───────────────────────────────────────────
  await db.execute('SET FOREIGN_KEY_CHECKS=0');
  for (const t of ['loyalty_transactions','loyalty','transactions','vehicles','pumps','rewards','users','stations','fuel_types']) {
    await db.execute(`TRUNCATE TABLE ${t}`);
  }
  await db.execute('SET FOREIGN_KEY_CHECKS=1');

  // ────────────────────────────────────────────────────────
  //  1. FUEL TYPES
  // ────────────────────────────────────────────────────────
  await db.execute(`
    INSERT INTO fuel_types (fuel_name, price_per_litre) VALUES
    ('Petrol 93',          14.50),
    ('Petrol 95',          15.20),
    ('Diesel 500ppm',      13.80),
    ('Diesel Ultra 50ppm', 14.30),
    ('Paraffin',           10.50)`);
  console.log('  ✅ Fuel types');

  // ────────────────────────────────────────────────────────
  //  2. STATIONS — all 35 across 10 Lesotho districts
  // ────────────────────────────────────────────────────────
  const stationsData = [
    // Maseru (11)
    ['FuelGO Maseru Central',         'Kingsway Ave, Maseru CBD',         'Maseru',       -29.3167,  27.4833, '+266 2231 2000', 'active', '05:00 – 23:00'],
    ['FuelGO Maseru West',             'Airport Rd, Maseru West',          'Maseru',       -29.3250,  27.4700, '+266 2231 2100', 'active', '05:30 – 22:30'],
    ['FuelGO Maseru Industrial',       'Maseru Industrial Area',           'Maseru',       -29.3300,  27.5000, '+266 2231 3000', 'active', '06:00 – 22:00'],
    ['FuelGO Maseru North',            'Tšepong, Northern Maseru',         'Maseru',       -29.3000,  27.4900, '+266 2231 3100', 'active', '06:00 – 22:00'],
    ['FuelGO Maseru East',             'Lancers Gap, Maseru East',         'Maseru',       -29.3100,  27.5100, '+266 2231 3200', 'active', '06:00 – 22:00'],
    ['FuelGO Pioneer Mall',            'Pioneer Mall, Maseru',             'Maseru',       -29.3233,  27.4789, '+266 2231 3300', 'active', '07:00 – 21:00'],
    ['FuelGO Lesotho Sun',             'Hilton Rd, Maseru',                'Maseru',       -29.3150,  27.4765, '+266 2231 3400', 'active', '24 Hours'],
    ['FuelGO Maseru Bridge',           'Maseru Bridge Border Post',        'Maseru',       -29.3600,  27.4833, '+266 2231 3500', 'active', '05:00 – 23:00'],
    ['FuelGO Maseru Qoaling',          'Qoaling Township, Maseru',         'Maseru',       -29.3450,  27.4650, '+266 2231 3600', 'active', '06:00 – 21:00'],
    ['FuelGO Maseru Ha Tšolo',         'Ha Tšolo, Maseru',                 'Maseru',       -29.3380,  27.5200, '+266 2231 3700', 'active', '06:00 – 22:00'],
    ['FuelGO Maseru Mafeteng Rd',      'Mafeteng Road, Maseru South',      'Maseru',       -29.3550,  27.4750, '+266 2231 3800', 'active', '05:30 – 22:00'],
    // Berea (4)
    ['FuelGO Teyateyaneng',            'Main St, Teyateyaneng',            'Berea',        -29.1500,  27.7500, '+266 2250 1000', 'active', '06:00 – 22:00'],
    ['FuelGO TY Airport Rd',           'Airport Rd, Teyateyaneng',         'Berea',        -29.1400,  27.7600, '+266 2250 1100', 'active', '06:00 – 21:00'],
    ['FuelGO Berea Ha Ramathe',        'Ha Ramathe, Berea',                'Berea',        -29.1800,  27.7200, '+266 2250 1200', 'active', '06:00 – 22:00'],
    ['FuelGO Mapoteng',                'Mapoteng Village, Berea',          'Berea',        -29.1200,  27.8000, '+266 2250 1300', 'active', '07:00 – 20:00'],
    // Leribe (4)
    ['FuelGO Hlotse Central',          'Main St, Hlotse',                  'Leribe',       -28.8833,  28.0500, '+266 2240 2000', 'active', '06:00 – 22:00'],
    ['FuelGO Leribe Border',           'Caledonspoort Border, Leribe',     'Leribe',       -28.8500,  28.0900, '+266 2240 2100', 'active', '06:00 – 22:00'],
    ['FuelGO Maputsoe',                'Industrial Zone, Maputsoe',        'Leribe',       -28.8833,  28.1000, '+266 2240 2200', 'active', '05:30 – 22:30'],
    ['FuelGO Leribe North',            'Leribe North Town',                'Leribe',       -28.8200,  28.0600, '+266 2240 2300', 'active', '06:00 – 22:00'],
    // Butha-Buthe (2)
    ['FuelGO Butha-Buthe Town',        'Main Rd, Butha-Buthe',             'Butha-Buthe',  -28.7667,  28.2500, '+266 2246 3000', 'active', '06:00 – 22:00'],
    ['FuelGO Butha-Buthe South',       'Butha-Buthe South',                'Butha-Buthe',  -28.8000,  28.2300, '+266 2246 3100', 'active', '06:00 – 21:00'],
    // Mokhotlong (2)
    ['FuelGO Mokhotlong Town',         'Main St, Mokhotlong',              'Mokhotlong',   -29.2833,  29.0667, '+266 2292 4000', 'active', '07:00 – 20:00'],
    ['FuelGO Mokhotlong East',         'Mokhotlong East',                  'Mokhotlong',   -29.2500,  29.1000, '+266 2292 4100', 'active', '07:00 – 20:00'],
    // Thaba-Tseka (2)
    ['FuelGO Thaba-Tseka Town',        'Main St, Thaba-Tseka',             'Thaba-Tseka',  -29.5167,  28.6000, '+266 2290 5000', 'active', '07:00 – 20:00'],
    ['FuelGO Thaba-Tseka North',       'Thaba-Tseka North',                'Thaba-Tseka',  -29.4800,  28.6200, '+266 2290 5100', 'active', '07:00 – 19:00'],
    // Qacha's Nek (2)
    ["FuelGO Qacha's Nek Town",        "Main St, Qacha's Nek",             "Qacha's Nek",  -30.1000,  28.6833, '+266 2295 6000', 'active', '07:00 – 20:00'],
    ["FuelGO Qacha's Nek Border",      "Qacha's Nek Border Post",          "Qacha's Nek",  -30.1200,  28.7000, '+266 2295 6100', 'active', '06:00 – 22:00'],
    // Quthing (2)
    ['FuelGO Quthing Town',            'Main Rd, Quthing',                 'Quthing',      -30.4000,  27.7167, '+266 2275 7000', 'active', '07:00 – 20:00'],
    ['FuelGO Quthing Orange River',    'Orange River Rd, Quthing',         'Quthing',      -30.4200,  27.7400, '+266 2275 7100', 'active', '07:00 – 20:00'],
    // Mohale's Hoek (2)
    ["FuelGO Mohale's Hoek Town",      "Main St, Mohale's Hoek",           "Mohale's Hoek",-30.1500,  27.4667, '+266 2278 8000', 'active', '07:00 – 21:00'],
    ["FuelGO Mohale's Hoek South",     "Mohale's Hoek South",              "Mohale's Hoek",-30.1800,  27.4800, '+266 2278 8100', 'active', '07:00 – 20:00'],
    // Mafeteng (2)
    ['FuelGO Mafeteng Town',           'Main St, Mafeteng',                'Mafeteng',     -29.8167,  27.2333, '+266 2270 9000', 'active', '06:00 – 22:00'],
    ['FuelGO Mafeteng North',          'Mafeteng North',                   'Mafeteng',     -29.8000,  27.2500, '+266 2270 9100', 'active', '06:00 – 22:00'],
    ['FuelGO Mafeteng East',           'Mafeteng East',                    'Mafeteng',     -29.8300,  27.2600, '+266 2270 9200', 'active', '07:00 – 21:00'],
    ['FuelGO Maseru Heights',          'Maseru Heights, Maseru',           'Maseru',       -29.3050,  27.5050, '+266 2231 3900', 'active', '06:00 – 22:00'],
  ];

  for (const s of stationsData) {
    await db.execute(
      `INSERT INTO stations (station_name, location, district, latitude, longitude, contact_number, status, opening_hours)
       VALUES (?,?,?,?,?,?,?,?)`, s);
  }
  console.log(`  ✅ ${stationsData.length} Stations`);

  // ────────────────────────────────────────────────────────
  //  3. PUMPS  (~5 per station, cycling through fuel types)
  // ────────────────────────────────────────────────────────
  const [stations] = await db.query('SELECT station_id FROM stations ORDER BY station_id');
  const fuelCycle  = [1, 2, 3, 4, 1, 2, 3]; // fuel_type_ids to cycle
  for (const { station_id } of stations) {
    const n = rnd(4, 7);
    for (let p = 1; p <= n; p++) {
      await db.execute(
        'INSERT INTO pumps (station_id, pump_number, fuel_type_id, status) VALUES (?,?,?,?)',
        [station_id, p, fuelCycle[(p - 1) % fuelCycle.length], 'available']
      );
    }
  }
  console.log('  ✅ Pumps');

  // ────────────────────────────────────────────────────────
  //  4. ADMIN USER
  // ────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 12);
  await db.execute(
    `INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?,?,?,?,?)`,
    ['System Administrator', 'admin@fuelgo.co.ls', '+266 5800 0001', adminHash, 'admin']
  );

  // ────────────────────────────────────────────────────────
  //  5. EMPLOYEES — 50 Basotho employees across stations
  // ────────────────────────────────────────────────────────
  const firstNames = ['Mohau','Palesa','Katleho','Teboho','Lineo','Thabo','Nthabiseng','Kopano','Refiloe','Sechaba',
    'Mpho','Lerato','Tshepo','Bonolo','Ntlafatso','Mokhosi','Mphonyane','Lebohang','Makena','Tumelo',
    'Bokang','Limpho','Hazel','Tšepiso','Nthabeleng','Puseletso','Matlafatso','Motselisi','Masetšo','Lebogang'];
  const lastNames  = ['Mokoena','Ramaili','Sefali','Molefi','Nkosi','Tšita','Phiri','Khama','Sithole','Dlamini',
    'Letsie','Mofolo','Sehlabo','Lerotholi','Ntšekhe','Tsolo','Molapo','Moshoeshoe','Lelosa','Pule'];

  const empHash = await bcrypt.hash('employee123', 12);
  let empCount = 0;
  for (let i = 0; i < stations.length; i++) {
    const sid = stations[i].station_id;
    const perStation = i < 11 ? 2 : 1; // more staff in Maseru
    for (let j = 0; j < perStation; j++) {
      const fn = firstNames[(empCount * 3 + j) % firstNames.length];
      const ln = lastNames[(empCount + j) % lastNames.length];
      const phone = `+266 ${pick(['58','59','62','63'])} ${String(rnd(100000, 999999))}`;
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${empCount + j}@fuelgo.co.ls`;
      await db.execute(
        'INSERT INTO users (full_name, email, phone, password_hash, role, station_id) VALUES (?,?,?,?,?,?)',
        [`${fn} ${ln}`, email, phone, empHash, 'employee', sid]
      );
    }
    empCount++;
  }
  console.log('  ✅ Employees');

  // ────────────────────────────────────────────────────────
  //  6. CUSTOMERS — 80 Basotho customers
  // ────────────────────────────────────────────────────────
  const custHash = await bcrypt.hash('customer123', 12);
  // Demo customer always first
  const demoHash = await bcrypt.hash('demo1234', 12);
  await db.execute(
    'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?,?,?,?,?)',
    ['Katleho Mokoena', 'demo@fuelgo.co.ls', '+266 5912 3456', demoHash, 'customer']
  );

  const custFirstNames = ['Mohau','Palesa','Teboho','Lineo','Thabo','Refiloe','Sechaba','Mpho','Lerato','Tshepo',
    'Bonolo','Ntlafatso','Mokhosi','Lebohang','Makena','Tumelo','Bokang','Limpho','Tšepiso','Puseletso',
    'Matlafatso','Motselisi','Masetšo','Nthabi','Khosi','Tshidi','Neo','Pontsho','Rethabile','Tlohelang',
    'Maele','Mokete','Motlatsi','Sera','Lebogang','Moseli','Bonang','Tšiutsiu','Retšelisitsoe','Malimpho'];
  const custLastNames = ['Mokoena','Ramaili','Sefali','Molefi','Nkosi','Letsie','Mofolo','Sehlabo','Lerotholi',
    'Ntšekhe','Tsolo','Molapo','Moshoeshoe','Lelosa','Pule','Tau','Ntho','Khama','Sithole','Dlamini',
    'Tšita','Phiri','Ramatlala','Sekola','Sekhesa','Lesotho','Mabitle','Mahase','Maqutu','Koatsa'];

  const custIds = [];
  for (let i = 0; i < 79; i++) {
    const fn = custFirstNames[i % custFirstNames.length];
    const ln = custLastNames[i % custLastNames.length];
    const phone = `+266 ${pick(['58','59','62','63'])} ${String(rnd(100000,999999))}`;
    const email = `${fn.toLowerCase()}${i}@gmail.com`;
    const [r] = await db.execute(
      'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?,?,?,?,?)',
      [`${fn} ${ln}`, email, phone, custHash, 'customer']
    );
    custIds.push(r.insertId);
  }
  // Get all customer ids including demo
  const [allCusts] = await db.query("SELECT user_id FROM users WHERE role='customer' ORDER BY user_id");
  console.log('  ✅ Customers');

  // ────────────────────────────────────────────────────────
  //  7. VEHICLES — ~2 per customer
  // ────────────────────────────────────────────────────────
  const makes  = ['Toyota','Hyundai','Ford','VW','Nissan','Mazda','Honda','Kia','Suzuki','Chevrolet'];
  const models = {
    Toyota:['Corolla','Hilux','RAV4','Prado','Fortuner','Yaris'],
    Hyundai:['i10','i20','Tucson','Creta','Elantra'],
    Ford:['Ranger','Fiesta','Focus','EcoSport','Everest'],
    VW:['Polo','Golf','Tiguan','Passat','Amarok'],
    Nissan:['NP200','NP300','X-Trail','Qashqai','Micra'],
    Mazda:['CX-5','Mazda3','BT-50','CX-3'],
    Honda:['Fit','Civic','CR-V','Jazz','HR-V'],
    Kia:['Picanto','Sportage','Rio','Sorento'],
    Suzuki:['Swift','Vitara','Ertiga','Jimny'],
    Chevrolet:['Cruze','Spark','Trailblazer','Captiva'],
  };
  const colors = ['White','Silver','Black','Red','Blue','Grey','Brown','Green','Orange','Maroon'];
  const plates = ['LM','LA','LT','LB','LQ','LK','LS','LC'];

  const vehicleIds = [];
  for (const { user_id } of allCusts) {
    const vCount = rnd(1, 3);
    for (let v = 0; v < vCount; v++) {
      const make  = pick(makes);
      const model = pick(models[make]);
      const plate = `${pick(plates)} ${rnd(1000, 9999)}`;
      const ftid  = pick([1, 2, 3, 4]);
      const [r] = await db.execute(
        'INSERT INTO vehicles (user_id, plate_number, make, model, year, fuel_type_id, color) VALUES (?,?,?,?,?,?,?)',
        [user_id, plate, make, model, rnd(2010, 2024), ftid, pick(colors)]
      );
      vehicleIds.push({ vehicle_id: r.insertId, user_id, fuel_type_id: ftid });
    }
  }
  console.log('  ✅ Vehicles');

  // ────────────────────────────────────────────────────────
  //  8. REWARDS CATALOGUE
  // ────────────────────────────────────────────────────────
  await db.execute(`
    INSERT INTO rewards (reward_name, description, points_required, category, stock) VALUES
    ('Free Car Wash',           '1× complimentary car wash at any FuelGO station',        500,  'Services',   200),
    ('10L Free Petrol 93',      '10 litres of Petrol 93 at no charge',                    800,  'Fuel',       500),
    ('Oil Change Voucher',      'Full synthetic oil change voucher (up to 5L)',           1200,  'Services',   150),
    ('FuelGO Branded Cap',      'Premium embroidered FuelGO cap',                         400,  'Merchandise',300),
    ('FuelGO Hoodie',           'Premium FuelGO branded hoodie',                         1500,  'Merchandise',100),
    ('20L Free Diesel',         '20 litres of Diesel at no charge',                      1600,  'Fuel',       300),
    ('Tyre Pressure Check',     'Free tyre inflation & pressure check',                   200,  'Services',  1000),
    ('50L Fuel Voucher',        'M50 fuel voucher redeemable at any station',            2000,  'Vouchers',   200),
    ('M100 Fuel Voucher',       'M100 fuel voucher redeemable at any station',           4000,  'Vouchers',   200),
    ('M200 Fuel Voucher',       'M200 fuel voucher redeemable at any station',           7500,  'Vouchers',   100),
    ('Premium Car Detailing',   'Full interior & exterior vehicle detailing',            3000,  'Services',    50),
    ('Platinum Membership Upgrade','Instant Platinum tier upgrade for 90 days',         8000,  'Membership',  50),
    ('Free Air Freshener',      'FuelGO branded luxury air freshener',                    150,  'Merchandise', 500),
    ('Windscreen Wiper Set',    'OEM-compatible wiper blade set',                        1000,  'Parts',       100),
    ('Emergency Roadside Kit',  'Reflective triangle, jump cables, first-aid kit',       2500,  'Safety',      80)`);
  console.log('  ✅ Rewards');

  // ────────────────────────────────────────────────────────
  //  9. LOYALTY ACCOUNTS  (created for all customers)
  // ────────────────────────────────────────────────────────
  await db.query(
    "INSERT INTO loyalty (user_id, points_balance, tier, total_spent) SELECT user_id,0,'Bronze',0 FROM users WHERE role='customer'"
  );

  // ────────────────────────────────────────────────────────
  // 10. TRANSACTIONS  — 800+ over 18 months
  // ────────────────────────────────────────────────────────
  console.log('  ⏳ Generating transactions…');
  const [pumpsAll] = await db.query('SELECT pump_id, station_id, fuel_type_id FROM pumps');
  const [fuelTypes] = await db.query('SELECT fuel_type_id, price_per_litre FROM fuel_types');
  const ftMap = {};
  fuelTypes.forEach(f => { ftMap[f.fuel_type_id] = f.price_per_litre; });
  const pmethods = ['mobile_money','mobile_money','mobile_money','card','wallet','cash'];

  let txnCount = 0;
  const loyaltyUpdates = {}; // user_id → { points, spent }

  for (let day = 540; day >= 0; day--) {
    const dailyCount = rnd(2, 8);
    for (let d = 0; d < dailyCount; d++) {
      const veh  = vehicleIds[(txnCount * 7 + d) % vehicleIds.length];
      const pump = pumpsAll[(txnCount * 3 + d) % pumpsAll.length];
      const ppl  = parseFloat(ftMap[pump.fuel_type_id]);
      const ltrs = parseFloat((rnd(15, 80) + rnd(0,9)/10).toFixed(1));
      const total = parseFloat((ltrs * ppl).toFixed(2));
      const pts   = Math.floor(total / 10);
      const pm    = pick(pmethods);
      const dt    = daysAgo(day);

      await db.execute(
        `INSERT INTO transactions
           (user_id, vehicle_id, pump_id, station_id, fuel_type_id, litres, price_per_litre,
            total_amount, payment_method, points_earned, transaction_date, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,'completed')`,
        [veh.user_id, veh.vehicle_id, pump.pump_id, pump.station_id,
         pump.fuel_type_id, ltrs, ppl, total, pm, pts, dt]
      );

      if (!loyaltyUpdates[veh.user_id]) loyaltyUpdates[veh.user_id] = { points: 0, spent: 0 };
      loyaltyUpdates[veh.user_id].points += pts;
      loyaltyUpdates[veh.user_id].spent  += total;
      txnCount++;
    }
  }

  // Update loyalty balances
  for (const [uid, { points, spent }] of Object.entries(loyaltyUpdates)) {
    const tier = spent >= 50000 ? 'Platinum' : spent >= 20000 ? 'Gold' : spent >= 5000 ? 'Silver' : 'Bronze';
    await db.execute(
      'UPDATE loyalty SET points_balance=?, total_spent=?, tier=? WHERE user_id=?',
      [points, spent.toFixed(2), tier, uid]
    );
  }

  console.log(`  ✅ ${txnCount} Transactions`);

  // ────────────────────────────────────────────────────────
  // 11. LOYALTY TRANSACTION LOG (summary per user)
  // ────────────────────────────────────────────────────────
  const [custList] = await db.query("SELECT user_id FROM users WHERE role='customer'");
  for (const { user_id } of custList) {
    const [[loy]] = await db.query('SELECT points_balance FROM loyalty WHERE user_id=?', [user_id]);
    if (loy && loy.points_balance > 0) {
      await db.execute(
        "INSERT INTO loyalty_transactions (user_id, points, type, description) VALUES (?,?,'bonus','Welcome bonus & accumulated earnings')",
        [user_id, loy.points_balance]
      );
    }
  }

  await db.end();
  console.log('\n🎉 Seeding complete!');
  console.log('──────────────────────────────────────');
  console.log('  Demo accounts:');
  console.log('  Customer  → demo@fuelgo.co.ls   / demo1234');
  console.log('  Employee  → (see employees in DB) / employee123');
  console.log('  Admin     → admin@fuelgo.co.ls  / admin123');
  console.log('──────────────────────────────────────');
}

seed().catch(err => { console.error('❌ Seed failed:', err.message); process.exit(1); });
