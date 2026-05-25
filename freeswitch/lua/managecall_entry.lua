local action = argv and argv[1] or ""

freeswitch.consoleLog("info", "[manageCallAI] managecall_entry invoked with action: " .. action .. "\n")

if action == "play_prompt" then
  -- Thin executor only. Real payload retrieval and business logic stay outside FreeSWITCH.
  session:streamFile("phrase:demo_ivr_welcome")
elseif action == "play_collect" then
  local digits = session:playAndGetDigits(1, 1, 1, 5000, "#", "phrase:demo_ivr_welcome", "", "\\d")
  freeswitch.consoleLog("info", "[manageCallAI] collected digits: " .. (digits or "") .. "\n")
else
  freeswitch.consoleLog("warning", "[manageCallAI] unknown action: " .. action .. "\n")
end
