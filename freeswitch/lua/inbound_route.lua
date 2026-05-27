-- Resolve an inbound DID against the manageCallAI route-lookup API and
-- route the call to the matched target. Extension targets are bridged
-- directly. Flow targets enter the thin Lua IVR runtime loop.

local did = session:getVariable("destination_number")
if not did or did == "" then
  freeswitch.consoleLog("err", "[manageCallAI] inbound_route: missing destination_number\n")
  session:execute("hangup", "UNALLOCATED_NUMBER")
  return
end

local api_base     = os.getenv("MANAGECALLAI_API_BASE") or "http://api:3000/api/v1"
local runtime_token = os.getenv("RUNTIME_API_TOKEN") or ""

-- URL-encode the leading '+' so the query string survives intact.
local encoded_did = did:gsub("+", "%%2B")
local url = api_base .. "/freeswitch/route-lookup?did=" .. encoded_did

freeswitch.consoleLog("info", "[manageCallAI] route-lookup: " .. url .. "\n")

local ok_http, http  = pcall(require, "socket.http")
local ok_ltn12, ltn12 = pcall(require, "ltn12")
local ok_json, cjson  = pcall(require, "cjson")

if not (ok_http and ok_ltn12 and ok_json) then
  freeswitch.consoleLog("err", "[manageCallAI] missing Lua dependencies (luasocket / cjson)\n")
  session:execute("hangup", "SERVICE_UNAVAILABLE")
  return
end

local chunks = {}
local _, code = http.request{
  url     = url,
  headers = {
    ["x-managecallai-runtime-token"] = runtime_token,
    ["accept"]                        = "application/json",
  },
  sink = ltn12.sink.table(chunks),
}

if code ~= 200 then
  freeswitch.consoleLog("err",
    string.format("[manageCallAI] route-lookup HTTP %s for DID %s\n", tostring(code), did))
  session:execute("hangup", "UNALLOCATED_NUMBER")
  return
end

local ok_dec, data = pcall(cjson.decode, table.concat(chunks))
if not ok_dec or not data or not data.matched then
  freeswitch.consoleLog("info",
    string.format("[manageCallAI] no active route for DID %s\n", did))
  session:execute("hangup", "UNALLOCATED_NUMBER")
  return
end

local target_type = data.target_type
freeswitch.consoleLog("info",
  string.format("[manageCallAI] route matched: target_type=%s route_id=%s\n",
    tostring(target_type), tostring(data.route_id)))

if target_type == "extension" then
  local t = data.target
  if not t or not t.extension_number or not t.directory_domain then
    freeswitch.consoleLog("err", "[manageCallAI] extension target missing extension_number or directory_domain\n")
    session:execute("hangup", "DESTINATION_OUT_OF_ORDER")
    return
  end
  local bridge_str = string.format("sofia/internal/%s@%s", t.extension_number, t.directory_domain)
  freeswitch.consoleLog("info", "[manageCallAI] bridging to " .. bridge_str .. "\n")
  session:execute("bridge", bridge_str)

elseif target_type == "flow" then
  if not data.target_id then
    freeswitch.consoleLog("err", "[manageCallAI] flow target missing target_id\n")
    session:execute("hangup", "DESTINATION_OUT_OF_ORDER")
    return
  end

  session:setVariable("managecall_route_id", tostring(data.route_id or ""))
  session:setVariable("managecall_tenant_id", tostring(data.tenant_id or ""))
  session:setVariable("managecall_flow_id", tostring(data.target_id))
  freeswitch.consoleLog("info",
    string.format("[manageCallAI] entering flow runtime for flow %s\n", tostring(data.target_id)))
  session:execute("lua", "managecall_entry.lua " .. tostring(data.target_id))

else
  freeswitch.consoleLog("warning",
    string.format("[manageCallAI] unknown target_type '%s'\n", tostring(target_type)))
  session:execute("hangup", "UNALLOCATED_NUMBER")
end
