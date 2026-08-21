---
title: "An Agent Is Data, Not Code 🗃️"
date: 2026-08-08
permalink: /posts/2026/08/an-agent-is-data-not-code/
tags:
  - agent harness
  - LLM
  - architecture
  - system design
  - AI engineering
math: false
---

*Part 4 of the agent-harness series. One architectural decision — store agents as versioned rows
instead of writing them as code — and the six capabilities you get for free once you make it.*

---

## 1. The question that broke my first design 🧩

I built an agent platform the obvious way. Each agent was a Python class: its prompt, its tool
list, its retrieval settings, its behaviour.

It worked. Then a user asked:

> *"Can you make it always cite the page number?"*

And the answer was: sure — I'll edit the class, run the tests, deploy, and it'll be live in
twenty minutes.

That answer is wrong in every way that matters. The user's request is a *configuration change*
expressed in English. My architecture had turned it into a **software release**. Twenty minutes,
a developer, a deploy, no undo, no diff, no record of who asked or why.

Now scale it: forty users, each with their own agent, each asking for tweaks. You are now a
human compiler, and you are the bottleneck for every change in the system.

The mistake wasn't in the code. It was one layer up.

---

## 2. The inversion 🔄

**An agent is not code. An agent is data.**

Concretely: a row in Postgres. A versioned, validated document describing what the agent is.

```json
{
  "id": "spec_8f21",
  "agent_id": "agt_docs_qa",
  "version": 7,
  "name": "Policy Docs Assistant",
  "policy": "Answer only from the attached knowledge base. Always cite page numbers. If the answer is not in the documents, say so.",
  "persona": {
    "voice": "precise, formal, brief",
    "greeting": "Which policy can I look up for you?"
  },
  "tools": ["kb.search", "time.now"],
  "knowledge_bases": [
    {"id": "kb_hr_policies", "retrieval": "hybrid", "reranker": "bge-reranker-v2", "top_k": 6}
  ],
  "thinking_method": "decision_loop",
  "sub_agents": [],
  "limits": {"max_steps": 8, "max_tokens": 20000},
  "created_by": "rahim@example.com",
  "created_at": "2026-06-14T09:12:44Z"
}
```

The **runtime becomes a pure interpreter** of that document. It has no per-agent code. It reads
the spec and behaves accordingly.

Which means the whole system has exactly three operations:

| Operation | What it is |
|---|---|
| **Build** | natural language → a validated spec |
| **Run** | interpret a spec |
| **Edit** | natural language → a patch on a spec |

That's it. No deploys.

---

## 3. Build: compiling English into a spec 🏗️

```
User: "answer questions from these docs and always cite the page"
                          │
                          ▼
              ┌───────────────────────┐
              │   THE ORCHESTRATOR    │   an LLM whose output is
              │  NL  ->  AgentSpec    │   a schema-validated document
              └───────────┬───────────┘
                          ▼
              ┌───────────────────────┐
              │ SCHEMA VALIDATION     │   tools exist? KB exists?
              │ + REFERENCE CHECK     │   limits sane? persona valid?
              └───────────┬───────────┘
                          ▼
                    spec v1, stored
```

Two properties do the heavy lifting here.

**The orchestrator's output is validated, not trusted.** It's an LLM writing a document, so it
will occasionally invent a tool name or reference a knowledge base that doesn't exist. Validation
catches that before storage — the same argument as the
[safety layers](/posts/2025/12/safe-by-default-agents/): if it must be true, check it in code.

**The output is inspectable.** A user can read the spec their sentence produced. When behaviour
surprises them, the explanation is a document they can look at, not an inference about what a
model is "thinking".

---

## 4. Edit: a patch you approve 📝

This is where the design earns its keep.

```
User: "be less formal, and search the web too"
                          │
                          ▼
                 orchestrator emits a JSON-Patch
                          │
                          ▼
   ┌──────────────────────────────────────────────────┐
   │  PROPOSED CHANGE  ·  v7 → v8                     │
   │                                                  │
   │  persona.voice                                   │
   │    - "precise, formal, brief"                    │
   │    + "warm, conversational, brief"               │
   │                                                  │
   │  tools                                           │
   │    + "web.scrape"                                │
   │                                                  │
   │              [ approve ]   [ reject ]            │
   └──────────────────────────────────────────────────┘
```

A **diff**. Reviewable, approvable, rejectable — and reversible, because v7 still exists.

Note that the *agent* did not modify itself. It **proposed** a modification, and a human accepted
it. Self-modifying systems are terrifying precisely when the modification is opaque; a
schema-validated diff behind an approval gate is not terrifying, it's a pull request.

The storage model is the familiar one:

```sql
-- stable identity
CREATE TABLE agents (
  id          TEXT PRIMARY KEY,
  current_ver INTEGER NOT NULL
);

-- immutable, append-only history
CREATE TABLE agent_specs (
  agent_id   TEXT    NOT NULL REFERENCES agents(id),
  version    INTEGER NOT NULL,
  spec       JSONB   NOT NULL,
  created_by TEXT    NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, version)
);
```

An agent is a stable ID plus an append-only stack of immutable specs. Nothing is ever mutated.
Rollback is `UPDATE agents SET current_ver = 6`.

---

## 5. Six things that become easy 🎁

The payoff isn't the elegance. It's that six genuinely hard features turn into small ones.

**1. Versioning and rollback.** A change made a bad agent worse? Point at the previous version.
One integer.

**2. Diffing.** "What changed between last Tuesday and today?" is a JSON diff. Try answering that
question about a system where behaviour lives in prompts scattered across a codebase.

**3. Audit.** Every version records who created it and from what request. The full history of an
agent's behaviour is queryable — and that's a compliance answer, not just a nice-to-have.

**4. Templates and cloning.** A good agent is a document. Copy it, adjust three fields, and you
have a new agent. No code duplication, no inheritance hierarchy.

**5. Teams as composition.** "Build a team to run an online store" produces a coordinator spec
with `sub_agents` referencing specialist specs. A team is a graph of documents, with a depth cap
so delegation can't recurse forever.

```json
{
  "name": "Store Coordinator",
  "sub_agents": ["agt_inventory", "agt_support", "agt_pricing"],
  "limits": {"max_delegation_depth": 2}
}
```

**6. Learning that persists.** This is my favourite. An agent gets a 👎, or notices its own dead
end — a tool call that failed, a search that returned nothing useful. It reflects and writes a
**lesson**:

```json
{
  "agent_id": "agt_docs_qa",
  "lesson": "When the user asks about leave policy, search 'annual leave' AND 'vacation' — the documents use both terms.",
  "source": "thumbs_down",
  "created_at": "2026-07-02T11:41:03Z"
}
```

Lessons are injected on every subsequent run. The agent gets sharper with use, like a colleague
who remembers last month's confusion.

And crucially, lessons are **data alongside the spec, not inside it**. So you can read them,
delete a bad one, and never wonder whether the agent has quietly drifted somewhere you can't
see. Compare that to fine-tuning, where the learning is baked into weights and effectively
un-auditable.

---

## 6. Where it costs you 💸

Every architecture trades something. Here's what this one trades, plainly.

**The spec schema is now your API.** Changing it means migrating every stored spec. Version the
schema from day one and write migrations, or you will be hand-editing JSONB at some point.

**Expressiveness has a ceiling.** Anything the schema can't express, an agent can't do. When a
user needs genuinely novel behaviour, you extend the schema and the interpreter — a real code
change with a real deploy. The win is that this becomes *rare* rather than constant.

**The interpreter gets complex.** All the branching that used to live in per-agent classes now
lives in one runtime. It needs to be well-tested, because every agent depends on it. A bug there
is a bug everywhere.

**Validation must be strict.** A spec that validates but is semantically nonsense — a tool that
exists but has no credentials, a KB that's empty — produces a confusing runtime failure. Validate
references, not just shapes.

**Debugging shifts.** You're no longer reading code to understand behaviour; you're reading a
document plus a step trace. Different skill, and you need the trace to be *good* or you're worse
off than before.

For a platform where non-developers create and modify agents, I'd make this trade every time. For
a single agent embedded in one product, hard-coding is genuinely simpler, and you should
hard-code.

---

## 7. How this fits the rest of the series 🔗

Four posts, one arc:

| Post | Idea |
|---|---|
| [1 — What is an agent harness](/posts/2025/08/what-is-an-agent-harness/) | surface, meaning, policy, approval, audit |
| [2 — Verbs, not tables](/posts/2025/10/verbs-not-tables/) | expose intent-named operations, not schemas |
| [3 — Safe by default](/posts/2025/12/safe-by-default-agents/) | enforce in code; never in a prompt |
| **4 — Agents as data** | make behaviour itself inspectable and reversible |

The thread through all four: **move the important things out of places you can't inspect.**

Out of the model's reasoning, into a typed capability surface. Out of the system prompt, into code
that enforces. Out of source files, into versioned rows with diffs and history.

None of that makes the model better. It makes the *system* honest — and an honest system is the
only kind you can safely give more power to.

---

## 8. The short version 📝

- Storing agents as code turns "please cite page numbers" into a **software release**. That's the
  bug.
- Store an agent as a **versioned, validated spec row**; make the runtime a **pure interpreter**.
- Three operations: **build** (NL → spec), **run** (interpret), **edit** (NL → approved patch).
- Validate the orchestrator's output. It's an LLM writing a document — it will invent tool names.
- Free wins: rollback, diffs, audit, templates, teams-as-composition, and **persistent lessons**
  you can actually read and delete.
- Real costs: schema migrations, an expressiveness ceiling, a complex interpreter, and stricter
  validation.
- Worth it for a platform. Overkill for one embedded agent — hard-code that one.

*The whole series in one line: put the important things where you can see them.*
