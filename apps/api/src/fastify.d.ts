import '@fastify/jwt';
import 'fastify';
import type { AuthClaims } from './modules/auth/auth-claims.js';

interface RuntimeClaims {
  tenant_id?: string;
  auth_type: 'bearer' | 'basic' | 'header' | 'fallback';
  node_id?: string; // SLICE-43: set when authenticated via node HMAC
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: AuthClaims;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    jwt: {
      sign(payload: AuthClaims): string;
    };
  }

  interface FastifyRequest {
    user: AuthClaims;
    runtime?: RuntimeClaims;
    jwtVerify(): Promise<void>;
  }
}
