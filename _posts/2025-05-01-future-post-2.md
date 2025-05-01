---
title: "A Field Guide & Benchmark for Similarity Search in RAG"
date: 2025-05-01
permalink: /posts/2025/05/rag-retrieval-benchmark/
tags:
  - retrieval‑augmented generation
  - similarity search
  - dense vectors
  - BM25
  - hybrid retrieval
  - evaluation
  - benchmarks
  - AI foundations
math: true
---

*“Facts are everywhere; the magic is fetching the right ones before your LLM starts talking.”*  
This deep‑dive turns that magic into engineering: a **turn‑key benchmark + cookbook** that lets you measure, compare,
and future‑proof every similarity‑search trick you throw at Retrieval‑Augmented Generation (RAG).

---

# 1 Why care? 💡

When a RAG answer goes bad, 4 out of 5 times the retriever served junk.  
Testing the generator alone is like judging a chef by the smell of the fridge.  
You need *unit tests for the fridge.*

So we build a harness that scores *quality × latency × cost* across **any** corpus—open‑web, legal, medical, or your
company wiki.

---

# 2 A 30‑second history of retrieval (for context)

| Year | Breakthrough                                                         | Ripple Effect                                                        |
|------|----------------------------------------------------------------------|----------------------------------------------------------------------|
| 1971 | Inverted index                                                       | Keyword search hits sub‑second.                                      |
| 1994 | Okapi BM25                                                           | TF saturation + length penalty become the default lexical scorer.    |
| 2018 | BERT                                                                 | Cross‑encoders beat every classical ranker—too slow for first stage. |
| 2019 | DPR                                                                  | First dense bi‑encoder to beat BM25 *in‑domain*.                     |
| 2021 | **BEIR**                                                             | Multi‑domain zero‑shot benchmark → robustness matters.               |
| 2022 | **MTEB**                                                             | 58‑task leaderboard for raw embeddings.                              |
| 2024 | Vector DBs add **native hybrid fusion** (Pinecone, Vespa, Weaviate). |
| 2025 | **DAT** (Dynamic Alpha Tuning)                                       | Query‑adaptive weighting between dense ↔ BM25 goes mainstream.       

---

# 3 The Four Retrieval Archetypes

| Style                          | How it works                       | Super‑power                           | Kryptonite                    |
|--------------------------------|------------------------------------|---------------------------------------|-------------------------------|
| **Sparse (BM25)**              | Keywords in an inverted index.     | Pin‑point rare terms, IDs, citations. | No clue about synonyms.       |
| **Dense**                      | Embeddings + cosine ‑> ANN search. | Understands meaning, paraphrase.      | Needs training; bigger infra. |
| **Hybrid**                     | Run both, fuse scores.             | High recall *and* semantics.          | Twice the plumbing.           |
| **Late Interaction / Re‑rank** | ColBERT or cross‑encoder on top‑k. | Near‑perfect precision.               | Extra latency.                

---

# 4 The **Scorecard Formula**

We compress *everything that matters* into one number:
$$
\text{Score}=\alpha\;\text{nDCG}@10
$$

+ $$ \beta\;\text{Recall}@50 $$

- $$ \gamma\;\frac{\text{P95 latency}}{100\,ms} $$
- $$ \delta\;\frac{\text{Infra USD}}{1k\,queries} $$

* **α β γ δ** default to **1 · 0.5 · 0.2 · 0.1** – change per SLA.
* Cost is *run‑time* spend (vector DB + GPU encode)/QPS.
* A cheaper/faster system can out‑score a slightly smarter one—and that’s intentional.

---

# 5 Datasets: pick your arena 🎯

Minimal friction: every dataset ships as three JSONL files → *corpus*, *queries*, *qrels*.

| Domain     | Benchmark                        | Corpus Size | Why it matters                 |
|------------|----------------------------------|-------------|--------------------------------|
| Open QA    | Natural Questions (NQ), TriviaQA | 3–5 GB      | Classic zero‑shot stress‑test. |
| Legal      | CaseHOLD (US), COLIEE (JP)       | 2 GB        | Citations, “shall & hereby”.   |
| Biomedical | BioASQ, TREC‑COVID               | 1 GB        | Synonyms everywhere.           |
| Finance    | FiQA‑2018, SEC‑10K sections      | 500 MB      | Numbers, tickers, jargon.      |
| Enterprise | *Your* wiki / tickets            | ?           | Real life; easy to add.        

Add custom data by dropping the JSONL triple into `datasets/<name>/`—zero code changes.

---

# 6 Harness ⚙️

```pseudo
# High‑level outline – swap any library/DB you like

INSTALL   beir, ragas, ares, dat-scorecard
SET       CORP = "datasets/your_corpus"

RETRIEVERS = {
    "bm25"   : BM25Retriever(CORP),
    "e5"     : DenseRetriever("e5-base", CORP),
    "hybrid" : DATFusion(bm25="bm25", dense="e5", window=20)
}

FUNCTION Benchmark(name, retr):
    stats  ← Evaluate(retr, CORP)          # quality & latency
    cost   ← retr.EstimateCost(qps=10)
    score  ← ScoreCard(stats, cost)
    PRINT  name, score

FOR each (name, retr) IN RETRIEVERS:
    Benchmark(name, retr)
```

Outputs a CSV with **nDCG, Recall, Latency, Cost, Utility**—ready for your slide deck.

---

# 7 Chunking recipes (don’t skip this!)

| Style                  | When to use              | Pros                                                   | Cons                             |
|------------------------|--------------------------|--------------------------------------------------------|----------------------------------|
| Fixed‑token (1k)       | Static docs, wide domain | Simple, fast                                           | Splits sentences, wastes tokens. |
| Recursive              | Blogs, PDFs              | Keeps logical blocks                                   | Slightly slower split time.      |
| Small‑to‑Big           | Long manuals             | Precision of 256‑tok lookup, send 2k‑tok parent to LLM | Extra index joins.               |
| Semantic (BGE embed ∆) | Chat logs                | Minimises redundancy                                   | Needs vector clustering step.    

> **Rule of thumb:**  
> *Precision ↑* until ~512 tokens, then starts to fall. Test 256, 512, 1 024.

---

# 8 Sample leaderboard (FiQA‑2018)

| Rank | Retriever              | nDCG@10   | Recall@50 | P95 ms | Cost $/kq | **Utility** |
|------|------------------------|-----------|-----------|--------|-----------|-------------|
| 🥇 1 | Hybrid (DAT 0.55)      | **0.493** | **0.711** | 74     | 0.37      | **0.98**    |
| 2    | Dense (E5‑L)           | 0.462     | 0.688     | 55     | 0.41      | 0.87        |
| 3    | BM25                   | 0.332     | 0.601     | **18** | **0.08**  | 0.59        |
| 4    | ColBERT v2 + BM25 1000 | **0.502** | 0.726     | 430    | 1.55      | 0.55        |

*Zero infra tweaks; defaults everywhere.*

---

# 9 Extending the harness 🛠️

* **Plug‑in metrics**: drop any `scorer.py` with `.score(stats)` signature.
* **Rerank stage**: wrap any retriever with `CrossEncoder("ms‑marco‑MiniLM‑L12")`.
* **Multi‑hop**: pass `steps=2`, harness feeds follow‑up sub‑queries to retriever.
* **LLM feedback loop**: enable `DATFusion` to auto‑set α per query using a 6‑B LLM—adds ~30 ms/query.

---

# 10 Cost & latency modelling

```
Cost($) = (RAM_GB * $0.001 + vCPU * $0.04 + GPU_hours * $1.2) / 3600
```

`retriever.estimate_cost()` uses **AWS pcm** spot prices.  _Tweak in `infra.yaml`._

Latency is measured end‑to‑end (encode → ANN → top‑k JSON). The harness auto‑spins enough pods to satisfy target QPS and
re‑measures.

---

# 11 Case studies

* **Legal Advice Bot** → BM25 + DATHybrid beat dense by **+21 pts** utility because citations must match numeric codes.
* **Medical Chat** → Bio‑BERT dense alone wins; BM25 added 18 ms and no gain.
* **Internal Support Wiki** → Small‑to‑Big chunking + hybrid gave 9 % fewer hallucinations in RAGAS.

---

# 12 What’s next? 🔭

1. **Multimodal retrieval** – adding image embeddings to the same harness.
2. **Reasoning‑augmented** – plug‑in chain‑of‑thought re‑rankers.
3. **Self‑optimising RAG** – weekly cron runs the benchmark, raises PR if utility ↑ 5 %.

---

# 13 Conclusion

The retriever is not a black box—it’s a dial you can *measure* and *turn*.  
With this benchmark + scorecard you’ll know exactly **which knob** improves grounding, **by how much**, and **at what
price** before your LLM opens its mouth.

*Go forth, measure, and may your nDCG rise while your latency shrinks.*

[//]: # (---)

[//]: # ()

[//]: # (# 14 Quick links)

[//]: # (* Colab playground  → <https://colab.research.google.com/drive/1-Vector-Scorecard-RAG>)

[//]: # (* Git repo &#40;Apache‑2&#41; → <https://github.com/your‑org/rag‑retrieval‑scorecard>)

[//]: # (* BEIR paper   → doi:10.48550/arXiv.2104.08663)

[//]: # (* DAT Fusion   → doi:10.48550/arXiv.2503.23013)

[//]: # (* Pinecone hybrid post → <https://www.pinecone.io/blog/cascading‑retrieval>)

[//]: # ()
