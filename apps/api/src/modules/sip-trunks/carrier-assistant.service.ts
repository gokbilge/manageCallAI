import type {
  CarrierAssistantDraft,
  CarrierAssistantMissingField,
  CarrierAssistantSuggestion,
  CarrierAssistantValidationCheck,
  CreateCarrierAssistantSuggestionBody,
} from '@managecallai/contracts';
import type { NodeStatusRepository } from '../runtime/node-status.repository.js';
import type { SipTrunkRepository } from './sip-trunk.repository.js';
import type { RuntimeApplyRepository } from './runtime-apply.repository.js';
import type { SipTrunk } from './sip-trunk.types.js';

type TemplatePreset = {
  name: string;
  matches: string[];
  defaults: Partial<CarrierAssistantDraft>;
  assumptions: string[];
  warnings?: string[];
};

const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    name: 'Twilio Elastic SIP',
    matches: ['twilio'],
    defaults: { direction: 'bidirectional', transport: 'tls', port: 5061, dtmf_mode: 'rfc2833', srtp_policy: 'optional' },
    assumptions: ['Assumed Twilio Elastic SIP defaults: TLS on port 5061 with RFC2833 DTMF.'],
  },
  {
    name: 'Telnyx SIP trunk',
    matches: ['telnyx'],
    defaults: { direction: 'bidirectional', transport: 'tls', port: 5061, dtmf_mode: 'rfc2833', srtp_policy: 'optional' },
    assumptions: ['Assumed Telnyx secure trunking defaults: TLS transport with recommended SRTP support.'],
  },
  {
    name: 'Bandwidth SIP trunk',
    matches: ['bandwidth'],
    defaults: { direction: 'bidirectional', transport: 'udp', port: 5060, dtmf_mode: 'rfc2833', srtp_policy: 'disabled' },
    assumptions: ['Assumed Bandwidth baseline transport is UDP unless the carrier brief explicitly requires TLS.'],
  },
];

function normalizeHost(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^[a-z]+:\/\//i, '').replace(/[/,\s]+$/, '').trim() || null;
}

function extractHostnames(intent: string): string[] {
  const matches = intent.match(/\b[a-z0-9.-]+\.[a-z]{2,}\b/gi) ?? [];
  return [...new Set(matches.map((item) => normalizeHost(item)).filter((item): item is string => Boolean(item)))];
}

function extractPort(intent: string): number | null {
  const match = intent.match(/\bport\s*(\d{2,5})\b/i) ?? intent.match(/\b(50\d{2}|60\d{2})\b/);
  if (!match) return null;
  const port = Number.parseInt(match[1]!, 10);
  return Number.isNaN(port) ? null : port;
}

function extractQuotedValue(intent: string, label: string): string | null {
  const regex = new RegExp(`${label}\\s*[:=]?\\s*["']?([^"',\\n]+)["']?`, 'i');
  const match = intent.match(regex);
  return match?.[1]?.trim() || null;
}

function inferTemplate(intent: string): TemplatePreset | null {
  const lower = intent.toLowerCase();
  return TEMPLATE_PRESETS.find((template) => template.matches.some((needle) => lower.includes(needle))) ?? null;
}

function inferDirection(intent: string): CarrierAssistantDraft['direction'] {
  const lower = intent.toLowerCase();
  if (lower.includes('bidirectional') || (lower.includes('inbound') && lower.includes('outbound'))) return 'bidirectional';
  if (lower.includes('outbound')) return 'outbound';
  if (lower.includes('inbound')) return 'inbound';
  return null;
}

function inferTransport(intent: string): CarrierAssistantDraft['transport'] {
  const lower = intent.toLowerCase();
  if (lower.includes('tls')) return 'tls';
  if (lower.includes('tcp')) return 'tcp';
  if (lower.includes('udp')) return 'udp';
  return null;
}

function inferSrtpPolicy(intent: string): CarrierAssistantDraft['srtp_policy'] {
  const lower = intent.toLowerCase();
  if (lower.includes('srtp required') || lower.includes('require srtp')) return 'required';
  if (lower.includes('srtp optional') || lower.includes('optional srtp')) return 'optional';
  if (lower.includes('disable srtp') || lower.includes('no srtp')) return 'disabled';
  return null;
}

function inferCodecPrefs(intent: string): string[] | null {
  const codecs = ['PCMU', 'PCMA', 'OPUS', 'G722', 'G729'].filter((codec) => new RegExp(`\\b${codec}\\b`, 'i').test(intent));
  return codecs.length > 0 ? codecs : null;
}

function mergeDraft(base: CarrierAssistantDraft, overrides: Partial<CarrierAssistantDraft>): CarrierAssistantDraft {
  return {
    name: overrides.name ?? base.name,
    direction: overrides.direction ?? base.direction,
    username: overrides.username ?? base.username,
    realm: overrides.realm ?? base.realm,
    proxy: overrides.proxy ?? base.proxy,
    port: overrides.port ?? base.port,
    transport: overrides.transport ?? base.transport,
    auth_username: overrides.auth_username ?? base.auth_username,
    dtmf_mode: overrides.dtmf_mode ?? base.dtmf_mode,
    codec_prefs: overrides.codec_prefs ?? base.codec_prefs,
    srtp_policy: overrides.srtp_policy ?? base.srtp_policy,
  };
}

function buildDraftFromTrunk(trunk: SipTrunk | null): CarrierAssistantDraft {
  if (!trunk) {
    return {
      name: null,
      direction: null,
      username: null,
      realm: null,
      proxy: null,
      port: null,
      transport: null,
      auth_username: null,
      dtmf_mode: null,
      codec_prefs: null,
      srtp_policy: null,
    };
  }

  return {
    name: trunk.name,
    direction: trunk.direction,
    username: trunk.username,
    realm: trunk.realm,
    proxy: trunk.proxy,
    port: trunk.port,
    transport: trunk.transport,
    auth_username: trunk.auth_username,
    dtmf_mode: trunk.dtmf_mode,
    codec_prefs: trunk.codec_prefs,
    srtp_policy: trunk.srtp_policy,
  };
}

function buildMissingFields(draft: CarrierAssistantDraft): CarrierAssistantMissingField[] {
  const missing: CarrierAssistantMissingField[] = [];
  const requiredFields: Array<[keyof CarrierAssistantDraft, string]> = [
    ['name', 'A trunk name is required before the operator can save the draft.'],
    ['direction', 'Direction determines whether the trunk is used for inbound, outbound, or both call paths.'],
    ['realm', 'Carrier realm is required for registration and route matching.'],
    ['proxy', 'Proxy host is required so FreeSWITCH knows where to send SIP traffic.'],
    ['auth_username', 'Authentication username is required for carrier registration.'],
  ];

  for (const [field, reason] of requiredFields) {
    if (!draft[field]) missing.push({ field, reason });
  }

  missing.push({
    field: 'auth_password',
    reason: 'The assistant never invents or stores carrier secrets. Enter the password manually before saving.',
  });

  return missing;
}

function buildValidationChecks(draft: CarrierAssistantDraft, missingFields: CarrierAssistantMissingField[]): CarrierAssistantValidationCheck[] {
  const missingNames = new Set(missingFields.map((item) => item.field));
  const checks: CarrierAssistantValidationCheck[] = [
    {
      code: 'required_fields',
      description: missingNames.size === 1
        ? 'All non-secret required fields are present.'
        : 'Review and fill the remaining required fields before saving the draft.',
      status: missingNames.size === 1 ? 'ready' : 'needs_input',
    },
    {
      code: 'carrier_credentials',
      description: 'Enter the carrier password manually and confirm any recent credential rotation in the carrier portal.',
      status: 'needs_input',
    },
    {
      code: 'transport_alignment',
      description: draft.transport && draft.port
        ? `Transport ${draft.transport.toUpperCase()} and port ${draft.port} are set for operator review.`
        : 'Confirm transport and port with the carrier interoperability guide before saving.',
      status: draft.transport && draft.port ? 'ready' : 'recommended',
    },
    {
      code: 'post_save_validation',
      description: 'After saving, review Carrier Health and run the Trunk Test Workflow before routing production traffic.',
      status: 'recommended',
    },
  ];

  return checks;
}

export class CarrierAssistantTargetNotFoundError extends Error {
  constructor(id: string) {
    super(`SIP trunk not found: ${id}`);
    this.name = 'CarrierAssistantTargetNotFoundError';
  }
}

export class CarrierAssistantService {
  constructor(
    private readonly trunkRepo: SipTrunkRepository,
    private readonly applyRepo: RuntimeApplyRepository,
    private readonly nodeStatusRepo: NodeStatusRepository,
  ) {}

  async suggest(tenantId: string, input: CreateCarrierAssistantSuggestionBody): Promise<CarrierAssistantSuggestion> {
    const template = inferTemplate(input.intent);
    const trunk = input.trunk_id ? await this.trunkRepo.findById(input.trunk_id, tenantId) : null;
    if (input.trunk_id && !trunk) throw new CarrierAssistantTargetNotFoundError(input.trunk_id);

    const baseDraft = buildDraftFromTrunk(trunk);
    const hosts = extractHostnames(input.intent);
    const parsedDraft = mergeDraft(baseDraft, {
      name: extractQuotedValue(input.intent, 'name') ?? baseDraft.name ?? (template ? `${template.name} trunk` : null),
      direction: inferDirection(input.intent) ?? template?.defaults.direction ?? baseDraft.direction,
      username: extractQuotedValue(input.intent, 'username') ?? baseDraft.username,
      realm: normalizeHost(extractQuotedValue(input.intent, 'realm')) ?? hosts[0] ?? baseDraft.realm ?? null,
      proxy: normalizeHost(extractQuotedValue(input.intent, 'proxy')) ?? hosts[1] ?? hosts[0] ?? baseDraft.proxy ?? null,
      port: extractPort(input.intent) ?? template?.defaults.port ?? baseDraft.port ?? null,
      transport: inferTransport(input.intent) ?? template?.defaults.transport ?? baseDraft.transport,
      auth_username: extractQuotedValue(input.intent, 'auth username')
        ?? extractQuotedValue(input.intent, 'auth_user')
        ?? extractQuotedValue(input.intent, 'auth')
        ?? baseDraft.auth_username,
      dtmf_mode: template?.defaults.dtmf_mode ?? baseDraft.dtmf_mode,
      codec_prefs: inferCodecPrefs(input.intent) ?? baseDraft.codec_prefs,
      srtp_policy: inferSrtpPolicy(input.intent) ?? template?.defaults.srtp_policy ?? baseDraft.srtp_policy,
    });

    const assumptions = [
      ...(template?.assumptions ?? []),
      ...(trunk ? [`Started from the existing trunk "${trunk.name}" and overlaid the new carrier brief on top.`] : []),
      ...(hosts.length === 1 ? ['Used the same hostname for realm and proxy because only one carrier host was provided.'] : []),
    ];

    const warnings = [
      ...(template?.warnings ?? []),
      ...(parsedDraft.transport === 'tls' && parsedDraft.srtp_policy === 'disabled'
        ? ['TLS is enabled but SRTP is disabled. Confirm whether the carrier expects encrypted media as well as encrypted signaling.']
        : []),
    ];

    const missingFields = buildMissingFields(parsedDraft);
    const validationErrors = missingFields.map((item) => `${item.field}: ${item.reason}`);
    const validationChecks = buildValidationChecks(parsedDraft, missingFields);
    const runtimeHint = trunk ? await this.buildRuntimeHint(tenantId, trunk.id) : null;

    return {
      assistant_mode: trunk ? 'update' : 'create',
      target_trunk_id: trunk?.id ?? null,
      target_trunk_name: trunk?.name ?? null,
      matched_template: template?.name ?? null,
      suggested_config: parsedDraft,
      missing_fields: missingFields,
      assumptions,
      warnings,
      validation_errors: validationErrors,
      validation_checks: validationChecks,
      next_steps: [
        'Review the draft on the SIP Trunks page and enter the carrier password manually.',
        'Save the draft through the normal SIP trunk create or update workflow.',
        'Check Carrier Health to confirm registration state after the runtime apply completes.',
        'Run the Trunk Test Workflow before attaching outbound routes or production DIDs.',
      ],
      runtime_hint: runtimeHint,
    };
  }

  private async buildRuntimeHint(tenantId: string, trunkId: string): Promise<CarrierAssistantSuggestion['runtime_hint']> {
    const [applyRequests, snapshots] = await Promise.all([
      this.applyRepo.findByTrunk(tenantId, trunkId, 1),
      this.nodeStatusRepo.findAll(),
    ]);

    let gatewayState: string | null = null;
    let gatewayObservedAt: string | null = null;
    for (const snapshot of snapshots) {
      const statuses = snapshot.gateway_statuses as Record<string, { state?: string }>;
      const entry = statuses[`trunk-${trunkId}`];
      if (entry?.state) {
        gatewayState = entry.state;
        gatewayObservedAt = snapshot.queried_at.toISOString();
        break;
      }
    }

    return {
      gateway_state: gatewayState,
      gateway_observed_at: gatewayObservedAt,
      latest_apply_status: applyRequests[0]?.status ?? null,
      latest_apply_error: applyRequests[0]?.error_message ?? null,
    };
  }
}
