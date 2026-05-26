import '@fastify/jwt';
import 'fastify';
import type { AuthClaims } from './modules/auth/auth-claims.js';

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
    jwtVerify(): Promise<void>;
  }
}
