---
title: "Retrieval Metrics Demystified: From BM25 Baselines to EM@5 & Answer F1"
seoTitle: "Retrieval Metrics: BM25, EM@5 and Answer F1"
description: "What BM25, Recall@k, answer-in-context rate and token F1 actually measure, which number to fix first, and how to compute them without fooling yourself."
date: 2024-08-15
permalink: "/posts/2024/08/retrieval-metrics/"
tags:
  - "information retrieval"
  - "RAG"
  - "evaluation"
  - "BM25"
  - "dense retrieval"
  - "question answering"
  - "metrics"
  - "beginner"
series: "Retrieval and RAG"
seriesOrder: 1
math: true
---

*Part 1 of two. A retrieval-augmented system has two hops, and almost every team I have watched
debug one was measuring the pair as a single blurred number. This post separates them, defines
the metrics honestly, including the one in the title that is usually named wrong, and says which
one to fix first.*

---

## 1. Two hops, two failure modes

Ask a question of a retrieval-augmented system and two things have to go right. It has to find
the right paragraphs, and then the model has to use them. Those are different jobs, they fail
for different reasons, and they are fixed by different people on different days.

A single end-to-end score cannot tell you which one broke. If answer quality jumps five points
after a week of work, you want to know whether it came from a better retriever, a better prompt,
or a resampled evaluation set. So measure the hops separately, and attach the right metric to
each.

```
   question
       │
       ▼
 ┌───────────┐   top-k passages    ┌───────────┐
 │ retriever │ ──────────────────► │ generator │ ──► answer
 └───────────┘                     └───────────┘
       │                                 │
 measured by                        measured by
   Recall@k                           token F1
   answer-in-context@k                normalised exact match
   nDCG@10, MRR@10                    faithfulness / judge
```

Everything on the left is about what the model was shown. Everything on the right is about what
it did with it. Mixing them is the original sin of RAG evaluation.

One piece of advice from the era this post was first written in has aged badly: grading
generated answers with BLEU or ROUGE. Those measure n-gram overlap with a reference sentence,
which punishes a correct answer phrased differently and rewards a wrong answer that borrows the
reference's wording. For short extractive answers, use token F1 and exact match. For free-form
answers, use a rubric-based judge model, and check the judge against human labels on a sample
before you trust it.

---

## 2. BM25, the baseline you have to beat

Before embeddings, which turn a passage into a few hundred numbers so that passages about the
same thing land near each other, there was the inverted index: a phone book where every word
points at the documents it appears in. BM25 ("Best Match 25", a numbered variant from the Okapi
project at City University in the early 1990s, which is exactly as glamorous as it sounds) is
the score those phone books still use.

$$
\operatorname{BM25}(q,d)=\sum_{t\in q}\operatorname{IDF}(t)\;
\frac{f(t,d)\,(k_1+1)}{f(t,d)+k_1\left(1-b+b\,\frac{|d|}{\overline{|d|}}\right)}
$$

where $f(t,d)$ is how many times term $t$ appears in document $d$, $|d|$ is the document's
length in tokens, $\overline{|d|}$ the average length across the corpus, and

$$
\operatorname{IDF}(t)=\ln\!\left(1+\frac{N-n(t)+0.5}{n(t)+0.5}\right)
$$

with $N$ documents in total and $n(t)$ of them containing $t$. Lucene's defaults, which almost
nobody changes, are $k_1 = 1.2$ and $b = 0.75$.

Three ideas are doing all the work. A word that appears in every document tells you nothing, so
IDF discounts it. The tenth occurrence of a word in a document matters far less than the second,
so $k_1$ saturates term frequency. A long document has more chances to contain your word by
accident, so $b$ penalises length. That is the whole model: rare beats common, saturating,
length-normalised.

It survives in 2026 for reasons that have nothing to do with nostalgia. It costs microseconds
per query over millions of documents on a CPU. It needs no training, no GPU and no re-embedding
when the corpus changes. You can debug it by eye, because the score decomposes into per-term
contributions. And on corpora full of identifiers, part numbers, statute references and
surnames, it is genuinely hard to beat, because those tokens carry meaning that no embedding of
a general corpus ever learned.

If your clever retriever cannot beat BM25 on your data, the clever retriever is broken. Measure
it first, every time.

```python
from rank_bm25 import BM25Okapi

corpus = [
    "the 2008 financial crisis began in the housing market",
    # ... the rest of your documents
]
tokenised = [doc.lower().split() for doc in corpus]

bm25 = BM25Okapi(tokenised)  # k1=1.5, b=0.75 in this library, not Lucene's 1.2
top5 = bm25.get_top_n("what caused the 2008 crash".lower().split(), corpus, n=5)
```

That difference in defaults cost me an afternoon once, wondering why two BM25 implementations
ranked the same corpus differently. `rank_bm25` is the clearest implementation to read; `bm25s`
is the one to reach for on a large corpus, because it precomputes the scores into a sparse
matrix at index time.

---

## 3. The metric in the title, under its honest name

Picture *Where's Wally?* but you are allowed to search the first five pages instead of the whole
book. The question is simply whether Wally is on any of them.

That is what people mean by EM@5 in a RAG context: does any of my top five passages contain the
gold answer string? Compute it per question, average over the set.

$$
\text{EM@}k=\frac{1}{N}\sum_{i=1}^{N}\mathbb{1}\!\left[\exists\,d\in R_i^{(k)}:\;
a_i \subseteq \text{normalise}(d)\right]
$$

Here is the correction I owe the original version of this post. This is not exact match. Exact
match is a *generation* metric: the model's whole answer string equals the gold string after
normalisation. What is defined above is string containment inside retrieved text, which the
literature calls top-k retrieval accuracy or answer recall. Calling it EM@k is common and I have
done it for years, but it confuses two different numbers, and once you have both in a dashboard
the confusion becomes expensive. I call it **answer-in-context@k** below.

The reason to use a metric this dumb is that grading relevance properly at retrieval time is
expensive. "The 2008 financial crash" against "the 2008 recession" is a judgement call; string
containment is not. It stays crude on purpose, which makes it cheap, deterministic, and
comparable across runs.

It also lies in two specific ways, and you should know both.

It **overstates** when the answer is a short common string. If the gold answer is "1998", any
passage containing that year scores a hit, whether or not it answers anything. Short numeric and
single-token answers are where this metric is least trustworthy. Sample twenty hits by hand
occasionally and read them; you will find some.

It **understates** when the answer is present but phrased differently, and when your chunking
has sliced the answer across a boundary. That second one is worth checking before you blame the
retriever, because no amount of retrieval tuning recovers a fact that no single chunk contains.

If you have real relevance labels, that is, humans marked which passages answer which question,
use Recall@k instead and skip all of this. Most teams do not have labels, which is exactly why
this proxy is popular.

---

## 4. Answer-level F1 and the real exact match

Once the right passage is in the prompt, the model still has to say the answer. For short
extractive answers the standard pair is exact match and token-level F1, both computed after
normalisation.

Normalisation is not a detail. Everyone uses the convention from the scoring script that shipped
with SQuAD, the Stanford reading-comprehension dataset, and so should you: lowercase, strip
punctuation, remove the articles *a*, *an* and *the*, collapse whitespace. Skip it and you will
score "The Bengal tiger." as a miss against "Bengal tiger".

$$
\text{F1}=\frac{2\,P\,R}{P+R},\qquad
P=\frac{|\hat{a}\cap a|}{|\hat{a}|},\qquad
R=\frac{|\hat{a}\cap a|}{|a|}
$$

where $\hat{a}$ and $a$ are the predicted and gold answers as **multisets** of tokens.
Multisets, not sets: if the gold answer repeats a word, a prediction that repeats it once should
not get full credit for it. The original version of this post wrote that intersection with plain
set notation, which quietly says the opposite, and plenty of homegrown scorers still do.

```python
import re
import string
from collections import Counter

def normalise(text: str) -> str:
    text = text.lower()
    text = "".join(ch for ch in text if ch not in set(string.punctuation))
    text = re.sub(r"\b(a|an|the)\b", " ", text)
    return " ".join(text.split())

def exact_match(pred: str, gold: str) -> float:
    return float(normalise(pred) == normalise(gold))

def token_f1(pred: str, gold: str) -> float:
    p_toks, g_toks = normalise(pred).split(), normalise(gold).split()
    common = Counter(p_toks) & Counter(g_toks)  # multiset intersection
    overlap = sum(common.values())
    if overlap == 0:
        # Also the correct answer when both are empty: an unanswerable
        # question answered with silence should score 1.0, not 0.0.
        return float(p_toks == g_toks)
    precision = overlap / len(p_toks)
    recall = overlap / len(g_toks)
    return 2 * precision * recall / (precision + recall)
```

F1 forgives "Obama" against "Barack Obama" in a way exact match cannot. It also forgives a
fluent wrong answer that happens to share function words, which is why you report both. Where a
dataset gives several acceptable gold answers, score against each and take the maximum.

For answers that are paragraphs rather than spans, neither metric applies and you are into judge
territory: a rubric, a strong model grading against the retrieved context, and a human-labelled
calibration sample. The current research direction, visible in the TREC RAG track, is to
decompose a gold answer into atomic facts and measure how many the response covers, which is a
more honest version of recall for long-form text.

---

## 5. What has changed since this post was written

The 2024 version of this post recommended DPR, a pair of encoders you train yourself, one for
questions and one for passages, and then a cross-encoder over the results. The shape of that
advice is still right; the parts have all been replaced.

Dense retrieval no longer means training your own dual encoder. General-purpose embedding
models, the E5, BGE, GTE and Qwen3 families on the open side, and the hosted offerings from the
large providers, are strong out of the box, and picking one is now a leaderboard-and-latency
decision rather than a research project. Check MTEB for general quality and BEIR-style zero-shot
numbers for robustness on domains nobody trained on, then re-measure on your own data anyway,
because leaderboard rank and rank-on-your-corpus are only loosely related.

Hybrid retrieval stopped being an optimisation and became the default. Run BM25 and dense in
parallel, fuse the ranked lists, rerank the survivors. Reciprocal rank fusion is the fusion
method worth knowing, because it needs no score calibration between the two systems, only their
ranks:

```python
def rrf(rankings: list[list[str]], k: int = 60) -> list[str]:
    """Fuse ranked ID lists by rank alone; k damps the top positions."""
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    return sorted(scores, key=scores.get, reverse=True)
```

Reranking is now the highest-leverage stage. A cross-encoder reads the query and the passage
together, with full attention across both, and scores the pair. It is far too slow to run over a
whole index and very good at ordering a shortlist. Late-interaction models such as ColBERT sit
between the two, and their document-image variants are worth a look for PDFs where the layout
carries meaning.

Long context did not kill retrieval, which was the confident prediction of 2024. It changed the
economics: you can afford fewer, larger chunks, so aggressive chunk-splitting is less necessary.
But quality still degrades as you stuff a context window with marginally relevant text, and you
pay for every token of it on every request. Retrieval is now as much a cost control as a quality
one.

Here is the shape of a modern pipeline, with where each metric attaches:

```
  8,400,000 chunks
        │  BM25 + dense in parallel, fused by RRF
        ▼
      1,000 candidates      ~20 ms    recall is the only job here
        │  cross-encoder scores all 1,000 pairs
        ▼
         50 candidates     ~120 ms    precision becomes the job
        │  dedupe, pack to the token budget
        ▼
          6 passages         ~0 ms    this is what the model sees
```

Measure Recall@1000 at the top of the funnel, nDCG@10 after the reranker, and
answer-in-context@6 on what actually reaches the prompt. A recall failure at stage one is
unrecoverable: no reranker promotes a passage it never received. That single sentence explains
most of the disappointing rerankers I have deployed.

On the numbers: in my own work on document QA over contracts and internal wikis, moving from
BM25 alone to hybrid retrieval plus a cross-encoder has been worth something in the range of ten
to twenty points of answer-in-context@5. I will not quote a precise figure as though it were a
published result, because it is not, and the number moves with chunk size and question style
anyway. The important caveat runs the other way: on out-of-domain corpora, a dense retriever
alone sometimes loses to BM25 outright. That result is the whole reason zero-shot benchmark
suites exist, and it is why hybrid rather than dense is the safe default.

---

## 6. The rest of the zoo

| Metric | The question it asks | Use it when |
|---|---|---|
| Recall@k | Is any labelled-relevant passage in the top k? | You have relevance labels |
| answer-in-context@k | Is the gold answer string in the top k? | Answers but no labels |
| MRR@k | How high is the *first* correct hit? | Only position 1 gets read |
| MAP | Are *all* the relevant documents ranked well? | Several correct passages per query |
| nDCG@k | Same, with graded relevance and rank discount | The standard for comparing rankers |

The names unpack as mean reciprocal rank, mean average precision, and normalised discounted
cumulative gain. nDCG@10 is what published retrieval comparisons report, so if you want your
numbers to be comparable to anyone else's, report it. MRR@10 is the convention on MS MARCO.
Recall@k at a large k is what matters for a first-stage retriever feeding a reranker, and it is
the number people forget to look at.

---

## 7. How many questions do you need

More than you think, and this is where evaluation efforts usually break rather than on metric
choice.

A 50-question test set measuring an answer-in-context rate near 70% has a 95% confidence
interval of roughly plus or minus 13 points. Two systems scoring 68% and 74% on that set are
indistinguishable. I have watched a team ship a change on exactly that evidence, and then spend
a month confused about why production did not move.

Two fixes, in order of cost. Evaluate both systems on the *same* questions and compare
per-question outcomes rather than the two averages, which removes most of the variance caused by
question difficulty. And, when a decision actually matters, get to several hundred questions.

```python
import numpy as np

def paired_bootstrap(hits_a, hits_b, rounds=10_000, seed=0) -> float:
    """Fraction of resamples where A beats B on the same questions.

    Below ~0.95 the two systems are not distinguishable by this test set.
    """
    rng = np.random.default_rng(seed)
    a, b = np.asarray(hits_a, dtype=float), np.asarray(hits_b, dtype=float)
    idx = rng.integers(0, len(a), size=(rounds, len(a)))
    return float(((a[idx] - b[idx]).mean(axis=1) > 0).mean())
```

Pass it two lists of per-question 0/1 outcomes. If it returns 0.71, you have learned nothing
except that you need more questions.

---

## 8. Reading the two numbers together

The point of separating the hops is that the pair of numbers tells you what to do next.

```
                     answer F1 low        answer F1 fine
                 ┌────────────────────┬────────────────────┐
 answer in       │ generator problem: │ you are shipping.  │
 context often   │ prompt, ordering,  │ Spend the effort   │
 (>= 80%)        │ context length,    │ on latency and     │
                 │ model size.        │ cost instead.      │
                 ├────────────────────┼────────────────────┤
 answer in       │ retriever problem. │ suspicious. Check  │
 context rarely  │ Fix recall first.  │ for leakage, or a  │
 (<= 60%)        │ Nothing downstream │ model answering    │
                 │ moves until it     │ from memory rather │
                 │ does.              │ than context.      │
                 └────────────────────┴────────────────────┘
```

The bottom-right cell is the interesting one. High answer quality with poor retrieval usually
means your questions are answerable without the documents at all, which means your evaluation
set is not testing what you think. It is also, occasionally, a genuine and useful finding: some
of your traffic does not need retrieval, and routing it away from the pipeline is free latency.

Treat the 80% and 60% thresholds as orientation, not law. They depend on how hard your questions
are and how strict your string matching is. What travels between corpora is the diagnosis, not
the cut-off.

---

## 9. Things worth trying this week

Index your own FAQ or wiki with BM25 and with an off-the-shelf embedding model, and score
answer-in-context@5 on fifty real questions from your logs, not questions you invented. Then run
the paired bootstrap and see whether the difference you found is real.

Freeze retrieval completely and vary only the prompt. Whatever answer F1 moves by is the ceiling
on what prompt work can buy you, and it is usually smaller than people expect.

Put answer-in-context@1, @5 and @20 side by side for every run. The gap between @1 and @20 tells
you exactly how much a reranker could win you, before you build one.

There is also a Colab notebook from the original version of this post, with BM25 retrieval,
scoring and a plotted curve: [Retrieval Metrics Demystified][colab]. The metric code above is
the corrected version; prefer it over the notebook's.

[colab]: https://colab.research.google.com/drive/1IzCYnxtvM1fPPrCVW4SMAyo7aYdFWSeX?usp=sharing

---

## 10. The short version

- A RAG system has two hops. Measure them separately or you will not know which one you fixed.
- BM25 is fast, untrained, debuggable and hard to beat on identifiers and rare terms. It is the
  baseline, always.
- What people call EM@5 in retrieval is string containment in the top 5, properly named
  answer-in-context@k. It overstates on short answers and understates when chunking split the
  fact.
- Real exact match and token F1 are generation metrics, computed on multisets of tokens after
  SQuAD-style normalisation. Report both.
- Hybrid retrieval fused by RRF, then a cross-encoder rerank, is the 2026 default. Dense alone
  still loses to BM25 out of domain.
- Recall at the first stage is unrecoverable downstream: a reranker cannot promote what it never
  received.
- Fifty questions give roughly plus or minus 13 points. Use paired comparison, and get to
  several hundred before you decide anything.
- BLEU and ROUGE for RAG answers are the advice to drop. Use F1 and exact match for spans, a
  calibrated judge for prose.

*Part 2 builds the harness that runs all of this across sparse, dense, hybrid and
late-interaction retrievers, and adds latency and cost to the scorecard: [A Field Guide and
Benchmark for Similarity Search in RAG](/posts/2025/05/rag-retrieval-benchmark/).*
