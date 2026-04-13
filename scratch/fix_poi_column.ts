import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkColumn() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'pois' AND column_name = 'description';
    `);
    
    if (res.rows.length > 0) {
      console.log('SUCCESS: Column "description" exists in "pois" table.');
    } else {
      console.log('FAILURE: Column "description" does NOT exist in "pois" table.');
      
      console.log('Attempting to add column...');
      await pool.query('ALTER TABLE pois ADD COLUMN description TEXT;');
      console.log('Column "description" added successfully.');
    }
  } catch (err) {
    console.error('ERROR checking/adding column:', err);
  } finally {
    await pool.end();
  }
}

checkColumn();
