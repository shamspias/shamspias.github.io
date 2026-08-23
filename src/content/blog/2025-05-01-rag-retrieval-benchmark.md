---
title: "A Field Guide & Benchmark for Similarity Search in RAG"
description: "How to benchmark sparse, dense, hybrid and late-interaction retrieval on your own corpus, and how to read the numbers without fooling yourself."
date: 2025-05-01
permalink: "/posts/2025/05/rag-retrieval-benchmark/"
tags:
  - "retrieval-augmented generation"
  - "similarity search"
  - "dense vectors"
  - "BM25"
  - "hybrid retrieval"
  - "evaluation"
  - "benchmarks"
  - "AI foundations"
series: "Retrieval and RAG"
seriesOrder: 2
math: true
---

*Part 2 of the retrieval series. Part 1 was the vocabulary. This is the workshop: how to put
sparse, dense, hybrid and late-interaction retrieval on the same corpus, score them with one
number you can defend, and pick the one to ship. I have revised it since 2025, because two of
the things I originally recommended are not what I would do now.*

---

## 1. The retriever is the part that fails

A RAG system, retrieval-augmented generation, is two machines bolted together: a search engine
that pulls a handful of passages out of your own documents, and a language model that answers
using those passages. So when an answer is wrong, the interesting question is which machine
failed. Did the model invent something, or did it never see the right paragraph at all? In my
experience it is usually the second. The generator was handed five passages of
adjacent-but-useless text and did the only thing it could: it improvised.

Judging a RAG system by reading its answers is like judging a chef by the smell of the fridge.
You need unit tests for the fridge.

So we separate the two stages and score them independently. Given a set of questions and a set
of passages a human marked as genuinely relevant (the *qrels*), retrieval quality is measurable
without an LLM in the loop at all: no sampling noise, no prompt sensitivity, no API bill. That
separation is the whole idea of [Part 1](/posts/2024/08/retrieval-metrics/), and everything
below assumes it.

The practical shape of the failure is worth seeing before we get formal:

```
query                              BM25   dense   hybrid
─────────────────────────────────  ────   ─────   ──────
"error KB-4471 on export"          hit    miss    hit
"how do I cancel my plan"          miss   hit     hit
"section 12(b) notice period"      hit    miss    hit
"why is my invoice so large"       miss   hit     hit
"reset password on the mobile app" hit    hit     hit
```

Keyword search knows about `KB-4471` and nothing about paraphrase. Embeddings know that "cancel
my plan" means "terminate your subscription" and routinely lose the exact string `KB-4471` in a
cloud of near-synonyms. Neither is a general-purpose retriever. That is why the answer is
usually both.

---

## 2. Five archetypes, not four

The original version of this post listed four families. It should have listed five. Learned
sparse retrieval was already shipping in 2025 and I left it out.

| Family | How it works | Strength | What it costs |
|---|---|---|---|
| Sparse, BM25 | Term stats in an inverted index | IDs, codes, rare terms | Blind to synonyms |
| Learned sparse | Expands text into weighted terms | Synonyms, still readable | Slow to index |
| Dense bi-encoder | One vector per chunk, ANN search | Meaning, paraphrase | Misses exact IDs |
| Late interaction | One vector per *token* | Near cross-encoder quality | Index 10 to 100x |
| Cross-encoder | Query and doc read together | Best ordering there is | Slow, candidates only |

ANN there is approximate nearest neighbour: instead of comparing your query vector against every
chunk, the index compares it against a small, cleverly chosen subset. It accepts a tiny chance
of missing a neighbour in exchange for a very large speed-up.

The important structural point is that these are not five competitors and one winner. They are
stages. A production retriever is a funnel, and the interesting engineering is where you put
each family and how wide you leave each opening.

```
                one user question
                        │
        ┌───────────────┴─┬──────────────┐
        ▼                 ▼              ▼
   ┌─────────┐      ┌───────────┐   ┌──────────┐
   │  BM25   │      │  learned  │   │  dense   │  any stage
   │ lexical │      │  sparse   │   │ vectors  │  is optional
   └────┬────┘      └─────┬─────┘   └────┬─────┘
        │ top 100         │ top 100      │ top 100
        └───────────────┬─┴──────────────┘
                        ▼
            ┌───────────────────────┐   ~1 ms
            │   FUSION, e.g. RRF    │
            └───────────┬───────────┘
                        │ top 50
                        ▼
            ┌───────────────────────┐   30 to 300 ms
            │ RERANK, cross-encoder │
            └───────────┬───────────┘
                        │ top 5
                        ▼
               context for the LLM
```

Two numbers control everything in that picture. The width of the candidate stage decides what is
*possible*, because a reranker cannot promote a document that was never fetched. The width of
the reranker input decides what you *pay*, because cross-encoder cost is linear in candidates.

### What changed by 2026

Three things, and they matter more than any single model release.

**Reciprocal rank fusion won.** In 2025 I wrote about query-adaptive weighting between dense and
lexical scores, and specifically about Dynamic Alpha Tuning, a 2025 proposal to let a small
model pick the blend per query. It is a good idea and the paper is worth reading. It is not what
shipped. What shipped, in Elasticsearch, OpenSearch, Qdrant, Weaviate, Milvus and Vespa, is
reciprocal rank fusion: combine runs by rank rather than by score, with no normalisation and no
tuning.

$$
\text{RRF}(d) = \sum_{r \in \text{runs}} \frac{1}{k + \text{rank}_r(d)}, \qquad k \approx 60
$$

It is almost embarrassingly simple, it has one constant, and it is very hard to beat with a
weighted score blend unless you are willing to recalibrate the weights whenever either retriever
changes. Start here. Reach for adaptive weighting only after you have measured that RRF is
costing you something.

**Late interaction stopped being exotic.** Multi-vector indexes are now first-class in several
vector databases, and the storage blow-up is manageable with pooling and quantisation. The same
family also opened up document-image retrieval (the ColPali line of work), where a page is
embedded as an image and you skip OCR entirely, which is a genuinely new capability rather than
a benchmark improvement.

**Embedding models became boring, in the good way.** The gap between a strong open model you
host yourself and a commercial API is now small enough that the choice is an infrastructure
decision, not a quality decision. Two features are worth asking for: Matryoshka-style training,
so you can truncate a 1024-dimension vector to 256 and lose very little, and int8 or binary
quantisation support, which is where your index memory bill actually goes.

---

## 3. One number, and where it lies

Two quality numbers carry most of the signal. Recall@50 asks whether the right passage is
anywhere in the first fifty results, which is a question about what you fetched. nDCG@10 asks
whether it is near the top of the first ten, discounting each position further down, which is a
question about how you ordered it. Part 1 derives both.

You still cannot compare four systems on six columns. Somebody will always pick the column that
flatters their favourite. So collapse it:

$$
\text{Utility} = \alpha\,\text{nDCG@10} + \beta\,\text{Recall@50}
- \gamma\,\frac{p_{95}\ \text{ms}}{100} - \delta\,(\text{USD per 1k queries})
$$

I use $\alpha=1$, $\beta=0.5$, $\gamma=0.2$ as a starting point, latency in units of 100 ms, so
300 ms of extra p95 costs 0.6 of utility and has to be bought back with real nDCG. Pick $\delta$
last, and pick it against your actual invoice. If a thousand queries cost you a fraction of a
cent, any small $\delta$ makes that term arithmetically invisible and the formula is quietly
ignoring cost. Either scale cost into the same range as the other terms, or drop it and
compare cost in its own column.

Now the honest part. The units are incommensurable, so the weights are not physics, they are
your opinion written down. That is precisely the value. The number is meaningless when compared
across teams, and extremely useful within one team, because it forces the argument about
trade-offs to happen once, in a config file, rather than in every review meeting. If your
latency budget is hard, do not encode it as a penalty at all: make it a filter, discard every
configuration over budget, and rank the survivors on quality alone.

---

## 4. Datasets: use the public ones to calibrate, your own to decide

Public benchmarks are how you sanity-check a harness, not how you choose a retriever.
[BEIR](https://github.com/beir-cellar/beir) remains the standard zero-shot suite, and the
[MTEB leaderboard](https://huggingface.co/spaces/mteb/leaderboard) has grown from its original
few dozen tasks into a sprawling multilingual suite. Both have the same problem in
2026: they are so widely optimised against that a top-ten placement tells you a model is good at
the benchmark, and much less about whether it is good at your contracts, your tickets or your
lab notes.

The number that predicts your production quality is measured on your own corpus. It takes less
work than people expect:

1. Pull 150 real queries from your logs. Include the ugly ones, the two-word ones, the ones with
   product codes and misspellings.
2. For each, have somebody who knows the domain mark the passages that genuinely answer it.
   Graded is better than binary: 2 for "this answers it", 1 for "related and useful", 0
   otherwise.
3. Freeze it. Version it in git. Treat it as a test fixture, because that is what it is.

Two afternoons of labelling buys you something no leaderboard can. Every dataset, public or
private, then reduces to the same three files:

```
corpus.jsonl   {"doc_id": "kb_442#3", "text": "To cancel a plan..."}
queries.jsonl  {"query_id": "q17", "text": "how do I cancel my plan"}
qrels.jsonl    {"query_id": "q17", "doc_id": "kb_442#3", "relevance": 2}
```

Everything downstream reads those three and nothing else.

---

## 5. The harness

Here is the whole thing, in a form that runs. It uses
[bm25s](https://github.com/xhluca/bm25s) for lexical search, `sentence-transformers` for dense,
and [ranx](https://github.com/AmenRa/ranx) for the metrics, so the evaluation code is not mine
and therefore not quietly wrong in my favour.

```python
import json, time
import bm25s
import numpy as np
from ranx import Qrels, Run, evaluate
from sentence_transformers import SentenceTransformer

def load(path):
    with open(path) as f:
        return [json.loads(line) for line in f]

corpus = load("datasets/support/corpus.jsonl")
queries = load("datasets/support/queries.jsonl")
doc_ids = [d["doc_id"] for d in corpus]
texts = [d["text"] for d in corpus]

# --- lexical -------------------------------------------------------------
bm25 = bm25s.BM25()
bm25.index(bm25s.tokenize(texts, stopwords="en"))

def bm25_search(query, k=100):
    idx, scores = bm25.retrieve(
        bm25s.tokenize(query, stopwords="en"), k=k
    )
    return {doc_ids[i]: float(s) for i, s in zip(idx[0], scores[0])}

# --- dense ---------------------------------------------------------------
# E5 was trained with these prefixes; omitting them costs real accuracy.
model = SentenceTransformer("intfloat/e5-base-v2")
emb = model.encode(
    [f"passage: {t}" for t in texts], normalize_embeddings=True
)

def dense_search(query, k=100):
    q = model.encode([f"query: {query}"], normalize_embeddings=True)
    scores = emb @ q[0]
    k = min(k, len(doc_ids) - 1)
    top = np.argpartition(-scores, k)[:k]
    return {doc_ids[i]: float(scores[i]) for i in top}
```

`e5-base-v2` is not the strongest embedding model you can get in 2026. It is a small one with a
documented prefix convention, which makes it a good harness baseline; swap in whatever you
actually intend to ship and re-run.

Fusion is six lines and needs no tuning:

```python
def rrf(runs, k=60):
    """Fuse by rank, not score, so the two scales never need calibrating."""
    fused = {}
    for run in runs:
        ranked = sorted(run, key=run.get, reverse=True)
        for rank, doc_id in enumerate(ranked, start=1):
            fused[doc_id] = fused.get(doc_id, 0.0) + 1.0 / (k + rank)
    return fused
```

And the benchmark loop records latency per query rather than an average over the batch, because
p95 is the number your users feel and a mean hides it completely:

```python
def benchmark(name, search, queries, qrels_path, k=100):
    run, latencies = {}, []
    for q in queries:
        t0 = time.perf_counter()
        run[q["query_id"]] = search(q["text"], k=k)
        latencies.append((time.perf_counter() - t0) * 1000)

    gold = {}
    for r in load(qrels_path):        # a query can have many gold docs
        gold.setdefault(r["query_id"], {})[r["doc_id"]] = r["relevance"]

    qrels = Qrels.from_dict(gold)
    scores = evaluate(qrels, Run.from_dict(run), ["ndcg@10", "recall@50"])
    scores["p95_ms"] = float(np.percentile(latencies, 95))
    print(name, {k2: round(v, 4) for k2, v in scores.items()})
    return scores

systems = {
    "bm25": bm25_search,
    "dense": dense_search,
    "hybrid": lambda q, k=100: rrf([bm25_search(q, k), dense_search(q, k)]),
}
for name, fn in systems.items():
    benchmark(name, fn, queries, "datasets/support/qrels.jsonl")
```

Adding a reranker is one wrapper, and it is the highest-value dozen lines in most RAG systems.
Note that it fetches a full first-stage list and *then* truncates: the candidate count is a
property of what you rerank, not of what you retrieve.

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
text_of = {d["doc_id"]: d["text"] for d in corpus}

def reranked(search, candidates=50):
    def inner(query, k=100):
        run = search(query, k=k)
        hits = sorted(run, key=run.get, reverse=True)[:candidates]
        scores = reranker.predict([(query, text_of[d]) for d in hits])
        return dict(zip(hits, map(float, scores)))
    return inner

systems["hybrid+ce"] = reranked(systems["hybrid"], candidates=50)
benchmark("hybrid+ce", systems["hybrid+ce"], queries,
          "datasets/support/qrels.jsonl")
```

Note the `candidates` knob. Sweep it (10, 25, 50, 100) and plot quality against p95. The curve
almost always flattens well before 100, and everything past the elbow is latency you are paying
for nothing.

---

## 6. Chunking, which is where the free wins are

People replace their embedding model when they should have fixed their chunking. Chunking
decides what a "document" even is, so it changes both what can be retrieved and what the LLM
eventually reads.

| Style | Use it for | Trade-off |
|---|---|---|
| Fixed 512 tokens, 15% overlap | A baseline for anything | Cuts sentences and tables in half |
| Recursive on structure | Markdown, HTML, PDFs with headings | Slower to build, better cuts |
| Small-to-big | Manuals, policies, long specs | Needs a second, parent-level index |
| Semantic, split on drift | Transcripts, chat logs, raw text | Extra pass, one threshold |

My rule of thumb, and I have not found a corpus that broke it: retrieval precision improves as
chunks get smaller down to roughly 256 to 512 tokens, then answer quality starts falling because
the model receives fragments with no context. Small-to-big exists precisely to break that
trade-off: embed a 256-token child chunk so retrieval stays sharp, then send the 2k-token parent
section to the model so the answer has context. On long structured documents it is usually the
single biggest improvement available. Always include the document title and the section heading
in the embedded text of every chunk. It is nearly free and it stops a chunk from becoming an
anonymous paragraph.

Run the sweep. Test 256, 512 and 1024 with your own qrels before you touch anything else.

---

## 7. Reading the results

I originally closed this post with a leaderboard table: four retrievers, four decimal places, a
winner. I have cut it, and the reason is the most useful thing in this post. Absolute retrieval
numbers from somebody else's corpus are the least transferable quantity in this entire field. A
BM25 score on a financial QA benchmark tells you nothing about BM25 on your support tickets, and
quoting it invites people to skip the measurement and copy the conclusion.

What does transfer is the shape, and it is remarkably stable:

- BM25 is the fastest and the cheapest by a wide margin, often an order of magnitude on both.
- A good dense model beats BM25 on natural-language questions and loses on identifiers.
- Hybrid beats both on quality, and costs the slower of the two latencies if you fire them in
  parallel, the sum if you do not.
- Adding a cross-encoder gives the best ordering of all and is by far the slowest stage.
- Ranked by utility, hybrid usually wins, because the reranker's quality gain rarely pays for
  its latency at typical weights, and BM25 alone rarely has the recall.

So the table you should look at is not a ranking of systems. It is this decision:

```
recall@100 of the candidate stage
        │
        ├── below ~0.85 ──► fix the FIRST stage.
        │                   chunking, then hybrid, then a stronger
        │                   embedding model. A reranker cannot
        │                   promote what was never retrieved.
        │
        └── at or above ──► fix the ORDER.
                            add a cross-encoder, then sweep how
                            many candidates you feed it, and stop
                            at the elbow of the quality curve.
```

Recall at the candidate stage is your ceiling. Every downstream stage can only lose ground
against it. Measure it first, every time.

---

## 8. Cost and latency, without the hand-waving

The original post had a cost formula that mixed hourly and per-query units and, read carefully,
did not compute anything. Here is one that does. Cost per thousand queries is:

```python
# every term below is USD per query, so the whole bracket scales to 1k
cost_per_1k = 1000 * (
      encode_ms / 1000 * gpu_usd_per_sec       # query embedding
    + search_ms / 1000 * cpu_usd_per_sec       # ANN and inverted index
    + rerank_ms / 1000 * gpu_usd_per_sec       # candidates x cross-encoder
    + index_usd_per_hour / queries_per_hour    # amortised RAM and storage
)
```

The last term is the one people forget and the one that dominates at low traffic. An index that
must sit in RAM costs the same at 3 a.m. as at peak, so at a few thousand queries a day the
memory bill can exceed all the compute in the first three terms combined. That single fact is
why int8 and binary quantisation, and truncating Matryoshka embeddings from 1024 dimensions to
256, are cost decisions rather than accuracy decisions.

Measure latency end to end, from the raw query string to the final ranked list, and record the
distribution rather than the mean. Encode time in particular is bimodal: warm process, cold
process. Report p95.

---

## 9. What I would actually ship

For a general corpus, in 2026, with no special constraints:

1. Recursive chunking on document structure, 512 tokens, title and heading prefixed to every
   chunk.
2. BM25 and a strong open dense model, run in parallel, top 100 each.
3. Reciprocal rank fusion with $k=60$. No weight tuning.
4. A cross-encoder reranker over the top 50, but only after measuring that candidate recall is
   already high. If it is not, that latency is wasted.
5. Send the top 5 to the model, and log the retrieved IDs with every answer so that when
   somebody complains you can tell in ten seconds whether the retriever or the generator failed.

Then re-run the harness on every embedding model change, every chunker change, and every
significant corpus change. That is the entire point of building it: not to produce a
leaderboard, but to make "I think this is better" into a claim somebody can check.

---

## 10. The short version

- Most bad RAG answers are retrieval failures, so score retrieval on its own, with qrels and no
  LLM in the loop.
- Sparse and dense fail on opposite queries. Hybrid is not a hedge, it is the correct default.
- Fuse with reciprocal rank fusion, $k=60$. It is one constant and it beats hand-tuned score
  blending in practice.
- Recall at the candidate stage is your ceiling. Below roughly 0.85, fix chunking and retrieval.
  Above it, fix ordering with a reranker.
- Chunking is the cheapest large win available. Sweep 256, 512 and 1024, and try small-to-big on
  long documents.
- Collapse quality, latency and cost into one utility number so the trade-off argument happens
  once, in a config file.
- Public benchmarks calibrate your harness. 150 labelled queries from your own logs decide your
  architecture.
- At low traffic the always-on index memory, not the compute, is your bill. Quantise.

*Part 1, [Retrieval Metrics Demystified](/posts/2024/08/retrieval-metrics/), covers the metrics
this harness prints. Read it first if nDCG@10 and Recall@50 are not yet second nature.*
