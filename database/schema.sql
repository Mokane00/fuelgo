-- ============================================================
--  FuelGO Database Schema
--  MySQL 8.0+
-- ============================================================

CREATE DATABASE IF NOT EXISTS fuelgo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE fuelgo;

-- ── Users ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  user_id       INT PRIMARY KEY AUTO_INCREMENT,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(100) NOT NULL UNIQUE,
  phone         VARCHAR(25),
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('customer','employee','admin') NOT NULL DEFAULT 'customer',
  station_id    INT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Stations ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stations (
  station_id    INT PRIMARY KEY AUTO_INCREMENT,
  station_name  VARCHAR(120) NOT NULL,
  location      VARCHAR(200),
  district      VARCHAR(60),
  latitude      DECIMAL(10,7),
  longitude     DECIMAL(10,7),
  contact_number VARCHAR(25),
  status        ENUM('active','inactive','maintenance') DEFAULT 'active',
  opening_hours VARCHAR(100) DEFAULT '06:00 – 22:00',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Fuel Types ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_types (
  fuel_type_id    INT PRIMARY KEY AUTO_INCREMENT,
  fuel_name       VARCHAR(60) NOT NULL,
  price_per_litre DECIMAL(10,2) NOT NULL,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── Pumps ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pumps (
  pump_id      INT PRIMARY KEY AUTO_INCREMENT,
  station_id   INT NOT NULL,
  pump_number  INT NOT NULL,
  fuel_type_id INT NOT NULL,
  status       ENUM('available','in_use','maintenance') DEFAULT 'available',
  FOREIGN KEY (station_id)   REFERENCES stations(station_id)  ON DELETE CASCADE,
  FOREIGN KEY (fuel_type_id) REFERENCES fuel_types(fuel_type_id)
);

-- ── Vehicles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id   INT PRIMARY KEY AUTO_INCREMENT,
  user_id      INT NOT NULL,
  plate_number VARCHAR(20) NOT NULL,
  make         VARCHAR(60),
  model        VARCHAR(60),
  year         SMALLINT,
  fuel_type_id INT,
  color        VARCHAR(40),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)      REFERENCES users(user_id)      ON DELETE CASCADE,
  FOREIGN KEY (fuel_type_id) REFERENCES fuel_types(fuel_type_id)
);

-- ── Transactions ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id   INT PRIMARY KEY AUTO_INCREMENT,
  user_id          INT NOT NULL,
  vehicle_id       INT,
  pump_id          INT,
  station_id       INT NOT NULL,
  fuel_type_id     INT NOT NULL,
  litres           DECIMAL(10,2) NOT NULL,
  price_per_litre  DECIMAL(10,2) NOT NULL,
  total_amount     DECIMAL(12,2) NOT NULL,
  payment_method   ENUM('mobile_money','card','wallet','cash') DEFAULT 'mobile_money',
  points_earned    INT DEFAULT 0,
  transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status           ENUM('pending','completed','failed','refunded') DEFAULT 'completed',
  FOREIGN KEY (user_id)      REFERENCES users(user_id),
  FOREIGN KEY (station_id)   REFERENCES stations(station_id),
  FOREIGN KEY (fuel_type_id) REFERENCES fuel_types(fuel_type_id)
);

-- ── Loyalty Accounts ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty (
  loyalty_id     INT PRIMARY KEY AUTO_INCREMENT,
  user_id        INT UNIQUE NOT NULL,
  points_balance INT DEFAULT 0,
  tier           ENUM('Bronze','Silver','Gold','Platinum') DEFAULT 'Bronze',
  total_spent    DECIMAL(14,2) DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ── Loyalty Transactions ──────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  lt_id       INT PRIMARY KEY AUTO_INCREMENT,
  user_id     INT NOT NULL,
  points      INT NOT NULL,
  type        ENUM('earned','redeemed','bonus','expired') DEFAULT 'earned',
  description VARCHAR(200),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ── Rewards Catalogue ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS rewards (
  reward_id       INT PRIMARY KEY AUTO_INCREMENT,
  reward_name     VARCHAR(100) NOT NULL,
  description     TEXT,
  points_required INT NOT NULL,
  category        VARCHAR(50),
  is_active       TINYINT(1) DEFAULT 1,
  stock           INT DEFAULT 100
);

-- ── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_txn_user    ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_txn_station ON transactions(station_id);
CREATE INDEX IF NOT EXISTS idx_txn_date    ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_pumps_st    ON pumps(station_id);

-- ── Price Alerts ───────────────────────────────
CREATE TABLE IF NOT EXISTS price_alerts (
  alert_id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  fuel_type_id     INT NOT NULL,
  threshold_price  DECIMAL(10,2) NOT NULL,
  is_active        TINYINT(1) DEFAULT 1,
  last_triggered_at TIMESTAMP NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)      REFERENCES users(user_id)      ON DELETE CASCADE,
  FOREIGN KEY (fuel_type_id) REFERENCES fuel_types(fuel_type_id)
);

-- ── Station Ratings ────────────────────────────
CREATE TABLE IF NOT EXISTS station_ratings (
  rating_id  INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  station_id INT NOT NULL,
  rating     TINYINT NOT NULL,
  comment    VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_station_rat (user_id, station_id),
  FOREIGN KEY (user_id)    REFERENCES users(user_id)    ON DELETE CASCADE,
  FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE
);

-- ── User Favourites ────────────────────────────
CREATE TABLE IF NOT EXISTS user_favourites (
  fav_id     INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  station_id INT NOT NULL,
  label      ENUM('home','work','other') DEFAULT 'other',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_station_fav (user_id, station_id),
  FOREIGN KEY (user_id)    REFERENCES users(user_id)    ON DELETE CASCADE,
  FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE
);

-- ── New columns (safe to re-run) ───────────────
ALTER TABLE vehicles    ADD COLUMN IF NOT EXISTS tank_size   DECIMAL(5,1)  DEFAULT NULL;
ALTER TABLE users       ADD COLUMN IF NOT EXISTS fuel_budget DECIMAL(10,2) DEFAULT NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS co2_kg     DECIMAL(8,4)  DEFAULT NULL;

-- ── Performance Indexes ────────────────────────
-- Core query paths for optimized lookups and JOIN performance
CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role         ON users(role);
CREATE INDEX IF NOT EXISTS idx_txn_fuel           ON transactions(fuel_type_id);
CREATE INDEX IF NOT EXISTS idx_txn_vehicle        ON transactions(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_txn_amount         ON transactions(total_amount);
CREATE INDEX IF NOT EXISTS idx_txn_date_station   ON transactions(transaction_date, station_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_user      ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_fuel      ON vehicles(fuel_type_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_user       ON loyalty(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tier       ON loyalty(tier);
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_user   ON loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_type   ON loyalty_transactions(type);
CREATE INDEX IF NOT EXISTS idx_pumps_fuel         ON pumps(fuel_type_id);
CREATE INDEX IF NOT EXISTS idx_pumps_status       ON pumps(status);
CREATE INDEX IF NOT EXISTS idx_stations_district  ON stations(district);
CREATE INDEX IF NOT EXISTS idx_stations_status    ON stations(status);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user  ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_fuel  ON price_alerts(fuel_type_id);
CREATE INDEX IF NOT EXISTS idx_ratings_station    ON station_ratings(station_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user       ON station_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_favourites_user    ON user_favourites(user_id);
