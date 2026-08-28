---
title: "When Your Knowledge Base Should Be a Graph"
seoTitle: "GraphRAG Explained: When a Graph Beats Chunks"
description: "GraphRAG turns a corpus into entities, communities and LLM-written reports so it can answer whole-corpus questions that top-k retrieval structurally cannot."
date: 2024-12-10
permalink: "/posts/2024/12/knowledge-graphs-for-rag/"
lang: en
tags:
  - "RAG"
  - "knowledge representation"
  - "graphs"
  - "information retrieval"
  - "summarisation"
  - "beginner"
series: "Retrieval and RAG"
seriesOrder: 2
math: false
---

*Ask a normal retrieval system "what are the main themes in these ten thousand documents" and it will confidently answer from five chunks it happened to find. It is not being lazy. Nothing in that question points at any particular passage, so the search has nothing to grab. This post is about the class of question that breaks top-k retrieval, and about the 2024 answer to it: build a graph first, summarise the graph, and answer from the summaries.*

---

## 1. The question that has no chunk

[Part 1](/posts/2024/08/retrieval-metrics/) of this series was about measuring retrieval, and the whole measuring apparatus assumes something quiet: that the answer lives somewhere specific, and the job is to find it. Recall@k only means something if there is a passage to recall.

Now take these two questions about the same corpus of a thousand support tickets.

- "What did we tell the customer in ticket 8842?" One ticket holds the answer. Retrieval works.
- "What are customers most frustrated about this quarter?" No ticket holds the answer. It is spread across all of them, thinly.

The second question is not harder in degree. It is a different kind of task. Microsoft's GraphRAG paper puts it plainly: this "is inherently a query-focused summarization (QFS) task, rather than an explicit retrieval task." Their documentation is blunter about the failure: "Queries such as 'What are the top 5 themes in the data?' perform terribly because baseline RAG relies on a vector search of semantically similar text content within the dataset. There is nothing in the query to direct it to the correct information."

Watch what your system does when asked one of these. It retrieves its usual handful of chunks and writes a summary of *those*, which reads like an answer about the corpus and is actually an answer about an arbitrary sample. Nobody notices, because the output is fluent.

---

## 2. So build a graph, but not the kind you think

The 2024 answer, published by Microsoft Research as GraphRAG (blog February 2024, [paper](https://arxiv.org/abs/2404.16130) April 2024, [code](https://github.com/microsoft/graphrag) under MIT in July 2024), starts by turning the text into a graph.

Not by hand, and not into a classical knowledge graph. A language model reads each chunk and writes down what is in it:

> "We do this using a multipart LLM prompt that first identifies all entities in the text, including their name, type, and description, before identifying all relationships between clearly-related entities, including the source and target entities and a description of their relationship."

Three details are worth more than the rest.

**Chunks are small on purpose.** They used 600-token chunks with 100-token overlap, and measured why: "using a chunk size of 600 token extracted almost twice as many entity references as when using a chunk size of 2400." Longer chunks are cheaper to process and quietly lose entities.

**The model gets asked twice.** A pass called *gleanings* asks the model whether it missed anything, forcing a yes or no, and if the answer is yes, tells it "MANY entities were missed in the last extraction" and asks again. That sentence is in the shipped prompt. Extraction recall is a real problem and this is the cheap fix.

**Nothing is deduplicated.** No entity resolution step, no canonical ids. "Acme Corp", "Acme", and "the company" can all end up as separate nodes, and the authors argue that is fine, because the clustering step puts them in the same community anyway and the model understands they are the same thing. This is the sentence that separates GraphRAG from a decade of knowledge-graph engineering:

> "These qualities also differentiate our graph index from typical knowledge graphs, which rely on concise and consistent knowledge triples (subject, predicate, object) for downstream reasoning tasks."

A classical knowledge graph is a database you have to keep clean. This graph is scaffolding for summarisation, and it tolerates mess.

---

## 3. Communities, and reports about communities

Now the actual trick, and it is not the graph.

Cluster the graph with the Leiden algorithm, which finds groups of entities that talk to each other more than they talk to everyone else, and does it *hierarchically*: small tight groups, sitting inside larger looser ones, up to a handful of top-level groups covering everything.

Then have the model write a report about each cluster. Then write reports about the reports, upward, until one report covers the corpus.

![A graph of entities in four dashed community rings on the left, and on the right the report hierarchy those clusters produce: four community reports merging into two, then into one root report](/figures/graphrag-communities.svg "The graph is the scaffolding. The product is the stack of reports on the right, one per community, merged upward until a single report covers everything.")

The summaries are the point, and the paper says so: they "are independently useful in their own right as a way to understand the global structure and semantics of the dataset, and may themselves be used to make sense of a corpus in the absence of a question."

That is a real deliverable. Before anyone asks anything, you have a browsable map of what is in a corpus nobody has read.

---

## 4. Two ways to ask

**Global search** answers whole-corpus questions with map-reduce over those reports. Shuffle the community summaries, split them into chunks, answer the question separately against each chunk in parallel, and have the model score each partial answer 0 to 100 for helpfulness. Throw away the zeros, sort by score, fill one final context window with the best, and write the answer from that.

The shuffle is not decoration. It spreads relevant material across chunks instead of letting it pile into one that then overflows.

**Local search** is the ordinary-looking one: match the question to entities, then pull in what surrounds them, their relationships, their claims, their community's report. It answers "what are the healing properties of chamomile", which is a question about a thing.

```
 global question        local question
 ───────────────────────────────────────────────
 "main themes?"         "what about chamomile?"
 reads every report     finds one entity
 at a chosen level      then walks outward
 map-reduce, parallel   one hop, then read
 cost scales with       cost scales with
 corpus size            neighbourhood size
```

Note what this means for your bill. A local question is cheap. A global question at a low level of the hierarchy reads a large fraction of everything you have, every single time.

---

## 5. What it costs, honestly

Here is the number that decides whether any of this is affordable, from the paper's own table on a corpus of about a million tokens.

![Horizontal bars of tokens read per global question: source text 1,014,611; level 3 communities 746,100; level 2 565,720; level 1 225,756; root communities 26,657, highlighted](/figures/graphrag-context-tokens.svg "Answering the same question from higher up the hierarchy reads dramatically less. Root-level reports are 2.6% of the corpus and still beat plain retrieval on comprehensiveness.")

Root-level answering reads 26,657 tokens instead of a million: the paper reports "over 97% fewer tokens" than summarising the source text, and still holds "a 72% win rate" on comprehensiveness against ordinary retrieval. If you take one practical thing from this post, take that: answer from the top of the hierarchy first, and only go down a level when the answers are visibly too shallow.

Two more findings that save you a week of tuning.

**Small context windows won.** They tested 8k, 16k, 32k and 64k, and "the smallest context window size tested (8k) was universally better for all comparisons on comprehensiveness." Stuffing more into the window made answers worse, not better.

**Indexing is the expensive half, and it is not free.** Building the graph for that million-token corpus "took 281 minutes" on their setup. The repository ships a warning in the README: "GraphRAG indexing can be an expensive operation, please read all of the documentation to understand the process and costs involved, and start small." Microsoft never published a dollar figure, and neither will I.

---

## 6. What the win rates do and do not say

The headline result is that graph-based global answering beat ordinary retrieval on "comprehensiveness win rates between 72-83% for Podcast transcripts and 72-80% for News articles", with diversity in a similar band.

Read the method before you quote the number. The questions were generated by a model. The answers were judged by a model, head to head, because there are no gold answers for "what are the main themes". These are preference scores on subjective criteria, not accuracy.

The paper is careful about this in a way that most write-ups are not, and it publishes the results that go the other way too. Ordinary retrieval won on *directness* in every comparison, which the authors deliberately used as a validity check: a method that won on everything would mean the judge was broken. And on empowerment, the comparisons "showed mixed results".

Then there is the finding that ought to be more famous, from the v1 paper's discussion:

> "We consistently observed Graph RAG achieve the best head-to-head results against other methods, but in many cases the graph-free approach to global summarization of source texts performed competitively. The real-world decision about whether to invest in building a graph index depends on multiple factors, including the compute budget, expected number of lifetime queries per dataset, and value obtained from other aspects of the graph index."

The graph-free baseline, which is just map-reduce summarisation over the raw chunks, was competitive. That paragraph is the honest decision rule, written by the people who built the thing.

---

## 7. The rest of 2024 was people making it cheaper

The year after the release reads like one long apology for the indexing bill, all of it from the same team.

- **DRIFT search** (October) mixed local and global rather than making you choose.
- **Dynamic community selection** (November) stopped reading every report at a level, choosing about 470 instead of roughly 1,500 on their test set, for "an average cost reduction of 77%".
- **LazyGraphRAG** (November) went further and skipped the expensive summarisation pass entirely: "LazyGraphRAG data indexing costs are identical to vector RAG and 0.1% of the costs of full GraphRAG", with "more than 700 times lower query cost" than global search at comparable quality.

That "0.1%" is Microsoft telling you, in their own words, that full indexing costs roughly a thousand times more than just embedding your chunks.

Two other 2024 projects are worth knowing, because they attack different halves of the problem:

- **HippoRAG** (May 2024, Ohio State) builds an entity graph and then runs Personalized PageRank at query time instead of pre-writing summaries. It targets multi-hop questions, not whole-corpus ones, and reports being "10-30 times cheaper and 6-13 times faster" than iterative retrieval.
- **LightRAG** (October 2024, HKU) drops community summarisation for a two-level retrieval scheme and adds incremental updates, which is the other thing full GraphRAG is bad at: a new document means re-clustering, and communities move.

---

## 8. So when should you build one

Ask these in order, and stop at the first no.

1. **Are your real questions global?** If your users ask "where is X", a graph is an expensive way to answer a question a hybrid retriever already answers. Go and read your query logs before you read another architecture post.
2. **Will the index amortise?** Indexing is one big LLM pass over everything, plus a summarisation pass per community. A corpus queried twice a month never pays that back. A corpus queried a thousand times a day does.
3. **Is the corpus stable?** Documents that change hourly mean re-extraction and shifting communities. Stable corpora, an annual report set, a closed archive, a finished project's history, are where this shines.
4. **Do the summaries have value on their own?** If a browsable map of an unread corpus is worth something to your team by itself, the graph is earning twice.

If you answered no early, the boring answer is still the right one: hybrid retrieval with a reranker, which [part 3](/posts/2025/05/rag-retrieval-benchmark/) benchmarks properly. And whichever you build, the honest move is to measure both on your own questions rather than trusting anyone's win rate, including this one.

There is also a cheaper cousin of the same instinct. A graph is one way to give a model structure it can navigate; a document's own table of contents is another, and [part 4](/posts/2025/09/pageindex-vectorless-rag/) is about doing exactly that with no graph at all. Writing the structure down by hand, as [part 5](/posts/2026/07/open-knowledge-format/) describes, is a third.

---

## 9. The short version

- Top-k retrieval fails on whole-corpus questions by construction, not by tuning. Nothing in "what are the main themes" points at a passage.
- GraphRAG has a model extract entities and relationships from small chunks, deliberately skipping entity resolution, then clusters the graph hierarchically with Leiden.
- The valuable output is not the graph. It is the stack of community reports written on top of it, which are useful before anyone asks a question.
- Global search is map-reduce over those reports with helpfulness scoring; local search anchors on entities and walks outward. Their costs are nothing alike.
- Answer from the top of the hierarchy: root-level reports were 2.6% of the corpus tokens and still won 72% of comprehensiveness comparisons against plain retrieval.
- The 8k context window beat the bigger ones. More context made answers worse.
- The win rates are model-judged preferences on model-written questions, and the paper's own graph-free baseline was competitive. Treat 72-83% as directional.
- Indexing is the bill. Microsoft's own follow-ups cut it by 77%, then by three orders of magnitude, which tells you what they thought of the original price.
- Build the graph when the questions are global, the corpus is stable, the query volume amortises the index, and the summaries are worth having anyway. Otherwise use hybrid retrieval and spend the money on evaluation.

*Sources for every quoted line: the [GraphRAG paper](https://arxiv.org/abs/2404.16130), the [repository](https://github.com/microsoft/graphrag) and its [documentation](https://microsoft.github.io/graphrag/), and Microsoft Research's [LazyGraphRAG post](https://www.microsoft.com/en-us/research/blog/lazygraphrag-setting-a-new-standard-for-quality-and-cost/).*
