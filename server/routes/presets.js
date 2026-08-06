import { Router } from 'express';
import { pool, checkDbHealth } from '../db/index.js';
import { runQuery, allQuery } from '../db/sqlite.js';

const router = Router();

// ── List Motion Presets ──
router.get('/', async (req, res) => {
  const health = await checkDbHealth();

  if (health.connected) {
    try {
      const result = await pool.query('SELECT * FROM motion_presets ORDER BY created_at DESC');
      return res.json({ success: true, source: 'postgresql', presets: result.rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // SQLite
  try {
    const rows = await allQuery('SELECT * FROM motion_presets ORDER BY created_at DESC');
    const parsed = rows.map(r => ({
      ...r,
      keyframes: typeof r.keyframes === 'string' ? JSON.parse(r.keyframes) : r.keyframes
    }));
    res.json({ success: true, source: 'sqlite', presets: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Create / Upsert Preset ──
router.post('/', async (req, res) => {
  const preset = req.body;
  const id = preset.id || `preset_custom_${Date.now()}`;
  const name = preset.name || 'Custom Preset';
  const type = preset.type || 'stunt';
  const durationFrames = preset.durationFrames || 50;
  const keyframesStr = JSON.stringify(preset.keyframes || []);

  const health = await checkDbHealth();

  if (health.connected) {
    try {
      const query = `
        INSERT INTO motion_presets (id, name, type, duration_frames, keyframes)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          duration_frames = EXCLUDED.duration_frames,
          keyframes = EXCLUDED.keyframes
        RETURNING *;
      `;
      const result = await pool.query(query, [id, name, type, durationFrames, keyframesStr]);
      return res.json({ success: true, source: 'postgresql', preset: result.rows[0] });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // SQLite
  try {
    await runQuery(`
      INSERT INTO motion_presets (id, name, type, duration_frames, keyframes)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        duration_frames = excluded.duration_frames,
        keyframes = excluded.keyframes;
    `, [id, name, type, durationFrames, keyframesStr]);

    res.json({ success: true, source: 'sqlite', preset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
