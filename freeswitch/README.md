# FreeSWITCH

Minimal stock-FreeSWITCH integration assets for `manageCallAI`.

## Contents

- `lua/managecall_entry.lua`
- `conf/autoload_configs/xml_curl.conf.xml.example`
- `conf/autoload_configs/event_socket.conf.xml.example`
- `conf/dialplan/managecall_entry.xml.example`
- `docker/Dockerfile`

## Rules

- Keep FreeSWITCH stock.
- Do not place business logic in Lua.
- Use `mod_xml_curl`, ESL / `mod_event_socket`, and thin Lua helpers only.
- `mod_xml_curl` requests must include the shared runtime token expected by the API.
