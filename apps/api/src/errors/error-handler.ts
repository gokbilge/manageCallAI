import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ErrorCode } from './error-codes.js';

interface ErrorBody {
  error: ErrorCode;
  message: string;
  request_id: string;
}

function buildBody(code: ErrorCode, message: string, req: FastifyRequest): ErrorBody {
  return { error: code, message, request_id: req.id };
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.addHook('onSend', (_req, reply, _payload, done) => {
    reply.header('x-request-id', reply.request.id);
    done();
  });

  app.setErrorHandler(
    (error: FastifyError, req: FastifyRequest, reply: FastifyReply) => {
      if (error.validation) {
        const msg = error.validation.map((v) => v.message ?? 'Invalid field').join('; ');
        return reply
          .code(400)
          .send(buildBody(ErrorCode.INVALID_ARGUMENT, msg, req));
      }

      const status = error.statusCode ?? 500;

      if (status === 401) {
        return reply
          .code(401)
          .send(buildBody(ErrorCode.UNAUTHENTICATED, 'Unauthenticated', req));
      }

      if (status === 403) {
        return reply
          .code(403)
          .send(buildBody(ErrorCode.PERMISSION_DENIED, 'Permission denied', req));
      }

      if (status === 404) {
        return reply
          .code(404)
          .send(buildBody(ErrorCode.NOT_FOUND, error.message || 'Not found', req));
      }

      if (status === 409) {
        return reply
          .code(409)
          .send(buildBody(ErrorCode.CONFLICT, error.message || 'Conflict', req));
      }

      if (status === 429) {
        return reply
          .code(429)
          .send(buildBody(ErrorCode.RESOURCE_EXHAUSTED, 'Too many requests', req));
      }

      if (status >= 400 && status < 500) {
        return reply
          .code(status)
          .send(buildBody(ErrorCode.INVALID_ARGUMENT, error.message || 'Bad request', req));
      }

      if (status === 503) {
        return reply
          .code(503)
          .send(buildBody(ErrorCode.UNAVAILABLE, 'Service unavailable', req));
      }

      req.log.error(
        {
          err_code: ErrorCode.INTERNAL,
          err_name: error.name,
          req_id: req.id,
          stack: error.stack,
        },
        'Unhandled error',
      );

      return reply
        .code(500)
        .send(buildBody(ErrorCode.INTERNAL, 'Internal server error', req));
    },
  );
}
