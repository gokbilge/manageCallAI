# FusionPBX Migration Map

## Source access methods

- PostgreSQL export
- FreeSWITCH XML/domain configuration export
- read-only discovery script output

## High-confidence imports

- domains/tenants with explicit mapping
- extensions
- gateways
- DIDs
- inbound routes
- basic outbound routes
- ring groups
- queues
- IVRs that remain inside supported route targets

## Equivalent/approximate imports

- dialplans that map to supported routing primitives
- domain defaults -> site/location defaults
- time conditions -> schedule groups

## Manual-review imports

- custom XML dialplan blocks
- custom Lua logic
- tenant/domain behavior that depends on unsupported runtime assumptions
- complex failover logic implemented outside normal route lists

## Unsupported imports

- executable import of raw FreeSWITCH XML/Lua
- source-specific runtime hacks with no control-plane equivalent

## Source concepts and manageCallAI mappings

| Source concept | Target mapping |
| --- | --- |
| Domain | Tenant or site boundary |
| Extension | Extension |
| Gateway | SIP trunk |
| Dialplan | Inbound/outbound route or IVR flow, depending on behavior |
| Ring group | Call group |
| Queue | Queue |
| Time condition | Schedule group |

## Target manageCallAI capabilities required

- tenant/site/domain mapping rules
- trunk-group routing for failover interpretation
- schedule groups and timezone-aware evaluation
- validation and simulation depth

## Security considerations

- exported DB and XML artifacts may contain credentials and realm data
- source runtime scripts must never be executed
- tenant/domain mapping must not cross-contaminate imported objects

## Data handling and secret handling

- redact secrets from gateway exports
- retain source domain identifiers and hashes
- preserve unsupported XML/Lua snippets only as review metadata

## Validation and simulation requirements

- verify domain-to-tenant mapping
- verify route and IVR target resolution
- verify trunk references and failover ordering

## Cutover considerations

- confirm domain and dial-string ownership before switching trunks or DIDs
- test local and external call paths per imported domain

## Rollback considerations

- maintain source export hash
- keep import draft-only until reviewed per domain/site

## Open questions

- which FusionPBX dialplan and XML patterns can be normalized automatically
- how much tenant/domain behavior should be modeled as site defaults vs tenant-level policy
