#!/usr/bin/env bash
set -euo pipefail

VERSION="${MANAGECALLAI_VERSION:-v0.6.0}"
INSTALL_DIR="${INSTALL_DIR:-/opt/managecallai}"
RAW_BASE="https://raw.githubusercontent.com/gokbilge/manageCallAI/${VERSION}"

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Run install.sh as root." >&2
    exit 1
  fi
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1; then
    return
  fi

  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
}

generate_secret() {
  openssl rand -hex "$1"
}

require_root
ensure_docker

mkdir -p "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

curl -fsSL "${RAW_BASE}/docker-compose.prod.yml" -o docker-compose.prod.yml
curl -fsSL "${RAW_BASE}/.env.production.example" -o .env.production

POSTGRES_PASSWORD="$(generate_secret 16)"
JWT_SECRET="$(generate_secret 32)"
RUNTIME_API_TOKEN="$(generate_secret 32)"
SIP_SECRET_MASTER_KEY="$(generate_secret 32)"
FREESWITCH_ESL_PASSWORD="$(generate_secret 16)"
PUBLIC_IP="$(curl -fsSL https://api.ipify.org 2>/dev/null || echo 127.0.0.1)"

python3 - <<PY
from pathlib import Path

path = Path(".env.production")
content = path.read_text()
replacements = {
    "POSTGRES_PASSWORD=<generate: openssl rand -hex 16>": "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}",
    "DATABASE_URL=postgres://managecallai:<POSTGRES_PASSWORD>@postgres:5432/managecallai": "DATABASE_URL=postgres://managecallai:${POSTGRES_PASSWORD}@postgres:5432/managecallai",
    "JWT_SECRET=<generate>": "JWT_SECRET=${JWT_SECRET}",
    "RUNTIME_API_TOKEN=<generate>": "RUNTIME_API_TOKEN=${RUNTIME_API_TOKEN}",
    "SIP_SECRET_MASTER_KEY=<generate>": "SIP_SECRET_MASTER_KEY=${SIP_SECRET_MASTER_KEY}",
    "FREESWITCH_ESL_PASSWORD=<generate: openssl rand -hex 16>": "FREESWITCH_ESL_PASSWORD=${FREESWITCH_ESL_PASSWORD}",
    "FREESWITCH_EXTERNAL_SIP_IP=<server public ip>": "FREESWITCH_EXTERNAL_SIP_IP=${PUBLIC_IP}",
    "FREESWITCH_EXTERNAL_RTP_IP=<server public ip>": "FREESWITCH_EXTERNAL_RTP_IP=${PUBLIC_IP}",
}
for old, new in replacements.items():
    content = content.replace(old, new)
path.write_text(content)
PY

cat <<EOF

manageCallAI ${VERSION} files installed in ${INSTALL_DIR}

Next steps:
  1. Edit ${INSTALL_DIR}/.env.production
     - SETUP_ADMIN_EMAIL
     - SETUP_ADMIN_PASSWORD
     - PLATFORM_OPERATOR_EMAILS
  2. Start the stack:
     docker compose -f ${INSTALL_DIR}/docker-compose.prod.yml up -d
  3. Open:
     http://${PUBLIC_IP}:3000/setup

Secrets were written to ${INSTALL_DIR}/.env.production.
Back that file up before first boot.
EOF
