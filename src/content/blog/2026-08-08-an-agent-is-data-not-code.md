---
title: "An Agent Is Data, Not Code"
description: "Store agents as versioned, validated rows instead of writing them as classes, and rollback, diffs, audit, teams and lessons come free. Here is the bill."
date: 2026-08-08
permalink: "/posts/2026/08/an-agent-is-data-not-code/"
tags:
  - "agent harness"
  - "LLM"
  - "architecture"
  - "system design"
  - "AI engineering"
series: "Agent Harness"
seriesOrder: 4
math: false
---

*Part 4 of the agent-harness series. One decision, store agents as versioned rows instead of
writing them as code, and six genuinely hard features turn into small ones. Here is the
decision, and here is the bill.*

---

## 1. The question that broke my first design

I built an agent platform the obvious way. Each agent was a Python class holding its prompt,
its tool list, its retrieval settings, its behaviour. It worked. Then a user asked:

> *"Can you make it always cite the page number?"*

And my answer was: sure, I'll edit the class, write a test, get it reviewed, deploy, and it
will be live in twenty minutes.

That answer is wrong in every way that matters. In plain terms, the user asked me to move a
chair and my building required a planning application. In precise terms, the request is a
*configuration change* expressed in English, and my architecture had turned it into a
**software release**: twenty minutes, one developer, a deploy, no undo, no diff, and no record
of who asked or why.

Now scale it. Forty users, each with their own agent, each with their own tweaks. You are the
human compiler, and you are the bottleneck for every change in the system.

```
 the request: "always cite the page number"

 AS CODE                            AS DATA
 ────────────────────────────       ────────────────────────────
 edit the agent class               orchestrator drafts a patch
 write a test                       schema + reference check
 open a pull request, get a review  user reads a two-line diff
 automated tests, build, deploy     user clicks approve
 revert commit if it's wrong        rollback is one integer
 ~20 minutes, needs me              seconds, needs nobody
```

The mistake was not in the code. It was one layer up.

---

## 2. The inversion

**An agent is not code. An agent is data.**

The everyday version: your heating schedule is not part of the boiler. It is a list of times
and temperatures that the boiler reads on every cycle. Nobody re-solders a boiler because you
want the heating on an hour earlier, and nobody should redeploy a service because a user wants
page numbers in the citations.

The precise version: an agent is a row in Postgres. A versioned document that describes what
the agent is, checked on write against a fixed schema, which is only a declaration of which
fields may exist and what may go in each of them.

```json
{
  "schema_version": 3,
  "agent_id": "agt_docs_qa",
  "version": 7,
  "name": "Policy Docs Assistant",
  "policy": "Answer only from the knowledge base. Cite pages. If unsure, say so.",
  "persona": {
    "voice": "precise, formal, brief",
    "greeting": "Which policy can I look up for you?"
  },
  "tools": ["kb.search", "time.now"],
  "knowledge_bases": [
    {
      "id": "kb_hr_policies",
      "retrieval": "hybrid",
      "reranker": "bge-reranker-v2-m3",
      "top_k": 6
    }
  ],
  "thinking_method": "decision_loop",
  "sub_agents": [],
  "limits": {"max_steps": 8, "max_tokens": 20000},
  "created_by": "rahim@example.com",
  "created_at": "2026-06-14T09:12:44Z"
}
```

Every field there is a knob somebody might reasonably want to turn: which documents to search
and how (`retrieval` and `reranker`, unpicked in [the retrieval
benchmark](/posts/2025/05/rag-retrieval-benchmark/)), how the agent should sound, and which
reasoning loop it runs. `thinking_method` is chosen from the fixed set the interpreter
implements, not free text.

The **runtime becomes a pure interpreter** of that document. There is no per-agent code
anywhere in it. It reads the spec and behaves accordingly, in the way that a browser has no
code specific to any one website.

Which leaves the whole system with exactly three operations:

| Operation | What it is |
|---|---|
| **Build** | natural language, validated into a spec |
| **Run** | interpret a spec |
| **Edit** | natural language, validated into a patch on a spec |

That is all of it. No deploys.

---

## 3. Build: compiling English into a spec

An **orchestrator** is an LLM whose job is not to chat but to emit a document. The user writes
a sentence; the orchestrator writes the spec that sentence implies.

```
 "answer from these docs and always cite the page"
                        │
                        ▼
        ┌───────────────────────────────┐
        │  ORCHESTRATOR                 │  an LLM, decoding
        │  English  ->  AgentSpec draft │  constrained to the
        └───────────────┬───────────────┘  spec's JSON Schema
                        ▼
        ┌───────────────────────────────┐
        │  SHAPE CHECK                  │  nearly free now
        └───────────────┬───────────────┘
                        ▼
        ┌───────────────────────────────┐
        │  REFERENCE CHECK              │  does kb_hr_policies
        │  tools, KBs, models, limits   │  actually exist?
        └───────────────┬───────────────┘
                        ▼
                 spec v1, stored
```

One thing here has changed since I first built this, and it changed for the better. In 2023
you asked a model to "reply with JSON only" and then wrote a parser full of apologies. That is
no longer how it is done. Every serious inference path now supports **constrained decoding**:
you hand it a JSON Schema and the sampler is restricted to tokens that keep the output valid,
so a syntactically broken spec is not something the model can produce. The hosted APIs call it
structured outputs, and so does vLLM if you self-host, though older vLLM releases called the
same feature guided decoding. Underneath sits a grammar engine such as XGrammar or Outlines.
Use it. It removes an entire class of retry logic.

What it does not do is make the document *true*. Shape is guaranteed; existence is not. A
hallucinated tool name is syntactically perfect and still wrong. So the second gate is written
in ordinary code, on the same argument as the
[safety layers](/posts/2025/12/safe-by-default-agents/) in part 3: if it must be true, check it
in code.

```python
from __future__ import annotations  # so ToolRegistry and KBIndex need no import here

from typing import Literal
from pydantic import BaseModel, Field


class KnowledgeBase(BaseModel):
    id: str
    retrieval: Literal["hybrid", "dense", "bm25"] = "hybrid"
    reranker: str | None = None
    top_k: int = Field(default=6, ge=1, le=50)


class AgentSpec(BaseModel):
    # Stamped on every row so old specs can be upcast on read. See section 4.
    schema_version: int = 3
    name: str = Field(min_length=1, max_length=80)
    policy: str = Field(max_length=8000)
    tools: list[str] = []
    knowledge_bases: list[KnowledgeBase] = []
    max_steps: int = Field(default=8, ge=1, le=40)


def reference_errors(spec: AgentSpec, tools: ToolRegistry, kbs: KBIndex) -> list[str]:
    errors = [f"no such tool: {t}" for t in spec.tools if t not in tools]
    for kb in spec.knowledge_bases:
        if kb.id not in kbs:
            errors.append(f"no such knowledge base: {kb.id}")
        elif kbs[kb.id].document_count == 0:
            # Valid, referenced, and empty. This is the failure users report as
            # "the agent is broken" and engineers waste an afternoon on.
            errors.append(f"knowledge base {kb.id} is empty")
    return errors
```

The other property worth naming: **the output is inspectable**. A user can read the spec their
sentence produced. When behaviour surprises them, the explanation is a document they can open,
not an inference about what a model was thinking.

---

## 4. Edit: a patch you approve

This is where the design earns its keep. The user's second sentence does not produce a new
agent. It produces a patch, in the [JSON Patch](https://datatracker.ietf.org/doc/html/rfc6902)
sense: a list of operations against the current version, rendered for a human as a diff.

```
   User: "be less formal, and search the web too"
                             │
                             ▼
              orchestrator emits a JSON Patch
                             │
                             ▼
   ┌───────────────────────────────────────────────────┐
   │  PROPOSED CHANGE  ·  v7 -> v8                     │
   │                                                   │
   │  persona.voice                                    │
   │    - "precise, formal, brief"                     │
   │    + "warm, conversational, brief"                │
   │                                                   │
   │  tools                                            │
   │    + "web.search"                                 │
   │                                                   │
   │              [ approve ]   [ reject ]             │
   └───────────────────────────────────────────────────┘
```

Reviewable, approvable, rejectable, reversible, because v7 still exists.

Note that the *agent* did not modify itself. It **proposed** a modification and a human
accepted it. Self-modifying systems are frightening precisely when the modification is opaque.
A schema-validated diff behind an approval gate is not frightening. It is a pull request.

The storage model is the familiar one, and the important word is append-only.

```sql
-- Immutable history. One row per version. Never UPDATE this table.
CREATE TABLE agent_specs (
  agent_id     TEXT        NOT NULL,
  version      INTEGER     NOT NULL,
  spec         JSONB       NOT NULL,
  created_by   TEXT        NOT NULL,
  created_from TEXT,        -- the sentence that produced this version
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (agent_id, version)
);

-- Stable identity: a pointer into that history. Write the spec first,
-- then move the pointer, so a half-finished edit is never live.
CREATE TABLE agents (
  id          TEXT    PRIMARY KEY,
  current_ver INTEGER NOT NULL,
  FOREIGN KEY (id, current_ver) REFERENCES agent_specs (agent_id, version)
    DEFERRABLE INITIALLY DEFERRED
);
```

That foreign key is worth the two extra lines. It makes "current version points at a version
that does not exist" unrepresentable, which is exactly the bug you get at 2am after a failed
edit. Rollback is then one statement, and note the `WHERE`, because the version pointer table
is exactly the one you do not want to update in full:
`UPDATE agents SET current_ver = 6 WHERE id = 'agt_docs_qa'`.

The `schema_version` field pays for itself the first time you change the schema. Do not run a
big-bang migration over every stored spec; write **upcasters**, small pure functions from
version n to version n+1, and run them on read. Old rows stay exactly as they were written,
which is the whole point of an audit trail, and a spec from a year ago still loads.

---

## 5. Six things that become easy

The payoff is not elegance. It is that six features that are hard in the code-shaped design
become small in the data-shaped one.

**1. Versioning and rollback.** A change made the agent worse? Point at the previous
version. One integer. And the storage cost of keeping everything is nothing: a spec is a few
kB, so forty agents with two hundred edits each over a year is roughly 32 MB. You will never
notice it.

**2. Diffing.** "What changed between last Tuesday and today?" is a JSON diff over two rows.
Try answering that question about a system where behaviour lives in prompt strings scattered
across a codebase.

**3. Audit.** Every version records who created it and from what sentence, which is why
`created_from` is in the table. The full history of an agent's behaviour is queryable. That is
a compliance answer, not a nice-to-have.

**4. Templates and cloning.** A good agent is a document. Copy it, change three fields, and
you have a new agent. No code duplication, no inheritance hierarchy, no base class that slowly
acquires eleven optional flags.

**5. Teams as composition.** "Build a team to run an online store" produces a coordinator spec
whose `sub_agents` reference specialist specs. A team is a graph of documents.

```json
{
  "name": "Store Coordinator",
  "sub_agents": ["agt_inventory", "agt_support", "agt_pricing"],
  "limits": {"max_delegation_depth": 2, "max_fanout": 4}
}
```

Cap the depth and the fan-out in the schema, not in the prompt. Delegation that can recurse is
a bill you receive later.

**6. Learning that persists.** Big enough to get its own section.

---

## 6. Lessons: learning you can read and delete

An agent gets a thumbs down, or notices its own dead end, such as a tool call that failed or a
search that returned nothing useful. It reflects and writes a **lesson**:

```json
{
  "agent_id": "agt_docs_qa",
  "lesson": "Leave questions: search 'annual leave' AND 'vacation'; docs use both.",
  "source": "thumbs_down",
  "created_at": "2026-07-02T11:41:03Z",
  "hits": 14
}
```

Lessons are retrieved and injected on later runs, so the agent gets sharper with use, like a
colleague who remembers last month's confusion. Crucially they are **data alongside the spec,
not inside it**: you can read them, delete a bad one, and never wonder whether the agent has
quietly drifted somewhere you cannot see. Compare that to fine-tuning, where the same learning
is smeared across weights and is effectively un-auditable.

Here is what the interpreter actually assembles on each turn, and the order matters:

```
   ┌───────────────────────────────────────────────────────┐
   │ STABLE PREFIX      identical for every turn           │
   │   spec.policy, persona, tool schemas, limits          │
   ├───────────────────────────────────────────────────────┤
   │ LESSONS            top-k, retrieved, capped, aged     │
   │   "Leave questions: search 'annual leave' AND         │
   │    'vacation'; docs use both"                         │
   ├───────────────────────────────────────────────────────┤
   │ CONVERSATION       this user, this thread             │
   └───────────────────────────────────────────────────────┘
                               │
                               ▼
          one interpreter loop, no per-agent branches
```

The stable part goes first because prompt caching works on prefixes. Put a volatile lesson
block above the policy and every edit to it invalidates the cached prefix for every subsequent
turn, which you pay for in both latency and money.

Three ways lessons go wrong, all of which I have hit:

- **They accumulate.** Two hundred lessons will contradict each other and eat the context
  window. Cap the number injected, retrieve by relevance to the current turn rather than
  pasting them all, and expire the ones that never get retrieved. The `hits` counter above
  exists for that.
- **They are an injection surface.** A lesson distilled from a conversation about an untrusted
  document is text an attacker influenced, and you are about to inject it on every future run.
  A lesson may bias retrieval and phrasing. It must never grant a capability, widen a scope or
  skip an approval, because all three are enforced in code. That is part 3's rule, and lessons
  are exactly the case that tempts you to break it.
- **You cannot tell whether they help.** Keep a held-out set of past conversations and replay
  them with and without the lesson store before you believe it is working.

---

## 7. Where it costs you

Every architecture trades something. Plainly, here is what this one trades.

**The spec schema is now your API.** Changing it means every stored spec has to keep loading.
Upcasters make that manageable, but you have to write them, forever, and you have to keep the
old shapes working. Version the schema on day one or you will hand-edit JSONB at some point.

**Expressiveness has a ceiling.** Anything the schema cannot express, an agent cannot do. When
a user needs genuinely novel behaviour you extend the schema and the interpreter, which is a
real code change with a real deploy. The win is not that this never happens. It is that it
becomes rare instead of constant.

**The interpreter gets complex.** All the branching that used to live in per-agent classes now
lives in one runtime, and every agent depends on it. A bug there is a bug everywhere, so it
needs the test coverage that the individual agents no longer need.

**Validation must be strict.** A spec that validates but is semantically nonsense, a tool that
exists but has no credentials, a knowledge base with zero documents, produces a confusing
runtime failure that users report as "it's broken". Validate references, not just shapes.

**Debugging shifts.** You no longer read code to understand behaviour; you read a document
plus a step trace. That is a different skill, and the trace has to be good or you are worse
off than before.

For a platform where non-developers create and modify agents, I would make this trade every
time. For a single agent embedded in one product, hard-coding is genuinely simpler, and you
should hard-code it.

---

## 8. How this fits the rest of the series

1. [What is an agent harness](/posts/2025/08/what-is-an-agent-harness/): surface, meaning,
   policy, approval, audit.
2. [Verbs, not tables](/posts/2025/10/verbs-not-tables/): expose intent-named operations,
   not schemas.
3. [Safe by default](/posts/2025/12/safe-by-default-agents/): enforce in code, never in a
   prompt.
4. **Agents as data**, this post: make behaviour itself inspectable and reversible.

The thread through all four: **move the important things out of places you cannot inspect.**
Out of the model's reasoning, into a typed capability surface. Out of the system prompt, into
code that enforces. Out of source files, into versioned rows with diffs and history.

None of that makes the model better. It makes the *system* honest, and an honest system is the
only kind you can safely give more power to.

---

## 9. The short version

- Storing agents as code turns "please cite page numbers" into a software release. That is the
  bug, and it is an architecture bug, not a code bug.
- Store an agent as a **versioned, validated spec row** and make the runtime a **pure
  interpreter** with no per-agent code in it.
- Three operations only: build, run, edit. No deploys in the common path.
- Constrained decoding now gives you a syntactically valid spec for free. It does not give you
  a true one, so check tool names, knowledge bases and credentials in code.
- Append-only storage, a deferrable foreign key from `current_ver`, and upcasters on read.
  Never mutate a spec row.
- Free wins: rollback, diffs, audit, templates, teams as composition, and lessons you can read
  and delete rather than weights you cannot.
- Cap, retrieve and expire lessons, put them after the cached prefix, and never let one grant
  a capability.
- Real costs: schema migrations forever, an expressiveness ceiling, one complex interpreter,
  and validation that has to be strict. Worth it for a platform, overkill for one embedded
  agent.

---

*That is the series. If you landed here first, start with
[what an agent harness actually is](/posts/2025/08/what-is-an-agent-harness/) and read
forward; the whole arc is one line long, which is put the important things where you can see
them.*
