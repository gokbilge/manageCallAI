# Open-Core Architecture

Last updated: 2026-06-07.

This document defines the intended open-core architecture for manageCallAI as it
prepares for Free, Pro, and Enterprise editions.

## Core posture

manageCallAI Core remains public and open-source.

The public repository remains the useful self-hosted and community edition of
the product. It should stay installable, understandable, and operational for
operators who only need the public control-plane baseline.

For packaging and go-to-market purposes:

- `Core` means the public codebase and extension points
- `Free` means the public self-hosted community edition built from Core
- `Pro` and `Enterprise` mean future commercial editions that may combine the
  public core with private modules, private packages, private images, hosted
  services, support contracts, and signed entitlements

## License posture

- The repository remains Apache-2.0 today.
- Existing Apache-2.0 releases are not relicensed retroactively.
- This document does not change the `LICENSE` file.
- No current public code is removed or hidden by this architecture work.

## Commercial delivery posture

Future Pro and Enterprise capabilities may be delivered through one or more of:

- private TypeScript or Go modules
- private npm or GitHub Packages packages
- private container images
- hosted control-plane services
- support and certification contracts
- signed offline entitlements verified by the API

The public repository should contain only the public control-plane baseline,
public extension interfaces, and public entitlement boundaries. It should not
contain future private commercial implementations.

## Fork protection model

Fork protection is achieved primarily by not publishing paid implementation code.

Public forkers can continue using the public core under the repository license.
They do not automatically receive:

- private Pro or Enterprise modules
- official trademark rights
- official certified images
- license portal access
- support portal access
- enterprise migration intelligence implementations

## Entitlement authority

The backend API is the entitlement authority.

That means:

- FreeSWITCH does not enforce manageCallAI commercial licensing
- Lua does not enforce manageCallAI commercial licensing
- the Go FreeSWITCH agent does not become the commercial enforcement boundary
- the frontend must not be trusted as the only visibility or gating layer

Frontend hiding may improve UX, but entitlement decisions must be enforced at
the API layer before private capability paths execute.

## Local deployment protection posture

For local or self-hosted Pro and Enterprise installs, signed offline license
files are the intended entitlement input.

This protection is tamper-resistant, not tamper-proof.

That is expected. Real commercial protection comes from the combination of:

- private commercial modules
- private package registries
- private container images
- support and update access
- certified builds
- legal license terms
- trademark and brand control

## Runtime boundary

FreeSWITCH remains a separate runtime component.

manageCallAI commercial licensing must not be implemented inside FreeSWITCH.
FreeSWITCH should continue acting only as the signaling and media runtime that
consumes API-owned artifacts and runtime credentials.

## Design rules

- Public Core stays useful and installable on its own.
- Pro and Enterprise capabilities must be designed so they can live outside the
  public repository later.
- Public extension points must not require loading unknown remote code.
- Private modules must not be auto-enabled without entitlement.
- Entitlement failures must degrade safely and must not interrupt existing live
  call routing abruptly.

## Maintainer decisions still required

- Whether future versions remain Apache-2.0 core plus private modules, or move
  to a different community-license model later
- Which future features stay public, and which become private commercial modules
- Whether official Pro and Enterprise self-hosted distribution uses the same
  public images plus private add-ons, or edition-specific private images
