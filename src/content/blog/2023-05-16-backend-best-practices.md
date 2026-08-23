---
title: "Backend Best Practices: The Tricks That Keep a Service Boring"
seoTitle: "Backend Best Practices and Tricks"
description: "Boring is the highest compliment a backend can earn. The layering, config, jobs, and observability habits that stop the phone call at three in the morning."
date: 2023-05-16
permalink: "/posts/2023/05/backend-best-practices/"
lang: en
tags:
  - "backend"
  - "best practices"
  - "software engineering"
  - "architecture"
series: "Building Backends"
seriesOrder: 8
math: false
---

*A backend's highest achievement is to be boring: to run for months without anyone thinking about it. Boring is not luck; it is a set of habits that each remove a class of three-in-the-morning phone call. This closes the series with those habits, written as problem and fix, because that is how you actually meet them, and a few small tricks that punch above their weight.*

## 1. Layer the code, and keep the web layer thin

**The problem.** Business logic lives inside the request handlers, tangled with HTTP parsing, database queries, and response building. Now you cannot test the logic without faking a web request, you cannot reuse it from a background job, and every handler is a little of everything.

**The fix.** Three layers, each with one job. The **web layer** (the view, the route handler) only parses the request, calls a service, and formats the response. The **service layer** holds the business logic and knows nothing about HTTP. The **data layer** (the [repository from part 1](/posts/2019/05/design-patterns-you-actually-use/)) holds the queries. Logic flows down; nothing lower knows about the layer above it.

```
  web layer      parse request, call service, format response   (thin)
      |
  service layer  the business logic. no HTTP, no raw SQL.       (the meat)
      |
  data layer     queries, behind intent-named methods.         (isolated)
```

The payoff is that the business logic is now testable without a web server or a database, reusable from a job or a CLI, and readable as a sequence of domain steps. The single most common structural mistake in backends is a fat handler; thinning it is the highest-value refactor there is.

## 2. Configuration comes from the environment, never the code

**The problem.** Database URLs, API keys, and feature toggles are hard-coded, or worse, committed to the repository. Now a secret is in your git history forever, and deploying to staging versus production means editing code.

**The fix.** Read all configuration from environment variables (or a secret manager), and keep secrets out of the repository entirely. The same build artefact runs in every environment, and only the environment differs. This is the config principle from the twelve-factor guidelines, and it is non-negotiable for anything with a secret. If a credential ever lands in a commit, treat it as compromised and rotate it, because git history is forever and [a leaked secret is a breach](/posts/2024/03/what-security-actually-is/).

## 3. Do slow work outside the request

**The problem.** A request handler sends an email, generates a PDF, or calls a slow third-party API inline. The user waits ten seconds, the request holds a connection the whole time, and if the slow step fails the whole request fails.

**The fix.** Move slow or unreliable work to a **background job queue** (Celery, RQ, or similar, with Redis or a broker behind it). The handler enqueues the work and returns immediately; a worker processes it separately, with its own retries. The user gets a fast response, the web process is freed, and a failed email retries without failing the signup.

```
  bad:   request -> send email (8s) -> respond          user waits 8s
  good:  request -> enqueue "send email" -> respond      user waits 50ms
                        |
                    a worker sends it later, retrying on failure
```

The rule: **a request should do the minimum to answer the user, and defer everything else.** Anything that can be slow, fail independently, or be retried belongs in a job.

## 4. Migrations are append-only and deploy in two steps

**The problem.** Someone edits a migration that already ran in production, or ships a migration that drops a column the currently-running code still reads, and the deploy takes the site down in the window between the migration and the new code.

**The fix.** Two disciplines. First, **never edit a migration that has been applied anywhere**; always add a new one, because the applied ones are history. Second, **make schema changes backward-compatible across a deploy**: to remove a column, first deploy code that no longer uses it, then, in a later deploy, drop it. To rename, add the new column, write to both, migrate reads, then drop the old. The old and new code versions overlap during a rolling deploy, so the schema must work for both at once. This "expand then contract" discipline is what makes zero-downtime deploys possible.

## 5. Make the system observable

**The problem.** Something is wrong in production and you have no idea what. The logs are unstructured prose you cannot search, there are no metrics, and a request that touched five services leaves no trail you can follow.

**The fix.** Three kinds of visibility, and you want all three.

- **Structured logs.** Log as key-value data (JSON), not prose, so you can search and filter. Attach a **correlation id** to every request and pass it through every service and job it triggers, so you can follow one request's entire journey across the system by that id. This one habit turns "somewhere it broke" into "here is exactly where".
- **Metrics.** Counts and timings, request rate, error rate, latency percentiles, queue depth, so you can see trends and alert on them. Watch the 95th and 99th percentile latency, not the average; the average hides the slow requests that anger users.
- **Traces.** For distributed systems, a trace shows one request's path across services with timing at each hop, so you can see *where* the time went.

You cannot fix what you cannot see, and the time to add observability is before the incident, not during it.

## 6. Expect failure at every boundary

**The problem.** A third-party API you call goes slow or down, and because you call it with no timeout, your requests pile up waiting, exhaust your connections, and your own service goes down with theirs. One dependency's outage becomes yours.

**The fix.** Treat every network call as something that will fail, and bound it.

- **Timeouts on everything.** No network call, to a database, a cache, another service, should be allowed to wait forever. A call with no timeout is a hang waiting to happen. Set them everywhere.
- **Retries with backoff, for idempotent operations only.** Retry a failed call, but wait longer between attempts (exponential backoff) so you do not hammer a struggling service, and only retry operations that are safe to repeat, which is why [idempotency](/posts/2021/06/rest-api-that-ages-well/) matters.
- **Circuit breakers.** When a dependency is failing, stop calling it for a while and fail fast, rather than making every request wait for the timeout. This stops one slow dependency from dragging your whole service into the mud.
- **Degrade gracefully.** If the recommendations service is down, show the page without recommendations, not an error. Decide in advance which features are essential and which can fall back.

## 7. The small tricks, as problem and fix

A rapid-fire list of high-value habits, each a problem met and a fix applied.

- **Connection pooling.** Problem: opening a new database connection per request is slow and exhausts the database. Fix: a connection pool, reused across requests. Usually a config line, and it is a large win.
- **Health checks.** Problem: your load balancer keeps sending traffic to a dead instance. Fix: a `/health` endpoint the balancer polls, so bad instances are pulled out automatically.
- **Graceful shutdown.** Problem: a deploy kills a process mid-request and the user gets an error. Fix: on shutdown, stop accepting new requests, finish the in-flight ones, then exit.
- **The N+1 query.** Problem: [from the database post](/posts/2020/04/databases-and-acid/), an ORM fetching related rows one at a time. Fix: eager-load, and watch query counts in development.
- **Rate limiting.** Problem: one client, or one bug, floods you. Fix: a limit per client, rejecting excess with a [429](/posts/2021/06/rest-api-that-ages-well/).
- **Validate at the boundary.** Problem: bad data spreads deep into the system before failing confusingly. Fix: validate input at the edge (Pydantic, a serializer) and reject it there, so everything past the boundary is known-good.
- **Idempotent, replayable jobs.** Problem: a job runs twice (a retry, a redelivery) and does its effect twice. Fix: make jobs idempotent, the same key-based trick as API idempotency, so a replay is harmless.

## 8. The thesis: boring is the goal

Everything here serves one aim: a backend that does not need your attention. The industry rewards clever, novel architecture in conference talks, and punishes it at three in the morning. A boring backend, thin handlers, logic in services, config in the environment, slow work in jobs, everything observable, every boundary bounded, is one that runs quietly for months, and when it does break, tells you exactly where.

Reach for the simplest thing that works, add complexity only when a measured need forces it, and treat every operational habit here as insurance against a specific incident you would rather not have. Boring is not the absence of skill. Boring is the result of it.

## The short version

- Layer the code: a thin web layer that only parses and formats, a service layer holding the business logic with no HTTP, and a data layer of queries. A fat request handler is the most common structural mistake; thinning it is the best refactor.
- Read all config from the environment, keep secrets out of the repository, and run the same artefact everywhere. A leaked credential is a breach; rotate it.
- Do slow or unreliable work in a background job, not in the request. The handler enqueues and returns fast; a worker retries independently.
- Migrations are append-only, never edit an applied one, and schema changes are backward-compatible across a deploy (expand then contract), which is what makes zero-downtime deploys possible.
- Make the system observable before the incident: structured logs with a correlation id per request, metrics (watch p95 and p99, not the average), and traces across services.
- Expect failure at every boundary: timeouts on every network call, retries with backoff for idempotent operations only, circuit breakers so one slow dependency does not sink you, and graceful degradation of non-essential features.
- The small tricks earn their keep: connection pooling, health checks, graceful shutdown, killing N+1 queries, rate limiting, validating at the boundary, and idempotent replayable jobs.
- The goal is boring: a backend that runs for months without attention and, when it breaks, says exactly where. Boring is the result of skill, not its absence.

That closes Building Backends. Eight parts, one theme: reach for the simplest thing that works, make the framework and the database and the wire serve the problem rather than the fashion, and spend your cleverness on keeping the system boring.
