import createClient from 'openapi-fetch';
import type { paths, components } from './generated/schema.js';

export type AuthResponse = components['schemas']['AuthTokenResponse'];
export type Extension = components['schemas']['Extension'];
export type CallEvent = components['schemas']['CallEvent'];
export type TenantSummary = components['schemas']['TenantSummary'];
export type RuntimeHealthSummary = components['schemas']['RuntimeHealthResponse']['data'];
export type ServiceHealth = components['schemas']['ServiceHealth'];
export type CreateExtensionRequest = components['schemas']['CreateExtensionBody'];
export type RegisterRequest = components['schemas']['RegisterBody'];
export type LoginRequest = components['schemas']['LoginBody'];
export type CreateIvrFlowRequest = components['schemas']['CreateIvrFlowBody'];
export type IvrFlow = components['schemas']['IvrFlow'];
export type FlowValidationResult = components['schemas']['FlowValidationResult'];
export type FlowSimulationResult = components['schemas']['FlowSimulationResult'];
export type SimulationScenario = components['schemas']['SimulationScenario'];
export type PublishAttemptResult = components['schemas']['PublishAttemptResult'];
export type IvrRuntimeSessionReplay = components['schemas']['IvrRuntimeSessionResult'];
export type PhoneNumber = components['schemas']['PhoneNumber'];
export type InboundRoute = components['schemas']['InboundRoute'];
export type Recording = components['schemas']['Recording'];

export class ManageCallApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'ManageCallApiError';
  }
}

export type RequestOptions = {
  accessToken?: string;
  requestId?: string;
};

export class ManageCallApiClient {
  private readonly client;

  constructor(
    config: {
      baseUrl?: string;
      fetch?: typeof fetch;
    } = {},
  ) {
    this.client = createClient<paths>({
      baseUrl: config.baseUrl ?? 'http://localhost:3000/api/v1',
      fetch: config.fetch,
    });
  }

  async register(input: RegisterRequest): Promise<AuthResponse> {
    const { data, error, response } = await this.client.POST('/auth/register', {
      body: input,
    });
    return unwrap(data, error, response);
  }

  async login(input: LoginRequest): Promise<AuthResponse> {
    const { data, error, response } = await this.client.POST('/auth/login', {
      body: input,
    });
    return unwrap(data, error, response);
  }

  async listExtensions(options: RequestOptions): Promise<Extension[]> {
    const { data, error, response } = await this.client.GET('/extensions', {
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }

  async createExtension(input: CreateExtensionRequest, options: RequestOptions): Promise<Extension> {
    const { data, error, response } = await this.client.POST('/extensions', {
      body: input,
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }

  async createIvrFlow(input: CreateIvrFlowRequest, options: RequestOptions): Promise<IvrFlow> {
    const { data, error, response } = await this.client.POST('/ivr-flows', {
      body: input,
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }

  async validateIvrFlow(flowId: string, options: RequestOptions): Promise<FlowValidationResult> {
    const { data, error, response } = await this.client.POST('/ivr-flows/{flowId}/validate', {
      params: { path: { flowId } },
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }

  async simulateIvrFlow(
    flowId: string,
    scenario: SimulationScenario,
    options: RequestOptions,
  ): Promise<FlowSimulationResult> {
    const { data, error, response } = await this.client.POST('/ivr-flows/{flowId}/simulate', {
      params: { path: { flowId } },
      body: scenario,
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }

  async publishIvrFlowVersion(
    flowId: string,
    versionId: string,
    options: RequestOptions,
  ): Promise<PublishAttemptResult> {
    const { data, error, response } = await this.client.POST('/ivr-flows/{flowId}/versions/{versionId}/publish', {
      params: { path: { flowId, versionId } },
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }

  async getRuntimeSessionReplay(sessionId: string, options: RequestOptions): Promise<IvrRuntimeSessionReplay> {
    const { data, error, response } = await this.client.GET('/runtime/ivr/sessions/{sessionId}', {
      params: { path: { sessionId } },
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }

  async listCallEvents(options: RequestOptions & { tenant_id?: string } = {}): Promise<CallEvent[]> {
    const { data, error, response } = await this.client.GET('/call-events', {
      params: {
        query: options.tenant_id ? { tenant_id: options.tenant_id } : {},
      },
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }

  async listPlatformTenants(options: RequestOptions): Promise<TenantSummary[]> {
    const { data, error, response } = await this.client.GET('/platform/tenants', {
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }

  async getPlatformRuntimeHealth(options: RequestOptions): Promise<RuntimeHealthSummary> {
    const { data, error, response } = await this.client.GET('/platform/runtime/health', {
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }

  async listIvrFlows(options: RequestOptions): Promise<IvrFlow[]> {
    const { data, error, response } = await this.client.GET('/ivr-flows', {
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }

  async getIvrFlow(flowId: string, options: RequestOptions): Promise<IvrFlow> {
    const { data, error, response } = await this.client.GET('/ivr-flows/{flowId}', {
      params: { path: { flowId } },
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }

  async rollbackIvrFlow(flowId: string, options: RequestOptions): Promise<PublishAttemptResult> {
    const { data, error, response } = await this.client.POST('/ivr-flows/{flowId}/rollback', {
      params: { path: { flowId } },
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }

  async listPhoneNumbers(options: RequestOptions): Promise<PhoneNumber[]> {
    const { data, error, response } = await this.client.GET('/phone-numbers', {
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }

  async listInboundRoutes(options: RequestOptions): Promise<InboundRoute[]> {
    const { data, error, response } = await this.client.GET('/inbound-routes', {
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }

  async listRecordings(options: RequestOptions & { call_id?: string } = {}): Promise<Recording[]> {
    const { data, error, response } = await this.client.GET('/recordings', {
      params: {
        query: options.call_id ? { call_id: options.call_id } : {},
      },
      headers: authHeaders(options),
    });
    return unwrap(data, error, response).data;
  }
}

function authHeaders(options: RequestOptions) {
  const headers: Record<string, string> = {};

  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  if (options.requestId) {
    headers['X-Request-Id'] = options.requestId;
  }

  return headers;
}

function unwrap<T>(data: T | undefined, error: unknown, response: Response): T {
  if (data !== undefined) {
    return data;
  }

  const message =
    typeof error === 'object' && error !== null && 'error' in error && typeof (error as { error?: unknown }).error === 'string'
      ? (error as { error: string }).error
      : `API request failed: ${response.status}`;

  throw new ManageCallApiError(message, response.status, error);
}
