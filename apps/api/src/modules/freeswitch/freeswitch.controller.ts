import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { decryptSipPassword } from '../../crypto/sip-secret.js';
import { authenticateRuntime } from '../runtime/runtime-auth.js';
import { ExtensionRepository } from '../extensions/extension.repository.js';

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

const extensionRepo = new ExtensionRepository(db);

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
