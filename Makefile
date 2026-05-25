.PHONY: db-up db-migrate db-status api-dev worker-dev mcp-dev agent-dev build lint test ci

db-up:
	pnpm db:up

db-migrate:
	pnpm db:migrate

db-status:
	pnpm db:status

api-dev:
	pnpm --filter @managecallai/api dev

worker-dev:
	pnpm --filter @managecallai/worker dev

mcp-dev:
	pnpm --filter @managecallai/mcp-server dev

agent-dev:
	cd apps/freeswitch-agent && go run .

build:
	pnpm build

lint:
	pnpm lint

test:
	pnpm test

ci:
	pnpm install --frozen-lockfile
	pnpm build
	pnpm lint
	pnpm db:check
	pnpm test
	cd apps/freeswitch-agent && go build ./...
