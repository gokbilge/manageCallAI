import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Redis } from 'ioredis';
import { config } from '../config/env.js';
import { sendResourceExhausted } from '../errors/index.js';

type RateLimitBucket = {
  remaining: number;
  resetAt: number;
};

export type RateLimitPolicy = {
  name: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export interface RateLimiter {
  take(key: string, policy: RateLimitPolicy): RateLimitResult | Promise<RateLimitResult>;
  close?(): void | Promise<void>;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  take(key: string, policy: RateLimitPolicy): { allowed: boolean; remaining: number; resetAt: number } {
    const now = this.now();
    const existing = this.buckets.get(key);
    const bucket =
      !existing || existing.resetAt <= now
        ? { remaining: policy.limit, resetAt: now + policy.windowMs }
        : existing;

    if (bucket.remaining <= 0) {
      this.buckets.set(key, bucket);
      return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
    }

    bucket.remaining -= 1;
    this.buckets.set(key, bucket);
    return { allowed: true, remaining: bucket.remaining, resetAt: bucket.resetAt };
  }
}

export type RedisRateLimitClient = {
  eval(script: string, keyCount: number, key: string, windowMs: string): Promise<unknown>;
  quit?(): Promise<unknown>;
  disconnect?(): void;
};

const redisFixedWindowScript = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`;

export class RedisRateLimiter implements RateLimiter {
  constructor(
    private readonly client: RedisRateLimitClient,
    private readonly keyPrefix: string,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async take(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    const redisKey = `${this.keyPrefix}:${key}`;
    const reply = await this.client.eval(redisFixedWindowScript, 1, redisKey, String(policy.windowMs));
    const [countRaw, ttlRaw] = parseRedisRateLimitReply(reply);
    const ttl = ttlRaw > 0 ? ttlRaw : policy.windowMs;
    const remaining = Math.max(0, policy.limit - countRaw);

    return {
      allowed: countRaw <= policy.limit,
      remaining,
      resetAt: this.now() + ttl,
    };
  }

  async close(): Promise<void> {
    if (this.client.quit) {
      await this.client.quit();
      return;
    }
    this.client.disconnect?.();
  }
}

export function createRateLimiterFromConfig(): RateLimiter {
  if (config.rateLimitStore === 'memory' || config.rateLimitStore.trim() === '') {
    return new InMemoryRateLimiter();
  }

  if (config.rateLimitStore === 'redis') {
    if (!config.rateLimitRedisUrl) {
      throw new Error('RATE_LIMIT_REDIS_URL is required when RATE_LIMIT_STORE=redis');
    }
    const redis = new Redis(config.rateLimitRedisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
    });
    redis.on('error', (err: Error) => {
      // Keep the message generic; connection strings may contain credentials.
      console.error(`Redis rate-limit store error: ${err.message}`);
    });
    return new RedisRateLimiter(redis, config.rateLimitRedisKeyPrefix);
  }

  throw new Error(`Unsupported RATE_LIMIT_STORE: ${config.rateLimitStore}`);
}

const policies = {
  auth: { name: 'auth', limit: config.rateLimitAuthMax, windowMs: config.rateLimitWindowMs },
  runtime: { name: 'runtime', limit: config.rateLimitRuntimeMax, windowMs: config.rateLimitWindowMs },
  webhook: { name: 'webhook', limit: config.rateLimitWebhookMax, windowMs: config.rateLimitWindowMs },
  outbound: { name: 'outbound', limit: config.rateLimitOutboundMax, windowMs: config.rateLimitWindowMs },
  api: { name: 'api', limit: config.rateLimitApiMax, windowMs: config.rateLimitWindowMs },
  scrape: { name: 'scrape', limit: config.rateLimitScrapeMax, windowMs: config.rateLimitWindowMs },
} satisfies Record<string, RateLimitPolicy>;

export function registerRateLimitHook(app: FastifyInstance, limiter: RateLimiter = createRateLimiterFromConfig()): void {
  if (limiter.close) {
    app.addHook('onClose', async () => {
      await limiter.close?.();
    });
  }

  app.addHook('onRequest', async (req, reply) => {
    const policy = policyForPath(req.method, req.url);
    if (!policy) return;

    const key = `${policy.name}:${clientKey(req)}`;
    let result: RateLimitResult;
    try {
      result = await limiter.take(key, policy);
    } catch (err) {
      req.log.error({ err }, 'rate limit store unavailable');
      reply.header('Retry-After', '1');
      return sendResourceExhausted(reply, 'Rate limit unavailable');
    }
    reply.header('X-RateLimit-Limit', String(policy.limit));
    reply.header('X-RateLimit-Remaining', String(result.remaining));
    reply.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));

    if (!result.allowed) {
      reply.header('Retry-After', String(Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))));
      return sendResourceExhausted(reply, 'Rate limit exceeded');
    }
  });
}

export function policyForPath(method: string, url: string): RateLimitPolicy | null {
  const path = url.split('?', 1)[0] ?? url;

  if (path.startsWith('/api/v1/auth/')) return policies.auth;
  if (method === 'POST' && path === '/api/v1/runtime/outbound') return policies.outbound;
  if (path.startsWith('/api/v1/runtime/') || path.startsWith('/api/v1/freeswitch/')) return policies.runtime;
  if (method === 'POST' && path === '/api/v1/call-events') return policies.runtime;
  if (path.startsWith('/api/v1/call-events/internal/')) return policies.runtime;
  if (path.startsWith('/api/v1/webhooks/')) return policies.webhook;

  if (path.startsWith('/api/v1/')) return policies.api;
  if (path === '/metrics') return policies.scrape;

  return null;
}

function clientKey(req: FastifyRequest): string {
  const authorization = headerValue(req.headers.authorization);
  const runtimeToken = headerValue(req.headers['x-managecallai-runtime-token']);
  const tenant = headerValue(req.headers['x-tenant-id']);
  const credentialHash = hashValue([authorization, runtimeToken, tenant].filter(Boolean).join('|'));
  return `${req.ip}:${credentialHash}`;
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(',');
  return value ?? '';
}

function hashValue(value: string): string {
  if (!value) return 'anonymous';
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

// ── Topology check (multi-instance safety) ───────────────────────────────────

export type TopologyFinding = {
  level: 'fail' | 'warn';
  name: string;
  message: string;
};

export type TopologyConfig = {
  appEnv: string;
  instanceCount: number;
  externalEnforced: boolean;
  gatewayEnforced: boolean;
  sharedStoreConfigured?: boolean;
  explicitRateLimits: boolean;
  explicitWindow: boolean;
  storeNamed: boolean;
};

/**
 * Evaluates the rate-limit topology configuration and returns findings.
 * A finding with level 'fail' indicates an unsafe configuration that must be
 * fixed before production deployment.
 *
 * This is the same logic used by scripts/rate-limit-topology-check.mjs,
 * extracted here for unit testing.
 */
export function evaluateRateLimitTopology(cfg: TopologyConfig): TopologyFinding[] {
  const findings: TopologyFinding[] = [];

  if (
    cfg.appEnv === 'production'
    && cfg.instanceCount > 1
    && !cfg.externalEnforced
    && !cfg.gatewayEnforced
    && !cfg.sharedStoreConfigured
  ) {
    findings.push({
      level: 'fail',
      name: 'RATE_LIMIT_EXTERNAL_ENFORCED',
      message:
        'multi-instance production deployments require an external shared rate limiter or an enforced edge gateway limiter',
    });
  }

  if (!cfg.explicitRateLimits) {
    findings.push({
      level: 'warn',
      name: 'RATE_LIMIT_*',
      message: 'explicit production rate-limit values are not configured',
    });
  }

  if (cfg.appEnv === 'production' && !cfg.explicitWindow) {
    findings.push({
      level: 'warn',
      name: 'RATE_LIMIT_WINDOW_MS',
      message: 'explicit production window is not configured',
    });
  }

  if (cfg.appEnv === 'production' && cfg.instanceCount > 1 && cfg.externalEnforced && !cfg.storeNamed) {
    findings.push({
      level: 'warn',
      name: 'RATE_LIMIT_STORE',
      message: 'external limiter is marked enforced but the store/provider is not named',
    });
  }

  return findings;
}

function parseRedisRateLimitReply(reply: unknown): [number, number] {
  if (!Array.isArray(reply) || reply.length < 2) {
    throw new Error('Unexpected Redis rate-limit response');
  }

  const count = Number(reply[0]);
  const ttl = Number(reply[1]);
  if (!Number.isFinite(count) || !Number.isFinite(ttl)) {
    throw new Error('Unexpected Redis rate-limit response');
  }
  return [count, ttl];
}
