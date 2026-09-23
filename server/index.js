import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initSqliteDb } from './db/sqlite.js';
import { bindMessage, resolveBindHost } from './bindHost.js';
import healthRouter from './routes/health.js';
import projectsRouter from './routes/projects.js';
import presetsRouter from './routes/presets.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const bind = resolveBindHost();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize SQLite Database
initSqliteDb().catch(console.error);

// ── REST API Routes ──
app.use('/api/health', healthRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/presets', presetsRouter);

app.listen(PORT, bind.host, () => {
  const message = bindMessage(bind, PORT);
  if (bind.loopback) console.log(message);
  else console.warn(message);
});
