---
title: 'LexSubLM-Lite: Lightweight Lexical Substitution That Runs Anywhere'
date: 2025-04-24
permalink: /posts/2025/04/lexsublm-lite/
tags:
  - NLP
  - open-source
  - machine learning
  - python
  - lexical substitution
---

Lexical substitution is one of those NLP tasks that seems simple until you try to do it well. You want a tool that can replace a word in a sentence with a substitute that *makes sense*, stays grammatically correct, and doesn’t rely on a 60GB language model. 😅

Meet **[LexSubLM-Lite](https://github.com/shamspias/lexsublm-lite)** — a compact, context-aware Python toolkit for one-word substitution that actually runs on your laptop. Built for researchers, tinkerers, and developers, it’s fast, extensible, and doesn’t assume you have a GPU cluster sitting idle.

---

## ✨ What does it do?

You give it a sentence and a target word. It gives you back top-k replacements that keep the original meaning *and* stay syntactically legal. For example:

```bash
lexsub run \
  --sentence "The bright student aced the exam." \
  --target bright \
  --top_k 5 \
  --model llama3-mini
```

Might return:
```json
[
  "brilliant",
  "smart",
  "gifted",
  "clever",
  "talented"
]
```

Cool, right?

---

## ⚙️ How it works

It’s a modular pipeline, with each part doing one job:

1. **Prompted generation**: A quantized LLM generates candidate words.
2. **Sanitisation**: Removes multi-word noise and junk.
3. **POS + morphology filtering**: Ensures correct tense, number, etc.
4. **Ranking**: Uses cosine similarity with `e5-small-v2` or next-token log-probs.
5. **Evaluation**: Built-in scoring against SWORDS, ProLex, and TSAR-2022 datasets.

All that with:
- 4-bit GGUF model support (blazingly fast on macOS)
- No need to edit code to add new models (`model_registry.yaml` FTW)
- Docker setup and dataset download scripts for reproducibility

---

## 🧪 Evaluate like a researcher

Run one command and get metrics like P@1, Recall@5, GAP, and ProF1:

```bash
lexsub eval \
  --dataset prolex \
  --split dev \
  --model distilgpt2
```

Whether you're experimenting with LLMs or benchmarking your own model, LexSubLM-Lite helps you keep things measurable and reproducible.

---

## 🛠️ Built to hack

The toolkit is super easy to extend:
- Drop a new alias in `model_registry.yaml`
- Tweak the filters or add your own
- Swap in your own generator or ranking logic

Everything is cleanly organized — no surprises, just Python done right.

---

## 🚀 Quick start

```bash
git clone https://github.com/shamspias/lexsublm-lite
cd lexsublm-lite
pip install -e .
```

If you’ve got CUDA, install `bitsandbytes` to unlock true 4-bit quantization:

```bash
pip install bitsandbytes
```

Then start substituting.

---

## 📈 Benchmarks (Sample)

| Model         | RAM GB | P@1 | R@5 | Jaccard |
|---------------|--------|-----|-----|---------|
| tinyllama     | 0.8    | 0.20| 0.04| 0.04    |
| distilgpt2    | 1.1    | 0.10| 0.05| 0.08    |
| llama3-mini   | 1.2    | 0.00| 0.16| 0.13    |

(M2 Pro, no GPU)

---

## 🧠 Nerdy Details

- Uses `spaCy` + `pymorphy3` for morphological matching
- Ranks with `sentence-transformers` (SBERT) or native LLM logprobs
- Data download via bash script — one command and done
- Metrics via `tabulate2`, `pydantic`, `orjson`, etc.

All dependencies are cleanly listed in `pyproject.toml`.

---

## 🗺️ Roadmap

Coming soon:

- LoRA fine-tuning
- Gradio UI playground
- Full multilingual eval on TSAR-2022 ES/PT

---

## 📚 Citation

If you use it in your work, cite it!

```bibtex
@software{lexsublm_lite_2025,
  author  = {Shamsuddin Ahmed},
  title   = {LexSubLM-Lite: Lightweight Contextual Lexical Substitution Toolkit},
  year    = {2025},
  url     = {https://github.com/shamspias/lexsublm-lite},
  license = {MIT}
}
```

---

## 🧵 TL;DR

LexSubLM-Lite gives you fast, controllable synonym generation with research-quality metrics. If you’re into language models but tired of setting up Hugging Face Transformers on an EC2 instance just to get synonyms — this one’s for you.

**GitHub:** [github.com/shamspias/lexsublm-lite](https://github.com/shamspias/lexsublm-lite)