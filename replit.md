# Smart Home Automation Management System

A persistent smart-home simulator for managing devices, rooms, schedules, and activity from one responsive dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/smart-home run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required environment: `DATABASE_URL` and managed Clerk Auth keys; service workflows also provide `PORT` and `BASE_PATH`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/smart-home` — Smart Home React/Vite web app
- `artifacts/api-server/src/routes/home.ts` — authenticated home, device, schedule, and activity API
- `artifacts/api-server/src/lib/automation-runner.ts` — recurring automation execution
- `lib/db/src/schema` — persistent PostgreSQL models
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `README.md` — setup, features, environment, and automation details

## Architecture decisions

- Clerk owns sign-up, sign-in, sessions, and sign-out; local users are keyed by Clerk's stable user ID.
- Each account receives demo devices exactly once during authenticated account initialization.
- Schedule checks use each account's saved time zone and track the last executed local minute to avoid duplicate runs.

## Product

Users manage simulated appliances by room, control light brightness and fan speed, create recurring schedules, and review persistent activity and estimated energy use.

## User preferences

No additional standing preferences recorded.

## Gotchas

- Change `lib/api-spec/openapi.yaml` before regenerating hooks and validators with the `@workspace/api-spec` codegen script.
- The automation runner executes in the API server process; keep the API Server workflow running for schedules to fire.
- The initial schedule time zone is `Asia/Kolkata`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
