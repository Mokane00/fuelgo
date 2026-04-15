// ================================================
// FuelGO — db.js
// Description: MySQL connection pool
// Author: FuelGO Dev
// ================================================
const mysql = require('mysql2/promise');
require('dotenv').config();

// Support Railway's MYSQL_URL connection string OR individual vars
const poolConfig = process.env.MYSQL_URL
  ? {
      uri: process.env.MYSQL_URL,
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
      timezone: '+00:00',
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 3306,
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME     || 'fuelgo_db',
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
      timezone: '+00:00',
    };

const pool = mysql.createPool(poolConfig);

module.exports = pool;
