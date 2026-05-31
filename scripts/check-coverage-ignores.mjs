import { existsSync, readFileSync } from 'node:fs';
import { extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const exceptionFile = new URL('../docs/development/coverage-ignore-exceptions.md', import.meta.url);

const forbiddenPathPatterns = [
  /apps\/api\/src\/modules\/auth\//,
  /apps\/api\/src\/modules\/security\//,
  /apps\/api\/src\/modules\/runtime\//,
  /apps\/api\/src\/modules\/freeswitch\//,
  /apps\/api\/src\/modules\/ivr-flows\//,
  /apps\/api\/src\/modules\/webhooks\//,
  /apps\/api\/src\/modules\/idempotency\//,
  /apps\/mcp\/src\//,
  /apps\/freeswitch-agent\/internal\/(dispatcher|esl|events|forwarder)\//,
];

const ignorePattern = /\b(?:c8|v8|istanbul)\s+ignore\b|coverage\s+ignore/i;
const scannedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.go']);

const exceptionText = existsSync(exceptionFile) ? readFileSync(exceptionFile, 'utf8') : '';
const trackedFiles = execFileSync('git', ['ls-files'], { cwd: repoRoot, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((file) => scannedExtensions.has(extname(file)))
  .filter((file) => !file.includes('/generated/') && !file.endsWith('.d.ts'));

const failures = [];

for (const file of trackedFiles) {
  const normalized = file.replace(/\\/g, '/');
  const text = readFileSync(new URL(`../${normalized}`, import.meta.url), 'utf8');
  const isForbidden = forbiddenPathPatterns.some((pattern) => pattern.test(normalized));

  text.split(/\r?\n/).forEach((line, index) => {
    if (!ignorePattern.test(line)) return;
    const location = `${normalized}:${index + 1}`;
    const documented = exceptionText.includes(location) || exceptionText.includes(normalized);
    if (isForbidden || !documented) {
      failures.push(`${location} ${isForbidden ? 'is in a critical safety path' : 'is not documented'}`);
    }
  });
}

if (failures.length > 0) {
  console.error('Coverage ignore governance check FAILED');
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  console.error(`Document justified exceptions in ${relative(repoRoot, fileURLToPath(exceptionFile))}.`);
  process.exit(1);
}

console.log('Coverage ignore governance check PASSED');
