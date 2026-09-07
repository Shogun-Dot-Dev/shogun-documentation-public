---
title: Service health and status
---

# Private service health and public status

The website API checks configured services every 15 seconds. Browsers only read its cached `GET /api/status` response and never receive monitor credentials or internal addresses. Checks run without visitors and do not multiply with visitor count. Run a single monitor API replica to avoid duplicate polling; each replica otherwise maintains its own independent cache.

## Private contract

Every participating server implements `GET /internal/status-health`. Set a distinct, random `STATUS_HEALTH_TOKEN` on each server (at least 32 characters; 64 random hex characters are recommended). The monitor sends `Authorization: Bearer <that service token>`. End-user sessions and cookies cannot authorize this endpoint. An unset/short token disables it with 404; an invalid token gets 401. Authorized readiness failure/timeout gets 503. A successful 200 response is:

```json
{"service":"api","status":"operational","checkedAt":"2026-09-07T12:00:00.000Z"}
```

Only the service identifier, status, and UTC check time are returned. Responses are uncached. Exception details, secrets, dependency addresses, and production records are never returned. Existing Railway liveness endpoints are unchanged; do not point Railway's unauthenticated health check at this protected endpoint.

## Coverage

| Component ID | Server | Readiness checked |
| --- | --- | --- |
| website | Shogun website Node server | Built home and status pages exist |
| api | Website API | Postgres SELECT 1 |
| auth | Shared auth API | Postgres SELECT 1 |
| bucketly | Bucketly hosted website | Built homepage and release catalogue |
| tapdeck | Tapdeck hosted website | Built homepage, updater signature, installer object HEAD |
| scribepane | Scribepane custom Node server | Postgres, shutdown state, and Redis readiness/PING when configured |
| washtrack | WashTrack API | Postgres SELECT 1 and Redis readiness/PING when configured |

Bucketly, Tapdeck and Scribepane also inherit shared-auth failures in the public summary. These are sampled readiness checks, not guarantees that every feature or third-party integration works. Individual desktop installations, users' storage providers, full end-to-end login/payment flows, and every static asset are outside these probes.

## Configure and deploy

1. Deploy the protected endpoints first: auth, tool servers/WashTrack, then website API and website UI. Health endpoints alone need no database migration; see the incident migration below before deploying incident management. WashTrack development and production must each monitor their matching environment; do not mix environments in a public production feed.
2. Store each service's `STATUS_HEALTH_TOKEN` as a server environment secret. Generate and transfer secrets through your deployment secret manager; do not put them in source control, URLs, client bundles, screenshots, or logs.
3. On the website API only, set `STATUS_MONITOR_TARGETS` to a JSON array of `{ "id": "api", "url": "https://api.example.com/internal/status-health", "token": "<the api service secret>" }` objects, one for each desired component. Use actual deployment URLs. HTTPS is required across projects. Within a shared Railway private network, `http://service.railway.internal:PORT/internal/status-health` is accepted. Tokens are not forwarded through redirects. Targets are fixed deployment configuration, never request parameters.
4. Set `STATUS_MONITOR_ENABLED=true` on the website API once targets are configured. Leave it false until then. Unconfigured targets stay unknown. Public output is available at `/api/status`; existing `VITE_API_URL` selects that API in the browser. No monitor variable uses a `VITE_` prefix.
5. Start the website with `npm start` (`node server.mjs`) so the protected endpoint and existing `serve.json` routes share one process. A Railway start override that still runs `serve` must be updated to `npm start` when deploying.
6. Verify missing/wrong credentials cannot trigger readiness checks, then confirm operational status with the intended secret. Check the public response and browser network panel contain no monitor secrets or target URLs.

An authenticated endpoint probe has a four-second response deadline; the monitor aborts a request after five seconds. A pending readiness operation is shared to avoid accumulating new database queries after a timeout. One failed probe marks a service degraded; two consecutive failures mark an outage; the next successful check recovers immediately. Authentication/configuration errors or invalid/stale successful responses are unknown. Cached observations older than 45 seconds are unknown. Browser requests have a seven-second timeout, refresh every 15 seconds while visible, and clear green status on error/staleness.

The cache is in memory and starts unknown after restart. Current checks do not fabricate historical uptime or automatically create incidents. Admins publish incident history through the incident workspace described below. The page and collector share website infrastructure, so a full outage of that infrastructure can make the status page unavailable; independent hosting is a separate deployment choice.

## Verification

Run each repository's existing build/typecheck/test commands. The Node-based services include `test/private-health.test.*` in their test commands; WashTrack includes it in `bun test`. Website API tests exercise configured-target validation, shared polling, timeout, recovery, dependency status, freshness and public redaction. Website tests cover stale-feed handling and the protected production server.

## Admin incidents

Staff with `admin`, `maintenance_admin`, or `super_admin` can open **Staff portal → Incident management** at `/status/admin`. Create an incident with a title, at least one affected service/tool, impact, status, and public update. Publishing makes it immediately public. Use **Update incident** to publish progress through Investigating, Identified, Monitoring, and Resolved. Each update is retained with its UTC timestamp and lifecycle status. Resolved incidents are read-only; raise a new incident for a recurrence.

Incidents appear in the public overview, calendar, and beneath every assigned service/tool. Expand the component to read its incidents and updates. Active incidents override healthy probes; a worse probe result still takes precedence. Resolving an incident removes its manual impact while retaining its history. The public page refreshes incidents every 15 seconds. Incident fetch errors keep the last loaded incidents visible with a warning and prevent an all-operational claim until incident data is available again. Missing incident history never implies verified uptime.

### Database preparation and delivery order

Health endpoints alone need no migration. Incident persistence requires the website API migration `migrations/20260907_status_incidents.sql` to be applied to its database **before** deploying the incident API and then the UI. It creates the `status_incidents` table and index, without modifying existing data. The repository uses manual SQL (`schema.sql`) and has no migration runner or `_journal`; fresh installations can use the updated schema, and existing installations should apply the migration in a transaction using their approved database workflow. No production migration is run automatically by application startup or tests.

Incidents survive API restarts and are shared across API replicas through Postgres. API authorization verifies the staff session against the existing auth tables and rejects non-staff users, expired/invalid sessions, users requiring a password change, and unauthorized roles. Client role headers cannot grant permission. No auth schema change is needed.

### Incident API

- `GET /api/incidents` is public and uncached; returns `{ "incidents": [...] }`, newest first. Records include `id`, `title`, `status`, `impact`, `componentIds`, `startedAt`, nullable `resolvedAt`, `revision`, and newest-first `updates` containing `timestamp`, `status`, and `message`. Internal staff identifiers are excluded.
- `POST /api/incidents` requires the staff session bearer token. Send `title` (1–160 characters), `message` (1–5,000 characters), `componentIds` (one or more unique component IDs from the coverage table), `impact` (`degraded`, `outage`, or `maintenance`), and `status` (`Investigating`, `Identified`, or `Monitoring`). Returns the published incident with HTTP 201. Timestamps and identifiers are generated by the server/database.
- `PATCH /api/incidents/:id` requires the same permission and fields plus the last loaded `revision`; `status` may also be `Resolved`. It atomically appends an update and increments the revision. HTTP 409 means another admin changed/resolved the incident: reload it before editing again. Resolving stamps `resolvedAt` and retains all prior updates.
- HTTP 400 indicates invalid input, 401 an invalid session, 403 insufficient access, and 503 unavailable incident storage. Public readiness polling is independent of incident storage reads.

`npm test` in the API runs the real migration and incident SQL against isolated [PGlite Postgres](https://pglite.dev/docs/), without a production database. Tests cover authorization, persistence, concurrent edits, resolution, validation, and public field selection. UI tests cover service assignment, manual status precedence, publishing, and conflict handling.
