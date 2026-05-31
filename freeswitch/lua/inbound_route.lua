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

local function trim(value)
  if type(value) ~= "string" then
    return nil
  end
  local normalized = value:match("^%s*(.-)%s*$")
  if normalized == "" then
    return nil
  end
  return normalized
end

local function safe_fs_arg(value, pattern)
  local normalized = trim(value)
  if not normalized or string.len(normalized) > 128 then
    return nil
  end
  if string.find(normalized, "[%s,{}%[%]%;%|%'%\"\\]") then
    return nil
  end
  if pattern and not string.match(normalized, pattern) then
    return nil
  end
  return normalized
end

local function safe_extension(value)
  return safe_fs_arg(value, "^[%w%._%-]+$")
end

local function safe_domain(value)
  return safe_fs_arg(value, "^[%w%.%-]+$")
end

local function safe_uuid(value)
  return safe_fs_arg(value, "^[%w%-]+$")
end

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
  local extension_number = safe_extension(t.extension_number)
  local directory_domain = safe_domain(t.directory_domain)
  if not extension_number or not directory_domain then
    freeswitch.consoleLog("err", "[manageCallAI] extension target contains unsafe bridge arguments\n")
    session:execute("hangup", "DESTINATION_OUT_OF_ORDER")
    return
  end
  local bridge_str = string.format("sofia/internal/%s@%s", extension_number, directory_domain)
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
  local flow_id = safe_uuid(data.target_id)
  if not flow_id then
    freeswitch.consoleLog("err", "[manageCallAI] flow target contains unsafe target_id\n")
    session:execute("hangup", "DESTINATION_OUT_OF_ORDER")
    return
  end
  session:execute("lua", "managecall_entry.lua " .. flow_id)

elseif target_type == "call_group" or target_type == "queue" then
  local target = data.target
  local strategy = target and target.strategy or "simultaneous"
  local members = target and target.members or nil
  if not members or #members == 0 then
    freeswitch.consoleLog("err", "[manageCallAI] queue/call_group target missing members\n")
    session:execute("hangup", "DESTINATION_OUT_OF_ORDER")
    return
  end

  local separator = strategy == "sequential" and "|" or ","
  local endpoints = {}
  for _, member in ipairs(members) do
    local extension_number = safe_extension(member.extension_number)
    local directory_domain = safe_domain(member.directory_domain)
    if extension_number and directory_domain then
      table.insert(endpoints, string.format("sofia/internal/%s@%s", extension_number, directory_domain))
    end
  end
  if #endpoints == 0 then
    freeswitch.consoleLog("err", "[manageCallAI] queue/call_group target resolved no valid endpoints\n")
    session:execute("hangup", "DESTINATION_OUT_OF_ORDER")
    return
  end
  local bridge_str = table.concat(endpoints, separator)
  freeswitch.consoleLog("info", "[manageCallAI] queue/call_group bridge " .. bridge_str .. "\n")
  session:execute("bridge", bridge_str)

elseif target_type == "voicemail_box" then
  local target = data.target
  if not target or not target.mailbox_number or not target.directory_domain then
    freeswitch.consoleLog("err", "[manageCallAI] voicemail target missing mailbox_number or directory_domain\n")
    session:execute("hangup", "DESTINATION_OUT_OF_ORDER")
    return
  end
  if target.greeting_prompt_uri then
    session:streamFile(target.greeting_prompt_uri)
  end
  local directory_domain = safe_domain(target.directory_domain)
  local mailbox_number = safe_extension(target.mailbox_number)
  if not directory_domain or not mailbox_number then
    freeswitch.consoleLog("err", "[manageCallAI] voicemail target contains unsafe arguments\n")
    session:execute("hangup", "DESTINATION_OUT_OF_ORDER")
    return
  end
  local voicemail_args = string.format("default %s %s", directory_domain, mailbox_number)
  freeswitch.consoleLog("info", "[manageCallAI] entering voicemail " .. voicemail_args .. "\n")
  session:execute("voicemail", voicemail_args)

else
  freeswitch.consoleLog("warning",
    string.format("[manageCallAI] unknown target_type '%s'\n", tostring(target_type)))
  session:execute("hangup", "UNALLOCATED_NUMBER")
end
