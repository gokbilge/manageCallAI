local ok_http, http = pcall(require, "socket.http")
local ok_ltn12, ltn12 = pcall(require, "ltn12")
local ok_json, cjson = pcall(require, "cjson")

if not (ok_http and ok_ltn12 and ok_json) then
  freeswitch.consoleLog("err", "[manageCallAI] feature_code_handler: missing Lua dependencies\n")
  session:execute("hangup", "SERVICE_UNAVAILABLE")
  return
end

local api_base = os.getenv("MANAGECALLAI_API_BASE") or "http://api:3000/api/v1"
local runtime_token = os.getenv("RUNTIME_API_TOKEN") or ""

local function log(level, message)
  freeswitch.consoleLog(level, "[manageCallAI] feature_code_handler: " .. message .. "\n")
end

local function trim(value)
  if type(value) ~= "string" then return nil end
  local normalized = value:match("^%s*(.-)%s*$")
  return normalized ~= "" and normalized or nil
end

local function safe_arg(value)
  local normalized = trim(value)
  if not normalized or #normalized > 128 then return nil end
  if string.find(normalized, "[%s;|'\"\\{}`]") then return nil end
  return normalized
end

local function json_request(method, url, payload)
  local chunks = {}
  local body = payload and cjson.encode(payload) or ""
  local _, code = http.request({
    method = method,
    url = url,
    headers = {
      ["authorization"] = "Bearer " .. runtime_token,
      ["accept"] = "application/json",
      ["content-type"] = "application/json",
      ["content-length"] = tostring(#body),
    },
    source = ltn12.source.string(body),
    sink = ltn12.sink.table(chunks),
  })
  local raw = table.concat(chunks)
  local decoded = nil
  if raw ~= "" then
    local ok_decode, value = pcall(cjson.decode, raw)
    if ok_decode then decoded = value end
  end
  return code, decoded, raw
end

-- Resolve the feature code action via the API runtime endpoint.
local function resolve_feature_code(tenant_id, code)
  local call_id = trim(session:getVariable("uuid")) or ("call-" .. tostring(os.time()))
  local caller_ext = trim(session:getVariable("caller_id_number"))

  local payload = {
    tenant_id = tenant_id,
    call_id = call_id,
    code = code,
  }
  if caller_ext then
    payload["caller_extension_id"] = caller_ext
  end

  local url = api_base .. "/feature-codes/runtime/execute"
  local code_http, decoded, raw = json_request("POST", url, payload)
  if code_http ~= 200 or not decoded or not decoded.data then
    log("err", string.format("resolve failed: http=%s body=%s", tostring(code_http), tostring(raw)))
    return nil
  end
  return decoded.data
end

-- Execute the FreeSWITCH-level side of the resolved action.
local function execute_action(action_type, action_config)
  action_config = action_config or {}

  if action_type == "call_park" then
    log("info", "executing call_park")
    session:execute("park", "")
    return

  elseif action_type == "call_park_retrieve" then
    local orbit = safe_arg(action_config.orbit or "")
    if orbit then
      log("info", "executing call_park_retrieve orbit=" .. orbit)
      session:execute("valet_park", "valet_park@default out " .. orbit)
    else
      session:execute("valet_park", "valet_park@default out auto")
    end
    return

  elseif action_type == "call_pickup" then
    local group = safe_arg(action_config.pickup_group or "default")
    log("info", "executing call_pickup group=" .. tostring(group))
    session:execute("pickup", group or "default")
    return

  elseif action_type == "conference_join" then
    local room = safe_arg(action_config.room_name or "default")
    log("info", "executing conference_join room=" .. tostring(room))
    session:execute("conference", (room or "default") .. "@default")
    return

  elseif action_type == "voicemail_access" then
    local domain = safe_arg(session:getVariable("domain_name"))
    local mailbox = safe_arg(action_config.mailbox_number or session:getVariable("caller_id_number"))
    if domain and mailbox then
      log("info", "executing voicemail_access")
      session:execute("voicemail", "check default " .. domain .. " " .. mailbox)
    else
      log("err", "voicemail_access missing domain or mailbox")
      session:execute("hangup", "SERVICE_UNAVAILABLE")
    end
    return

  else
    -- API-side-only actions (dnd_enable/disable, call_forward_enable/disable):
    -- The API already applied the state change; play confirmation tone and end.
    log("info", "action_type=" .. tostring(action_type) .. " applied via API")
    session:execute("answer", "")
    session:execute("playback", "tone_stream://%(200,100,800,1000);loops=2")
    session:execute("hangup", "NORMAL_CLEARING")
    return
  end
end

-- ── Entry point ───────────────────────────────────────────────────────────────

local tenant_id = trim(session:getVariable("managecall_tenant_id"))
local code = trim(session:getVariable("managecall_feature_code"))

if not tenant_id or not code then
  log("err", "missing managecall_tenant_id or managecall_feature_code channel vars")
  session:execute("hangup", "SERVICE_UNAVAILABLE")
  return
end

if not session:ready() then
  log("warning", "session not ready")
  return
end

if trim(session:getVariable("answer_state")) ~= "answered" then
  session:answer()
end

log("info", string.format("resolving feature code=%s tenant=%s", code, tenant_id))

local resolved = resolve_feature_code(tenant_id, code)
if not resolved then
  session:execute("hangup", "SERVICE_UNAVAILABLE")
  return
end

execute_action(resolved.action_type, resolved.action_config)
