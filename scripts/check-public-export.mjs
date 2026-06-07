#!/usr/bin/env node
/**
 * Public export validation script.
 *
 * Scans a target directory (default: dist-public/manageCallAI or current repo
 * when --repo flag is passed) for content that must not appear in the public
 * release. Fails with exit code 1 on any violation.
 *
 * Checks performed:
 *   1. Denylist path patterns (private dirs, key extensions)
 *   2. Private key material in file content
 *   3. Real-looking license files outside allowed examples path
 *   4. Private schema table names in SQL migration files
 *   5. Obvious private implementation directories
 *
 * Usage:
 *   node scripts/check-public-export.mjs                 # scan dist-public/manageCallAI
 *   node scripts/check-public-export.mjs --repo          # scan current repo root
 *   node scripts/check-public-export.mjs --dir <path>    # scan specific dir
 *   node scripts/check-public-export.mjs --self-check    # run built-in self-tests
 *   node scripts/check-public-export.mjs --verbose
 *
 * Exit 0 — all checks pass.
 * Exit 1 — one or more violations found.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const SELF_CHECK = args.includes('--self-check');

let SCAN_DIR;
if (args.includes('--repo')) {
  SCAN_DIR = ROOT;
} else if (args.includes('--dir')) {
  SCAN_DIR = resolve(args[args.indexOf('--dir') + 1]);
} else {
  SCAN_DIR = resolve(ROOT, 'dist-public', 'manageCallAI');
}

// ── Denylist: blocked path patterns ──────────────────────────────────────────

const DENYLIST_PATH_PATTERNS = [
  /commercial-private/i,
  /enterprise-private/i,
  /license-service/i,
  /license-generator/i,
  /activation-server/i,
  /activation-service/i,
  /signing-key/i,
  /\/secrets\//i,
  /\/credentials\//i,
  /\/customer\//i,
  /\/customers\//i,
  /\/contracts\/private\//i,
  /\.env\.production$/,
  /\.env\.staging$/,
  /\.env\.local$/,
  /reseller-billing\/(src|impl)/i,
  /sso\/(saml|oidc|ldap)\/src\//i,
  /migration-assistant\/(cucm|avaya|alcatel)\/src\//i,
  /ha-deploy\/src\//i,
  /carrier-certification\/packs\//i,
];

const DENYLIST_EXTENSIONS = new Set(['.pem', '.key', '.p12', '.pfx', '.jks']);

// ── Private key patterns ──────────────────────────────────────────────────────

const PRIVATE_KEY_PATTERNS = [
  /-----BEGIN PRIVATE KEY-----/,
  /-----BEGIN RSA PRIVATE KEY-----/,
  /-----BEGIN EC PRIVATE KEY-----/,
  /-----BEGIN OPENSSH PRIVATE KEY-----/,
  /-----BEGIN PGP PRIVATE KEY BLOCK-----/,
];

// ── Real license detection ────────────────────────────────────────────────────
// License files with non-invalid signatures outside the allowed examples path.

const INVALID_LICENSE_DIR_PATTERN = /examples[/\\]licenses[/\\]/;

function isRealLicenseFile(filePath, content) {
  // Must be JSON and contain license_id or signature
  if (!filePath.endsWith('.json')) return false;
  try {
    const parsed = JSON.parse(content);
    const hasLicenseId = typeof parsed.license_id === 'string';
    const hasSignature = typeof parsed.signature === 'string';
    if (!hasLicenseId && !hasSignature) return false;

    // Allow if it's in the examples/licenses dir AND marked invalid
    if (INVALID_LICENSE_DIR_PATTERN.test(filePath)) {
      const isInvalid =
        parsed.invalid_example === true ||
        (typeof parsed.signature === 'string' && parsed.signature.includes('INVALID'));
      if (isInvalid) return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ── Private schema patterns (in SQL files) ────────────────────────────────────

const PRIVATE_SCHEMA_PATTERNS = [
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?license_activation/i, label: 'license_activation' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?license_revocation/i, label: 'license_revocation' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?customer_contract/i, label: 'customer_contract' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?invoice(?!\w)/i, label: 'invoice' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?reseller_billing/i, label: 'reseller_billing' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?sso_connection/i, label: 'sso_connection' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?saml_(?!metadata_example)/i, label: 'saml_*' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?oidc_/i, label: 'oidc_*' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?migration_project/i, label: 'migration_project' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?cucm_/i, label: 'cucm_*' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?avaya_/i, label: 'avaya_*' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?alcatel_/i, label: 'alcatel_*' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?legal_hold_export/i, label: 'legal_hold_export' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?compliance_export/i, label: 'compliance_export' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?carrier_certification(?!_test_result)/i, label: 'carrier_certification' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?support_contract/i, label: 'support_contract' },
  { pattern: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?private_module_registry/i, label: 'private_module_registry' },
];

// ── Text file extensions to scan for content ─────────────────────────────────

const TEXT_EXTENSIONS = new Set([
  '.ts', '.js', '.mjs', '.cjs', '.tsx', '.jsx',
  '.json', '.yaml', '.yml', '.sql', '.sh', '.md',
  '.txt', '.env', '.toml', '.go', '.lua',
]);

// ── Scan exemptions ───────────────────────────────────────────────────────────
// Files exempt from content checks because they legitimately contain detection
// patterns as meta-references (the denylist doc and this script itself).
const CONTENT_CHECK_EXEMPT = new Set([
  'scripts/check-public-export.mjs',
  'docs/repo-split/public-core-denylist.md',
]);

// Path prefixes exempt from path-pattern denylist checks. Documentation that
// describes private patterns is allowed in the public repo — what is banned is
// actual private implementation code in apps/, packages/, db/, scripts/, etc.
const PATH_CHECK_EXEMPT_PREFIXES = ['docs/'];

// ── Scanner ───────────────────────────────────────────────────────────────────

const violations = [];

function addViolation(type, filePath, detail) {
  const rel = relative(SCAN_DIR, filePath).replace(/\\/g, '/');
  violations.push({ type, file: rel, detail });
  console.error(`  ✗ [${type}] ${rel}: ${detail}`);
}

function scanFile(filePath) {
  const rel = relative(SCAN_DIR, filePath).replace(/\\/g, '/');

  // Path-level checks — exempt docs/ (documentation about private patterns is fine)
  const skipPathCheck = PATH_CHECK_EXEMPT_PREFIXES.some((prefix) => rel.startsWith(prefix));
  if (!skipPathCheck) {
    for (const pattern of DENYLIST_PATH_PATTERNS) {
      if (pattern.test(rel)) {
        addViolation('DENYLIST_PATH', filePath, `matches pattern ${pattern}`);
        return; // No need to scan content of blocked file
      }
    }

    const ext = extname(filePath).toLowerCase();
    if (DENYLIST_EXTENSIONS.has(ext)) {
      addViolation('DENYLIST_EXT', filePath, `blocked extension ${ext}`);
      return;
    }
  }

  // Content checks (text files only)
  const ext = extname(filePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) return;

  // Skip content checks for meta-files that legitimately contain detection strings
  if (CONTENT_CHECK_EXEMPT.has(rel)) return;

  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return; // Binary or unreadable
  }

  // Private key check
  for (const pattern of PRIVATE_KEY_PATTERNS) {
    if (pattern.test(content)) {
      addViolation('PRIVATE_KEY', filePath, `contains private key marker: ${pattern.source.slice(0, 40)}`);
    }
  }

  // Real license file check
  if (isRealLicenseFile(filePath, content)) {
    addViolation('REAL_LICENSE', filePath, 'appears to be a real (non-example) license file');
  }

  // Private schema check (SQL files only)
  if (ext === '.sql') {
    for (const { pattern, label } of PRIVATE_SCHEMA_PATTERNS) {
      if (pattern.test(content)) {
        addViolation('PRIVATE_SCHEMA', filePath, `blocked table pattern: ${label}`);
      }
    }
  }

  if (VERBOSE && !violations.some((v) => v.file === rel)) {
    // Only log clean files in verbose mode
    // (violations already logged via addViolation)
  }
}

function scanDir(dirPath) {
  const rel = relative(SCAN_DIR, dirPath).replace(/\\/g, '/');

  // Skip hidden dirs and known non-code dirs
  const base = dirPath.split(/[/\\]/).pop() ?? '';
  if (base === 'node_modules' || base === '.git' || base === 'dist' || base === '.export-manifest.json') {
    return;
  }

  // Check dir-level denylist — exempt docs/ (documentation about private patterns is fine)
  const skipPathCheck = PATH_CHECK_EXEMPT_PREFIXES.some((prefix) => (rel + '/').startsWith(prefix));
  if (!skipPathCheck) {
    for (const pattern of DENYLIST_PATH_PATTERNS) {
      if (pattern.test(rel + '/')) {
        addViolation('DENYLIST_PATH', dirPath, `directory matches pattern ${pattern}`);
        return; // Don't recurse into blocked directory
      }
    }
  }

  let entries;
  try {
    entries = readdirSync(dirPath);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry === '.export-manifest.json') continue;
    const child = join(dirPath, entry);
    try {
      const s = statSync(child);
      if (s.isDirectory()) {
        scanDir(child);
      } else {
        scanFile(child);
      }
    } catch {
      // Skip unreadable entries
    }
  }
}

// ── Self-check mode ───────────────────────────────────────────────────────────

function runSelfCheck() {
  console.log('Running self-check tests...\n');
  const tmpDir = resolve(ROOT, '.check-public-export-selftest');

  try {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
      try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
      } catch (err) {
        console.error(`  ✗ ${name}: ${err.message}`);
        failed++;
      }
    }

    function assert(condition, msg) {
      if (!condition) throw new Error(msg);
    }

    // Test 1: Private key detected
    test('detects RSA private key', () => {
      const f = join(tmpDir, 'test.pem');
      writeFileSync(f, '-----BEGIN RSA PRIVATE KEY-----\nMIIEow...\n-----END RSA PRIVATE KEY-----\n');
      const v = [];
      const orig = PRIVATE_KEY_PATTERNS;
      const content = readFileSync(f, 'utf8');
      for (const p of PRIVATE_KEY_PATTERNS) {
        if (p.test(content)) v.push(p.source);
      }
      rmSync(f);
      assert(v.length > 0, 'Expected private key violation — none found');
    });

    // Test 2: Private key in EC format
    test('detects EC private key', () => {
      const content = '-----BEGIN EC PRIVATE KEY-----\ndata\n-----END EC PRIVATE KEY-----';
      const found = PRIVATE_KEY_PATTERNS.some((p) => p.test(content));
      assert(found, 'Expected EC private key to be detected');
    });

    // Test 3: Invalid example license is allowed
    test('allows invalid example license file', () => {
      const f = join(tmpDir, 'examples', 'licenses', 'test.invalid.json');
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, JSON.stringify({
        invalid_example: true,
        license_id: 'lic_example_invalid_test',
        signature: 'INVALID-EXAMPLE-SIGNATURE-DO-NOT-USE',
      }));
      const content = readFileSync(f, 'utf8');
      const result = isRealLicenseFile(f, content);
      rmSync(f);
      assert(!result, 'Invalid example license should not trigger real-license check');
    });

    // Test 4: Real license file detected (outside examples)
    test('detects real license file outside examples/', () => {
      const f = join(tmpDir, 'some-license.json');
      writeFileSync(f, JSON.stringify({
        license_id: 'lic_prod_customer_001',
        signature: 'realSignatureData',
      }));
      const content = readFileSync(f, 'utf8');
      const result = isRealLicenseFile(f, content);
      rmSync(f);
      assert(result, 'Real license file should be detected');
    });

    // Test 5: Private schema migration table detected
    test('detects private schema table in SQL', () => {
      const sqlContent = 'CREATE TABLE IF NOT EXISTS license_activation (id uuid PRIMARY KEY);';
      const found = PRIVATE_SCHEMA_PATTERNS.some(({ pattern }) => pattern.test(sqlContent));
      assert(found, 'Expected license_activation to be detected');
    });

    // Test 6: Public entitlement table NOT blocked
    test('does not block public entitlement tables', () => {
      const sqlContent = 'CREATE TABLE commercial_plans (id uuid PRIMARY KEY, name text);';
      const found = PRIVATE_SCHEMA_PATTERNS.some(({ pattern }) => pattern.test(sqlContent));
      assert(!found, 'commercial_plans should not be blocked');
    });

    // Test 7: Denylist extension detected
    test('detects .pem file via extension denylist', () => {
      const f = join(tmpDir, 'server.pem');
      writeFileSync(f, 'cert data');
      const ext = extname(f).toLowerCase();
      const denied = DENYLIST_EXTENSIONS.has(ext);
      rmSync(f);
      assert(denied, '.pem should be in denylist extensions');
    });

    // Test 8: Denylist path segment detected
    test('detects commercial-private path segment', () => {
      const rel = 'apps/api/src/modules/commercial-private/billing.ts';
      const found = DENYLIST_PATH_PATTERNS.some((p) => p.test(rel));
      assert(found, 'commercial-private path should be denylist-matched');
    });

    console.log(`\nSelf-check: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  } finally {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (SELF_CHECK) {
  runSelfCheck();
  process.exit(0);
}

if (!existsSync(SCAN_DIR)) {
  console.error(`\nScan target does not exist: ${SCAN_DIR}`);
  console.error('Run `pnpm export:public-core` first, or pass --repo to scan the working tree.\n');
  process.exit(1);
}

console.log(`\nPublic export validation`);
console.log(`  Scanning: ${SCAN_DIR}\n`);

scanDir(SCAN_DIR);

if (violations.length > 0) {
  console.error(`\nValidation FAILED — ${violations.length} violation(s) found.\n`);
  console.error('Fix all violations before publishing to the public repo.');
  console.error('See docs/repo-split/public-core-denylist.md for policy details.\n');
  process.exit(1);
}

console.log(`\nValidation passed — no violations found in ${SCAN_DIR}\n`);
