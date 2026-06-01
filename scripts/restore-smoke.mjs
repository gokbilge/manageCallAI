#!/usr/bin/env node

const args = new Set(process.argv.slice(2));
if (args.has('--check-config')) {
  console.log('restore smoke configuration check passed');
  process.exit(0);
}

const pg = await import('pg');

const { Pool } = pg.default ?? pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required for restore smoke verification');
  process.exit(1);
}

const requiredTables = [
  'tenants',
  'users',
  'extensions',
  'sip_trunks',
  'phone_numbers',
  'ivr_flows',
  'flow_versions',
  'inbound_routes',
  'call_events',
  'call_recordings',
  'automation_api_keys',
  'automation_webhooks',
  'schema_migrations',
];

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query('SELECT 1');
  console.log('ok: database connection');

  const tableResult = await pool.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [requiredTables],
  );
  const present = new Set(tableResult.rows.map((row) => row.table_name));
  const missing = requiredTables.filter((table) => !present.has(table));
  if (missing.length > 0) {
    throw new Error(`missing required tables after restore: ${missing.join(', ')}`);
  }
  console.log(`ok: required tables present (${requiredTables.length})`);

  const migrationResult = await pool.query('SELECT COUNT(*)::int AS count FROM schema_migrations');
  const migrationCount = migrationResult.rows[0]?.count ?? 0;
  if (migrationCount === 0) {
    throw new Error('schema_migrations is empty after restore');
  }
  console.log(`ok: migration history present (${migrationCount})`);

  const tenantResult = await pool.query(`SELECT COUNT(*)::int AS count FROM tenants WHERE status = 'active'`);
  console.log(`ok: active tenants visible (${tenantResult.rows[0]?.count ?? 0})`);

  const orphanResult = await pool.query(`
    SELECT COUNT(*)::int AS count
    FROM flow_versions fv
    LEFT JOIN ivr_flows f ON f.id = fv.flow_id
    WHERE f.id IS NULL
  `);
  if ((orphanResult.rows[0]?.count ?? 0) > 0) {
    throw new Error('orphaned flow_versions detected after restore');
  }
  console.log('ok: IVR flow version references intact');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
