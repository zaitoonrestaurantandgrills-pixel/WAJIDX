/**
 * WAJIDX Database Migration & Schema Versioning Runner
 * Supports devaj database (MySQL, Supabase PostgreSQL, and In-Memory fallback)
 * 
 * Commands:
 *   node database/migrate.js status
 *   node database/migrate.js up
 *   node database/migrate.js down
 */

const fs = require('fs');
const path = require('path');
const { query, isPostgres } = require('../config/db');

const basePath = typeof __dirname !== 'undefined' ? __dirname : (typeof process !== 'undefined' && process.cwd ? process.cwd() : '/');
const MIGRATIONS_DIR = path.join(basePath, 'migrations');

/**
 * Ensure the wajidx_schema_migrations table exists
 */
async function ensureMigrationsTable() {
  const pg = isPostgres();
  if (pg) {
    await query(`
      CREATE TABLE IF NOT EXISTS wajidx_schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } else {
    await query(`
      CREATE TABLE IF NOT EXISTS \`wajidx_schema_migrations\` (
        \`version\` VARCHAR(100) PRIMARY KEY,
        \`name\` VARCHAR(255) NOT NULL,
        \`applied_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }
}

/**
 * Load all migration files from database/migrations
 */
function loadMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    return [];
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();

  return files.map(file => {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const mod = require(filePath);
    return {
      file,
      version: mod.version || file.replace(/\.js$/, ''),
      name: mod.name || file,
      up: mod.up,
      down: mod.down
    };
  });
}

/**
 * Get list of applied migrations from database
 */
async function getAppliedMigrations() {
  await ensureMigrationsTable();
  try {
    const [rows] = await query('SELECT version, name, applied_at FROM wajidx_schema_migrations ORDER BY applied_at ASC, version ASC');
    return rows || [];
  } catch (err) {
    console.warn('[MIGRATE NOTE] Could not read applied migrations:', err.message);
    return [];
  }
}

/**
 * Check status of all migrations
 */
async function getMigrationStatus() {
  const allMigrations = loadMigrationFiles();
  const applied = await getAppliedMigrations();
  const appliedMap = new Map(applied.map(a => [a.version, a]));

  return allMigrations.map(m => {
    const isApplied = appliedMap.has(m.version);
    return {
      version: m.version,
      name: m.name,
      file: m.file,
      applied: isApplied,
      applied_at: isApplied ? appliedMap.get(m.version).applied_at : null
    };
  });
}

/**
 * Run pending migrations (UP)
 */
async function runUp() {
  await ensureMigrationsTable();
  const allMigrations = loadMigrationFiles();
  const applied = await getAppliedMigrations();
  const appliedVersions = new Set(applied.map(a => a.version));

  const pending = allMigrations.filter(m => !appliedVersions.has(m.version));

  if (pending.length === 0) {
    console.log('✅ Database schema is already up to date. No pending migrations.');
    return { success: true, count: 0, applied: [] };
  }

  console.log(`🚀 Found ${pending.length} pending migration(s). Applying...`);
  const executed = [];
  const pg = isPostgres();

  for (const m of pending) {
    console.log(`   Applying migration: [${m.version}] ${m.name}...`);
    if (typeof m.up === 'function') {
      await m.up(query, pg);
    }

    await query(
      'INSERT INTO wajidx_schema_migrations (version, name) VALUES (?, ?)',
      [m.version, m.name]
    );

    console.log(`   ✔ Applied: [${m.version}] ${m.name}`);
    executed.push(m.version);
  }

  console.log(`✨ Successfully applied ${executed.length} migration(s).`);
  return { success: true, count: executed.length, applied: executed };
}

/**
 * Rollback last migration (DOWN)
 */
async function runDown(steps = 1) {
  await ensureMigrationsTable();
  const allMigrations = loadMigrationFiles();
  const migrationMap = new Map(allMigrations.map(m => [m.version, m]));

  const applied = await getAppliedMigrations();

  if (applied.length === 0) {
    console.log('⚠️ No applied migrations to rollback.');
    return { success: true, count: 0, rolledBack: [] };
  }

  const toRollback = applied.slice(-steps).reverse();
  console.log(`⏪ Rolling back ${toRollback.length} migration(s)...`);
  const rolledBack = [];
  const pg = isPostgres();

  for (const m of toRollback) {
    console.log(`   Reverting migration: [${m.version}] ${m.name}...`);
    const mod = migrationMap.get(m.version);

    if (mod && typeof mod.down === 'function') {
      await mod.down(query, pg);
    } else {
      console.warn(`   ⚠️ Warning: No down() function found for [${m.version}]. Removing tracking record only.`);
    }

    await query('DELETE FROM wajidx_schema_migrations WHERE version = ?', [m.version]);
    console.log(`   ✔ Rolled back: [${m.version}] ${m.name}`);
    rolledBack.push(m.version);
  }

  console.log(`✨ Successfully rolled back ${rolledBack.length} migration(s).`);
  return { success: true, count: rolledBack.length, rolledBack };
}

// CLI Execution Handler
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  (async () => {
    try {
      if (command === 'status') {
        console.log('====================================================');
        console.log('📊 WAJIDX Database Schema Migration Status (devaj)');
        console.log('====================================================');
        const statuses = await getMigrationStatus();
        if (statuses.length === 0) {
          console.log('No migration files found in database/migrations/');
        } else {
          for (const s of statuses) {
            const icon = s.applied ? '✔ [APPLIED] ' : '⏳ [PENDING] ';
            const date = s.applied_at ? ` (at ${new Date(s.applied_at).toLocaleString()})` : '';
            console.log(`${icon} ${s.version} — ${s.name}${date}`);
          }
        }
        console.log('====================================================');
      } else if (command === 'up') {
        await runUp();
      } else if (command === 'down' || command === 'rollback') {
        const steps = parseInt(args[1] || '1', 10);
        await runDown(steps);
      } else {
        console.error(`Unknown command: ${command}. Use 'status', 'up', or 'down'.`);
        process.exit(1);
      }
      process.exit(0);
    } catch (err) {
      console.error('❌ Migration error:', err);
      process.exit(1);
    }
  })();
}

module.exports = {
  getMigrationStatus,
  getAppliedMigrations,
  runUp,
  runDown,
  ensureMigrationsTable
};
