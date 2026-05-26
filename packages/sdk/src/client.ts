import type {
  AuthResponse,
  CallEvent,
  CreateExtensionRequest,
  DataEnvelope,
  Extension,
  LoginRequest,
  RegisterRequest,
  RequestOptions,
  RuntimeHealthSummary,
  TenantSummary,
} from './types.js';

export class ManageCallApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ManageCallApiError';
  }
}

export class ManageCallApiClient {
  constructor(
    private readonly config: {
      baseUrl?: string;
      fetchImpl?: typeof fetch;
    } = {},
  ) {}

  async register(input: RegisterRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async login(input: LoginRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async listExtensions(options: RequestOptions): Promise<Extension[]> {
    const response = await this.request<DataEnvelope<Extension[]>>('/extensions', {
      accessToken: options.accessToken,
      requestId: options.requestId,
    });
    return response.data;
  }

  async createExtension(input: CreateExtensionRequest, options: RequestOptions): Promise<Extension> {
    const response = await this.request<DataEnvelope<Extension>>('/extensions', {
      method: 'POST',
      accessToken: options.accessToken,
      requestId: options.requestId,
      body: JSON.stringify(input),
    });
    return response.data;
  }

  async listCallEvents(options: RequestOptions): Promise<CallEvent[]> {
    const response = await this.request<DataEnvelope<CallEvent[]>>('/call-events', {
      accessToken: options.accessToken,
      requestId: options.requestId,
    });
    return response.data;
  }

  async listPlatformTenants(options: RequestOptions): Promise<TenantSummary[]> {
    const response = await this.request<DataEnvelope<TenantSummary[]>>('/platform/tenants', {
      accessToken: options.accessToken,
      requestId: options.requestId,
    });
    return response.data;
  }

  async getPlatformRuntimeHealth(options: RequestOptions): Promise<RuntimeHealthSummary> {
    const response = await this.request<DataEnvelope<RuntimeHealthSummary>>('/platform/runtime/health', {
      accessToken: options.accessToken,
      requestId: options.requestId,
    });
    return response.data;
  }

  private async request<T>(
    path: string,
    init: RequestInit & RequestOptions = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');

    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (init.accessToken) {
      headers.set('Authorization', `Bearer ${init.accessToken}`);
    }

    if (init.requestId) {
      headers.set('X-Request-Id', init.requestId);
    }

    const response = await this.fetchImpl()(`${this.baseUrl()}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      let message = `API request failed: ${response.status}`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) {
          message = body.error;
        }
      } catch {
        // no-op
      }
      throw new ManageCallApiError(message, response.status);
    }

    return (await response.json()) as T;
  }

  private baseUrl() {
    return this.config.baseUrl ?? 'http://localhost:3000/api/v1';
  }

  private fetchImpl() {
    return this.config.fetchImpl ?? fetch;
  }
}
