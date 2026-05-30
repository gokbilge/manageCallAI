FROM node:22-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /workspace

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @managecallai/contracts build
RUN pnpm --filter @managecallai/mcp build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /workspace

COPY --from=builder /workspace /workspace

WORKDIR /workspace/apps/mcp

# Required: MANAGECALL_API_KEY and MANAGECALL_API_URL
CMD ["node", "dist/index.js"]
