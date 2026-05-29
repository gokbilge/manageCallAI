local ok_http, http = pcall(require, "socket.http")
local ok_ltn12, ltn12 = pcall(require, "ltn12")
local ok_json, cjson = pcall(require, "cjson")

if not (ok_http and ok_ltn12 and ok_json) then
  freeswitch.consoleLog("err", "[manageCallAI] missing Lua dependencies (luasocket / cjson)\n")
  session:execute("hangup", "SERVICE_UNAVAILABLE")
  return
end

local api_base = os.getenv("MANAGECALLAI_API_BASE") or "http://api:3000/api/v1"
local runtime_token = os.getenv("RUNTIME_API_TOKEN") or ""

local function log(level, message)
  freeswitch.consoleLog(level, "[manageCallAI] " .. message .. "\n")
end

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
    if ok_decode then
      decoded = value
    end
  end

  return code, decoded, raw
end

local function require_flow_id()
  local flow_id = trim(argv and argv[1]) or trim(session:getVariable("managecall_flow_id"))
  if flow_id then
    return flow_id
  end

  log("err", "managecall_entry: missing flow id")
  session:execute("hangup", "SERVICE_UNAVAILABLE")
  return nil
end

local function set_runtime_vars(result)
  local runtime_session = result and result.session or nil
  local action = result and result.action or nil

  if runtime_session and runtime_session.id then
    session:setVariable("managecall_runtime_session_id", tostring(runtime_session.id))
  end
  if runtime_session and runtime_session.flow_id then
    session:setVariable("managecall_flow_id", tostring(runtime_session.flow_id))
  end
  if runtime_session and runtime_session.flow_version_id then
    session:setVariable("managecall_flow_version_id", tostring(runtime_session.flow_version_id))
  end
  if action and action.node_id then
    session:setVariable("managecall_runtime_node_id", tostring(action.node_id))
  else
    session:setVariable("managecall_runtime_node_id", "")
  end
end

local function start_runtime_session(flow_id)
  local call_id = trim(session:getVariable("uuid"))
    or trim(session:getVariable("channel_name"))
    or ("call-" .. tostring(os.time()))
  local caller_number = trim(session:getVariable("caller_id_number"))
  local destination_number = trim(session:getVariable("destination_number"))
  local tenant_id = trim(session:getVariable("managecall_tenant_id"))
  local route_id = trim(session:getVariable("managecall_route_id"))

  local variables = {}
  if tenant_id then
    variables["tenant_id"] = tenant_id
  end
  if route_id then
    variables["route_id"] = route_id
  end

  local payload = {
    call_id = call_id,
    flow_id = flow_id,
    caller_number = caller_number,
    destination_number = destination_number,
    variables = variables,
  }

  local url = api_base .. "/runtime/ivr/sessions"
  local code, decoded, raw = json_request("POST", url, payload)
  if code ~= 201 or not decoded or not decoded.data then
    log("err", string.format("runtime session start failed: http=%s body=%s", tostring(code), tostring(raw)))
    session:execute("hangup", "SERVICE_UNAVAILABLE")
    return nil
  end

  set_runtime_vars(decoded.data)
  return decoded.data
end

local function advance_runtime_session(session_id, node_id, outcome, digits, variables)
  local payload = {
    node_id = node_id,
    outcome = outcome,
  }
  if digits then
    payload["digits"] = digits
  end
  if variables then
    payload["variables"] = variables
  end

  local url = api_base .. "/runtime/ivr/sessions/" .. session_id .. "/advance"
  local code, decoded, raw = json_request("POST", url, payload)
  if code ~= 200 or not decoded or not decoded.data then
    log("err", string.format("runtime advance failed: http=%s body=%s", tostring(code), tostring(raw)))
    session:execute("hangup", "SERVICE_UNAVAILABLE")
    return nil
  end

  set_runtime_vars(decoded.data)
  return decoded.data
end

local function execute_runtime_action(runtime_result)
  local action = runtime_result and runtime_result.action or nil
  local runtime_session = runtime_result and runtime_result.session or nil

  if not runtime_session or not runtime_session.id then
    log("err", "runtime session payload missing session.id")
    session:execute("hangup", "SERVICE_UNAVAILABLE")
    return
  end

  if not action then
    log("info", "runtime session completed without another action")
    return
  end

  if action.action == "play_prompt" then
    log("info", "executing play_prompt node " .. tostring(action.node_id))
    session:streamFile(action.prompt_uri)
    return advance_runtime_session(runtime_session.id, action.node_id, "completed")
  end

  if action.action == "play_collect" then
    log("info", "executing play_collect node " .. tostring(action.node_id))
    local digits = session:playAndGetDigits(
      1,
      tonumber(action.max_digits) or 1,
      1,
      tonumber(action.timeout_ms) or 5000,
      "#",
      action.prompt_uri,
      "",
      "\\d+"
    )

    digits = trim(digits)
    if digits then
      return advance_runtime_session(runtime_session.id, action.node_id, "digits", digits)
    end

    return advance_runtime_session(runtime_session.id, action.node_id, "timeout")
  end

  if action.action == "transfer" and action.target_type == "extension" then
    local domain = trim(action.domain) or trim(session:getVariable("domain_name"))
    if not domain then
      log("err", "transfer action missing domain")
      session:execute("hangup", "SERVICE_UNAVAILABLE")
      return nil
    end

    local bridge_str = string.format("sofia/internal/%s@%s", tostring(action.target), domain)
    log("info", "executing transfer node " .. tostring(action.node_id) .. " -> " .. bridge_str)
    session:execute("bridge", bridge_str)
    return advance_runtime_session(runtime_session.id, action.node_id, "completed")
  end

  if action.action == "transfer" and action.target_type == "queue" then
    local members = action.members or {}
    if #members == 0 then
      log("err", "queue action missing members")
      session:execute("hangup", "SERVICE_UNAVAILABLE")
      return nil
    end

    local separator = action.strategy == "sequential" and "|" or ","
    local endpoints = {}
    for _, member in ipairs(members) do
      local domain = trim(member.domain) or trim(session:getVariable("domain_name"))
      if member.extension_number and domain then
        table.insert(endpoints, string.format("sofia/internal/%s@%s", tostring(member.extension_number), domain))
      end
    end
    if #endpoints == 0 then
      log("err", "queue action resolved no valid endpoints")
      session:execute("hangup", "SERVICE_UNAVAILABLE")
      return nil
    end
    local bridge_str = table.concat(endpoints, separator)
    log("info", "executing queue node " .. tostring(action.node_id) .. " -> " .. bridge_str)
    session:execute("bridge", bridge_str)
    return advance_runtime_session(runtime_session.id, action.node_id, "completed")
  end

  if action.action == "voicemail" then
    local domain = trim(action.domain) or trim(session:getVariable("domain_name"))
    if not domain then
      log("err", "voicemail action missing domain")
      session:execute("hangup", "SERVICE_UNAVAILABLE")
      return nil
    end

    if action.greeting_prompt_uri then
      session:streamFile(action.greeting_prompt_uri)
    end

    local voicemail_args = string.format("default %s %s", domain, tostring(action.mailbox_number))
    log("info", "executing voicemail node " .. tostring(action.node_id) .. " -> " .. voicemail_args)
    session:execute("voicemail", voicemail_args)
    return advance_runtime_session(runtime_session.id, action.node_id, "completed")
  end

  if action.action == "hangup" then
    log("info", "executing hangup node " .. tostring(action.node_id))
    advance_runtime_session(runtime_session.id, action.node_id, "completed")
    session:execute("hangup", "NORMAL_CLEARING")
    return nil
  end

  log("err", "unsupported runtime action: " .. tostring(action.action))
  session:execute("hangup", "SERVICE_UNAVAILABLE")
  return nil
end

local flow_id = require_flow_id()
if not flow_id then
  return
end

if not session:ready() then
  log("warning", "session not ready at IVR entry")
  return
end

if trim(session:getVariable("answer_state")) ~= "answered" then
  session:answer()
end

log("info", "starting IVR runtime loop for flow " .. flow_id)

local runtime_result = start_runtime_session(flow_id)
while runtime_result and session:ready() do
  runtime_result = execute_runtime_action(runtime_result)
end
