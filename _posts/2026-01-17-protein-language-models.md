---
title: "What ESM-2 Learned That Letter-Counting Couldn't 🧬"
date: 2026-01-17
permalink: /posts/2026/01/protein-language-models/
tags:
  - bioinformatics
  - protein language models
  - ESM-2
  - embeddings
  - transfer learning
  - machine learning
math: true
---

*Part 3 of the machine-learning-for-biology series. A 650-million-parameter model trained on
250 million protein sequences, and what happens when you point it at a 13-residue peptide.*

---

## 1. The same trick, different corpus 📚

If you've read anything about how BERT was trained, you already understand ESM-2.

Take a huge corpus. Hide some tokens. Ask the model to guess them. Repeat a few hundred billion
times. No labels, no annotations, just the text predicting itself.

```
English (BERT):
    "The cat sat on the [MASK]"                    -> "mat"

Protein (ESM-2):
    "M K T A Y I A K Q R Q I S F [MASK] K S H"     -> "V"
```

To fill in that blank correctly, a model has to learn what makes a *plausible* protein.
Which residues co-occur. Which positions tolerate substitution and which don't. Which patterns
recur across families. Nobody told it about α-helices or binding pockets, yet you cannot get
good at this game without internalising something that behaves a great deal like structural
knowledge.

**ESM-2** (Meta's Evolutionary Scale Modeling, v2) is that idea at scale: a transformer trained
on ~250 million sequences from UniRef. It comes in sizes from 8M to 15B parameters. The workhorse
for most applied work is the 650M model, which produces **1,280-dimensional** per-residue
representations.

---

## 2. Getting embeddings out 🔌

The mechanics are unglamorous, which is the point.

```python
import torch, esm

model, alphabet = esm.pretrained.esm2_t33_650M_UR50D()
batch_converter = alphabet.get_batch_converter()
model.eval()

data = [("peptide_1", "GLFDIIKKIAESF")]
_, _, tokens = batch_converter(data)

with torch.no_grad():
    out = model(tokens, repr_layers=[33])

# per-residue representations: (batch, seq_len, 1280)
reps = out["representations"][33]

# strip BOS/EOS, then mean-pool to one vector per peptide
emb = reps[0, 1:len(data[0][1]) + 1].mean(0)
print(emb.shape)        # torch.Size([1280])
```

Two decisions in there deserve more attention than they usually get.

**Which layer?** The last layer is specialised for the masked-token task. Middle-to-late layers
are often more transferable, since the classic finding from NLP holds here too. Layer 33 of 33
works; so does layer 30. It's worth a sweep rather than an assumption.

**How to pool?** You have `(length, 1280)` and you need `(1280,)`.

| Pooling | Behaviour |
|---|---|
| **Mean** | Sturdy default. Averages away positional information. |
| **Max** | Catches "is there *any* strongly X residue" |
| **CLS / BOS token** | Cheap, and often weaker than mean for short sequences |
| **Concatenate mean + max** | 2,560 dims, small but real gain in our runs |
| **No pooling** | Keep all residues, feed a CNN or attention head on top |

For peptides, mean-pooling is remarkably hard to beat. Sequences are short, so there isn't much
positional signal for the pooling to lose in the first place.

---

## 3. What it actually knows 🔍

The claim "it learned structure without being told" deserves evidence rather than assertion.
Three lines of evidence I find persuasive:

**Attention maps recover contact maps.** Certain attention heads light up precisely on residue
pairs that sit close together in the folded 3-D structure. The model was never shown a
structure. It inferred spatial proximity from co-variation in sequences, the same signal
evolutionary biologists have exploited for decades, learned automatically.

**Embedding space organises by function.** Project embeddings down to two dimensions and
proteins cluster by family and function, even across sequences too dissimilar for standard
alignment tools to relate.

**Mutation effects fall out for free.** The change in log-likelihood when you substitute one
residue correlates with measured fitness effects. A model trained only to fill in blanks turns
out to be a usable zero-shot variant-effect predictor.

That's genuine transfer learning: knowledge from an unlabelled corpus, reusable on tasks it was
never trained for.

---

## 4. So does it help on peptides? 🎯

Here's where it gets interesting, and where I'd rather report an inconvenient result than a
tidy one.

Our anti-inflammatory peptide task, 5-fold cross-validation:

| Feature set | Dims | Accuracy | MCC | AUC |
|---|---|---|---|---|
| Hand-crafted descriptors | 2,282 | 82.0% ± 1.5% | 0.62 ± 0.03 | 0.84 |
| ESM-2 embeddings | 1,280 | 80.5% ± 1.8% | 0.60 ± 0.04 | 0.82 |
| **Both concatenated** | **3,562** | **82.2% ± 1.4%** | **0.63 ± 0.03** | **0.85** |

The 650-million-parameter protein language model **lost** to the twenty lines of letter counting
from [part 2](/posts/2025/11/peptide-feature-engineering/). Concatenating them gained about
0.2 percentage points, which is inside the error bars.

If you've only read papers, this is not what you expect. Let me give the honest reasons.

**Peptides are short.** Transformers earn their advantage on long-range dependencies. A
13-residue peptide has almost no long range. You're paying for a mechanism the problem doesn't
need.

**ESM-2's training distribution is proteins, not peptides.** UniRef is full-length proteins,
typically hundreds of residues. A 13-mer is out-of-distribution: a short, unusual fragment. The
model handles it, but it isn't home turf.

**The dataset is small.** With a few thousand labelled examples, 1,280 rich dimensions don't buy
much over 2,282 crude ones. Both are in the regime where the *data* is the ceiling, not the
representation.

**Hand-crafted features encode the right prior.** As I argued in part 2, CKSAAP's 3–4 residue
gap statistics *are* a helical-periodicity detector. We handed the model the answer to "where
should I look". ESM-2 had to work it out from scratch, on a sequence too short to reveal much.

---

## 5. When it *is* worth it ✅

None of the above means "skip protein language models". It means know which regime you're in.

| Your situation | Reach for |
|---|---|
| Sequences < 30 residues | Hand-crafted descriptors first |
| Sequences > 100 residues | ESM-2, clearly |
| A few hundred labels | ESM-2 + a linear head (best few-shot behaviour) |
| Tens of thousands of labels | Either, or fine-tune |
| Need to explain features to a reviewer | Hand-crafted |
| Need mutation-effect prediction | ESM-2, essentially free |
| Novel family, no homologs | ESM-2; it generalises where alignment fails |
| CPU-only inference budget | Hand-crafted (ESM-2 wants a GPU) |

The row I'd underline is **"a few hundred labels"**. This is where pretrained embeddings shine
hardest: a frozen backbone plus a small linear head is astonishingly data-efficient. It's the
same principle behind the DINOv2 linear probe I use for crop-disease detection: freeze a general
representation, train a tiny head on the labels you actually have.

```python
from sklearn.linear_model import LogisticRegression

# 200 labelled examples, 1,280-dim frozen embeddings
clf = LogisticRegression(max_iter=2000, C=0.1).fit(X_esm, y)
```

That's the whole model. With 200 examples it will frequently beat anything you train end-to-end,
because end-to-end training on 200 examples is mostly memorisation.

---

## 6. Combining them without fooling yourself 🥞

Naive concatenation is a trap: 2,282 sparse hand-crafted dims plus 1,280 dense embedding dims,
on very different scales, all thrown into one model. The dense block quietly dominates distance
computations, and any per-block signal gets muddied.

The **two-stage stacking ensemble** we ended up with treats them as separate views:

```
STAGE 1 · base learners, each on its own view
   ┌────────────────────────────┐
   │ hand-crafted (2,282 dims)  │──► XGBoost   ──► p₁
   │                            │──► RandomFor.──► p₂
   │                            │──► SVM (RBF) ──► p₃
   ├────────────────────────────┤
   │ ESM-2 (1,280 dims)         │──► LogisticR.──► p₄
   │                            │──► MLP       ──► p₅
   └────────────────────────────┘
                                        │
STAGE 2 · meta learner                  ▼
             logistic regression on [p₁ … p₅] ──► final probability
```

Why this shape:

- **Each base learner sees the representation it's suited to.** Trees are good on sparse
  count features; linear models and MLPs are good on dense embeddings.
- **The meta-learner learns whom to trust, per region of the space.** It can discover that the
  embedding models are more reliable on unusual sequences and the count models on typical ones.
- **Scale mismatch disappears.** Stage 2 only ever sees probabilities in $[0,1]$.

And the discipline that makes or breaks it:

```python
from sklearn.model_selection import StratifiedKFold

# Base-learner predictions for the meta-learner MUST be out-of-fold.
oof = np.zeros((len(y), n_base))
for tr, va in StratifiedKFold(5, shuffle=True, random_state=42).split(X, y):
    for j, m in enumerate(base_models):
        m.fit(X[tr], y[tr])
        oof[va, j] = m.predict_proba(X[va])[:, 1]

meta.fit(oof, y)
```

If you train the meta-learner on in-fold predictions, the base learners look near-perfect on
data they memorised, the meta-learner learns to trust them blindly, and your cross-validation
score becomes a work of fiction. This is the most common serious bug in stacking code, and it
always flatters you.

---

## 7. Cost, honestly 💰

| | Hand-crafted | ESM-2 650M |
|---|---|---|
| Feature extraction, 10k peptides | ~30 s, CPU | ~4 min, GPU |
| Hardware needed | a laptop | ≥8 GB VRAM (or slow CPU) |
| Model size on disk | 0 | ~2.5 GB |
| Reproducible in five years? | yes, it's arithmetic | depends on the weights surviving |
| Explainable to a reviewer | "dipeptide frequency" | "dimension 847" |

That last row is not a joke. When a reviewer asks *which features drive your prediction*, "the
frequency of adjacent lysine pairs" is an answer that advances the science. "Dimension 847 of a
frozen transformer" is not.

---

## 8. The short version 📝

- ESM-2 is masked-language modelling on 250M protein sequences. Structure emerges from the
  objective without ever being supervised.
- Mean-pool per-residue representations; try a middle-to-late layer, not reflexively the last.
- **On short peptides with a small dataset, hand-crafted descriptors beat a 650M-parameter
  protein language model in our experiments.** Length and data size decide this, not hype.
- Protein language models win on **long sequences**, **few labels**, **novel families**, and
  **mutation effects**.
- Combine views with **stacking**, not concatenation, and generate the meta-learner's inputs
  **out-of-fold** or your score is fiction.

---

*Series: **Machine Learning for Biology**. Next up, the post I most want people to read:
[why your choice of negatives decides your accuracy](/posts/2026/02/honest-negatives-peptide-benchmark/)
before your model does.*
