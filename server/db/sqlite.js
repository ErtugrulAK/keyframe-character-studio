import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'keyframe_studio.sqlite');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Failed to open SQLite database:', err.message);
  } else {
    console.log(`✅ SQLite Database ready at: ${dbPath}`);
  }
});

export function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

export function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

export async function initSqliteDb() {
  await runQuery(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      fps INTEGER DEFAULT 60,
      total_frames INTEGER DEFAULT 150,
      resolution_w INTEGER DEFAULT 1920,
      resolution_h INTEGER DEFAULT 1080,
      data TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS motion_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      duration_frames INTEGER DEFAULT 50,
      keyframes TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      media_type TEXT NOT NULL,
      url TEXT NOT NULL,
      size_bytes INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed sample data
  const sampleProjectData = JSON.stringify({
    name: "Unreal 2D Character Sequence",
    fps: 60,
    totalFrames: 150,
    projectResolution: { width: 1920, height: 1080 },
    tracks: [
      {
        id: "track_part_custom_rect_1784804656612",
        partId: "part_custom_rect_1784804656612",
        name: "Pink Entrance Shape (Proxy)",
        color: "#ec4899",
        visible: true,
        locked: false,
        expanded: false,
        keyframes: [
          { id: "kf_1", frame: 0, transform: { x: 0, y: -700, rotation: 0, scaleX: 6.42, scaleY: 6.42, opacity: 1 }, easing: "easeInOut" },
          { id: "kf_2", frame: 50, transform: { x: 0, y: 0, rotation: 0, scaleX: 6.42, scaleY: 6.42, opacity: 1 }, easing: "easeInOut" }
        ],
        channels: { x: [], y: [], rotation: [], scaleX: [], scaleY: [], opacity: [] }
      }
    ],
    characterParts: [
      {
        id: "part_custom_rect_1784804656612",
        name: "Pink Entrance Shape (Proxy)",
        type: "custom_rect",
        zIndex: 2,
        fillColor: "#ec4899",
        strokeColor: "#101218",
        pivot: { x: 0.5, y: 0.5 },
        parentId: "torso",
        baseTransform: { x: 0, y: -700, rotation: 0, scaleX: 6.42, scaleY: 6.42, opacity: 1 },
        visibleEndFrame: 50
      }
    ]
  });

  await runQuery(`
    INSERT OR IGNORE INTO projects (id, name, fps, total_frames, resolution_w, resolution_h, data)
    VALUES ('sample_sequencer_project', 'Unreal 2D Character Sequence', 60, 150, 1920, 1080, ?)
  `, [sampleProjectData]);

  const presetPink = JSON.stringify([
    { progress: 0, deltaX: 0, deltaY: -700, rotation: 0, scaleX: 6.42, scaleY: 6.42, opacity: 1, easing: 'easeInOut' },
    { progress: 1, deltaX: 0, deltaY: 0, rotation: 0, scaleX: 6.42, scaleY: 6.42, opacity: 1, easing: 'easeInOut' }
  ]);

  await runQuery(`
    INSERT OR IGNORE INTO motion_presets (id, name, type, duration_frames, keyframes)
    VALUES ('preset_pink_slide_down', 'Pink Slide Down (Top -> Center)', 'in', 50, ?)
  `, [presetPink]);

  console.log('✅ SQLite Database schema & seed data initialized successfully!');
}
