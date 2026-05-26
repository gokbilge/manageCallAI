# CI/CD

`manageCallAI` now uses two GitHub Actions workflows:

- `CI`: validates migrations, TypeScript build, lint, tests, and Go build
- `Docker Images`: builds container images for runtime services and publishes them to GHCR on `main`, tags, or manual dispatch

## Published Image Targets

- `ghcr.io/gokbilge/managecallai-api`
- `ghcr.io/gokbilge/managecallai-worker`
- `ghcr.io/gokbilge/managecallai-mcp-server`
- `ghcr.io/gokbilge/managecallai-freeswitch-agent`

## Workflow Behavior

- Pull requests build all images without pushing
- Pushes to `main` build and push images to GHCR
- Tags matching `v*` build and push versioned images
- `workflow_dispatch` allows manual image publication

## Notes

- The API CI workflow sets explicit runtime and SIP secret environment variables so integration tests do not depend on local `.env` files.
- The Docker workflow uses GitHub Actions cache for Buildx layers.
- The FreeSWITCH reference Dockerfile is kept in the repo, but it is not published by the GHCR workflow yet because the current upstream `signalwire/freeswitch:latest` base image was not publicly pullable during verification.
