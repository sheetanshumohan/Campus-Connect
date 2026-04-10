## Plan: CampusConnect Skeleton First

Build a hackathon-ready microservices skeleton in this order: API Gateway + Docker Compose first, then harden Registration-to-Event calls with retry/backoff, then verify load and failure behavior. This prioritizes judging criteria (technical execution + resilience) while minimizing integration risk in a 10-hour window.

**Steps**
1. Phase 0: Baseline and contracts
1. Confirm and freeze API boundaries already present in services: auth on 3001, events on 3002, registrations on 3003.
2. Define gateway route contract for MVP:
1. /api/auth/* and /api/users/* -> user-auth-service
2. /api/events/* and /api/categories/* -> event-service
3. /api/registrations/* and /api/notifications/* -> registration-service
3. Add one lightweight health route per service if missing, then add gateway health aggregation endpoint for demo checks.

2. Phase 1: API Gateway (first deliverable)
1. Create a dedicated gateway service under backend (Express-based for speed and familiarity).
2. Add middleware chain in this order: request id, JSON parser, CORS, basic request logging, JWT passthrough (do not re-issue tokens), proxy routing, centralized error handler.
3. Proxy rules:
1. Preserve original Authorization header to downstream services.
2. Forward x-user-id/x-user-role only when token is valid (optional enhancement for internal tracing).
3. Add timeout per proxied request to avoid hung connections.
4. Add fallback behavior for downstream unavailability: return structured 503 response (service name, correlation id, timestamp).
5. Keep gateway stateless and avoid business logic to preserve microservice boundaries.

3. Phase 2: Docker Compose Skeleton (first deliverable)
1. Add one container definition for each required app service + one Mongo container per service.
2. Use an isolated bridge network and service-name DNS (no localhost inside containers).
3. Add startup dependencies and restart policy to support independent restarts.
4. Set explicit environment mapping:
1. Gateway points to service URLs using docker service names.
2. Each service points to its own Mongo container URI.
5. Add persistent named volumes for each Mongo instance.
6. Add minimal healthchecks so compose can report readiness in demo.
7. Keep media-service outside MVP compose initially (bonus phase only).

4. Phase 3: Resilience (retry with exponential backoff)
1. Implement retry wrapper in registration-service for Event Service capacity updates.
2. Retry policy:
1. Retry only transient failures (network errors, timeout, 5xx).
2. Do not retry 4xx business errors (event full, validation).
3. Exponential backoff schedule (for example 200ms, 400ms, 800ms with jitter).
3. Add request timeout and max retry cap to bound latency.
4. On final failure, return graceful error message and log retry metadata for observability.
5. Ensure cancellation/waitlist operations use the same resilient client wrapper.

5. Phase 4: Concurrency Safety and graceful degradation
1. Preserve source of truth for seat accounting in event-service internal capacity endpoint.
2. Keep registration flow idempotent by checking duplicate registration before capacity mutation.
3. On capacity conflict, route overflow to waitlist path (already present) and return clear status to client.
4. Ensure failed downstream sync does not silently pass; convert current silent catches into explicit handled outcomes.

6. Phase 5: Verification and demo proof points
1. Functional checks through gateway only (never call service ports directly during demo).
2. Failure simulation:
1. Stop event-service container and verify gateway returns 503 while auth still works.
2. Restart event-service and verify registration path recovers.
3. Load simulation (target registration endpoint) to demonstrate no crash and waitlist behavior under pressure.
4. Capture metrics/screenshots for pitch: success count, waitlist count, failed transient retries recovered.

7. Phase 6: Documentation for judging rubric
1. Add architecture diagram with gateway + isolated DB per service.
2. Document API contracts for gateway-exposed routes and internal event capacity API.
3. Add resilience section: what was implemented, where, and how it behaves on partial failure.
4. Add runbook: single command startup, smoke test commands, and failure simulation commands.

8. Time-boxed 10-hour execution order
1. 0:00-1:30 -> Gateway scaffold + routing
2. 1:30-3:30 -> Dockerfiles + compose + env wiring
3. 3:30-5:00 -> Retry/backoff integration in registration-service
4. 5:00-6:30 -> Healthchecks + structured errors + recovery tests
5. 6:30-8:00 -> Load simulation + waitlist proof
6. 8:00-10:00 -> README, diagram, 3-minute demo flow prep

**Relevant files**
- d:/Planner/Campus-Connect/backend/user-auth-service/server.js — keep as auth service entry point behind gateway and expose health endpoint.
- d:/Planner/Campus-Connect/backend/event-service/server.js — keep event service entry point and health endpoint for compose checks.
- d:/Planner/Campus-Connect/backend/registration-service/server.js — keep registration service entry point and health endpoint.
- d:/Planner/Campus-Connect/backend/registration-service/controllers/registrationController.js — integrate retry/backoff wrapper for capacity update calls and remove silent failure handling.
- d:/Planner/Campus-Connect/backend/registration-service/routes/registrationRoutes.js — ensure registration lifecycle endpoints are gateway-routed and demo-ready.
- d:/Planner/Campus-Connect/backend/event-service/routes/eventRoutes.js — preserve internal capacity endpoint and harden access assumptions for service-to-service calls.
- d:/Planner/Campus-Connect/backend/event-service/controllers/eventController.js — verify atomicity expectations for capacity increments/decrements.
- d:/Planner/Campus-Connect/backend/user-auth-service/middleware/authMiddleware.js — continue as token validation source pattern for downstream services.

**Verification**
1. Compose boot verification: all required containers healthy and reachable through gateway.
2. Gateway routing verification: login, list events, register for event, list my registrations via gateway base URL.
3. Resilience verification: intentionally stop event-service during registration and confirm retry attempts then graceful error.
4. Recovery verification: restart event-service and confirm successful registrations resume without restarting other services.
5. Concurrency verification: run burst registrations and confirm capacity caps plus waitlist overflow behavior.
6. Isolation verification: each service writes only to its own Mongo container.

**Decisions**
- Included scope: exactly 3 required services in MVP (auth, event, registration).
- Excluded from MVP: media-service integration in compose/gateway (deferred as bonus).
- Resilience choice: retry with exponential backoff as first pattern.
- Isolation choice: one Mongo container per service for a clear judging narrative.

**Further Considerations**
1. Internal endpoint trust model recommendation: keep JWT validation for now, then add shared internal service token only if time permits.
2. Optional bonus recommendation: add circuit breaker after retry if ahead of schedule.
3. Demo recommendation: show one happy path and one degraded path (event-service down) to maximize resilience score.
