---
title: "SQL or NoSQL: Just Use Postgres, and the Cases Where You Should Not"
seoTitle: "SQL or NoSQL: How to Choose"
description: "NoSQL was sold as the future and is really a specialised tool. What each kind buys, why relational is the right default, and the real cases for reaching past it."
date: 2020-09-15
permalink: "/posts/2020/09/sql-or-nosql/"
lang: en
tags:
  - "backend"
  - "databases"
  - "nosql"
  - "postgresql"
series: "Building Backends"
seriesOrder: 4
math: false
---

*For a while NoSQL was sold as the future and relational databases as legacy, and a lot of teams reached for a document store because it was modern, then spent years rebuilding the guarantees they threw away. NoSQL is not a successor to SQL; it is a family of specialised tools that trade the relational model's guarantees for something specific. This post is what each kind actually buys, why relational should be your default, and the genuine cases for reaching past it.*

## 1. What "NoSQL" even means

"NoSQL" is a terrible name, because it groups together very different databases whose only shared trait is "not a traditional relational database". There are four broad families, and lumping them together is the source of most confusion.

- **Document stores** (MongoDB, and PostgreSQL's own JSON). Store flexible, nested documents keyed by an id. Good when your data is naturally a self-contained document with a shape that varies.
- **Key-value stores** (Redis, DynamoDB in its simplest use). A giant, fast dictionary: give a key, get a value. Good for caching, sessions, and anything you look up by an exact key at very high speed.
- **Wide-column stores** (Cassandra, HBase). Tables with flexible columns, built to spread across many machines and take enormous write volumes. Good for write-heavy, time-series-like data at large scale.
- **Graph databases** (Neo4j). Store nodes and the edges between them, and traverse relationships fast. Good when the *relationships* are the point: social graphs, recommendations, networks.

Each answers a specific question. None answers "what is the general-purpose database", because the relational database already answers that well.

## 2. Why relational is the right default

Start from the default and make alternatives earn their place. The relational model, tables, rows, and relationships between them enforced by the database, is the default for good reasons that are easy to undervalue until you lose them.

- **The relationships are enforced.** Foreign keys mean an order cannot point at a customer who does not exist, and the database guarantees it. In a document store you enforce that in application code, which means you eventually fail to.
- **[ACID transactions](/posts/2020/04/databases-and-acid/).** You can change several things atomically, with the guarantees from the last post. Many NoSQL stores offer only limited transactions, or none across documents.
- **Ad-hoc queries.** SQL lets you ask questions you did not anticipate when you designed the schema: join these, group by that, filter the other. NoSQL stores are typically fast only for the access patterns you designed for, and slow or incapable for the ones you did not.
- **It is well understood.** Decades of tools, knowledge, and operational experience. Your next engineer knows SQL.

The one-line version: **relational databases give you correctness and flexibility of querying by default, and you should give those up only for a specific, named reason.** The burden of proof is on NoSQL, not on Postgres.

## 3. The real reasons to reach past relational

There are genuine ones. Reach for NoSQL when you have a specific need that the relational model serves poorly, not because it is fashionable.

**Caching and ephemeral fast lookups.** A key-value store like Redis in front of your database, holding sessions, computed results, rate-limit counters, is not really "instead of SQL", it is alongside it, and it is one of the most common and correct uses of NoSQL. You keep Postgres as the source of truth and use Redis for what it is superb at: microsecond lookups by key.

**Genuinely schemaless, self-contained documents.** When each record is a nested document whose shape varies a lot and you never need to join across records, a document store fits. But note: PostgreSQL's `jsonb` column gives you flexible document storage *inside* a relational database, with indexing on JSON fields, so you can have the flexible document and the transactions and the joins. This covers a large fraction of "I need MongoDB" cases without leaving Postgres.

**Write volume beyond one machine.** When your write rate genuinely exceeds what a single powerful relational server can handle, and you have measured this, not assumed it, a wide-column store built for horizontal scale earns its place. This is a real need at large scale and a fantasy at small scale, which is the trap of the next section.

**Relationship-heavy traversal.** When your core queries are "friends of friends", "shortest path", "what is connected to what", a graph database does in one step what SQL does in painful recursive joins. If traversal is your product, a graph store is the right tool.

## 4. The scale trap, and the CAP theorem plainly

The most common bad reason to choose NoSQL is "it scales". Here is the honest picture.

A single well-configured PostgreSQL server handles a very large amount: many thousands of transactions per second, terabytes of data. The overwhelming majority of applications never come close to outgrowing one relational server, especially with a read replica or two for read scaling. Choosing a distributed NoSQL store for scale you do not have means paying its costs, weaker consistency, restricted queries, more operational complexity, in exchange for a benefit you will never use. **Do not adopt a distributed database for scale you have not measured and do not have.**

When you *do* distribute across machines, the CAP theorem describes the trade you cannot escape, and it is simpler than its reputation. When your database is spread across machines and the network between them fails (a partition, which will happen), you must choose between two things:

- **Consistency**: every read sees the latest write, so during a partition, parts of the system that cannot confirm they are up to date must refuse to answer.
- **Availability**: every request gets an answer, so during a partition, some parts answer with possibly-stale data.

You cannot have both during a partition; that is the theorem. A single-machine relational database sidesteps it entirely because there is no partition to worry about. A distributed store forces the choice on you, and "eventual consistency", the writes will agree *eventually*, but a read right now might be stale, is what many NoSQL stores chose: availability over immediate consistency. That is fine for a social feed and catastrophic for a bank balance. The trade is real and it is the hidden cost of distribution.

```
  during a network partition, a distributed database must pick:

  CONSISTENCY  -> refuse to answer if you can't confirm you're current
  AVAILABILITY -> always answer, even if the answer might be stale

  a single-machine Postgres has no partition, so it dodges the choice.
```

## 5. The pragmatic path

A workflow that serves almost every project:

1. **Start with PostgreSQL** for your source of truth. Model your data relationally, use its `jsonb` for the genuinely document-shaped parts, and lean on transactions and foreign keys.
2. **Add Redis** when you need caching, sessions, or fast counters. This is complementary, not a replacement.
3. **Reach for a specialised store only when you have a measured, specific need** the relational model serves badly: proven write volume beyond one machine, or a core workload that is graph traversal or time-series at scale.
4. **When you do, keep the relational database as the system of record** where you can, and use the specialised store for the specific workload it is good at, rather than moving everything.

This "Postgres plus Redis, add specialised stores by evidence" shape is unglamorous and it is what most healthy systems actually look like. The teams that regretted their database choice almost always chose a distributed NoSQL store early, for scale they did not have, and rebuilt transactions and joins in application code for years.

## The short version

- "NoSQL" groups four different tools: document stores, key-value stores, wide-column stores, and graph databases. Their only shared trait is not being a traditional relational database, so treating them as one thing causes most of the confusion.
- Relational is the right default because it enforces relationships, gives ACID transactions, allows ad-hoc queries you did not anticipate, and is universally understood. Give those up only for a specific named reason.
- Genuine reasons to reach past it: caching and fast key lookups (Redis, alongside SQL, not instead), truly schemaless documents (often covered by Postgres `jsonb`), write volume beyond one machine that you have measured, and relationship-heavy graph traversal.
- The worst reason is "it scales". A single Postgres server handles far more than most applications ever need. Do not adopt a distributed database for scale you do not have and have not measured.
- CAP, plainly: when a distributed database is partitioned by a network failure, it must choose between consistency (refuse if it cannot confirm it is current) and availability (answer with possibly-stale data). A single-machine database dodges the choice. Eventual consistency trades immediate correctness for availability, which is fine for a feed and wrong for a balance.
- The pragmatic path: Postgres as source of truth, Redis for caching, specialised stores only by evidence, and keep the relational database as the system of record.

Next: designing a REST API that survives contact with real clients and does not need a version two.
