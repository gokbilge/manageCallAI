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
  "freeswitch_smoke_run_url": "https://github.com/gokbilge/manageCallAI/actions/runs/5",
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
    "runtime_slo": "artifacts/release/runtime-slo.json",
    "freeswitch_smoke_evidence": "artifacts/production-e2e/production-runtime-e2e-<timestamp>.json"
  }
}
```

The `freeswitch_smoke_run_url` field must point to a **passing** self-hosted `FreeSWITCH runtime smoke`
workflow run from the RC or release branch. This is the required status check enforced by the
`Release and RC smoke gate` repository ruleset. The run URL is available in GitHub Actions after the
workflow completes; copy the URL from the browser or via:

```sh
gh run list --workflow=freeswitch-smoke.yml --branch=rc/<version> --json url --jq '.[0].url'
```

`artifact_files` is optional, but every declared path must exist on the release
machine. Keep artifacts sanitized and outside git; `artifacts/` is ignored.

---

## Required Evidence for Production Release

Do not claim production readiness unless **every item** below has a real
artifact tied to the release candidate commit and is validated by its
respective check script. Check-config mode does not count.

| Evidence category | Required artifact | Check script |
|---|---|---|
| CI gate | Passing GitHub Actions CI run URL | Structural check in manifest |
| CodeQL / security scan | Passing CodeQL run URL | Structural check |
| Coverage | Passing coverage run URL | Structural check |
| Docker image builds | Passing docker-images run URL | Structural check |
| FreeSWITCH runtime smoke | Passing self-hosted smoke run on `release/**` or `rc/**` | `freeswitch-smoke.yml` required status check |
| Production preflight | Preflight evidence JSON with `status: passed` | `scripts/production-preflight.mjs` |
| Production E2E | E2E evidence JSON with all steps passed | `scripts/check-runtime-e2e-evidence.mjs` |
| SIP TLS/SRTP/NAT | TLS/SRTP evidence JSON with `mode: live`, `status: passed` | `scripts/check-sip-tls-srtp-nat-evidence.mjs` |
| FreeSWITCH hardening | Hardening evidence JSON with `mode: live`, `status: passed` | `scripts/check-freeswitch-hardening.mjs` |
| Restore rehearsal | Restore evidence JSON with `status: passed` | `scripts/restore-evidence-check.mjs` |
| Backup retention policy | Policy JSON validated against schema | `scripts/check-backup-retention-policy.mjs` |
| Runtime token rotation | Rotation rehearsal evidence or clean-rotation confirmation | `scripts/check-runtime-token-rotation.mjs` |
| Log redaction | Redaction evidence with all test cases passing | `scripts/check-log-redaction.mjs` |
| Rate-limit topology | Rate-limit check passing with 0 warnings | `scripts/rate-limit-topology-check.mjs` |
| Production soak | Soak evidence JSON with `failure_rate: 0` and SLO thresholds met | `scripts/production-soak.mjs` |
| Runtime SLO | SLO evidence JSON with p95/p99 within declared thresholds | `scripts/production-slo-check.mjs` |
| Carrier interop | Carrier evidence JSON, all 8 scenarios passed or documented_exception | `scripts/carrier-interop-check.mjs` |
| Security / fraud review | Confirmation that CodeQL and fraud controls are reviewed | Structural check |
| Rollback plan | Link to tested upgrade/migration rollback procedure | Structural check |
| Operator signoff | Name, role, timestamp in manifest | `scripts/release-evidence-check.mjs` |

**Passing this gate is necessary but not sufficient for production.** The
release evidence bundle confirms that all individual gates have been run and
passed. It does not substitute for the judgment of the operator signing off.
