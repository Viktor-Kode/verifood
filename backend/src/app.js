const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const NAFDAC_HOTLINE = '0800-162-3322';

function createApp(pool) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  const origins = (process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  app.use(cors({ origin: origins.length ? origins : true }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', database: 'connected' });
    } catch (_error) {
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });

  app.get('/api/products', async (_req, res, next) => {
    try {
      const [products] = await pool.query(
        'SELECT id, name, brand, category, image FROM products ORDER BY name'
      );
      res.json(products);
    } catch (error) { next(error); }
  });

  app.get('/api/products/:id', async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid product id' });
    try {
      const [[product]] = await pool.query(
        'SELECT id, name, brand, category, image FROM products WHERE id = ?', [id]
      );
      if (!product) return res.status(404).json({ error: 'Product not found' });
      const [checks] = await pool.query(
        'SELECT id, question, guidance, source_url AS sourceUrl FROM checks WHERE product_id = ? ORDER BY sort_order, id', [id]
      );
      res.json({ ...product, checks });
    } catch (error) { next(error); }
  });

  app.get('/api/reports', async (req, res, next) => {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 500);
    try {
      const [rows] = await pool.query(
        `SELECT r.id, r.product_id AS productId, p.name AS productName, p.brand,
          r.market_area AS marketArea, r.red_flags AS redFlags, r.status,
          r.is_demo AS isDemo, r.created_at AS createdAt
         FROM reports r JOIN products p ON p.id = r.product_id
         ORDER BY r.created_at DESC LIMIT ?`, [limit]
      );
      res.json(rows.map((row) => ({ ...row, redFlags: typeof row.redFlags === 'string' ? JSON.parse(row.redFlags) : row.redFlags, isDemo: Boolean(row.isDemo), nafdacHotline: NAFDAC_HOTLINE })));
    } catch (error) { next(error); }
  });

  app.post('/api/reports', async (req, res, next) => {
    const { productId, marketArea, redFlags, deviceId } = req.body || {};
    const id = Number(productId);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'A valid productId is required' });
    if (typeof marketArea !== 'string' || !marketArea.trim() || marketArea.trim().length > 120) {
      return res.status(400).json({ error: 'marketArea must be between 1 and 120 characters' });
    }
    if (!Array.isArray(redFlags) || redFlags.length > 20 || redFlags.some((flag) => typeof flag !== 'string' || flag.length > 300)) {
      return res.status(400).json({ error: 'redFlags must be an array of up to 20 strings (300 characters each)' });
    }
    if (typeof deviceId !== 'string' || !deviceId.trim() || deviceId.trim().length > 128) {
      return res.status(400).json({ error: 'A valid deviceId is required' });
    }
    const device = deviceId.trim();
    try {
      const [[product]] = await pool.query('SELECT id FROM products WHERE id = ?', [id]);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      const [[{ count }]] = await pool.query(
        'SELECT COUNT(*) AS count FROM reports WHERE device_id = ? AND created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 HOUR)', [device]
      );
      if (Number(count) >= 5) return res.status(429).json({ error: 'Report limit reached. Try again later.' });
      const [result] = await pool.query(
        `INSERT INTO reports (product_id, market_area, red_flags, status, is_demo, device_id)
         VALUES (?, ?, ?, 'unverified', FALSE, ?)`, [id, marketArea.trim(), JSON.stringify(redFlags), device]
      );
      res.status(201).json({ id: result.insertId, status: 'unverified', isDemo: false, nafdacHotline: NAFDAC_HOTLINE });
    } catch (error) { next(error); }
  });

  app.get('/api/batch-verifications/:batchCode', async (req, res, next) => {
    const batchCode = req.params.batchCode.trim();
    if (!batchCode || batchCode.length > 100) return res.status(400).json({ error: 'Invalid batch code', nafdacHotline: NAFDAC_HOTLINE });
    try {
      const [rows] = await pool.query(
        `SELECT b.id, b.batch_code AS batchCode, b.expiry_date AS expiryDate,
          b.verification_status AS verificationStatus, b.nafdac_registration AS nafdacRegistration,
          b.guidance, b.source_url AS sourceUrl, p.id AS productId, p.name AS productName, p.brand
         FROM batch_verifications b JOIN products p ON p.id = b.product_id
         WHERE b.batch_code = ? ORDER BY b.created_at DESC LIMIT 1`, [batchCode]
      );
      if (!rows.length) return res.status(404).json({ error: 'No batch record found. Contact NAFDAC to verify this batch.', nafdacHotline: NAFDAC_HOTLINE });
      res.json({ ...rows[0], nafdacHotline: NAFDAC_HOTLINE });
    } catch (error) { next(error); }
  });

  app.post('/api/producer-submissions', async (req, res, next) => {
    const { productName, producerName, nafdacRegistration, batchCode, contactEmail } = req.body || {};
    if (typeof productName !== 'string' || !productName.trim() || productName.trim().length > 160) {
      return res.status(400).json({ error: 'productName must be between 1 and 160 characters', nafdacHotline: NAFDAC_HOTLINE });
    }
    if (typeof producerName !== 'string' || !producerName.trim() || producerName.trim().length > 160) {
      return res.status(400).json({ error: 'producerName must be between 1 and 160 characters', nafdacHotline: NAFDAC_HOTLINE });
    }
    if (nafdacRegistration != null && (typeof nafdacRegistration !== 'string' || nafdacRegistration.length > 100)) {
      return res.status(400).json({ error: 'Invalid nafdacRegistration', nafdacHotline: NAFDAC_HOTLINE });
    }
    if (batchCode != null && (typeof batchCode !== 'string' || batchCode.length > 100)) {
      return res.status(400).json({ error: 'Invalid batchCode', nafdacHotline: NAFDAC_HOTLINE });
    }
    if (contactEmail != null && (typeof contactEmail !== 'string' || contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) {
      return res.status(400).json({ error: 'Invalid contactEmail', nafdacHotline: NAFDAC_HOTLINE });
    }
    try {
      const [result] = await pool.query(
        `INSERT INTO producer_submissions (product_name, producer_name, nafdac_registration, batch_code, contact_email)
         VALUES (?, ?, ?, ?, ?)`,
        [productName.trim(), producerName.trim(), nafdacRegistration || null, batchCode || null, contactEmail || null]
      );
      res.status(201).json({ id: result.insertId, submissionStatus: 'received', nafdacHotline: NAFDAC_HOTLINE });
    } catch (error) { next(error); }
  });

  app.get('/api/recalls', async (_req, res, next) => {
    try {
      const [rows] = await pool.query(
        `SELECT r.id, r.product_id AS productId, p.name AS productName, p.brand,
          r.batch_code AS batchCode, r.event_type AS eventType, r.audit_status AS auditStatus,
          r.summary, r.source_url AS sourceUrl, r.is_demo AS isDemo, r.created_at AS createdAt
         FROM recall_audit_logs r JOIN products p ON p.id = r.product_id
         ORDER BY r.created_at DESC LIMIT 200`
      );
      res.json({ nafdacHotline: NAFDAC_HOTLINE, records: rows.map((row) => ({ ...row, isDemo: Boolean(row.isDemo), nafdacHotline: NAFDAC_HOTLINE })) });
    } catch (error) { next(error); }
  });

  app.post('/api/recalls', async (req, res, next) => {
    const { productId, batchCode, eventType, summary, sourceUrl } = req.body || {};
    const id = Number(productId);
    const eventTypes = ['contamination_notice', 'recall_notice', 'safety_advisory'];
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'A valid productId is required', nafdacHotline: NAFDAC_HOTLINE });
    if (!eventTypes.includes(eventType)) return res.status(400).json({ error: 'Invalid eventType', nafdacHotline: NAFDAC_HOTLINE });
    if (typeof summary !== 'string' || !summary.trim() || summary.trim().length > 500) {
      return res.status(400).json({ error: 'summary must be between 1 and 500 characters', nafdacHotline: NAFDAC_HOTLINE });
    }
    if (batchCode != null && (typeof batchCode !== 'string' || batchCode.length > 100)) {
      return res.status(400).json({ error: 'Invalid batchCode', nafdacHotline: NAFDAC_HOTLINE });
    }
    if (sourceUrl != null && (typeof sourceUrl !== 'string' || sourceUrl.length > 2048 || !/^https:\/\//i.test(sourceUrl))) {
      return res.status(400).json({ error: 'sourceUrl must be a valid HTTPS URL', nafdacHotline: NAFDAC_HOTLINE });
    }
    try {
      const [[product]] = await pool.query('SELECT id FROM products WHERE id = ?', [id]);
      if (!product) return res.status(404).json({ error: 'Product not found', nafdacHotline: NAFDAC_HOTLINE });
      const [result] = await pool.query(
        `INSERT INTO recall_audit_logs (product_id, batch_code, event_type, audit_status, summary, source_url, nafdac_hotline)
         VALUES (?, ?, ?, 'reported', ?, ?, ?)`,
        [id, batchCode || null, eventType, summary.trim(), sourceUrl || null, NAFDAC_HOTLINE]
      );
      res.status(201).json({ id: result.insertId, auditStatus: 'reported', nafdacHotline: NAFDAC_HOTLINE });
    } catch (error) { next(error); }
  });

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((error, _req, res, _next) => {
    const relevant = /^\/api\/(reports|recalls|producer-submissions|batch-verifications)(\/|$)/.test(_req.path);
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return res.status(400).json({ error: 'Invalid JSON body', ...(relevant ? { nafdacHotline: NAFDAC_HOTLINE } : {}) });
    }
    console.error('API request failed:', error.message);
    res.status(500).json({ error: 'Internal server error', ...(relevant ? { nafdacHotline: NAFDAC_HOTLINE } : {}) });
  });
  return app;
}

module.exports = { createApp };
