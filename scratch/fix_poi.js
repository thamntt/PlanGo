const { Client } = require('pg');
require('dotenv').config();

async function fix() {
  console.log('Starting fix script...');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database.');
    
    const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'pois' AND column_name = 'description';
    `);

    if (res.rows.length === 0) {
      console.log('Column "description" not found. Adding it...');
      await client.query('ALTER TABLE pois ADD COLUMN description TEXT;');
      console.log('Column "description" added successfully.');
    } else {
      console.log('Column "description" already exists.');
    }
  } catch (err) {
    console.error('Error during database update:', err);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

fix().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
