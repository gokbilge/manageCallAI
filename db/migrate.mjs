import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const pg = requireFromWorkspace("pg");

loadEnv();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required. Create a .env file or export DATABASE_URL.");
  process.exit(1);
}

const migrationsDir = path.join(__dirname, "migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

const client = new pg.Client({ connectionString: databaseUrl });
const isStatusMode = process.argv.includes("--status");
const isVerifyMode = process.argv.includes("--verify");

// Compute SHA-256 of a migration file's content.
// Line endings are normalised to LF before hashing so the digest is identical
// on Windows (CRLF) and Linux/macOS (LF).
function hashContent(content) {
  return createHash("sha256").update(content.replace(/\r\n/g, "\n")).digest("hex");
}

try {
  await client.connect();
  await ensureMigrationTable(client);

  const appliedRows = await client.query(
    "SELECT filename, applied_at, sha256_hex FROM schema_migrations ORDER BY filename"
  );
  const applied = new Map(
    appliedRows.rows.map((row) => [row.filename, { applied_at: row.applied_at, sha256_hex: row.sha256_hex }])
  );

  // ── --status mode ─────────────────────────────────────────────────────────────
  if (isStatusMode) {
    printStatus(migrationFiles, applied);
    process.exit(0);
  }

  // ── --verify mode ─────────────────────────────────────────────────────────────
  // For every applied migration that has a stored sha256_hex, verify the file on
  // disk still matches. Exits with code 1 on first mismatch.
  if (isVerifyMode) {
    let tampered = 0;
    let checked = 0;

    for (const [filename, { sha256_hex }] of applied.entries()) {
      if (!sha256_hex) continue; // pre-0037 migration, no checksum recorded

      const filepath = path.join(migrationsDir, filename);
      if (!existsSync(filepath)) {
        console.error(`MISSING: ${filename} is in schema_migrations but not on disk`);
        tampered++;
        continue;
      }

      const diskHash = hashContent(readFileSync(filepath, "utf8"));
      if (diskHash !== sha256_hex) {
        console.error(
          `TAMPERED: ${filename} — stored hash ${sha256_hex} does not match disk hash ${diskHash}`
        );
        tampered++;
      } else {
        checked++;
      }
    }

    if (tampered > 0) {
      console.error(`\nVerification FAILED: ${tampered} tampered migration(s) detected.`);
      process.exit(1);
    }

    console.log(`Migration checksum verification: OK (${checked} migration(s) verified)`);
    process.exit(0);
  }

  // ── apply mode ────────────────────────────────────────────────────────────────
  const pending = migrationFiles.filter((filename) => !applied.has(filename));

  if (pending.length === 0) {
    console.log("No pending migrations.");
    process.exit(0);
  }

  const appliedBy =
    process.env["CI_PIPELINE_ID"] ??
    process.env["GITHUB_RUN_ID"] ??
    process.env["USER"] ??
    "unknown";

  for (const filename of pending) {
    const migrationPath = path.join(migrationsDir, filename);
    const sql = readFileSync(migrationPath, "utf8");
    const sha256 = hashContent(sql);

    console.log(`Applying ${filename}...`);
    await client.query("BEGIN");
    await client.query(sql);

    // Store checksum and actor so the --verify mode can detect future tampering.
    // The INSERT uses ON CONFLICT DO NOTHING so re-applying a migration that was
    // already recorded (e.g. in a retry scenario) does not error.
    await client.query(
      `INSERT INTO schema_migrations (filename, sha256_hex, applied_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (filename) DO NOTHING`,
      [filename, sha256, appliedBy]
    );
    await client.query("COMMIT");
    console.log(`Applied ${filename}`);
  }

  console.log(`Applied ${pending.length} migration(s).`);
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Ignore rollback failure when there is no active transaction.
  }

  console.error("Migration failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

function loadEnv() {
  const envPath = path.join(rootDir, ".env");
  const exampleEnvPath = path.join(rootDir, ".env.example");

  if (existsSync(envPath)) {
    applyEnvFile(envPath);
    return;
  }

  if (existsSync(exampleEnvPath)) {
    applyEnvFile(exampleEnvPath);
  }
}

function applyEnvFile(filePath) {
  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function requireFromWorkspace(packageName) {
  const resolutionPaths = [rootDir, path.join(rootDir, "apps", "api")];

  for (const resolutionPath of resolutionPaths) {
    try {
      const resolved = require.resolve(packageName, { paths: [resolutionPath] });
      return require(resolved);
    } catch {
      // Try the next workspace path.
    }
  }

  throw new Error(
    `Unable to resolve package "${packageName}" from workspace paths: ${resolutionPaths.join(", ")}`
  );
}

async function ensureMigrationTable(dbClient) {
  // The base table is created without the new columns so existing databases
  // that predate 0037 can still run migrations. The 0037 migration adds
  // sha256_hex and applied_by via ALTER TABLE IF NOT EXISTS.
  await dbClient.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

function printStatus(files, applied) {
  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  const fileSet = new Set(files);

  for (const filename of files) {
    const record = applied.get(filename);
    if (record) {
      const checkmark = record.sha256_hex ? "✓" : "~";
      console.log(`applied${checkmark}\t${filename}\t${record.applied_at.toISOString()}`);
    } else {
      console.log(`pending \t${filename}`);
    }
  }

  for (const [filename, { applied_at }] of applied.entries()) {
    if (!fileSet.has(filename)) {
      console.log(`applied-missing\t${filename}\t${applied_at.toISOString()}`);
    }
  }
}
