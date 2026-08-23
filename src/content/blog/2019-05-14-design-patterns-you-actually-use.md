---
title: "Design Patterns You Actually Use, and the Ones You Should Not Reach For"
seoTitle: "Design Patterns You Actually Use"
description: "The pattern books list twenty-three. You reach for about six. Here are those six, the problem each solves, and why naming a pattern is a tool, not a trophy."
date: 2019-05-14
permalink: "/posts/2019/05/design-patterns-you-actually-use/"
lang: en
tags:
  - "backend"
  - "design patterns"
  - "software engineering"
  - "python"
series: "Building Backends"
seriesOrder: 1
math: false
---

*Design patterns get taught as a catalogue to memorise and a badge to wear. That is the wrong frame, and it produces code strangled by patterns it did not need. A pattern is a name for a solution that keeps recurring, and its value is that it lets two engineers say a lot in one word. This post is the handful you genuinely reach for in backend work, the specific problem each one answers, and the discipline of not reaching for the rest.*

## 1. What a pattern is for

A design pattern is not a thing you add to code. It is a name for a shape that keeps appearing, so that when you see the shape you recognise it, and when you describe it you can say "this is a strategy" instead of a paragraph. The value is communication and recognition, not the pattern itself.

This matters because the failure mode of learning patterns is applying them. Someone reads the book and then every class sprouts a factory, every configuration becomes a singleton, every pair of objects gets an observer, and the code is now harder to follow than the problem warranted. The rule that prevents this:

> **Do not start with a pattern. Start with the simplest code that works, and reach for a pattern only when a real problem, duplication, rigidity, a hard-to-test seam, actually shows up.**

Patterns are a response to pain. No pain, no pattern. Everything below is introduced by the pain it relieves, because that is the only honest way to teach them.

## 2. Strategy: when behaviour needs to be swappable

**The pain.** You have a function with a growing `if/elif` chain choosing between algorithms: how to calculate shipping, which payment provider to charge, how to rank results. Every new case edits the same function, and testing one case means threading through all of them.

**The pattern.** Pull each behaviour into its own object (or function) with a shared interface, and select one at runtime. In Python, where functions are first-class, this is often just a dictionary of functions:

```python
def flat_rate(order):      return 500
def by_weight(order):      return order.weight_kg * 100
def free_over(threshold):
    return lambda order: 0 if order.total >= threshold else 500

SHIPPING = {
    "flat": flat_rate,
    "weight": by_weight,
    "free_over_5000": free_over(5000),
}

def shipping_cost(order, method):
    return SHIPPING[method](order)      # pick the strategy, call it
```

Now a new shipping method is a new function and a new dictionary entry, not a surgery on a growing conditional. Each strategy is testable alone. This is the single most useful pattern in day-to-day backend code, and half the time it does not need a class at all.

## 3. Factory: when creation is complicated or conditional

**The pain.** Constructing an object requires several steps, or the concrete type depends on a value, and that construction logic is copy-pasted across the codebase. Now the constructor's details leak everywhere, and changing them means finding every copy.

**The pattern.** Put the "how to build it" behind one function that returns the finished object. Callers ask for what they want and receive it, without knowing the assembly.

```python
def make_storage(config):
    if config.backend == "s3":
        return S3Storage(bucket=config.bucket, region=config.region)
    if config.backend == "local":
        return LocalStorage(path=config.path)
    raise ValueError(f"unknown storage backend: {config.backend}")
```

The value is that the choice of concrete type lives in exactly one place. The rest of the code depends on the `Storage` interface, not on `S3Storage`, so swapping the backend, or adding one, touches only the factory. This pairs naturally with the next pattern.

## 4. Dependency injection: pass dependencies in, do not reach out

**The pain.** A class reaches out and constructs the things it needs, a database connection, an email client, a clock, inside itself. Now you cannot test it without a real database, you cannot swap the email client, and the class secretly depends on global state.

**The pattern.** Do not let an object create its own dependencies. Pass them in, from outside.

```python
# painful: the dependency is hard-wired and hidden
class OrderService:
    def __init__(self):
        self.db = PostgresConnection(URL)      # cannot test without a real DB
        self.mailer = SmtpMailer(HOST)

# better: dependencies are handed in, and visible in the signature
class OrderService:
    def __init__(self, db, mailer, clock):
        self.db = db
        self.mailer = mailer
        self.clock = clock
```

This is dependency injection, and despite the imposing name it is just "pass your dependencies as arguments". The payoff is enormous: the second `OrderService` can be tested with a fake database and a fake mailer, its dependencies are honest and visible in its signature, and swapping any of them is a change at the call site, not inside the class. If you adopt one idea from this post, adopt this one. It is the foundation of testable code.

## 5. Repository: put the database behind an interface

**The pain.** Database queries are scattered through your business logic, so the logic is welded to the ORM and the schema, you cannot reason about "how do we fetch a user" in one place, and testing any logic means hitting a database.

**The pattern.** Collect all the data access for a concept behind a repository object with intent-named methods. The business logic talks to the repository; the repository talks to the database.

```python
class UserRepository:
    def __init__(self, db):
        self.db = db

    def by_email(self, email):
        return self.db.query(User).filter_by(email=email).one_or_none()

    def active_since(self, date):
        return self.db.query(User).filter(User.last_seen >= date).all()
```

Now the business logic calls `users.by_email(...)`, a sentence about the domain, not a query about the schema. The queries live in one place, they are named by what they mean, and a fake repository makes the logic testable without a database. This is the same instinct as [naming your operations rather than exposing raw tables](/posts/2025/10/verbs-not-tables/), which turns out to matter for more than tidiness. The caution: do not build a repository so early that it is just a thin wrapper adding no value. Reach for it when the queries are spreading.

## 6. Adapter: make an incompatible thing fit

**The pain.** You depend on a third-party library or service with an awkward interface, and its shape is spreading through your code. When you swap the vendor, or they change their API, the change ripples everywhere.

**The pattern.** Wrap the foreign thing in a small object that presents the interface *you* want, and translate. Your code depends on your interface; only the adapter knows the vendor.

```python
class PaymentGateway:                      # the interface your code wants
    def charge(self, amount, token): ...

class StripeAdapter(PaymentGateway):       # translates to the vendor's shape
    def __init__(self, client):
        self.client = client
    def charge(self, amount, token):
        result = self.client.PaymentIntent.create(
            amount=amount, currency="usd", payment_method=token, confirm=True)
        return result.id
```

The day you move from Stripe to another provider, you write one new adapter and change one line where the adapter is chosen (a factory, from section 3). Nothing else in your code knew which vendor it was using. Adapters are how you keep a third party from colonising your codebase.

## 7. Observer and pub/sub: when one event has many reactions

**The pain.** When an order is placed, five things must happen: send a receipt, update inventory, notify the warehouse, log analytics, award loyalty points. Cramming all five into the order-placing function couples unrelated concerns and makes the function a magnet for every future "when an order is placed, also...".

**The pattern.** The order-placing code announces an event; interested parties subscribe. The publisher does not know who is listening.

```python
# the publisher just announces; it does not know or care who reacts
def place_order(order, events):
    save(order)
    events.emit("order_placed", order)     # done. reactions are elsewhere.

# reactions register themselves, each in its own module
events.on("order_placed", send_receipt)
events.on("order_placed", update_inventory)
events.on("order_placed", award_points)
```

Now each reaction lives with its own concern, and adding a sixth does not touch the order code. The caution is real, though: this decoupling makes control flow harder to follow, since you cannot see from `place_order` what actually happens. Use it when reactions are genuinely independent and multiplying; do not use it to hide a simple two-step sequence. At larger scale this same shape becomes a message queue between services, which is a later topic.

## 8. The two to be wary of

Two famous patterns cause more harm than good in most backend code, and knowing *why* is part of using patterns well.

**Singleton.** "Ensure only one instance exists, globally reachable." It is popular because it is easy, and it is mostly global state with a nicer name. Global mutable state makes code hard to test (the state leaks between tests), hard to reason about (anything can change it), and hard to run concurrently. Most of what people use singletons for, a database pool, a config object, is better handed in by [dependency injection](/posts/2019/05/design-patterns-you-actually-use/), created once at the edge of your program and passed down. Reach for a singleton rarely, and never for mutable state.

**Over-abstraction in general.** The most common pattern mistake is not the wrong pattern; it is a pattern where none was needed. An interface with one implementation, a factory that only ever builds one type, a strategy dictionary with a single entry: these add indirection and cost while relieving no pain. The rule from section 1, applied as a test: **if you cannot name the concrete second case the abstraction serves, you do not need the abstraction yet.** Add it when the second case arrives.

## The short version

- A pattern is a name for a recurring solution. Its value is shared vocabulary and recognition, not the pattern itself. Do not start with patterns; reach for one when a real pain (duplication, rigidity, an untestable seam) appears.
- Strategy: swap behaviours behind a shared interface, often just a dictionary of functions. The most-used pattern in backend code.
- Factory: put complicated or conditional construction behind one function, so the choice of concrete type lives in one place.
- Dependency injection: pass dependencies in rather than constructing them inside. It is the foundation of testable code and the one idea to adopt first.
- Repository: collect data access behind intent-named methods, so business logic talks about the domain and can be tested without a database.
- Adapter: wrap an awkward third party in the interface you want, so swapping the vendor touches one file.
- Observer and pub/sub: announce an event and let independent reactions subscribe. Powerful when reactions multiply, but it hides control flow, so do not use it for a simple sequence.
- Be wary of the singleton (global state with a nicer name) and of any abstraction whose second concrete case you cannot name. If you cannot name it, you do not need the abstraction yet.

Next: Django or FastAPI, and how the framework you pick quietly shapes the code you write.
