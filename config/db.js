require('dotenv').config();
const { Pool: PgPool } = require('pg');
const mysql = require('mysql2/promise');

const postgresUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;

let isPostgres = Boolean(postgresUrl);
let pgPool = null;
let mysqlPool = null;

if (isPostgres) {
  pgPool = new PgPool({
    connectionString: postgresUrl,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });
  console.log('[DB] Configured for Supabase PostgreSQL');
} else {
  mysqlPool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'devaj',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
  });
  console.log('[DB] Configured for MySQL (devaj)');
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
  const flatParams = [];

  // Flatten nested array params (e.g. IN (?))
  const newParams = [];
  if (Array.isArray(params)) {
    for (const p of params) {
      if (Array.isArray(p)) {
        // e.g. WHERE id IN (?) -> WHERE id = ANY($1)
        newParams.push(p);
      } else {
        newParams.push(p);
      }
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
        return [result.rows, result.fields];
      }

      // INSERT / UPDATE / DELETE result wrapper
      const firstRow = result.rows && result.rows[0];
      const insertId = firstRow ? (firstRow.id || 0) : 0;
      return [
        {
          insertId,
          affectedRows: result.rowCount,
          rowCount: result.rowCount,
          rows: result.rows
        }
      ];
    } finally {
      client.release();
    }
  } else {
    return mysqlPool.query(sql, params);
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
  } catch (error) {
    console.error('[DB ERROR] Failed to connect to database:', error.message);
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
