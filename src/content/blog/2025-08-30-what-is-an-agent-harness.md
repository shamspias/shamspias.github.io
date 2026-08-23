---
title: "What Is an Agent Harness? The Part Everyone Skips 🐴"
description: "The five parts of an agent harness: capability surface, meaning, policy, approval and audit. Only two of them are about power."
date: 2025-08-30
permalink: "/posts/2025/08/what-is-an-agent-harness/"
tags:
  - "agent harness"
  - "LLM"
  - "AI engineering"
  - "tool use"
  - "architecture"
  - "beginner"
series: "Agent Harness"
seriesOrder: 1
math: false
---

*Everyone is building agents. Almost nobody is building the thing that keeps an agent from
wrecking your database. This is the first post in a series about that missing piece.*

---

## 1. A horse, a cart, and the bit in between 🐎

Say you buy a horse.

The horse is strong, fast, and (this is important) has its own opinions about where to go.
Left alone, it eats your neighbour's rice plants.

So you don't ride a bare horse. You put on a **harness**: a bridle so it knows where you want
to go, reins so you can say *stop*, blinkers so it isn't distracted, and traces so its strength
actually pulls the cart instead of dragging it sideways into a ditch.

The horse is the engine. The harness is what turns an engine into transport.

**A language model is the horse. Your agent harness is everything else.**

And here's the uncomfortable part: in most projects I've reviewed, the model is excellent and
the harness is a hand-rolled `while` loop with a system prompt that says *"please be careful."*

---

## 2. So what exactly *is* a harness? 🧰

An **agent harness** is the layer between a model and your actual software. It answers five
questions that a model, on its own, cannot:

| Question | Who answers it | If nobody answers it |
|---|---|---|
| What am I allowed to *do*? | The **capability surface** | The model invents endpoints that don't exist |
| What does this operation *mean*? | **Descriptions and types** | It calls `update_t3` and hopes |
| Am I allowed to do this *now*? | **Policy and permissions** | User A reads user B's orders |
| Should a human see this first? | **The approval gate** | A refund runs at 3 a.m. with nobody watching |
| What just happened? | **The audit trail** | "The AI did something" is your entire incident report |

Notice that only the first two are about *capability*. The other three are about *restraint*.
A harness is mostly restraint, and restraint is the part people leave for later, which is to
say, never.

---

## 3. Chatbot, workflow, agent: three different animals 🦜

These get mixed up constantly, so let's separate them.

```python
# 1. A CHATBOT: text in, text out. No hands.
reply = model.chat("How many orders are stuck?")
# -> "I don't have access to your order data."
# Safe. Also useless for this question.


# 2. A WORKFLOW: you decide the steps; the model fills in blanks.
orders = db.query("SELECT * FROM orders WHERE status='processing'")   # you wrote this
summary = model.chat(f"Summarise this: {orders}")                     # model fills the blank
# -> Reliable, and completely rigid. A new question needs a new workflow.


# 3. AN AGENT: you expose operations; the model chooses which to call.
agent = Agent(capabilities=[find_orders, refund_order, email_customer])
agent.run("refund order 8842 and tell the customer")
# -> Flexible. Also the only one of the three that can do real damage.
```

The jump from 2 to 3 is where a harness stops being optional. In a workflow, *you* wrote the
`SELECT`. In an agent, the model is choosing, and the only thing standing between its choice and
your production database is the harness.

---

## 4. The five parts, concretely 🧱

Let me make each part real with the smallest code that shows the idea.

### 4.1 The capability surface: what the model can even see

```python
from reins import capability

@capability
def find_orders(status: str) -> list[dict]:
    """Find orders by their current status."""
    return store.orders(status=status)          # your existing function

@capability
def refund_order(order_id: int) -> dict:
    """Refund a customer's order by its public order number."""
    return payments.refund(order_id)            # your existing function
```

Two functions you already had. The harness reads the **type hints** and the **docstring** and
derives a schema from them. You didn't write JSON. You didn't describe your tables. You
described *what your application does*.

I'll spend the whole next post on why this framing matters more than it looks. Short version:
a name like `refund_order` carries meaning that `UPDATE orders SET status=...` throws away.

### 4.2 Descriptions and types: the model's only map

The model never sees your code. It sees this:

```json
{
  "name": "refund_order",
  "description": "Refund a customer's order by its public order number.",
  "parameters": {"order_id": {"type": "integer"}}
}
```

That's the entire map. Which means a lazy docstring is a *production bug waiting to happen*,
and `order_id: int` versus `order_id: str` is the difference between a call that works and
three wasted retries.

> **Rule of thumb:** if a competent new hire couldn't use your function correctly from the
> docstring alone, the model can't either. It just fails less politely.

### 4.3 Policy: reads are not writes

This is the single highest-value line in any harness:

```python
result = agent.ask("how many orders are stuck in processing?")   # read-only, always
agent.run("refund order 8842")                                  # may write, gated
```

`ask()` cannot call a write capability. Not "is told not to". It *cannot*. The read/write split
is decided when the capability is registered, and enforced in Python, not in a paragraph of
English the model is free to reason around.

Because here's the thing about prompt-level rules:

```python
# This is not security. This is a suggestion.
SYSTEM = "You must never delete data. Only read."

# Anything that reaches the model as text can be argued with by text.
```

Prompt injection isn't exotic. It's a customer typing *"ignore previous instructions"* into a
support ticket that lands in your context window. If your only defence is a sentence in the
system prompt, you don't have a defence. You have a polite request.

### 4.4 The approval gate: a human in the loop that actually works

```python
def approve(call):
    print(f"⚠️  Agent wants to run: {call.name}({call.args})")
    return input("allow? [y/N] ").lower() == "y"

agent = Agent(capabilities=[...], can_write=True, approve=approve)
```

Three things make an approval gate good rather than theatrical:

1. **It shows the resolved call**, not the intent. "Wants to refund order 8842 for ৳4,500",
   not "wants to help the customer."
2. **It's the last step before execution**, so nothing can slip in after approval.
3. **Silence means no.** Default-deny, always. A gate that times out into *allow* is a gate
   made of paper.

### 4.5 The audit trail, because "the AI did it" is not a post-mortem

```python
result = agent.run("refund order 8842")
print(result.explain())
```

```
goal    : refund order 8842
step 1  : find_orders(status="processing")     -> 12 rows      [read]   38ms
step 2  : get_order(order_id=8842)             -> 1 row        [read]   11ms
step 3  : refund_order(order_id=8842)          -> APPROVED     [write] 402ms
tokens  : 1,842 in / 96 out
```

Every call, every classification, every result. When something goes wrong at 2 a.m., this is
the difference between a five-minute fix and a five-hour archaeology expedition.

---

## 5. Putting it together 🔄

```
  "refund order 8842 and tell the customer"
                    │
                    ▼
   ┌────────────────────────────────────────────┐
   │                THE HARNESS                 │
   │  ┌──────────────────────────────────────┐  │
   │  │ capability surface  your typed verbs │  │   ┌───────────────┐
   │  ├──────────────────────────────────────┤  │◄─►│   THE MODEL   │
   │  │ policy              read / write     │  │   │ chooses which │
   │  ├──────────────────────────────────────┤  │   │ verbs, and in │
   │  │ approval gate       default-deny     │  │   │  what order   │
   │  ├──────────────────────────────────────┤  │   └───────────────┘
   │  │ audit log           every call       │  │
   │  └──────────────────────────────────────┘  │
   └────────────────────┬───────────────────────┘
                        ▼
        YOUR APPLICATION CODE
        validation · authorization · business rules
                        ▼
                   [ database ]
```

Read that diagram once more and notice what is **not** there: the model never touches the
database. It never even touches your ORM. It proposes calls into a surface you defined, and
your own code, with all its existing validation and authorization, does the work.

That's the whole trick. The agent inherits every safety property your application already has,
for free, because it goes through the same front door your human users do.

---

## 6. Five failure modes I keep meeting 💀

**"We gave it database access."**
Text-to-SQL demos beautifully and then writes `DELETE FROM users WHERE 1=1` on a Tuesday.
Expose verbs, not tables.

**"The prompt says not to."**
See §4.3. Rules that live in text can be defeated by text.

**"We'll add auth later."**
Multi-tenant apps fail here hardest. If the harness doesn't know *who is asking*, it will
happily fetch anyone's data. Pass a principal from day one:
`Agent(..., principal=current_user)`.

**"It has 60 tools."**
Model accuracy falls off a cliff as the surface grows. Ten well-named capabilities beat sixty
mechanical CRUD wrappers, every time. Auto-generating a tool per endpoint feels productive and
is usually the bug.

**"We log the final answer."**
The final answer is the least interesting artifact. Log the *calls*.

---

## 7. What's coming in this series 📚

This is part 1. The rest goes deeper into the parts that matter most:

- **Part 2, Give the model your verbs, not your tables.** Why intent-named operations beat
  schemas and auto-generated OpenAPI specs, and what "meaning" actually means here.
- **Part 3, Safe by default.** Read/write splits, approval gates, row-level scoping, and
  sandboxing, at the level of real code.
- **Part 4, An agent is data, not code.** Storing agents as versioned specs so they can be
  edited, diffed, rolled back, and improved from feedback.

---

## 8. The short version 📝

- A model is an engine. A harness is what makes it *transport*.
- A harness is five things: **surface, meaning, policy, approval, audit**.
- Only the first two are about power. The other three are about restraint, and restraint is the
  part that ships to production.
- Anything enforced in a prompt is a suggestion. Enforce it in code.
- The best harness is boring, readable, and gives you a log you'd be happy to read out loud in
  an incident review.

If you want to poke at a working one, [**Reins**](https://github.com/shamspias/reins) is the
small version of these ideas. You point it at functions you already have and it does the rest.

*Next up: why `refund_order` is worth more to a model than your entire database schema.*
