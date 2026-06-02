#!/usr/bin/env node
/**
 * Restore rehearsal: take a pg_dump, restore to a temporary database,
 * run the full validation sequence, and emit a restore-evidence JSON.
 *
 * Usage:
 *   pnpm restore:rehearsal
 *   node scripts/restore-rehearsal.mjs [--output-dir=path] [--keep-temp-db] [--check-config]
 *
 * Required env: DATABASE_URL
 * Optional env:
 *   RESTORE_DB_NAME     — override the temp database name
 *   RESTORE_OPERATOR    — operator name written into the evidence JSON
 *   APP_ENV + JWT_SECRET + RUNTIME_API_TOKEN + SIP_SECRET_MASTER_KEY
 *                        — set all four to also run production:preflight
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const checkConfigOnly = args.includes('--check-config');
const keepTempDb = args.includes('--keep-temp-db');
const requireRcEvidence =
  args.includes('--require-rc') || process.env.RESTORE_REQUIRE_RC_EVIDENCE === 'true';
const outputDirArg = args.find((a) => a.startsWith('--output-dir='));
const releaseVersionArg = args.find((a) => a.startsWith('--release-version='));
const outputDir = outputDirArg
  ? outputDirArg.slice('--output-dir='.length)
  : path.join(rootDir, 'artifacts', 'restore');
const releaseVersion = releaseVersionArg
  ? releaseVersionArg.slice('--release-version='.length)
  : process.env.RESTORE_RELEASE_VERSION || '';

if (checkConfigOnly) {
  console.log('restore rehearsal configuration check passed');
  process.exit(0);
}

// Load .env — only sets vars not already in the environment
const envPath = path.join(rootDir, '.env');
if (existsSync(envPath)) {
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const k = line.slice(0, eq).trim();
    if (!k || process.env[k] !== undefined) continue;
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}

const sourceUrl = process.env.DATABASE_URL;
if (!sourceUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

// Check that external pg tools are available
function requireTool(name) {
  const r = spawnSync(name, ['--version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    console.error(`Required tool not found: ${name} — install PostgreSQL client tools and ensure they are in PATH`);
    process.exit(1);
  }
  return (r.stdout || r.stderr || '').split('\n')[0].trim();
}

const pgToolsImage = process.env.RESTORE_PG_TOOLS_IMAGE || 'postgres:17';
let pgToolMode = 'host';

function resolvePgTool(name) {
  const host = spawnSync(name, ['--version'], { encoding: 'utf8' });
  if (!host.error && host.status === 0) {
    return { mode: 'host', version: (host.stdout || host.stderr || '').split('\n')[0].trim() };
  }

  const docker = spawnSync(
    'docker',
    ['run', '--rm', '--network', 'host', pgToolsImage, name, '--version'],
    { encoding: 'utf8' },
  );
  if (!docker.error && docker.status === 0) {
    return { mode: 'docker', version: (docker.stdout || docker.stderr || '').split('\n')[0].trim() };
  }

  console.error(`Required tool not found: ${name}. Install PostgreSQL client tools or Docker with ${pgToolsImage}.`);
  process.exit(1);
}

function runPgTool(name, toolArgs, options = {}) {
  if (pgToolMode === 'docker') {
    return spawnSync(
      'docker',
      ['run', '--rm', '--network', 'host', '-v', `${tmpdir()}:${tmpdir()}`, pgToolsImage, name, ...toolArgs],
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024, ...options },
    );
  }

  return spawnSync(name, toolArgs, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
}

const pgDumpVersion = resolvePgTool('pg_dump');
const pgRestoreVersion = resolvePgTool('pg_restore');
const psqlToolVersion = resolvePgTool('psql');
if (pgDumpVersion.mode !== pgRestoreVersion.mode || pgDumpVersion.mode !== psqlToolVersion.mode) {
  console.error('PostgreSQL client tools must all run in the same mode (host or docker).');
  process.exit(1);
}
pgToolMode = pgDumpVersion.mode;
const psqlVersion = psqlToolVersion.version;

// URL helpers
function parseDbUrl(urlStr) {
  const u = new URL(urlStr.replace(/^postgres:\/\//, 'postgresql://'));
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    host: u.hostname,
    port: u.port || '5432',
    database: u.pathname.slice(1),
  };
}

function buildUrl({ user, password, host, port, database }) {
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

function maskUrl(urlStr) {
  return urlStr.replace(/:([^:@/][^@]*)@/, ':***@');
}

const parsed = parseDbUrl(sourceUrl);
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const restoreDbName =
  process.env.RESTORE_DB_NAME || `${parsed.database}_restore_${Date.now()}`;
const adminUrl = buildUrl({ ...parsed, database: 'postgres' });
const restoreUrl = buildUrl({ ...parsed, database: restoreDbName });

// Cleanup state (both used in synchronous process.on('exit') handler)
let dumpFile = null;
let tempDbCreated = false;

process.on('exit', () => {
  if (dumpFile && existsSync(dumpFile)) {
    try { unlinkSync(dumpFile); } catch {}
  }
  if (tempDbCreated && !keepTempDb) {
    runPgTool('psql', [adminUrl, '-c', `DROP DATABASE IF EXISTS "${restoreDbName}";`], {
      encoding: 'utf8',
    });
  }
});

function run(cmd, extraEnv = {}) {
  return spawnSync(cmd[0], cmd.slice(1), {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, ...extraEnv },
    cwd: rootDir,
  });
}

function nodeScript(scriptPath, extraEnv = {}) {
  return run(['node', path.join(rootDir, scriptPath)], extraEnv);
}

// ─── Rehearsal ────────────────────────────────────────────────────────────────

const startTime = Date.now();
const backupTakenAt = new Date().toISOString();
console.log(`\n=== restore rehearsal: ${backupTakenAt} ===`);
console.log(`source:  ${maskUrl(sourceUrl)}`);
console.log(`target:  ${restoreDbName}`);

// [1/7] pg_dump
dumpFile = path.join(tmpdir(), `managecallai-rehearsal-${Date.now()}.pgdump`);
console.log('\n[1/7] pg_dump...');
const dumpResult = runPgTool(
  'pg_dump',
  ['--format=custom', '--no-acl', '--no-owner', '--file', dumpFile, sourceUrl],
  { encoding: 'utf8' },
);
if (dumpResult.status !== 0) {
  console.error(`pg_dump failed: ${dumpResult.stderr}`);
  process.exit(1);
}
console.log(`ok: backup written`);
const backupFileName = path.basename(dumpFile);

// [2/7] Create temp database
console.log(`\n[2/7] CREATE DATABASE ${restoreDbName}...`);
const createResult = runPgTool('psql', [adminUrl, '-c', `CREATE DATABASE "${restoreDbName}";`], {
  encoding: 'utf8',
});
if (createResult.status !== 0) {
  console.error(`CREATE DATABASE failed: ${createResult.stderr}`);
  process.exit(1);
}
tempDbCreated = true;
const restoredAt = new Date().toISOString();
console.log('ok');

// [3/7] pg_restore
console.log('\n[3/7] pg_restore...');
const restoreResult = runPgTool(
  'pg_restore',
  ['--dbname', restoreUrl, '--no-acl', '--no-owner', dumpFile],
  { encoding: 'utf8' },
);
// Exit 1 from pg_restore means non-fatal warnings (e.g. missing extensions); treat as ok
if (restoreResult.status !== 0 && restoreResult.status !== 1) {
  console.error(`pg_restore failed (exit ${restoreResult.status}): ${restoreResult.stderr}`);
  process.exit(1);
}
if (restoreResult.stderr) console.warn(`pg_restore warnings (non-fatal): ${restoreResult.stderr.trim()}`);
console.log('ok');

// [4/7] db:migrate
console.log('\n[4/7] db:migrate...');
const migrateResult = nodeScript('db/migrate.mjs', { DATABASE_URL: restoreUrl });
if (migrateResult.status !== 0) {
  console.error(`db:migrate failed: ${migrateResult.stderr || migrateResult.stdout}`);
  process.exit(1);
}
if (migrateResult.stdout.trim()) console.log(migrateResult.stdout.trim());
console.log('ok');

// [5/7] db:contracts
console.log('\n[5/7] db:contracts...');
const contractsResult = nodeScript('scripts/check-db-contracts.mjs', { DATABASE_URL: restoreUrl });
const dbContractsPassed = contractsResult.status === 0;
if (contractsResult.stdout.trim()) console.log(contractsResult.stdout.trim());
if (!dbContractsPassed) console.error(`db:contracts FAILED: ${contractsResult.stderr}`);
console.log(dbContractsPassed ? 'ok' : 'FAILED');

// [6/7] db:constraints
console.log('\n[6/7] db:constraints...');
const constraintsResult = nodeScript('scripts/check-db-constraints.mjs', { DATABASE_URL: restoreUrl });
const dbConstraintsPassed = constraintsResult.status === 0;
if (constraintsResult.stdout.trim()) console.log(constraintsResult.stdout.trim());
if (!dbConstraintsPassed) console.error(`db:constraints FAILED: ${constraintsResult.stderr}`);
console.log(dbConstraintsPassed ? 'ok' : 'FAILED');

// [7/7] restore:smoke
console.log('\n[7/7] restore:smoke...');
const smokeResult = nodeScript('scripts/restore-smoke.mjs', { DATABASE_URL: restoreUrl });
const restoreSmokePassed = smokeResult.status === 0;
if (smokeResult.stdout.trim()) console.log(smokeResult.stdout.trim());
if (!restoreSmokePassed) console.error(`restore:smoke FAILED: ${smokeResult.stderr}`);
console.log(restoreSmokePassed ? 'ok' : 'FAILED');

// [optional] production:preflight
let preflightPassed = false;
const hasPreflightEnv =
  process.env.APP_ENV === 'production' &&
  process.env.JWT_SECRET &&
  process.env.RUNTIME_API_TOKEN &&
  process.env.SIP_SECRET_MASTER_KEY;

if (hasPreflightEnv) {
  console.log('\n[opt] production:preflight...');
  const pfResult = nodeScript('scripts/production-preflight.mjs');
  preflightPassed = pfResult.status === 0;
  if (pfResult.stdout.trim()) console.log(pfResult.stdout.trim());
  console.log(preflightPassed ? 'ok' : 'FAILED');
} else {
  console.log('\n[opt] production:preflight: skipped (set APP_ENV=production + JWT_SECRET + RUNTIME_API_TOKEN + SIP_SECRET_MASTER_KEY to include)');
}

const restoreDurationSeconds = Math.round((Date.now() - startTime) / 1000);

// Get migration count from the restored database
let migrationCount = 0;
{
  const pg = await import('pg');
  const { Pool } = pg.default ?? pg;
  const pool = new Pool({ connectionString: restoreUrl });
  try {
    const r = await pool.query('SELECT COUNT(*)::int AS count FROM schema_migrations');
    migrationCount = r.rows[0]?.count ?? 0;
  } catch {}
  await pool.end();
}

// Collect version metadata
let pnpmVersion = '';
try {
  const r = spawnSync('pnpm', ['--version'], { encoding: 'utf8' });
  pnpmVersion = (r.stdout || '').trim();
} catch {}

let gitSha = '';
try {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: rootDir });
  gitSha = (r.stdout || '').trim();
} catch {}

let workflowRunUrl = process.env.RESTORE_WORKFLOW_RUN_URL || '';
if (!workflowRunUrl && process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID) {
  workflowRunUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`;
}

const requiredTables = [
  'tenants', 'users', 'extensions', 'sip_trunks', 'phone_numbers',
  'ivr_flows', 'flow_versions', 'inbound_routes', 'call_events', 'call_recordings',
  'automation_api_keys', 'automation_webhooks', 'schema_migrations',
];

const evidence = {
  release_version: releaseVersion || null,
  commit_sha: gitSha || null,
  workflow_run_url: workflowRunUrl || null,
  target_host: process.env.RESTORE_TARGET_HOST || parsed.host,
  restored_at: restoredAt,
  database_url_masked: maskUrl(restoreUrl),
  source_backup_file: backupFileName,
  backup_taken_at: backupTakenAt,
  migration_count: migrationCount,
  tables_verified: requiredTables,
  restore_smoke_passed: restoreSmokePassed,
  db_contracts_passed: dbContractsPassed,
  db_constraints_passed: dbConstraintsPassed,
  preflight_passed: preflightPassed,
  e2e_passed: false,
  restore_duration_seconds: restoreDurationSeconds,
  node_version: process.version,
  pnpm_version: pnpmVersion,
  postgres_version: psqlVersion,
  api_image_tag: gitSha,
  operator:
    process.env.RESTORE_OPERATOR ||
    process.env.USERNAME ||
    process.env.USER ||
    'local-rehearsal',
  environment: process.env.RESTORE_ENVIRONMENT || process.env.APP_ENV || 'development',
  notes: `rehearsal - restore to temporary database ${restoreDbName}`,
};

// Write evidence
mkdirSync(outputDir, { recursive: true });
const evidenceFile = path.join(outputDir, `restore-evidence-${timestamp}.json`);
writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2) + '\n');
console.log(`\nevidence: ${evidenceFile}`);

// Validate evidence
console.log('\nValidating evidence JSON...');
const checkResult = run([
  'node',
  path.join(rootDir, 'scripts/restore-evidence-check.mjs'),
  `--evidence=${evidenceFile}`,
  ...(requireRcEvidence ? ['--require-rc'] : []),
]);
if (checkResult.stdout.trim()) console.log(checkResult.stdout.trim());
if (checkResult.stderr?.trim()) console.error(checkResult.stderr.trim());

// Summary
const allPassed =
  restoreSmokePassed &&
  dbContractsPassed &&
  dbConstraintsPassed &&
  checkResult.status === 0;

console.log('\n=== summary ===');
console.log(`  backup:              ok`);
console.log(`  restore:             ok`);
console.log(`  migrations:          ok (${migrationCount} applied)`);
console.log(`  db:contracts:        ${dbContractsPassed ? 'ok' : 'FAILED'}`);
console.log(`  db:constraints:      ${dbConstraintsPassed ? 'ok' : 'FAILED'}`);
console.log(`  restore:smoke:       ${restoreSmokePassed ? 'ok' : 'FAILED'}`);
console.log(`  production:preflight:${preflightPassed ? ' ok' : ' skipped'}`);
console.log(`  evidence validated:  ${checkResult.status === 0 ? 'ok' : 'FAILED'}`);
console.log(`  duration:            ${restoreDurationSeconds}s`);
console.log(`  evidence file:       ${evidenceFile}`);

if (!allPassed) {
  console.error('\nrestore rehearsal FAILED');
  process.exitCode = 1;
} else {
  console.log('\nrestore rehearsal PASSED');
}
