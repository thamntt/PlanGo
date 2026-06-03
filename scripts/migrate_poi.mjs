import pg from 'pg';
import { readFileSync } from 'fs';

// Load .env manually
const envContent = readFileSync('.env', 'utf8');
const envLines = envContent.split('\n');
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx > 0) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = val;
  }
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();
  console.log('Connected to database');
  
  const res = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'reviews' AND column_name IN ('poi_id', 'poi_name')
  `);
  
  const existingCols = res.rows.map(r => r.column_name);
  
  if (!existingCols.includes('poi_id')) {
    console.log('Adding poi_id column...');
    await client.query(`ALTER TABLE reviews ADD COLUMN poi_id TEXT DEFAULT ''`);
    console.log('poi_id added');
  } else {
    console.log('poi_id already exists');
  }
  
  if (!existingCols.includes('poi_name')) {
    console.log('Adding poi_name column...');
    await client.query(`ALTER TABLE reviews ADD COLUMN poi_name TEXT DEFAULT ''`);
    console.log('poi_name added');
  } else {
    console.log('poi_name already exists');
  }
  
  console.log('Migration complete!');
  await client.end();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
