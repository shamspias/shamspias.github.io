---
title: "LexSubLM-Lite: Lightweight Lexical Substitution That Runs Anywhere"
seoTitle: "LexSubLM-Lite: Lexical Substitution That Runs Anywhere"
description: "A laptop-sized toolkit for context-aware lexical substitution, and an honest look at what tiny models actually score on it."
date: 2025-04-24
permalink: "/posts/2025/04/lexsublm-lite/"
tags:
  - "NLP"
  - "open-source"
  - "machine learning"
  - "python"
  - "lexical substitution"
math: false
---

*I built a small tool that swaps one word in a sentence for a better one, on a laptop, with no
GPU. The tool works. The scores it produced were bad, and the bad scores turned out to be the
most useful thing in the project.*

---

## 1. What the task actually is

A thesaurus gives you one list of synonyms per word. That list has to cover every possible use
of the word at once, so most of it is wrong for the sentence in front of you.

Lexical substitution gives you one list per *occurrence*. Same word, different sentence,
different answers.

```
                 target word: "bright"

  "The bright student aced the exam."
        │
        ├── thesaurus  -> luminous, shining, brilliant, clever, vivid
        └── in context -> brilliant, smart, gifted, clever

  "The bright lamp lit the whole yard."
        │
        ├── thesaurus  -> luminous, shining, brilliant, clever, vivid
        └── in context -> luminous, blazing, strong, powerful
```

That is the whole task. Given a sentence and a target word, return the top-k words you could
put in that slot so the sentence still means roughly the same thing and still parses as
English.

Three constraints have to hold at once, and they pull against each other:

1. **Meaning.** The substitute has to fit the sense the word is being used in.
2. **Grammar.** If the target is a plural noun, the substitute has to be a plural noun. If it
   is a past-tense verb, the substitute has to be a past-tense verb.
3. **Register.** "Aced" and "passed" both parse, but they are not the same sentence.

A large language model handles all three casually if you hand it the sentence and enough
context window. The interesting question is how small you can go before it falls apart, which
is what [LexSubLM-Lite](https://github.com/shamspias/lexsublm-lite) was built to measure.

---

## 2. The pipeline

The design is deliberately boring: a chain of stages, each doing exactly one job, each of
which can be swapped or switched off so you can attribute a score change to a specific stage.

```
"The bright student aced the exam."      target: bright (ADJ)
             │
             ▼
  ┌──────────────────────┐  prompt a small causal LM,
  │  1. GENERATE         │  sample it k times
  └──────────┬───────────┘  dozens of raw strings
             │
  ┌──────────▼───────────┐  drop multi-word output, punctuation,
  │  2. SANITISE         │  and the target word itself
  └──────────┬───────────┘  most of the junk goes here
             │
  ┌──────────▼───────────┐  spaCy: must be an adjective,
  │  3. POS + MORPHOLOGY │  must match the target's form
  └──────────┬───────────┘  a handful survive
             │
  ┌──────────▼───────────┐  cosine on e5-small-v2, or the
  │  4. RANK             │  LM's own log-prob in context
  └──────────┬───────────┘
             ▼
  brilliant, smart, gifted, clever, talented
```

Stage 3 is the one people skip and then regret. A generator asked to replace "aced" will
happily propose "ace", "acing" and "to pass". All three are semantically fine and all three
break the sentence. Filtering on part of speech and inflection before ranking costs almost
nothing and removes a whole category of embarrassing output.

The command line matches the diagram:

```bash
lexsub run \
  --sentence "The bright student aced the exam." \
  --target bright \
  --top_k 5 \
  --model llama3-mini
```

```json
["brilliant", "smart", "gifted", "clever", "talented"]
```

That output is the good case, kept from the README. `llama3-mini` is an alias in my own
registry rather than an upstream model name. Section 4 has the runs where the same setup
does badly.

`--model` takes an alias from `model_registry.yaml`, a Hugging Face repo id, or a path to a
local GGUF file. Adding a model is a two-line edit to the YAML, not a code change. That
mattered more than I expected: the point of the project is comparing generators, and anything
that adds friction to "try one more model" quietly stops you from doing it.

---

## 3. Two ways to rank, and why they disagree

Once you have a handful of legal candidates, something has to order them. LexSubLM-Lite ships
two rankers, and the difference between them is the most instructive part of the codebase.

```
  ┌─────────────────────────┬──────────────────────────────┐
  │ EMBEDDING RANKER        │ LOG-PROB RANKER              │
  ├─────────────────────────┼──────────────────────────────┤
  │ cosine between the      │ log P of the sentence with   │
  │ target and each         │ the candidate substituted    │
  │ candidate, e5-small-v2  │ in, from the LM itself       │
  │                         │                              │
  │ asks: is this a synonym │ asks: does this word fit     │
  │ in general?             │ in THIS slot?                │
  │                         │                              │
  │ one small forward pass  │ one forward pass PER         │
  │ for the whole batch     │ candidate                    │
  │                         │                              │
  │ blind to the sentence   │ rewards common words, so     │
  │                         │ "good" beats "gifted"        │
  └─────────────────────────┴──────────────────────────────┘
```

Neither is right on its own. The embedding ranker is context-blind, so in the lamp sentence it
is perfectly happy to promote "clever". The log-prob ranker is context-aware but has a
frequency bias baked into it: the most probable word in a slot is usually the most boring one,
which is exactly the wrong instinct for a task whose gold answers are the words a careful
human would choose.

What I would do now, and did not do then, is divide out each candidate's unconditional
probability to blunt the frequency bias, then combine that score with the embedding one, so
a candidate has to be both a plausible synonym and a plausible continuation. That is a
five-line change and I never ran the ablation, which is a fair thing to hold against the
project.

---

## 4. The numbers, and the honest reading of them

Here is what a sample run looked like, CPU only, on an M2 Pro. My notes do not record which
split it came from, which is the first thing wrong with it:

| Model       | RAM GB | P@1  | R@5  | Jaccard |
|-------------|--------|------|------|---------|
| tinyllama   | 0.8    | 0.20 | 0.04 | 0.04    |
| distilgpt2  | 1.1    | 0.10 | 0.05 | 0.08    |
| llama3-mini | 1.2    | 0.00 | 0.16 | 0.13    |

P@1 is how often the top suggestion was one a human annotator had accepted. R@5 is how much
of the annotators' list the top five covered. Jaccard is the overlap between the two sets.
Section 5 defines them properly.

Read that table properly, because the original version of this post did not.

These are terrible scores. A P@1 of 0.20 means that four times out of five, the single word
the system was most confident about was not one an annotator accepted. `llama3-mini` scored
**zero** on P@1 while scoring the best of the three on R@5 and Jaccard, which is not a
contradiction: it means its candidate *set* is the best of the three and its *ordering* is the
worst. The generator was finding good substitutes and the ranker was burying them.

That is a useful finding and it points at exactly one place to spend effort. It also says
something less comfortable: with models under 1.5 billion parameters, on CPU, in early 2025,
the ranker was not the only problem, and none of these configurations were close to usable in
a product.

Two caveats I should have printed next to the table from the start. First, this is a
smoke-test sample, not a leaderboard entry, and I never recorded how many instances it
covered, so the gap between 0.00 and 0.10 carries no weight on its own. Do not cite these
numbers as a model comparison. Second, I labelled the RAM column as the weight footprint, and
it cannot be: distilgpt2 has 82M parameters, a few hundred megabytes at most in fp32. Read
that column as process resident memory, and not to two digits.

The reason to publish them anyway is that "I ran it and it was bad" is a result, and the
harness that produced it is reusable. If your own generator beats 0.20 P@1 on a named
split with the same filters, you have learned something real.

---

## 5. Measuring it properly

Three datasets ship with download scripts, and they measure different things:

| Dataset | What it asks for | Splits |
|---|---|---|
| SWORDS (2021) | English substitution, human-rated candidates | dev, test |
| ProLex (2024) | substitutes that are also *more advanced* | dev, test |
| TSAR-2022 | lexical **simplification**, EN/ES/PT: *simpler* | test variants |

That third row is worth pausing on. TSAR-2022 is a simplification task, not a substitution
task, and its gold answers push in the opposite direction to ProLex's. A system tuned to score
well on one will score worse on the other by construction. Having both in the same harness is
a feature only if you remember which way each one pulls.

```bash
lexsub eval --dataset prolex --split dev --model distilgpt2
```

The metrics it prints:

- **P@1**: is my single best guess in the gold set? Strict, and the number that most reflects
  what a user experiences.
- **R@k**: of the gold substitutes, what fraction did my top-k cover? Measures the candidate
  pool.
- **Jaccard**: overlap between my top-k set and the gold set, as intersection over union.
  Punishes both misses and padding.
- **GAP**: generalised average precision. Rewards putting the substitutes that *most*
  annotators chose nearest the top, rather than treating all gold answers as equal.
- **ProF1**: ProLex's own F1, which only credits substitutes that are both appropriate and
  more advanced than the target.

The P@1-versus-R@k split is the same diagnostic I wrote about for search in
[retrieval metrics](/posts/2024/08/retrieval-metrics/): recall tells you whether the right
answer is anywhere in the bag, precision at 1 tells you whether your ordering can find it.
When recall is healthy and P@1 is not, fix the ranker. When both are low, fix the
generator. That single rule would have saved me a week.

---

## 6. Running it

```bash
git clone https://github.com/shamspias/lexsublm-lite
cd lexsublm-lite
pip install -e .
python -m spacy download en_core_web_sm
```

That spaCy model download is a step the original write-up left out, and without it stage 3
fails at import time. If you use `uv`, `uv pip install -e .` into a fresh
virtualenv on 3.11 or newer works the same way.

One correction to the original quick start, because it conflated two different things. GGUF
and `bitsandbytes` are **not** the same quantisation stack and you do not need both:

- **GGUF** is llama.cpp's format. The weights are quantised on disk, the inference runs in
  C++, and it is the right path on Apple silicon and on CPU generally. Point `--model` at a
  `.gguf` file and you are done.
- **`bitsandbytes`** quantises PyTorch weights at load time, and it is CUDA-first. Install it
  if you have an NVIDIA GPU and want to run Hugging Face checkpoints in 4-bit. It buys you
  nothing on a Mac.

The original post told macOS users to install `bitsandbytes` for "true 4-bit". That advice was
wrong when I wrote it.

The repo is MIT licensed. If you cite it:

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

## 7. What I would change in 2026

The project is more than a year old now and the ground has moved under it.

**The model registry is stale.** `Llama-3.2-1B`, `Qwen2.5-0.5B` and TinyLlama were reasonable
picks in April 2025. The current occupants of that size class, Qwen3's 0.6B and Gemma 3's
270M and 1B, are meaningfully better at instruction following at the same footprint.
Swapping the aliases in `model_registry.yaml` is the single highest-value hour anyone could
spend on this repo.

**The prompt should not be a completion prompt any more.** In 2025 the small models
worth running locally were base models, so the generator used a few-shot completion
prompt and stage 2 existed to clean up the mess. Small instruction-tuned models with
proper chat templates and constrained decoding are now normal. Asking for a JSON array
against a schema removes most of what stage 2 does, and removes an entire class of
parsing bug with it.

**`pymorphy3` is the wrong tool for English.** It is a Russian and Ukrainian morphological
analyser. It ended up in the dependency list because I had used it before, not because it
fitted. For English, spaCy's tagger plus `lemminflect` does inflection matching properly, and
drops a dependency that was never doing the job I thought it was.

**The generator is no longer the interesting part.** A 4B-class model running locally in 2026
handles this task well enough zero-shot that beating it with a 1B model is a curiosity rather
than a need. What has aged well is the other half: the dataset downloaders, the filter chain
you can switch off stage by stage, and the metric implementations. If I restarted the project
today I would describe it as an evaluation harness that happens to ship a baseline generator,
rather than a substitution tool that happens to ship metrics.

Still open from the original roadmap, in the order I would actually do them: combine the two
rankers, then multilingual TSAR-2022 evaluation, then a UI. LoRA fine-tuning is at the bottom
now, because a better prompt on a better base model gets most of the way there for none of the
work.

---

## 8. The short version

- Lexical substitution is a thesaurus that reads the sentence first: one candidate list per
  occurrence, not one per word.
- The pipeline is generate, sanitise, filter by part of speech and inflection, rank. Keep the
  stages separable so you can attribute every score change to one of them.
- Filter grammar *before* ranking. It is nearly free and it removes the most embarrassing
  outputs.
- The embedding ranker is context-blind, the log-prob ranker is frequency-biased. Combine
  them; neither is good alone.
- Sub-1.5B models on CPU scored badly, with good recall and poor P@1. That pattern names the
  ranker as the bottleneck, and that diagnosis is worth more than the scores.
- Treat the numbers in this post as a smoke test, not a benchmark. I did not record the
  sample size or the split, so a 0.00 there means nothing on its own.
- SWORDS, ProLex and TSAR-2022 pull in different directions: more accurate, more advanced, and
  simpler. Know which one you are optimising for.
- More than a year on, the durable part is the evaluation harness. The generator half needs
  a newer model registry and a chat-template prompt.
