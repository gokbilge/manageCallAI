#!/usr/bin/env bash
# local-runtime-release-gate.sh
#
# Runs the full FreeSWITCH/SIP/IVR release gate locally.
#
# Usage:
#   ./scripts/local-runtime-release-gate.sh
#   CLEANUP=true ./scripts/local-runtime-release-gate.sh
#
# Required environment (set in .env or export before running):
#   DATABASE_URL
#   JWT_SECRET
#   RUNTIME_API_TOKEN
#   SIP_SECRET_MASTER_KEY
#   SIP_SECRET_KEY_ID
#
# Optional environment:
#   FREESWITCH_ESL_PASSWORD  (defaults to ClueCon — not for production)
#   API_BASE_URL             (defaults to http://localhost:3000)
#   CLEANUP                  (set to "true" to tear down the stack after the gate)
#
# Ports used by the freeswitch profile:
#   5060/udp  SIP signaling (external)
#   5080/tcp  SIP signaling (internal)
#   5080/udp  SIP signaling (internal)
#   8021/tcp  FreeSWITCH ESL
#   3000/tcp  API
#   5432/tcp  PostgreSQL
#
# Evidence output:
#   artifacts/production-e2e/production-runtime-e2e-*.json
#
# See docs/deployment/local-alpha.md for full documentation.

set -euo pipefail

GATE_START=$(date +%s)
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
EVIDENCE_DIR="artifacts/production-e2e"
REDACT="node scripts/redact-logs.mjs"

echo "=== manageCallAI local runtime release gate ==="
echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "API:     ${API_BASE_URL}"
echo ""

# ── 1. Required environment checks ───────────────────────────────────────────

check_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "ERROR: ${name} is required but not set." >&2
    echo "  Copy .env.example to .env, fill in non-sample values, then:" >&2
    echo "  set -a && source .env && set +a" >&2
    exit 1
  fi
}

for var in DATABASE_URL JWT_SECRET RUNTIME_API_TOKEN SIP_SECRET_MASTER_KEY SIP_SECRET_KEY_ID; do
  check_var "$var"
done

if [[ -z "${FREESWITCH_ESL_PASSWORD:-}" ]]; then
  echo "WARN: FREESWITCH_ESL_PASSWORD not set — using vendor default (not for production)"
  export FREESWITCH_ESL_PASSWORD=ClueCon
fi

echo "ok: environment variables present"

# ── 2. Pre-flight checks ──────────────────────────────────────────────────────

for cmd in node pnpm docker go; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: $cmd is required but not found in PATH" >&2
    exit 1
  fi
done
echo "ok: required tools present (node, pnpm, docker, go)"

# ── 3. Install and build ──────────────────────────────────────────────────────

echo ""
echo "--- Installing dependencies ---"
pnpm install --frozen-lockfile 2>&1 | $REDACT

echo ""
echo "--- Building ---"
pnpm build 2>&1 | $REDACT

echo ""
echo "--- Linting ---"
pnpm lint 2>&1 | $REDACT

echo ""
echo "--- Unit tests ---"
pnpm test 2>&1 | $REDACT

# ── 4. Start the runtime stack ────────────────────────────────────────────────

echo ""
echo "--- Starting runtime stack (postgres + api + freeswitch + freeswitch-agent) ---"
docker compose --profile freeswitch up -d --build 2>&1 | $REDACT

# Apply migrations to the compose stack database
echo ""
echo "--- Applying migrations ---"
pnpm db:migrate 2>&1

# ── 5. Wait for API health ────────────────────────────────────────────────────

echo ""
echo "--- Waiting for API health at ${API_BASE_URL}/health ---"
for i in $(seq 1 30); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE_URL}/health" 2>/dev/null || echo "000")
  if [[ "$STATUS" == "200" ]]; then
    echo "ok: API healthy after ${i} attempts"
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "ERROR: API did not become healthy within 30 attempts" >&2
    exit 1
  fi
  echo "  attempt ${i}/30 — status ${STATUS}, retrying in 5s..."
  sleep 5
done

# ── 6. DB contracts and constraints ──────────────────────────────────────────

echo ""
echo "--- DB contracts and constraints ---"
pnpm db:contracts 2>&1
pnpm db:constraints 2>&1

# ── 7. FreeSWITCH profile check ───────────────────────────────────────────────

echo ""
echo "--- FreeSWITCH profile (ESL connectivity) ---"
node scripts/check-freeswitch-profile.mjs 2>&1 | $REDACT

# ── 8. Production runtime E2E ─────────────────────────────────────────────────

echo ""
echo "--- Production runtime E2E ---"
export PRODUCTION_E2E_ARTIFACT_DIR="${EVIDENCE_DIR}"
pnpm production:e2e 2>&1 | $REDACT

# ── 9. SIP REGISTER smoke ─────────────────────────────────────────────────────

echo ""
echo "--- SIP REGISTER smoke ---"
node scripts/sip-register-smoke.mjs 2>&1 | $REDACT

# ── 10. Go agent ESL connection smoke ─────────────────────────────────────────

echo ""
echo "--- Go agent ESL smoke ---"
(cd apps/freeswitch-agent && go run . --smoke-check) 2>&1 | $REDACT

# ── 11. Validate evidence artifact ───────────────────────────────────────────

echo ""
echo "--- Validating evidence artifact ---"
node scripts/check-runtime-e2e-evidence.mjs --dir="${EVIDENCE_DIR}"

# ── 12. Summary ───────────────────────────────────────────────────────────────

GATE_END=$(date +%s)
DURATION=$(( GATE_END - GATE_START ))
echo ""
echo "=== GATE PASSED in ${DURATION}s ==="
echo "Evidence: ${EVIDENCE_DIR}/"
echo ""
echo "To clean up the runtime stack:"
echo "  pnpm runtime:down"
echo ""

if [[ "${CLEANUP:-}" == "true" ]]; then
  echo "--- Cleaning up (CLEANUP=true) ---"
  docker compose --profile freeswitch down -v 2>&1
fi
