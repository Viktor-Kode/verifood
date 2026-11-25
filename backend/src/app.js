const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

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
      res.json(rows.map((row) => ({ ...row, redFlags: typeof row.redFlags === 'string' ? JSON.parse(row.redFlags) : row.redFlags, isDemo: Boolean(row.isDemo) })));
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
      res.status(201).json({ id: result.insertId, status: 'unverified', isDemo: false });
    } catch (error) { next(error); }
  });

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use((error, _req, res, _next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    console.error('API request failed:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

module.exports = { createApp };
