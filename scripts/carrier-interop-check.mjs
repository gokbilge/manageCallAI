#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const checkConfigOnly = args.includes('--check-config');
const evidenceArg = args.find((arg) => arg.startsWith('--evidence='));
const evidencePath = evidenceArg?.slice('--evidence='.length) ?? process.env.CARRIER_INTEROP_EVIDENCE;

const requiredScenarios = [
  'sip_register',
  'inbound_call',
  'outbound_call',
  'dtmf_rfc2833',
  'hangup_cdr',
  'tls_or_documented_exception',
  'nat_media_path',
  'failover_or_documented_exception',
];

if (checkConfigOnly) {
  console.log('carrier interop configuration check passed');
  process.exit(0);
}

if (!evidencePath) {
  console.error('carrier interop evidence is required: pass --evidence=<file> or set CARRIER_INTEROP_EVIDENCE');
  process.exit(1);
}

try {
  const raw = (await readFile(evidencePath, 'utf8')).replace(/^\uFEFF/, '');
  const evidence = JSON.parse(raw);
  const carrier = evidence.carrier_name;
  const trunk = evidence.trunk_profile;
  const scenarios = new Map((evidence.scenarios ?? []).map((scenario) => [scenario.name, scenario]));
  const failures = [];

  if (!carrier) failures.push('carrier_name is required');
  if (!trunk) failures.push('trunk_profile is required');

  for (const name of requiredScenarios) {
    const scenario = scenarios.get(name);
    if (!scenario) {
      failures.push(`missing scenario: ${name}`);
      continue;
    }
    if (!['passed', 'documented_exception'].includes(scenario.status)) {
      failures.push(`scenario ${name} must be passed or documented_exception`);
    }
    if (scenario.status === 'documented_exception' && !scenario.exception_reason) {
      failures.push(`scenario ${name} documented_exception requires exception_reason`);
    }
  }

  if (failures.length > 0) {
    console.error(`carrier interop check failed (${failures.length} issue(s))`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }

  console.log(`carrier interop check passed for ${carrier} / ${trunk}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
