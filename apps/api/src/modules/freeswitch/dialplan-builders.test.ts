import { describe, it, expect } from 'vitest';
import {
  buildCallGroupDialplanResponse,
  buildConferenceConfiguration,
  buildConferenceDialplanResponse,
  buildFeatureCodeDialplanResponse,
  buildIvrDialplanResponse,
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
});

describe('buildQueueDialplanResponse', () => {
  it('builds a queue bridge with runtime route context', () => {
    const xml = buildQueueDialplanResponse({
      routeId: ROUTE_ID,
      tenantId: TENANT_ID,
      matchValue: '+14155550006',
      strategy: 'simultaneous',
      members: [
        { extension_number: '401', directory_domain: 'tenant.sip.example.com' },
        { extension_number: '402', directory_domain: 'tenant.sip.example.com' },
      ],
    });

    expect(xml).toContain('sofia/internal/401@tenant.sip.example.com,sofia/internal/402@tenant.sip.example.com');
    expect(xml).toContain(`managecall_route_id=${ROUTE_ID}`);
    expect(xml).toContain(`managecall_tenant_id=${TENANT_ID}`);
  });
});

describe('buildVoicemailDialplanResponse', () => {
  it('plays greeting and records voicemail for the mailbox domain', () => {
    const xml = buildVoicemailDialplanResponse({
      routeId: ROUTE_ID,
      tenantId: TENANT_ID,
      matchValue: '+14155550007',
      mailboxNumber: '500',
      domain: 'tenant.sip.example.com',
      greetingPromptUri: 'file:///prompts/greeting.wav',
    });

    expect(xml).toContain('<action application="playback" data="file:///prompts/greeting.wav" />');
    expect(xml).toContain('<action application="voicemail" data="default tenant.sip.example.com 500" />');
    expect(xml).toContain(`managecall_route_id=${ROUTE_ID}`);
    expect(xml).toContain(`managecall_tenant_id=${TENANT_ID}`);
  });

  it('escapes voicemail greeting and mailbox arguments', () => {
    const xml = buildVoicemailDialplanResponse({
      routeId: ROUTE_ID,
      tenantId: TENANT_ID,
      matchValue: '+14155550008',
      mailboxNumber: '50&1',
      domain: 'tenant&sip.example.com',
      greetingPromptUri: 'file:///prompts/a&b.wav',
    });

    expect(xml).toContain('file:///prompts/a&amp;b.wav');
    expect(xml).toContain('default tenant&amp;sip.example.com 50&amp;1');
  });
});

describe('buildFeatureCodeDialplanResponse', () => {
  it('routes feature code to feature_code_handler.lua', () => {
    const xml = buildFeatureCodeDialplanResponse(TENANT_ID, '*72');
    expect(xml).toContain('<action application="luarun" data="feature_code_handler.lua" />');
    expect(xml).toContain(`managecall_tenant_id=${TENANT_ID}`);
    expect(xml).toContain('managecall_feature_code=*72');
    expect(xml).toContain('section name="dialplan"');
  });

  it('escapes XML special chars in tenant_id', () => {
    const xml = buildFeatureCodeDialplanResponse('tenant&id', '*99');
    expect(xml).toContain('managecall_tenant_id=tenant&amp;id');
  });

  it('builds regex pattern from code', () => {
    const xml = buildFeatureCodeDialplanResponse(TENANT_ID, '*72');
    expect(xml).toContain('expression="^\\*72$"');
  });
});

describe('buildConferenceDialplanResponse', () => {
  const ROOM_ID = '00000000-0000-0000-0000-000000000099';

  it('routes to conference application without PIN', () => {
    const xml = buildConferenceDialplanResponse({ tenantId: TENANT_ID, roomId: ROOM_ID, roomNumber: '8100', pin: null });
    expect(xml).toContain('<action application="conference" data="room-' + ROOM_ID + '@managecallai" />');
    expect(xml).toContain(`managecall_conference_room_id=${ROOM_ID}`);
    expect(xml).toContain(`managecall_tenant_id=${TENANT_ID}`);
    expect(xml).toContain('expression="^8100$"');
  });

  it('includes PIN in conference application data when set', () => {
    const xml = buildConferenceDialplanResponse({ tenantId: TENANT_ID, roomId: ROOM_ID, roomNumber: '8100', pin: '1234' });
    expect(xml).toContain('room-' + ROOM_ID + '@managecallai+pin:1234');
  });

  it('escapes XML special chars in room number', () => {
    const xml = buildConferenceDialplanResponse({ tenantId: TENANT_ID, roomId: ROOM_ID, roomNumber: '8100', pin: null });
    expect(xml).toContain('section name="dialplan"');
  });
});

describe('buildConferenceConfiguration', () => {
  it('returns a conference.conf with managecallai profile', () => {
    const xml = buildConferenceConfiguration();
    expect(xml).toContain('configuration name="conference.conf"');
    expect(xml).toContain('profile name="managecallai"');
    expect(xml).toContain('section name="configuration"');
  });
});
