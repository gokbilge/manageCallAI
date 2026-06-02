import { describe, it, expect } from 'vitest';
import { buildGatewayConfiguration } from './freeswitch.controller.js';
import type { TrunkGateway } from './freeswitch.controller.js';

const TRUNK_ID = '00000000-1111-2222-3333-444444444444';

function makeTrunk(overrides: Partial<TrunkGateway> = {}): TrunkGateway {
  return {
    id: TRUNK_ID,
    name: 'Main PSTN',
    direction: 'bidirectional',
    realm: 'sip.example.com',
    proxy: 'sip.example.com',
    port: 5060,
    transport: 'udp',
    auth_username: 'trunk-user',
    auth_password: 'secret-pass',
    dtmf_mode: 'rfc2833',
    ...overrides,
  };
}

describe('buildGatewayConfiguration', () => {
  it('produces a valid sofia.conf XML structure', () => {
    const xml = buildGatewayConfiguration([makeTrunk()]);
    expect(xml).toContain('section name="configuration"');
    expect(xml).toContain('configuration name="sofia.conf"');
    expect(xml).toContain('profile name="external"');
    expect(xml).toContain('<gateways>');
  });

  it('names the gateway trunk-{id}', () => {
    const xml = buildGatewayConfiguration([makeTrunk()]);
    expect(xml).toContain(`gateway name="trunk-${TRUNK_ID}"`);
  });

  it('includes auth_username and proxy', () => {
    const xml = buildGatewayConfiguration([makeTrunk()]);
    expect(xml).toContain('name="username" value="trunk-user"');
    expect(xml).toContain('name="proxy" value="sip.example.com:5060"');
    expect(xml).toContain('name="realm" value="sip.example.com"');
  });

  it('sets register=true for outbound and bidirectional trunks', () => {
    const outbound = buildGatewayConfiguration([makeTrunk({ direction: 'outbound' })]);
    expect(outbound).toContain('name="register" value="true"');

    const bidirectional = buildGatewayConfiguration([makeTrunk({ direction: 'bidirectional' })]);
    expect(bidirectional).toContain('name="register" value="true"');
  });

  it('sets register=false for inbound-only trunks', () => {
    const xml = buildGatewayConfiguration([makeTrunk({ direction: 'inbound' })]);
    expect(xml).toContain('name="register" value="false"');
  });

  it('includes register-transport based on trunk transport', () => {
    const tls = buildGatewayConfiguration([makeTrunk({ transport: 'tls' })]);
    expect(tls).toContain('name="register-transport" value="tls"');

    const udp = buildGatewayConfiguration([makeTrunk({ transport: 'udp' })]);
    expect(udp).toContain('name="register-transport" value="udp"');
  });

  it('renders multiple gateways', () => {
    const t1 = makeTrunk({ id: 'aaaa', auth_username: 'user1' });
    const t2 = makeTrunk({ id: 'bbbb', auth_username: 'user2' });
    const xml = buildGatewayConfiguration([t1, t2]);
    expect(xml).toContain('gateway name="trunk-aaaa"');
    expect(xml).toContain('gateway name="trunk-bbbb"');
    expect(xml).toContain('"user1"');
    expect(xml).toContain('"user2"');
  });

  it('returns an empty gateways block when no trunks', () => {
    const xml = buildGatewayConfiguration([]);
    expect(xml).toContain('<gateways>');
    expect(xml).not.toContain('<gateway name=');
  });

  it('XML-escapes all trunk fields', () => {
    const xml = buildGatewayConfiguration([makeTrunk({
      auth_username: '<user&name>',
      auth_password: '"pass<word"',
      realm: 'realm&domain.com',
    })]);
    expect(xml).not.toContain('<user&name>');
    expect(xml).toContain('&lt;user&amp;name&gt;');
    expect(xml).toContain('&amp;');
  });

  it('maps auto dtmf_mode to rfc2833', () => {
    const xml = buildGatewayConfiguration([makeTrunk({ dtmf_mode: 'auto' })]);
    expect(xml).toContain('name="dtmf-type" value="rfc2833"');
  });
});
