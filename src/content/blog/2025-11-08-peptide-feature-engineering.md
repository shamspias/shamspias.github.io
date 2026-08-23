---
title: "Turning a Peptide Into Numbers: A Tour of the Descriptor Zoo"
description: "AAC, DPC, DDE, CKSAAP, CTD, PAAC and QSO: every way I know to turn a peptide into a fixed-length vector, and what each one throws away."
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
letters. Here is every way I know to bridge that gap, what each descriptor throws away, and the
column count I quoted for a year before I checked that it added up.*

---

## 1. The problem, stated bluntly

You have this:

```
GLFDIIKKIAESF
```

Thirteen letters, one per amino acid, which is how biology writes a short peptide down.

You need this:

```
[0.077, 0.000, 0.077, 0.077, 0.154, 0.077, ...]
```

A fixed-length numeric vector. Fixed-length matters because peptides come in different sizes and
almost every classifier wants the same number of columns in every row. A gradient-boosted tree
cannot be handed thirteen features for one molecule and forty-one for the next.

This is not a biology problem. It is the same problem a spam filter has: turn a document of any
length into a vector of fixed width. Bag-of-words was the first answer there, and the first
descriptor below is literally bag-of-words with a twenty-letter vocabulary.

```
   ragged input          descriptor stack      rectangular output
   ────────────          ────────────────      ──────────────────

   GLFDIIKKIAESF    ┐                        ┌ 0.077 0.000 0.077 ...
   KWKLFKKIEKVGQ    │    AAC   DPC   DDE     │ 0.000 0.000 0.000 ...
   ACSAG            ┤──► CKSAAP    CTD       ├ 0.400 0.200 0.000 ...
   RRWQWRMKKLGAPS   │    PAAC  QSO  autocorr │ 0.071 0.000 0.000 ...
   GIGKFLHSAKKFGK   ┘                        └ 0.071 0.000 0.000 ...

   5 to 50 letters       concatenated          every row 2,813 wide
                                               first three columns shown
```

Two escape hatches exist, and I will name them once so nobody thinks I forgot. You can pad or
truncate every peptide to a fixed length and feed a convolutional network. You can use an
architecture that eats variable-length input directly, which is what a protein language model
does. Both are real options and I use the second one in
[part 3](/posts/2026/01/protein-language-models/). Both want more labelled data than I have.
This post is about the third route, which is to summarise.

So the game is: compress a variable-length string of letters into a constant-length vector while
throwing away as little useful information as possible. Every descriptor below is one answer.
None of them is complete, which is why real systems concatenate several.

---

## 2. AAC: just count the letters (20 dims)

Amino Acid Composition. The bag-of-words of biology.

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

What it catches: overall character. 23% isoleucine and 15% lysine says "greasy and positively
charged", which is a real, usable signal, and as [part 1](/posts/2025/09/peptides-101/) argued,
that profile is most of what makes a membrane-interacting peptide work.

What it destroys: all order. `GLFDIIKKIAESF` and `FSEAIKKIIDFLG` have identical AAC. They are
different molecules with potentially different behaviour, and AAC cannot tell them apart at all.

Dividing by $L$ is what makes the vector length-independent, and it is also what makes a
6-residue and a 40-residue peptide look comparable when they may not be. If length itself
matters for your task, add it back as its own feature, because AAC has just deleted it.

Every descriptor is a trade like this. It is worth naming the trade each time.

---

## 3. DPC: count the pairs (400 dims)

Dipeptide Composition. If single letters lose order, count adjacent pairs instead.

$$
\text{DPC}_{ab} = \frac{\text{count of the substring } ab}{L - 1}
$$

There are $20 \times 20 = 400$ possible pairs.

```python
from collections import Counter

PAIRS = [a + b for a in AA for b in AA]

def dpc(seq):
    n = len(seq) - 1
    # Counter beats seq.count() in a 400-wide comprehension: one pass over
    # the sequence instead of 400. It matters at 400k molecules.
    counts = Counter(seq[i:i + 2] for i in range(n))
    return [counts[p] / n for p in PAIRS]
```

What it catches: local order. `KK`, two adjacent positive charges forming a charge patch, is now
a feature in its own right, distinct from having a `K` here and a `K` five residues away.

The catch is sparsity. A 13-residue peptide has 12 dipeptides to spread across 400 slots, so 97%
of the row is zero. Tree ensembles cope with that reasonably well, because a split on a
mostly-zero column is still a valid split. Distance-based methods really do not: in a
400-dimensional space where almost every coordinate is zero, every pair of peptides is roughly
equidistant.

You can go further. TPC, tripeptide composition, is $20^3 = 8{,}000$ dimensions, and a 13-mer
fills 11 of them. That is 99.86% zeros, and on short peptides it behaves as pure noise. There is
a reason people stop at dipeptides.

---

## 4. DDE: pairs, but fairly judged (400 dims)

Dipeptide Deviation from Expected mean. The fix for DPC's biggest flaw.

DPC treats every pair equally. But some pairs are common by accident. Leucine has six codons and
alanine has four, so both are abundant, so `LA` turns up everywhere and tells you nothing. A
rare pair appearing at all is far more informative than a common pair appearing often.

So compare the observed frequency against what chance would predict, and standardise:

$$
\text{DDE}_{ab} = \frac{D_{ab} - T_{ab}}{\sqrt{V_{ab}}}
$$

- $D_{ab}$ is the observed dipeptide frequency, which is just DPC.
- $T_{ab} = (C_a/61)(C_b/61)$, where $C_a$ is the number of codons encoding amino acid $a$
  out of the 61 sense codons. This is the expected frequency under a naive codon model.
- $V_{ab} = T_{ab}(1 - T_{ab})/(L-1)$, the variance of that expectation, which shrinks as the
  peptide gets longer.

This is TF-IDF's idea wearing a lab coat: downweight what is common, amplify what is surprising.
The division by $\sqrt{V}$ also means the same deviation counts for more in a long peptide than
in a short one, which is correct, because in a long peptide you had more chances to observe it.

```python
import math

# Codons per amino acid out of the 61 sense codons. This table is the whole
# of DDE's notion of "expected by chance".
CODONS = dict(zip(AA, [4, 2, 2, 2, 2, 4, 2, 3, 2, 6,
                       1, 2, 4, 2, 6, 6, 4, 4, 1, 2]))

def dde(seq):
    n = len(seq) - 1
    counts = Counter(seq[i:i + 2] for i in range(n))
    out = []
    for p in PAIRS:
        tm = (CODONS[p[0]] / 61) * (CODONS[p[1]] / 61)
        tv = tm * (1 - tm) / n
        out.append((counts[p] / n - tm) / math.sqrt(tv))
    return out
```

In my anti-inflammatory peptide experiments DDE consistently outperformed raw DPC, which is
exactly what you would hope. It is also the descriptor I most often see implemented wrongly:
people compute $T_{ab}$ and then forget that $V_{ab}$ depends on $L$, which silently turns DDE
back into a rescaled DPC. The tell is a per-column correlation with DPC of exactly 1.000. A
shade below that is expected rather than broken, for the reason set out in section 9: the only
thing keeping the two blocks from being an exact affine pair is variation in $L$.

---

## 5. CKSAAP: pairs at a distance (1,600 dims)

Composition of K-Spaced Amino Acid Pairs. DPC only sees touching neighbours. Biology cares just
as much about pairs that are near without touching.

$400$ pairs $\times$ $4$ gap sizes ($k = 0, 1, 2, 3$) $= 1{,}600$ dimensions.

```python
def cksaap(seq, kmax=3):
    feats = []
    for k in range(kmax + 1):
        pairs = (seq[i] + seq[i + k + 1] for i in range(len(seq) - k - 1))
        counts = Counter(pairs)
        # A peptide shorter than k+2 contributes nothing at this gap, so
        # clamp the denominator rather than dividing by zero.
        n = max(len(seq) - k - 1, 1)
        feats += [counts[p] / n for p in PAIRS]
    return feats
```

Now the part that made this click for me. An α-helix, the commonest shape a short peptide adopts
when it meets a membrane, advances 100° around its spiral per residue. So:

```
     residue     i    i+1  i+2  i+3  i+4  i+5  i+6  i+7
     angle       0°   100° 200° 300° 40°  140° 240° 340°
     same face   ██             ██   ██             ██
                 └──────────────┴────┴──────────────┘
                 i, i+3, i+4 and i+7 all land within 60°
                 of residue i, so they sit on one face
```

A peptide that kills bacteria typically has a greasy face that slides into the membrane and a
charged face that grips its surface. That means hydrophobic residues repeating at spacings of 3
and 4. CKSAAP with $k=2$ pairs residue $i$ with $i+3$, and $k=3$ pairs $i$ with $i+4$. Those are
precisely the same-face pairs.

That is the general lesson worth internalising: good sequence features are secretly structural
features. Nobody handed the model a 3-D coordinate. The spacing statistics smuggled the helix in
through the back door.

![A helical wheel: the peptide GLFDIIKKIAESF plotted at 100 degrees per residue, with the greasy residues falling on one side and the charged residues on the other](/figures/helical-wheel.svg "GLFDIIKKIAESF plotted at 100 degrees per residue. The greasy residues land on one face and the charged ones on the other, which is what CKSAAP detects at k=2 and k=3 without ever being told a helix exists.")

The cost is that CKSAAP is even sparser than DPC and four times as wide, and its $k=0$ block is
byte-for-byte identical to DPC. Hold that thought for section 9.

---

## 6. CTD: group, then describe (147 dims)

Composition, Transition, Distribution. A change of strategy: stop thinking about twenty letters
and think about properties.

For each physicochemical property, bucket the twenty amino acids into three classes. For
hydrophobicity:

```
   class 1  polar     R K E D Q N
   class 2  neutral   G A S T P H Y
   class 3  greasy    C L V I M F W
```

Now `GLFDIIKKIAESF` becomes `2 3 3 1 3 3 1 1 3 2 1 2 3`, a 13-symbol string over a 3-letter
alphabet. Then extract three things from it.

**Composition.** How much of each class? Three numbers.

**Transition.** How often does the string switch between classes? Three numbers, for 1 to
2, 1 to 3, and 2 to 3. This is an amphipathicity detector. A peptide with a distinctly
polar half and a distinctly greasy half has few transitions; one with alternating charges
has many.

**Distribution.** Where along the sequence do you reach the first, 25th, 50th, 75th and 100th
percentile of each class? Five positions times three classes is fifteen numbers. This is what
separates "all the greasy residues clustered at the N-terminus" from "greasy residues sprinkled
evenly", two peptides that AAC calls identical.

That is 21 numbers per property. Repeat across seven properties (hydrophobicity, van der Waals
volume, polarity, polarisability, charge, secondary-structure propensity, solvent accessibility)
and you land at $7 \times 21 = 147$ dimensions.

Why I like CTD: it is the only cheap descriptor that captures where things are, not just how
much of them there is. And it is dense. There is no 97%-zeros problem, so distance-based models
and linear models can actually use it.

---

## 7. PAAC, QSO and autocorrelation: order without the explosion

Three descriptor families that solve the same problem with different maths: keep some long-range
order without blowing up to thousands of columns.

**PAAC (Pseudo Amino Acid Composition, 50 dims).** Take the 20 AAC values, then append
"correlation factors": a measure of how similar residues $i$ and $i+\lambda$ are in
physicochemical terms, averaged along the sequence, for $\lambda = 1, 2, \ldots, 30$:

$$
\theta_\lambda = \frac{1}{L-\lambda}\sum_{i=1}^{L-\lambda} \Theta(R_i, R_{i+\lambda})
$$

So: composition, plus a compact summary of how properties repeat at each spacing. $20 + 30 = 50$
numbers instead of CKSAAP's sixteen hundred. Note that $\lambda$ can never exceed $L-1$, so on a
13-mer most of those thirty factors are undefined and get zero-filled. PAAC's periodicity signal
degrades badly on very short peptides, and nobody says so loudly enough.

**QSO (Quasi-Sequence Order, 80 dims).** The same instinct, but weighted by a physicochemical
distance matrix between amino acid pairs, so "how different are the residues $d$ apart" enters
directly rather than through a single property. Two distance matrices (Schneider-Wrede and
Grantham), each contributing 20 composition terms plus 20 lag terms, gives 80.

**Autocorrelation (Moran, Geary, Moreau-Broto, 96 dims).** The same idea a third time, borrowed
wholesale from spatial statistics. Given a property value per residue, how correlated is the
property with itself at lag $d$? Three estimators times eight properties times four lags is 96.

One underlying question in three costumes: does this property repeat with a period? Which is,
again, a structural question in sequence clothing. Because they answer the same question they
are heavily correlated with each other. If you are using linear models or anything
distance-based, pick one and drop the other two. If you are using trees, you can afford to keep
all three, and that is mostly what I do.

---

## 8. What each descriptor actually sees

Before stacking them, here is what each of sections 2 to 7 sees when it looks at the same
thirteen residues.

```
   residue     G  L  F  D  I  I  K  K  I  A  E  S  F
   position    1  2  3  4  5  6  7  8  9 10 11 12 13

   AAC         one bag of 20 counters. Every residue drops in,
               order is gone.

   DPC/DDE     └──┘              adjacent pairs, 400 slots
                  └──┘           12 pairs from 13 residues
                     └──┘        so 97% of this row is zero

   CKSAAP      └──┘              k=0, gap 0  (this is exactly DPC)
               └─────┘           k=1, gap 1
               └────────┘        k=2, gap 2   same helix face
               └───────────┘     k=3, gap 3   same helix face

   CTD         2  3  3  1  3  3  1  1  3  2  1  2  3
               class per residue, then: how much of each class,
               how often it switches, where along the chain it sits.
```

And the same thing as a table you can reason about when choosing:

| Descriptor | Dims | Captures | Blind to | Density |
|---|---|---|---|---|
| AAC | 20 | overall composition | all order | dense |
| DPC | 400 | adjacent pairs | anything non-adjacent | very sparse |
| DDE | 400 | surprising adjacent pairs | non-adjacent | very sparse |
| CKSAAP | 1,600 | pairs at gaps 0 to 3 | longer range | very sparse |
| CTD | 147 | property classes plus position | exact identity | dense |
| PAAC | 50 | composition plus periodicity | fine detail | dense |
| QSO | 80 | distance-weighted order | fine detail | dense |
| Autocorrelation | 96 | property periodicity | identity | dense |
| Physicochemical | 20 | charge, hydropathy, isoelectric point | everything local | dense |

Do not hand-roll all nine of these for production. I wrote the code above so the mechanism is
legible, not because you should retype it. `iFeatureOmega`, `propy3`, `protlearn` and `peptides`
all cover most of this zoo and have been tested against the original papers, which your Sunday
afternoon implementation has not.

---

## 9. Stack them all, and the number that did not add up

Concatenate the lot:

```python
import numpy as np

def featurize(seq):
    return np.concatenate([
        aac(seq), dpc(seq), dde(seq), cksaap(seq),
        ctd(seq), paac(seq), qso(seq), autocorr(seq), physchem(seq),
    ])

X = np.vstack([featurize(s) for s in sequences])
print(X.shape)
```

I quoted "about 2,282 hand-crafted dimensions" for my anti-inflammatory peptide work for a long
time before someone asked me to show the arithmetic. The block sizes do not sum to 2,282. They
sum to 2,813. Here is the honest accounting:

```
   AAC 20 + DPC 400 + DDE 400 + CKSAAP 1,600 + CTD 147
       + PAAC 50 + QSO 80 + autocorrelation 96 + physchem 20
                                                    = 2,813
        │
        │  CKSAAP at k=0 is DPC recomputed, column
        │  for column. Drop the duplicate block.       -400
        ▼
      2,413
        │
        │  columns that are constant across the whole
        │  training set carry exactly no signal.       -131
        ▼
      2,282 columns    against    a few thousand peptides
```

Neither of those two steps is optional. The duplicate block is a genuine bug if you leave it in:
a tree ensemble will split the importance of adjacent-pair frequency across two identical column
sets, and every feature-importance plot you produce will understate it by half. The constant
columns are dipeptides and spaced pairs that never occur anywhere in your dataset, and they cost
memory and fit time while contributing nothing.

Which leaves the uncomfortable number: roughly as many features as training examples. That is a
textbook overfitting setup, and you design around it rather than hope.

**Correlated blocks.** Even after dropping the exact duplicate, redundancy remains. Within any
one peptide length, DDE is an affine rescaling of DPC column by column, so the two blocks are
perfectly rank-correlated and only diverge because lengths vary across the dataset. Tree
ensembles handle near-duplicate features gracefully. Linear models produce unstable
coefficients that flip sign between folds, and if you then interpret those coefficients you
are interpreting noise.

**Feature selection helps, but must be fitted inside the folds.** This is the single most common
serious bug in published bioinformatics code, and it always inflates the result. Selecting the
top 500 features on the full dataset lets the test fold leak into the selector, and your
reported score becomes fiction. The fix is one line of structure:

```python
from sklearn.pipeline import Pipeline
from sklearn.feature_selection import VarianceThreshold, SelectKBest, f_classif
from sklearn.model_selection import StratifiedKFold, cross_val_score
from xgboost import XGBClassifier

# Every step lives inside the pipeline, so cross_val_score refits the
# variance filter and the selector on the training fold only.
pipe = Pipeline([
    ("drop_constant", VarianceThreshold(threshold=1e-8)),
    ("select", SelectKBest(f_classif, k=500)),
    ("clf", XGBClassifier(n_estimators=400, max_depth=4, reg_lambda=5.0)),
])

cv = StratifiedKFold(5, shuffle=True, random_state=42)
print(cross_val_score(pipe, X, y, cv=cv, scoring="matthews_corrcoef"))
```

If the selector sits outside `cross_val_score`, the number that comes out is not a
generalisation estimate. It is a memory test.

**Regularise hard, and prefer ensembles to single deep models at this scale.** At 2,282 columns
and a few thousand rows, a gradient-boosted ensemble with depth 4 and real L2 will usually beat
anything you train end to end, because end-to-end training on that much data is mostly
memorisation.

---

## 10. Does the letter-counting still matter?

A reasonable question the moment protein language models existed. Why hand-craft anything?

My own numbers, 5-fold cross-validation on the anti-inflammatory peptide task:

| Feature set | Dims | Accuracy | MCC |
|---|---|---|---|
| Hand-crafted only | 2,282 | 82.0% ± 1.5% | 0.62 ± 0.03 |
| ESM-2 embeddings only | 1,280 | 80.5% ± 1.8% | 0.60 ± 0.04 |
| Both concatenated | 3,562 | 82.2% ± 1.4% | 0.63 ± 0.03 |

MCC is the Matthews correlation coefficient: one number from -1 to 1 that, unlike accuracy,
stays honest when the two classes are unbalanced.

Read that carefully, because it is more interesting than a win. The 650-million-parameter
protein language model did not beat twenty lines of letter counting, and combining them gained
about 0.2 percentage points, comfortably inside the error bars.

Three honest reasons why:

1. **Peptides are short.** Language models earn their keep on long-range context. A 13-residue
   peptide has very little long range to model. You are paying for a mechanism the problem does
   not need.
2. **The dataset is small.** A few thousand examples cannot exploit 1,280 rich dimensions much
   better than 2,282 crude ones. In both cases the data is the ceiling, not the representation.
3. **Hand-crafted features already encode the right inductive bias.** CKSAAP's gap structure is
   helical periodicity, as section 5 showed. I told the model where to look. ESM-2 had to infer
   it from a sequence too short to reveal much.

A note on where this stands now, since the backbones have kept moving since I first wrote this.
EvolutionaryScale's ESM3 and the ESM Cambrian (ESM-C) family have largely superseded ESM-2 as
the default protein encoder, and they are better models on the tasks protein language models are
good at. None of that changes the arithmetic in reason 1: a 13-residue peptide still has almost
no long range, and my label count has not grown. I would expect a newer backbone to narrow the
gap and possibly cross it. I would not expect it to make the hand-crafted block worthless, and I
would not believe a claim that it had without seeing the cross-validation protocol first.

There is also a cost argument that gets stronger, not weaker, as the models get bigger.
Hand-crafted descriptors run on a CPU at thousands of molecules a second, which is what made
[screening 400,000 natural products](/posts/2026/03/screening-400k-natural-products/) tractable
on hardware I actually own. And when a reviewer asks which features drive the prediction, "the
frequency of adjacent lysine pairs" advances the conversation in a way that "dimension 847" does
not.

So hand-crafted descriptors are not legacy baggage. On short sequences with small datasets they
remain a strong, cheap, interpretable baseline. Protein language models bring something the
counts genuinely cannot, and that is the next post.

---

## 11. The short version

- The whole task is one sentence: variable-length string to fixed-length vector, losing as
  little as possible.
- AAC counts letters and destroys order. DPC and DDE recover local order. CKSAAP recovers order
  at a distance. CTD captures position and property. PAAC, QSO and autocorrelation capture
  periodicity cheaply.
- Good sequence features are structural features in disguise. CKSAAP's gaps of 2 and 3 pair
  residues $i$ with $i+3$ and $i+4$, which is an α-helix face detector.
- Check that your column counts add up. Mine did not: CKSAAP $k=0$ duplicated DPC exactly, which
  halves every feature-importance number for adjacent pairs.
- Stacking everything gives roughly as many features as samples. Regularise, use ensembles, and
  fit variance filtering and feature selection inside your CV folds or your numbers are fiction.
- A protein language model did not beat letter counting on my short-peptide task. Newer
  backbones may narrow that gap; short sequences and small label sets are still the reason.
- Do not hand-roll the zoo for production. Use `iFeatureOmega` or `propy3` and spend the
  time you saved on the dataset instead.

---

*Series: **Machine Learning for Biology**. Next up,
[what ESM-2 actually learned](/posts/2026/01/protein-language-models/), and when a protein
language model is worth its weight.*
