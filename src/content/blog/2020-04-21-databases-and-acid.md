---
title: "Databases and ACID: What a Transaction Actually Promises"
seoTitle: "Databases and ACID, Explained"
description: "A transaction is a promise the database makes when two things happen at once. What ACID guarantees, the anomalies it prevents, and the race it does not."
date: 2020-04-21
permalink: "/posts/2020/04/databases-and-acid/"
lang: en
tags:
  - "backend"
  - "databases"
  - "acid"
  - "postgresql"
series: "Building Backends"
seriesOrder: 3
math: false
---

*Most database bugs are not about a single query being wrong. They are about two things happening at the same time, and the database doing something you did not expect in between. A transaction is the tool for that, and ACID is the precise list of what it promises. This post is those promises in concrete terms, the specific ways data corrupts without them, and the one race condition that a naive transaction still does not fix.*

## 1. The problem transactions solve

Consider a bank transfer: take 100 from account A, add 100 to account B. Two writes. Now imagine the server crashes, or a second request interleaves, between them.

```
  1. subtract 100 from A     <- this succeeds
  2. [ crash, or another request runs here ]
  3. add 100 to B            <- this never happens
```

The money has vanished. A left A's account and never arrived in B's. This is the class of bug transactions exist for: an operation that must happen *completely or not at all*, and must not be corrupted by something else happening at the same time. Wrap the two writes in a transaction and the database guarantees they are one indivisible unit.

```sql
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 'A';
  UPDATE accounts SET balance = balance + 100 WHERE id = 'B';
COMMIT;   -- both, or if anything fails before here, neither
```

ACID is the four-letter name for exactly what that guarantee contains.

## 2. ACID, one letter at a time

**Atomicity: all or nothing.** Every statement in the transaction happens, or none does. If anything fails, or you `ROLLBACK`, or the server crashes mid-transaction, the database undoes everything back to the `BEGIN`. There is no half-done transfer. This is the letter that fixes the crash in section 1.

**Consistency: the rules always hold.** A transaction moves the database from one valid state to another, never leaving it in a state that breaks your declared rules, the constraints, foreign keys, and checks you defined. If a transaction would leave an order pointing at a customer who does not exist, the foreign key rejects it and the whole transaction fails. The database enforces your invariants, which is a large part of why you declare them in the schema rather than hoping the application remembers.

**Isolation: concurrent transactions do not see each other's mess.** When two transactions run at the same time, isolation controls how much each can see of the other's in-progress work. This is the subtle one, it has levels, and it is section 3, because most concurrency bugs live here.

**Durability: committed means committed.** Once the database says `COMMIT` succeeded, the data survives a crash, a power loss, a restart. It is written to durable storage before the commit is acknowledged. When the database tells you it saved, it saved.

Atomicity, consistency and durability are usually automatic once you use transactions. Isolation is the one you have to think about, because its default is a trade-off and its failures are silent.

## 3. Isolation levels and the anomalies they prevent

Full isolation, every transaction behaving as if it ran completely alone, is expensive, because it means serialising work that could have run in parallel. So databases offer *levels* of isolation, each preventing more anomalies at more cost. To choose one you have to know the anomalies.

- **Dirty read.** Transaction B reads data that transaction A has written but not yet committed. If A then rolls back, B acted on data that never officially existed.
- **Non-repeatable read.** B reads a row, A commits a change to it, B reads the same row again and gets a different value, within a single transaction.
- **Phantom read.** B runs a query returning a set of rows, A commits a new row that matches, B runs the same query and a new row has appeared.
- **Lost update.** Two transactions read the same value, both modify it, both write, and one overwrites the other. This is the dangerous one, section 4.

The standard levels, each forbidding more:

| Level | Dirty read | Non-repeatable | Phantom |
|---|---|---|---|
| Read uncommitted | possible | possible | possible |
| Read committed | prevented | possible | possible |
| Repeatable read | prevented | prevented | possible* |
| Serializable | prevented | prevented | prevented |

**Read committed** is the default in PostgreSQL and most databases, and it is the right default for most work: you never read uncommitted garbage, but you may see committed changes appear between two reads. **Serializable** gives you the illusion that transactions ran one at a time, which is the strongest guarantee and the one to reach for when correctness under concurrency matters more than throughput. (PostgreSQL's repeatable read actually prevents phantoms too, which is why the asterisk: implementations vary, so check yours.)

The practical advice: know that read committed is your default, and that it does *not* protect you from the lost update, which people assume it does.

## 4. The race a transaction does not fix by itself

Here is the bug that surprises people, because they wrapped it in a transaction and expected safety. Two requests both try to spend from a wallet with 100 in it, each spending 100, at the same time.

```
  request 1                          request 2
  ---------                          ---------
  BEGIN                              BEGIN
  read balance -> 100                read balance -> 100      (still 100!)
  check 100 >= 100  ok              check 100 >= 100  ok
  balance = 100 - 100 = 0           balance = 100 - 100 = 0
  UPDATE balance = 0                UPDATE balance = 0
  COMMIT                            COMMIT

  result: balance is 0, but 200 was spent. one update was lost.
```

Both transactions read the same 100, both decided it was enough, both wrote 0. Under read committed, nothing stopped them, because each read a committed value and wrote a committed value. The transaction was atomic and durable and it still let you spend the money twice. This is the lost update, and it is one of the most common serious bugs in real systems, double-charging, overselling stock, awarding a bonus twice.

There are three correct fixes, and knowing them is the point of this post.

**Do the arithmetic in the database, atomically.** The read-modify-write in the application is the flaw. Push the check and the update into one atomic statement:

```sql
UPDATE wallets
SET balance = balance - 100
WHERE id = 'W' AND balance >= 100;   -- the condition and the write are one step
```

If this affects zero rows, the balance was insufficient, and you reject. Because the condition and the change are a single statement, the database evaluates `balance >= 100` and writes atomically, and the second request sees the already-decremented balance and its condition fails. This is the simplest fix and usually the right one.

**Lock the row while you work (pessimistic).** When you genuinely must read, compute in application code, and write, lock the row so no one else can touch it until you commit:

```sql
BEGIN;
  SELECT balance FROM wallets WHERE id = 'W' FOR UPDATE;  -- locks the row
  -- other transactions block here until this one commits
  UPDATE wallets SET balance = ... WHERE id = 'W';
COMMIT;
```

`FOR UPDATE` makes the second request wait until the first commits, then read the real, updated value. Correct, at the cost of the second request blocking.

**Detect the conflict and retry (optimistic).** Add a version number, read it, and on write require it to be unchanged:

```sql
UPDATE wallets SET balance = ..., version = version + 1
WHERE id = 'W' AND version = 7;   -- only if no one changed it since we read
```

Zero rows affected means someone else got there first; you re-read and retry. This wins when conflicts are rare, because it never blocks; it loses when they are frequent, because it retries a lot.

The lesson to carry: **a transaction gives you atomicity, not mutual exclusion.** For a read-modify-write under concurrency, you additionally need atomic arithmetic, a lock, or a version check. This one distinction prevents a large share of real production incidents.

## 5. Why PostgreSQL, briefly

Since this series will use it: PostgreSQL is the sensible default relational database for most new work, and the reasons are boring in the best way. It is fully ACID and rigorous about correctness. It has excellent concurrency through multi-version concurrency control, so readers do not block writers and writers do not block readers. It has a rich type system (including proper JSON support, so it covers many "I need NoSQL" cases, the next post). It is mature, well-documented, open, and it rarely surprises you. "Just use Postgres" is good advice far more often than not, and the burden of proof is on the alternative.

## 6. Two more things that bite

Briefly, because they are constant sources of real slowness.

**Indexes.** A query that filters or joins on a column the database has to scan every row to check is slow in proportion to the table size. An index on that column turns the scan into a lookup. The trade: indexes speed reads and slow writes (every write must update the index) and cost space, so index the columns you filter, join, and sort on, and not every column. When a query is slow, the first question is almost always "is there an index for what it filters on", and `EXPLAIN` will tell you whether one is used.

**The N+1 query problem.** You fetch a list of 100 orders, then loop and fetch each order's customer, one query per order: 1 + 100 queries where 2 would do. This is the most common ORM performance bug, and it hides because each query is fast; it is the count that kills you. The fix is to fetch the related data in one go (a join, or the ORM's eager-loading, `select_related`/`prefetch_related` in Django, `joinedload` in SQLAlchemy). Watch your query count in development, not just your query speed.

## The short version

- A transaction makes several statements one indivisible unit, for operations that must happen completely or not at all and must survive things happening at the same time.
- ACID is the promise: Atomicity (all or nothing), Consistency (your declared rules always hold), Isolation (concurrent transactions do not see each other's uncommitted mess), Durability (committed means it survives a crash).
- Atomicity, consistency and durability are largely automatic. Isolation has levels, trading safety for throughput, and its failures are silent. Read committed is the usual default: no dirty reads, but changes can appear between two reads.
- A transaction does not give mutual exclusion. Two concurrent read-modify-writes under read committed can both read the old value and one overwrites the other: the lost update, which double-charges and oversells.
- Fix the lost update by doing the arithmetic atomically in one `UPDATE ... WHERE balance >= 100`, or locking the row with `SELECT ... FOR UPDATE`, or an optimistic version check with retry. Atomic arithmetic is usually the simplest and right.
- PostgreSQL is the sensible default: fully ACID, strong concurrency, rich types including JSON. "Just use Postgres" is right more often than not.
- Two constant performance bugs: missing indexes on the columns you filter and join on, and the N+1 query problem where an ORM fetches related rows one at a time. Watch query counts, and read `EXPLAIN`.

Next: SQL or NoSQL, when to reach past the relational database, and when the honest answer is still Postgres.
