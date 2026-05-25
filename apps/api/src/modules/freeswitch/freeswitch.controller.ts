import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { ExtensionRepository } from '../extensions/extension.repository.js';

type DirectoryLookup = {
  section?: string;
  purpose?: string;
  user?: string;
  domain?: string;
  runtime_token?: string;
};

const extensionRepo = new ExtensionRepository(db);

export async function freeswitchController(app: FastifyInstance): Promise<void> {
  const handler = async (
    lookup: DirectoryLookup,
  ): Promise<{ body: string; statusCode: number }> => {
    const user = lookup.user?.trim();
    const domain = lookup.domain?.trim();

    if (!user) {
      return {
        statusCode: 400,
        body: buildNotFoundDirectory(domain ?? 'default'),
      };
    }

    if (!domain) {
      return {
        statusCode: 400,
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

    return {
      statusCode: 200,
      body: buildDirectoryResponse({
        extensionId: extension.id,
        extensionNumber: extension.extension_number,
        displayName: extension.display_name,
        domain: extension.directory_domain,
        password: extension.sip_password,
      }),
    };
  };

  app.get<{ Querystring: DirectoryLookup }>(
    '/directory',
    { preHandler: authenticateRuntime },
    async (req, reply) => {
      const result = await handler(req.query);
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
      const result = await handler(req.body ?? {});
      return reply
        .code(result.statusCode)
        .type('text/xml; charset=utf-8')
        .send(result.body);
    },
  );
}

function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
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
