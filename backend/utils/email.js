// ================================================
// FuelGO — utils/email.js
// Description: Email via SendGrid (primary) with Gmail SMTP fallback
// ================================================
const sgMail    = require('@sendgrid/mail');
const nodemailer = require('nodemailer');

// Configure SendGrid if key is present
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Gmail SMTP fallback transporter
const smtpTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function send(to, subject, html) {
  const from = `"FuelGO" <${process.env.SMTP_USER || 'noreply@fuelgo.ls'}>`;

  // Try SendGrid first
  if (process.env.SENDGRID_API_KEY) {
    await sgMail.send({ to, from, subject, html });
    return;
  }

  // Fallback: Gmail SMTP
  if (process.env.SMTP_USER && process.env.SMTP_USER !== 'your_gmail@gmail.com') {
    await smtpTransporter.sendMail({ from, to, subject, html });
    return;
  }

  // Dev mode: log only
  console.log(`[DEV EMAIL] To: ${to} | Subject: ${subject}`);
}

// ── Templates ─────────────────────────────────

async function sendReceiptEmail(to, { userName, transactionId, stationName, fuelType, litres, totalAmount, paymentMethod, createdAt }) {
  await send(to, `FuelGO Receipt — Transaction #${transactionId}`, `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#0f2548,#1a3c6e);padding:32px 36px;text-align:center">
      <div style="font-size:42px;margin-bottom:8px">⛽</div>
      <h1 style="color:#fff;margin:0;font-size:1.6rem;letter-spacing:-0.5px">FuelGO</h1>
      <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:0.9rem">Digital Fuel Payment Platform</p>
    </div>
    <div style="padding:32px 36px">
      <h2 style="color:#0f2548;margin:0 0 6px;font-size:1.25rem">Payment Receipt</h2>
      <p style="color:#64748b;margin:0 0 28px;font-size:0.9rem">Hi ${userName}, your fuel payment was successful!</p>
      <table style="width:100%;border-collapse:collapse">
        <tr style="border-bottom:1px solid #e2e8f0"><td style="padding:10px 0;color:#64748b;font-size:0.88rem">Transaction ID</td><td style="padding:10px 0;font-weight:600;text-align:right">#${transactionId}</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0"><td style="padding:10px 0;color:#64748b;font-size:0.88rem">Station</td><td style="padding:10px 0;font-weight:600;text-align:right">${stationName}</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0"><td style="padding:10px 0;color:#64748b;font-size:0.88rem">Fuel Type</td><td style="padding:10px 0;font-weight:600;text-align:right">${fuelType}</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0"><td style="padding:10px 0;color:#64748b;font-size:0.88rem">Litres</td><td style="padding:10px 0;font-weight:600;text-align:right">${parseFloat(litres).toFixed(2)} L</td></tr>
        <tr style="border-bottom:1px solid #e2e8f0"><td style="padding:10px 0;color:#64748b;font-size:0.88rem">Payment Method</td><td style="padding:10px 0;font-weight:600;text-align:right;text-transform:capitalize">${(paymentMethod||'').replace('_',' ')}</td></tr>
        <tr style="border-bottom:2px solid #0f2548"><td style="padding:14px 0;color:#0f2548;font-weight:700">Total Amount</td><td style="padding:14px 0;font-size:1.2rem;font-weight:800;color:#f97316;text-align:right">M${parseFloat(totalAmount).toFixed(2)}</td></tr>
      </table>
      <p style="color:#94a3b8;font-size:0.8rem;margin:20px 0 0;text-align:center">${new Date(createdAt||Date.now()).toLocaleString('en-GB',{timeZone:'Africa/Maseru'})}</p>
    </div>
    <div style="background:#f8fafc;padding:20px 36px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="color:#94a3b8;font-size:0.78rem;margin:0">FuelGO — Fuel Smarter. Pay Faster. Drive Further.<br>Lesotho's digital fuel payment platform.</p>
    </div>
  </div>
  </body>
  </html>`);
}

async function sendWelcomeEmail(to, { userName }) {
  await send(to, 'Welcome to FuelGO!', `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#0f2548,#1a3c6e);padding:32px 36px;text-align:center">
      <div style="font-size:42px;margin-bottom:8px">⛽</div>
      <h1 style="color:#fff;margin:0;font-size:1.6rem">Welcome to FuelGO</h1>
    </div>
    <div style="padding:32px 36px;text-align:center">
      <h2 style="color:#0f2548;margin:0 0 12px">Hi ${userName}!</h2>
      <p style="color:#64748b;line-height:1.7">Your FuelGO account is ready. You can now locate stations, pay at the pump, and earn loyalty points — all from your phone.</p>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5001'}/index.html" style="display:inline-block;margin-top:24px;padding:14px 32px;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:0.95rem">Get Started</a>
    </div>
  </div>
  </body>
  </html>`);
}

async function sendPasswordResetEmail(to, { userName, code }) {
  await send(to, 'FuelGO — Password Reset Code', `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#0f2548,#1a3c6e);padding:32px 36px;text-align:center">
      <div style="font-size:42px;margin-bottom:8px">&#128272;</div>
      <h1 style="color:#fff;margin:0;font-size:1.6rem">FuelGO</h1>
      <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:0.9rem">Password Reset</p>
    </div>
    <div style="padding:32px 36px;text-align:center">
      <h2 style="color:#0f2548;margin:0 0 12px">Hi ${userName || 'there'},</h2>
      <p style="color:#64748b;line-height:1.7;margin-bottom:28px">Use the code below to reset your FuelGO password. This code expires in <strong>15 minutes</strong>.</p>
      <div style="background:#f1f5f9;border-radius:12px;padding:24px;margin-bottom:24px;letter-spacing:8px;font-size:2rem;font-weight:800;color:#0f2548;font-family:monospace">${code}</div>
      <p style="color:#94a3b8;font-size:0.82rem">If you didn't request this, you can safely ignore this email.</p>
    </div>
    <div style="background:#f8fafc;padding:20px 36px;text-align:center;border-top:1px solid #e2e8f0">
      <p style="color:#94a3b8;font-size:0.78rem;margin:0">FuelGO &mdash; Fuel Smarter. Pay Faster. Drive Further.</p>
    </div>
  </div>
  </body>
  </html>`);
}

module.exports = { sendReceiptEmail, sendWelcomeEmail, sendPasswordResetEmail };
