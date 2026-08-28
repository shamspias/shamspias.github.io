---
title: "Several Retrievers, One Small Machine"
seoTitle: "Hybrid Retrieval on One Box: Cheap and Better"
description: "How to run keyword, dense, fusion and reranking together on modest hardware: where the memory actually goes, and which famous constants are folklore."
date: 2026-08-27
permalink: "/posts/2026/08/many-retrievers-one-box/"
lang: en
tags:
  - "RAG"
  - "information retrieval"
  - "hybrid retrieval"
  - "BM25"
  - "quantization"
  - "performance"
series: "Retrieval and RAG"
seriesOrder: 6
math: false
---

*The usual advice for better retrieval is to add another method, and the usual objection is that you cannot afford it. Both are half right. You can run keyword search, dense vectors, fusion and a reranker on one modest machine, and it will beat any single method you could fit there instead. This post is about where the memory actually goes, which is almost never where people look, and about four widely repeated numbers in this field that turn out to be nobody's recommendation.*

---

## 1. The budget

Assume one machine. A million chunks, embeddings at 1,024 dimensions, and a fixed amount of RAM you would rather not double.

The instinct is to pick one retrieval method and spend the whole budget on it. That is usually the wrong shape, because the methods have wildly different price tags, and the cheap ones are not the weak ones.

[Part 3](/posts/2025/05/rag-retrieval-benchmark/) covered how to measure which stack wins on your data. This post is the other half: what each method costs to keep running, and how to fit several at once.

---

## 2. Where the memory actually goes

Elasticsearch publishes its per-vector memory formulas, so this is arithmetic rather than opinion. For a million vectors at 1,024 dimensions, with an HNSW graph at the default `m` of 16:

![Horizontal bars: float32 3.87 GiB, int8 1.02, int4 0.54, binary 0.19, with the byte cost of each noted](/figures/vector-memory.svg "The published formulas, worked through. The graph is 64 MB of the total in every row, which is why tuning it saves nothing and quantising saves everything.")

Read the graph term first, because it is the thing people fiddle with: `num_vectors * 4 * m` is 64 MB. Sixty-four megabytes out of nearly four gigabytes. Halving `m` to save memory is rearranging deckchairs; the vectors are 98% of the bill.

Now the quantisation ladder, which is where the order of magnitude lives. Note that the reductions are not exactly 4x and 32x, because each vector carries a few correction bytes: int8 is `num_dimensions + 4` per vector and binary is `num_dimensions/8 + 14`, which works out to 28.8x rather than 32x.

**Does it wreck quality?** Less than you would expect, and there is a surprising published result. Elastic compared BBQ, their binary scheme, against float32 across ten BEIR datasets and reported that "BBQ achieved better ranking quality than pure float32 search in 9 out of the 10 datasets".

Before you cheer, read their explanation, because it is the honest one. Binary vectors are searched with a larger candidate pool by default: "Float32: 1.5\*k = 15. BBQ: max(1.5\*10, 3\*10) = 30. Because of the difference in num_candidates, we scan a greater part of the HNSW graphs when using BBQ". You are not getting quality for free. You are spending a cheap resource, comparisons over tiny vectors, to buy back what compression lost. That trade happens to be extremely good.

Every vendor says the same thing in their own words. Qdrant on scalar quantisation: "the error introduced by scalar quantization is usually less than 1%", and on binary, "We recommend using binary quantization only with rescoring enabled". Weaviate reports 8-bit rotational quantisation "provides 4x compression while maintaining 98-99% recall", with 4-bit "around 94-95%".

**Then make the vectors shorter as well as smaller.** Matryoshka Representation Learning trains a model so that the first N dimensions are themselves a usable embedding, which means you can simply cut the vector short. Snowflake publishes the cleanest table of what that costs, and it composes with quantisation:

| Vector | Bytes | MTEB Retrieval | Vectors per GB |
|---|---|---|---|
| 768d float32 | 3,072 | 54.9 | 0.33M |
| 768d int8 | 768 | 55.1 | 1.3M |
| 256d int8 | 256 | 54.2 | 3.9M |
| 256d int4 | 128 | 53.7 | 7.8M |

Twenty-four times more vectors per gigabyte for about a point of retrieval quality. One caution from the sentence-transformers documentation, because people misread this: "Despite the embeddings being smaller, training and inference of a Matryoshka model is not faster, not more memory-efficient, and not smaller." Truncation shrinks the index, not the encoder.

And check the recipe, because every vendor differs. OpenAI says slice then normalise. Nomic's v1.5 wants a layer norm before slicing. Google's older embedding model requires manual normalisation and the newer one does it for you. Jina shipped the operations in the wrong order and had to fix it: "We fixed a bug in the `encode` function #60 where Matryoshka embedding truncation occurred after normalization".

---

## 3. The index is a second, separate choice

Compression decides what a vector costs. The index decides what searching them costs, and the trade is not the one most people assume. Faiss publishes measurements on a million SIFT vectors:

![Two bars: the HNSW graph costs 796 MB beyond the vectors, an IVF index with 16,384 lists costs 8 MB, with query time and recall noted](/figures/index-memory-tradeoff.svg "The same million vectors, indexed two ways. The inverted file is a hundredth of the memory and more accurate here. It pays for that with six times the latency.")

A hundred times less memory, better recall, six times slower. On a machine where you are counting gigabytes, that is often the correct trade, and it is invisible if you only ever read HNSW tutorials.

If you are truly tight, the newer disk-backed options are worth knowing. DiskANN keeps compressed vectors in RAM and the graph on SSD, and its paper reports indexing "a billion point database on a single workstation with just 64GB RAM". Elastic's disk-based BBQ reports a million vectors answering in 15.83 ms with 101 MB of total RAM, in a setting where plain HNSW "fails below 2g" and "behaves exponentially as memory becomes increasingly restricted".

For sizing, the vendors' own ceilings are useful and rarely quoted. Qdrant: "a single node typically tops out around 100 million vectors". Milvus tiers it as a few million for the embedded build and "scaling up to 100 million vectors" standalone. Below those numbers, the interesting question is not how to shard, it is what else you can afford to run on the same box.

---

## 4. The cheapest thing you are probably not running

BM25.

Not as a nostalgic baseline. As the method that costs 0.4 GB and 20 ms per query on a million documents, and whose average nDCG@10 across BEIR is 0.429, which is better than several well-known dense models measured on the same suite.

It also fails in the opposite direction from dense retrieval, which is the entire reason to run both. Azure's published comparison by query type makes the point brutally: on keyword queries, keyword search scores 79.2 and vector search scores 11.7. Not worse. Broken. Meanwhile on TREC-COVID a dense model collapses to 17.14 MAP where BM25 gets 27.86.

Your options are all cheap. Lucene through Elasticsearch or OpenSearch, Tantivy if you want it in-process, SQLite's FTS5, which hard-codes BM25 at `k1 = 1.2` and `b = 0.75` and gives you ranked search inside a file, or Postgres full-text search, which is genuinely useful but is *not* BM25: `ts_rank` and `ts_rank_cd` are different functions with different behaviour, and default normalisation "ignores the document length".

One caution I have to include because I nearly repeated it myself. Tantivy's README says it is "approximately 2x faster than Lucene". I pulled the benchmark it links to and computed the medians myself: at TOP_10 Lucene 10.3.0 takes 228 microseconds against Tantivy's 310, and Lucene also wins TOP_100. Tantivy wins TOP_1000 and COUNT. The benchmark's own README asks people not to do what its parent README does.

---

## 5. Fusion, and the constant nobody chose on purpose

Run two retrievers and you need to combine two ranked lists. Reciprocal rank fusion is the standard answer because it needs no score calibration, only ranks:

```python
def rrf(rankings: list[list[str]], k: int = 60) -> list[str]:
    """Fuse ranked ID lists by rank alone. Ranks are 1-based."""
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    return sorted(scores, key=scores.get, reverse=True)
```

Now, that `k = 60`. Elasticsearch, OpenSearch, Weaviate, Vespa, Milvus and Azure all ship it. Here is where it came from, in the words of the 2009 paper that introduced the method: "k = 60 was fixed during a pilot investigation and not altered during subsequent validation."

Their own sweep is worth looking at:

![Eleven near-identical bars of mean average precision for k from 0 to 100, with k = 80 highlighted as the peak and k = 60 marked as the value everyone ships](/figures/rrf-k-sweep.svg "The parameter sweep behind the most-copied constant in hybrid retrieval. The paper's own conclusion was that k = 60 is near-optimal and the choice is not critical, which the bars make obvious.")

The peak is at 80. The paper says as much: "k = 60 was near-optimal, but that the choice was not critical". An entire industry then hard-coded the number from one pilot run on one 2009 collection.

Does that matter in practice? Sometimes. A 2023 study found "RRF to be sensitive to its parameters" and that a small constant, `k = 5`, beat `k = 60` on eight of nine datasets. Elastic separately found the best values on their setup to be 20 rather than 60, while noting "the difference between the best and worst parameter combinations is only about 5%". So: not a crisis, but not a law of nature either, and worth one afternoon of sweeping on your own data.

**One implementation trap.** Qdrant uses `k = 2` and zero-based ranks. Same algorithm name, very different curve: the top hit scores 0.5 there against 1/61 elsewhere, so the gap between rank 1 and rank 10 is roughly 5.5x rather than 1.15x. If you port a config between engines, port the behaviour, not the number.

**Does fusion actually pay?** Elastic's measurement across 13 datasets is the most quotable: RRF "increases average NDCG@10 by 1.4% over Elastic Learned Sparse Encoder alone and 18% over BM25 alone", and, importantly, "the result is either better or similar to BM25 alone for all test data sets", making it a safe "plug and play" default. But it is not universal: on HotpotQA, fusion scored 0.675 against lexical retrieval's 0.682 on its own. Measure, do not assume.

---

## 6. Reranking, and how deep to go

A cross-encoder reads query and passage together and scores the pair. It is the largest single quality gain available and the most expensive thing per document.

Reranking BM25's top 100 with a small cross-encoder is worth about 11% relative nDCG@10 across BEIR. From the same table, on a 2019-era GPU that is roughly 4.3 ms per document, and on eight CPU cores about 61 ms per document. That is the whole story: 430 ms of GPU or six seconds of CPU to rerank a hundred candidates.

So do not rerank a hundred if you are paying in CPU. Elastic measured the depth at which you capture 90% of the available gain, and it landed near 100 on average, but they also report that reranking just the top 30 still delivers "around a 40% uplift in nDCG@10". Their conclusion is the one to tape to the wall: "when efficiency is at a premium, deep re-ranking with small models tends to out perform shallow re-ranking with larger higher quality models".

Two warnings. Reranking deeper is not monotonically better: in 20.2% of their cases the curve turns over, so more candidates made things worse. And a reranker can lose outright on some datasets, dropping 0.096 nDCG@10 on one BEIR set while gaining 0.204 on another.

---

## 7. A machine that does all of it

Put the pieces together for a million chunks on one box:

```
  BM25 index                        ~0.4 GB    20 ms
  vectors, 1024d, binary + rescore  ~0.2 GB    a few ms
  RRF fusion                         0 GB      free, ranks only
  cross-encoder, top 30              model     ~130 ms CPU
  result cache                      ~0.1 GB    25 to 40% of queries
  ─────────────────────────────────────────────────────
  under a gigabyte of index, two retrievers, a reranker
```

Compare that with the naive build: float32 vectors alone would be 3.87 GB, four times the whole stack above, for one retrieval method that answers keyword queries badly.

On the cache line, be realistic. The often-quoted 90% hit rate is from a paper about caching posting lists, not results. Measured result-cache hit rates in the literature sit around 25 to 40%, with a ceiling near 50 to 56%, because roughly half of all query traffic is queries nobody has ever asked before.

And what about late interaction, ColBERT and friends? Storage is linear in document length, so it depends entirely on your documents. At the 68 tokens per passage of MS MARCO, ColBERTv2 at 2 bits is about 2.4 KB per document, which is *smaller* than one 768-dimension float32 vector. At 512 tokens it is six times larger. The crossover sits around 85 tokens. Short passages: affordable. Long documents: not on this machine.

---

## 8. Four numbers that are not what you think

This is the pattern I did not expect when I started checking sources for this post.

- **RRF's `k = 60`** was frozen after one pilot in 2009, and that pilot's own peak was 80.
- **BM25's `b = 0.75`** is Lucene's default, not a recommendation from the canonical BM25 paper, which says only that "0.5 < b < 0.8 and 1.2 < k1 < 2 are reasonably good in many circumstances" and that the model "provides no guidance on how these should be set".
- **Tantivy being "2x faster than Lucene"** is contradicted by the benchmark its own README links to.
- **The "90% cache hit rate"** everyone cites is posting-list caching. Result caching in the same paper tops out at 56%.

None of these is a scandal. Each is a reasonable choice that hardened into a fact through repetition. The lesson for your own system is the same as [part 1](/posts/2024/08/retrieval-metrics/) and [part 3](/posts/2025/05/rag-retrieval-benchmark/) of this series kept insisting: the defaults are somebody else's measurement on somebody else's corpus, and yours takes an afternoon to run.

---

## 9. The short version

- The HNSW graph is a rounding error in your memory bill. At 1,024 dimensions it is 64 MB against nearly 4 GB of vectors, so quantise rather than tuning `m`.
- int8 is about 4x smaller for roughly 1% error. Binary with rescoring is about 29x smaller and beat float32 on 9 of 10 BEIR datasets, because it is scanning a larger candidate pool to make up the difference.
- Matryoshka truncation composes with quantisation: 256 dimensions at int4 is 24 times more vectors per gigabyte for about a point of retrieval quality. It shrinks the index, never the encoder.
- Choose the index separately from the compression. On Faiss's own million-vector test an IVF index used 8 MB against HNSW's 796 MB with better recall and six times the latency.
- BM25 costs 0.4 GB and 20 ms, scores 0.429 average nDCG@10 on BEIR, and rescues exactly the keyword queries where dense retrieval scores 11.7 against its 79.2. Run it.
- Fusion is free at query time and reliably safe: 18% over BM25 alone in Elastic's measurement, and never much worse. Sweep `k` yourself, and remember Qdrant's default is 2 with zero-based ranks.
- Rerank shallow when you pay in CPU. The top 30 still gives roughly a 40% uplift, and deeper reranking actively hurt in a fifth of measured cases.
- The whole stack fits in under a gigabyte, which is a quarter of what float32 vectors alone would cost you.
- Check the constants you inherited. Four of the most repeated ones in retrieval are frozen pilot values, implementation defaults, stale marketing, or a citation about a different kind of cache.

*Sources for every figure and quotation: Elasticsearch's [kNN memory guidance](https://www.elastic.co/docs/deploy-manage/production-guidance/optimize-performance/approximate-knn-search) and [BBQ results](https://www.elastic.co/search-labs/blog/elasticsearch-9-1-bbq-acorn-vector-search), [Qdrant](https://qdrant.tech/documentation/guides/quantization/) and [Weaviate](https://docs.weaviate.io/weaviate/concepts/vector-quantization) on quantisation, [Snowflake Arctic Embed](https://huggingface.co/Snowflake/snowflake-arctic-embed-m-v1.5), [Faiss](https://github.com/facebookresearch/faiss/wiki/Indexing-1M-vectors), the [RRF paper](http://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf), [BEIR](https://arxiv.org/abs/2104.08663), and the [Tantivy benchmark](https://tantivy-search.github.io/bench/).*
