require('dotenv').config();
const { Pool: PgPool } = require('pg');
const mysql = require('mysql2/promise');

const postgresUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;
const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

let isPostgres = Boolean(postgresUrl);
let pgPool = null;
let mysqlPool = null;

if (isPostgres) {
  try {
    pgPool = new PgPool({
      connectionString: postgresUrl,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
    pgPool.on('error', (err) => {
      console.warn('[DB PG POOL WARNING]', err.message);
    });
    console.log('[DB] Configured for Supabase PostgreSQL');
  } catch (err) {
    console.error('[DB PG INIT ERROR]', err.message);
  }
} else if (!isVercel) {
  // Only initialize local MySQL pool if NOT running on Vercel serverless without DB
  try {
    mysqlPool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'devaj',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      charset: 'utf8mb4'
    });
    console.log('[DB] Configured for local MySQL (devaj)');
  } catch (err) {
    console.error('[DB MYSQL INIT ERROR]', err.message);
  }
}

/**
 * Converts MySQL-style SQL to PostgreSQL-compatible SQL
 */
function convertToPostgresSql(sql, params) {
  let pgSql = sql;

  // Replace backticks with plain identifiers
  pgSql = pgSql.replace(/`([^`]+)`/g, '$1');

  // Replace MySQL specific functions / keywords
  pgSql = pgSql.replace(/\bINSERT\s+IGNORE\s+INTO\b/gi, 'INSERT INTO');
  if (sql.match(/\bINSERT\s+IGNORE\s+INTO\b/i)) {
    pgSql = `${pgSql} ON CONFLICT DO NOTHING`;
  }

  // Handle ON DUPLICATE KEY UPDATE for site settings
  if (pgSql.match(/wajidx_site_settings/i) && pgSql.match(/ON DUPLICATE KEY UPDATE/i)) {
    pgSql = pgSql.replace(
      /ON DUPLICATE KEY UPDATE\s+setting_value\s*=\s*(?:VALUES\(setting_value\)|EXCLUDED\.setting_value)/i,
      'ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = NOW()'
    );
  }

  // Handle parameter placeholders: ? -> $1, $2, ...
  let paramIndex = 1;
  const newParams = [];
  if (Array.isArray(params)) {
    for (const p of params) {
      newParams.push(p);
    }
  }

  pgSql = pgSql.replace(/\?/g, () => {
    return `$${paramIndex++}`;
  });

  // Handle IN ($1) where $1 is an array in Postgres -> = ANY($1)
  pgSql = pgSql.replace(/IN\s*\(\s*(\$\d+)\s*\)/gi, '= ANY($1)');

  // If INSERT query and doesn't have RETURNING id, append RETURNING id
  if (pgSql.trim().toUpperCase().startsWith('INSERT INTO') && !pgSql.toUpperCase().includes('RETURNING')) {
    pgSql = `${pgSql.trim()} RETURNING id`;
  }

  return { pgSql, pgParams: newParams };
}

/**
 * Execute query compatible with both PostgreSQL and MySQL
 */
async function query(sql, params = []) {
  if (isPostgres && pgPool) {
    const client = await pgPool.connect();
    try {
      const { pgSql, pgParams } = convertToPostgresSql(sql, params);
      const result = await client.query(pgSql, pgParams);

      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return [result.rows || [], result.fields];
      }

      // INSERT / UPDATE / DELETE result wrapper
      const firstRow = result.rows && result.rows[0];
      const insertId = firstRow ? (firstRow.id || 0) : 0;
      return [
        {
          insertId,
          affectedRows: result.rowCount,
          rowCount: result.rowCount,
          rows: result.rows || []
        }
      ];
    } finally {
      client.release();
    }
  } else if (mysqlPool) {
    return mysqlPool.query(sql, params);
  } else {
    throw new Error('Database is not connected. Please set SUPABASE_DB_URL in environment variables.');
  }
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    if (isPostgres && pgPool) {
      const client = await pgPool.connect();
      const res = await client.query('SELECT current_database() AS db_name, version()');
      console.log('[DB] Successfully connected to Supabase PostgreSQL database:', res.rows[0].db_name);
      client.release();
      return true;
    } else if (mysqlPool) {
      const conn = await mysqlPool.getConnection();
      console.log('[DB] Successfully connected to MySQL database:', process.env.DB_NAME || 'devaj');
      conn.release();
      return true;
    }
    return false;
  } catch (error) {
    console.warn('[DB WARNING] Database test connection failed:', error.message);
    return false;
  }
}

module.exports = {
  pool: isPostgres ? pgPool : mysqlPool,
  query,
  execute: query,
  testConnection,
  isPostgres: () => isPostgres
};
