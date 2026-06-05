#!/usr/bin/env bash
# External installation smoke test for manageCallAI.
#
# Simulates a clean external user pulling public GHCR images and running
# docker compose up. Run this after making GHCR packages public.
#
# Usage:
#   MANAGECALLAI_VERSION=v0.6.0 ./scripts/external-install-smoke.sh
#
# Requirements: Docker Engine, Docker Compose v2, curl

set -euo pipefail

VERSION="${MANAGECALLAI_VERSION:-v0.6.0}"
TEST_PORT="${TEST_PORT:-13001}"
GHCR_NS="ghcr.io/gokbilge"
COMPOSE_FILE="$(dirname "$0")/../docker-compose.prod.yml"
ENV_FILE="$(mktemp)"
COMPOSE_PROJECT="managecallai_smoke_$$"

cleanup() {
  echo "--- teardown ---"
  COMPOSE_PROJECT="$COMPOSE_PROJECT" docker compose \
    -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
    down -v --remove-orphans 2>/dev/null || true
  rm -f "$ENV_FILE"
}
trap cleanup EXIT

# ------------------------------------------------------------------
# 1. Check public image is pullable (key distribution check)
# ------------------------------------------------------------------
echo "=== 1. Verifying GHCR image is publicly pullable ==="
if ! docker pull "$GHCR_NS/managecallai-api:$VERSION" > /dev/null 2>&1; then
  echo "FAIL: Cannot pull $GHCR_NS/managecallai-api:$VERSION"
  echo "      Make GHCR packages public: GitHub → Profile → Packages → Change visibility"
  exit 1
fi
echo "PASS: image pull succeeded"

# ------------------------------------------------------------------
# 2. Write minimal .env for smoke (wizard mode — no SETUP_* vars)
# ------------------------------------------------------------------
cat > "$ENV_FILE" << EOF
POSTGRES_PASSWORD=smoke_pw_$(openssl rand -hex 8)
POSTGRES_DB=managecallai_smoke
POSTGRES_USER=managecallai
MANAGECALLAI_IMAGE_TAG=$VERSION
JWT_SECRET=$(openssl rand -hex 32)
RUNTIME_API_TOKEN=$(openssl rand -hex 32)
SIP_SECRET_MASTER_KEY=$(openssl rand -hex 32)
SIP_SECRET_KEY_ID=smoke-v1
FREESWITCH_ESL_PASSWORD=smoke$(openssl rand -hex 8)
API_PORT=$TEST_PORT
EOF

# ------------------------------------------------------------------
# 3. Start postgres + api
# ------------------------------------------------------------------
echo "=== 2. Starting postgres and api ==="
COMPOSE_PROJECT="$COMPOSE_PROJECT" docker compose \
  -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
  up -d postgres api

# ------------------------------------------------------------------
# 4. Wait for /health
# ------------------------------------------------------------------
echo "=== 3. Waiting for API health ==="
for i in $(seq 1 20); do
  if curl -sf "http://localhost:$TEST_PORT/health" > /dev/null 2>&1; then
    break
  fi
  sleep 2
done

HEALTH=$(curl -sf "http://localhost:$TEST_PORT/health" 2>/dev/null || echo '{"status":"unreachable"}')
echo "Health response: $HEALTH"

if echo "$HEALTH" | grep -q '"status":"ok"'; then
  echo "PASS: /health returned ok"
else
  echo "FAIL: /health did not return ok"
  exit 1
fi

# ------------------------------------------------------------------
# 5. Verify /setup is reachable (wizard mode)
# ------------------------------------------------------------------
SETUP_STATUS=$(curl -o /dev/null -w "%{http_code}" -sf "http://localhost:$TEST_PORT/setup" 2>/dev/null || echo "000")
if [ "$SETUP_STATUS" = "200" ]; then
  echo "PASS: /setup returned 200"
else
  echo "FAIL: /setup returned $SETUP_STATUS (expected 200)"
  exit 1
fi

# ------------------------------------------------------------------
# 6. Report
# ------------------------------------------------------------------
echo ""
echo "========================================"
echo "External install smoke: PASSED"
echo "Version: $VERSION"
echo "Image: $GHCR_NS/managecallai-api:$VERSION"
echo "Health: ok"
echo "Setup wizard: reachable"
echo "========================================"
