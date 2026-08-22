---
title: "From 400,000 Natural Products to 20 Candidates 🌿"
date: 2026-03-14
permalink: /posts/2026/03/screening-400k-natural-products/
tags:
  - drug discovery
  - virtual screening
  - COCONUT
  - cheminformatics
  - machine learning
  - bioinformatics
math: true
---

*Part 5 of the machine-learning-for-biology series. A funnel that starts with every natural
product humans have catalogued and ends with a shortlist a wet lab can afford to test.*

---

## 1. Why plants are a good place to look 🌱

Aspirin came from willow bark. Penicillin from mould. Artemisinin, the frontline malaria drug,
from sweet wormwood, a plant used in Chinese medicine for two thousand years. Taxol from the
Pacific yew.

This is not a coincidence, and it's not romanticism. Natural products are **pre-filtered by
evolution**. A fungus that produces a molecule to poison a competing bacterium has been running
a medicinal-chemistry program for a few hundred million years, with survival as the objective
function.

Practically, that gives natural products two properties synthetic libraries struggle to match:

- **Stereochemical richness.** Multiple chiral centres, fused rings, geometry that a
  combinatorial library won't generate because it's hard to make on purpose.
- **Biological relevance.** They evolved to interact with proteins. That's what they're *for*.

**COCONUT** (COlleCtion of Open NatUral producTs) is the open aggregation of this: over 400,000
natural products from more than 50 source databases, with structures, provenance, and computed
properties. Free to download.

So: 400,000 molecules that evolution already vetted, and a viral protease we'd like to inhibit.
How do we get from one to the other without spending a decade?

---

## 2. The target: viral proteases 🎯

A virus enters a cell and hijacks the ribosome to translate its genome. But it often comes out
as **one long polyprotein**: several functional proteins fused into a single chain, useless
until cut apart.

The scissors are a **protease**, encoded by the virus itself.

```
    translated polyprotein
    ═══════╪═══════╪═══════╪═══════
           ▲       ▲       ▲
        protease cuts at specific sequences
           │       │       │
    ═══════  ═══════  ═══════  ═══════
      NSP1     NSP2     NSP3    ...      <- now functional
```

Break the scissors and the virus assembles nothing. That's why protease inhibitors are a
validated antiviral class. HIV protease inhibitors turned AIDS from terminal to chronic, and
Paxlovid's active component is a SARS-CoV-2 Mpro inhibitor.

Our testbed covers five:

| Virus | Protease | Note |
|---|---|---|
| HIV-1 | HIV-1 protease | best-studied; a sanity check for the whole pipeline |
| Hepatitis C | NS3/4A | proven druggable target |
| SARS-CoV-2 | Mpro (3CLpro) | huge public dataset thanks to COVID Moonshot |
| Dengue | NS2B-NS3 | no approved antiviral; genuinely understudied |
| Zika | NS2B-NS3 | same, and closely related to dengue |

Those last two are the point. Dengue infects hundreds of millions of people a year and has no
approved antiviral. Understudied targets are where computational screening has the most room to
be useful.

---

## 3. Get the labels first 🗂️

Before touching COCONUT, you need training data: molecules with *known* activity against each
protease.

| Source | What it gives |
|---|---|
| **ChEMBL** | curated bioactivities (IC₅₀, Kᵢ, Kd, EC₅₀), relation-qualified, with assay confidence |
| **BindingDB** | protease binding and inhibition measurements |
| **PubChem BioAssay** | confirmatory antiviral/protease screens, often binary |
| **ZINC** (activity/approved subsets) | diverse positives and decoys |
| **COVID Moonshot** | open medicinal-chemistry campaign data for Mpro |
| **PDB** | ligand-bound structures, for docking grids later |

Merging these is where most of the real work lives, and it's all unglamorous:

```python
record = {
    "smiles_std":       "CC(=O)Oc1ccccc1C(=O)O",     # neutralised, canonical, desalted
    "source":           "chembl",
    "assay_id":         "CHEMBL1613914",
    "target_id":        "CHEMBL3927",
    "measurement_type": "IC50",
    "relation":         "=",                          # not ">" ... see below
    "original_units":   "uM",
    "value_nM":         850.0,                        # harmonised
    "label_active":     True,                         # value_nM <= threshold
    "assay_type":       "B",                          # binding vs. functional
}
```

Four decisions in that record that will quietly decide your results:

**Standardisation.** Neutralise charges, strip salts and solvents, canonicalise tautomers, pick
one canonical SMILES. Skip this and the same molecule appears three times with three labels.

**Unit harmonisation.** Everything to nM. Papers report µM, nM, pIC₅₀, percent inhibition at a
fixed dose. A single missed conversion is a 1,000× error in your labels.

**The relation qualifier.** A record saying `IC50 > 10000 nM` means *"we tested up to 10 µM and
saw nothing"*. That is a genuine negative. A record saying `IC50 = 10000 nM` is a weak binder.
Treating `>` as `=` silently corrupts your labels, and it's a very common bug.

**The activity threshold.** We default to **1,000 nM** for active, relaxed to **5,000 nM** for
sparse targets. Arbitrary, and it must be *pre-declared*. Tuning the threshold until your model
looks good is how you fool yourself.

And one rule above all: **strict per-virus isolation.** Separate curation, separate splits,
separate models, no pooling. Dengue and Zika proteases are similar enough that pooling is
tempting. Pooling is also how a "dengue model" ends up reporting Zika performance.

---

## 4. The split that decides whether you're lying to yourself ✂️

This is the most important technical section in the post.

A random train/test split on molecules gives you a badly inflated score. Here's why:

```
Random split puts these in different sets:

  aspirin           CC(=O)Oc1ccccc1C(=O)O
  methyl aspirin    CC(=O)Oc1ccccc1C(=O)OC        <- test set

The model "generalises" to a molecule differing by one methyl group.
That is memorisation with extra steps.
```

Chemical databases are full of series, because a paper publishes one scaffold with twenty
substituents. Random splitting scatters that series across train and test, and your model gets
credit for interpolating within a family it has already seen.

But that is *not* the deployment task. In deployment, you're screening COCONUT: molecules from
entirely different chemical space, with scaffolds absent from your training data.

So we split by **scaffold**:

```python
from rdkit.Chem.Scaffolds import MurckoScaffold

def scaffold(smiles):
    """Bemis-Murcko: strip side chains, keep the ring system + linkers."""
    return MurckoScaffold.MurckoScaffoldSmiles(smiles=smiles)
```

The **Bemis–Murcko scaffold** is a molecule's structural core with decoration removed. Group
molecules by scaffold, then cluster scaffolds that are still similar (Tanimoto > 0.6), and assign
whole clusters to train / validation / test at 70/15/15, with **zero scaffold overlap**.

The honest consequence:

| Split | Test ROC-AUC | What it measures |
|---|---|---|
| Random | ~0.94 | interpolation inside known series |
| Scaffold-clustered | ~0.78 | generalisation to new chemotypes |

Same data, same model, sixteen points of difference. The 0.94 is the number that gets into a
press release. The 0.78 is the number that predicts what happens when you screen COCONUT.

**Always report the scaffold-split number.** If a paper doesn't say how it split, assume random
and mentally deduct fifteen points.

---

## 5. Model pluralism 🤖

There is no single best architecture for molecular property prediction, and pretending otherwise
wastes months. So we train several families per virus and select on pre-registered metrics.

**Fingerprint + classical ML.** Encode the molecule as a bit vector: ECFP4 (circular
substructure fingerprints), MACCS keys, plus physicochemical descriptors. Then RandomForest,
XGBoost, LightGBM, or an MLP.

```python
from rdkit.Chem import AllChem, MolFromSmiles

mol = MolFromSmiles(smiles)
fp = AllChem.GetMorganFingerprintAsBitVect(mol, radius=2, nBits=2048)   # ECFP4
```

Fast, robust, works with a few hundred labels, and highly competitive on small datasets, which
describes most understudied targets.

**Graph neural networks (ChemProp).** Treat the molecule as a graph: atoms are nodes, bonds are
edges, and message passing learns its own representation instead of using a fixed fingerprint.
Better when you have thousands of labels; worse when you have hundreds.

**Selection metrics, declared up front:** ROC-AUC and PR-AUC as primaries, with balanced
accuracy, F1, MCC, and calibration as secondaries. PR-AUC matters because actives are rare,
which brings us to the number that governs the entire funnel.

---

## 6. Base rates, and why calibration is not optional ⚖️

Suppose 1 in 1,000 COCONUT molecules is genuinely active. Your classifier is 95% sensitive and
95% specific. Respectable numbers.

Screen 400,000 molecules:

```
true actives           : 400,000 × 0.001            =     400
  detected (95%)       : 400 × 0.95                 =     380
true inactives         : 400,000 × 0.999            = 399,600
  false positives (5%) : 399,600 × 0.05             =  19,980

flagged as active      : 380 + 19,980               =  20,360
precision              : 380 / 20,360               =    1.9%
```

Twenty thousand "hits", of which 98% are wrong. A wet lab that can test fifty compounds cannot
use that list.

This is the **base-rate fallacy**, and at screening scale it dominates everything. A 95%-accurate
model is nearly useless on its own when actives are 0.1% of the population.

Which reframes the goal. You are not trying to *classify*. You are trying to **rank**, and then
apply independent filters that are wrong in *different* ways than your model is. The funnel exists
because no single stage can carry this load.

---

## 7. The funnel 🕳️

```
COCONUT                                          ~400,000  ██████████████████████
  │  standardise, drop invalid/duplicate
  ▼
valid, standardised                              ~390,000  █████████████████████
  │  drug-likeness (Lipinski-ish, permissive)
  ▼
plausible physicochemistry                       ~180,000  ██████████
  │  ML inference, per-virus model, keep top 1%
  ▼
ML-prioritised                                     ~1,800  ▏
  │  PAINS + toxicophore filters
  ▼
clean chemistry                                    ~1,200  ▏
  │  scaffold diversity: cap per Murcko scaffold
  ▼
diverse shortlist                                    ~300  ▏
  │  docking, threshold ≤ -8.0 kcal/mol
  ▼
structurally plausible                                ~60  ▏
  │  interaction check at catalytic residues
  ▼
CANDIDATES for wet lab                                ~20  ▏
```

Each stage deserves a note on *why it's there*, because a funnel where every filter is
correlated with the previous one filters nothing.

**Drug-likeness, permissive on purpose.** Molecular weight, logP, H-bond donors/acceptors,
rotatable bonds. But natural products routinely and famously violate Lipinski's rules, and some
of them are excellent drugs anyway. A strict filter here throws away exactly the interesting
chemistry, so we set generous bounds and let the later stages do the discriminating.

**PAINS filters.** Pan-Assay INterference compoundS: substructures that show activity in
*everything*: reactive groups, aggregators, fluorescence artefacts, redox cyclers. They aren't
hits, they're assay noise, and they will eat your wet-lab budget with a smile.

**Scaffold diversity.** Without this, the top 300 are twenty variations on three scaffolds. If
that scaffold turns out to be a dead end, you've learned one thing from 300 tests. Capping
molecules per scaffold buys you *information*, not just ranking.

**Docking.** An orthogonal check, geometry and physics rather than statistics. The next post
covers it properly.

**Interaction analysis.** A good docking score isn't enough; the pose must contact the residues
that matter. For a cysteine protease, is the molecule near the catalytic Cys–His dyad, or parked
in a decorative surface groove with a flattering score?

---

## 8. The final ranking 🏆

Consensus, deliberately: three signals that fail in different ways.

$$
\text{priority} = w_1 \cdot p_{\text{ML}} + w_2 \cdot \tilde{s}_{\text{dock}} + w_3 \cdot \tilde{d}_{\text{drug-like}}
$$

Not because the weighted sum is principled (it isn't especially) but because a molecule that
scores well on all three has passed a statistical test, a physical test, and a practical test.
Any *one* of them can be gamed by an artefact. Agreement across three is much harder to fake.

And then the honest caveat: **this produces a hypothesis list, not drugs.** Every compound on it
needs a real assay. The pipeline's job is to make the wet lab's fifty experiments 100× more
likely to contain something than fifty random picks. That's all, and that's a lot.

---

## 9. Ways this goes wrong 💀

Collected the hard way:

**Activity cliffs.** Two molecules with Tanimoto 0.95 and 1,000× different potency. Fingerprint
models are close to blind to these, because they're structurally near-identical by construction.

**Assay heterogeneity.** IC₅₀ from a binding assay and IC₅₀ from a cell-based assay are not the
same quantity. Merging them without recording `assay_type` injects noise you can't diagnose
later.

**Decoy bias.** If your negatives are random ZINC molecules and your positives are drug-like
actives, you're back to the [shortcut-learning problem](/posts/2026/02/honest-negatives-peptide-benchmark/)
from the last post. The model learns "drug-like vs. not", not "active vs. not".

**Docking-score worship.** Docking scores are extremely rough. A −9.2 is not meaningfully better
than a −8.8. Use them as a coarse filter and a plausibility check, never as a fine ranking.

**Data leakage through duplicates.** The same molecule under different names in ChEMBL and
BindingDB, landing in train and test. Deduplicate on standardised structure, not on name or ID.

---

## 10. The short version 📝

- Natural products are **evolution-vetted chemical matter**; COCONUT makes 400k+ of them free.
- Viral proteases are validated targets, and the **understudied ones (dengue, Zika)** are where
  computation has the most headroom.
- Curation is the real work: standardise, harmonise units to nM, **respect the `>` qualifier**,
  pre-declare thresholds, and keep viruses strictly isolated.
- **Scaffold-clustered splits, not random.** The gap is ~0.94 vs ~0.78 AUC, and only the second
  number predicts deployment.
- At screening scale the **base rate dominates**. You're building a ranker plus orthogonal
  filters, not a classifier.
- The funnel works because each stage fails *differently*: physicochemistry, ML, PAINS,
  diversity, docking, interactions.
- The output is a **prioritised hypothesis list**. The wet lab still decides.

---

*Series: **Machine Learning for Biology**. Next up,
[docking explained without the jargon](/posts/2026/04/docking-without-jargon/): what a docking
score is, and why you shouldn't trust it as much as you want to.*
