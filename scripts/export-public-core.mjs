#!/usr/bin/env node
/**
 * Public core export script.
 *
 * Creates (or refreshes) dist-public/manageCallAI/ by copying only
 * allowlisted files and directories from the current working tree.
 * .git, node_modules, dist/, and denylist-matched paths are excluded.
 *
 * Usage:
 *   node scripts/export-public-core.mjs
 *   node scripts/export-public-core.mjs --dry-run   (print what would be copied)
 *   node scripts/export-public-core.mjs --verbose
 *   node scripts/export-public-core.mjs --out <path>
 *
 * Exit 0 — export complete (or dry-run complete).
 * Exit 1 — missing required allowlisted path; aborting.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose') || DRY_RUN;
const outArg = args.indexOf('--out');
const OUT_DIR = outArg >= 0 ? resolve(args[outArg + 1]) : resolve(ROOT, 'dist-public', 'manageCallAI');

// ── Denylist patterns (path segments) ────────────────────────────────────────
// Any path component matching these is excluded regardless of allowlist.

const DENYLIST_SEGMENTS = [
  'commercial-private',
  'enterprise-private',
  'license-service',
  'license-generator',
  'activation-server',
  'activation-service',
  'signing-key',
  'private_module_registry_impl',
  '.env.production',
  '.env.staging',
  '.env.local',
  'node_modules',
  '.git',
];

const DENYLIST_EXTENSIONS = new Set(['.pem', '.key', '.p12', '.pfx', '.jks']);

// ── Allowlist ─────────────────────────────────────────────────────────────────
// Each entry: { src: relative path from repo root, required: bool }
// Directories are copied recursively (with per-item denylist filtering).

const ALLOWLIST = [
  // Root files
  { src: 'README.md', required: true },
  { src: 'LICENSE', required: true },
  { src: 'CONTRIBUTING.md', required: false },
  { src: 'TRADEMARKS.md', required: false },
  { src: 'LICENSING.md', required: false },
  { src: 'package.json', required: true },
  { src: 'pnpm-lock.yaml', required: true },
  { src: 'pnpm-workspace.yaml', required: true },
  { src: 'tsconfig.base.json', required: false },
  { src: 'tsconfig.json', required: false },
  { src: '.gitignore', required: false },
  { src: 'docker-compose.yml', required: false },
  { src: 'docker-compose.prod.yml', required: false },
  { src: 'docker-compose.free.yml', required: false },
  { src: 'docker-compose.pro.yml', required: false },
  { src: 'docker-compose.enterprise.yml', required: false },
  { src: '.env.example', required: false },
  { src: '.env.free.example', required: false },
  { src: '.env.pro.example', required: false },
  { src: '.env.enterprise.example', required: false },
  { src: '.env.production.example', required: false },
  { src: 'install.sh', required: false },

  // Applications
  { src: 'apps/api', required: true },
  { src: 'apps/web', required: true },
  { src: 'apps/mcp', required: false },
  { src: 'apps/mcp-server', required: false },
  { src: 'apps/worker', required: false },
  { src: 'apps/freeswitch-agent', required: false },

  // Packages
  { src: 'packages/contracts', required: true },
  { src: 'packages/sdk', required: false },
  { src: 'packages/core', required: false },
  { src: 'packages/flow-engine', required: false },
  { src: 'packages/policy', required: false },

  // DB
  { src: 'db/migrations', required: true },
  { src: 'db/migrate.mjs', required: true },
  { src: 'db/README.md', required: false },

  // FreeSWITCH
  { src: 'freeswitch', required: false },

  // Helm
  { src: 'helm', required: false },

  // Docs
  { src: 'docs', required: true },

  // Scripts
  { src: 'scripts', required: true },

  // Examples (only invalid license examples)
  { src: 'examples/licenses', required: false },

  // CI
  { src: '.github', required: false },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isDenied(filePath) {
  const rel = relative(ROOT, filePath).replace(/\\/g, '/');
  const segments = rel.split('/');

  for (const seg of segments) {
    if (DENYLIST_SEGMENTS.some((d) => seg === d || seg.startsWith(d + '.'))) {
      return `denylist segment: "${seg}"`;
    }
  }

  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (DENYLIST_EXTENSIONS.has(ext)) {
    return `denylist extension: "${ext}"`;
  }

  return null;
}

function copyFiltered(srcAbs, destAbs) {
  const stat = statSync(srcAbs);

  if (stat.isDirectory()) {
    const entries = readdirSync(srcAbs);
    for (const entry of entries) {
      const childSrc = join(srcAbs, entry);
      const childDest = join(destAbs, entry);
      const denial = isDenied(childSrc);
      if (denial) {
        if (VERBOSE) console.log(`  SKIP  ${relative(ROOT, childSrc)}  (${denial})`);
        continue;
      }
      copyFiltered(childSrc, childDest);
    }
  } else {
    if (!DRY_RUN) {
      mkdirSync(dirname(destAbs), { recursive: true });
      cpSync(srcAbs, destAbs);
    }
    if (VERBOSE) console.log(`  copy  ${relative(ROOT, srcAbs)}`);
    return true;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\nPublic core export${DRY_RUN ? ' [DRY RUN]' : ''}`);
console.log(`  Source:  ${ROOT}`);
console.log(`  Target:  ${OUT_DIR}\n`);

// Clean output dir (skip for dry run)
if (!DRY_RUN) {
  if (existsSync(OUT_DIR)) {
    rmSync(OUT_DIR, { recursive: true, force: true });
  }
  mkdirSync(OUT_DIR, { recursive: true });
}

const missing = [];
let copyCount = 0;
let skipCount = 0;

for (const { src, required } of ALLOWLIST) {
  const srcAbs = join(ROOT, src);
  const destAbs = join(OUT_DIR, src);

  if (!existsSync(srcAbs)) {
    if (required) {
      console.error(`  MISSING (required): ${src}`);
      missing.push(src);
    } else {
      if (VERBOSE) console.log(`  SKIP  ${src}  (not present — optional)`);
      skipCount++;
    }
    continue;
  }

  const denial = isDenied(srcAbs);
  if (denial) {
    console.error(`  DENIED (allowlisted path is on denylist): ${src}  (${denial})`);
    skipCount++;
    continue;
  }

  if (VERBOSE) console.log(`\n  → ${src}/`);
  copyFiltered(srcAbs, destAbs);
  copyCount++;
}

if (missing.length > 0) {
  console.error(`\nExport FAILED: ${missing.length} required path(s) missing:`);
  for (const m of missing) console.error(`  - ${m}`);
  process.exit(1);
}

if (!DRY_RUN) {
  // Write a manifest file in the export root
  writeFileSync(
    join(OUT_DIR, '.export-manifest.json'),
    JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        source: ROOT,
        allowlist_entries: ALLOWLIST.length,
      },
      null,
      2,
    ),
  );
}

console.log(
  `\nExport ${DRY_RUN ? 'dry-run' : ''} complete.` +
  `  Processed ${copyCount} allowlist entries, skipped ${skipCount} optional/missing.\n`,
);
