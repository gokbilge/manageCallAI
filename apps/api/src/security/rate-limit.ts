import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
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

const limiter = new InMemoryRateLimiter();

const policies = {
  auth: { name: 'auth', limit: config.rateLimitAuthMax, windowMs: config.rateLimitWindowMs },
  runtime: { name: 'runtime', limit: config.rateLimitRuntimeMax, windowMs: config.rateLimitWindowMs },
  webhook: { name: 'webhook', limit: config.rateLimitWebhookMax, windowMs: config.rateLimitWindowMs },
  outbound: { name: 'outbound', limit: config.rateLimitOutboundMax, windowMs: config.rateLimitWindowMs },
  api: { name: 'api', limit: config.rateLimitApiMax, windowMs: config.rateLimitWindowMs },
  scrape: { name: 'scrape', limit: config.rateLimitScrapeMax, windowMs: config.rateLimitWindowMs },
} satisfies Record<string, RateLimitPolicy>;

export function registerRateLimitHook(app: FastifyInstance): void {
  app.addHook('onRequest', async (req, reply) => {
    const policy = policyForPath(req.method, req.url);
    if (!policy) return;

    const key = `${policy.name}:${clientKey(req)}`;
    const result = limiter.take(key, policy);
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
