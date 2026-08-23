---
title: "Your Negatives Decide Your Accuracy: 92% That Means Nothing"
description: "Random UniProt negatives quietly turn peptide prediction into short versus long. Here is what an honest benchmark costs, and why it is worth paying."
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
My model scores 76% where published methods report 92%, and mine is the better model. Here is
why, and how to check your own data before you believe a number of your own.*

---

## 1. A classifier that spots cats, sort of

Suppose I claim a cat detector with 99% accuracy.

Impressive, until you look at my test set: 500 photos of cats and 500 photos of **fire
hydrants**.

My model doesn't detect cats. It detects *"is there fur"*. It would fail instantly on cats
versus dogs, cats versus foxes, cats versus a cushion. The 99% is real arithmetic on a fake
question.

The number wasn't wrong. **The question was wrong.** No amount of architecture work would have
revealed that, because the model was answering the question it was actually asked, perfectly.

Now let's do the same thing to a field.

---

## 2. Where anti-inflammatory peptide negatives come from

The task: given a peptide sequence, predict whether it has anti-inflammatory activity. If you
want the biology first, part 1 of this series covers [what a peptide even
is](/posts/2025/09/peptides-101/).

Positives are straightforward. They are peptides experimentally shown to damp an inflammatory
response, curated from the literature and from immunology databases. Real assays, real
measurements, each one traceable to a paper.

Negatives are where it gets interesting, because **nature does not publish a list of peptides
that were tested and did nothing.** Negative results rarely get written up, and when they do
they rarely get collected into a database.

So what do you do?

The standard shortcut, and I have seen it in the majority of published methods in this corner of
the field: **download random protein sequences from UniProt and label them negative.**

```python
# The conventional recipe, roughly as it appears in several papers.
positives = load_curated_anti_inflammatory_peptides()  # ~1,500 peptides, 5-30 aa
negatives = random.sample(uniprot_all_proteins, 1500)  # random proteins, 100-1000+ aa
```

Read those two comments again. Specifically, read the length ranges.

---

## 3. The shortcut a model will always find

Positives are 5 to 30 residues long, a residue being one amino acid letter in the sequence.
Negatives are hundreds of residues long. Drawn on one axis, the dataset looks like this:

```
CONVENTIONAL DATASET: sequence length, residues

    5     10    30    100   300   1000
    |     |     |     |     |     |
    ██████████████                          positives, 5-30 aa
                      ███████████████       negatives, 100-1000+ aa
                   ^ one threshold here scores about 90%

VALIDATED DATASET: sequence length, residues

    5     10    15    20    25    30
    |     |     |     |     |     |
    ███████████████████████████████         positives, 5-30 aa
    ███████████████████████████████         negatives, 5-30 aa
    no threshold helps; the two classes sit on top of each other
```

A classifier does not need to know anything about inflammation to separate the top panel. It
needs one feature.

```python
def state_of_the_art(seq):  # no, really
    return "anti-inflammatory" if len(seq) < 50 else "not"
```

That is the whole model. On a dataset built the conventional way it gets you most of the way to
a headline number.

The obvious response is "fine, drop the length feature". That does not work, because published
methods feed the model rich sequence descriptors, and length is baked into nearly all of them.
Amino-acid composition (AAC) is a count divided by $L$. The dipeptide deviation from expected
mean (DDE) has a variance term of $1/(L-1)$. The composition-transition-distribution (CTD)
descriptors are defined by where in the sequence a property first reaches 25%, 50%, 75% of its
total, which is a position, which is a length. I went through these descriptor families in
detail in [part 2](/posts/2025/11/peptide-feature-engineering/). Length is not a column you can
delete. It is diffused through the entire representation.

So the model reports 92% accuracy, and what it has actually learned is:

$$
\text{"short peptide"} \;\text{vs.}\; \text{"long protein"}
$$

which is a solved problem containing no biology whatsoever.

This is **shortcut learning**, and it is the single most common failure in applied ML on
biological data. The model is not cheating. It is optimising exactly what you gave it. The
dataset contained an easier path to the answer than the biology, so it took the easier path, as
it should.

If you are about to reach for embeddings instead of hand-built descriptors, that does not save
you either. An embedding here means: run the sequence through a protein language model, a
transformer trained on a large corpus of protein sequences, and average its per-residue output
into one vector. A mean-pooled ESM-2 vector for a 900-residue protein and one for a 12-residue
peptide are trivially distinguishable, because the pooling and the residue statistics differ.
The newer models that have largely replaced ESM-2 for this use, ESM C and ESM3, change nothing
about that. [Part 3](/posts/2026/01/protein-language-models/) has the numbers on my own task.
Swapping the features changes what the shortcut is made of, not whether it exists.

> **The uncomfortable generalisation:** if there is any feature that separates your classes more
> easily than the phenomenon you care about, your model will learn that feature. Always. Your
> job is to remove the shortcut, not to hope the model is noble.

---

## 4. What I do instead: negatives with a receipt

In my own ongoing work on anti-inflammatory peptides, I draw negatives from **IEDB**, the Immune
Epitope Database, specifically from T-cell assay records: the *same* assays that supplied many
of the positives. Peptides that went into an experiment, came out with no measured activity, and
had that written down.

Here is the difference, drawn as provenance rather than as statistics:

```
  HOW A LABEL GETS MADE

  positives           validated negatives     random negatives
  ─────────           ───────────────────     ────────────────
  T-cell assay        T-cell assay            no assay at all
       │                     │                       │
  measured effect     measured no effect      assumed inactive
       │                     │                       │
  5-30 residues       5-30 residues           100-1000+ residues
       │                     │                       │
  label 1             label 0                 label 0

  The first two columns differ in one thing: the assay readout.
  The third differs in provenance, length and composition as well.
```

Same experimental pipeline, same length range, same amino-acid statistics, opposite outcome.
Experimentally validated inactivity rather than assumed inactivity.

Now length tells you nothing. Composition tells you very little. The only signal left is the
thing I actually wanted to measure.

The cost is real and worth stating: validated negatives are scarce. I could have had 50,000
random UniProt negatives for the price of one query. Filtering IEDB down to assay records that
genuinely support a negative call leaves a few thousand. A smaller, harder dataset is the trade,
and it is the right trade.

One assumption survives, and I would rather state it than bury it. An IEDB negative means the
peptide showed no measured activity in that assay, at those concentrations, in that system. It
is not proof the peptide is inert. That is a far smaller leap than the one random UniProt makes,
but it is still a leap, and it belongs in your methods section.

---

## 5. The second leak: near-duplicate sequences

Fixing the negatives fixes the biggest hole. It does not fix the second one, which I ignored
for most of a year and should not have.

Peptide databases are full of near-duplicates: the same epitope (the short stretch an immune
receptor recognises) submitted by three groups, a family of variants differing by one residue,
truncations of a longer sequence. Shuffle those into a random train/test split and the model
gets to memorise. Your test set is then partly a
copy of your training set, and the score is a measure of lookup, not generalisation.

The fix is a similarity-aware split. Cluster first, then split by cluster, never by sequence.

```bash
# Cluster at 40% identity, then split whole clusters into folds.
# cov-mode 5 measures coverage against the shorter sequence, so a 10-mer
# buried inside a 30-mer still clusters. High -s because the default
# prefilter misses short peptides outright.
mmseqs easy-cluster peptides.fasta clusters tmp \
    --min-seq-id 0.4 -c 0.8 --cov-mode 5 -s 7.5
```

```python
from sklearn.model_selection import StratifiedGroupKFold, cross_val_score

# groups[i] is the cluster id of sequence i, from clusters_cluster.tsv.
# Sequences in one cluster must never straddle the train/test line.
cv = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=0)
scores = cross_val_score(model, X, y, groups=groups, cv=cv,
                         scoring="matthews_corrcoef")
```

Short peptides make this awkward, because sequence-identity clustering is noisy below about 20
residues and the usual 40% threshold was designed for proteins. There is no clean answer. I use
40% identity with 80% coverage of the shorter sequence, report that I did, and treat the gap
between a random split and a cluster split as a leakage estimate. If the score falls by fifteen
points when you cluster, the random-split number was mostly memorisation.

---

## 6. The numbers, and how to read them

Recent deep-learning predictors for anti-inflammatory peptides report accuracies in the high 80s
to low 90s, with the Matthews correlation coefficient (MCC, unpacked in section 7) around 0.75
to 0.85. Every one of those I have looked at builds negatives the conventional way. I am
describing the pattern rather than picking on individual groups, because the pattern is the
point.

| Setup | Negatives | Accuracy | MCC | Measures what? |
|---|---|---|---|---|
| Published predictors | random UniProt | 88-92% | 0.75-0.85 | length, mostly |
| Length-only stump | random UniProt | ~90% | ~0.80 | length, entirely |
| **This work** | **IEDB-validated** | **76%** | **0.50** | **activity** |

![Four bars of reported accuracy, two published predictors at 92 and 88 per cent, a length-only decision stump at 90 per cent, and this work at 76 per cent, each labelled with what it actually measures](/figures/honest-negatives.svg "What each number is measuring, printed beside the number. A stump on sequence length reproduces most of the published headline, which is why the 76 per cent is the only bar here that is about anti-inflammatory activity.")

My independent test set, in full:

| Metric | Value |
|---|---|
| Accuracy | 76.33% |
| Sensitivity | 66.33% |
| Specificity | 82.99% |
| MCC | 0.501 |

Sensitivity is the share of genuinely active peptides the model finds; specificity is the share
of genuinely inactive ones it correctly rejects. Cross-validated scores on my development split
run a few points above this, as they generally do. The table is the held-out set, and the
held-out set is the number I quote.

Sixteen points below the "state of the art", and I would defend it in any room.

Two pieces of evidence that this is the harder task rather than the weaker model.

**A one-feature baseline reproduces most of the published headline.** A decision stump on
sequence length alone, trained and tested the conventional way, lands near 90%. That is the
check anyone can run in four lines, it needs nothing from me, and it is the reason I do not
believe the gap between 92% and 76% is a gap in modelling. I have also rebuilt the published
feature sets and run them against IEDB-validated negatives, where they come out close to where
I do, but I am reporting that as my own unpublished result rather than as evidence you should
take on trust. Run the stump instead: it makes the same point and you do not have to believe
me.

**The MCC sits where careful work sits.** An MCC around 0.5 is roughly what rigorous published
methods report on genuinely hard versions of sequence-activity prediction. That is a sanity
check on the ceiling, not a coincidence.

Note what the second row of that table implies. If a depth-1 decision stump on length alone
scores about 90%, then a published 92% is a two-point improvement over counting letters, not a
92-point improvement over nothing. Reporting the stump changes the whole reading of the table,
which is exactly why almost nobody reports it.

---

## 7. Why MCC, not accuracy

A short aside that matters for reading any paper in this space.

The **Matthews correlation coefficient** uses all four cells of the confusion matrix:

$$
\text{MCC} = \frac{TP \cdot TN - FP \cdot FN}{\sqrt{(TP+FP)(TP+FN)(TN+FP)(TN+FN)}}
$$

Its range is $[-1, 1]$: 1 is perfect, 0 is coin-flipping, and $-1$ is perfectly wrong.

Why it is the right metric here, by the classic demonstration:

```python
# 900 negatives, 100 positives. The model always predicts "negative".
TP, FP, TN, FN = 0, 0, 900, 100

accuracy = (TP + TN) / 1000  # 0.90, looks excellent
mcc = 0.0                    # tells the truth: no skill at all
```

Ninety percent accuracy for a model that has never once said "yes". Strictly the MCC
denominator is zero here, since nothing is ever predicted positive; the convention, and what
`sklearn.metrics.matthews_corrcoef` returns, is 0. Accuracy on imbalanced data is a marketing
metric. MCC is not fooled by it, which is why I lead with MCC and report accuracy second. The
same argument applies to any retrieval or ranking metric you quote in a table, which I laboured
over in [the post on retrieval metrics](/posts/2024/08/retrieval-metrics/).

---

## 8. Auditing a dataset in ten minutes

Run these checks before you train anything. They have saved me more time than any architecture
I have ever tried.

```
  AUDIT LADDER (stop at the first "no")

  do the length distributions overlap?  ── no ─> shortcut: length
        │ yes
  is a length-only stump near chance?   ── no ─> shortcut: length
        │ yes
  do per-class AAC profiles match?      ── no ─> shortcut: source
        │ yes
  does a 40%-identity cluster split     ── no ─> shortcut: memorised
    hold the score?                              near-duplicates
        │ yes
  does every negative cite an assay?    ── no ─> your metric scores
        │ yes                                    your assumptions
  the number is worth reporting
```

**Check 1. Length.** Print the length distribution per class. If they differ visibly, length is
your shortcut and your reported score is inflated.

```python
import numpy as np

for label in (0, 1):
    lens = [len(s) for s, y in zip(seqs, labels) if y == label]
    print(f"class {label}: n={len(lens)}  mean={np.mean(lens):.1f}  "
          f"median={np.median(lens)}  range={min(lens)}-{max(lens)}")
```

**Check 2. Train the dumbest possible model.** One feature: length.

```python
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.tree import DecisionTreeClassifier

L = np.array([[len(s)] for s in seqs])
cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=0)
stump = DecisionTreeClassifier(max_depth=1)
acc = cross_val_score(stump, L, labels, cv=cv).mean()
mcc = cross_val_score(stump, L, labels, cv=cv,
                      scoring="matthews_corrcoef").mean()
print(f"length-only stump: accuracy {acc:.2%}, MCC {mcc:.3f}")
```

If a depth-1 stump on length alone hits 85%, **that** is your baseline, and your real model must
be measured against it rather than against 50%. Those six lines tell you more about a dataset
than a week of modelling.

**Check 3. Composition.** Compare mean AAC per class. A large divergence in abundant residues
usually means the classes came from different sources rather than from different biology.

**Check 4. Redundancy.** Cluster and re-split, as in section 5. Compare the random-split score
with the cluster-split score. The difference is your leakage.

**Check 5. Provenance.** For every negative, ask: *what experiment produced this label?* If the
answer is "none, it was assumed", then you have assumptions in your test set, and your metric is
measuring your assumptions.

---

## 9. This is not only a biology problem

The same pattern, in five other fields:

| Domain | How the classes were collected | What gets learned |
|---|---|---|
| Medical imaging | Cancer-centre scanner vs clinic scanner | the scanner |
| Crop-disease detection | Diseased leaves in a lab, healthy in a field | background blur |
| Fraud detection | Only investigated cases carry a label | investigator habits |
| Sports biomechanics | Injured elites vs uninjured amateurs | skill level |
| Toxicity prediction | Regulatory lists vs a vendor catalogue | the vendor |

Two of those show up later in this series, in [crop disease from
drone imagery](/posts/2026/07/crop-disease-from-the-sky/) and in [bowling
biomechanics](/posts/2026/05/bowling-biomechanics-pose/), and in both cases the fix was the same
as it is here.

Same shape every time: **the classes differ in something other than the thing you care about,
and that something is easier to learn.**

The fix is always the same too, and always unglamorous: **make the negatives come from the same
process as the positives.** Same instrument, same protocol, same population, same selection.

---

## 10. Making peace with worse numbers

The hard part is not technical. It is that honest numbers look bad next to dishonest ones, and
people compare tables before they read methods.

What has worked for me:

**Report the shortcut baseline.** Put the length-only stump in the results table. It reframes
the comparison from "76 versus 92" to "here is what each number is measuring".

**Ship code that runs the other methods on your data.** Nothing settles the argument faster than
a script anyone can run that shows the published methods also land in the mid-70s once the
shortcut is gone.

**State the claim precisely.** Not "my model is better", but "this model is evaluated on a
harder task that reflects the deployment setting, and the prior numbers are not comparable".

**Say how you split.** Random split or cluster split, and at what identity threshold. A paper
that does not say has told you something.

**Lead with MCC.** It is harder to inflate, and quoting it signals that you know what the
numbers do.

And accept that the honest result is sometimes the harder sell. That is a problem with the
incentive structure, not with your work.

---

## 11. The short version

- Your **negatives define your task.** Change them and you have changed what you are measuring,
  whatever the model does.
- Random-UniProt negatives turn peptide-activity prediction into **short versus long**, a solved
  problem with no biology in it.
- Length leaks into nearly every sequence descriptor and into pooled embeddings, so you cannot
  simply drop the length column.
- Validated negatives, peptides assayed and found inactive, cost you data volume and buy you a
  number that means something.
- **Near-duplicate sequences are the second leak.** Cluster at 40% identity and split by
  cluster, not by sequence.
- Audit before you model: length distributions, a length-only stump, composition, redundancy,
  provenance.
- Use **MCC**, not accuracy, on imbalanced data, and report the shortcut baseline next to your
  model.
- **76% that means something beats 92% that does not.** Only one of those tells you anything
  about a peptide you have not seen.

---

*Series: **Machine Learning for Biology**. Next up, scaling this to a whole library:
[400,000 natural products down to 20](/posts/2026/03/screening-400k-natural-products/).*
