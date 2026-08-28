---
title: "Before You Retrieve Anything, Someone Has to Read the PDF"
seoTitle: "Docling: Parsing Documents So RAG Can Work"
description: "Every retrieval method assumes clean structured text. Getting it out of a PDF is its own problem, and Docling is the 2026 answer worth knowing."
date: 2026-08-28
permalink: "/posts/2026/08/parsing-documents-for-rag/"
lang: en
tags:
  - "RAG"
  - "document understanding"
  - "information retrieval"
  - "open-source"
  - "OCR"
  - "beginner"
series: "Retrieval and RAG"
seriesOrder: 7
math: false
---

*Every post in this series so far has quietly assumed something generous: that your documents are already text, in the right order, with their tables intact. They are not. They are PDFs produced by a print pipeline in 2013, and the first thing that happens to them is that a library flattens a financial table into a sentence. This post is about that step, the one nobody writes about, and about the tool that took it seriously.*

---

## 1. A note on the name, because you may have arrived looking for one

If you came here after hearing about something called **DocLink** in the AI or agent space, here is the honest answer: I went looking, hard. No such specification, protocol, library or standard exists. Not on arXiv, not on npm, PyPI, crates.io or Go, not in the Model Context Protocol registry or any of the community server lists, not in the documentation of fourteen major vendors, and not in a single Hacker News mention in all of 2026.

Three real things do carry the name, and none of them is what people mean when they say it in an AI conversation: an enterprise document-management product for ERP systems, a small unmaintained open-source RAG app, and a dormant Python package from 2018 for building HTTP clients out of docstrings.

What almost certainly *is* meant, and what genuinely matters in 2026, is one letter away: **Docling**. Even the MCP directories resolve the query for you. Search one of them for "doclink" and it answers with `docling-mcp`.

So this post is about Docling, and about the job it does, which is the job that decides whether anything else in this series can work at all.

---

## 2. Garbage in, and nobody measures it

Look back at what the earlier parts assume.

[Part 1](/posts/2024/08/retrieval-metrics/) measures whether the right passage was retrieved, which presumes the passage exists as a coherent piece of text. [Part 2](/posts/2024/12/knowledge-graphs-for-rag/) has a model extract entities from chunks, so a mangled chunk becomes a mangled entity. [Part 4](/posts/2025/09/pageindex-vectorless-rag/) walks a document's table of contents, which requires that headings survived parsing as headings. Even [part 5](/posts/2026/07/open-knowledge-format/), which is about writing knowledge down by hand, starts from someone reading the source correctly.

Every one of them inherits whatever the parser did. And the classic parser behaviour on a table is to emit its cells in whatever order they appear in the file's drawing instructions.

![Two panels of the same page: on the left a flattened text dump where the table has become a run-on sentence, on the right the same table preserved as a grid with a highlighted note that cells keep their row, column and page](/figures/parsing-two-ways.svg "The same table, two parses. The left one still contains every number and answers no question about any of them.")

Ask "what were services in 2025" of the left-hand version and the retriever may even return that chunk, because the words match. The model then reads "Services 188 211 Total 600" and picks one. It has a 50% chance and no way to know which.

This is the failure mode I find most often in retrieval systems that "should be working", and it is invisible in every retrieval metric, because retrieval did its job. The document was broken before it arrived.

---

## 3. What Docling is

Docling is an open-source document conversion toolkit, MIT licensed, originally from IBM Research in Zurich and now hosted under the Linux Foundation's AI umbrella. Its own one-line summary:

> "Docling simplifies document processing by parsing diverse formats, including advanced PDF understanding, and providing seamless integrations with the generative AI ecosystem."

It reads PDF, DOCX, PPTX, XLSX, HTML, EPUB, images, audio and more, and exports Markdown, HTML, DocTags and lossless JSON. Between those two ends sits the thing that matters: a single internal representation called `DoclingDocument`.

That object is not a string. It holds `texts`, `tables`, `pictures` and `key_value_items` as typed lists, and organises them through a `body` tree, a `furniture` tree for headers and footers, and `groups` for things like lists and chapters. Reading order is the order of children in the tree. Items carry layout information, bounding boxes where available, and provenance.

Provenance is the word to hold on to. It means a sentence in your prompt can still name the page it came from, which is what makes a citation checkable rather than decorative.

---

## 4. How it actually parses a page

The [technical report](https://arxiv.org/abs/2408.09869) describes the machinery plainly: Docling is "powered by state-of-the-art specialized AI models for layout analysis (DocLayNet) and table structure recognition (TableFormer), and runs efficiently on commodity hardware in a small resource budget."

![Six numbered stages a page passes through: read, layout, tables, text, assemble and export, with the assemble stage highlighted](/figures/docling-pipeline.svg "Six places a document can lose something a retriever will later need. The one that matters most is the fifth, where everything is put back together with its provenance.")

Two specialised models rather than one general one is the design decision worth noticing. Layout analysis answers "what are the blocks on this page and in what order do they read". Table structure recognition answers a genuinely harder question: which cells belong to which row and column, including the merged ones that no text extractor has ever handled.

Since 2025 there is also a single-model path. **Granite-Docling-258M** is a vision-language model, released by IBM under Apache 2.0, that converts a page end to end. Per IBM's own description it builds on the Idefics3 architecture with a `siglip2-base-patch16-512` vision encoder and a Granite 165M language model, and it is deliberately tiny for what it does. The pitch is that unlike an OCR model that goes straight to Markdown and loses the link back to the source, it preserves structure in a form downstream retrieval can use.

Both paths run locally, which for anyone handling contracts, medical records or anything under a data-residency rule is not a nice-to-have. It is the whole procurement conversation.

---

## 5. Using it, and the one habit that matters

Installation and a conversion are two commands:

```bash
pip install docling
docling convert annual-report.pdf --to md --output ./out

# and, because it knows the structure, it can do the chunking too
docling convert annual-report.pdf --to chunks --chunks-type hybrid --output ./out
```

In Python, with the structure kept:

```python
from docling.document_converter import DocumentConverter

result = DocumentConverter().convert("annual-report.pdf")
doc = result.document

print(doc.export_to_markdown()[:400])            # for a human, or for a prompt

for table in doc.tables:                         # tables survive as tables
    frame = table.export_to_dataframe(doc=doc)   # a pandas DataFrame
    print(frame.to_markdown())
```

Now the habit. Having gone to the trouble of recovering structure, do not immediately throw it away by cutting the markdown into 512-token pieces. Chunk on the structure you just recovered: one chunk per section, carrying its heading path and its page range.

```python
from docling.chunking import HybridChunker

chunker = HybridChunker()

for chunk in chunker.chunk(dl_doc=doc):
    raw = chunk.text                            # the section's own text
    enriched = chunker.contextualize(chunk=chunk)  # same text, headings prepended
```

`chunk.meta` carries the rest: the headings the chunk sits under, and the document
items it came from, which is where the page numbers live. Embed the enriched text,
store the metadata beside it, and your citations survive all the way to the answer.

That single change tends to do more for answer quality than swapping embedding models, and it costs nothing at query time. It is also what makes the rest of this series available to you: a document with real headings can be walked as a tree the way [part 4](/posts/2025/09/pageindex-vectorless-rag/) does, and entities extracted from a clean chunk are worth more to the graph in [part 2](/posts/2024/12/knowledge-graphs-for-rag/) than entities extracted from a jumble.

Docling also ships an MCP server and integrations for LangChain, LlamaIndex, Haystack and Crew AI, so an agent can call it directly rather than through your glue code.

---

## 6. Where it will still hurt

**Tables remain the hard part.** They are hard for every tool, and a merged header cell spanning three columns is where all of them are tested. Check yours by hand before you trust a number that came out of one.

**Scans cost more.** OCR or a vision model per page is a different price from reading a text layer, in time and in money. Know which of your documents have text layers before you size anything.

**Parsing is lossy, always.** A two-column academic paper with floating figures and footnotes has an ambiguous reading order even for a human. Anything that claims to be perfect at this is selling something.

**Measure it like anything else.** Take twenty pages you care about, convert them, and read the output next to the original. That hour will tell you more than any benchmark, because the question is not "is this tool good" but "is it good on the documents you actually have".

I have not put throughput numbers in this post because the ones I could verify were qualitative. The report says commodity hardware and a small resource budget, and I would rather quote that than a figure from somebody's blog post.

---

## 7. The short version

- Every retrieval method assumes clean structured text. Getting it out of a real PDF is a separate problem, and it is where quiet, unmeasurable damage happens.
- A flattened table still contains every number and can answer no question about any of them. Retrieval metrics will not show you this.
- There is no AI specification called DocLink. The thing people mean is Docling: MIT licensed, from IBM Research, now under the Linux Foundation's AI umbrella.
- It converts PDF, DOCX, PPTX, HTML, images and more into one `DoclingDocument` with a body tree, typed items for texts, tables and pictures, and provenance down to bounding boxes.
- The parse uses specialised models for layout (DocLayNet) and table structure (TableFormer), or a single small vision-language model, Granite-Docling-258M, released under Apache 2.0.
- Everything runs locally, which matters more than any benchmark for regulated documents.
- Chunk on recovered structure, not on token counts. Keep headings and page numbers on every chunk.
- Tables are still the hard part, scans still cost more, and parsing is always lossy. Read twenty converted pages by hand before trusting the pipeline.

*Sources: the [Docling repository](https://github.com/docling-project/docling), the [technical report](https://arxiv.org/abs/2408.09869), the [DoclingDocument documentation](https://docling-project.github.io/docling/concepts/docling_document/), and IBM's [Granite-Docling announcement](https://www.ibm.com/new/announcements/granite-docling-end-to-end-document-conversion).*
