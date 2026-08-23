---
title: "Your Negatives Decide Your Accuracy: 92% That Means Nothing 📉"
description: "Random UniProt negatives quietly turn peptide prediction into short-versus-long. Here is what an honest benchmark costs, and why it is worth it."
date: 2026-02-14
permalink: "/posts/2026/02/honest-negatives-peptide-benchmark/"
tags:
  - "bioinformatics"
  - "peptides"
  - "benchmarking"
  - "machine learning"
  - "research integrity"
  - "dataset design"
series: "Machine Learning for Biology"
seriesOrder: 4
math: true
---

*Part 4 of the machine-learning-for-biology series, and the one I'd pick if you only read one.
My model scores 76% where published methods report 92%, and mine is the better model. Here's
why.*

---

## 1. A classifier that spots cats, sort of 🐱

Suppose I claim a cat detector with 99% accuracy.

Impressive, until you look at my test set: 500 photos of cats and 500 photos of **fire
hydrants**.

My model doesn't detect cats. It detects *"is there fur"*. It would fail instantly on cats versus
dogs, cats versus foxes, cats versus a cushion. The 99% is real arithmetic on a fake question.

The number wasn't wrong. **The question was wrong.** And no amount of architecture work would
have revealed that, because the model was answering the question it was actually asked,
perfectly.

Now let's do the same thing to a field.

---

## 2. Where anti-inflammatory peptide negatives come from 🧪

The task: given a peptide sequence, predict whether it has anti-inflammatory activity.

Positives are straightforward: peptides experimentally shown to be anti-inflammatory, curated
from the literature and from immunology databases. Real assays, real measurements.

Negatives are where it gets interesting, because **nature doesn't publish a list of peptides
that were tested and did nothing.** Negative results rarely get written up.

So what do you do?

The standard shortcut, used by most published methods in this space: **download random protein
sequences from UniProt and label them negative.**

```python
# The conventional recipe
positives = load_curated_anti_inflammatory_peptides()   # ~1,500 peptides, 5–30 residues
negatives = random.sample(uniprot_all_proteins, 1500)   # random proteins, 100–1,000+ residues
```

Look carefully at those two lines. Read the length ranges.

---

## 3. The shortcut a model will always find 🔍

Positives: 5–30 residues. Negatives: hundreds of residues.

A classifier does not need to know anything about inflammation to separate those. It needs one
feature.

```python
def state_of_the_art(seq):          # no, really
    return "anti-inflammatory" if len(seq) < 50 else "not"
```

That's it. On a dataset built the conventional way, this gets you most of the way to a headline
number. And because published methods use rich feature vectors rather than a single length
column, **length leaks in everywhere**. AAC is normalised by $L$, DDE's variance term is
$1/(L-1)$, CTD's distribution descriptors are positional. You cannot easily *remove* length. It's
diffused through the whole representation.

So the model reports 92% accuracy, and what it has actually learned is:

$$
\text{"short peptide"} \;\text{vs.}\; \text{"long protein"}
$$

which is a solved problem that requires no biology whatsoever.

This is **shortcut learning**, and it is the single most common failure in applied ML on
biological data. The model isn't cheating. It's optimising exactly what you gave it. The dataset
contained an easier path to the answer than the biology, so it took the easier path, as it
should.

> **The uncomfortable generalisation:** if there is any feature that separates your classes more
> easily than the phenomenon you care about, your model will learn that feature. Always. Your
> job is to remove the shortcut, not to hope the model is noble.

---

## 4. What I did instead 🎯

In my own work I draw negatives from the **IEDB** (Immune Epitope Database) T-cell assays, the
*same* assays that supplied many of the positives.

The distinction that makes this work:

```
CONVENTIONAL NEGATIVES
   random UniProt proteins
   never tested for anything
   different length distribution
   different composition
   -> the model learns: "short vs. long"

VALIDATED NEGATIVES
   peptides that WERE tested in the same T-cell assays
   and did NOT show anti-inflammatory activity
   same length distribution
   same composition distribution
   -> the model must learn: "which short peptide is active"
```

These are peptides that went through the same experimental pipeline, in the same length range,
with the same amino-acid statistics, and came out negative. Experimentally validated inactivity.

Now length tells you nothing. Composition tells you very little. The only remaining signal is
the actual biology.

---

## 5. The numbers, and how to read them 📊

| Method | Negatives | Accuracy | MCC | Measures what? |
|---|---|---|---|---|
| DeepAIPs-SFLA | random UniProt | 92% | 0.85 | length, mostly |
| NeXtMD | random UniProt | 88% | 0.75 | length, mostly |
| **This work** | **IEDB-validated** | **76%** | **0.50** | **anti-inflammatory activity** |

Independent test set, my method:

| Metric | Value |
|---|---|
| Accuracy | 76.33% |
| Sensitivity | 66.33% |
| Specificity | 82.99% |
| MCC | 0.501 |

Sixteen points below the "state of the art". And I would defend this result in any room.

Two pieces of evidence that it's the harder task rather than the weaker model:

**I re-ran the other methods on this dataset.** Both are reimplementable from their papers, so
this is checkable rather than a claim. On IEDB-validated negatives they land around **75%**,
essentially where I do. Their 92% was never about their architecture. It was about their
negatives.

**The MCC matches other rigorous work.** MCC ≈ 0.50 is right where careful published methods sit
on genuinely hard versions of this task. That's a sanity check, not a coincidence.

**76% on a real task beats 92% on a fake one.** Only one of those numbers tells you anything
about a peptide you haven't seen.

---

## 6. Why MCC, not accuracy 🧮

Small aside, but it matters for reading any paper in this space.

**Matthews Correlation Coefficient** uses all four cells of the confusion matrix:

$$
\text{MCC} = \frac{TP \cdot TN - FP \cdot FN}{\sqrt{(TP+FP)(TP+FN)(TN+FP)(TN+FN)}}
$$

Range $[-1, 1]$: 1 is perfect, 0 is coin-flipping, −1 is perfectly wrong.

Why it's the right metric here, by the classic demonstration:

```python
# 900 negatives, 100 positives. Model always predicts "negative".
TP, FP, TN, FN = 0, 0, 900, 100

accuracy = (TP + TN) / 1000        # 0.90   ← looks great
mcc      = 0.0                     #        ← tells the truth
```

Ninety percent accuracy for a model that has never once said "yes". Accuracy on imbalanced data
is a marketing metric. MCC is not fooled by it, which is why I lead with MCC and report accuracy
second.

---

## 7. How to audit any dataset in ten minutes 🔎

Before you train anything, run these four checks. They have saved me more time than any
architecture I've ever tried.

**Check 1. Length.** Plot the length distribution per class. If they differ visibly, length is
your shortcut and your reported score is inflated.

```python
import numpy as np
for label in (0, 1):
    lens = [len(s) for s, y in zip(seqs, labels) if y == label]
    print(f"class {label}: n={len(lens)}  mean={np.mean(lens):.1f}  "
          f"median={np.median(lens)}  range={min(lens)}–{max(lens)}")
```

**Check 2. Train the dumbest possible model.** One feature: length.

```python
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import cross_val_score

L = np.array([[len(s)] for s in seqs])
score = cross_val_score(DecisionTreeClassifier(max_depth=1), L, labels, cv=5).mean()
print(f"length-only stump: {score:.2%}")
```

If a depth-1 stump on length alone hits 85%, **that** is your baseline, and your fancy model must
be measured against it, not against 50%. This one line reveals more about a dataset than a week
of modelling.

**Check 3. Composition.** Compare mean AAC per class. Big divergence in abundant residues
usually means the classes come from different sources, not different biology.

**Check 4. Provenance.** Ask, for every negative: *what experiment produced this label?* If the
answer is "none, it was assumed", you have assumptions in your test set, and your metric measures
your assumptions.

---

## 8. This isn't only a biology problem 🌍

The same pattern, in fields I've also worked in:

| Domain | The shortcut |
|---|---|
| Medical imaging | Positives from a cancer centre's scanner, negatives from a clinic's. Model learns the scanner. |
| Crop-disease detection | Diseased leaves photographed close-up in a lab, healthy ones in a field. Model learns background blur. |
| Fraud detection | Fraud labels only from cases investigators *chose* to investigate. Model learns investigator habits. |
| Sports biomechanics | Injury cases from elite athletes, controls from amateurs. Model learns skill level. |
| Toxicity prediction | Toxic compounds from regulatory lists, non-toxic from a vendor catalogue. Model learns the vendor. |

Same shape every time: **the classes differ in something other than the thing you care about,
and that something is easier to learn.**

The fix is always the same too, and it's always unglamorous: **make the negatives come from the
same process as the positives.** Same instrument, same protocol, same population, same
selection.

---

## 9. Making peace with worse numbers 😤

The practical difficulty isn't technical. It's that honest numbers look bad next to dishonest
ones, and reviewers compare tables.

What worked for us:

**Report the shortcut baseline.** Put the length-only stump in your results table.
It reframes the comparison from "76 vs 92" to "here is what each number measures".

**Ship code that runs the other methods on your data.** Nothing settles the argument faster than
a reproducible script showing they also get ~75% once the shortcut is gone.

**State the claim precisely.** Not "my model is better", but *"this model is evaluated on a
harder task that reflects the deployment setting; the prior numbers are not comparable."*

**Lead with MCC.** It's harder to inflate and it signals that you know what you're doing.

And accept that the honest result is sometimes the harder sell. That's a problem with the
incentive structure, not with your work.

---

## 10. The short version 📝

- Your **negatives define your task.** Change them and you've changed what you're measuring,
  regardless of the model.
- Random-UniProt negatives turn peptide-activity prediction into **"short vs. long"**, a solved
  problem with no biology in it.
- **92% on random negatives ≈ 75% on validated negatives.** I re-ran the other methods to check.
- Length leaks into nearly every sequence descriptor. You can't just drop the length column.
- Audit before you model: **length distributions, a length-only stump, composition, provenance.**
- Use **MCC**, not accuracy, on imbalanced data.
- Not a biology problem but a dataset-design problem, and it's everywhere.

**76% that means something beats 92% that doesn't.**

---

*Series: **Machine Learning for Biology**. Next up, scaling this to a whole library:
[from 400,000 natural products to 20 candidates](/posts/2026/03/screening-400k-natural-products/).*
