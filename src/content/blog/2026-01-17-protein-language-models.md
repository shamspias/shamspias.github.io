---
title: "What ESM-2 Learned That Letter-Counting Couldn't"
description: "A 650-million-parameter protein language model, what its embeddings really encode, and why twenty lines of letter counting still beat it on 13-residue peptides."
date: 2026-01-17
permalink: "/posts/2026/01/protein-language-models/"
tags:
  - "bioinformatics"
  - "protein language models"
  - "ESM-2"
  - "embeddings"
  - "transfer learning"
  - "machine learning"
series: "Machine Learning for Biology"
seriesOrder: 3
math: true
---

*Part 3 of the machine-learning-for-biology series. A 650-million-parameter model that learned
protein structure by filling in blanks, and what happened when I pointed it at a 13-residue
peptide.*

---

## 1. The same trick, a different corpus

If you have read anything about how BERT was trained, you already understand ESM-2.

Take an enormous corpus. Hide some tokens. Ask the model to guess them. Repeat a few hundred
billion times. No labels, no annotations, no expert curation: the text supervises itself.

```
English text (BERT)
  "the cat sat on the [MASK]"                -> "mat"  vocab ~30,000

Protein sequence (ESM-2)
  "M K T A Y I A K Q R Q I S F [MASK] K S H" -> "V"    vocab 20 + 5
```

The alphabet is smaller, twenty amino acids plus five special tokens against BERT's thirty
thousand word pieces, but the game is identical. To fill that blank in correctly, a model has
to learn what makes a *plausible* protein. Which residues (the individual amino acids, one
letter each) co-occur. Which positions tolerate substitution and which never do. Which motifs
recur across families. Nobody mentions α-helices or binding pockets, yet you cannot get good
at this game without internalising something that behaves a great deal like structural
knowledge.

ESM-2 (Meta's Evolutionary Scale Modeling, version 2, published 2022) is that idea at scale: a
transformer encoder trained on UniRef. UniRef is the standard clustered catalogue of known
protein sequences: UniRef50 groups anything at least 50% identical into a single cluster,
UniRef90 does the same at 90%, and ESM-2 trains on the UniRef50 representatives while sampling
from their UniRef90 members, on the order of 65 million unique sequences. It ships in sizes
from 8M to 15B parameters. The workhorse for applied work is the 650M model,
`esm2_t33_650M_UR50D`: 33 layers, 1,280-dimensional per-residue representations.

One correction while I am here, because I have repeated the error myself and so has half the
internet. The famous "250 million protein sequences" figure belongs to the *first* ESM paper
(Rives et al., 2021), which trained on UniParc. ESM-2 deliberately trained on fewer, better
deduplicated sequences. More data was not the upgrade; scale and clustering discipline were.

---

## 2. Getting embeddings out

The mechanics are unglamorous, which is the point. What matters is the shape at each step.

```
"GLFDIIKKIAESF"                                 13 residues
        │
        ▼   tokeniser: prepend <cls>, append <eos>
   [0, 6, 4, 18, ... , 2]                       (1, 15)
        │
        ▼   33 transformer blocks, 650M parameters
   per-residue representations                  (1, 15, 1280)
        │
        ▼   drop <cls>/<eos>, mean over length
   one vector per peptide                       (1280,)
        │
        ▼   logistic regression, XGBoost, whatever
   p(anti-inflammatory)                         scalar
```

In 2022 everyone used Meta's `fair-esm` package. It still runs, but it has had no meaningful
maintenance for years, and Meta's protein team left to found EvolutionaryScale. The path I
would take today is Hugging Face `transformers`, which carries the same weights and is
actually kept alive against new PyTorch releases.

```python
import torch
from transformers import AutoTokenizer, EsmModel

name = "facebook/esm2_t33_650M_UR50D"
tok = AutoTokenizer.from_pretrained(name)
model = EsmModel.from_pretrained(name).eval()

batch = tok(["GLFDIIKKIAESF", "KRIVQRIKDFLR"], padding=True, return_tensors="pt")

with torch.no_grad():
    out = model(**batch, output_hidden_states=True)

h = out.hidden_states[33]                    # (batch, seq_len, 1280)

# The attention mask covers <cls> and <eos> too, and both are noise for pooling.
mask = batch["attention_mask"].clone()
lengths = mask.sum(1)
mask[:, 0] = 0
mask[torch.arange(len(mask)), lengths - 1] = 0

mask = mask.unsqueeze(-1)
emb = (h * mask).sum(1) / mask.sum(1)        # (batch, 1280)
```

Two decisions in there deserve more attention than they usually get.

**Which layer?** The last layer is specialised for the masked-token task, and the classic NLP
finding holds here too: middle-to-late layers are often more transferable. Layer 33 of 33
works, layer 30 often works slightly better, and it costs one loop to find out. One trap when
you sweep: ESM applies its final layer norm only on the way out, so `hidden_states[33]` is
normalised and `hidden_states[30]` is not. Standardise your features before a linear model or
you will conclude that the middle layers are bad when what you measured was their scale.

**How do you pool?** You have `(length, 1280)` and you need `(1280,)`.

| Pooling | Behaviour |
|---|---|
| Mean | Sturdy default. Averages positional information away. |
| Max | Catches "is there *any* strongly hydrophobic residue at all" |
| CLS token | Cheap, and usually weaker than mean on short sequences |
| Mean and max concatenated | 2,560 dims, a small but real gain in my runs |
| No pooling | Keep all residues, put a CNN or attention head on top |

For peptides, mean-pooling is hard to beat. The sequences are short, so there is not much
positional signal for the pooling to destroy in the first place.

---

## 3. What it actually learned

"It learned structure without being told" deserves evidence rather than assertion. Three
results persuade me.

**Attention maps recover contact maps.** Specific attention heads light up on exactly the
residue pairs that sit close together in the folded 3-D structure (Rao et al., 2021). The
model was never shown a structure. It inferred spatial proximity from co-variation across
sequences, which is the same signal evolutionary biologists have mined by hand for decades,
except learned automatically. If attention is still a black box to you, I unpacked
the mechanism in
[transformers and attention made simple](/posts/2022/06/transformers-attention-made-simple/).

**Embedding space organises by function.** Project the embeddings to two dimensions and
proteins cluster by family and function, including across pairs too dissimilar for alignment
tools to relate at all.

**Mutation effects fall out for free.** Score a variant by the change in log-likelihood at the
mutated position, $\log p(x_{\text{mut}}) - \log p(x_{\text{wt}})$, and the result correlates
with measured fitness effects across a large collection of deep mutational scanning
experiments, the assays that measure thousands of single mutations in one go. A model trained
only to fill in blanks turns out to be a usable zero-shot variant-effect predictor.

That is genuine transfer learning: knowledge extracted from an unlabelled corpus, reusable on
tasks nobody trained for.

---

## 4. So does it help on peptides?

Here is where it gets interesting, and where I would rather report the inconvenient result
than the tidy one.

My anti-inflammatory peptide task, 5-fold cross-validation, same folds and same classifiers
throughout. MCC is the Matthews correlation coefficient: 1 is perfect, 0 is chance. I lead with
it because accuracy flatters any test set that is not balanced.

| Feature set | Dims | Accuracy | MCC |
|---|---|---|---|
| Hand-crafted descriptors | 2,282 | 82.0% ± 1.5% | 0.62 ± 0.03 |
| ESM-2 650M embeddings | 1,280 | 80.5% ± 1.8% | 0.60 ± 0.04 |
| Both concatenated | 3,562 | 82.2% ± 1.4% | 0.63 ± 0.03 |

The 650-million-parameter protein language model lost to the twenty lines of letter counting
from [part 2](/posts/2025/11/peptide-feature-engineering/). Concatenating the two gained
about 0.2 percentage points, comfortably inside the error bars.

Two caveats before anyone quotes this at a conference. These are frozen embeddings with a
classical head, not a fine-tuned ESM-2. And the descriptor set had months of my attention on
this exact problem, while ESM-2 was used off the shelf. The comparison is honest about what
most people actually do, not about the best achievable number.

The reasons for the result, though, are structural, and they generalise.

**Peptides are short.** Transformers earn their advantage on long-range dependencies. A
13-residue peptide has almost no long range to model. You are paying for a mechanism the
problem does not need.

**ESM-2's training distribution is proteins, not peptides.** UniRef is full-length proteins,
typically hundreds of residues. A 13-mer looks like a truncated fragment, which is out of
distribution. The model copes, but this is not home turf.

**The dataset is small.** With a few thousand labelled examples, 1,280 rich dimensions do not
buy much over 2,282 crude ones. Both sit in the regime where the *data* is the ceiling, not
the representation.

**Hand-crafted features encode the right prior.** As I argued in part 2, CKSAAP counts residue
pairs separated by k positions, so its 3–4 gap statistics *are* a helical-periodicity
detector. I handed the model the answer to "where should I look". ESM-2 had to work that out
from scratch, from a sequence too short to reveal much.

---

## 5. When it is worth it

None of the above means "skip protein language models". It means know which regime you are in.

```
                 how long are the sequences?
            ┌─────────────────┴──────────────────┐
       under 30 aa                          over 100 aa
            │                                    │
    how many labels?                        protein LM, clearly:
    ┌───────┴─────────┐                     alignment-free and
under 500        over 2,000                 structure-aware
    │                 │
frozen LM +      hand-crafted
linear head      descriptors first
(best few-shot)  (cheap, explainable)
```

The branch I would underline is "under 500 labels". This is where pretrained embeddings shine
hardest: a frozen backbone plus a small linear head is astonishingly data-efficient. It is the
same principle as the DINOv2 linear probe I use for
[crop disease from the sky](/posts/2026/07/crop-disease-from-the-sky/): freeze a general
representation, train a tiny head on the labels you actually have.

```python
from sklearn.linear_model import LogisticRegression

# 200 labelled examples against 1,280 frozen dims: regularise hard.
clf = LogisticRegression(max_iter=2000, C=0.1).fit(X_esm, y)
```

That is the whole model. With 200 examples it will frequently beat anything you train end to
end, because end-to-end training on 200 examples is mostly memorisation.

A few other situations where the embeddings win outright, regardless of length: you need
mutation-effect scores (essentially free), you are working in a novel family with no usable
homologs (no known relatives to align against), or you need to compare sequences that
alignment tools refuse to align. And a few where they lose outright: CPU-only inference
budgets, and any setting where you have to explain to a reviewer which features drove the
prediction.

---

## 6. Where the field went after ESM-2

ESM-2 is three and a half years old now, which in this field is a long time. What has changed
since:

- **ESM-3** (EvolutionaryScale, 2024) is generative and multimodal: sequence, structure and
  function tokens in one model, so you can condition on any of them and sample the rest. An
  open-weights 1.4B version exists under a restrictive licence. Read the licence before you
  plan a product around it.
- **ESM C** (Cambrian, late 2024) is the direct successor to the ESM-2 embedding use case. The
  300M and 600M models are drop-in replacements that match or beat ESM-2 650M at similar or
  lower cost. If you are starting a new representation-learning project today, benchmark ESM C
  first.
- **Structure prediction moved on.** ESMFold was the headline application of ESM-2; for actual
  structures most people now reach for an AlphaFold-family or Boltz-family model instead.
- **Fine-tuning got cheap.** LoRA (train a pair of small low-rank matrices per weight and
  leave the rest frozen) on a 650M encoder fits on a single consumer GPU. That changes the
  calculus above once you have a few thousand labels, though on my peptide dataset it mostly
  found new ways to overfit.

None of that rescues the peptide result in section 4. A better backbone still does not fix a
13-residue sequence, a few thousand labels, and a task whose signal is periodic
hydrophobicity.

---

## 7. Combining views without fooling yourself

Naive concatenation is a trap: 2,282 sparse count features plus 1,280 dense embedding
features, on wildly different scales, thrown into one model. The dense block quietly dominates
any distance computation, and per-block signal gets muddied.

The two-stage stacking ensemble I ended up with treats them as separate views.

```
STAGE 1  base learners, each on the view that suits it
   ┌────────────────────────────┐
   │ hand-crafted (2,282 dims)  │──► XGBoost      ──► p1
   │ sparse counts              │──► RandomForest ──► p2
   │                            │──► SVM (RBF)    ──► p3
   ├────────────────────────────┤
   │ ESM-2 (1,280 dims)         │──► LogisticReg  ──► p4
   │ dense, correlated          │──► small MLP    ──► p5
   └────────────────────────────┘                     │
                                                      ▼
STAGE 2  meta learner: logistic regression on [p1..p5]
                                                      │
                                                      ▼
                                              final probability
```

Why this shape:

- **Each base learner sees the representation it suits.** Trees are good on sparse count
  features; linear models and MLPs are good on dense correlated embeddings.
- **The meta-learner learns whom to trust, per region of the space.** It can discover that the
  embedding models are more reliable on unusual sequences and the count models on typical
  ones.
- **The scale mismatch disappears.** Stage 2 only ever sees probabilities in $[0,1]$.

And the discipline that makes or breaks it:

```python
import numpy as np
from sklearn.model_selection import StratifiedKFold

# Meta-learner inputs must be out-of-fold, or stage 2 learns from memorised answers.
# Each base learner keeps its own view; only the fold indices are shared.
oof = np.zeros((len(y), len(base_models)))
for tr, va in StratifiedKFold(5, shuffle=True, random_state=42).split(X_hand, y):
    for j, (m, X) in enumerate(zip(base_models, views)):
        m.fit(X[tr], y[tr])
        oof[va, j] = m.predict_proba(X[va])[:, 1]

meta.fit(oof, y)
```

Train the meta-learner on in-fold predictions instead and the base learners look near-perfect
on data they memorised, the meta-learner learns to trust them blindly, and your
cross-validation score becomes a work of fiction. This is the most common serious bug in
stacking code, and it always flatters you, which is why it survives review.

---

## 8. Cost, honestly

| | Hand-crafted | ESM-2 650M |
|---|---|---|
| Features for 10k peptides | about 30 s on a laptop CPU | a few minutes on a GPU |
| Hardware needed | a laptop | 8 GB VRAM or a lot of patience |
| Weights on disk | none | about 2.5 GB |
| Reproducible in five years | yes, it is arithmetic | only if the weights survive |
| Explainable to a reviewer | "dipeptide frequency" | "dimension 847" |

That last row is not a joke. When a reviewer asks which features drive the prediction, "the
frequency of adjacent lysine pairs" is an answer that advances the science. "Dimension 847 of
a frozen transformer" is not. On a bench-facing project, that difference is worth a point or
two of accuracy.

---

## 9. The short version

- ESM-2 is masked-language modelling on UniRef. Structure emerges from the objective without
  ever being supervised, which is the whole reason it transfers.
- The "250 million sequences" figure is from the earlier ESM paper. ESM-2 trained on roughly
  65 million deduplicated UniRef sequences.
- Use Hugging Face `transformers` rather than `fair-esm`, mean-pool the per-residue outputs,
  and sweep a middle-to-late layer instead of reflexively taking the last one.
- On short peptides with a small dataset, hand-crafted descriptors beat frozen ESM-2
  embeddings in my experiments. Sequence length and label count decide this, not hype.
- Protein language models win on long sequences, few labels, novel families and mutation
  effects.
- Benchmark ESM C before ESM-2 on any new embedding project, and read the ESM-3 licence before
  building on it.
- Combine views by stacking, not concatenation, and generate the meta-learner's inputs out of
  fold, or your score is fiction.

---

*Series: **Machine Learning for Biology**. Next up, the post I most want people to read:
[why your choice of negatives decides your accuracy](/posts/2026/02/honest-negatives-peptide-benchmark/)
before your model does.*
