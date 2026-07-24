import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/keyframe_studio_db';

export const pool = new pg.Pool({
  connectionString,
  connectionTimeoutMillis: 3000,
});

let isDbConnected = false;

// Check PostgreSQL Connection Health
export async function checkDbHealth() {
  try {
    const res = await pool.query('SELECT NOW()');
    isDbConnected = true;
    return { connected: true, timestamp: res.rows[0].now };
  } catch (err) {
    isDbConnected = false;
    return { connected: false, error: err.message };
  }
}

export function isConnected() {
  return isDbConnected;
}

// Initial Connection Test
checkDbHealth().then(status => {
  if (status.connected) {
    console.log('✅ PostgreSQL Database connected successfully!');
  } else {
    console.log('⚠️ PostgreSQL database is offline or not configured yet.');
    console.log('ℹ️ Running backend server in Auto-Fallback / In-Memory Mode.');
  }
});
