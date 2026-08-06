import { Router } from 'express';
import { checkDbHealth } from '../db/index.js';

const router = Router();

// ── Health Check Endpoint ──
router.get('/', async (req, res) => {
  const health = await checkDbHealth();
  res.json({
    status: 'online',
    service: 'Keyframe Studio API',
    database: health.connected ? 'PostgreSQL' : 'SQLite (Embedded Local DB)',
    pgDetails: health,
  });
});

export default router;
