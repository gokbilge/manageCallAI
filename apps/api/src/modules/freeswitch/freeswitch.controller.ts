import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { decryptSipPassword } from '../../crypto/sip-secret.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { ExtensionRepository } from '../extensions/extension.repository.js';
import { RouteLookupRepository } from './route-lookup.repository.js';

type DirectoryLookup = {
  section?: string;
  purpose?: string;
  user?: string;
  domain?: string;
  runtime_token?: string;
  key_name?: string;
  key_value?: string;
  sip_auth_username?: string;
  sip_to_user?: string;
  sip_auth_realm?: string;
  sip_to_host?: string;
};

type DialplanLookup = {
  destination_number?: string;
  'Caller-Destination-Number'?: string;
  'Hunt-Destination-Number'?: string;
  context?: string;
  domain?: string;
  domain_name?: string;
  runtime_token?: string;
};

const extensionRepo = new ExtensionRepository(db);
const routeLookupRepo = new RouteLookupRepository(db);

export async function freeswitchController(app: FastifyInstance): Promise<void> {
  const handler = async (
    lookup: DirectoryLookup,
  ): Promise<{ body: string; statusCode: number }> => {
    const normalized = normalizeDirectoryLookup(lookup);
    const user = normalized.user;
    const domain = normalized.domain;

    if (!user) {
      // Domain existence check from FreeSWITCH (no user param) — return 200 so FS
      // proceeds to the per-user sip_auth lookup instead of aborting with 403.
      return {
        statusCode: 200,
        body: buildNotFoundDirectory(domain ?? 'default'),
      };
    }

    if (!domain) {
      return {
        statusCode: 200,
        body: buildNotFoundDirectory('default'),
      };
    }

    const extension = await extensionRepo.findActiveByDirectoryLookup(user, domain);
    if (!extension) {
      return {
        statusCode: 404,
        body: buildNotFoundDirectory(domain),
      };
    }

    const password = decryptSipPassword(
      extension.sip_password_ciphertext,
      extension.sip_password_key_id,
    );

    return {
      statusCode: 200,
      body: buildDirectoryResponse({
        extensionId: extension.id,
        extensionNumber: extension.extension_number,
        displayName: extension.display_name,
        domain: extension.directory_domain,
        password,
      }),
    };
  };

  app.get<{ Querystring: DirectoryLookup }>(
    '/directory',
    { preHandler: authenticateRuntime },
    async (req, reply) => {
      const result = await handler(normalizeRequestLookup(req.query as DirectoryLookup, undefined));
      return reply
        .code(result.statusCode)
        .type('text/xml; charset=utf-8')
        .send(result.body);
    },
  );

  app.post<{ Body: DirectoryLookup }>(
    '/directory',
    { preHandler: authenticateRuntime },
    async (req, reply) => {
      const result = await handler(
        normalizeRequestLookup(
          req.query as DirectoryLookup,
          req.body as DirectoryLookup | string | undefined,
        ),
      );
      return reply
        .code(result.statusCode)
        .type('text/xml; charset=utf-8')
        .send(result.body);
    },
  );

  const dialplanHandler = async (
    lookup: DialplanLookup,
  ): Promise<{ body: string; statusCode: number }> => {
    const bodyParsed: DialplanLookup =
      typeof lookup === 'string'
        ? (Object.fromEntries(new URLSearchParams(lookup as string).entries()) as DialplanLookup)
        : lookup;

    const destinationNumber = firstNonEmpty(
      bodyParsed.destination_number,
      bodyParsed['Caller-Destination-Number'],
      bodyParsed['Hunt-Destination-Number'],
    );
    const domain = firstNonEmpty(bodyParsed.domain, bodyParsed.domain_name);

    if (!destinationNumber) {
      return { statusCode: 200, body: buildNotFoundDialplan() };
    }

    let tenantId: string | undefined;
    if (domain) {
      const tenant = await routeLookupRepo.findTenantByDomain(domain);
      if (!tenant) {
        return { statusCode: 200, body: buildNotFoundDialplan() };
      }
      tenantId = tenant.id;
    }

    if (!tenantId) {
      return { statusCode: 200, body: buildNotFoundDialplan() };
    }

    const route = await routeLookupRepo.findRouteForDialplan(tenantId, destinationNumber);
    if (!route || route.target_type !== 'extension' || !route.target_id) {
      return { statusCode: 200, body: buildNotFoundDialplan() };
    }

    const target = await routeLookupRepo.findExtensionTarget(route.target_id);
    if (!target || !target.directory_domain) {
      return { statusCode: 200, body: buildNotFoundDialplan() };
    }

    return {
      statusCode: 200,
      body: buildDialplanResponse({
        routeId: route.route_id,
        tenantId: route.tenant_id,
        matchValue: route.match_value,
        extensionNumber: target.extension_number,
        domain: target.directory_domain,
      }),
    };
  };

  app.get<{ Querystring: DialplanLookup }>(
    '/dialplan',
    { preHandler: authenticateRuntime },
    async (req, reply) => {
      const result = await dialplanHandler(req.query as DialplanLookup);
      return reply.code(result.statusCode).type('text/xml; charset=utf-8').send(result.body);
    },
  );

  app.post<{ Body: DialplanLookup }>(
    '/dialplan',
    { preHandler: authenticateRuntime },
    async (req, reply) => {
      const merged: DialplanLookup = {
        ...(typeof req.body === 'string'
          ? Object.fromEntries(new URLSearchParams(req.body as string).entries())
          : (req.body as DialplanLookup ?? {})),
        ...(req.query as DialplanLookup ?? {}),
      };
      const result = await dialplanHandler(merged);
      return reply.code(result.statusCode).type('text/xml; charset=utf-8').send(result.body);
    },
  );

  app.get<{ Querystring: { did?: string; trunk?: string } }>(
    '/route-lookup',
    { preHandler: authenticateRuntime },
    async (req, reply) => {
      const { did, trunk } = req.query as { did?: string; trunk?: string };
      if (!did?.trim()) {
        return reply.code(400).send({ error: 'did query parameter is required' });
      }

      const route = await routeLookupRepo.findRouteForCall(did.trim(), trunk?.trim());
      if (!route) {
        return reply.send({ matched: false });
      }

      let target = null;
      if (route.target_type === 'extension' && route.target_id) {
        target = await routeLookupRepo.findExtensionTarget(route.target_id);
      } else if (route.target_type === 'flow' && route.target_id) {
        target = await routeLookupRepo.findFlowTarget(route.target_id);
      }

      return reply.send({
        matched: true,
        route_id: route.route_id,
        tenant_id: route.tenant_id,
        target_type: route.target_type,
        target_id: route.target_id,
        target,
      });
    },
  );
}

function normalizeRequestLookup(
  query: DirectoryLookup | undefined,
  body: DirectoryLookup | string | undefined,
): DirectoryLookup {
  const bodyLookup =
    typeof body === 'string'
      ? Object.fromEntries(new URLSearchParams(body).entries())
      : (body ?? {});

  return {
    ...(bodyLookup as DirectoryLookup),
    ...(query ?? {}),
  };
}

function normalizeDirectoryLookup(lookup: DirectoryLookup): {
  user?: string;
  domain?: string;
} {
  const user = firstNonEmpty(
    lookup.user,
    lookup.sip_auth_username,
    lookup.sip_to_user,
    lookup.key_name === 'id' ? lookup.key_value : undefined,
  );

  const domain = firstNonEmpty(
    lookup.domain,
    lookup.sip_auth_realm,
    lookup.sip_to_host,
    lookup.key_name === 'name' ? lookup.key_value : undefined,
  );

  return { user, domain };
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value?.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildDirectoryResponse(input: {
  extensionId: string;
  extensionNumber: string;
  displayName: string;
  domain: string;
  password: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<document type="freeswitch/xml">
  <section name="directory">
    <domain name="${xmlEscape(input.domain)}">
      <groups>
        <group name="default">
          <users>
            <user id="${xmlEscape(input.extensionNumber)}">
              <params>
                <param name="password" value="${xmlEscape(input.password)}" />
              </params>
              <variables>
                <variable name="user_context" value="default" />
                <variable name="effective_caller_id_name" value="${xmlEscape(input.displayName)}" />
                <variable name="effective_caller_id_number" value="${xmlEscape(input.extensionNumber)}" />
                <variable name="managecall_extension_id" value="${xmlEscape(input.extensionId)}" />
              </variables>
            </user>
          </users>
        </group>
      </groups>
    </domain>
  </section>
</document>`;
}

function buildNotFoundDirectory(domain: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<document type="freeswitch/xml">
  <section name="directory">
    <domain name="${xmlEscape(domain)}">
      <groups />
    </domain>
  </section>
</document>`;
}

function buildDialplanResponse(input: {
  routeId: string;
  tenantId: string;
  matchValue: string;
  extensionNumber: string;
  domain: string;
}): string {
  const bridge = `sofia/internal/${input.extensionNumber}@${input.domain}`;
  const destinationPattern = `^${regexEscape(input.matchValue)}$`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<document type="freeswitch/xml">
  <section name="dialplan">
    <context name="default">
      <extension name="managecall_inbound_${xmlEscape(input.routeId)}" continue="false">
        <condition field="destination_number" expression="${xmlEscape(destinationPattern)}">
          <action application="set" data="managecall_route_id=${xmlEscape(input.routeId)}" />
          <action application="set" data="managecall_tenant_id=${xmlEscape(input.tenantId)}" />
          <action application="bridge" data="${xmlEscape(bridge)}" />
        </condition>
      </extension>
    </context>
  </section>
</document>`;
}

function buildNotFoundDialplan(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<document type="freeswitch/xml">
  <section name="dialplan">
    <context name="default" />
  </section>
</document>`;
}
