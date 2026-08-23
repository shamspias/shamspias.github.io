---
title: "Designing a REST API That Ages Well"
seoTitle: "REST API Design That Ages Well"
description: "An API is a contract you have to keep. Resources and verbs, the status codes that matter, idempotency, pagination, versioning, and errors that a client can act on."
date: 2021-06-15
permalink: "/posts/2021/06/rest-api-that-ages-well/"
lang: en
tags:
  - "backend"
  - "rest api"
  - "api design"
  - "http"
series: "Building Backends"
seriesOrder: 5
math: false
---

*An internal function you can rename tomorrow. A public API you cannot, because clients depend on every detail of it, and the ones you did not think were a contract turn out to be one. Designing an API that ages well is mostly about a few conventions applied consistently, and about the small decisions, error shapes, pagination, idempotency, that are invisible until a client hits them. This post is those conventions and those decisions.*

## 1. Resources and verbs: the one idea REST is built on

REST's core idea is small: your API is a set of **resources** (nouns), and you act on them with a fixed set of HTTP **verbs**. You do not invent an action for every operation; you apply a standard verb to a resource.

```
  GET    /orders          list orders
  POST   /orders          create an order
  GET    /orders/42       fetch order 42
  PUT    /orders/42       replace order 42
  PATCH  /orders/42       update part of order 42
  DELETE /orders/42       delete order 42
```

The anti-pattern is verbs in the URL: `/getOrders`, `/createOrder`, `/deleteOrder42`. Each of those reinvents what the HTTP method already says, and the inconsistency compounds across a hundred endpoints. Keep URLs as nouns, use the methods for the verbs, and nest resources when there is a genuine hierarchy: `/orders/42/items` for the items of order 42.

Two rules keep this clean. **Use plurals consistently** (`/orders`, not a mix of `/order` and `/orders`). And **do not go more than about two levels deep**: `/orders/42/items/7` is fine, but `/customers/3/orders/42/items/7/tax` is a sign the deep resource should be addressable on its own (`/items/7`).

## 2. The verbs' properties actually matter

The methods are not interchangeable labels; each carries guarantees that clients, caches, and proxies rely on. Getting these right is what makes an API safe to retry and safe to cache.

- **GET is safe**: it only reads, never changes anything. This is why a link, a crawler, or a prefetch can hit a GET freely, and why, from the [CSRF post](/posts/2024/06/cross-site-request-forgery/), a state change must never be a GET.
- **PUT and DELETE are idempotent**: doing them twice has the same effect as once. `DELETE /orders/42` twice leaves order 42 deleted either way; `PUT` twice leaves the same replaced resource.
- **POST is neither safe nor idempotent**: it creates, and doing it twice creates two things.

That last property is the source of a real bug, and it deserves its own section.

## 3. Idempotency: the retry that charges twice

A client sends `POST /payments` to charge a card. The network hiccups, the client does not get a response, so it retries. Now you have charged the card twice, because POST is not idempotent and the server saw two requests.

This is a genuine, common, expensive bug, and the fix is the **idempotency key**. The client generates a unique key for the operation and sends it as a header; the server remembers which keys it has processed and, on a repeat, returns the original result instead of doing the work again.

```
  POST /payments
  Idempotency-Key: 9f2c-a1b8-...     <- unique per logical operation

  server: seen this key before?
    no  -> process, store the result under the key, return it
    yes -> return the stored result, do NOT charge again
```

Now the retry is safe: the second request finds the key, returns the first result, and the card is charged once. Any endpoint that creates or charges and might be retried needs this. It is the single most important reliability feature of a payment or ordering API, and it is easy to leave out until it bites.

## 4. Status codes that a client can act on

Return the right status code, because clients branch on it. The set that matters, with when each applies:

- **200 OK** for a successful GET, PUT, PATCH, or DELETE.
- **201 Created** for a successful POST that made something, ideally with a `Location` header pointing at the new resource.
- **204 No Content** for a success with nothing to return.
- **400 Bad Request** for malformed input: the request was wrong.
- **401 Unauthorized** for "you are not authenticated" (you did not prove who you are).
- **403 Forbidden** for "you are authenticated but not allowed" (the [authz](/posts/2024/07/broken-access-control/) distinction from the security series).
- **404 Not Found** for a resource that does not exist, or that the user may not even know exists.
- **409 Conflict** for a request that clashes with the current state (a duplicate, a version conflict).
- **422 Unprocessable** for input that is well-formed but semantically invalid.
- **429 Too Many Requests** when the client is rate-limited.
- **500** for "we broke", **503** for "we are down or overloaded".

The two rules that matter most: **4xx means the client did something wrong, 5xx means the server did**, and clients rely on that split to decide whether retrying could help. And **do not return 200 with an error in the body**; a client that sees 200 believes it worked, and your error is invisible to every generic HTTP tool.

## 5. Errors a client can actually use

An error is part of your API, and a good one is machine-readable and specific. The worst error is a bare `400` with an empty body or a stack trace. A good error has a stable code the client can branch on, a human-readable message, and, for validation, which field failed:

```json
{
  "error": {
    "code": "insufficient_funds",
    "message": "The account balance is too low for this transfer.",
    "field": "amount"
  }
}
```

The `code` is the contract: clients switch on it, and it must stay stable even if the message wording changes. Return all validation errors at once, not one at a time, so a form can show every problem in a single pass. And never leak internal detail, a SQL error, a stack trace, an internal path, into an error response; that is both an information leak and a fragile contract.

## 6. Pagination, filtering, and the response that grows without bound

`GET /orders` that returns every order works in development with ten rows and falls over in production with ten million. **Every list endpoint must be paginated from day one**, because retrofitting pagination is a breaking change.

Two common styles, and the trade between them:

- **Offset pagination**: `?limit=50&offset=100`. Simple, lets you jump to any page, and degrades on large offsets (the database still counts past all the skipped rows) and can skip or repeat items if the data changes between pages.
- **Cursor pagination**: `?limit=50&cursor=<opaque>`, where the cursor points at the last item seen. Stable under inserts and fast at any depth, at the cost of not being able to jump to an arbitrary page. Prefer this for large or fast-changing lists.

Filtering and sorting belong in the query string as parameters (`?status=paid&sort=-created_at`), and, from the [SQL injection post](/posts/2024/04/sql-injection/), a `sort` field the client supplies must be mapped through an allowlist of columns, never concatenated into a query.

## 7. Versioning: how not to break the clients you already have

The day you must change the API in a way that breaks existing clients, you need a version, and you need to have decided how before that day. The common approaches:

- **In the URL**: `/v1/orders`, `/v2/orders`. Ugly but explicit and easy to route, and the most common choice.
- **In a header**: an `Accept` header or a custom version header. Cleaner URLs, more machinery.

Whichever you pick, the discipline is what matters: **an additive change (a new optional field, a new endpoint) is not breaking and needs no new version; a removal or a change of meaning is breaking and needs one.** Clients ignore fields they do not know, so adding is safe; removing or renaming is not. Design so that most evolution is additive, and reserve version bumps for the rare genuine break. And when you do bump, keep the old version alive long enough for clients to migrate, with a clear deprecation timeline.

## 8. The habits that keep an API boring

A short list that prevents most API pain:

- **Be consistent above all.** A slightly awkward convention applied everywhere beats a perfect one applied half the time. Clients learn your API by pattern.
- **Design the contract first**, ideally as an OpenAPI specification, and generate docs from it. [FastAPI does this from your types](/posts/2019/10/django-or-fastapi/) for free.
- **Never leak internals**: not in errors, not in ids that expose your database's sequence, not in fields that reflect your schema rather than your domain.
- **Treat the response shape as a contract.** Clients depend on field names and types. Renaming a field is a breaking change even though it feels like a rename.

## The short version

- REST is one idea: resources are nouns, HTTP methods are the verbs. Keep verbs out of URLs, use plurals consistently, and do not nest more than about two levels.
- The methods carry guarantees: GET is safe (never changes state, so state changes are never GET), PUT and DELETE are idempotent, POST is neither.
- Because POST is not idempotent, a retried create or charge can happen twice. An idempotency key, remembered by the server, makes the retry return the original result instead of doing the work again. Essential for payments and orders.
- Return the right status code: 2xx for success, 4xx for client error, 5xx for server error, and never 200 with an error in the body. Clients branch on the code.
- Errors are part of the API: a stable machine-readable `code`, a human message, the failing field, all validation errors at once, and no internal detail leaked.
- Paginate every list endpoint from day one, cursor pagination for large or changing lists. Put filtering and sorting in the query string, and allowlist any client-supplied sort column.
- Decide versioning before you need it. Additive changes (new fields, new endpoints) are safe; removals and renames are breaking. Design for additive evolution and reserve version bumps for real breaks.
- Above all, be consistent; a uniform API is one clients can learn by pattern.

Next: real-time, the spectrum from polling to WebSocket to WebRTC, and what is actually happening on the wire.
