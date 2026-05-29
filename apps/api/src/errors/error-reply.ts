import type { FastifyReply } from 'fastify';
import { ErrorCode } from './error-codes.js';

// Use reply.request.id — set at request creation time, always non-empty.
// Avoids relying on the x-request-id header which is set later in onSend.
function requestId(reply: FastifyReply): string {
  return reply.request.id;
}

function send(reply: FastifyReply, httpStatus: number, code: ErrorCode, message: string): void {
  reply.code(httpStatus).send({ error: code, message, request_id: requestId(reply) });
}

export function sendNotFound(reply: FastifyReply, message = 'Resource not found'): void {
  send(reply, 404, ErrorCode.NOT_FOUND, message);
}

export function sendInvalidArgument(reply: FastifyReply, message = 'Invalid argument'): void {
  send(reply, 400, ErrorCode.INVALID_ARGUMENT, message);
}

export function sendUnauthenticated(reply: FastifyReply, message = 'Unauthenticated'): void {
  send(reply, 401, ErrorCode.UNAUTHENTICATED, message);
}

export function sendPermissionDenied(reply: FastifyReply, message = 'Permission denied'): void {
  send(reply, 403, ErrorCode.PERMISSION_DENIED, message);
}

/** Duplicate resource / unique-constraint violation. */
export function sendAlreadyExists(reply: FastifyReply, message = 'Resource already exists'): void {
  send(reply, 409, ErrorCode.ALREADY_EXISTS, message);
}

/** Generic conflict — use when neither duplicate nor invalid state is the precise cause. */
export function sendConflict(reply: FastifyReply, message = 'Conflict'): void {
  send(reply, 409, ErrorCode.CONFLICT, message);
}

/** Invalid state transition — the request is well-formed but the resource is in the wrong state. */
export function sendFailedPrecondition(reply: FastifyReply, message = 'Failed precondition'): void {
  send(reply, 409, ErrorCode.FAILED_PRECONDITION, message);
}

export function sendResourceExhausted(reply: FastifyReply, message = 'Resource exhausted'): void {
  send(reply, 429, ErrorCode.RESOURCE_EXHAUSTED, message);
}

export function sendInternal(reply: FastifyReply, message = 'Internal server error'): void {
  send(reply, 500, ErrorCode.INTERNAL, message);
}

export function sendUnavailable(reply: FastifyReply, message = 'Service unavailable'): void {
  send(reply, 503, ErrorCode.UNAVAILABLE, message);
}
