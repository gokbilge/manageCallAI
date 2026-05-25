# FreeSWITCH Directory Contract

## Purpose

This document defines the MVP `mod_xml_curl` directory contract between stock FreeSWITCH and `manageCallAI`.

The first goal is extension directory lookup for SIP registration and basic identity resolution.

## Scope

MVP scope is limited to extension directory lookup.

This contract does not cover full dialplan generation, routing logic, or advanced multi-tenant directory behavior.

## Request Shape

FreeSWITCH will invoke the backend through `mod_xml_curl` using a directory lookup request.

Expected fields the backend should use:

- `section=directory`
- `purpose`
- `user`
- `domain`

The backend should treat `user` as the primary extension lookup key for MVP.

## MVP Tenant Assumption

MVP is effectively single-tenant.

That means:

- tenant resolution may be implicit
- `domain` can be treated as a routing hint rather than a hard multi-tenant boundary
- later multi-tenant work should formalize tenant-to-domain mapping

## Happy-Path Backend Behavior

When an active extension is found:

1. Load extension data from PostgreSQL
2. Construct a valid FreeSWITCH directory XML response
3. Return the user record with enough variables and parameters for SIP registration

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
domain=pbx.local
```

## Example Success Response

```xml
<?xml version="1.0" encoding="UTF-8"?>
<document type="freeswitch/xml">
  <section name="directory">
    <domain name="pbx.local">
      <groups>
        <group name="default">
          <users>
            <user id="1001">
              <params>
                <param name="password" value="REDACTED_OR_RUNTIME_SECRET" />
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
    <domain name="pbx.local">
      <groups />
    </domain>
  </section>
</document>
```

## Required Extension Fields

The backend should rely on:

- `extension_number`
- `display_name`
- `status`
- `id`

Future versions may incorporate:

- tenant-domain mapping
- authentication secret indirection
- per-extension registration policy

## Notes

- Do not place business logic in the XML response layer.
- Directory lookup should remain a thin projection of backend state.
- Secret material used for auth should follow the repo’s secret-handling rules and not live long-term in general JSONB fields.
