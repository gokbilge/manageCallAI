#!/usr/bin/env node
/**
 * Verifies the OpenAPI spec aligns with the RPC error standard.
 *
 * Checks:
 *  1. Every operation has a `default` response entry.
 *  2. The ErrorResponse schema has the required fields: error, message, request_id.
 *  3. The `error` field enum contains all expected RPC codes.
 *
 * Exit code 0 = all checks pass. Non-zero = failures found.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const specPath = join(__dir, '..', 'docs', 'api', 'openapi.yaml');
const raw = readFileSync(specPath, 'utf8');
const lines = raw.split('\n');

const failures = [];

// ── Build a line index of all top-level path blocks and their operations ─────
// OpenAPI structure (2-space indent for paths, 4-space for methods):
//   /some/path:
//     get:
//       ...
//       responses:
//         '200': ...
//         default: ...

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

// Collect [lineIndex, path, method] for every operation
const operations = [];
let currentPath = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Path block: exactly 2-space indent + / (OpenAPI paths section)
  const pathMatch = line.match(/^  (\/[^\s:]+):\s*$/);
  if (pathMatch) {
    currentPath = pathMatch[1];
    continue;
  }

  // HTTP method block: exactly 4-space indent + method:
  if (currentPath) {
    const methodMatch = line.match(/^    (get|post|put|patch|delete|head|options):\s*$/);
    if (methodMatch && HTTP_METHODS.has(methodMatch[1])) {
      operations.push({ lineIdx: i, path: currentPath, method: methodMatch[1] });
    }
  }

  // Reset current path if we hit a top-level non-path key (components:, etc.)
  if (/^[a-zA-Z]/.test(line)) {
    currentPath = null;
  }
}

console.log(`Found ${operations.length} operations in ${specPath}\n`);

// ── Check each operation for `default:` in its responses block ───────────────

for (const { lineIdx, path, method } of operations) {
  // Find the responses: line within this operation block
  // Operation ends when we hit another 4-space method or a 2-space path/key
  let foundDefault = false;
  let inResponses = false;

  for (let j = lineIdx + 1; j < lines.length; j++) {
    const l = lines[j];

    // End of operation: next 4-space method, 2-space path, or top-level key
    if (/^    [a-z]/.test(l) && !/^    {/.test(l)) {
      // Could be next method — check if it's an HTTP method
      const nextMethod = l.match(/^    (get|post|put|patch|delete|head|options):\s*$/);
      if (nextMethod) break;
    }
    if (/^  \//.test(l) || /^[a-zA-Z]/.test(l)) break;

    if (/^      responses:\s*$/.test(l)) {
      inResponses = true;
    }

    if (inResponses && /^\s+default\s*:/.test(l)) {
      foundDefault = true;
      break;
    }
  }

  if (!foundDefault) {
    failures.push(`MISSING default response: ${method.toUpperCase()} ${path}`);
  }
}

// ── Check ErrorResponse schema ────────────────────────────────────────────────

// Find the `schemas:` section, then the `ErrorResponse:` block within it
const schemasIdx = lines.findIndex((l) => /^  schemas:\s*$/.test(l));
if (schemasIdx === -1) {
  failures.push('components.schemas section not found in OpenAPI spec');
} else {
  // Find ErrorResponse inside schemas
  let errorSchemaStart = -1;
  for (let i = schemasIdx + 1; i < lines.length; i++) {
    if (/^    ErrorResponse:\s*$/.test(lines[i])) {
      errorSchemaStart = i;
      break;
    }
    // Stop if we hit another top-level section
    if (/^  [a-zA-Z]/.test(lines[i]) && !/^    /.test(lines[i])) break;
  }

  if (errorSchemaStart === -1) {
    failures.push('ErrorResponse not found in components.schemas');
  } else {
    // Collect the schema block until next 4-space schema or 2-space section
    let schemaBlock = '';
    for (let i = errorSchemaStart + 1; i < lines.length; i++) {
      const l = lines[i];
      if (/^    [A-Z]/.test(l) || /^  [a-zA-Z]/.test(l)) break;
      schemaBlock += l + '\n';
    }

    // Check required fields
    const requiredLine = schemaBlock.match(/required:\s*\[([^\]]+)\]/);
    if (!requiredLine) {
      failures.push('ErrorResponse schema has no required: list');
    } else {
      const declared = requiredLine[1].split(',').map((s) => s.trim());
      for (const f of ['error', 'message', 'request_id']) {
        if (!declared.includes(f)) {
          failures.push(`ErrorResponse required list missing: ${f}`);
        }
      }
    }

    for (const prop of ['error:', 'message:', 'request_id:']) {
      if (!schemaBlock.includes(prop)) {
        failures.push(`ErrorResponse schema missing property: ${prop.replace(':', '')}`);
      }
    }

    // Check RPC code enum
    const expectedCodes = [
      'NOT_FOUND', 'INVALID_ARGUMENT', 'UNAUTHENTICATED', 'PERMISSION_DENIED',
      'ALREADY_EXISTS', 'RESOURCE_EXHAUSTED', 'INTERNAL', 'UNAVAILABLE',
    ];
    for (const code of expectedCodes) {
      if (!schemaBlock.includes(code)) {
        failures.push(`ErrorResponse error enum missing code: ${code}`);
      }
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

if (failures.length > 0) {
  console.error(`OpenAPI coverage check FAILED (${failures.length} issue(s)):\n`);
  for (const f of failures) console.error(`  x  ${f}`);
  process.exit(1);
} else {
  console.log(`OpenAPI coverage check PASSED`);
  console.log(`  ok  All ${operations.length} operations have a default error response`);
  console.log(`  ok  ErrorResponse schema has required fields and RPC error enum`);
  process.exit(0);
}
