/**
 * Migration: 002_add_versioning_tables
 * Creates tables for revisions, system backups/snapshots, and schema migration tracking
 */

module.exports = {
  version: '20260830000002_002_add_versioning_tables',
  name: 'Add Revisions, Snapshots and Schema Migration Tables',

  async up(query, isPostgres) {
    if (isPostgres) {
      await query(`
        CREATE TABLE IF NOT EXISTS wajidx_revisions (
          id SERIAL PRIMARY KEY,
          entity_type VARCHAR(50) NOT NULL,
          entity_id INT NULL,
          version_number INT NOT NULL DEFAULT 1,
          change_summary VARCHAR(255) NULL,
          snapshot_data TEXT NOT NULL,
          created_by VARCHAR(100) DEFAULT 'admin',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_wajidx_revisions_entity ON wajidx_revisions(entity_type, entity_id);
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_wajidx_revisions_created ON wajidx_revisions(created_at);
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS wajidx_snapshots (
          id SERIAL PRIMARY KEY,
          snapshot_name VARCHAR(200) NOT NULL,
          snapshot_type VARCHAR(50) DEFAULT 'manual',
          item_counts TEXT NULL,
          payload TEXT NOT NULL,
          created_by VARCHAR(100) DEFAULT 'admin',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_wajidx_snapshots_created ON wajidx_snapshots(created_at);
      `);
    } else {
      // MySQL (devaj database)
      await query(`
        CREATE TABLE IF NOT EXISTS \`wajidx_revisions\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`entity_type\` VARCHAR(50) NOT NULL,
          \`entity_id\` INT NULL,
          \`version_number\` INT NOT NULL DEFAULT 1,
          \`change_summary\` VARCHAR(255) NULL,
          \`snapshot_data\` LONGTEXT NOT NULL,
          \`created_by\` VARCHAR(100) DEFAULT 'admin',
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX \`idx_revisions_entity\` (\`entity_type\`, \`entity_id\`),
          INDEX \`idx_revisions_created\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS \`wajidx_snapshots\` (
          \`id\` INT AUTO_INCREMENT PRIMARY KEY,
          \`snapshot_name\` VARCHAR(200) NOT NULL,
          \`snapshot_type\` VARCHAR(50) DEFAULT 'manual',
          \`item_counts\` TEXT NULL,
          \`payload\` LONGTEXT NOT NULL,
          \`created_by\` VARCHAR(100) DEFAULT 'admin',
          \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX \`idx_snapshots_created\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    }
  },

  async down(query) {
    await query('DROP TABLE IF EXISTS wajidx_snapshots');
    await query('DROP TABLE IF EXISTS wajidx_revisions');
  }
};
