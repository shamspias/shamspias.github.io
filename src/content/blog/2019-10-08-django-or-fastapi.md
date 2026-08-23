---
title: "Django or FastAPI: How the Framework Shapes the Code You Write"
seoTitle: "Django or FastAPI: Choosing"
description: "One gives you everything and an opinion; the other gives you speed and a blank page. The choice is about how much you want the framework to decide for you."
date: 2019-10-08
permalink: "/posts/2019/10/django-or-fastapi/"
lang: en
tags:
  - "backend"
  - "django"
  - "fastapi"
  - "python"
series: "Building Backends"
seriesOrder: 2
math: false
---

*Two Python backends dominate, and the internet will tell you FastAPI is fast and Django is old, which is roughly the least useful way to choose between them. The real difference is philosophical: Django decides a great deal for you and hands you a working application; FastAPI decides very little and hands you speed and a blank page. This post is what each choice actually costs and buys, and how the framework you pick quietly shapes the code you end up writing.*

## 1. The two philosophies

**Django is batteries-included and opinionated.** It hands you an ORM, a migration system, an admin interface, authentication, sessions, forms, a templating engine, and a project layout, all designed to work together, all with a Django way of doing things. You get a functioning application very quickly, and in exchange you accept Django's opinions. The framework is a large, coherent whole.

**FastAPI is minimal and unopinionated.** It gives you routing, request and response handling, automatic validation through type hints, automatic API documentation, and first-class async, and almost nothing else. No ORM, no admin, no auth, no project structure. You assemble those from libraries you choose, and in exchange for the work you get exactly the stack you want and nothing you do not.

```
  Django                          FastAPI
  ------                          -------
  ORM, migrations, admin,         routing, validation, docs, async
  auth, forms, templates,         ... and you bring the rest:
  sessions, project layout        an ORM, migrations, auth, layout

  "here is an application"        "here are the fast parts of one"
```

Neither is better. They answer different questions. Django answers "how do I get a complete, conventional web application running and maintained by a team". FastAPI answers "how do I build a fast, modern API with exactly the pieces I choose".

## 2. What Django's batteries actually save you

It is easy to undervalue "batteries included" until you have built the batteries yourself. Three of Django's stand out.

**The ORM and migrations.** Django's ORM is mature, and its migration system, generate a migration from a model change, apply it, roll it back, is one of the best in any ecosystem. On a FastAPI project you will reach for SQLAlchemy and Alembic and wire them together yourself, which is fine, but it is work Django did for you.

**The admin.** Django's automatic admin interface gives non-technical staff a usable back office over your data for almost no code. For internal tools, content management, and "let support edit this table", it is a genuine superpower, and FastAPI has no equivalent you do not build.

**The conventions.** Django projects look alike. A new engineer joining a Django codebase knows where things are: models here, views there, urls there. That uniformity is a real maintenance asset on a team and over years, and it is the thing a blank-page framework cannot give you, because the blank page is filled differently by every team.

The cost of all this is that you live inside Django's choices. When you want to do something the Django way does not anticipate, you fight the framework, and Django is large enough that the fight is sometimes real.

## 3. What FastAPI's minimalism actually buys

**Validation from types, for free.** You declare your request and response shapes as Pydantic models, and FastAPI validates every incoming request against them automatically, rejecting malformed input before your code runs, and generating OpenAPI documentation from the same declarations. This is genuinely excellent, and it removes a whole category of hand-written validation and its bugs.

```python
from fastapi import FastAPI
from pydantic import BaseModel, EmailStr

app = FastAPI()

class SignUp(BaseModel):          # the request shape, declared once
    email: EmailStr
    age: int

@app.post("/users")
def create_user(body: SignUp):    # body is validated before this runs
    # body.email is a valid email, body.age is an int, guaranteed
    return {"id": 1, "email": body.email}
```

**Async, as a first-class citizen.** FastAPI is built on ASGI and async from the ground up. For workloads that spend their time waiting on other services, calling APIs, querying databases, talking to other microservices, async lets one process handle many concurrent requests without a thread each, which is a real throughput and cost win. This is section 4, because it is the most misunderstood part.

**Nothing you did not ask for.** The stack is what you assembled. No admin you are not using, no ORM you did not want, no template engine in an API-only service. For a service that is purely an API, especially one that is mostly I/O-bound and talks to other services, this leanness is a good fit.

The cost is that you assemble and maintain the parts Django would have handed you, and you make the structural decisions Django would have made, which on a large team means agreeing on conventions Django would have imposed.

## 4. The async question, told straight

The headline "FastAPI is fast" is true and misleading, and it is worth being precise because it drives bad decisions.

Async helps when your code is **I/O-bound**: it spends most of its time waiting, for a database, an external API, the network. While one request waits, an async server can serve others on the same thread, so you handle far more concurrent connections with the same resources. An API that mostly calls other services is the ideal case, and here FastAPI's async genuinely shines.

Async does *not* help when your code is **CPU-bound**: crunching numbers, resizing images, running a model. A CPU-bound task blocks the event loop for everyone, and async makes it worse, not better, because now one slow computation stalls every concurrent request. CPU-bound work needs processes or a task queue, not async.

And there is a trap specific to async: **one blocking call poisons the loop.** If, inside an async handler, you make a synchronous database call or a synchronous HTTP request, you block the entire event loop while it runs, and your concurrency collapses. Async is all-or-nothing along a request path: every I/O call in an async handler must be async too, or the benefit evaporates. This is the most common FastAPI performance bug, and it is why "just make it async" without an async database driver often makes things slower.

Django added async support too, so this is not purely a framework divide. The honest summary: async is a large win for I/O-bound services if you go async all the way down, and a liability if your workload is CPU-bound or your I/O is secretly synchronous.

## 5. How the choice shapes your code

Beyond features, the framework changes the code you write.

Django pulls you toward a **monolith with conventions**: fat models or fat services, the ORM everywhere, request handling in views, and a shared project structure. It is very productive for a conventional web application with server-rendered pages or a standard API, and it scales well as a team codebase because everyone shares the conventions.

FastAPI pulls you toward **explicit, composed, typed code**: dependencies injected through its dependency system (which is [dependency injection from part 1](/posts/2019/05/design-patterns-you-actually-use/) built into the framework), Pydantic models at the boundaries, and a structure you designed. It rewards teams that want control and are willing to make and enforce their own conventions, and it fits an API-only, I/O-bound, service-oriented world.

## 6. So which one

A decision guide, not a verdict.

**Reach for Django when:** you are building a conventional web application, especially with server-rendered pages or an admin back office; you want a complete, maintained stack out of the box; you value team uniformity and long-term maintainability over squeezing out latency; or the workload is ordinary CRUD over a relational database.

**Reach for FastAPI when:** you are building an API, especially a service that is mostly I/O-bound and talks to other services; you want automatic validation and docs from types; you want to choose your own stack; or you specifically need high-concurrency async I/O.

And the pragmatic truth underneath both: for most applications, either works, and the team's familiarity matters more than the framework's ceiling. A team fluent in Django ships a better product in Django than in a FastAPI stack they are learning, and the reverse. Choose the one your team will build well, and do not let a benchmark you will never hit make the decision.

## The short version

- The real difference is not speed, it is how much is decided for you. Django is batteries-included and opinionated; FastAPI is minimal and hands you a blank page plus the fast parts.
- Django's batteries are worth more than they look: a mature ORM and migrations, an automatic admin back office, and conventions that make a team codebase uniform and maintainable. The cost is living inside its opinions.
- FastAPI's wins are automatic validation and docs from type hints, first-class async, and a stack with nothing you did not ask for. The cost is assembling and maintaining the parts, and the conventions, that Django would have given you.
- Async helps I/O-bound work (many requests waiting on other services) and hurts CPU-bound work (one computation stalls everyone). One synchronous call inside an async handler poisons the whole event loop, which is the most common FastAPI performance bug.
- The framework shapes the code: Django toward a conventional monolith, FastAPI toward explicit, typed, composed services with dependency injection built in.
- Django for conventional web apps, admin back offices, and team uniformity; FastAPI for I/O-bound APIs, typed validation, and a stack you control. For most apps either works, and your team's fluency matters more than the framework's ceiling.

Next: databases and ACID, and what a transaction actually promises when two things happen at once.
