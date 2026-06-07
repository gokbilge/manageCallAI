import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';

const ROOT = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

function readText(path) {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

function readCompose(path) {
  return parse(readText(path));
}

function readEnv(path) {
  const entries = new Map();
  for (const line of readText(path).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    entries.set(trimmed.slice(0, index), trimmed.slice(index + 1));
  }
  return entries;
}

function getEnvironment(service) {
  return service.environment ?? {};
}

test('free profile has no license mount requirement', () => {
  const compose = readCompose('docker-compose.free.yml');
  const apiVolumes = compose.services.api.volumes ?? [];
  deepStrictEqual(apiVolumes, []);
  strictEqual(readEnv('.env.free.example').has('MANAGECALLAI_LICENSE_FILE'), false);
});

test('pro profile includes license env vars and read-only license volume', () => {
  const compose = readCompose('docker-compose.pro.yml');
  const env = readEnv('.env.pro.example');
  strictEqual(env.get('MANAGECALLAI_EDITION'), 'pro');
  strictEqual(env.get('MANAGECALLAI_LICENSE_FILE'), '/etc/managecallai/license/license.json');
  strictEqual(env.get('MANAGECALLAI_LICENSE_PUBLIC_KEY'), '/etc/managecallai/license/public.pem');
  strictEqual(env.get('MANAGECALLAI_LICENSE_GRACE_DAYS'), '14');
  ok((compose.services.api.volumes ?? []).includes('./license:/etc/managecallai/license:ro'));
});

test('enterprise profile includes license env vars and read-only license volume', () => {
  const compose = readCompose('docker-compose.enterprise.yml');
  const env = readEnv('.env.enterprise.example');
  strictEqual(env.get('MANAGECALLAI_EDITION'), 'enterprise');
  strictEqual(env.get('MANAGECALLAI_LICENSE_FILE'), '/etc/managecallai/license/license.json');
  strictEqual(env.get('MANAGECALLAI_LICENSE_PUBLIC_KEY'), '/etc/managecallai/license/public.pem');
  strictEqual(env.get('MANAGECALLAI_LICENSE_GRACE_DAYS'), '30');
  ok((compose.services.api.volumes ?? []).includes('./license:/etc/managecallai/license:ro'));
});

test('freeswitch services do not include license enforcement env vars', () => {
  for (const file of ['docker-compose.free.yml', 'docker-compose.pro.yml', 'docker-compose.enterprise.yml']) {
    const compose = readCompose(file);
    const freeswitchEnv = getEnvironment(compose.services.freeswitch);
    for (const key of Object.keys(freeswitchEnv)) {
      ok(!key.startsWith('MANAGECALLAI_LICENSE_'));
      strictEqual(key === 'MANAGECALLAI_EDITION', false);
    }
  }
});

test('api is the only service with license configuration in paid profiles', () => {
  for (const file of ['docker-compose.pro.yml', 'docker-compose.enterprise.yml']) {
    const compose = readCompose(file);
    for (const [serviceName, service] of Object.entries(compose.services)) {
      const env = getEnvironment(service);
      const licenseKeys = Object.keys(env).filter((key) => key.startsWith('MANAGECALLAI_LICENSE_'));
      if (serviceName === 'api') {
        ok(licenseKeys.length >= 3);
      } else {
        strictEqual(licenseKeys.length, 0);
      }
    }
  }
});

test('example license files are marked invalid and documentation-only', () => {
  for (const file of [
    'examples/licenses/pro-license.example.invalid.json',
    'examples/licenses/enterprise-license.example.invalid.json',
  ]) {
    const parsed = JSON.parse(readText(file));
    strictEqual(parsed.documentation_only, true);
    strictEqual(parsed.invalid_example, true);
    ok(String(parsed.signature).includes('INVALID-EXAMPLE'));
  }
});

test('README contains editions, distribution, and open core section', () => {
  const readme = readText('README.md');
  ok(readme.includes('## Editions, distribution, and open core'));
  ok(readme.includes('Forks may use the public core under the repository license'));
  ok(readme.includes('signed entitlements'));
});
