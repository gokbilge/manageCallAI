#!/usr/bin/env node
/**
 * FreeSWITCH profile smoke test.
 *
 * Validates that the freeswitch-agent can reach the FreeSWITCH ESL port and
 * that the expected SIP profile is loaded. This test requires a running
 * FreeSWITCH instance and is therefore NOT run in standard CI.
 *
 * CI blocker: FreeSWITCH cannot easily run as a GitHub Actions service container
 * due to its dependency on a host network interface for media and its non-trivial
 * startup configuration. The deterministic validation that CAN run in CI is the
 * runtime XML golden-file test (check-xml-golden.mjs), which verifies that the
 * mod_xml_curl responses from the API match expected XML snapshots without needing
 * a live FreeSWITCH instance.
 *
 * To run locally (requires docker compose with FreeSWITCH profile):
 *   pnpm runtime:up
 *   node scripts/check-freeswitch-profile.mjs
 *
 * Environment:
 *   FREESWITCH_ESL_HOST  (default: 127.0.0.1)
 *   FREESWITCH_ESL_PORT  (default: 8021)
 *   FREESWITCH_ESL_PASSWORD  (required, must not be the vendor default in non-dev environments)
 *   FREESWITCH_ESL_TIMEOUT_MS  (default: 60000)
 *
 * Exit code 0 = FreeSWITCH is reachable and sofia internal profile is loaded.
 * Non-zero = connection failed or profile not found.
 */

import net from 'node:net';

const host = process.env.FREESWITCH_ESL_HOST ?? '127.0.0.1';
const port = parseInt(process.env.FREESWITCH_ESL_PORT ?? '8021', 10);
const password = process.env.FREESWITCH_ESL_PASSWORD;
const defaultEslPassword = ['Clue', 'Con'].join('');

if (!password) {
  console.error('FREESWITCH_ESL_PASSWORD is required.');
  process.exit(1);
}

if (password === defaultEslPassword && process.env.APP_ENV === 'production') {
  console.error('FREESWITCH_ESL_PASSWORD must not be the vendor default value in production.');
  process.exit(1);
}

console.log(`Connecting to FreeSWITCH ESL at ${host}:${port}...`);

const TIMEOUT_MS = parseInt(process.env.FREESWITCH_ESL_TIMEOUT_MS ?? '60000', 10);
const RETRY_DELAY_MS = 1_000;
const deadline = Date.now() + TIMEOUT_MS;

let buffer = '';
let authenticated = false;
let done = false;
let client;

const timer = setTimeout(() => {
  if (!done) {
    console.error(`Timeout: could not connect to ${host}:${port} within ${TIMEOUT_MS}ms`);
    client?.destroy();
    process.exit(1);
  }
}, TIMEOUT_MS);

function connect() {
  client = net.createConnection({ host, port });

  client.on('data', onData);
  client.on('error', onError);
}

function onData(data) {
  buffer += data.toString();

  if (!authenticated && buffer.includes('Content-Type: auth/request')) {
    client?.write(`auth ${password}\n\n`);
  }

  if (!authenticated && buffer.includes('Reply-Text: +OK accepted')) {
    authenticated = true;
    console.log('ESL authentication succeeded.');
    client?.write('api sofia status\n\n');
  }

  if (authenticated && buffer.includes('Content-Type: api/response')) {
    const responseStart = buffer.indexOf('Content-Type: api/response');
    const bodyStart = buffer.indexOf('\n\n', responseStart) + 2;
    const body = buffer.slice(bodyStart);

    if (body.includes('internal')) {
      console.log('FreeSWITCH profile smoke test PASSED: sofia internal profile is loaded.');
      done = true;
      clearTimeout(timer);
      client?.destroy();
      process.exit(0);
    } else {
      console.error('FreeSWITCH profile smoke test FAILED: sofia internal profile not found in status output.');
      console.error('sofia status output:', body.slice(0, 500));
      done = true;
      clearTimeout(timer);
      client?.destroy();
      process.exit(1);
    }
  }

  if (buffer.includes('Reply-Text: -ERR invalid')) {
    console.error('ESL authentication failed: invalid password.');
    done = true;
    clearTimeout(timer);
    client?.destroy();
    process.exit(1);
  }
}

function onError(err) {
  client?.destroy();

  if (!done && (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') && Date.now() + RETRY_DELAY_MS < deadline) {
    setTimeout(connect, RETRY_DELAY_MS);
    return;
  }

  console.error(`ESL connection error: ${err.message}`);
  console.error('Is FreeSWITCH running? Try: pnpm runtime:up');
  clearTimeout(timer);
  process.exit(1);
}

connect();
