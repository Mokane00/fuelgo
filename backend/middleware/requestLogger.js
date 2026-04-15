// ================================================
// FuelGO — requestLogger.js
// Description: Logs every request to logs/access.log
// Author: FuelGO Dev
// ================================================
const fs   = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const logFile = path.join(logsDir, 'access.log');

module.exports = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const line = `${new Date().toISOString()} | ${req.method} ${req.path} | IP: ${req.ip} | ${res.statusCode} | ${Date.now() - start}ms\n`;
    fs.appendFile(logFile, line, () => {});
  });
  next();
};
