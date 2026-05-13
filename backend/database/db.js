const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  family: 4
});

// Auto-convert SQLite ? placeholders to PostgreSQL $1, $2...
function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Auto-append RETURNING id to INSERT statements
function addReturning(sql) {
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith('INSERT') && !trimmed.includes('RETURNING')) {
    return sql.trim() + ' RETURNING id';
  }
  return sql;
}

const db = {
  prepare(sql) {
    const pgSql = addReturning(convertPlaceholders(sql));
    return {
      async get(...params) {
        const { rows } = await pool.query(pgSql, params.flat());
        return rows[0] || null;
      },
      async all(...params) {
        const { rows } = await pool.query(pgSql, params.flat());
        return rows;
      },
      async run(...params) {
        const result = await pool.query(pgSql, params.flat());
        return {
          lastInsertRowid: result.rows[0]?.id || null,
          changes: result.rowCount
        };
      }
    };
  },
  async exec(sql) {
    await pool.query(sql);
  }
};

module.exports = db;