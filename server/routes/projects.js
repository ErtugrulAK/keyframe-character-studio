import { Router } from 'express';
import { pool, checkDbHealth } from '../db/index.js';
import { runQuery, getQuery, allQuery } from '../db/sqlite.js';

const router = Router();

// ── List Projects ──
router.get('/', async (req, res) => {
  const health = await checkDbHealth();
  if (health.connected) {
    try {
      const result = await pool.query('SELECT id, name, fps, total_frames, resolution_w, resolution_h, created_at, updated_at FROM projects ORDER BY updated_at DESC');
      return res.json({ success: true, source: 'postgresql', projects: result.rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // SQLite Embedded DB
  try {
    const rows = await allQuery('SELECT id, name, fps, total_frames, resolution_w, resolution_h, created_at, updated_at FROM projects ORDER BY updated_at DESC');
    res.json({ success: true, source: 'sqlite', projects: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Get Single Project ──
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const health = await checkDbHealth();

  if (health.connected) {
    try {
      const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Project not found' });
      return res.json({ success: true, source: 'postgresql', project: JSON.parse(result.rows[0].data) });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // SQLite
  try {
    const row = await getQuery('SELECT * FROM projects WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ success: false, error: 'Project not found' });
    res.json({ success: true, source: 'sqlite', project: JSON.parse(row.data) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Create / Upsert Project ──
router.post('/', async (req, res) => {
  const project = req.body;
  const id = project.id || `proj_${Date.now()}`;
  const name = project.name || 'Untitled Project';
  const fps = project.fps || 60;
  const totalFrames = project.totalFrames || 150;
  const resW = project.projectResolution?.width || 1920;
  const resH = project.projectResolution?.height || 1080;
  const dataStr = JSON.stringify(project);

  const health = await checkDbHealth();

  if (health.connected) {
    try {
      const query = `
        INSERT INTO projects (id, name, fps, total_frames, resolution_w, resolution_h, data, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          fps = EXCLUDED.fps,
          total_frames = EXCLUDED.total_frames,
          resolution_w = EXCLUDED.resolution_w,
          resolution_h = EXCLUDED.resolution_h,
          data = EXCLUDED.data,
          updated_at = NOW()
        RETURNING *;
      `;
      const result = await pool.query(query, [id, name, fps, totalFrames, resW, resH, dataStr]);
      return res.json({ success: true, source: 'postgresql', project: result.rows[0] });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // SQLite
  try {
    await runQuery(`
      INSERT INTO projects (id, name, fps, total_frames, resolution_w, resolution_h, data, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        fps = excluded.fps,
        total_frames = excluded.total_frames,
        resolution_w = excluded.resolution_w,
        resolution_h = excluded.resolution_h,
        data = excluded.data,
        updated_at = CURRENT_TIMESTAMP;
    `, [id, name, fps, totalFrames, resW, resH, dataStr]);

    res.json({ success: true, source: 'sqlite', id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Delete Project ──
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const health = await checkDbHealth();

  if (health.connected) {
    try {
      await pool.query('DELETE FROM projects WHERE id = $1', [id]);
      return res.json({ success: true, source: 'postgresql' });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // SQLite
  try {
    await runQuery('DELETE FROM projects WHERE id = ?', [id]);
    res.json({ success: true, source: 'sqlite' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
