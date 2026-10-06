# Smart Home Automation Management System

Smart Home is a web-based smart-home simulator for managing household devices from one place. Sign in to control appliances by room, monitor estimated energy usage, set recurring automations, and review device and schedule activity.

## Features

- Sign up, sign in, and sign out with Clerk authentication
- Protected dashboard with device totals, online status, devices currently on, rooms, estimated daily energy use, and recent activity
- Persistent, account-scoped device management for lights, fans, air conditioners, TVs, and other appliances
- Room filtering across the Living Room, Bedroom, Kitchen, Bathroom, and Office
- Light on/off and brightness controls
- Fan on/off and speed controls
- Create, edit, pause, resume, and delete recurring time-based automations
- Automations can control one device or all lights, on selected days of the week
- Background automation runner checks schedules every 15 seconds using the account's configured time zone
- Activity history for device changes, account initialization, schedule management, and automation executions
- Six sample devices are added once to each new account; changes persist in PostgreSQL
- Responsive layouts, validation, loading and empty states, and action feedback

## Tech stack

- React, TypeScript, Vite, and Tailwind CSS
- Wouter routing and TanStack Query
- Clerk for authentication
- Express 5 API server
- PostgreSQL with Drizzle ORM
- OpenAPI as the API contract source, with Orval-generated React Query hooks and Zod validation schemas
- Pino structured server logging

## Database

The app uses the workspace's PostgreSQL database. Its tables store Clerk user IDs and account preferences, devices, automation schedules, and activity records. Each device, schedule, and activity record is scoped to its owner. A new account is initialized transactionally with six demo devices and a welcome activity entry.

Apply development schema changes with:

```bash
pnpm --filter @workspace/db run push
```

## Setup

1. Install workspace dependencies:

   ```bash
   pnpm install
   ```

2. Configure Clerk Auth for the Replit app. The managed setup provisions its keys; do not commit or hardcode secret values.
3. Ensure the Replit PostgreSQL database is provisioned and `DATABASE_URL` is available to the API server.
4. Apply the development database schema:

   ```bash
   pnpm --filter @workspace/db run push
   ```

5. Start the configured `artifacts/api-server: API Server` and `artifacts/smart-home: web` workflows in Replit.

For local commands, the services use workflow-provided `PORT` and `BASE_PATH` values:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/smart-home run dev
```

## Environment variables

Replit supplies these values; keep them in Replit Secrets or the managed environment and never commit them:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | API server and database tools | PostgreSQL connection |
| `CLERK_SECRET_KEY` | API server | Verify Clerk sessions and serve the production Clerk proxy |
| `CLERK_PUBLISHABLE_KEY` | API server | Resolve the Clerk application for incoming hosts |
| `VITE_CLERK_PUBLISHABLE_KEY` | Web app | Initialize Clerk in the browser |
| `VITE_CLERK_PROXY_URL` | Web app in production | Route Clerk Frontend API requests through the app's domain |
| `PORT`, `BASE_PATH` | Replit workflows | Service port and routed artifact path |

## Automation execution

Schedules store a local time, selected weekdays, an action, and a device or all-lights target. The API server runs a background checker while the server process is running. Every 15 seconds it compares enabled rules with the current time in each account's stored time zone, locks each due rule to prevent duplicate execution, updates the target device state, records an activity entry, and marks the rule as executed for that local minute. The initial account time zone is `Asia/Kolkata`.

## Development checks

Regenerate API hooks and validation schemas after editing `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Run the workspace type checks:

```bash
pnpm run typecheck
```

## Future improvements

- Let users choose their time zone and device energy ratings
- Add schedules that run once or on date ranges
- Add automation execution history filters and energy-use trends
- Add device grouping and room-level scenes
- Add automated integration tests for authenticated flows and scheduled execution
