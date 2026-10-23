---
title: Service health and status
---

# Private service health and public status

Shared authentication is checked every **60 seconds**. Other configured services are checked every **15 minutes** by default. Browsers refresh saved results every 15 seconds while focused; refreshing the page never launches readiness probes. Credentials and target addresses remain server-only. Run exactly one scheduler, either inside the always-running website API or as the independent monitor worker described below.

The slower tier can take about 15 minutes plus up to 60 seconds of probing and confirmation to detect a failure. Shared auth can take about one minute plus confirmation. Reduced polling lowers idle compute only for services that can actually sleep; shared auth is intentionally kept warm. A private-network request still counts as activity. A passing check is a point-in-time observation, not a promise of continuous availability.

## Private contract

Every participating server implements `GET /internal/status-health`. Set a distinct, random `STATUS_HEALTH_TOKEN` on each server (at least 32 characters; 64 random hex characters are recommended). The monitor sends `Authorization: Bearer <that service token>`. End-user sessions and cookies cannot authorize this endpoint. An unset/short token disables it with 404; an invalid token gets 401. Authorized readiness failure/timeout gets 503. A successful 200 response is:

```json
{"service":"api","status":"operational","checkedAt":"2026-09-07T12:00:00.000Z"}
```

Only the service identifier, status, UTC check time, and optional allowlisted `impactCodes` are returned. Responses are uncached. Exception details, secrets, dependency addresses, and production records are never returned. Existing Railway liveness endpoints are unchanged; do not point Railway's unauthenticated health check at this protected endpoint.

## Coverage

| Component ID | Server | Readiness checked |
| --- | --- | --- |
| website | Shogun website Node server | Built home and status pages exist |
| api | Website API | Postgres SELECT 1 and read-only shared asset bucket access |
| auth | Shared auth API | Postgres SELECT 1 |
| bucketly | Bucketly hosted website | Built homepage, fresh release catalogue, and HEAD checks of all latest advertised installers |
| tapdeck | Tapdeck hosted website | Built homepage, updater signature, installer object HEAD |
| scribepane | Scribepane custom Node server | Postgres, shutdown state, Redis readiness/PING when configured, and read-only image bucket access |
| washtrack | WashTrack API | Postgres SELECT 1 and Redis readiness/PING when configured; file bucket readiness is pending production deployment |
| quiet | Quiet website | Built homepage, private Android preview manifest and APK size, and optional configured testing database |

As of 23 October 2026, WashTrack's monitoring-only storage check is merged but has not been deployed to production. Its current production readiness result does not establish file-storage availability. Enable that coverage only after deploying and verifying the monitoring release.

Bucketly, Tapdeck, Scribepane and Quiet also inherit shared-auth failures in the public summary. These are sampled readiness checks, not guarantees that every feature or third-party integration works. Individual desktop installations, users' storage providers, full end-to-end login/payment flows, and every static asset are outside these probes.

The page explains the possible impact of shared authentication on connected tools, including Quiet Pro sign-in and account access. Quiet has a hosted website and restricted Android preview downloads to monitor; its on-device call handling does not depend on authentication. The Website API impact covers contact forms, job applications, bug reports, and public asset browsing or downloads. These explanations appear with current status and historical dips, without claiming every feature or user was affected.

## Configure and deploy

1. Deploy the protected endpoints first: auth, tool servers/WashTrack, then website API and website UI. Health endpoints alone need no database migration; see the incident migration below before deploying incident management. WashTrack development and production must each monitor their matching environment; do not mix environments in a public production feed.
2. Store each service's `STATUS_HEALTH_TOKEN` as a server environment secret. Generate and transfer secrets through your deployment secret manager; do not put them in source control, URLs, client bundles, screenshots, or logs.
3. On the process running the scheduler, set `STATUS_MONITOR_TARGETS` to a JSON array of `{ "id": "api", "url": "https://api.example.com/internal/status-health", "token": "<the api service secret>" }` objects, one for each desired component. Use actual deployment URLs. HTTPS is required across projects. Within a shared Railway private network, `http://service.railway.internal:PORT/internal/status-health` is accepted. Tokens are not forwarded through redirects. Targets are fixed deployment configuration, never request parameters. An optional numeric `intervalMs` accepts 30000, 60000, 900000 or 1800000. `STATUS_MONITOR_FAST_TARGETS` is a comma-separated list overriding listed targets to 60000; its default is `auth`. Set an empty string explicitly to disable that override.
4. Set `STATUS_MONITOR_ENABLED=true` on the website API once targets are configured. Leave it false until then. Unconfigured targets stay unknown. Public output is available at `/api/status`; existing `VITE_API_URL` selects that API in the browser. No monitor variable uses a `VITE_` prefix.
5. Start the website with `npm start` (`node server.mjs`) so the protected endpoint and existing `serve.json` routes share one process. A Railway start override that still runs `serve` must be updated to `npm start` when deploying.
6. Verify missing/wrong credentials cannot trigger readiness checks, then confirm operational status with the intended secret. Check the public response and browser network panel contain no monitor secrets or target URLs.

An authenticated endpoint retains its four-second readiness deadline. The monitor allows up to 20 seconds per HTTP attempt for startup and transport. A transport failure or 5xx response gets one confirmation attempt after 20 seconds. During a pending cycle, availability is unknown and the UI says **Checking**; a second unavailable result becomes **Service disruption**. A successful confirmation recovers without recording two history samples. Invalid credentials, redirects, 4xx responses, malformed JSON, wrong service identifiers and stale successful payloads become **Monitoring error**, not an assumed application outage. The successful response timestamp must still be no more than 45 seconds old, regardless of the polling interval.

Each component includes `checkedAt`, `lastSuccessAt`, `nextCheckAt`, `expiresAt`, `intervalMs` and `monitoringState`. A completed observation expires at its next scheduled check plus a bounded 65-second allowance. Reading a saved result cannot renew that deadline. An overdue check becomes unknown / **Update overdue**. Auth expiry and failures also invalidate dependent tool availability. The browser separately rejects failed or more-than-45-second-old feed responses. Legacy top-level `pollIntervalMs: 15000` and `staleAfterMs: 45000` continue to describe browser feed refresh, not target readiness cadence.

In default `STATUS_MONITOR_MODE=embedded`, the cache is in memory and starts unknown after restart. Keep that API continuously running with one replica; enabling Serverless on a timer-hosting API does not create an independent scheduler. Current checks never automatically create incidents. Admins publish incident history through the incident workspace below. The page still depends on website infrastructure; independent status-page hosting is a separate deployment choice.

## Independent monitor worker

The API repository supplies `npm run monitor` (`node dist/status-worker.js`) and `railway.monitor.toml` for a separate long-running scheduler. This supports the 60-second auth tier; Railway's five-minute minimum cron cadence cannot provide that tier. The worker uses the same authenticated readiness contract, holds no HTTP listener, and writes only public observations to a shared Postgres snapshot. Browser reads do not trigger checks. This is optional infrastructure and is not created by application startup.

1. Apply `migrations/20260913_status_monitor_snapshot.sql` to the website API database using the approved database workflow before enabling external mode. It only adds a singleton snapshot table. Existing history is retained. `schema.sql` includes it for fresh installations.
2. Prepare a single worker with build command `npm ci && npm run build`, start command `npm run monitor`, one replica, restart-on-failure, the API's database connection and server-only target credentials. Keep Serverless disabled on the worker. `railway.monitor.toml` provides these settings for deployments that support config files; for a new service, use Railway's current dashboard or infrastructure-as-code workflow. Its default fast target is auth; explicitly set `STATUS_MONITOR_FAST_TARGETS=auth` for clarity.
3. Deploy the API with `STATUS_MONITOR_MODE=external` and `STATUS_MONITOR_ENABLED=true`, disabling its embedded probes. Start the worker as part of the coordinated deployment. Do not leave both schedulers running. The transition may briefly show unknown; it must not show fabricated green results.
4. Deploy the compatible website UI after the API. Confirm worker-written timestamps advance, stale data expires if the worker stops, and repeated browser reads do not increase probe counts. API replicas in external mode only read the shared snapshot and never schedule probes.
5. Only after the worker is verified should API Serverless settings be considered. It still wakes for real website traffic and for its own scheduled readiness check. The worker and its database have an ongoing baseline cost; this is not a promise that all infrastructure can sleep.

External mode returns HTTP 503 if snapshot storage is unavailable, and an empty store yields unknown statuses. The public API never renews observation expiry when loading a stored snapshot. Apply a worker restart policy and retain one replica. The snapshot table and worker share the API's database, so this does not provide independent monitoring of a complete Railway/database outage.

Railway deployment references: [configuration reference](https://docs.railway.com/config-as-code/reference), [configuration schema](https://railway.com/railway.schema.json), and [cron jobs](https://docs.railway.com/guides/cron-jobs). Verify the current deployment workflow before provisioning the optional worker.

## Sampled history

`GET /api/status/history` provides the existing hourly or daily buckets for the six bounded ranges. Recording requires `migrations/20260908_status_health_history.sql`. Only newly completed scheduled checks contribute samples; confirmation retries count once. Replayed or older observations in a bucket cannot increment counters. A failed history write does not invent replacement samples.

The returned metadata is `measurement: scheduled_observations` and `coverage: sampled_not_continuous`. The UI labels the percentage **checks passed**, not uptime. Buckets with no observations remain unrecorded; cached status-page refreshes cannot backfill them. Times between checks are unobserved, including gaps inside a partially populated hour/day. Older 15-second samples are retained, so a range spanning the cadence change mixes sampling frequencies and must not be interpreted as time-weighted availability. Dependency impacts in history describe the evidence available when the tool's scheduled check completed; the live status also reacts to faster auth checks between those observations.

## Verification

Run each repository's existing build/typecheck/test commands. The Node-based services include `test/private-health.test.*` in their test commands; WashTrack includes it in `bun test`. Website API tests exercise configured-target validation, shared polling, timeout, recovery, dependency status, freshness and public redaction. Website tests cover stale-feed handling and the protected production server.

## Admin incidents

Staff with `admin`, `maintenance_admin`, or `super_admin` can open **Staff portal → Incident management** at `/status/admin`. Create an incident with a title, at least one affected service/tool, impact, status, and public update. Publishing makes it immediately public. Use **Update incident** to publish progress through Investigating, Identified, Monitoring, and Resolved. Each update is retained with its UTC timestamp and lifecycle status. Resolved incidents are read-only; raise a new incident for a recurrence.

Incidents appear in the public overview, calendar, and beneath every assigned service/tool. Expand the component to read its incidents and updates. Active incidents override healthy probes; a worse probe result still takes precedence. Resolving an incident removes its manual impact while retaining its history. The public page refreshes incidents every 15 seconds. Incident fetch errors keep the last loaded incidents visible with a warning and prevent an all-operational claim until incident data is available again. Missing incident history never implies verified uptime.

### Database preparation and delivery order

Health endpoints alone need no migration. Incident persistence requires the website API migration `migrations/20260907_status_incidents.sql` to be applied to its database **before** deploying the incident API and then the UI. It creates the `status_incidents` table and index, without modifying existing data. The repository uses manual SQL (`schema.sql`); `migrations/meta/_journal.json` inventories the ordered migrations but does not track whether production has applied them. Fresh installations can use the updated schema; existing installations should apply outstanding migrations in transactions using their approved database workflow. No production migration is run automatically by application startup or tests.

Incidents survive API restarts and are shared across API replicas through Postgres. API authorization verifies the staff session against the existing auth tables and rejects non-staff users, expired/invalid sessions, users requiring a password change, and unauthorized roles. Client role headers cannot grant permission. No auth schema change is needed.

### Incident API

- `GET /api/incidents` is public and uncached; returns `{ "incidents": [...] }`, newest first. Records include `id`, `title`, `status`, `impact`, `componentIds`, `startedAt`, nullable `resolvedAt`, `revision`, and newest-first `updates` containing `timestamp`, `status`, and `message`. Internal staff identifiers are excluded.
- `POST /api/incidents` requires the staff session bearer token. Send `title` (1–160 characters), `message` (1–5,000 characters), `componentIds` (one or more unique component IDs from the coverage table), `impact` (`degraded`, `outage`, or `maintenance`), and `status` (`Investigating`, `Identified`, or `Monitoring`). Returns the published incident with HTTP 201. Timestamps and identifiers are generated by the server/database.
- `PATCH /api/incidents/:id` requires the same permission and fields plus the last loaded `revision`; `status` may also be `Resolved`. It atomically appends an update and increments the revision. HTTP 409 means another admin changed/resolved the incident: reload it before editing again. Resolving stamps `resolvedAt` and retains all prior updates.
- HTTP 400 indicates invalid input, 401 an invalid session, 403 insufficient access, and 503 unavailable incident storage. Public readiness polling is independent of incident storage reads.

`npm test` in the API runs the real migration and incident SQL against isolated [PGlite Postgres](https://pglite.dev/docs/), without a production database. Tests cover authorization, persistence, concurrent edits, resolution, validation, and public field selection. UI tests cover service assignment, manual status precedence, publishing, and conflict handling.

## Quiet coverage and rollout

Quiet uses `quiet-hours` in shared-auth records and `quiet` in the monitoring API. Its website and hosted preview downloads are monitored; Google Play delivery and on-device call handling are not. Existing Quiet incidents and history remain intact and Quiet can be assigned to new incidents again.

The UI continues requesting `version=2`. Direct API callers must also include `?version=2` on `/api/status`, `/api/status/history`, and `/api/incidents` reads to include Quiet. Incident `POST /api/incidents?version=2` and `PATCH /api/incidents/:id?version=2` requests must include this parameter when assigning Quiet; unversioned reads omit Quiet and unversioned assignments return HTTP 400. Legacy edits of incidents with a hidden Quiet assignment return HTTP 409 and must reload using the versioned contract.

Quiet incident and history storage requires the existing website API migration `migrations/20260915_quiet_tool.sql`, recorded in `migrations/meta/_journal.json`; fresh installations use the updated `schema.sql`. Apply it through the approved database workflow before accepting Quiet bug reports or storing Quiet incidents/history. The feature-impact changes add no further migration. Deploy the Quiet protected endpoint through its development-to-main flow, configure a distinct server-only `STATUS_HEALTH_TOKEN`, then add a `quiet` entry to `STATUS_MONITOR_TARGETS` on the existing scheduler. These production configuration changes require explicit authorization. Quiet stays unknown until configured and verified.

## Safe feature impact

Private 503 responses may include `impactCodes`: `website_unavailable`, `downloads_unavailable`, `updates_unavailable`, `storage_unavailable`, or `service_unavailable`. The monitor adds `sign_in_unavailable` for shared-auth failures. The API and UI accept only these fixed categories, never exception messages, HTTP error details, URLs, paths, bucket names, credentials or customer data. Unknown codes are ignored. Codes clear after recovery, expiry or while checking. Older endpoints receive a generic online-service message instead of a guessed cause. Simultaneous download and sign-in failures can both appear.

For example: "Hosted downloads are currently unavailable. Existing installations may still work." These messages describe current sampled impact, not historical root causes. Incident history remains editorial.

Bucketly checks every installer in the latest release using HEAD, a fixed HTTPS host allowlist and no redirects. It requires a fresh catalogue, without the website's stale-cache fallback, and does not increment download counters or retrieve file bytes. Tapdeck checks the built page, updater signature and installer object using existing bucket credentials. Quiet checks its restricted preview manifest and local APK size without exposing file metadata or bypassing download authorization. These probes do not test users' desktop installations or third-party buckets.

Scribepane and the website API check bucket access using their application identity and read-only HEAD requests. WashTrack's pending monitoring release uses the same approach; its current production probe does not yet check bucket access. Verify bucket-inspection permission (S3 ListBucket) before rollout. A 403 means access failed, not that files are missing. No probe lists user objects, reads user files, writes or deletes test objects, or proves that every upload/download operation works.

Deploy changed tool servers first, then the API and any independent monitor worker, then the UI and documentation. Old monitors remain compatible with extra health fields. Verify missing/wrong token rejection, redaction, download failures, auth recovery, expiry, and Quiet target registration. Do not weaken a failing probe to make the page green.
