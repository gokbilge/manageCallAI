#!/bin/sh
set -eu

FS_CONF_DIR="/usr/local/freeswitch/conf/autoload_configs"

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

render_template "${FS_CONF_DIR}/xml_curl.conf.xml.tmpl" "${FS_CONF_DIR}/xml_curl.conf.xml"
render_template "${FS_CONF_DIR}/event_socket.conf.xml.tmpl" "${FS_CONF_DIR}/event_socket.conf.xml"

exec /usr/local/freeswitch/bin/freeswitch -nonat -nf
