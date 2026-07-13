const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const env = require('./src/config/env');
const connectDB = require('./src/config/db');
const errorHandler = require('./src/middleware/errorHandler');

// ── Route imports ────────────────────────────────────────────────────
const authRoutes = require('./src/routes/authRoutes');
const businessRoutes = require('./src/routes/businessRoutes');
const clientRoutes = require('./src/routes/clientRoutes');
const documentRoutes = require('./src/routes/documentRoutes');
const paymentReceiptRoutes = require('./src/routes/paymentReceiptRoutes');

// ── Init ─────────────────────────────────────────────────────────────
const app = express();

// ── Global middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// ── Health check ─────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'TechBes Billing API is running' });
});

// ── API routes ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes); // Fallback for Nginx path stripping
app.use('/api/business', businessRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/payment-receipts', paymentReceiptRoutes);

// ── 404 fallback ─────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

const { runProvisioning } = require('./scripts/createAdmin');

// ── Start server ─────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  
  // Auto-provision admin user on startup
  try {
    await runProvisioning();
    console.log('Admin user auto-provisioning completed successfully.');
  } catch (err) {
    console.error('Failed to auto-provision admin user:', err);
  }

  app.listen(env.port, () => {
    console.log(`Server running in ${env.nodeEnv} mode on port ${env.port}`);
  });
};

start();

module.exports = app; // for testing
