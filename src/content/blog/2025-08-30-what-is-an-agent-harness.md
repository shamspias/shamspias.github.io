---
title: "What Is an Agent Harness? The Part Everyone Skips"
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

*Everyone is building agents. Almost nobody is building the layer that stops one from wrecking
a database. This is part 1 of a four-part series about that missing layer.*

---

## 1. A horse, a cart, and the bit in between

Say you buy a horse.

The horse is strong, fast, and (this is the important bit) has its own opinions about where to
go. Left alone, it eats your neighbour's rice plants.

So nobody rides a bare horse. You put on a **harness**: a bridle so it knows where you want to
go, reins so you can say *stop*, blinkers so it isn't distracted, and traces so its strength
pulls the cart instead of dragging it sideways into a ditch.

The horse is the engine. The harness is what turns an engine into transport.

**A language model is the horse. Your agent harness is everything else.**

The uncomfortable part: in most projects I have reviewed, the model is excellent and the
harness is a hand-rolled `while` loop wrapped around a system prompt (the standing
instructions the model gets before any user speaks) that says *"please be careful."*

---

## 2. So what exactly is a harness?

An **agent harness** is the layer between a model and your actual software. It answers five
questions that a model, on its own, cannot:

| Question | Who answers it | If nobody answers it |
|---|---|---|
| What am I allowed to *do*? | The **capability surface** | The model invents endpoints |
| What does this operation *mean*? | **Descriptions and types** | It calls `update_t3` blind |
| Am I allowed to do this *now*? | **Policy and permissions** | User A reads user B's orders |
| Should a human see this first? | **The approval gate** | A refund runs at 3 a.m., unwatched |
| What just happened? | **The audit trail** | "The AI did something" is your incident report |

Only the first two are about *capability*. The other three are about *restraint*. A harness is
mostly restraint, and restraint is the part people leave for later, which is to say, never.

A note on vocabulary, because it has shifted since I first wrote this. In 2025 "harness" was
still a word you had to explain. By 2026 it is standard, every vendor ships an agent SDK that
claims to be one, and the word has stretched to cover everything from a prompt template to a
full permissions system. So be specific when you use it. The five rows above are what I mean.

---

## 3. Chatbot, workflow, agent: three different animals

These get mixed up constantly, so let me separate them.

```python
# 1. A CHATBOT: text in, text out. No hands.
reply = model.chat("How many orders are stuck?")
# -> "I don't have access to your order data."
# Safe. Also useless for this question.


# 2. A WORKFLOW: you decide the steps; the model fills in blanks.
orders = db.query("SELECT * FROM orders WHERE status='processing'")  # you wrote this
summary = model.chat(f"Summarise this: {orders}")            # model fills a blank
# -> Reliable, and completely rigid. A new question needs a new workflow.


# 3. AN AGENT: you expose operations; the model chooses which to call.
agent = Agent(capabilities=[find_orders, refund_order, email_customer])
agent.run("refund order 8842 and tell the customer")
# -> Flexible. Also the only one of the three that can do real damage.
```

The whole difference is one question: who picks the steps?

```
                 chatbot        workflow         agent
 ─────────────────────────────────────────────────────────────
 picks the       nobody,        you, at write    the model,
 steps           there are      time             at run time
                 no steps

 touches your    no             yes, through     yes, through
 systems                        code you wrote   calls it chose

 blast radius    none           exactly what     anything the
                                you coded        surface allows

 needs a         no             no               yes
 harness
```

The jump from workflow to agent is where a harness stops being optional. In a workflow, *you*
wrote the `SELECT`. In an agent, the model is choosing, and the only thing standing between its
choice and your production database is the harness.

---

## 4. The five parts, concretely

Each part below is the smallest code that shows the idea.

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
derives a schema from them. You did not write JSON. You did not describe your tables. You
described *what your application does*.

[Part 2](/posts/2025/10/verbs-not-tables/) is entirely about why that framing matters more than
it looks. Short version: a name like `refund_order` carries meaning that
`UPDATE orders SET status=...` throws away.

### 4.2 Descriptions and types: the model's only map

The model never sees your code. It sees this:

```json
{
  "name": "refund_order",
  "description": "Refund a customer's order by its public order number.",
  "input_schema": {
    "type": "object",
    "properties": {"order_id": {"type": "integer"}},
    "required": ["order_id"]
  }
}
```

That is the entire map. Which means a lazy docstring is a production bug waiting to happen, and
`order_id: int` versus `order_id: str` is the difference between a call that works and three
wasted retries.

> **Rule of thumb:** if a competent new hire could not use your function correctly from the
> docstring alone, the model cannot either. It just fails less politely.

### 4.3 Policy: reads are not writes

This is the single highest-value line in any harness:

```python
result = agent.ask("how many orders are stuck in processing?")  # read-only, always
agent.run("refund order 8842")                                  # may write, gated
```

`ask()` cannot call a write capability. Not "is told not to". It *cannot*. The read/write split
is decided when the capability is registered and enforced in Python, not in a paragraph of
English that the model is free to reason its way around.

Because here is the thing about prompt-level rules:

```python
# This is not security. This is a suggestion.
SYSTEM = "You must never delete data. Only read."

# Anything that reaches the model as text can be argued with by text.
```

Prompt injection is not exotic. It is a customer typing *"ignore previous instructions"* into a
support ticket that lands in your context window, or a web page your agent fetched, or a PDF in
an attachment. It sits at the top of the
[OWASP LLM top 10](https://owasp.org/www-project-top-10-for-large-language-model-applications/),
and as of 2026 there is still no model-level fix: training and classifiers reduce the rate, they
do not close the hole. That is not a gap waiting to be patched next year. It is a structural
property of putting untrusted text and trusted instructions in the same channel, and the only
reliable answer is to make the dangerous action impossible rather than discouraged.

### 4.4 The approval gate: a human in the loop that actually works

```python
def approve(call):
    print(f"Agent wants to run: {call.name}({call.args})")
    return input("allow? [y/N] ").lower() == "y"

agent = Agent(capabilities=[...], can_write=True, approve=approve)
```

Three things make an approval gate real rather than theatrical:

1. **It shows the resolved call**, not the intent. "Wants to refund order 8842 for BDT 4,500",
   not "wants to help the customer."
2. **It is the last step before execution**, so nothing can be slipped in after approval.
3. **Silence means no.** Default-deny, always. A gate that times out into *allow* is a gate made
   of paper.

The 2026 pressure on this design is that agents now run for hours in the background, and a human
cannot sit at a prompt for every call. The answer is not to weaken the gate. It is to make the
gate cheaper: gate by risk class rather than per call, give each run a spend and blast-radius
budget that hard-stops when exhausted, and keep one kill switch that revokes write capabilities
mid-run. If nobody is watching, the correct set of write capabilities is often the empty set.

### 4.5 The audit trail, because "the AI did it" is not a post-mortem

```python
result = agent.run("refund order 8842 and tell the customer")
print(result.explain())
```

```
goal   : refund order 8842 and tell the customer
step 1 : find_orders(status="processing")   -> 12 rows    [read]   38ms
step 2 : refund_order(order_id=8842)        -> APPROVED   [write] 402ms
step 3 : email_customer(order_id=8842)      -> sent       [write] 210ms
tokens : 1,842 in / 96 out
```

Every call, every classification, every result. Log the arguments as they were resolved, the
principal on whose behalf the call ran, and the decision the gate made. When something goes
wrong at 2 a.m., this is the difference between a five-minute fix and a five-hour archaeology
expedition.

---

## 5. Putting it together

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
        validation · authorisation · business rules
                        ▼
                   [ database ]
```

Read that once more and notice what is **not** in it: the model never touches the database. It
never touches the code that talks to the database either. It proposes calls into a surface
you defined, and your own code, with all its existing validation and authorisation, does the
work.

That is the whole trick. The agent inherits every safety property your application already has,
for free, because it goes in through the same front door your human users do.

---

## 6. What the tool protocols changed, and what they did not

When I first wrote this post, wiring a model to a tool meant hand-rolling JSON schemas per
vendor. That part is now solved. [MCP](https://modelcontextprotocol.io), the Model Context
Protocol, and the vendor agent SDKs standardised how a capability is named, described,
discovered and transported, and it is a genuine improvement: connectors are reusable, and the
schema plumbing is somebody else's problem.

It is also the easy half, and it is worth being precise about where the line falls.

```
   ┌──────────────────────────────────────────────────────┐
   │  MODEL                                               │
   └───────────────────────┬──────────────────────────────┘
                           │  "call refund_order(8842)"
   ┌───────────────────────▼──────────────────────────────┐
   │  TOOL PROTOCOL  (MCP, or your vendor's agent SDK)    │
   │  names · schemas · discovery · transport · server    │
   │  auth.  Standard, portable, boring. Solved.          │
   └───────────────────────┬──────────────────────────────┘
                           │  a well-formed call, still untrusted
   ┌───────────────────────▼──────────────────────────────┐
   │  HARNESS                                             │
   │  is this a read or a write?                          │
   │  who is asking, and what rows are theirs?            │
   │  does a human sign this one?                         │
   │  what gets written to the log either way?            │
   │  Yours to build. Every time.                         │
   └───────────────────────┬──────────────────────────────┘
                           ▼
                  your application code
```

A protocol tells you the call is well-formed. It does not tell you the call is allowed. Rows
three, four and five of the table in section 2 have no standard, because they depend on your
domain, your tenancy model and your appetite for risk. If you install an MCP server and think
you now have a harness, you have bought a very good bridle and no reins.

Meanwhile the models got better at multi-step tool use, which raises the stakes rather than
lowering them. A model that reliably carries out a ten-step plan unattended will also reliably
carry out ten wrong steps unattended.

---

## 7. Five failure modes I keep meeting

**"We gave it database access."**
Text-to-SQL demos beautifully and then writes `DELETE FROM users WHERE 1=1` on a Tuesday. Expose
verbs, not tables.

**"The prompt says not to."**
See section 4.3. Rules that live in text can be defeated by text.

**"We'll add auth later."**
Multi-tenant apps fail here hardest. If the harness does not know *who is asking*, it will
happily fetch anyone's data. Pass a principal from day one:
`Agent(..., principal=current_user)`.

**"It has 60 tools."**
This one has aged, so let me correct my own earlier advice. With 2023-era models, accuracy fell
off a cliff after a dozen or so tools. Frontier models in 2026 cope with far larger surfaces, so
raw count is no longer the thing to fear. What bites now is ambiguity and cost: two capabilities
whose descriptions overlap produce a coin flip on every call, and every tool definition is
re-sent on every turn, so a bloated surface is a bill you pay per step (prompt caching makes
those tokens cheaper, not free). Load capabilities per task, or expose a search-then-call
pattern, and keep names that could never be confused for one another. Auto-generating one
tool per REST endpoint still feels productive and is still usually the bug.

**"We log the final answer."**
The final answer is the least interesting artefact. Log the calls.

---

## 8. What's coming in this series

- **[Part 2, Give the model your verbs, not your tables](/posts/2025/10/verbs-not-tables/).**
  Why intent-named operations beat schemas and auto-generated OpenAPI specs, and what "meaning"
  actually means here.
- **[Part 3, Safe by default](/posts/2025/12/safe-by-default-agents/).** Read/write splits,
  principal scoping, approval gates, sandboxes and budgets, at the level of real code.
- **[Part 4, An agent is data, not code](/posts/2026/08/an-agent-is-data-not-code/).** Storing
  agents as versioned rows so they can be edited, diffed, rolled back, and improved from
  feedback.

---

## 9. The short version

- A model is an engine. A harness is what makes it transport.
- A harness is five things: **surface, meaning, policy, approval, audit**.
- Only the first two are about power. The other three are about restraint, and restraint is the
  part that ships to production.
- Anything enforced in a prompt is a suggestion. Enforce it in code, because prompt injection
  has no model-level fix and is not getting one.
- MCP and the vendor SDKs solved naming and transport. They did not solve permissions, approval
  or audit, and those are still yours to write.
- Tool count matters less than it used to; overlapping tool descriptions and context cost matter
  more.
- The best harness is boring, readable, and gives you a log you would be happy to read out loud
  in an incident review.

If you want to poke at a working one, [Reins](https://github.com/shamspias/reins) is the small
version of these ideas. You point it at functions you already have and it does the rest.

*Next up: why `refund_order` is worth more to a model than your entire database schema.*
