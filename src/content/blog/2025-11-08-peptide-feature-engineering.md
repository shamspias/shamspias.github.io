---
title: "Turning a Peptide Into Numbers: A Tour of the Descriptor Zoo 🔢"
description: "AAC, DPC, DDE, CKSAAP, CTD, PAAC and QSO: every way I know to turn a sequence into a fixed-length vector, and what each one throws away."
date: 2025-11-08
permalink: "/posts/2025/11/peptide-feature-engineering/"
tags:
  - "bioinformatics"
  - "peptides"
  - "feature engineering"
  - "machine learning"
  - "computational biology"
series: "Machine Learning for Biology"
seriesOrder: 2
math: true
---

*Part 2 of the machine-learning-for-biology series. Models eat vectors; biology hands you
letters. Here's every way I know to bridge that gap, and what each one throws away.*

---

## 1. The problem, stated bluntly 🎯

You have this:

```
GLFDIIKKIAESF
```

You need this:

```
[0.077, 0.000, 0.077, 0.077, 0.154, 0.154, ...]
```

A **fixed-length numeric vector**. Fixed-length matters, because peptides come in different
sizes and almost every classifier wants the same number of columns for every row.

So the game is: *summarise a variable-length string of letters into a constant-length vector,
while throwing away as little useful information as possible.*

Every descriptor below is one answer to that. None of them is complete. That's why real systems
concatenate several. My anti-inflammatory peptide work ends up with about **2,282 hand-crafted
dimensions** before any deep learning is involved.

Let's build them up, easiest first.

---

## 2. AAC: just count the letters (20 dims) 🧮

**Amino Acid Composition.** The bag-of-words of biology.

$$
\text{AAC}_a = \frac{\text{count of amino acid } a}{L}
$$

where $L$ is the peptide length. Twenty numbers, each a fraction, summing to 1.

```python
AA = "ACDEFGHIKLMNPQRSTVWY"

def aac(seq):
    L = len(seq)
    return [seq.count(a) / L for a in AA]

print([round(x, 3) for x in aac("GLFDIIKKIAESF")])
```

```
[0.077, 0.0, 0.077, 0.077, 0.154, 0.077, 0.0, 0.231, 0.154,
 0.077, 0.0, 0.0, 0.0, 0.0, 0.0, 0.077, 0.0, 0.0, 0.0, 0.0]
```

**What it catches:** overall character. 23% isoleucine and 15% lysine says "greasy and
positively charged", which is a real, usable signal.

**What it destroys:** all order. `GLFDIIKKIAESF` and `FSEAIKKIIDFLG` have *identical* AAC. As we
saw in [part 1](/posts/2025/09/peptides-101/), those are different molecules with potentially
different behaviour.

Dividing by $L$ is what makes it length-independent, and also what makes a 6-residue and a
40-residue peptide look comparable when they may not be. Every descriptor is a trade like this.

---

## 3. DPC: count the pairs (400 dims) 👥

**Dipeptide Composition.** If single letters lose order, count *adjacent pairs*.

$$
\text{DPC}_{ab} = \frac{\text{count of the substring } ab}{L - 1}
$$

$20 \times 20 = 400$ possible pairs.

```python
def dpc(seq):
    pairs = [seq[i:i+2] for i in range(len(seq) - 1)]
    total = len(pairs)
    return [pairs.count(a + b) / total for a in AA for b in AA]
```

**What it catches:** local order. `KK` (two adjacent positives, a charge patch) is now a feature
in its own right, distinct from having a `K` here and a `K` five residues away.

**The catch:** sparsity. A 13-residue peptide has 12 dipeptides to spread across 400 slots.
**97% of your vector is zeros.** Tree ensembles cope with that reasonably well; distance-based
methods really don't.

You can go further. **TPC** (tripeptide composition) is $20^3 = 8{,}000$ dimensions, and on
short peptides it is almost pure noise. There's a reason people stop at dipeptides.

---

## 4. DDE: pairs, but fairly judged (400 dims) ⚖️

**Dipeptide Deviation from Expected mean.** The fix for DPC's biggest flaw.

DPC treats every pair equally. But some pairs are common *by accident*: leucine and alanine are
abundant amino acids, so `LA` shows up everywhere and tells you nothing. A rare pair appearing
is far more informative.

So compare observed frequency against what chance would predict, and standardise:

$$
\text{DDE}_{ab} = \frac{D_{ab} - T_{ab}}{\sqrt{V_{ab}}}
$$

- $D_{ab}$ is the observed dipeptide frequency (this is just DPC)
- $T_{ab}$ is the theoretical mean, from how many codons encode each amino acid
- $V_{ab}$ is the theoretical variance, which scales with $1/(L-1)$

This is TF-IDF's idea wearing a lab coat: **downweight what's common, amplify what's
surprising.** In our experiments DDE consistently outperformed raw DPC, which is exactly what
you'd hope.

---

## 5. CKSAAP: pairs at a distance (1,600 dims) 📏

**Composition of K-Spaced Amino Acid Pairs.** DPC only sees neighbours. But biology cares about
pairs that are *near* without touching.

```
K = 0    A·B        adjacent            (this is just DPC)
K = 1    A_B        one residue apart
K = 2    A__B       two apart
K = 3    A___B      three apart
```

$400$ pairs $\times$ $4$ gap sizes $= 1{,}600$ dimensions.

```python
def cksaap(seq, kmax=3):
    feats = []
    for k in range(kmax + 1):
        pairs = [seq[i] + seq[i + k + 1] for i in range(len(seq) - k - 1)]
        total = max(len(pairs), 1)
        feats += [pairs.count(a + b) / total for a in AA for b in AA]
    return feats
```

**Why the gaps matter so much:** an α-helix turns every **3.6 residues**. So residues at
positions $i$ and $i+3$ or $i+4$ sit on the *same face* of the helix. A helical peptide with a
greasy face has hydrophobic residues repeating at that spacing, and CKSAAP with $k=2$ and $k=3$
picks up exactly that pattern.

That's the general lesson worth internalising: **good sequence features are secretly structural
features.** Nobody handed the model a 3-D coordinate. The spacing statistics smuggled the helix
in through the back door.

---

## 6. CTD: group, then describe (147 dims) 🎨

**Composition–Transition–Distribution.** A change of strategy: stop thinking about twenty
letters and think about *properties*.

For each physicochemical property, bucket the twenty amino acids into three classes. For
hydrophobicity:

```
polar   : R K E D Q N
neutral : G A S T P H Y
hydro.  : C L V I M F W
```

Now `GLFDIIKKIAESF` becomes `2 3 3 1 3 3 1 1 3 2 1 2 3`, a 13-letter string over a 3-letter
alphabet. Then extract three things:

**Composition.** How much of each class? (3 numbers)

**Transition.** How often does the string switch between classes? (3 numbers: 1↔2, 1↔3, 2↔3).
This is an amphipathicity detector. A peptide with a distinct polar half and greasy half has
*few* transitions; one with alternating charges has many.

**Distribution.** Where along the sequence do you reach 0%, 25%, 50%, 75%, 100% of each class?
(5 × 3 = 15 numbers). This is what distinguishes "all the greasy residues clustered at the
N-terminus" from "greasy residues sprinkled evenly", two peptides that AAC calls identical.

Repeat across seven properties (hydrophobicity, van der Waals volume, polarity, polarisability,
charge, secondary-structure propensity, solvent accessibility) and you land at 147 dimensions.

**Why I like CTD:** it's the only cheap descriptor that captures *where* things are, not just
*how much*. And it's dense, with no 97%-zeros problem.

---

## 7. PAAC and QSO: order, without the explosion 🌀

Two descriptors that solve the same problem with different maths: keep some long-range order
without blowing up to thousands of dimensions.

**PAAC (Pseudo Amino Acid Composition, ~50 dims).** Take the 20 AAC values, then append
"correlation factors", a measure of how similar residues $i$ and $i+\lambda$ are in
physicochemical terms, averaged across the sequence, for $\lambda = 1, 2, \ldots$:

$$
\theta_\lambda = \frac{1}{L-\lambda}\sum_{i=1}^{L-\lambda} \Theta(R_i, R_{i+\lambda})
$$

So: composition, plus a compact summary of how properties repeat at each spacing. Thirty extra
numbers instead of sixteen hundred.

**QSO (Quasi-Sequence Order, ~80 dims).** Same instinct, but weighted by a physicochemical
*distance matrix* between amino acid pairs, so "how different are the residues $d$ apart" enters
directly.

**Autocorrelation (Moran, Geary, Moreau–Broto, ~96 dims).** The same idea again, borrowed
wholesale from spatial statistics. Given a property value per residue, how correlated is the
property with itself at lag $d$?

Three families, one underlying question: *does this property repeat with a period?* Which,
again, is a structural question in sequence clothing.

---

## 8. Stack them all 🥞

Here's the full hand-crafted set from our anti-inflammatory peptide work:

| Descriptor | Dims | Captures | Blind to |
|---|---|---|---|
| AAC | 20 | overall composition | all order |
| DPC | 400 | adjacent pairs | anything non-adjacent |
| DDE | 400 | *surprising* adjacent pairs | non-adjacent |
| CKSAAP | 1,600 | pairs at 0–3 gaps | longer range |
| CTD | 147 | property classes + position | exact identity |
| PAAC | 50 | composition + periodicity | fine detail |
| QSO | 80 | distance-weighted order | fine detail |
| Autocorrelation | 96 | property periodicity | identity |
| Physicochemical | 20 | global properties (charge, GRAVY, pI…) | everything local |
| **Total** | **~2,282** | | |

```python
import numpy as np

def featurize(seq):
    return np.concatenate([
        aac(seq), dpc(seq), dde(seq), cksaap(seq),
        ctd(seq), paac(seq), qso(seq), autocorr(seq), physchem(seq),
    ])

X = np.vstack([featurize(s) for s in sequences])
print(X.shape)      # (n_peptides, 2282)
```

**2,282 features. And here's the uncomfortable number: our training set has a few thousand
peptides.** Roughly as many features as examples.

That's a textbook overfitting setup, and you have to design around it rather than hope:

- **Correlated blocks.** DPC and DDE and CKSAAP($k{=}0$) are near-duplicates of each other. Tree
  ensembles handle this gracefully; linear models get unstable coefficients.
- **Feature selection helps**, but must be fitted *inside* your cross-validation folds. Select
  features on the full dataset and your reported score is fiction. This mistake is extremely
  common in published bioinformatics code, and it always inflates results.
- **Regularise hard,** and prefer ensembles over single deep models at this scale.

---

## 9. Does the letter-counting still matter? 🤨

Reasonable question in 2025: protein language models exist. Why hand-craft anything?

Our own numbers, from 5-fold cross-validation:

| Feature set | Dims | Accuracy | MCC |
|---|---|---|---|
| Hand-crafted only | 2,282 | 82.0% ± 1.5% | 0.62 ± 0.03 |
| ESM-2 embeddings only | 1,280 | 80.5% ± 1.8% | 0.60 ± 0.04 |
| **Both concatenated** | **3,562** | **82.2% ± 1.4%** | **0.63 ± 0.03** |

Read that carefully, because it's more interesting than a win.

The 650-million-parameter protein language model **did not beat** twenty lines of letter
counting. And combining them gained about **0.2 percentage points**, comfortably inside the
error bars.

Three honest reasons why:

1. **Peptides are short.** Language models earn their keep on long-range context. A 15-residue
   peptide has very little long range to model.
2. **The dataset is small.** A few thousand examples cannot exploit 1,280 rich dimensions much
   better than 2,282 crude ones.
3. **Hand-crafted features already encode the right inductive bias.** CKSAAP's gap structure
   *is* helical periodicity. We told the model where to look; ESM-2 had to infer it.

So: hand-crafted descriptors are not legacy baggage. On short sequences with small datasets they
remain a strong, cheap, interpretable baseline, and "cheap and interpretable" is worth real
money when you have to defend a result to a reviewer.

That said, ESM-2 brings something the counts genuinely cannot, and it's worth its own post.

---

## 10. The short version 📝

- The whole task: **variable-length string → fixed-length vector**, losing as little as possible.
- **AAC** counts letters and destroys order. **DPC/DDE** recover local order. **CKSAAP** recovers
  order at a distance. **CTD** captures position and property. **PAAC/QSO/autocorrelation**
  capture periodicity cheaply.
- Good sequence features are **structural features in disguise**. CKSAAP's 3–4 residue gaps are
  an α-helix detector.
- Stacking everything gives ~2,282 dims against a few thousand samples. Regularise, use
  ensembles, and **fit feature selection inside your CV folds** or your numbers are fiction.
- A protein language model did **not** beat letter counting on our short-peptide task. Know why
  before you reach for the big model.

---

*Series: **Machine Learning for Biology**. Next up, [what ESM-2 actually learned](/posts/2026/01/protein-language-models/),
and when a protein language model is worth its weight.*
