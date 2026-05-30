# Dependency Audit Exceptions

This file documents accepted exceptions to the `pnpm audit --audit-level=high` gate.

## Process

When a new high or critical vulnerability is reported by `pnpm audit`:

1. Assess whether the vulnerability affects the deployed runtime path.
2. If a patch is available: update the dependency and remove the exception.
3. If no patch exists and the vulnerability does not affect the runtime path:
   - Document the exception below with the advisory ID, package, reason, and review date.
   - The CI gate uses `--audit-level=high`; exceptions are managed by raising the threshold
     for specific advisories using `.pnpmfile.cjs` overrides or by tracking them here until
     a patch is available.

## Active exceptions

_(none at this time)_

## Closed exceptions

| Advisory | Package | Version | Reason | Closed |
|----------|---------|---------|--------|--------|

## Reviewing exceptions

Exceptions should be reviewed at least quarterly. Set a calendar reminder to run:

```sh
pnpm audit --audit-level=moderate --json | node -e "
  const d=require('fs').readFileSync('/dev/stdin','utf8');
  const r=JSON.parse(d);
  const h=Object.values(r.advisories||{}).filter(a=>a.severity==='high'||a.severity==='critical');
  console.log(h.length+' high/critical advisories');
  h.forEach(a=>console.log(' -',a.module_name,a.title));
"
```
