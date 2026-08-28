---
title: "PageIndex: Retrieval With No Vectors At All"
seoTitle: "PageIndex: Vectorless, Tree-Based RAG Explained"
description: "PageIndex indexes a document as its own table of contents and lets a model walk the tree. No embeddings, no chunking, and a route you can show a reader."
date: 2025-09-24
permalink: "/posts/2025/09/pageindex-vectorless-rag/"
lang: en
tags:
  - "RAG"
  - "information retrieval"
  - "document understanding"
  - "agents"
  - "evaluation"
  - "beginner"
series: "Retrieval and RAG"
seriesOrder: 4
math: false
---

*Think about how you actually find something in a 200-page annual report. You do not read it. You do not compare every paragraph against your question. You open the contents page, decide which section sounds right, turn to it, and if you were wrong you back out and try another. PageIndex is that habit written down as software, and its claim is that for long structured documents it beats the embedding pipeline the whole industry built.*

---

## 1. The uncomfortable question

Ordinary retrieval, the kind [part 3](/posts/2025/05/rag-retrieval-benchmark/) of this series benchmarks, cuts documents into chunks, turns each chunk into a vector, and at query time returns the k chunks whose vectors sit closest to the question's vector.

It works. It also has a premise sitting underneath it that nobody says out loud: that the passage which *sounds* most like your question is the passage that *answers* it. PageIndex's authors put the objection in three words:

> "similarity ≠ relevance"

and, in the same breath, what to do about it: "what retrieval actually needs is relevance, and relevance requires reasoning."

Sometimes those come apart badly. The answer to "how much did deferred assets change" may sit in a table in Appendix G, described in language that shares no words with the question, while three paragraphs that talk *about* deferred assets in general float to the top instead. Chunking makes it worse: cut at 512 tokens and the sentence that names the year lands in one chunk and the number in the next.

---

## 2. The idea, in one paragraph

Do not build a vector index. Build the document's table of contents as a tree, one node per real section, with page numbers and a short summary. Put that tree in the prompt. Let the model walk it.

The README describes the whole system in two lines: "**Index**: generate a **tree-structure index** for each document" and "**Retrieve**: agentically **search that tree** with LLM reasoning". [PageIndex](https://github.com/VectifyAI/PageIndex) is by Vectify AI, MIT licensed, first published in early 2025.

A node looks like this, which is the actual shape the tool emits:

```json
{
  "title": "Financial Stability",
  "node_id": "0006",
  "start_index": 21,
  "end_index": 22,
  "summary": "The Federal Reserve monitors financial vulnerabilities...",
  "nodes": [
    {
      "title": "Monitoring Financial Vulnerabilities",
      "node_id": "0007",
      "start_index": 22,
      "end_index": 28,
      "summary": "The Federal Reserve's monitoring framework..."
    }
  ]
}
```

Title, page range, summary, children. Nothing exotic. You could write one by hand for a document you care about, and that is rather the point.

---

## 3. What a query actually does

The model gets the tree and the question, and answers one question at each node: given what I am looking for, should I open this subtree?

![An indented document tree where the model opens Annual Report, then Financial Stability, then Monitoring Financial Vulnerabilities, reading 7 pages, while four other sections are marked no and never read](/figures/pageindex-tree.svg "The whole retrieval step is a walk. Sections it declines are never read, and the sections it opened are the citation.")

The tutorial prompt is refreshingly plain about it:

```
You are given a query and the tree structure of a document.
You need to find all nodes that are likely to contain the answer.
```

Three consequences fall out of that, and they are the real argument for the approach.

**No top-k cliff.** There is no fixed cutoff quietly dropping the passage that ranked k+1. The model keeps opening nodes until it has what it needs.

**The route is the citation.** You get "section 3.2, pages 22 to 28" rather than "these five chunks scored 0.83". A reader can check it. In regulated work that difference is the whole procurement conversation.

**It can follow a pointer.** When a section says "Appendix G provides more detailed information", a tree walker can go to Appendix G. A similarity search cannot follow a reference, because a reference does not look like an answer.

The authors' summary of the difference is a good sentence: "Vector search returns a list of chunks with no story; PageIndex returns a route."

---

## 4. What it costs to build

Indexing means paying a model to read the document once: infer where the real sections start and stop, then write a summary for each node. You pay it once per document, not once per question.

Cost, from the repository: "about `$0.001` per page", so a thousand-page textbook is a little over a dollar and a few minutes. That is not free, and it is a real difference from embedding-only pipelines where indexing is one cheap pass. It is also one-off, and vastly cheaper than building a knowledge graph, which [part 2](/posts/2024/12/knowledge-graphs-for-rag/) priced out.

The larger cost lives at query time, because every query spends reasoning tokens. That is the trade the whole method makes: less money on the index, more on each question.

---

## 5. The numbers, as they stand today

The headline you will see is 98.7% on FinanceBench. Read the label carefully: that result is from Mafin 2.5, a finance product built on top of PageIndex, not from the open-source tool on its own. The widely repeated "vector RAG got 50%" comparator next to it appears as alt text on an image, with no published methodology behind it.

There is also no independent third-party evaluation. Every number in circulation is the authors' own, run on their own harness. That is not an accusation, it is the state of the evidence, and it is the reason section 8 below is a list of questions to ask rather than a recommendation.

---

## 6. What changed since this was written

I have revised this post since 2025, because two things landed that change the practical answer.

**Indexing stopped needing a model for the structural pass.** The default now reads the PDF's own layout statistics to build the tree, and spends model tokens only on the summaries. Cost, from the repository: "about `$0.001` per page", so a thousand-page textbook is a little over a dollar and a few minutes.

**There is now a reproducible benchmark.** 62 questions over 34 PDFs, 1,945 pages, drawn from MMLongBench-Doc-V2 and judged by that benchmark's own semantic-equivalence judge.

![Bars of accuracy from 85.5 to 100 percent across six model and effort settings, with the cost per question printed beside each bar in fractions of a cent](/figures/pageindex-cost-accuracy.svg "The same benchmark across the model ladder. The last three points of accuracy cost roughly twenty-two times as much per question as the first ninety-seven.")

Read the two highlighted rows together. A small model reasoning hard reached 96.8% for about a third of a cent a question. A large model reached 100% for around eight cents. Which you want depends on what a wrong answer costs you, which is a question about your business rather than about retrieval.

Now the part most write-ups skip. The benchmark's own README says its questions are "facts stated in running text: no charts, no tables, no figures, and no counting or arithmetic on top of what was retrieved", and that "documents it refuses are excluded rather than scored as failures". So it measures locating and reading, deliberately, and says nothing about tables. Financial filings are made of tables.

---

## 7. Where it breaks

The authors are unusually candid, and their users fill in the rest.

**Token efficiency is the paradigm's weak point.** Their own words: "Naively classifying relevance over the entire knowledge base via brute-force evaluation is token-inefficient and does not scale." The fix is pruning whole subtrees early, which helps and is not magic.

**Many documents is a different problem from one long document.** A tree per document is elegant; a million trees is not something you put in a prompt. Their answer to that lives in the commercial layer, not the MIT repository.

**Big documents can defeat the indexer.** An open issue reports incomplete trees for 500-page PDFs because the structure pass hits a context limit. Another reports minutes, not seconds, to index a 128-page scanned document locally.

**Scans and images are cloud-only.** The open-source local mode is for text-heavy PDFs, with page-level rather than line-level citations.

And the authors say the obvious thing about vectors, which I wish more people would: "Vector databases will continue to have important, well-defined use cases, such as recommendation systems and other settings, where semantic similarity is the objective."

---

## 8. When to reach for this

A short decision list, in the order I would actually apply it.

1. **Are your documents long and structured?** Annual reports, regulatory filings, standards, manuals, contracts, textbooks. Real headings, real sections. If your corpus is a pile of chat logs and tickets, there is no tree to walk and this is the wrong tool.
2. **Does anyone have to defend the answer?** If a human downstream must check where a number came from, a route beats a similarity score, and that alone can decide it.
3. **Is your query volume small enough to pay per question?** Reasoning per query is the cost. Thousands of queries an hour against a static corpus favours embeddings.
4. **Are your answers in tables?** Then benchmark it yourself on your own tables, because the published numbers explicitly exclude them.

The honest engineering answer, as usual, is that these compose. Embed for breadth across a big messy corpus, walk a tree for depth inside the document you landed in, and keep the graph from [part 2](/posts/2024/12/knowledge-graphs-for-rag/) for questions about the corpus as a whole. Structure at query time, structure at index time, structure written by hand: three answers to one shortage.

Which brings me to the thing this series keeps circling. Every method here is an attempt to hand a model structure it did not have. PageIndex borrows the structure the author already wrote in the contents page. GraphRAG manufactures structure with an expensive extraction pass. The third option, writing the structure down deliberately, is [part 5](/posts/2026/07/open-knowledge-format/).

---

## 9. The short version

- PageIndex replaces the vector index with the document's own table of contents as a tree, and retrieval becomes a model walking that tree.
- Its thesis is that similarity is not relevance, and that judging relevance takes reasoning.
- A node is title, page range, summary, children. You could hand-write one.
- The output is a route, not a ranked list, so citations point at sections and pages a person can open.
- No top-k cutoff, no chunk boundaries, and cross-references can be followed.
- Indexing costs roughly a tenth of a cent per page and runs once. Reasoning per query is the ongoing bill.
- On its own 62-question benchmark, a small model at high effort reached 96.8% for `$0.0036` a question, and 100% cost about twenty-two times more.
- That benchmark deliberately excludes tables, charts and arithmetic, skips documents the indexer refuses, and is the authors' own. No independent evaluation exists yet.
- Best fit: long structured documents, auditable answers, moderate query volume. Worst fit: huge unstructured corpora, table-heavy questions, high query rates.
- Vectors are not dead, and the authors say so themselves. Reach for structure when your documents have some.

*Everything quoted here comes from the [PageIndex repository](https://github.com/VectifyAI/PageIndex), its [benchmark](https://github.com/VectifyAI/PageIndex-OSS-Benchmark), and the project's own [write-up](https://pageindex.ai/blog/pageindex-intro).*
