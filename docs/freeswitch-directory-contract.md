# FreeSWITCH Directory Contract

## Purpose

This document defines the MVP `mod_xml_curl` directory contract between stock FreeSWITCH and `manageCallAI`.

The first goal is extension directory lookup for SIP registration and basic identity resolution.

## Scope

MVP scope is limited to extension directory lookup.

This contract does not cover full dialplan generation or routing logic.

## Request Shape

FreeSWITCH invokes the backend through `mod_xml_curl` using a directory lookup request.

Expected fields the backend should use:

- `section=directory`
- `purpose`
- `user`
- `domain`
- Runtime auth credential. For `mod_xml_curl`, use HTTP Basic Auth with the
  runtime token as the password: `http://fs:<RUNTIME_API_TOKEN>@host/path`.
  Lua and agent calls should use `Authorization: Bearer <RUNTIME_API_TOKEN>` or
  `x-managecallai-runtime-token`.

The backend should treat:

- `domain` as the tenant boundary
- `user` as the per-tenant extension lookup key

## MVP Tenant Assumption

MVP resolves tenants through `tenant.directory_domain`.

That means:

- `domain` is a required lookup input
- directory lookup is tenant-scoped
- the returned credential is the extension-specific SIP password, not a global shared password

## Happy-Path Backend Behavior

When an active extension is found:

1. Load tenant and extension data from PostgreSQL.
2. Resolve the tenant through `tenant.directory_domain`.
3. Return valid FreeSWITCH directory XML with the extension-specific SIP password.

## Not-Found Behavior

When no active extension is found:

- return an empty directory result
- do not invent placeholder users
- keep the response syntactically valid for FreeSWITCH

## Example Request

Example request body or query shape from FreeSWITCH:

```text
section=directory
purpose=sip_auth
user=1001
domain=acme-demo.managecallai.local
Authorization: Basic base64("fs:change-me-runtime-token")
```

## Example Success Response

```xml
<?xml version="1.0" encoding="UTF-8"?>
<document type="freeswitch/xml">
  <section name="directory">
    <domain name="acme-demo.managecallai.local">
      <groups>
        <group name="default">
          <users>
            <user id="1001">
              <params>
                <param name="password" value="EXTENSION_SPECIFIC_SECRET" />
              </params>
              <variables>
                <variable name="user_context" value="default" />
                <variable name="effective_caller_id_name" value="Sales Front Desk" />
                <variable name="effective_caller_id_number" value="1001" />
                <variable name="managecall_extension_id" value="ext_001" />
              </variables>
            </user>
          </users>
        </group>
      </groups>
    </domain>
  </section>
</document>
```

## Example Not-Found Response

```xml
<?xml version="1.0" encoding="UTF-8"?>
<document type="freeswitch/xml">
  <section name="directory">
    <domain name="acme-demo.managecallai.local">
      <groups />
    </domain>
  </section>
</document>
```

## Required Fields

The backend should rely on:

- `extension_number`
- `display_name`
- `status`
- `sip_username`
- `sip_password_ciphertext` + `sip_password_key_id` (decrypted to plaintext only at XML generation)
- `tenant.directory_domain`

## Secret Handling

SIP passwords are stored encrypted-at-rest using AES-256-GCM. The plaintext is derived only in the
FreeSWITCH directory handler immediately before building the XML response. It is not logged or cached.

The active key is identified by `sip_password_key_id`, enabling future key rotation without re-encrypting
in SQL. See `docs/design/database-schema.md §4.3` for schema detail.

Future versions may incorporate:

- external secret-store integration (Vault, AWS Secrets Manager)
- per-extension registration policy

## Notes

- Do not place business logic in the XML response layer.
- Directory lookup should remain a thin projection of backend state.
- Runtime callers must authenticate with the shared runtime token.
- Header-based runtime auth is preferred in production; query/body token transport exists for local MVP compatibility with `mod_xml_curl`.
- Secret material used for auth should follow the repo's secret-handling rules and not live long-term in general JSONB fields.
