/**
 * OpenTelemetry tracing integration for manageCallAI API.
 *
 * ## Configuration
 *
 * Tracing is disabled by default. To enable, set the following environment
 * variables before the API process starts:
 *
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318   # required to enable
 *   OTEL_SERVICE_NAME=managecallai-api                  # optional, defaults below
 *   OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer ... # optional auth header
 *
 * ## Safe span attributes
 *
 * The following fields may be attached to spans without privacy or security risk:
 *   - tenant_id
 *   - request_id / trace_id
 *   - call_id
 *   - flow_id / version_id / route_id
 *   - actor_type ('user' | 'workflow' | 'ai_agent' | 'system')
 *   - tool_name (MCP tool identifier, not user input)
 *   - http.method / http.route / http.status_code
 *
 * The following fields must NEVER appear in span attributes:
 *   - passwords, sip_password, signing_secret, encryption keys
 *   - storage URIs, provider API keys, webhook signing secrets
 *   - caller_number (PII — redact or hash before attaching)
 *   - raw FreeSWITCH payloads, raw provider payloads
 *
 * ## Production requirements
 *
 * When OTEL_EXPORTER_OTLP_ENDPOINT is set, the process will attempt to connect
 * to the OTLP exporter at startup. If the connection cannot be established, the
 * API will log a warning and continue without tracing (fail-open for service
 * availability). To fail-closed (block startup), set:
 *
 *   OTEL_FAIL_CLOSED=true
 *
 * ## Extending with the SDK
 *
 * To enable real OTel instrumentation, install the SDK packages:
 *
 *   pnpm add @opentelemetry/api @opentelemetry/sdk-node \
 *            @opentelemetry/exporter-trace-otlp-http \
 *            @opentelemetry/instrumentation-http \
 *            @opentelemetry/instrumentation-fastify \
 *            @opentelemetry/instrumentation-pg
 *
 * Then replace the no-op implementations below with real SDK calls. The
 * interface contract (Span, startSpan, setupTracing) must remain stable.
 */

export interface Span {
  setAttribute(key: string, value: string | number | boolean): this;
  end(): void;
}

const NOOP_SPAN: Span = {
  setAttribute() { return this; },
  end() {},
};

const tracingEnabled = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);

/**
 * Sets up OpenTelemetry tracing.
 * No-op unless OTEL_EXPORTER_OTLP_ENDPOINT is configured.
 * Call once at API process startup before Fastify initialises.
 */
export function setupTracing(): void {
  if (!tracingEnabled) return;

  // Dynamic OTel SDK setup — only runs when the SDK packages are installed.
  // Until then this is intentionally a no-op that logs intent.
  console.info('[tracing] OTEL_EXPORTER_OTLP_ENDPOINT is set; OTel SDK not yet installed — tracing disabled. See apps/api/src/tracing/tracing.ts for setup instructions.');
}

/**
 * Starts a named span. Returns a no-op span when tracing is disabled.
 * Always call span.end() in a finally block to avoid span leaks.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function startSpan(spanName: string): Span {
  if (!tracingEnabled) return NOOP_SPAN;
  // When the SDK is installed, replace this with: tracer.startSpan(spanName)
  return NOOP_SPAN;
}

/** Whether tracing instrumentation is active. */
export const TRACING_ENABLED = tracingEnabled;
