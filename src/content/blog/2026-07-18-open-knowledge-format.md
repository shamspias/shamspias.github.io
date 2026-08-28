---
title: "Open Knowledge Format, Explained in Plain Words"
seoTitle: "Open Knowledge Format (OKF), Explained Simply"
description: "OKF is a folder of markdown files that tells an AI agent what your data means, who wrote it, who checked it, and when it stops being true."
date: 2026-07-18
permalink: "/posts/2026/07/open-knowledge-format/"
lang: en
tags:
  - "OKF"
  - "knowledge representation"
  - "agents"
  - "markdown"
  - "metadata"
  - "beginner"
  - "open-source"
series: "Retrieval and RAG"
seriesOrder: 5
math: false
---

*Imagine a new person joins your team on Monday. They can read every file you own, but nobody has told them what anything means. Which table is the real one? Who wrote this number? Is it still true? That is exactly the situation an AI agent is in, every single time. The Open Knowledge Format is one very small idea for fixing it: put the answers in ordinary text files, in a shape everybody agrees on.*

## The whole thing in one sentence

OKF is a folder of markdown files. Each file describes one thing you care about, and starts with a few lines of labels a machine can read.

That is it. No database, no account, no library to install. If you can open a text file, you can read OKF. If you can copy a folder, you can send someone your knowledge.

It was published by Google Cloud in June 2026 as version 0.1, and the spec is now at version 0.2. The specification is a single page, it lives in a public repository, and it is Apache 2.0 licensed. You do not need any of Google's products to use it.

## Why anyone bothered

Here is the problem, and it is not a fancy one.

The stuff that explains your systems is scattered. A little in a wiki. A little in a data catalog. A little in code comments. A lot in the heads of three people who have been there the longest. Now you want to build an assistant that can answer "how much did we sell last quarter", and before it can do anything useful, somebody has to gather all of that and hand it over.

So every team writes their own gathering code. And every tool that stores knowledge invents its own way of describing it. Four places that hold knowledge and four tools that want to read it means sixteen little bridges, each one written by hand, each one breaking on its own schedule.

![Two panels: on the left, four knowledge sources each wired separately to four AI consumers, sixteen crossing lines; on the right, the same eight boxes connected through a single OKF box in the middle, eight lines](/figures/okf-wiring.svg "The arithmetic is the whole argument. Agree on one file shape and the sixteen private bridges become eight, and the format, not the glue code, becomes the thing everyone has to get right.")

Agree on one shape and the sixteen become eight. A writer writes once and every reader can read it. A reader learns one format and can read anything. That is all a format ever buys you, and it is worth a lot.

There is a second reason, and it is newer. Knowledge like this used to be written once and left to rot, because keeping it fresh was boring human work. Models are not bored. They will happily walk two hundred files and fix every cross-reference. The spec's own motivation says a knowledge base today is "continuously written and maintained by agents", which raises a question nobody had to ask before: if a machine wrote this, how do I know I can trust it? Most of OKF version 0.2 is an answer to that.

## What one file looks like

A file has two parts: a small block of labels at the top, then normal writing below.

```markdown
---
type: BigQuery Table
title: Customer Orders
description: One row per completed customer order.
resource: https://console.cloud.google.com/bigquery?p=acme&d=sales&t=orders
tags: [sales, orders, revenue]
---

# Schema

| Column        | Type    | Description                          |
|---------------|---------|--------------------------------------|
| `order_id`    | STRING  | Globally unique order identifier.    |
| `customer_id` | STRING  | Points at [customers](/tables/customers.md). |

# Joins

Joined with [customers](/tables/customers.md) on `customer_id`.
```

The bit between the two `---` lines is called frontmatter. It is YAML, which is just a plain way of writing `name: value`. Machines read that part. Everything after it is markdown, which people read, and machines read that too.

![An annotated concept file: the yaml frontmatter block shaded above, the markdown body below, with each line labelled on the right](/figures/okf-anatomy.svg "One file, annotated. Only the type line is required. Everything else is there because it helps a reader, human or machine, and any of it may be missing.")

Two things to notice, because they are the format's actual personality.

**Only one label is required, and it is `type`.** A file with nothing but `type: Metric` is a valid OKF file. Everything else is a recommendation.

**A reader is not allowed to be fussy.** The spec says a consumer must not reject a bundle for missing optional fields, unknown `type` values, extra fields it does not understand, or links that point nowhere. A broken link is not treated as an error, because it might just be a page nobody has written yet.

That combination is what makes it cheap to start. You cannot fail a validator that has almost no rules.

## What a folder looks like

Files sit in folders, and you group them however makes sense to you. The format has no opinion about your folder names.

```
sales/
  index.md                 what is in this folder
  log.md                   what changed, and when
  tables/
    orders.md              one file, one thing
    customers.md
  metrics/
    weekly-active-users.md
  playbooks/
    freshness-alert.md
```

Two filenames are special and mean the same thing everywhere.

`index.md` is a table of contents for the folder it sits in. It lets an agent look at a list first and open only the two files it needs, instead of reading everything. That habit has a name in the spec, progressive disclosure, and it is mostly about not wasting the model's attention.

`log.md` is a diary, newest first, with dates written as `2026-08-28`. It answers "what changed here lately", which is the question you always ask when a number suddenly looks wrong.

Everything else in the tree is a concept file. The path is the name: `tables/orders.md` is the concept `tables/orders`. Move the file and you renamed the thing, which is exactly how people already think about files.

## Links are the relationships

If one thing relates to another, write a normal markdown link:

```markdown
Joined with [customers](/tables/customers.md) on `customer_id`.
```

A link starting with `/` is counted from the top of the bundle, and the spec recommends that form because it survives you moving files around. Relative links like `./other.md` also work.

There is no separate field for "depends on" or "joins with" or "is a parent of". The link says these two are related; the sentence around it says how. Follow enough links and you have a graph of your organisation's knowledge, built out of the plainest thing on the internet.

## Who wrote it, who checked it, and when it goes off

This is the part that makes OKF more than a folder of notes, and it is four small labels.

**Where it came from.** `sources` lists what the file was written from, each with a link, and optionally who authored that source, how often it gets used, and when it last changed. OKF deliberately does not store a trust score, because a score is somebody's opinion and it goes stale. It stores the plain facts and lets the reader judge.

**Who wrote it.** `generated: { by: ..., at: ... }` records the author and the time of the last real change. The author is written in one of three shapes: `reference_agent/gemini-2.5-pro` for a tool, `human:ahormati` for a person, `process:finance-nightly` for a scheduled job.

**Who checked it.** `verified` is a separate list, because the one who wrote something is often not the one who confirmed it. From this one field a reader gets three levels.

![Three stacked tiers derived from the verified field: unverified, machine confirmed, and human reviewed, with the human tier highlighted](/figures/okf-trust-tiers.svg "Trust is derived, never stored as a score. No verified field means unverified; a robot verifier means machine confirmed; a human: actor means a person put their name on it. All three are readable, and none of them is a permission.")

**When it stops being true.** `status` is `draft`, `stable` or `deprecated`. `stale_after` is a date after which the content should be treated as old news. It is an absolute moment rather than "expires in 90 days", so checking it is one comparison with the clock and never depends on when the file was read.

None of this is enforcement. A file with no trust labels at all is still perfectly valid, and a reader must still accept it. These labels are a signal to the reader, not a lock on the door. That distinction matters, and I have written a whole [series about where the real locks belong](/posts/2025/12/safe-by-default-agents/).

## The number problem

Here is a failure that will feel familiar if you have ever put an assistant near a database.

You ask for last year's revenue. The agent writes some SQL that looks reasonable, runs it, and reports a number. The number is confident, nicely formatted, and quietly wrong, because the definition of revenue in your company has four exceptions the agent has never heard of.

Version 0.2 adds a concept type for this: an **Attested Computation**. It is a file that carries the blessed way to compute one value, plus enough scaffolding to prove the blessed way is what actually ran.

```markdown
---
type: Attested Computation
title: Revenue for fiscal year
runtime: bigquery
parameters:
  - { name: year, type: integer, required: true }
executor:
  resource: references/skills/run-on-bq.md
  receipt: [job_id, executed_sql, result]
attester:
  resource: references/attesters/revenue.py
stale_after: 2026-12-31T00:00:00Z
---

# Computation

    SELECT SUM(amount) AS revenue
    FROM finance.recognized_revenue
    WHERE fiscal_year = @year
```

Read it as a contract with three parties. The **agent** may only fill in the declared holes, here a year, and may never edit the query. The **executor** runs the thing and brings back a receipt: the job id, and the query that genuinely executed. The **attester** is ordinary code with no model in it, and its whole job is to compare what ran against what was supposed to run.

![Six numbered steps: discover, load, parameterize, execute, attest, gate, with the attest step highlighted](/figures/okf-attestation.svg "The loop a consumer runs. Step five is deliberately dumb code: if a model gets to judge whether the model cheated, you have not checked anything.")

If the agent rewrote the query, swapped the file, or made the number up after the fact, the comparison fails and the consumer refuses to show it. This is the same instinct as giving a model [verbs instead of tables](/posts/2025/10/verbs-not-tables/): hand it a narrow, named thing it can call, not a blank page where it invents its own.

The spec is careful to separate two words that sound alike. **Verified** means a person or process confirmed the definition still matches policy, and it is written into the file. **Attested** means one particular run produced its number the sanctioned way, and it is not stored in the bundle at all, because it is about a single run. A perfectly verified definition still has to attest every time it is used.

## Make one this afternoon

You genuinely do not need tooling. Try this on something small and real.

1. Make a folder, say `knowledge/`.
2. Pick the five things people ask you about most. A table, a metric, a runbook, an API, whatever they actually are.
3. One file each. Start with only `type` and `title`, add `description` because it costs one sentence, and then write what you would have said in chat.
4. Where two things relate, link them: `[customers](/tables/customers.md)`.
5. Add `index.md` with a list of the five, one line each.
6. Put it in git. History, blame, and diffs come free, which is why the spec recommends a repository.
7. Point your assistant at the folder and ask it something. If the answer improves, write five more.

Then let the agent do the boring half. Ask it to draft files for the rest of your tables, and read what it writes with a suspicious eye. Draft first, `verified` later, `status: draft` in the meantime. That is what the field is for.

## Where this can bite you

I like the format. It is small, it is honest about what it does not do, and it is the kind of thing that could still be readable in ten years. But be clear-eyed about four things.

**Adoption is early.** OKF was published in June 2026. As of today, no major assistant reads a bundle natively just because it exists; you still point something at the folder. The format is a bet, not yet a habit.

**A format is not retrieval.** OKF says how to write the files, not how to find the right one at the right moment. With a hundred files an agent can list and skim. At ten thousand you still need search, ranking, and a way to [tell whether your retrieval is any good](/posts/2025/05/rag-retrieval-benchmark/).

**A bundle you did not write is untrusted text.** The moment you consume knowledge from another team or another company, you are feeding your agent words that somebody else chose. A helpful looking playbook can contain instructions aimed at your model rather than at your reader. That is [prompt injection](/posts/2025/07/prompt-injection/), and a friendly file extension does not make it safe. Treat an outside bundle the way you would treat an outside web page.

**Trust labels are claims, not proof.** Anyone can write `verified: { by: human:someone }` into a file. Inside your own repository, code review and git history are what make that claim mean something. Across organisations, the label is only as good as the relationship behind it.

## What it is not

It is not a database, not a service, and not a product you buy. It is not a replacement for OpenAPI, Avro or Protobuf; it points at those rather than trying to be them. It is not a permission system; nothing in a markdown file can stop an agent doing anything. And it is not a fixed vocabulary: `type` can be any string you like, because the spec deliberately refuses to maintain a central list.

What it is, is an agreement about file layout that makes your knowledge portable. That sounds boring. Boring is the point. The formats that lasted, CSV, markdown, JSON, all won by being embarrassingly simple, and this one is trying the same trick on a harder problem.

The deeper habit underneath it is the one I keep coming back to: writing down what you know, in a way somebody else can check, is how you find out whether you [actually know it](/posts/2026/08/do-you-know-if-it-works/). If a table is impossible to describe in three sentences, that is not a documentation problem. That is the table telling you something.

## The short version

- OKF is a folder of markdown files with a few machine-readable labels on top. No database, no SDK, no account.
- Google Cloud published it in June 2026, version 0.1 then 0.2, one page of spec, Apache 2.0, in the open.
- It exists because four knowledge sources and four AI tools mean sixteen hand-written bridges, and one shared format turns that into eight.
- Only `type` is required, and readers must not reject a file for missing fields, unknown types, extra keys, or broken links.
- `index.md` lists a folder's contents; `log.md` is a dated diary. Every other file is one concept, named by its path.
- Links between files are the relationships. The prose says what kind.
- `sources`, `generated`, `verified`, `status` and `stale_after` answer where it came from, who wrote it, who checked it, and when to stop believing it. Trust is derived from those, never stored as a score.
- An Attested Computation carries the blessed query plus a receipt and a checker, so a number can be proved to have come from the sanctioned computation instead of the agent's imagination.
- It is early, it is not retrieval, it is not permissions, and a bundle from outside your company is untrusted text like any other. Start with five files anyway.

*This is part 5 of the retrieval series, and the odd one out: every earlier part builds structure out of a corpus, and this one writes it down on purpose. [Part 2](/posts/2024/12/knowledge-graphs-for-rag/) extracts a graph, [part 4](/posts/2025/09/pageindex-vectorless-rag/) borrows the document's own contents page, and [part 3](/posts/2025/05/rag-retrieval-benchmark/) is how you would tell whether any of it helped.*

