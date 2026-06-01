# Audit - FreeSWITCH smoke release gate - 2026-06-01

**Commit:** 4a72d13
**Scope:** Issue #53 release/RC FreeSWITCH smoke CI gate.
**Result:** PASS

## Findings

### AUD-2026-06-01-002: FreeSWITCH smoke was not wired as a release/RC gate

- **Status:** done
- **Severity:** high
- **Location:** `.github/workflows/freeswitch-smoke.yml`
- **Finding:** The self-hosted FreeSWITCH smoke workflow existed but was documented as optional and did not run for PRs targeting release or RC branches. The normal CI workflow only documented a commented-out live smoke step.
- **Fix:** Converted the FreeSWITCH smoke workflow into the required release/RC branch gate, added PR triggers for `release/**` and `rc/**`, removed skip/continue-on-error behavior, documented the required `FreeSWITCH runtime smoke` status check, and updated release evidence requirements.
- **Issue:** https://github.com/gokbilge/manageCallAI/issues/53
- **Resolved:** 4a72d13
