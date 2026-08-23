---
title: "Give the Model Your Verbs, Not Your Tables 🔧"
description: "Why intent-named operations beat database schemas and auto-generated OpenAPI specs when you hand an application to a model."
date: 2025-10-11
permalink: "/posts/2025/10/verbs-not-tables/"
tags:
  - "agent harness"
  - "LLM"
  - "tool use"
  - "text-to-SQL"
  - "API design"
  - "AI engineering"
series: "Agent Harness"
seriesOrder: 2
math: false
---

*Part 2 of the agent-harness series. The single decision that most determines whether your
agent is reliable is what you show it, and almost everyone shows it the wrong thing.*

---

## 1. Two ways to hand someone your shop 🏪

Imagine you're going on holiday and you need someone to mind your shop for two weeks.

**Option A.** You hand them a copy of your ledger, your stock spreadsheet, and the keys to the
filing cabinet. "Everything's in there. Figure it out."

**Option B.** You hand them a page that says: *how to serve a customer, how to reorder stock
when it's low, how to issue a refund, how to close up at night.*

Option A gives them *more* information. Option B gets the shop run correctly.

The difference isn't volume. Option B contains **your intent**. The ledger records
what happened; the instructions record what things *mean*.

Now replace "someone" with "a language model", and you have the entire argument of this post.

---

## 2. What a schema throws away 🗑️

Here's a table. Look at it the way a model has to.

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
- To refund an order, do you set `refunded_at`, or set `status='refunded'`, or both? In what
  order? Does anything else need to happen: a payment-provider call, an email, a stock
  adjustment?
- Is `total_cents` before or after discount? Does it include tax?
- Can `user_id` be null for guest checkouts?
- What's in `meta`? Anything at all?

You can't answer any of that. Neither can the model. But, and this is the crucial bit, **the
model will answer anyway**, because that's what models do. It will confidently write

```sql
UPDATE orders SET status = 'refunded' WHERE id = 8842;
```

...and your payment provider never hears about it, the customer never gets their money, and
your reconciliation job finds the discrepancy three weeks later.

The failure isn't hallucination. The failure is that **you asked a question the schema cannot
answer, and got a plausible guess.**

---

## 3. What a verb keeps 💎

Same operation, expressed as a function you already have:

```python
@capability
def refund_order(order_id: int) -> dict:
    """Refund a customer's order by its public order number.

    Issues the refund through the payment provider, marks the order refunded,
    restocks the items, and emails the customer their confirmation.
    """
    return payments.refund(order_id)
```

Count what just arrived that the schema didn't have:

1. **A name that states intent.** `refund_order`, not `UPDATE orders SET`.
2. **The unit of work.** One call is one complete refund. There is no way to do half of it.
3. **The correct sequence,** because *you* already wrote it: the provider call, the flag, the
   restock, the email, in the right order.
4. **The right identifier.** "Public order number", so the model asks for `8842` and not an
   internal surrogate key it has no way to know.
5. **A boundary.** Whatever else your database can do, this function does exactly this.

And the thing it *cannot* do: anything you didn't expose. The model can't `DROP TABLE`. It
can't write a `WHERE` clause that forgets a tenant filter. It can't reach a column you never
put in a function. That's not because you asked nicely. It's because the surface doesn't contain
it.

> **The rule:** hand the model your **verbs**, not your **nouns**. Verbs carry intent. Nouns
> carry structure. The model needs intent; it can't reconstruct it from structure.

---

## 4. But my ORM already has models, do I write all this by hand? 🏗️

No. This is the part people assume is laborious, and it isn't, because your ORM models already
encode most of what's needed.

```python
from reins import Agent

# SQLAlchemy: pass your Session / sessionmaker / Engine
agent = Agent.from_orm(db, models=[User, Order])          # read-only, safe by default
agent.ask("how many orders are still open for acme@corp.com?")
```

What that generates is not a table dump. It's a set of verbs:

```
find_orders(status=..., user_id=..., limit=...)      [read]
get_order(order_id=...)                             [read]
get_user_by_email(email=...)                        [read]
create_order(...)                                   [write]
update_order(order_id=..., ...)                     [write]
```

Three details in there matter more than they look:

**Lookups prefer a unique natural key.** `get_user_by_email` beats `get_user(id=...)`, because
a human, or a model reading a support ticket, knows the email. Nobody knows that Rahim is user
`41207`. Choosing the identifier the caller can actually supply removes an entire class of
failed call.

**Read and write are classified at generation time.** Not guessed later, not asked of the
model. `find_*` and `get_*` are reads; `create_*`, `update_*`, `delete_*` are writes. That
classification is what makes the read-only mode in the [previous post](/posts/2025/08/what-is-an-agent-harness/)
enforceable in code.

**Responses get trimmed.** A naive tool returns 500 rows and floods the context window; the
next call then reasons over truncated garbage. Bounded, paged responses aren't a nicety, they're
a correctness feature.

The same `from_orm` works for Django, where the connection is global:

```python
agent = Agent.from_orm(models=[User, Order], can_write=True)   # writes opt-in, still gated
agent.run("refund order 8842 and email the customer")
```

And you can always mix: generate the boring CRUD, hand-write the operations that carry real
business meaning.

```python
agent = Agent.from_orm(db, models=[User, Order], extra=[refund_order, apply_loyalty_credit])
```

That mix is what I'd recommend in practice. Generated verbs cover breadth; hand-written verbs
carry the logic you'd never want a model reconstructing from columns.

---

## 5. "Isn't this just an OpenAPI spec?" 🤔

Fair question, and the answer is instructive: an auto-generated spec has the same disease as a
schema, one layer up.

```
GET    /api/v2/orders?status={s}&page={p}&per_page={n}&sort={field}&order={dir}
PATCH  /api/v2/orders/{id}
POST   /api/v2/orders/{id}/transitions
GET    /api/v2/orders/{id}/line_items
POST   /api/v2/payments
POST   /api/v2/payments/{id}/reversals
GET    /api/v2/customers/{id}/notifications
POST   /api/v2/notifications
```

Eight endpoints. Now: *refund order 8842 and tell the customer.* Which of those do you call, in
what order, and what does a "transition" do that a `PATCH` doesn't?

REST endpoints are shaped for **resources and HTTP verbs**, not for **business intent**. They're
a fine machine interface and a poor instruction sheet. Auto-generating one tool per endpoint
feels like progress (you've "exposed the whole API!") and in practice you've handed the model a
jigsaw puzzle and no picture on the box.

The fix is not to hide the API. It's to add a thin intent layer above it:

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

One verb. Four endpoints. Zero opportunity for the model to get the sequence wrong.

---

## 6. Fewer, better verbs 📉

Here's a result that surprises people: **adding tools makes agents worse past a certain point.**

```
tool count vs. correct-selection rate  (my rough experience, not a paper)

  8 verbs   ████████████████████  strong
 15 verbs   ██████████████████    still good
 30 verbs   █████████████         noticeably shakier
 60 verbs   ████████              coin-flips on similar names
```

The mechanism is obvious once you see it: with sixty tools, several of them look alike.
`update_order` vs `patch_order` vs `set_order_status` vs `transition_order`. The model isn't
being stupid. *You* couldn't reliably choose between those either, from names alone.

So:

- **Collapse near-duplicates.** One `update_order` with optional fields beats four setters.
- **Name by intent, not by mechanism.** `cancel_subscription`, not `set_sub_flag_2`.
- **Delete verbs nobody asks for.** Every unused capability is pure cost: tokens, ambiguity,
  risk surface.
- **If the surface is genuinely large, gate it.** Load a subset per role or per conversation
  rather than showing everything to everyone.

A small, sharp, well-named surface outperforms an exhaustive one. Every time.

---

## 7. Six rules for naming verbs 📐

Naming is the actual work here, so let's be concrete.

| Rule | ✅ Good | ❌ Bad |
|---|---|---|
| Verb + noun | `find_orders` | `orders` |
| One job per verb | `refund_order` | `manage_order` |
| Say the identifier | `get_user_by_email` | `get_user` |
| Domain words, not table words | `cancel_subscription` | `update_sub_tbl` |
| Read/write visible in the name | `find_*` / `create_*` | `do_order_thing` |
| Docstring says the side effects | *"…restocks items and emails the customer"* | *"Refunds an order."* |

That last row is the one people skip and the one that pays best. The docstring is the only place
you can tell the model *"this sends a real email to a real human"*. If it doesn't say that, the
model has no way to be appropriately careful.

---

## 8. Try it on your own app right now 🧪

The fastest way to feel the difference is to look at your own capability surface before building
anything on it:

```bash
pip install "reins[sqlalchemy]"

reins inspect sqlite:///shop.db     # no API key needed
```

It reflects your tables, prints the exact verbs an agent would get, and marks each one read or
write. Read that list as if you were the model. If *you* can't tell which verb to call for a
plausible request, the model can't either, and you've found your work.

Then, still without writing a line of code:

```bash
reins chat sqlite:///shop.db        # interactive, read-only Q&A
```

Read-only means read-only. It's a good way to build confidence in the surface before you ever
turn writes on, which is where [part 3](/posts/2025/12/safe-by-default-agents/) picks up.

---

## 9. The short version 📝

- A schema tells the model **what exists**. A verb tells it **what to do**. It needs the second.
- Every intent-named function carries five things a table can't: intent, unit of work, correct
  sequence, the right identifier, and a boundary.
- ORM introspection gets you most of the verbs for free. Hand-write the ones with real business
  meaning.
- Auto-generated OpenAPI tools have the schema disease one layer up. Add a thin intent layer.
- **Fewer, sharper verbs beat exhaustive coverage.** Delete tools nobody uses.
- Name by intent, expose the real identifier, and put the side effects in the docstring.

*Next in the series: making writes safe, covering read/write enforcement, approval gates,
row-level scoping, and what a sandbox is actually for.*
