# FreeSWITCH

Minimal stock-FreeSWITCH integration assets for `manageCallAI`.

## Contents

- `lua/managecall_entry.lua`
- `conf/autoload_configs/xml_curl.conf.xml.example`
- `conf/autoload_configs/event_socket.conf.xml.example`
- `conf/dialplan/managecall_entry.xml.example`
- `docker/Dockerfile`

## Runtime Image

- The reference container builds stock FreeSWITCH from the public SignalWire source repository.
- The pinned default version is `v1.10.12`.
- `mod_xml_curl` and `mod_event_socket` are enabled for `manageCallAI` integration.

## Rules

- Keep FreeSWITCH stock.
- Do not place business logic in Lua.
- Use `mod_xml_curl`, ESL / `mod_event_socket`, and thin Lua helpers only.
- `mod_xml_curl` requests must include the shared runtime token expected by the API.
