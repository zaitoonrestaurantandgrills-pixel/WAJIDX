require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
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

// Test connection helper
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('[DB] Successfully connected to database:', process.env.DB_NAME || 'devaj');
    conn.release();
    return true;
  } catch (error) {
    console.error('[DB ERROR] Failed to connect to MySQL database:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  query: (sql, params) => pool.query(sql, params),
  execute: (sql, params) => pool.execute(sql, params),
  testConnection
};
