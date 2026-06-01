# Release Evidence Bundle

Production release candidates require a signed-off JSON manifest checked with:

```sh
pnpm release:evidence-check -- --manifest=artifacts/release/release-evidence.json
```

## Manifest Format

```json
{
  "release_version": "v0.3.0-rc.1",
  "commit_sha": "0123456789abcdef",
  "generated_at": "2026-06-01T00:00:00Z",
  "ci_run_url": "https://github.com/gokbilge/manageCallAI/actions/runs/1",
  "codeql_run_url": "https://github.com/gokbilge/manageCallAI/actions/runs/2",
  "coverage_run_url": "https://github.com/gokbilge/manageCallAI/actions/runs/3",
  "docker_images_run_url": "https://github.com/gokbilge/manageCallAI/actions/runs/4",
  "production_preflight": "passed",
  "production_e2e": "passed",
  "production_soak": "passed",
  "production_slo": "passed",
  "restore_smoke": "passed",
  "rate_limit_topology": "passed",
  "carrier_interop": ["example-carrier/prod-us-east-1"],
  "security_review": "completed",
  "rollback_plan": "docs/ops/production-deployment.md#upgrade-and-migration-playbook",
  "operator_signoff": {
    "name": "Release Manager",
    "role": "platform operator",
    "approved_at": "2026-06-01T00:00:00Z"
  },
  "artifact_files": {
    "runtime_slo": "artifacts/release/runtime-slo.json"
  }
}
```

`artifact_files` is optional, but every declared path must exist on the release
machine. Keep artifacts sanitized and outside git; `artifacts/` is ignored.
