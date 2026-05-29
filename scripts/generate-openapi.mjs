#!/usr/bin/env node
/**
 * Generates docs/api/openapi.yaml from the @managecallai/contracts Zod schemas.
 *
 * Strategy (hybrid):
 *   - Component schemas: generated from Zod via @asteasolutions/zod-to-openapi
 *   - Path definitions:  read from the existing openapi.yaml (kept as source of truth
 *                        for paths until they are migrated to code)
 *
 * Path $ref renames:
 *   The path YAML was written with legacy naming conventions (XxxRequest, AuthResponse, …).
 *   PATH_REF_RENAMES maps each legacy name to the Zod-registered component name so the
 *   generator can rewrite all $refs in the paths tree before emitting the spec.
 *   Remove an entry once the source YAML is updated to use the canonical name.
 *
 * Run:
 *   node scripts/generate-openapi.mjs
 *
 * Requires:
 *   pnpm --filter @managecallai/contracts build   (before first run)
 *   yaml (root devDependency)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, stringify } from 'yaml';

// Importing contracts triggers the register.ts side-effect, populating the registry.
// OpenApiGeneratorV31 is re-exported from contracts to avoid a direct dep on @asteasolutions here.
import { registry, OpenApiGeneratorV31 } from '@managecallai/contracts';

const __dir = dirname(fileURLToPath(import.meta.url));
const specPath = join(__dir, '..', 'docs', 'api', 'openapi.yaml');

// ── 1. Read existing spec for paths, servers, tags, security ──────────────────
const existing = parse(readFileSync(specPath, 'utf8'));

// ── 2. Generate components from Zod registry ──────────────────────────────────
const description = [
  'REST API for the manageCallAI telecom control plane.',
  '',
  'Only implemented or intentionally exposed contract endpoints are documented here.',
  'Some foundational endpoints are early-availability but ready for integration testing.',
  'Runtime/internal endpoints are explicitly marked and require runtime-token authentication',
  '(`Authorization: Bearer <RUNTIME_API_TOKEN>` or `x-managecallai-runtime-token: <token>`).',
  '',
  '## Error responses',
  '',
  'All errors follow the RPC error standard:',
  '',
  '```json',
  '{ "error": "FAILED_PRECONDITION", "message": "Session is not running: completed", "request_id": "req-abc123" }',
  '```',
  '',
  'Clients must branch on `error` (machine-readable), never on `message` (may change).',
  '`request_id` is stable and matches the `x-request-id` response header for log correlation.',
  '',
  '| Code | HTTP | Meaning |',
  '|------|------|---------|',
  '| `NOT_FOUND` | 404 | Resource does not exist |',
  '| `INVALID_ARGUMENT` | 400 | Malformed request or validation failure |',
  '| `UNAUTHENTICATED` | 401 | Missing or invalid credential |',
  '| `PERMISSION_DENIED` | 403 | Credential valid but lacks permission |',
  '| `ALREADY_EXISTS` | 409 | Duplicate resource / unique-constraint violation |',
  '| `CONFLICT` | 409 | Generic conflict with no more precise cause |',
  '| `FAILED_PRECONDITION` | 409 | Resource exists but is in the wrong state for the action |',
  '| `RESOURCE_EXHAUSTED` | 429 | Rate limit exceeded |',
  '| `INTERNAL` | 500 | Unexpected server error |',
  '| `UNAVAILABLE` | 503 | Service temporarily unavailable |',
].join('\n');

const generator = new OpenApiGeneratorV31(registry.definitions);
const generated = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'manageCallAI API',
    version: '0.1.0',
    summary: 'Business-level telecom control plane API over FreeSWITCH',
    description,
  },
});

// ── 3. Rename legacy path $refs to canonical Zod component names ──────────────
// The path YAML predates Zod schema registration and uses old naming conventions.
// Keys are legacy names; values are the canonical Zod-generated names.
const PATH_REF_RENAMES = {
  RegisterRequest: 'RegisterBody',
  LoginRequest: 'LoginBody',
  AuthResponse: 'AuthTokenResponse',
  CreateExtensionRequest: 'CreateExtensionBody',
  UpdateExtensionRequest: 'UpdateExtensionBody',
  CreateSipTrunkRequest: 'CreateSipTrunkBody',
  UpdateSipTrunkRequest: 'UpdateSipTrunkBody',
  CreatePhoneNumberRequest: 'CreatePhoneNumberBody',
  UpdatePhoneNumberRequest: 'UpdatePhoneNumberBody',
  CreatePromptAssetRequest: 'CreatePromptAssetBody',
  UpdatePromptAssetRequest: 'UpdatePromptAssetBody',
  CreateQueueRequest: 'CreateQueueBody',
  UpdateQueueRequest: 'UpdateQueueBody',
  AddQueueMemberRequest: 'AddQueueMemberBody',
  CreateVoicemailBoxRequest: 'CreateVoicemailBoxBody',
  UpdateVoicemailBoxRequest: 'UpdateVoicemailBoxBody',
  CreateInboundRouteRequest: 'CreateInboundRouteBody',
  UpdateInboundRouteRequest: 'UpdateInboundRouteBody',
  FlowVersionDraftRequest: 'CreateFlowVersionBody',
  CreateIvrFlowRequest: 'CreateIvrFlowBody',
  UpdateIvrFlowRequest: 'UpdateIvrFlowBody',
  IvrFlowSimulationRequest: 'SimulationScenario',
  StartIvrRuntimeSessionRequest: 'StartIvrRuntimeSessionBody',
  AdvanceIvrRuntimeSessionRequest: 'AdvanceIvrRuntimeSessionBody',
  CreateIvrAiTurnRequest: 'CreateIvrAiTurnBody',
  ClaimIvrAiTurnRequest: 'ClaimWorkRequestBody',
  CompleteIvrAiTurnRequest: 'CompleteIvrAiTurnBody',
  IngestCallEventRequest: 'IngestCallEventBody',
  IngestRecordingRequest: 'IngestRecordingBody',
  CreateRecordingAnalysisRequest: 'CreateRecordingAnalysisBody',
  ClaimRecordingAnalysisRequest: 'ClaimWorkRequestBody',
  CompleteRecordingAnalysisRequest: 'CompleteRecordingAnalysisBody',
  CreateChannelAccountRequest: 'CreateChannelAccountBody',
  CreateOutboundChannelMessageRequest: 'CreateOutboundMessageBody',
  IngestInboundChannelMessageRequest: 'IngestInboundMessageBody',
  CreateChannelVoiceSessionRequest: 'CreateMeetingSessionBody',
  CreatePromptGenerationRequest: 'CreatePromptGenerationBody',
  ClaimPromptGenerationRequest: 'ClaimWorkRequestBody',
  CompletePromptGenerationRequest: 'CompletePromptGenerationBody',
};

function applyRefRenames(node, renames) {
  if (node && typeof node === 'object') {
    if (node.$ref && typeof node.$ref === 'string') {
      const m = node.$ref.match(/^#\/components\/schemas\/(.+)$/);
      if (m && renames[m[1]]) {
        node.$ref = `#/components/schemas/${renames[m[1]]}`;
      }
    }
    for (const v of Object.values(node)) applyRefRenames(v, renames);
  }
}

const paths = JSON.parse(JSON.stringify(existing.paths));
applyRefRenames(paths, PATH_REF_RENAMES);

// ── 4. Verify all path $refs resolve to generated components ──────────────────
const generatedSchemas = generated.components?.schemas ?? {};

function collectRefs(node, refs = new Set()) {
  if (node && typeof node === 'object') {
    if (node.$ref && typeof node.$ref === 'string') {
      const m = node.$ref.match(/^#\/components\/schemas\/(.+)$/);
      if (m) refs.add(m[1]);
    }
    for (const v of Object.values(node)) collectRefs(v, refs);
  }
  return refs;
}

const refsInPaths = collectRefs(paths);
const missingRefs = [];
for (const name of refsInPaths) {
  if (!generatedSchemas[name]) {
    missingRefs.push(name);
  }
}

if (missingRefs.length > 0) {
  console.error(`ERROR: ${missingRefs.length} path $ref(s) unresolved after renames:`);
  for (const ref of missingRefs) console.error(`  - ${ref}`);
  console.error('');
  console.error('To fix: register the schema in packages/contracts/src/schemas/register.ts,');
  console.error('or add a rename entry to PATH_REF_RENAMES in this script.');
  process.exit(1);
}

// ── 5. Assemble and write the spec ────────────────────────────────────────────
const newSpec = {
  openapi: '3.1.0',
  info: existing.info,
  servers: existing.servers,
  tags: existing.tags,
  security: existing.security,
  paths,
  components: {
    ...existing.components,
    schemas: generatedSchemas,
  },
};

const header =
  '# This file is GENERATED by scripts/generate-openapi.mjs\n' +
  '# Do not edit manually — edit packages/contracts/src/schemas/*.ts instead.\n' +
  '# To update: pnpm --filter @managecallai/contracts build && node scripts/generate-openapi.mjs\n\n';

writeFileSync(specPath, header + stringify(newSpec, { lineWidth: 120 }), 'utf8');

console.log(`Generated ${specPath}`);
console.log(`  schemas: ${Object.keys(newSpec.components?.schemas ?? {}).length} components`);
console.log(`  paths:   ${Object.keys(newSpec.paths ?? {}).length} path entries`);
console.log(`  renames applied: ${Object.keys(PATH_REF_RENAMES).length}`);
