// ================================================
// FuelGO — initDB.js
// Description: Auto-creates DB, tables, indexes, and seeds default data
// Author: FuelGO Dev
// ================================================
const mysql  = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

async function initDB() {
  // Support Railway MYSQL_URL or individual env vars
  let connConfig;
  if (process.env.MYSQL_URL) {
    connConfig = { uri: process.env.MYSQL_URL };
  } else {
    connConfig = {
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 3306,
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
    };
  }
  const conn = await mysql.createConnection(connConfig);
  try {
    const DB = process.env.DB_NAME || (process.env.MYSQL_URL ? new URL(process.env.MYSQL_URL).pathname.slice(1) : 'fuelgo_db');
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${DB}\``);

    await conn.query(`CREATE TABLE IF NOT EXISTS users (
      user_id INT PRIMARY KEY AUTO_INCREMENT,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      phone VARCHAR(25),
      password_hash VARCHAR(255) NOT NULL DEFAULT '',
      role ENUM('customer','employee','admin') NOT NULL DEFAULT 'customer',
      station_id INT NULL,
      google_id VARCHAR(100) NULL,
      avatar_url VARCHAR(500) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    // Add new columns to existing tables if they don't exist
    // Note: no IF NOT EXISTS — works on MySQL 5.7+ via .catch() silencing duplicate-column errors
    await conn.query(`ALTER TABLE users ADD COLUMN google_id VARCHAR(100) NULL`).catch(() => {});
    await conn.query(`ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL`).catch(() => {});
    await conn.query(`ALTER TABLE users ADD COLUMN fcm_token VARCHAR(500) NULL`).catch(() => {});
    await conn.query(`ALTER TABLE users ADD COLUMN fuel_budget DECIMAL(10,2) NULL`).catch(() => {});
    await conn.query(`ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1`).catch(() => {});
    await conn.query(`ALTER TABLE vehicles ADD COLUMN tank_size DECIMAL(6,1) NULL`).catch(() => {});
    await conn.query(`ALTER TABLE vehicles ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0`).catch(() => {});

    await conn.query(`CREATE TABLE IF NOT EXISTS stations (
      station_id INT PRIMARY KEY AUTO_INCREMENT,
      station_name VARCHAR(120) NOT NULL,
      location VARCHAR(200),
      district VARCHAR(60),
      latitude DECIMAL(10,7),
      longitude DECIMAL(10,7),
      contact_number VARCHAR(25),
      status ENUM('active','inactive','maintenance') DEFAULT 'active',
      opening_hours VARCHAR(100) DEFAULT '06:00 - 22:00',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS fuel_types (
      fuel_type_id INT PRIMARY KEY AUTO_INCREMENT,
      fuel_name VARCHAR(60) NOT NULL,
      price_per_litre DECIMAL(10,2) NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS pumps (
      pump_id INT PRIMARY KEY AUTO_INCREMENT,
      station_id INT NOT NULL,
      pump_number INT NOT NULL,
      fuel_type_id INT NOT NULL,
      status ENUM('available','in_use','maintenance') DEFAULT 'available',
      FOREIGN KEY (station_id)   REFERENCES stations(station_id)   ON DELETE CASCADE,
      FOREIGN KEY (fuel_type_id) REFERENCES fuel_types(fuel_type_id)
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS vehicles (
      vehicle_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      plate_number VARCHAR(20) NOT NULL,
      make VARCHAR(60),
      model VARCHAR(60),
      year SMALLINT,
      fuel_type_id INT,
      color VARCHAR(40),
      tank_size DECIMAL(6,1) NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (fuel_type_id) REFERENCES fuel_types(fuel_type_id)
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS transactions (
      transaction_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      vehicle_id INT,
      pump_id INT,
      station_id INT NOT NULL,
      fuel_type_id INT NOT NULL,
      litres DECIMAL(10,2) NOT NULL,
      price_per_litre DECIMAL(10,2) NOT NULL,
      total_amount DECIMAL(12,2) NOT NULL,
      payment_method ENUM('mobile_money','card','wallet','cash') DEFAULT 'mobile_money',
      points_earned INT DEFAULT 0,
      transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      co2_kg DECIMAL(10,2) DEFAULT NULL,
      status ENUM('pending','completed','failed','refunded') DEFAULT 'completed',
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      FOREIGN KEY (station_id) REFERENCES stations(station_id),
      FOREIGN KEY (fuel_type_id) REFERENCES fuel_types(fuel_type_id)
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS loyalty (
      loyalty_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT UNIQUE NOT NULL,
      points_balance INT DEFAULT 0,
      tier ENUM('Bronze','Silver','Gold','Platinum') DEFAULT 'Bronze',
      total_spent DECIMAL(14,2) DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS loyalty_transactions (
      lt_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      points INT NOT NULL,
      type ENUM('earned','redeemed','bonus','expired') DEFAULT 'earned',
      description VARCHAR(200),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS rewards (
      reward_id INT PRIMARY KEY AUTO_INCREMENT,
      reward_name VARCHAR(100) NOT NULL,
      description TEXT,
      points_required INT NOT NULL,
      category VARCHAR(50),
      is_active TINYINT(1) DEFAULT 1,
      stock INT DEFAULT 100
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS price_alerts (
      alert_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      fuel_type_id INT NOT NULL,
      threshold_price DECIMAL(10,2) NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_triggered_at TIMESTAMP NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (fuel_type_id) REFERENCES fuel_types(fuel_type_id)
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS user_favourites (
      fav_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      station_id INT NOT NULL,
      label ENUM('home','work','other') DEFAULT 'other',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_station (user_id, station_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS station_ratings (
      rating_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      station_id INT NOT NULL,
      rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_station_rating (user_id, station_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS audit_logs (
      log_id       INT PRIMARY KEY AUTO_INCREMENT,
      actor_id     INT NULL,
      actor_email  VARCHAR(100) NOT NULL DEFAULT '',
      actor_role   VARCHAR(20)  NOT NULL DEFAULT '',
      action       VARCHAR(60)  NOT NULL,
      target_type  VARCHAR(40)  NOT NULL DEFAULT '',
      target_id    INT NULL,
      target_label VARCHAR(200) NOT NULL DEFAULT '',
      ip_address   VARCHAR(45)  NOT NULL DEFAULT '',
      metadata     JSON         NULL,
      created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE SET NULL,
      INDEX idx_al_actor  (actor_id),
      INDEX idx_al_action (action),
      INDEX idx_al_ts     (created_at)
    ) ENGINE=InnoDB`);

    // ALTER existing tables to add columns that may be missing on older DBs
    const alters = [
      "ALTER TABLE transactions ADD COLUMN co2_kg DECIMAL(10,2) DEFAULT NULL",
    ];
    for (const q of alters) { try { await conn.query(q); } catch {} }

    // Indexes
    const idxQueries = [
      'CREATE INDEX IF NOT EXISTS idx_txn_user    ON transactions(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_txn_station ON transactions(station_id)',
      'CREATE INDEX IF NOT EXISTS idx_txn_date    ON transactions(transaction_date)',
      'CREATE INDEX IF NOT EXISTS idx_pumps_st    ON pumps(station_id)',
      'CREATE INDEX IF NOT EXISTS idx_vehicles_u  ON vehicles(user_id)',
    ];
    for (const q of idxQueries) { try { await conn.query(q); } catch {} }

    // Seed fuel types
    const [[ftRow]] = await conn.query('SELECT COUNT(*) c FROM fuel_types');
    if (ftRow.c === 0) {
      await conn.query(`INSERT IGNORE INTO fuel_types (fuel_name, price_per_litre) VALUES ('Petrol',16.80),('Diesel',14.50),('Premium',18.20)`);
      console.log('[initDB] Fuel types seeded.');
    }

    // Seed demo accounts
    const [[adminRow]] = await conn.query("SELECT COUNT(*) c FROM users WHERE role='admin'");
    if (adminRow.c === 0) {
      const adminHash    = await bcrypt.hash('Admin@2025', 12);
      const demoHash     = await bcrypt.hash('demo123', 12);

      // Admin (primary)
      const [adminRes] = await conn.query(
        "INSERT INTO users (full_name,email,password_hash,role) VALUES ('FuelGO Admin','admin@fuelgo.ls',?,'admin')", [adminHash]);
      await conn.query("INSERT INTO loyalty (user_id,points_balance,tier,total_spent) VALUES (?,0,'Bronze',0)", [adminRes.insertId]);

      // Employee demo — station_id assigned after stations are seeded (see UPDATE below)
      const [empRes] = await conn.query(
        "INSERT INTO users (full_name,email,password_hash,role) VALUES ('Sarah Nkosi','sarah@fuelgo.ls',?,'employee')", [demoHash]);
      await conn.query("INSERT INTO loyalty (user_id,points_balance,tier,total_spent) VALUES (?,0,'Bronze',0)", [empRes.insertId]);

      // Customer demo
      const [custRes] = await conn.query(
        "INSERT INTO users (full_name,email,password_hash,role) VALUES ('Justin Molefe','justin@fuelgo.ls',?,'customer')", [demoHash]);
      await conn.query("INSERT INTO loyalty (user_id,points_balance,tier,total_spent) VALUES (?,1850,'Silver',18500)", [custRes.insertId]);

      console.log('[initDB] Demo accounts seeded:');
      console.log('  Admin:    admin@fuelgo.ls   / Admin@2025');
      console.log('  Employee: sarah@fuelgo.ls   / demo123');
      console.log('  Customer: justin@fuelgo.ls  / demo123');
    }

    // Seed real Lesotho stations (replace any old FuelGO placeholders)
    const [[fuelgoCheck]] = await conn.query("SELECT COUNT(*) c FROM stations WHERE station_name LIKE 'FuelGO%'");
    if (fuelgoCheck.c > 0) {
      await conn.query("DELETE FROM pumps WHERE station_id IN (SELECT station_id FROM stations WHERE station_name LIKE 'FuelGO%')");
      await conn.query("DELETE FROM stations WHERE station_name LIKE 'FuelGO%'");
      console.log('[initDB] Removed placeholder FuelGO stations.');
    }

    const [[stRow]] = await conn.query('SELECT COUNT(*) c FROM stations');
    if (stRow.c < 55) {
      // (Re)seed comprehensive real Lesotho stations — all 10 districts, ~59 stations
      // Disable FK checks so we can wipe and re-seed without constraint errors
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      await conn.query('DELETE FROM pumps');
      await conn.query('DELETE FROM stations');
      await conn.query('SET FOREIGN_KEY_CHECKS = 1');

      await conn.query(`INSERT INTO stations
        (station_name, location, district, latitude, longitude, contact_number, status, opening_hours) VALUES

        -- Maseru District (23 stations) — GPS verified from near-place.com / Puma Africa data
        ('Engen Pioneer Auto Services',   'Pioneer Road, Maseru 100',                  'Maseru',         -29.3147,  27.4795, '+266 2232 2288', 'active', '05:30-22:30'),
        ('Engen Mejametalana',            '1 Lakeside Hotel St, Mejametalana, Maseru',  'Maseru',         -29.3128,  27.5103, '+266 6223 2720', 'active', '05:00-23:00'),
        ('Engen Main North 1',            'Main North 1 Road, Foso, Maseru',            'Maseru',         -29.3062,  27.5146, '+266 2231 5100', 'active', '06:00-22:00'),
        ('Engen Bataung',                 'Main South 1 Road, Bataung, Maseru',         'Maseru',         -29.3374,  27.5107, '+266 6205 0459', 'active', '06:00-22:00'),
        ('Engen Naledi',                  'Main South 1 Road, Naledi, Maseru 102',      'Maseru',         -29.3476,  27.5185, '+266 2231 3863', 'active', '06:00-22:00'),
        ('Engen Ha Thetsane',             'Ha Thetsane Industrial Area, Maseru',         'Maseru',         -29.3520,  27.5180, '+266 2232 0022', 'active', '06:00-21:00'),
        ('Total Crossroads Garage',       'South Motorway, Maseru',                      'Maseru',         -29.3600,  27.5123, '+266 2232 1200', 'active', '05:00-23:00'),
        ('Total Goodhope Filling Station','Main South One Road, Southern Maseru',        'Maseru',         -29.4045,  27.5619, '+266 2231 9900', 'active', '06:00-21:00'),
        ('Bafokeng Petrol Station',       'Main South 1 Road, Maseru',                  'Maseru',         -29.3688,  27.5375, '+266 2232 5500', 'active', '06:00-21:00'),
        ('Excel Filling Station CBD',     'Kingsway Road, CBD, Maseru',                  'Maseru',         -29.3107,  27.4881, '+266 2231 8800', 'active', '06:00-22:00'),
        ('Excel Filling Station West',    'Kofi Annan Road, Maseru West',                'Maseru',         -29.3475,  27.4555, '+266 2231 7700', 'active', '06:00-21:00'),
        ('Paul Motors',                   'Katlehong, Maseru',                            'Maseru',         -29.3320,  27.4862, '+266 2231 6600', 'active', '06:00-20:00'),
        ('Puma Auto Pride',               'Main South 1 Road, Maseru',                   'Maseru',         -29.3195,  27.4960, '+266 2231 2648', 'active', '06:00-22:00'),
        ('Puma Ha Matala',                'Ha Matala, Khubetsoana, Maseru',               'Maseru',         -29.2985,  27.4754, '+266 2231 4400', 'active', '06:00-22:00'),
        ('Puma Lancers Inn',              'Dove Road, Maseru CBD',                        'Maseru',         -29.3195,  27.4779, '+266 2231 5500', 'active', '06:00-22:00'),
        ('Puma Borokhoaneng',             'Main South 1, Borokhoaneng, Maseru',           'Maseru',         -29.3515,  27.4950, '+266 2232 3300', 'active', '06:00-21:00'),
        ('Puma Khubetsoana',              'A1 Road, Khubetsoana, Maseru',                 'Maseru',         -29.2905,  27.4700, '+266 2231 3300', 'active', '06:00-22:00'),
        ('Puma Lehakoe',                  'Moshoeshoe Road, Lehakoe, Maseru',             'Maseru',         -29.3080,  27.4870, '+266 2231 0011', 'active', '06:00-22:00'),
        ('Puma Lekhalaneng',              'Main South 1, Lekhalaneng, Maseru',            'Maseru',         -29.3420,  27.5060, '+266 2232 1100', 'active', '06:00-21:00'),
        ('Shell Kingsway',                'Kingsway Road (near Avani Hotel), Maseru',     'Maseru',         -29.3142,  27.4860, '+266 2232 4400', 'active', '05:30-23:00'),
        ('Tholo Energy Kingsway',         'Cnr Balfour & Kingsway, Maseru',               'Maseru',         -29.3127,  27.4849, '+266 2221 5800', 'active', '06:00-22:00'),
        ('Shell Mazenod',                 'Main Road, Mazenod, Maseru District',           'Maseru',         -29.4114,  27.6195, '+266 2233 0011', 'active', '06:00-21:00'),
        ('Puma Roma',                     'A3 Road, Roma Village, Maseru District',        'Maseru',         -29.4413,  27.7048, '+266 2234 0011', 'active', '07:00-20:00'),

        -- Leribe District — Hlotse / Maputsoe (10 stations)
        ('Shell Maputsoe',                'Sir Seretse Khama Rd, Maputsoe',               'Leribe',         -28.8903,  27.9099, '+266 2243 1800', 'active', '00:00-23:59'),
        ('Engen Gateway Maputsoe',        'Sir Seretse Khama Rd, Border, Maputsoe 350',   'Leribe',         -28.8764,  27.9001, '+266 6643 0263', 'active', '00:00-23:59'),
        ('Engen Hlotse',                  'Pioneer Road, Hlotse, Leribe',                  'Leribe',         -28.8712,  27.9022, '+266 2240 0011', 'active', '06:00-21:00'),
        ('Shell Hlotse',                  'Main North Road, Hlotse, Leribe',                'Leribe',         -28.8700,  27.9005, '+266 2240 0022', 'active', '06:00-21:00'),
        ('Puma Maputsoe Ha-Sekekete',     'Ha-Sekekete, Maputsoe, Leribe',                 'Leribe',         -28.8880,  27.9090, '+266 2243 1900', 'active', '06:00-22:00'),
        ('Puma Maputsoe Ha-Nyenye',       'Ha-Nyenye, Maputsoe, Leribe',                   'Leribe',         -28.8820,  27.9050, '+266 2243 2000', 'active', '06:00-21:00'),
        ('Puma Hlotse',                   'Pioneer Road, Hlotse, Leribe',                  'Leribe',         -28.8720,  27.9012, '+266 2240 0055', 'active', '06:00-21:00'),
        ('Northern Filling Station',      'Main Road, Hlotse, Leribe',                     'Leribe',         -28.8954,  27.9073, '+266 2243 1700', 'active', '06:00-20:00'),
        ('Tholo Energy Maputsoe',         'Main North Road, Maputsoe, Leribe',              'Leribe',         -28.8770,  27.9018, '+266 2243 0077', 'active', '06:00-21:00'),
        ('Peka Filling Station',          'A1 Road, Peka, Leribe',                          'Leribe',         -28.9722,  27.7647, '+266 2244 0011', 'active', '07:00-19:00'),

        -- Berea District (Teyateyaneng / TY) (8 stations)
        ('Engen Teyateyaneng',            'Main North Road, Teyateyaneng',                  'Berea',          -29.1508,  27.7353, '+266 2250 0011', 'active', '06:00-21:00'),
        ('Shell Teyateyaneng',            'Main North Road, Teyateyaneng, Berea',            'Berea',          -29.1500,  27.7348, '+266 2250 0022', 'active', '06:00-21:00'),
        ('Puma TY Service Station',       'A1 Road, Teyateyaneng, Berea',                   'Berea',          -29.1472,  27.7490, '+266 2250 0033', 'active', '06:00-22:00'),
        ('Ha Seotsanyana Filling Station','Main Road, Mapoteng, Berea',                     'Berea',          -29.1210,  27.9760, '+266 2255 0011', 'active', '07:00-19:00'),
        ('Engen Mapoteng',                'Main Road, Mapoteng, Berea',                     'Berea',          -29.1200,  27.9750, '+266 2255 0022', 'active', '07:00-19:00'),
        ('Shell Mapoteng',                'Main Road, Mapoteng, Berea',                     'Berea',          -29.1220,  27.9770, '+266 2255 0033', 'active', '07:00-19:00'),
        ('Tholo Energy TY',               'Teyateyaneng Town Centre, Berea',                'Berea',          -29.1480,  27.7480, '+266 2250 0044', 'active', '06:00-21:00'),
        ('Puma Berea Centre',             'Main Street, Teyateyaneng, Berea',               'Berea',          -29.1514,  27.7360, '+266 2250 0055', 'active', '06:00-21:00'),

        -- Mafeteng District (4 stations)
        ('Engen Mafeteng',                'Main South 1 Road, Mafeteng',                    'Mafeteng',       -29.8162,  27.2337, '+266 2270 0011', 'active', '06:00-21:00'),
        ('Shell Mafeteng',                'Main Road, Mafeteng Town',                        'Mafeteng',       -29.8168,  27.2325, '+266 2270 0022', 'active', '06:00-21:00'),
        ('City Filling Station',          'Main Street, Mafeteng',                           'Mafeteng',       -29.8230,  27.2374, '+266 2270 0488', 'active', '06:00-21:00'),
        ('Puma Thabana-Morena',           'Main Road, Thabana-Morena, Mafeteng',             'Mafeteng',       -29.8650,  27.2990, '+266 2270 0099', 'active', '07:00-19:00'),

        -- Mohale''s Hoek District (3 stations)
        ('Engen Mohale''s Hoek',          'A2 Road, Mohale''s Hoek',                        'Mohale''s Hoek', -30.1514,  27.4769, '+266 2278 0011', 'active', '06:00-21:00'),
        ('Puma Mohale''s Hoek',           'Main Street, Mohale''s Hoek',                    'Mohale''s Hoek', -30.1510,  27.4775, '+266 2278 0022', 'active', '06:00-21:00'),
        ('Molomo Filling Station',        'Main Road, Mohale''s Hoek',                      'Mohale''s Hoek', -30.1490,  27.4762, '+266 2278 5796', 'active', '06:00-20:00'),

        -- Butha-Buthe District (3 stations)
        ('Puma Butha-Buthe',              'A1 Road, Butha-Buthe',                            'Butha-Buthe',    -28.7666,  28.2494, '+266 2246 0011', 'active', '06:00-20:00'),
        ('Engen Butha-Buthe',             'Main North Road, Butha-Buthe',                    'Butha-Buthe',    -28.7658,  28.2488, '+266 2246 0022', 'active', '06:00-20:00'),
        ('Shell Butha-Buthe',             'Main Road, Butha-Buthe Town',                     'Butha-Buthe',    -28.7675,  28.2500, '+266 2246 0033', 'active', '06:00-20:00'),

        -- Quthing District (Moyeni) (3 stations)
        ('Engen Quthing',                 'A4 Road, Moyeni (Quthing)',                       'Quthing',        -30.3833,  27.7000, '+266 2275 0011', 'active', '06:00-20:00'),
        ('Total Quthing',                 'Main Road, Moyeni, Quthing',                      'Quthing',        -30.4000,  27.7003, '+266 2275 0641', 'active', '06:00-20:00'),
        ('Puma Sea Point Quthing',        'A4 Road, Quthing',                                'Quthing',        -30.4010,  27.7010, '+266 2275 0022', 'active', '07:00-19:00'),

        -- Mokhotlong District (3 stations)
        ('Puma Mokhotlong',               'Main Road, Mokhotlong Town',                      'Mokhotlong',     -29.2580,  29.0630, '+266 2292 0011', 'active', '07:00-19:00'),
        ('Engen Mokhotlong',              'Main Road, Mokhotlong Town',                      'Mokhotlong',     -29.2583,  29.0667, '+266 2292 0022', 'active', '07:00-18:00'),
        ('Puma Mapholaneng',              'A1 Road, Mapholaneng, Mokhotlong',                'Mokhotlong',     -29.3780,  28.8490, '+266 2292 0033', 'active', '07:00-18:00'),

        -- Qacha''s Nek District (1 station)
        ('Engen Qacha''s Nek',            'Main Road, Qacha''s Nek Town',                   'Qacha''s Nek',   -30.1167,  28.6833, '+266 2295 0011', 'active', '07:00-18:00'),

        -- Thaba-Tseka District (1 station)
        ('Engen Thaba-Tseka',             'Main Road, Thaba-Tseka Town',                    'Thaba-Tseka',    -29.5220,  28.6084, '+266 2290 0011', 'active', '07:00-18:00')
      `);

      // Seed pumps for every station (3 pumps each: Petrol, Diesel, Premium)
      const [stations] = await conn.query('SELECT station_id FROM stations');
      const [fuels]    = await conn.query('SELECT fuel_type_id FROM fuel_types ORDER BY fuel_type_id LIMIT 3');
      for (const st of stations) {
        for (let i = 0; i < fuels.length; i++) {
          await conn.query(
            "INSERT INTO pumps (station_id,pump_number,fuel_type_id,status) VALUES (?,?,?,'available')",
            [st.station_id, i + 1, fuels[i].fuel_type_id]
          );
        }
      }
      console.log(`[initDB] ${stations.length} real Lesotho stations and pumps seeded.`);

      // Assign employee to Engen Pioneer Auto Services
      const [[firstStation]] = await conn.query("SELECT station_id FROM stations WHERE station_name='Engen Pioneer Auto Services' LIMIT 1");
      if (firstStation) {
        await conn.query("UPDATE users SET station_id=? WHERE email='sarah@fuelgo.ls'", [firstStation.station_id]);
        console.log(`[initDB] Employee sarah@fuelgo.ls assigned to station_id=${firstStation.station_id}.`);
      }
    }

    // Seed rewards
    const [[rRow]] = await conn.query('SELECT COUNT(*) c FROM rewards');
    if (rRow.c === 0) {
      await conn.query(`INSERT INTO rewards (reward_name,description,points_required,category,is_active,stock) VALUES
        ('Free 5L Petrol','Get 5 free litres of petrol at any FuelGO station',500,'Fuel',1,100),
        ('10% Discount','10% discount on your next fuel purchase',300,'Discount',1,100),
        ('Free Car Wash','Complimentary car wash at participating stations',200,'Service',1,50),
        ('Free 10L Diesel','Get 10 free litres of diesel fuel',900,'Fuel',1,100),
        ('Premium Upgrade','Get 5L of Premium fuel for the price of Petrol',400,'Upgrade',1,50),
        ('Mystery Box','Surprise reward could be fuel, discount, or more!',150,'Special',1,200)`);
      console.log('[initDB] Rewards seeded.');
    }

    console.log('[initDB] Database initialized successfully.');
  } catch (err) {
    console.error('[initDB] Initialization error:', err.message);
    throw err;
  } finally {
    await conn.end();
  }
}

module.exports = initDB;
