import { describe, it, expect } from 'vitest';
import {
  buildIvrDialplanResponse,
  buildCallGroupDialplanResponse,
  buildQueueDialplanResponse,
  buildVoicemailDialplanResponse,
} from './freeswitch.controller.js';

const ROUTE_ID = '00000000-0000-0000-0000-000000000001';
const TENANT_ID = '00000000-0000-0000-0000-000000000002';
const FLOW_ID   = '00000000-0000-0000-0000-000000000003';

describe('buildIvrDialplanResponse', () => {
  it('sets managecall_flow_id and runs Lua entry script', () => {
    const xml = buildIvrDialplanResponse({
      routeId: ROUTE_ID,
      tenantId: TENANT_ID,
      matchValue: '+14155550001',
      flowId: FLOW_ID,
    });

    expect(xml).toContain(`managecall_flow_id=${FLOW_ID}`);
    expect(xml).toContain('<action application="luarun" data="managecall_entry.lua" />');
    expect(xml).toContain(`managecall_route_id=${ROUTE_ID}`);
    expect(xml).toContain(`managecall_tenant_id=${TENANT_ID}`);
    expect(xml).toContain('section name="dialplan"');
  });

  it('escapes regex special chars in match value', () => {
    const xml = buildIvrDialplanResponse({
      routeId: ROUTE_ID,
      tenantId: TENANT_ID,
      matchValue: '+1415.555',
      flowId: FLOW_ID,
    });

    expect(xml).toContain('\\+1415\\.555');
  });
});

describe('buildCallGroupDialplanResponse', () => {
  const members = [
    { extension_number: '101', directory_domain: 'tenant.sip.example.com' },
    { extension_number: '102', directory_domain: 'tenant.sip.example.com' },
  ];

  it('builds simultaneous bridge with comma separator', () => {
    const xml = buildCallGroupDialplanResponse({
      routeId: ROUTE_ID,
      tenantId: TENANT_ID,
      matchValue: '+14155550002',
      strategy: 'simultaneous',
      members,
    });

    expect(xml).toContain('sofia/internal/101@tenant.sip.example.com,sofia/internal/102@tenant.sip.example.com');
    expect(xml).toContain('<action application="bridge"');
    expect(xml).toContain(`managecall_route_id=${ROUTE_ID}`);
    expect(xml).toContain(`managecall_tenant_id=${TENANT_ID}`);
  });

  it('builds sequential bridge with pipe separator', () => {
    const xml = buildCallGroupDialplanResponse({
      routeId: ROUTE_ID,
      tenantId: TENANT_ID,
      matchValue: '+14155550003',
      strategy: 'sequential',
      members,
    });

    expect(xml).toContain('sofia/internal/101@tenant.sip.example.com|sofia/internal/102@tenant.sip.example.com');
  });

  it('handles single member without separator', () => {
    const xml = buildCallGroupDialplanResponse({
      routeId: ROUTE_ID,
      tenantId: TENANT_ID,
      matchValue: '+14155550004',
      strategy: 'simultaneous',
      members: [{ extension_number: '201', directory_domain: 'other.sip.example.com' }],
    });

    expect(xml).toContain('sofia/internal/201@other.sip.example.com');
    expect(xml).not.toContain(',');
    expect(xml).not.toContain('|');
  });

  it('escapes XML special chars in domain names', () => {
    const xml = buildCallGroupDialplanResponse({
      routeId: ROUTE_ID,
      tenantId: TENANT_ID,
      matchValue: '+14155550005',
      strategy: 'simultaneous',
      members: [{ extension_number: '301', directory_domain: 'a&b.example.com' }],
    });

    expect(xml).toContain('301@a&amp;b.example.com');
  });

  it('escapes XML special chars in extension numbers', () => {
    const xml = buildCallGroupDialplanResponse({
      routeId: ROUTE_ID,
      tenantId: TENANT_ID,
      matchValue: '+14155550006',
      strategy: 'simultaneous',
      members: [{ extension_number: '4<01">', directory_domain: 'tenant.local' }],
    });

    // XML special chars must be escaped; raw characters must not appear.
    expect(xml).not.toContain('<01">');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
    expect(xml).toContain('&quot;');
  });
});

describe('buildQueueDialplanResponse', () => {
  it('builds a simultaneous bridge for queue members', () => {
    const xml = buildQueueDialplanResponse({
      routeId: ROUTE_ID,
      tenantId: TENANT_ID,
      matchValue: '+14155550010',
      strategy: 'simultaneous',
      members: [
        { extension_number: '501', directory_domain: 'q.local' },
        { extension_number: '502', directory_domain: 'q.local' },
      ],
    });

    expect(xml).toContain('sofia/internal/501@q.local,sofia/internal/502@q.local');
    expect(xml).toContain('section name="dialplan"');
  });
});

describe('buildVoicemailDialplanResponse', () => {
  it('builds a voicemail action with mailbox number and domain', () => {
    const xml = buildVoicemailDialplanResponse({
      routeId: ROUTE_ID,
      tenantId: TENANT_ID,
      matchValue: '+14155550020',
      mailboxNumber: '9001',
      domain: 'vm.local',
      greetingPromptUri: null,
    });

    expect(xml).toContain('application="voicemail"');
    expect(xml).toContain('default vm.local 9001');
  });

  it('includes playback action when greeting prompt is set', () => {
    const xml = buildVoicemailDialplanResponse({
      routeId: ROUTE_ID,
      tenantId: TENANT_ID,
      matchValue: '+14155550021',
      mailboxNumber: '9002',
      domain: 'vm.local',
      greetingPromptUri: 'file:///prompts/greeting.wav',
    });

    expect(xml).toContain('application="playback"');
    expect(xml).toContain('file:///prompts/greeting.wav');
  });

  it('escapes XML special chars in greeting prompt URI', () => {
    const xml = buildVoicemailDialplanResponse({
      routeId: ROUTE_ID,
      tenantId: TENANT_ID,
      matchValue: '+14155550022',
      mailboxNumber: '9003',
      domain: 'vm.local',
      greetingPromptUri: 'http://host/a&b=<c>',
    });

    expect(xml).not.toContain('a&b=<c>');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
  });
});
