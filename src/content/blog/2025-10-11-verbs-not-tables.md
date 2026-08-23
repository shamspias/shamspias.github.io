---
title: "Give the Model Your Verbs, Not Your Tables"
description: "Why intent-named operations beat database schemas, auto-generated OpenAPI specs and one-command MCP servers when you hand an application to a model."
date: 2025-10-11
permalink: "/posts/2025/10/verbs-not-tables/"
tags:
  - "agent harness"
  - "LLM"
  - "tool use"
  - "text-to-SQL"
  - "api design"
  - "AI engineering"
series: "Agent Harness"
seriesOrder: 2
math: false
---

*Part 2 of the agent-harness series. The decision that most determines whether your agent is
reliable is what you show it, and it now takes exactly one command to show it the wrong thing.
Updated in 2026, with the parts that have dated called out as they come.*

---

## 1. Two ways to hand over your shop

You are going away for a fortnight and somebody has to mind your shop.

**Option A.** You hand over the ledger, the stock spreadsheet, and the key to the filing
cabinet. "It's all in there."

**Option B.** You hand over one page: how to serve a customer, how to reorder stock when it runs
low, how to issue a refund, how to lock up at night.

Option A contains more information. Option B gets the shop run correctly.

The difference is not volume, it is intent. The ledger records what happened. The page records
what things mean and what to do about them. A ledger has never been asked to decide anything, so
it has never had to write down that a refund also means moving money back and telling the
customer.

Now replace "somebody" with "a language model" and you have the whole argument of this post.

---

## 2. What a schema throws away

A schema is the bare description of how data is stored: the tables, their columns, the type of
each one. Here is one. Read it the way a model has to, with nothing else in front of you.

```sql
CREATE TABLE orders (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER,
  status      VARCHAR(20),
  total_cents INTEGER,
  refunded_at TIMESTAMP NULL,
  meta        JSONB
);
```

Now answer, from that alone:

- What are the legal values of `status`? Is it `'shipped'`, `'SHIPPED'`, or `4`?
- To refund an order, do you set `refunded_at`, or `status='refunded'`, or both? In what order?
  Does anything else have to happen: a payment-provider call, an email, a stock adjustment?
- Is `total_cents` before or after discount? Does it include tax?
- Can `user_id` be null for guest checkouts?
- What is in `meta`? Anything at all?

You cannot answer any of it. Neither can the model. The difference is that you would go and ask
somebody, and the model will answer anyway, because answering is what it does.

Everything the schema drops is exactly the part that matters:

```
  WHAT YOU KNOW                                WHAT THE SCHEMA SAYS
  ─────────────────────────────────            ────────────────────
  refund goes through the provider  ──▶        nothing
  then the flag, then the email     ──▶        nothing
  status is one of five, lowercase  ──▶        VARCHAR(20)
  totals are net of tax             ──▶        INTEGER
  guest checkouts have no user      ──▶        INTEGER NULL
  meta is dead, kept for 2019 data  ──▶        JSONB
```

So the model writes this, fluently and with total confidence:

```sql
UPDATE orders SET status = 'refunded' WHERE id = 8842;
```

Your payment provider never hears about it. The customer never gets their money. Reconciliation
finds the hole three weeks later.

The failure is not hallucination. The failure is that **you asked a question the schema cannot
answer, and got a plausible guess.** A better model gives you a more plausible guess.

Worth saying plainly, because the field has moved: text-to-SQL has genuinely improved since I
first wrote this. Against a well-documented warehouse, with column comments and a semantic
layer that spells out what each metric means, current models write read queries that are good
enough to be useful, and I use them that way. None of that transfers to writes. A `SELECT` that
is wrong gives you a wrong number, which you will probably notice. An `UPDATE` that is wrong
gives you a corrupt row and a side effect that silently never happened.

---

## 3. What a verb keeps

The same operation, expressed as a function you almost certainly already have:

```python
@capability
def refund_order(order_id: int) -> dict:
    """Refund a customer's order by its public order number.

    Issues the refund through the payment provider, marks the order refunded,
    restocks the items, and emails the customer their confirmation.
    """
    return payments.refund(order_id)
```

Count what just arrived that the schema did not have:

1. **A name that states intent.** `refund_order`, not `UPDATE orders SET`.
2. **The unit of work.** One call is one complete refund. There is no way to do half of it.
3. **The correct sequence,** because you already wrote it: the provider call, the flag, the
   restock, the email, in that order.
4. **The right identifier.** "Public order number", so the model asks for `8842` and not an
   internal surrogate key it has no way to know.
5. **A boundary.** Whatever else your database can do, this function does exactly this.

And the thing it cannot do: anything you did not expose. The model cannot `DROP TABLE`. It
cannot write a `WHERE` clause that forgets the tenant filter. It cannot reach a column you never
put in a function. Not because you asked nicely in the system prompt, but because the surface
does not contain it. That distinction is the entire series.

> **The rule:** hand the model your **verbs**, not your **nouns**. Verbs carry intent, nouns
> carry structure, and intent cannot be reconstructed from structure.

---

## 4. But my ORM already has models, do I write all this by hand?

No. This is the part people assume is laborious and it isn't. Your ORM, the object-relational
mapper that already maps each table to a class in your code, encodes most of what is needed:
names, types, nullability, relationships, unique constraints.

```python
from reins import Agent

# SQLAlchemy: pass your Session, sessionmaker or Engine.
agent = Agent.from_orm(db, models=[User, Order])          # read-only, safe by default
agent.ask("how many orders are still open for acme@corp.com?")
```

What that generates is not a table dump. It is a set of verbs:

```
find_orders(status=..., user_id=..., limit=...)      [read]
get_order(order_id=...)                              [read]
get_user_by_email(email=...)                         [read]
create_order(...)                                    [write]
update_order(order_id=..., ...)                      [write]
```

Three details in there matter more than they look.

**Lookups prefer a unique natural key.** `get_user_by_email` beats `get_user(id=...)`, because a
human, or a model reading a support ticket, knows the email address. Nobody knows that Rahim is
user `41207`. Choosing the identifier the caller can actually supply removes a whole class of
failed call, and it removes the two-step dance where the model guesses an id to look up an id.

**Read and write are classified when the verb is generated,** not guessed later and never asked
of the model. `find_*` and `get_*` are reads; `create_*`, `update_*`, `delete_*` are writes.
That classification is what makes the read-only mode from the
[previous post](/posts/2025/08/what-is-an-agent-harness/) enforceable in code rather than in
English.

**Responses are bounded.** A naive tool returns five hundred rows, floods the context window,
and the next call reasons over whatever survived truncation. Paging and row caps are not a
nicety, they are a correctness feature.

The same call works for Django, where the connection is global:

```python
agent = Agent.from_orm(models=[User, Order], can_write=True)  # opt-in, still gated
agent.run("refund order 8842 and email the customer")
```

And you can mix: generate the boring create, read, update and delete verbs, hand-write the
operations that carry real business meaning.

```python
agent = Agent.from_orm(
    db, models=[User, Order], extra=[refund_order, apply_loyalty_credit]
)
```

That mix is what I would actually recommend. Generated verbs cover breadth cheaply. Hand-written
verbs carry the logic you would never want a model reassembling from columns.

---

## 5. "Isn't this just an OpenAPI spec?"

Fair question, and the answer is instructive: an auto-generated spec has the same disease as a
schema, one layer up.

```
GET    /api/v2/orders?status={s}&page={p}&per_page={n}&sort={field}
PATCH  /api/v2/orders/{id}
POST   /api/v2/orders/{id}/transitions
GET    /api/v2/orders/{id}/line_items
POST   /api/v2/payments
POST   /api/v2/payments/{id}/reversals
GET    /api/v2/customers/{id}/notifications
POST   /api/v2/notifications
```

Eight endpoints. Now: *refund order 8842 and tell the customer.* Which of those do you call, in
what order, and what does a "transition" do that a `PATCH` does not?

```
  "refund order 8842 and tell the customer"
                       │
      ┌────────────────┴────────────────┐
      ▼                                 ▼
  ONE TOOL PER ENDPOINT             ONE INTENT VERB
  ─────────────────────────────     ──────────────────────────────
  the model picks 4 of the 8        the model calls
  and orders them correctly,        refund_order(8842)
  on every single request
                                    your code then runs, in the
  GET  /payments?order=8842         order you already tested:
  POST /payments/{id}/reversals       get payment
  POST /orders/{id}/transitions       reverse payment
  POST /notifications                 transition order
                                      notify customer
  4 decisions, each fallible        0 decisions
```

REST endpoints are shaped for resources and HTTP verbs, not for business intent. They are a
fine machine interface and a poor instruction sheet. Auto-generating one tool per endpoint feels
like progress, because you have "exposed the whole API", and what you have actually handed over
is a jigsaw with no picture on the box.

The fix is not to hide the API. It is a thin intent layer above it:

```python
@capability
def refund_order(order_id: int) -> dict:
    """Refund a customer's order by its public order number and notify them."""
    payment = api.get_payment_for_order(order_id)
    api.reverse_payment(payment.id)
    api.transition_order(order_id, "refunded")
    api.notify_customer(order_id, template="refund_confirmation")
    return {"order_id": order_id, "status": "refunded"}
```

One verb. Four endpoints. No opportunity for the model to get the sequence wrong.

### The 2026 form of the same mistake

When I wrote this in 2025 the mistake took effort: somebody had to write a script that walked an
OpenAPI document and emitted one tool per path. Now it is a single command. Generators that turn
a spec into a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server are
everywhere, and so are MCP servers that connect straight to Postgres or MySQL and expose the
schema. They are genuinely useful, and I run the database ones myself against a read replica
when I want to poke at data from an editor.

The trap is that installing one feels like the work is done. It isn't. A protocol standardised
how a capability is named, described, discovered and transported. It did not decide which
capabilities should exist, and that was always the hard half. A generated MCP server over your
production API is the ledger and the filing-cabinet key, delivered faster and with a nicer
handshake.

The good news is that the same intent layer solves it. Write your verbs as ordinary functions,
then expose those as an MCP server if you want the portability. The protocol is a transport
decision. The verb list is a design decision, and only you can make it.

---

## 6. Fewer, sharper verbs

The version of this section I first published said that adding tools makes agents worse past
roughly thirty of them, and drew a little bar chart to prove it. That was true of 2025 models
and it has dated. Context windows are larger, tool-calling is trained much harder, and harnesses
now retrieve tool definitions on demand instead of pasting all of them into every turn. Raw
count is no longer the binding constraint.

The thing that actually degraded selection was never the count. It was overlap.

```
  THIRTY DISTINCT VERBS                 THIRTY OVERLAPPING VERBS
  ─────────────────────────             ────────────────────────────
  refund_order                          update_order
  cancel_subscription                   patch_order
  apply_loyalty_credit                  set_order_status
  get_user_by_email                     transition_order
  close_shift                           modify_order_fields
  ... 25 more, all different            ... 25 more, all similar
  ─────────────────────────             ────────────────────────────
  chosen by meaning                     chosen by coin flip
```

The right-hand column is not a model failure. You could not reliably pick between those five
either, from the names alone, and neither could the engineer who wrote them. Worse, on-demand
tool retrieval does not save you here: a retriever handed five near-identical descriptions will
confidently fetch the wrong one, and now the mistake happens before the model even reasons.

There is also a plain cost argument. Tool definitions are prompt tokens sitting at the front
of the request, which is the part prompt caching is best at. A stable tool list is billed in
full once and then at the much cheaper cache-read rate. A list you shuffle or rebuild per turn
invalidates the cached prefix, and you pay for all of it again, every turn.

So:

- **Collapse near-duplicates.** One `update_order` with optional fields beats four setters.
- **Name by intent, not by mechanism.** `cancel_subscription`, not `set_sub_flag_2`.
- **Delete verbs nobody asks for.** Every unused capability is pure cost: tokens, ambiguity,
  risk surface.
- **Keep the list stable within a conversation,** for the cache and for the model's sanity.
- **If the surface is genuinely large, gate it by role.** Load the subset a given caller needs.
  Once that subset is configuration rather than code, you are most of the way to the argument in
  [part 4](/posts/2026/08/an-agent-is-data-not-code/).

One more thing changed and it changed for the better: strict schemas and constrained decoding,
which allow the model to emit only arguments that fit the declared shape, have more or less
killed malformed arguments. The failures I still see in production are
well-formed calls to the wrong verb. No amount of JSON-schema validation catches that. Naming
does.

---

## 7. Six rules for naming verbs

Naming is the actual work here, so let me be concrete.

| Rule | Good | Bad |
|---|---|---|
| Verb plus noun | `find_orders` | `orders` |
| One job per verb | `refund_order` | `manage_order` |
| Say the identifier | `get_user_by_email` | `get_user` |
| Domain words, not table words | `cancel_subscription` | `update_sub_tbl` |
| Read or write visible in the name | `find_*` and `create_*` | `do_order_thing` |
| Docstring states side effects | *"restocks, emails the customer"* | *"Refunds an order."* |

The last row is the one people skip and the one that pays best. The docstring is the only place
you can tell the model *this sends a real email to a real human*. If it does not say so, the
model has no way to be appropriately careful, and "be careful" in the system prompt is not a
mechanism. Write the description for a competent new colleague on their first day, because that
is very close to what is reading it.

---

## 8. Try it on your own app right now

The fastest way to feel the difference is to look at your own capability surface before you
build anything on top of it.

```bash
pip install "reins[sqlalchemy]"

reins inspect sqlite:///shop.db     # no API key needed
```

It reflects your tables, prints the exact verbs an agent would be given, and marks each one read
or write. Read that list as if you were the model. If you cannot tell which verb to call for a
plausible request, the model cannot either, and you have just found your afternoon's work.
([Reins](https://github.com/shamspias/reins) is my own small implementation of this series. The
idea is the point; use whatever you like.)

Then, still without writing a line of code:

```bash
reins chat sqlite:///shop.db        # interactive, read-only
```

Read-only means read-only, enforced by the classification in section 4 rather than by asking. It
is a cheap way to build confidence in a surface before you ever turn writes on, which is exactly
where [part 3](/posts/2025/12/safe-by-default-agents/) picks up.

---

## 9. The short version

- A schema tells the model what exists. A verb tells it what to do. It needs the second.
- Every intent-named function carries five things a table cannot: intent, unit of work, correct
  sequence, the right identifier, and a boundary.
- ORM introspection gets you most of the verbs free. Hand-write the ones with real business
  meaning, and prefer natural keys over surrogate ids.
- Auto-generated OpenAPI tools have the schema disease one layer up, and one-command MCP servers
  are the 2026 version of it. Add a thin intent layer, then expose that.
- Tool count matters less than it did in 2025. Overlapping names still wreck selection, and
  on-demand tool retrieval makes overlap worse, not better.
- Strict schemas fixed malformed arguments. They cannot fix a well-formed call to the wrong
  verb.
- Keep the tool list stable across a conversation so prompt caching works for you.
- Name by intent, expose the real identifier, and put the side effects in the docstring.

*Next in the series: making writes safe, with read/write enforcement, approval gates, row-level
scoping, and what a sandbox is actually for.*
