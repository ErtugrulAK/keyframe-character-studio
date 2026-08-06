import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initSqliteDb } from './db/sqlite.js';
import healthRouter from './routes/health.js';
import projectsRouter from './routes/projects.js';
import presetsRouter from './routes/presets.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize SQLite Database
initSqliteDb().catch(console.error);

// ── REST API Routes ──
app.use('/api/health', healthRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/presets', presetsRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Keyframe Studio REST API server running on http://0.0.0.0:${PORT}`);
});
