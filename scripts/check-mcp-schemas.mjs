#!/usr/bin/env node
/**
 * MCP inputSchema structural equality check.
 *
 * Verifies that every MCP tool's inputSchema is structurally aligned with the
 * generated schema from @managecallai/contracts/mcp-schemas. Specifically checks
 * that the `properties` keys and `required` arrays match.
 *
 * Exit 0 = all tools pass. Non-zero = drift detected or import error.
 *
 * Usage: node scripts/check-mcp-schemas.mjs
 */

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Build contracts first to make sure the generated schemas are current.
try {
  execSync('pnpm --filter @managecallai/contracts build', { cwd: ROOT, stdio: 'inherit' });
} catch {
  console.error('Failed to build @managecallai/contracts');
  process.exit(1);
}

// Dynamic import so we get the freshly-built output.
const { mcpToolInputSchemas } = await import('@managecallai/contracts').catch((err) => {
  console.error('Failed to import @managecallai/contracts:', err.message);
  process.exit(1);
});

// Run the MCP test suite to catch handler errors as well.
try {
  execSync('pnpm --filter @managecallai/mcp test', {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, MANAGECALL_API_KEY: 'ci-test-key', MANAGECALL_API_URL: 'http://localhost:9999' },
  });
} catch {
  console.error('MCP test suite failed.');
  process.exit(1);
}

// ── Structural comparison helpers ─────────────────────────────────────────────

function sortedKeys(obj) {
  return Object.keys(obj ?? {}).sort();
}

function sortedArray(arr) {
  return [...(arr ?? [])].sort();
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/**
 * Compare the `properties` keys and `required` arrays of two JSON Schema objects.
 * Returns a list of human-readable failure strings, or an empty array if they match.
 */
function compareSchemas(toolName, toolSchema, contractSchema) {
  const failures = [];

  const toolProps = sortedKeys(toolSchema?.properties);
  const contractProps = sortedKeys(contractSchema?.properties);

  if (!arraysEqual(toolProps, contractProps)) {
    failures.push(
      `[${toolName}] properties mismatch:\n` +
      `  tool:     ${JSON.stringify(toolProps)}\n` +
      `  contract: ${JSON.stringify(contractProps)}`,
    );
  }

  const toolRequired = sortedArray(toolSchema?.required ?? []);
  const contractRequired = sortedArray(contractSchema?.required ?? []);

  if (!arraysEqual(toolRequired, contractRequired)) {
    failures.push(
      `[${toolName}] required mismatch:\n` +
      `  tool:     ${JSON.stringify(toolRequired)}\n` +
      `  contract: ${JSON.stringify(contractRequired)}`,
    );
  }

  return failures;
}

// ── Load MCP tool definitions ─────────────────────────────────────────────────
// We import the compiled MCP tools directly to inspect their inputSchema values.

const mcpPkg = resolve(ROOT, 'apps/mcp/dist');
const toUrl = (p) => pathToFileURL(p).href;

const loadMcpTools = async () => {
  const [{ IVR_FLOW_TOOLS }, { APPROVAL_TOOLS }, { RUNTIME_TOOLS }, { PROMPT_TOOLS }, { SCHEDULE_TOOLS }] =
    await Promise.all([
      import(toUrl(resolve(mcpPkg, 'tools/ivr-flows.js'))),
      import(toUrl(resolve(mcpPkg, 'tools/approvals.js'))),
      import(toUrl(resolve(mcpPkg, 'tools/runtime.js'))),
      import(toUrl(resolve(mcpPkg, 'tools/prompts.js'))),
      import(toUrl(resolve(mcpPkg, 'tools/schedules.js'))),
    ]);
  return [...IVR_FLOW_TOOLS, ...APPROVAL_TOOLS, ...RUNTIME_TOOLS, ...PROMPT_TOOLS, ...SCHEDULE_TOOLS];
};

let allTools;
try {
  allTools = await loadMcpTools();
} catch {
  try {
    execSync('pnpm --filter @managecallai/mcp build', { cwd: ROOT, stdio: 'inherit' });
    allTools = await loadMcpTools();
  } catch (buildErr) {
    console.error('Failed to load MCP tools:', buildErr.message);
    process.exit(1);
  }
}

// ── Run comparison ────────────────────────────────────────────────────────────
const failures = [];

for (const tool of allTools) {
  const contractSchema = mcpToolInputSchemas[tool.name];
  if (!contractSchema) {
    failures.push(`[${tool.name}] no entry in mcpToolInputSchemas — add it to packages/contracts/src/mcp-schemas.ts`);
    continue;
  }
  failures.push(...compareSchemas(tool.name, tool.inputSchema, contractSchema));
}

// Warn about contract schemas that have no corresponding tool (not a failure, just informational).
const toolNames = new Set(allTools.map((t) => t.name));
for (const contractName of Object.keys(mcpToolInputSchemas)) {
  if (!toolNames.has(contractName)) {
    console.log(`  info  Contract schema '${contractName}' has no matching MCP tool (may be supplementary)`);
  }
}

if (failures.length > 0) {
  console.error(`\nMCP schema drift check FAILED (${failures.length} issue(s)):\n`);
  for (const f of failures) console.error(`  ✗  ${f}\n`);
  process.exit(1);
} else {
  console.log(`\nMCP schema drift check PASSED — ${allTools.length} tools verified against contracts`);
  process.exit(0);
}
