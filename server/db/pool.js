const pg = require('pg');

// Return DATE columns as plain "YYYY-MM-DD" strings instead of JS Date objects
pg.types.setTypeParser(1082, val => val);

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

module.exports = pool;
