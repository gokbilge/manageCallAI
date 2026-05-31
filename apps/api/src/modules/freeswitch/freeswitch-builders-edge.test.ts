import { describe, it, expect } from 'vitest';
import {
  buildCallGroupDialplanResponse,
  buildIvrDialplanResponse,
  buildQueueDialplanResponse,
  buildVoicemailDialplanResponse,
} from './freeswitch.controller.js';

const ROUTE = '11111111-1111-1111-1111-111111111111';
const TENANT = '22222222-2222-2222-2222-222222222222';
const FLOW = '33333333-3333-3333-3333-333333333333';

// ── buildVoicemailDialplanResponse ───────────────────────────────────────────

describe('buildVoicemailDialplanResponse edge cases', () => {
  it('omits playback action when greetingPromptUri is null', () => {
    const xml = buildVoicemailDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: '+15550001001',
      mailboxNumber: '501',
      domain: 'acme.sip.example.com',
      greetingPromptUri: null,
    });

    expect(xml).toContain('application="voicemail"');
    expect(xml).not.toContain('application="playback"');
    expect(xml).toContain('managecall_route_id=');
    expect(xml).toContain('managecall_tenant_id=');
  });

  it('escapes XML special chars in mailbox number and domain', () => {
    const xml = buildVoicemailDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: '+15550001002',
      mailboxNumber: '50<1>',
      domain: '"quotes".sip.example.com',
      greetingPromptUri: null,
    });

    expect(xml).toContain('50&lt;1&gt;');
    expect(xml).toContain('&quot;quotes&quot;');
    expect(xml).not.toContain('<1>');
  });

  it('escapes single quotes in greeting prompt URI', () => {
    const xml = buildVoicemailDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: '+15550001003',
      mailboxNumber: '502',
      domain: 'tenant.sip.example.com',
      greetingPromptUri: "file:///prompts/it's-here.wav",
    });

    expect(xml).toContain('&apos;s-here.wav');
    expect(xml).not.toContain("it's");
  });
});

// ── buildCallGroupDialplanResponse edge cases ─────────────────────────────────

describe('buildCallGroupDialplanResponse edge cases', () => {
  it('produces an empty bridge string for empty members list', () => {
    const xml = buildCallGroupDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: '+15550002001',
      strategy: 'simultaneous',
      members: [],
    });

    expect(xml).toContain('application="bridge"');
    expect(xml).toContain('data=""');
  });

  it('escapes XML special chars in extension numbers', () => {
    const xml = buildCallGroupDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: '+15550002002',
      strategy: 'simultaneous',
      members: [{ extension_number: '<100>', directory_domain: 'sip.example.com' }],
    });

    expect(xml).toContain('&lt;100&gt;@sip.example.com');
    expect(xml).not.toContain('<100>@');
  });

  it('sequential strategy uses pipe separator for three members', () => {
    const xml = buildCallGroupDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: '+15550002003',
      strategy: 'sequential',
      members: [
        { extension_number: '201', directory_domain: 'sip.example.com' },
        { extension_number: '202', directory_domain: 'sip.example.com' },
        { extension_number: '203', directory_domain: 'sip.example.com' },
      ],
    });

    const bridgeStart = xml.indexOf('application="bridge"');
    const dataAttr = xml.slice(bridgeStart).match(/data="([^"]+)"/)?.[1] ?? '';
    expect(dataAttr.split('|')).toHaveLength(3);
  });
});

// ── buildQueueDialplanResponse edge cases ─────────────────────────────────────

describe('buildQueueDialplanResponse edge cases', () => {
  it('produces an empty bridge for a queue with no members', () => {
    const xml = buildQueueDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: '+15550003001',
      strategy: 'sequential',
      members: [],
    });

    expect(xml).toContain('application="bridge"');
    expect(xml).toContain('data=""');
  });

  it('uses comma separator for simultaneous strategy', () => {
    const xml = buildQueueDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: '+15550003002',
      strategy: 'simultaneous',
      members: [
        { extension_number: '301', directory_domain: 'q.sip.example.com' },
        { extension_number: '302', directory_domain: 'q.sip.example.com' },
      ],
    });

    expect(xml).toContain(
      'sofia/internal/301@q.sip.example.com,sofia/internal/302@q.sip.example.com',
    );
  });
});

// ── buildIvrDialplanResponse edge cases ───────────────────────────────────────

describe('buildIvrDialplanResponse edge cases', () => {
  it('escapes regex metacharacters in match value: brackets and braces', () => {
    const xml = buildIvrDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: '+1[800]{3}555',
      flowId: FLOW,
    });

    expect(xml).toContain('\\+1\\[800\\]\\{3\\}555');
  });

  it('escapes match value parentheses used in dial patterns', () => {
    const xml = buildIvrDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: '+1(800)',
      flowId: FLOW,
    });

    expect(xml).toContain('\\+1\\(800\\)');
  });

  it('escapes match value caret and dollar that could break regex anchoring', () => {
    const xml = buildIvrDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: '^+1555$',
      flowId: FLOW,
    });

    expect(xml).toContain('\\^\\+1555\\$');
  });

  it('includes all three runtime context variables', () => {
    const xml = buildIvrDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: '+15554440000',
      flowId: FLOW,
    });

    expect(xml).toContain(`managecall_route_id=${ROUTE}`);
    expect(xml).toContain(`managecall_tenant_id=${TENANT}`);
    expect(xml).toContain(`managecall_flow_id=${FLOW}`);
  });

  it('XML structure contains exactly one extension element', () => {
    const xml = buildIvrDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: '+15554440001',
      flowId: FLOW,
    });

    const extensionMatches = xml.match(/<extension /g) ?? [];
    expect(extensionMatches).toHaveLength(1);
  });

  it('XML is valid enough: each opening tag has a matching closing tag for key elements', () => {
    const xml = buildIvrDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: '+15554440002',
      flowId: FLOW,
    });

    for (const tag of ['document', 'section', 'context', 'extension', 'condition']) {
      expect(xml).toContain(`<${tag} `);
      expect(xml).toContain(`</${tag}>`);
    }
  });
});

// ── XML injection safety ──────────────────────────────────────────────────────

describe('XML injection safety', () => {
  it('escapes ampersand in match value to prevent XML injection', () => {
    const xml = buildIvrDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: 'test&inject',
      flowId: FLOW,
    });

    expect(xml).toContain('test&amp;inject');
    expect(xml).not.toMatch(/test&inject(?!;)/);
  });

  it('escapes < and > in call group domain to prevent tag injection', () => {
    const xml = buildCallGroupDialplanResponse({
      routeId: ROUTE,
      tenantId: TENANT,
      matchValue: '+15550099001',
      strategy: 'simultaneous',
      members: [{ extension_number: '100', directory_domain: '<script>evil</script>.com' }],
    });

    expect(xml).not.toContain('<script>');
    expect(xml).toContain('&lt;script&gt;');
  });
});
