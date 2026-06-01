#!/bin/sh
set -eu

FS_CONF_DIR="/usr/local/freeswitch/conf/autoload_configs"
FS_PROFILES_DIR="/usr/local/freeswitch/conf/sip_profiles"
FS_CERTS_DIR="/usr/local/freeswitch/certs"
FS_DIALPLAN_DIR="/usr/local/freeswitch/conf/dialplan"

render_template() {
  template_path="$1"
  output_path="$2"

  sed \
    -e "s|__MANAGECALLAI_DIRECTORY_URL__|${MANAGECALLAI_DIRECTORY_URL}|g" \
    -e "s|__MANAGECALLAI_DIALPLAN_URL__|${MANAGECALLAI_DIALPLAN_URL}|g" \
    -e "s|__RUNTIME_API_TOKEN__|${RUNTIME_API_TOKEN}|g" \
    -e "s|__FREESWITCH_ESL_PASSWORD__|${FREESWITCH_ESL_PASSWORD}|g" \
    "$template_path" > "$output_path"
}

: "${MANAGECALLAI_DIRECTORY_URL:=http://api:3000/api/v1/freeswitch/directory}"
: "${MANAGECALLAI_DIALPLAN_URL:=http://api:3000/api/v1/freeswitch/dialplan}"
: "${RUNTIME_API_TOKEN:=change-me-runtime-token}"
: "${FREESWITCH_ESL_PASSWORD:=ClueCon}"
: "${FREESWITCH_TLS_ENABLED:=false}"
: "${FREESWITCH_EXT_SIP_IP:=}"
: "${FREESWITCH_EXT_RTP_IP:=}"

render_template "${FS_CONF_DIR}/xml_curl.conf.xml.tmpl" "${FS_CONF_DIR}/xml_curl.conf.xml"
render_template "${FS_CONF_DIR}/event_socket.conf.xml.tmpl" "${FS_CONF_DIR}/event_socket.conf.xml"

# ── TLS setup ─────────────────────────────────────────────────────────────────
# When FREESWITCH_TLS_ENABLED=true, generate a self-signed certificate and
# activate the TLS sofia profile. Certificates are ephemeral (regenerated on
# each container start) and suitable for smoke testing only.

if [ "${FREESWITCH_TLS_ENABLED}" = "true" ]; then
  mkdir -p "${FS_CERTS_DIR}"

  if [ ! -f "${FS_CERTS_DIR}/agent.pem" ]; then
    echo "Generating self-signed TLS certificate for FreeSWITCH smoke..."
    openssl req -newkey rsa:2048 -nodes -keyout "${FS_CERTS_DIR}/key.pem" \
      -x509 -days 3650 -out "${FS_CERTS_DIR}/cert.pem" \
      -subj "/CN=freeswitch-smoke/O=manageCallAI/C=US" \
      -addext "subjectAltName=IP:127.0.0.1,DNS:freeswitch,DNS:localhost" 2>/dev/null
    cat "${FS_CERTS_DIR}/cert.pem" "${FS_CERTS_DIR}/key.pem" > "${FS_CERTS_DIR}/agent.pem"
    cp "${FS_CERTS_DIR}/cert.pem" "${FS_CERTS_DIR}/cafile.pem"
    echo "Certificate generated: ${FS_CERTS_DIR}/agent.pem"
  fi

  # Activate the TLS+SRTP sofia profile
  if [ -f "${FS_PROFILES_DIR}/external-tls.xml.tmpl" ]; then
    EXT_SIP="${FREESWITCH_EXT_SIP_IP:-auto}"
    EXT_RTP="${FREESWITCH_EXT_RTP_IP:-auto}"
    sed \
      -e "s|__EXT_SIP_IP__|${EXT_SIP}|g" \
      -e "s|__EXT_RTP_IP__|${EXT_RTP}|g" \
      -e "s|__TLS_CERT_DIR__|${FS_CERTS_DIR}|g" \
      "${FS_PROFILES_DIR}/external-tls.xml.tmpl" > "${FS_PROFILES_DIR}/external-tls.xml"
    echo "TLS profile activated: ${FS_PROFILES_DIR}/external-tls.xml"
  fi

  # Activate the smoke echo dialplan extension
  if [ -f "${FS_DIALPLAN_DIR}/smoke-echo.xml.example" ]; then
    cp "${FS_DIALPLAN_DIR}/smoke-echo.xml.example" "${FS_DIALPLAN_DIR}/smoke-echo.xml"
    echo "Smoke echo dialplan activated."
  fi
fi

exec /usr/local/freeswitch/bin/freeswitch -nonat -nf
