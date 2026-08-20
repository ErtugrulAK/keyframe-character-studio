import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbName = 'keyframe_studio_db';
const baseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432';

async function setupDatabase() {
  console.log('🔄 Setting up PostgreSQL Database for Keyframe Character Studio...');

  // 1. Connect to default postgres DB to create target database if needed
  const adminClient = new pg.Client({ connectionString: `${baseUrl}/postgres` });
  
  try {
    await adminClient.connect();
    const res = await adminClient.query(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`);
    if (res.rows.length === 0) {
      console.log(`🔨 Creating database "${dbName}"...`);
      await adminClient.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database "${dbName}" created!`);
    } else {
      console.log(`ℹ️ Database "${dbName}" already exists.`);
    }
  } catch (err) {
    console.error('❌ Failed to connect to admin PostgreSQL instance:', err.message);
    console.log('💡 Tip: Make sure PostgreSQL service is running on localhost:5432.');
    process.exit(1);
  } finally {
    await adminClient.end();
  }

  // 2. Connect to keyframe_studio_db and run schema & seed SQL
  const targetClient = new pg.Client({ connectionString: `${baseUrl}/${dbName}` });
  try {
    await targetClient.connect();

    const schemaSql = fs.readFileSync(path.join(__dirname, '../server/db/schema.sql'), 'utf8');
    console.log('📜 Executing schema.sql...');
    await targetClient.query(schemaSql);
    console.log('✅ Schema tables created successfully!');

    const seedSql = fs.readFileSync(path.join(__dirname, '../server/db/seed.sql'), 'utf8');
    console.log('🌱 Executing seed.sql...');
    await targetClient.query(seedSql);
    console.log('✅ Initial seed data inserted!');

    console.log('🎉 PostgreSQL Database setup completed successfully!');
  } catch (err) {
    console.error('❌ Failed to execute DDL/Seed SQL:', err.message);
  } finally {
    await targetClient.end();
  }
}

setupDatabase();
