#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SECRET_VALUE = '[REDACTED]';

const redactionRules = [
  [/(authorization\s*[:=]\s*)(bearer|basic|digest)\s+[^\s"',)]+/gi, `$1${SECRET_VALUE}`],
  [/(x-managecallai-runtime-token\s*[:=]\s*)[^\s"',)]+/gi, `$1${SECRET_VALUE}`],
  [/((?:JWT_SECRET|RUNTIME_API_TOKEN|SIP_SECRET_MASTER_KEY|FREESWITCH_ESL_PASSWORD|WEBHOOK_SIGNING_SECRET|DATABASE_URL)\s*=\s*)[^\s"',)]+/gi, `$1${SECRET_VALUE}`],
  [/([?&](?:access_token|runtime_token|signing_secret|webhook_secret|token|secret)=)[^&\s"']+/gi, `$1${SECRET_VALUE}`],
  [/"(password|sip_password|token|secret|authorization)"\s*:\s*"[^"]*"/gi, `"$1":"${SECRET_VALUE}"`],
  [/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s/]+(@)/gi, `$1${SECRET_VALUE}$2`],
];

export function redact(input) {
  return redactionRules.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), input);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    process.stdout.write(redact(chunk));
  });
}
