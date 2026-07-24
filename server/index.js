import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool, checkDbHealth } from './db/index.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// In-Memory Fallback Storage (when PostgreSQL is not connected)
const inMemoryProjects = new Map();
const inMemoryPresets = new Map();

// ── 1. Health Check Endpoint ──
app.get('/api/health', async (req, res) => {
  const health = await checkDbHealth();
  res.json({
    status: 'online',
    service: 'Keyframe Studio API',
    database: health.connected ? 'PostgreSQL' : 'In-Memory Fallback',
    dbDetails: health,
  });
});

// ── 2. Projects Endpoints ──
app.get('/api/projects', async (req, res) => {
  const health = await checkDbHealth();
  if (health.connected) {
    try {
      const result = await pool.query('SELECT id, name, fps, total_frames, resolution_w, resolution_h, created_at, updated_at FROM projects ORDER BY updated_at DESC');
      return res.json({ success: true, source: 'postgresql', projects: result.rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Fallback to In-Memory
  const list = Array.from(inMemoryProjects.values());
  res.json({ success: true, source: 'in_memory', projects: list });
});

app.get('/api/projects/:id', async (req, res) => {
  const { id } = req.params;
  const health = await checkDbHealth();

  if (health.connected) {
    try {
      const result = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ success: false, error: 'Project not found' });
      return res.json({ success: true, source: 'postgresql', project: result.rows[0].data });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  if (inMemoryProjects.has(id)) {
    return res.json({ success: true, source: 'in_memory', project: inMemoryProjects.get(id) });
  }

  res.status(404).json({ success: false, error: 'Project not found' });
});

app.post('/api/projects', async (req, res) => {
  const project = req.body;
  const id = project.id || `proj_${Date.now()}`;
  const name = project.name || 'Untitled Project';
  const fps = project.fps || 60;
  const totalFrames = project.totalFrames || 150;
  const resW = project.projectResolution?.width || 1920;
  const resH = project.projectResolution?.height || 1080;

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
      const result = await pool.query(query, [id, name, fps, totalFrames, resW, resH, JSON.stringify(project)]);
      return res.json({ success: true, source: 'postgresql', project: result.rows[0] });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Fallback
  inMemoryProjects.set(id, { ...project, id, updatedAt: new Date().toISOString() });
  res.json({ success: true, source: 'in_memory', id });
});

app.delete('/api/projects/:id', async (req, res) => {
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

  inMemoryProjects.delete(id);
  res.json({ success: true, source: 'in_memory' });
});

// ── 3. Motion Presets Endpoints ──
app.get('/api/presets', async (req, res) => {
  const health = await checkDbHealth();

  if (health.connected) {
    try {
      const result = await pool.query('SELECT * FROM motion_presets ORDER BY created_at DESC');
      return res.json({ success: true, source: 'postgresql', presets: result.rows });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  res.json({ success: true, source: 'in_memory', presets: Array.from(inMemoryPresets.values()) });
});

app.post('/api/presets', async (req, res) => {
  const preset = req.body;
  const id = preset.id || `preset_custom_${Date.now()}`;
  const name = preset.name || 'Custom Preset';
  const type = preset.type || 'stunt';
  const durationFrames = preset.durationFrames || 50;

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
      const result = await pool.query(query, [id, name, type, durationFrames, JSON.stringify(preset.keyframes || [])]);
      return res.json({ success: true, source: 'postgresql', preset: result.rows[0] });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  inMemoryPresets.set(id, preset);
  res.json({ success: true, source: 'in_memory', preset });
});

app.listen(PORT, () => {
  console.log(`🚀 Keyframe Studio REST API server running on http://localhost:${PORT}`);
});
