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

  echo "Generating self-signed TLS certificate for FreeSWITCH smoke..."
  openssl req -newkey rsa:2048 -nodes -keyout "${FS_CERTS_DIR}/key.pem" \
    -x509 -days 3650 -out "${FS_CERTS_DIR}/cert.pem" \
    -subj "/CN=freeswitch-smoke/O=manageCallAI/C=US" 2>&1 || true
  if [ -f "${FS_CERTS_DIR}/cert.pem" ] && [ -f "${FS_CERTS_DIR}/key.pem" ]; then
    cat "${FS_CERTS_DIR}/cert.pem" "${FS_CERTS_DIR}/key.pem" > "${FS_CERTS_DIR}/agent.pem"
    cp "${FS_CERTS_DIR}/cert.pem" "${FS_CERTS_DIR}/cafile.pem"
    echo "Certificate generated: ${FS_CERTS_DIR}/agent.pem"
  else
    echo "WARNING: Certificate generation failed — TLS will not be available"
  fi

  # Enable TLS via FreeSWITCH vars.xml. The internal profile uses $${internal_ssl_enable}
  # to control whether TLS is active. Set that var to true and confirm cert dir.
  FS_VARS="/usr/local/freeswitch/conf/vars.xml"
  FS_INTERNAL="${FS_PROFILES_DIR}/internal.xml"
  if [ -f "${FS_VARS}" ] && [ -f "${FS_CERTS_DIR}/agent.pem" ]; then
    # Enable TLS in vars
    sed -i 's|internal_ssl_enable=false|internal_ssl_enable=true|g' "${FS_VARS}"
    sed -i 's|internal_ssl_enable=0|internal_ssl_enable=true|g' "${FS_VARS}"
    # Set certs_dir to our generated cert location
    sed -i "s|certs_dir=.*|certs_dir=${FS_CERTS_DIR}|g" "${FS_VARS}"
    echo "TLS enabled via vars.xml (internal_ssl_enable=true, certs_dir=${FS_CERTS_DIR})"
  fi

  # Also enable SRTP on the internal profile
  if [ -f "${FS_INTERNAL}" ]; then
    if ! grep -q 'rtp-secure-media' "${FS_INTERNAL}"; then
      sed -i '/<\/settings>/i\    <param name="rtp-secure-media" value="true"/>' "${FS_INTERNAL}"
    fi
    echo "SRTP enabled on internal profile"
  fi

  # Remove the external-tls profile to avoid port conflicts
  rm -f "${FS_PROFILES_DIR}/external-tls.xml" 2>/dev/null || true
fi

exec /usr/local/freeswitch/bin/freeswitch -nonat -nf
