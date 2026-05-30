import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  ClaimOutboundMessageBodySchema,
  CompleteOutboundMessageBodySchema,
  CreateOutboundMessageBodySchema,
  IngestInboundMessageBodySchema,
  UuidParamsSchema,
} from '@managecallai/contracts';
import { db } from '../../db/client.js';
import type { AuthClaims } from '../auth/auth-claims.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { requireCapability } from '../auth/require-capability.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { ChannelMessageRepository } from './channel-message.repository.js';
import {
  ChannelAccountInvalidError,
  ChannelMessageRequestNotFoundError,
  ChannelMessageService,
} from './channel-message.service.js';
import { sendInvalidArgument, sendNotFound } from '../../errors/index.js';

const service = new ChannelMessageService(new ChannelMessageRepository(db));

function replyError(err: unknown, reply: FastifyReply): void {
  if (err instanceof ChannelAccountInvalidError) {
    return sendInvalidArgument(reply, err.message);
  }
  if (err instanceof ChannelMessageRequestNotFoundError) {
    return sendNotFound(reply, err.message);
  }
  throw err;
}

export const channelMessageController: FastifyPluginAsyncZod = async (app) => {
  async function createOutbound(
    req: { user: unknown; body: z.infer<typeof CreateOutboundMessageBodySchema> },
    reply: FastifyReply,
  ) {
    const user = req.user as AuthClaims;
    try {
      const result = await service.createOutboundRequest({
        tenant_id: user.tenant_id,
        ...req.body,
      });
      return reply.code(201).send({ data: result });
    } catch (err) {
      return replyError(err, reply);
    }
  }

  async function claimOutbound(req: { body: z.infer<typeof ClaimOutboundMessageBodySchema> }) {
    return { data: await service.claimNextOutboundRequest(req.body) };
  }

  async function completeOutbound(
    req: {
      params: z.infer<typeof UuidParamsSchema>;
      body: z.infer<typeof CompleteOutboundMessageBodySchema>;
    },
    reply: FastifyReply,
  ) {
    try {
      return { data: await service.completeOutboundRequest(req.params.id, req.body) };
    } catch (err) {
      return replyError(err, reply);
    }
  }

  app.post(
    '/accounts/:accountId/webhook',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: z.object({ accountId: z.string() }),
        body: IngestInboundMessageBodySchema.omit({ channel_account_id: true }),
      },
    },
    async (req, reply) => {
      try {
        const { tenant_id, ...body } = req.body;
        const msg = await service.ingestInbound({
          tenant_id,
          channel_account_id: req.params.accountId,
          ...body,
        });
        return reply.code(201).send({ data: msg });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/messages/inbound/internal',
    {
      preHandler: authenticateRuntime,
      schema: {
        body: IngestInboundMessageBodySchema,
      },
    },
    async (req, reply) => {
      try {
        const msg = await service.ingestInbound(req.body);
        return reply.code(201).send({ data: msg });
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.get(
    '/accounts/:accountId/messages',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_MESSAGES_VIEW),
      schema: { params: z.object({ accountId: z.string() }) },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listMessages(user.tenant_id, req.params.accountId) };
    },
  );

  app.post(
    '/messages/outbound',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_MESSAGES_SEND),
      schema: {
        body: CreateOutboundMessageBodySchema,
      },
    },
    createOutbound,
  );

  app.post(
    '/requests',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_MESSAGES_SEND),
      schema: {
        body: CreateOutboundMessageBodySchema,
      },
    },
    createOutbound,
  );

  app.get(
    '/accounts/:accountId/requests',
    {
      preHandler: requireCapability(CAPABILITIES.TENANT_CHANNEL_MESSAGES_VIEW),
      schema: { params: z.object({ accountId: z.string() }) },
    },
    async (req) => {
      const user = req.user as AuthClaims;
      return { data: await service.listRequests(user.tenant_id, req.params.accountId) };
    },
  );

  app.post(
    '/messages/outbound/internal/claim',
    {
      preHandler: authenticateRuntime,
      schema: {
        body: ClaimOutboundMessageBodySchema,
      },
    },
    async (req, reply) => {
      try {
        return await claimOutbound(req);
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/requests/internal/claim',
    {
      preHandler: authenticateRuntime,
      schema: {
        body: ClaimOutboundMessageBodySchema,
      },
    },
    async (req, reply) => {
      try {
        return await claimOutbound(req);
      } catch (err) {
        return replyError(err, reply);
      }
    },
  );

  app.post(
    '/messages/outbound/:id/internal/result',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: UuidParamsSchema,
        body: CompleteOutboundMessageBodySchema,
      },
    },
    completeOutbound,
  );

  app.post(
    '/requests/:id/internal/result',
    {
      preHandler: authenticateRuntime,
      schema: {
        params: UuidParamsSchema,
        body: CompleteOutboundMessageBodySchema,
      },
    },
    completeOutbound,
  );
};
