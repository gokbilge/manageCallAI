import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

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

try {
  await client.connect();
  await ensureMigrationTable(client);

  const appliedRows = await client.query(
    "SELECT filename, applied_at FROM schema_migrations ORDER BY filename"
  );
  const applied = new Map(appliedRows.rows.map((row) => [row.filename, row.applied_at]));

  if (isStatusMode) {
    printStatus(migrationFiles, applied);
    process.exit(0);
  }

  const pending = migrationFiles.filter((filename) => !applied.has(filename));

  if (pending.length === 0) {
    console.log("No pending migrations.");
    process.exit(0);
  }

  for (const filename of pending) {
    const migrationPath = path.join(migrationsDir, filename);
    const sql = readFileSync(migrationPath, "utf8");

    console.log(`Applying ${filename}...`);
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (filename) VALUES ($1)",
      [filename]
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
    dotenv.config({ path: envPath });
    return;
  }

  if (existsSync(exampleEnvPath)) {
    dotenv.config({ path: exampleEnvPath });
  }
}

async function ensureMigrationTable(dbClient) {
  await dbClient.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

function printStatus(files, applied) {
  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  for (const filename of files) {
    if (applied.has(filename)) {
      console.log(`applied\t${filename}\t${applied.get(filename).toISOString()}`);
    } else {
      console.log(`pending\t${filename}`);
    }
  }
}
