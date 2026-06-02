#!/usr/bin/env node
/**
 * MCP server smoke test — closes issue #158.
 *
 * Spawns the built MCP server via stdio, runs the MCP JSON-RPC protocol
 * handshake, lists all tools, verifies the capability matrix, and optionally
 * makes a live read tool call if MANAGECALL_API_URL + MANAGECALL_API_KEY are set.
 *
 * Usage:
 *   node scripts/mcp-smoke.mjs [--evidence-dir=artifacts/mcp-smoke]
 *
 * Required: apps/mcp must be built first (pnpm --filter @managecallai/mcp build).
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dir, '..');

const args = process.argv.slice(2);
const evidenceDirArg = args.find((a) => a.startsWith('--evidence-dir='));
const evidenceDir = evidenceDirArg ? evidenceDirArg.split('=')[1] : 'artifacts/mcp-smoke';
const evidenceDirAbs = resolve(repoRoot, evidenceDir);

// Authoritative tool list from apps/mcp/src/tools/ — verified against the running server.
const EXPECTED_TOOLS = [
  'list_ivr_flows',
  'get_ivr_flow',
  'create_ivr_flow',
  'update_flow_definition',
  'validate_flow',
  'simulate_flow',
  'request_publish',
  'run_simulation_suite',
  'list_approvals',
  'get_approval',
  'decide_approval',
  'list_prompts',
  'get_prompt',
  'list_sessions',
  'get_session',
  'list_schedules',
  'list_recordings',
  'get_recording',
  'list_recording_analyses',
  'get_recording_analysis',
  'export_call_events',
  'export_sessions',
];

const MCP_ENTRY = resolve(repoRoot, 'apps/mcp/dist/index.js');

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

// ── JSON-RPC over stdio helpers ───────────────────────────────────────────────

function send(proc, msg) {
  const line = JSON.stringify(msg) + '\n';
  proc.stdin.write(line);
}

async function readResponse(proc, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for MCP response (${timeoutMs}ms)`));
    }, timeoutMs);

    function onData(chunk) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          clearTimeout(timer);
          proc.stdout.off('data', onData);
          proc.stderr.off('data', onStderr);
          resolve(parsed);
          return;
        } catch {
          // not JSON yet, keep buffering
        }
      }
    }

    function onStderr(chunk) {
      // MCP server writes startup logs to stderr — ignore unless it errors
      const s = chunk.toString();
      if (s.includes('is required') || s.includes('fatal')) {
        clearTimeout(timer);
        reject(new Error(`MCP server stderr: ${s.trim()}`));
      }
    }

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onStderr);
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

if (!existsSync(MCP_ENTRY)) {
  fail(`MCP server not built: ${MCP_ENTRY} does not exist. Run: pnpm --filter @managecallai/mcp build`);
}

const apiBase = process.env.MANAGECALL_API_URL ?? 'http://localhost:3000';
const apiKey = process.env.MANAGECALL_API_KEY ?? 'smoke_placeholder_key';
const liveApi = apiKey !== 'smoke_placeholder_key' && apiKey.length > 0;

console.log(`MCP smoke — entry: ${MCP_ENTRY}`);
console.log(`API base: ${apiBase}  live-call: ${liveApi ? 'yes' : 'no (tool listing only)'}`);

const proc = spawn('node', [MCP_ENTRY], {
  env: {
    ...process.env,
    MANAGECALL_API_URL: apiBase,
    MANAGECALL_API_KEY: apiKey,
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

proc.on('error', (err) => fail(`Failed to spawn MCP server: ${err.message}`));

let toolNames = [];
let toolCallResult = null;
let toolCallError = null;

try {
  // ── 1. Initialize ─────────────────────────────────────────────────────────
  send(proc, {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'managecallai-mcp-smoke', version: '1.0' },
    },
    id: 1,
  });

  const initResp = await readResponse(proc);
  if (initResp.error) fail(`MCP initialize error: ${JSON.stringify(initResp.error)}`);
  if (!initResp.result?.capabilities) fail('MCP initialize returned no capabilities');
  console.log(`  initialized — server: ${JSON.stringify(initResp.result?.serverInfo ?? {})}`);

  // Notify server that initialization is complete
  send(proc, { jsonrpc: '2.0', method: 'initialized', params: {} });

  // ── 2. List tools ─────────────────────────────────────────────────────────
  send(proc, { jsonrpc: '2.0', method: 'tools/list', params: {}, id: 2 });

  const listResp = await readResponse(proc);
  if (listResp.error) fail(`tools/list error: ${JSON.stringify(listResp.error)}`);
  const tools = listResp.result?.tools ?? [];
  toolNames = tools.map((t) => t.name);

  console.log(`  tools returned: ${toolNames.length}`);
  console.log(`  tool names: ${toolNames.join(', ')}`);

  // ── 3. Verify capability matrix ───────────────────────────────────────────
  const missing = EXPECTED_TOOLS.filter((t) => !toolNames.includes(t));
  const extra = toolNames.filter((t) => !EXPECTED_TOOLS.includes(t));

  if (missing.length > 0) fail(`Missing expected tools: ${missing.join(', ')}`);
  if (extra.length > 0) console.warn(`  WARN: extra tools not in matrix: ${extra.join(', ')}`);

  console.log(`  capability matrix: ${EXPECTED_TOOLS.length} tools verified`);

  // ── 4. Live tool call (if live API configured) ────────────────────────────
  if (liveApi) {
    console.log('  making live tool call: list_ivr_flows');
    send(proc, {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'list_ivr_flows', arguments: {} },
      id: 3,
    });

    const callResp = await readResponse(proc, 30_000);
    if (callResp.error) {
      toolCallError = callResp.error;
      console.warn(`  WARN: live tool call returned error: ${JSON.stringify(callResp.error)}`);
    } else {
      const content = callResp.result?.content ?? [];
      toolCallResult = content[0]?.text ?? JSON.stringify(callResp.result);
      console.log(`  live tool call succeeded — result length: ${(toolCallResult ?? '').length} chars`);
    }
  }
} finally {
  proc.stdin.end();
  proc.kill('SIGTERM');
}

// ── 5. Write evidence ─────────────────────────────────────────────────────────
mkdirSync(evidenceDirAbs, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, '-');
const evidenceFile = resolve(evidenceDirAbs, `mcp-smoke-${ts}.json`);

const evidence = {
  smoke_type: 'mcp',
  generated_at: new Date().toISOString(),
  github_sha: process.env.GITHUB_SHA ?? 'local',
  mcp_entry: MCP_ENTRY,
  api_base: apiBase,
  live_api_configured: liveApi,
  tools_returned: toolNames.length,
  expected_tools: EXPECTED_TOOLS.length,
  tool_names: toolNames,
  capability_matrix_verified: true,
  missing_tools: [],
  live_tool_call: liveApi
    ? {
        tool: 'list_ivr_flows',
        success: toolCallError === null,
        error: toolCallError,
        result_length: (toolCallResult ?? '').length,
      }
    : null,
  verdict: 'PASSED',
};

writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2));
console.log(`\nMCP smoke PASSED — evidence: ${evidenceFile}`);
