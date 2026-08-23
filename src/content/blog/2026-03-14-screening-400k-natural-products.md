---
title: "From 400,000 Natural Products to 20 Candidates"
description: "A funnel from every catalogued natural product down to twenty compounds worth testing, and why the split and the base rate matter more than the model."
date: 2026-03-14
permalink: "/posts/2026/03/screening-400k-natural-products/"
tags:
  - "drug discovery"
  - "virtual screening"
  - "COCONUT"
  - "cheminformatics"
  - "machine learning"
  - "bioinformatics"
series: "Machine Learning for Biology"
seriesOrder: 5
math: true
---

*Part 5 of the machine-learning-for-biology series. A funnel that starts with every natural
product humans have catalogued and ends with a shortlist a wet lab can afford to test. Most of
the difficulty is not in the model.*

---

## 1. Why plants are a good place to look

Aspirin came from willow bark. Penicillin from mould. Artemisinin, the frontline malaria drug,
from sweet wormwood, a plant used in Chinese medicine for two thousand years. Taxol from the
Pacific yew.

This is not a coincidence, and it is not romanticism. Natural products are **pre-filtered by
evolution**. A fungus that makes a molecule to poison a competing bacterium has been running a
medicinal-chemistry programme for a few hundred million years, with survival as the objective
function and no budget limit.

Practically, that gives natural products two properties synthetic libraries struggle to match:

- **Stereochemical richness.** Multiple chiral centres (atoms whose attachments can be arranged
  in two mirror-image ways), fused rings, three-dimensional geometry that a combinatorial
  library will not generate because it is awkward to make on purpose.
- **Biological relevance.** They evolved to interact with proteins. That is what they are *for*.

**COCONUT** (COlleCtion of Open NatUral producTs) is the open aggregation of all this: hundreds
of thousands of natural products drawn from more than fifty source databases, with structures,
provenance and computed properties, free to download. The version I built this pipeline on held
a little over 400,000 unique structures. The 2024 rebuild, COCONUT 2.0, redid the curation and
the deduplication and pushed the count well past that, so treat the number in the title as the
scale of the problem rather than today's row count. Check the download page before you quote a
figure.

So: several hundred thousand molecules that evolution has already vetted, and a viral protease
we would like to inhibit. How do we get from one to the other without spending a decade?

---

## 2. The target: viral proteases

A virus enters a cell and hijacks the ribosome to translate its genome. What often comes out is
**one long polyprotein**: several functional proteins fused into a single chain, useless until
cut apart. The scissors are a **protease**, encoded by the virus itself.

```
   viral genome ──> ribosome ──> one long polyprotein

   ═══════╪═══════╪═══════╪═══════
          ▲       ▲       ▲
          protease cuts at specific sequences
          │       │       │
    ═════   ═════   ═════   ═════
    NSP1    NSP2    NSP3     ...     now functional proteins

   break the scissors and the virus assembles nothing
```

That is why protease inhibitors are a validated antiviral class rather than a hopeful one. HIV
protease inhibitors turned AIDS from terminal to chronic, and the active component of Paxlovid
is a SARS-CoV-2 Mpro inhibitor.

Our testbed covers five:

| Virus | Protease | Note |
|---|---|---|
| HIV-1 | HIV-1 protease | best studied, so a sanity check for the whole pipeline |
| Hepatitis C | NS3/4A | proven druggable, several approved inhibitors |
| SARS-CoV-2 | Mpro (3CLpro) | large public dataset thanks to the COVID Moonshot |
| Dengue | NS2B-NS3 | no approved antiviral, genuinely understudied |
| Zika | NS2B-NS3 | same, and closely related to dengue |

Those last two are the point. Dengue infects hundreds of millions of people a year and still has
no approved antiviral. Understudied targets are where computational screening has the most room
to be useful, because nobody has already run the obvious library through the obvious assay.

---

## 3. Get the labels before you get the molecules

Before touching COCONUT you need training data: molecules with *known* activity against each
protease.

| Source | What it gives |
|---|---|
| **ChEMBL** | curated bioactivities (IC₅₀, EC₅₀, Ki, Kd), relation-qualified, with assay data |
| **BindingDB** | protease binding and inhibition measurements |
| **PubChem BioAssay** | confirmatory antiviral and protease screens, often binary |
| **ZINC** | purchasable compounds, useful for property-matched decoys |
| **COVID Moonshot** | open medicinal-chemistry campaign data for Mpro |
| **PDB** | ligand-bound structures, for docking grids later |

Merging these is where most of the real work lives, and all of it is unglamorous. One row of the
merged table looks like this, with illustrative identifiers:

```python
record = {
    "smiles_std":       "CC(=O)Oc1ccccc1C(=O)O",   # neutral, desalted, canonical
    "source":           "chembl",
    "assay_id":         "CHEMBL1613914",
    "target_id":        "CHEMBL3927",
    "measurement_type": "IC50",
    "relation":         "=",                       # not ">", see below
    "original_units":   "uM",
    "value_nM":         850.0,                     # harmonised on ingest
    "assay_type":       "B",                       # binding, not functional
    "label_active":     True,
}
```

Four decisions in that record will quietly decide your results.

### Standardisation

Neutralise charges, strip salts and solvents, pick one tautomer (the same molecule with a
hydrogen sitting somewhere else), emit one canonical SMILES, which is the standard text spelling
of a structure. Skip it and the same molecule appears three times under three labels.

```python
from rdkit import Chem
from rdkit.Chem.MolStandardize import rdMolStandardize

_frag = rdMolStandardize.LargestFragmentChooser()
_unchg = rdMolStandardize.Uncharger()
_taut = rdMolStandardize.TautomerEnumerator()


def standardise(smiles: str) -> str | None:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None
    mol = rdMolStandardize.Cleanup(mol)
    mol = _frag.choose(mol)        # keep the drug, drop the counter-ion
    mol = _unchg.uncharge(mol)     # one protonation state, chosen by us
    mol = _taut.Canonicalize(mol)  # slow enough to dominate a 400k run
    return Chem.MolToSmiles(mol)
```

That last line is the one that will make you write a cache. Tautomer canonicalisation runs in
milliseconds per molecule on well-behaved input and much worse on the fused polycyclic monsters
that natural product collections are full of. Cache on the input SMILES hash and move on.

### Unit harmonisation

Everything to nanomolar on ingest. Papers report µM, nM, pIC₅₀, and per cent inhibition at a
fixed dose. One missed conversion is a 1,000-fold error in your labels, and it will not announce
itself.

### The relation qualifier

A record saying `IC50 > 10000 nM` means "we tested up to 10 µM and saw nothing". That is a
genuine negative. A record saying `IC50 = 10000 nM` is a real but weak binder. Treating `>` as
`=` silently corrupts your labels, and it is one of the most common bugs in this whole field.

The subtlety is that censored measurements are only informative on one side:

```python
def label(rec, active_nM: float = 1000.0) -> bool | None:
    """Return True, False, or None for 'this record cannot decide'."""
    value, rel = rec["value_nM"], rec["relation"]
    if rel == "=":
        return value <= active_nM
    if rel in (">", ">="):
        # "no activity up to X" is a negative only if X reached our threshold.
        return False if value >= active_nM else None
    if rel in ("<", "<="):
        return True if value <= active_nM else None
    return None
```

Rows that return `None` get dropped, not guessed. In a ChEMBL pull for a sparse target that can
be a tenth of your data, and throwing it away is still cheaper than mislabelling it.

### The activity threshold

We default to **1,000 nM** for active, relaxed to **5,000 nM** for targets with too few actives
to train on. Both numbers are arbitrary, and both must be *pre-declared*. Tuning the threshold
until your model looks good is the purest form of fooling yourself, because the metric moves and
nothing about the chemistry does.

One rule sits above all four: **strict per-virus isolation.** Separate curation, separate
splits, separate models, no pooling. Dengue and Zika proteases are similar enough that pooling
feels harmless. Pooling is also how a "dengue model" ends up quietly reporting Zika
performance.

---

## 4. The split that decides whether you are lying to yourself

This is the most important technical section in the post, and the cheapest thing to get right.

Chemical databases are full of series, because a paper publishes one scaffold with twenty
substituents on it. A random train/test split scatters that series across both sides, so the
model is graded on molecules that differ from its training data by a methyl group.

```
  random split                      scaffold-clustered split
  ┌────────────────────┐            ┌────────────────────┐
  │ train: a1 a2 b1 b2 │            │ train: a1 a2 a3 a4 │
  │ test : a3 b3       │            │ test : b1 b2 b3 b4 │
  └────────────────────┘            └────────────────────┘
  a3 has a near twin in train       no test scaffold seen in train
  measures interpolation            measures generalisation
  ROC-AUC ~0.94                     ROC-AUC ~0.78
```

ROC-AUC here is the probability that the model scores a real active above a real inactive: 0.5
is a coin toss, 1.0 is perfect. The 0.94 is memorisation with extra steps. It is also not the
deployment task: in deployment you are screening COCONUT, which is full of scaffolds your
training set has never contained.

So split by **scaffold**. The Bemis-Murcko scaffold is a molecule's structural core with the
decoration removed, ring systems plus the linkers between them:

```python
from rdkit.Chem.Scaffolds import MurckoScaffold

def scaffold(smiles: str) -> str:
    """Strip side chains, keep the ring systems and their linkers."""
    return MurckoScaffold.MurckoScaffoldSmiles(smiles=smiles)
```

Group molecules by scaffold, then cluster the scaffolds that are still similar to each other
(Butina clustering on ECFP4, Tanimoto cutoff 0.6, where Tanimoto is the standard fingerprint
similarity score and 1.0 means identical), then assign whole clusters to train, validation and
test at 70/15/15 with **zero scaffold overlap**. Clustering the scaffolds matters: plain
scaffold splitting still puts two scaffolds differing by one ring-nitrogen on opposite sides.

The honest consequence is the sixteen-point gap in the diagram above. Same data, same model, one
line of code different. The 0.94 is the number that gets into a press release. The 0.78 is the
number that predicts what happens when you point the model at COCONUT.

![Two scatter plots of the same chemical space. Under a random split the held-out points sit inside clusters the model has already seen; under a scaffold split whole clusters are held out](/figures/scaffold-split.svg "The same chemical space, split two ways. Filled points are the test set. On the left every held-out molecule has a near neighbour in training; on the right whole scaffolds are held out and the model has nothing to lean on.")

**Always report the scaffold-split number.** If a paper does not say how it split, assume random
and mentally deduct fifteen points.

---

## 5. Model pluralism

There is no single best architecture for molecular property prediction, and pretending otherwise
costs months. Train several families per virus and select on metrics you declared before you
looked.

**Fingerprints plus classical ML.** Encode the molecule as a bit vector, then throw a
well-regularised tree ensemble at it. ECFP4 (circular substructure fingerprints, radius 2),
MACCS keys and a few dozen physicochemical descriptors, into RandomForest, XGBoost, LightGBM
or a small MLP.

```python
from rdkit import Chem
from rdkit.Chem import rdFingerprintGenerator

# AllChem.GetMorganFingerprintAsBitVect has been deprecated for years now;
# the generator API is the one that will still exist next release.
mfpgen = rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=2048)

mol = Chem.MolFromSmiles(smiles)
fp = mfpgen.GetFingerprint(mol)   # ECFP4-equivalent, 2048 bits
```

Fast, robust, trains on a few hundred labels, and still highly competitive on small datasets,
which describes nearly every understudied target. If you are only going to run one model, run
this one.

**Graph neural networks.** Treat the molecule as a graph, atoms as nodes and bonds as edges, and
let message passing learn a representation instead of using a fixed fingerprint. Chemprop is the
usual choice. Note that Chemprop v2, the 2024 rewrite onto PyTorch Lightning, changed both the
Python API and the command line (`chemprop train ...` rather than the old `chemprop_train`
entry point), so v1 scripts and v1 tutorials will not run against it. GNNs win when you have
thousands of labels and lose when you have hundreds.

**Pretrained molecular encoders.** Since I first built this, fine-tuning a pretrained molecular
model has become routine rather than exotic, in the same way that happened for proteins in
[part 3 of this series](/posts/2026/01/protein-language-models/). They help most in the
low-label regime, which is exactly where the interesting targets live. They change none of the
arithmetic below: a better representation moves the AUC, it does not move the base rate.

**Selection metrics, declared up front:** ROC-AUC and PR-AUC (the precision-recall version) as
primaries, with balanced accuracy, F1, MCC (Matthews correlation coefficient) and a calibration
check as secondaries. PR-AUC earns its place because actives are rare, which brings us to the
number that governs the entire funnel.

---

## 6. Base rates, and why ranking beats classifying

Suppose 1 in 1,000 COCONUT molecules is genuinely active against your protease. Your classifier
is 95% sensitive and 95% specific. Respectable numbers. Now screen 400,000 molecules.

```
true actives            400,000 × 0.001   =       400
  detected at 95%       400 × 0.95        =       380
true inactives          400,000 × 0.999   =   399,600
  false positives at 5% 399,600 × 0.05    =    19,980

flagged as active       380 + 19,980      =    20,360
precision               380 / 20,360      =      1.9%
```

Twenty thousand "hits", of which 98 in 100 are wrong. A wet lab that can test fifty compounds
cannot use that list for anything.

This is the **base-rate fallacy**, and at screening scale it dominates every other
consideration. A 95%-accurate model is close to useless on its own when actives are 0.1% of
the population, and no realistic amount of extra accuracy rescues it: even at 99% specificity
you are still handing over four thousand false positives.

Which reframes the goal entirely. You are not trying to **classify**. You are trying to
**rank**, and then apply independent filters that are wrong in *different* ways from the way
your model is wrong. The funnel exists because no single stage can carry this load.

---

## 7. The funnel

![A funnel from 400,000 catalogued natural products down to 20 candidates, each stage labelled with the filter that produced it, drawn on logarithmic widths](/figures/screening-funnel.svg "Bar widths are logarithmic. On a linear scale every stage after the second one would be invisible. Each filter has to fail differently from the one above it, or the funnel removes nothing it has not already removed.")

Every stage needs a reason to exist, because a funnel whose filters all correlate with each
other filters nothing.

**Drug-likeness, permissive on purpose.** Molecular weight, logP (greasiness, how the molecule
splits between oil and water), hydrogen-bond donors and acceptors, rotatable bonds. Lipinski's
rule of five draws rough bounds around where most oral drugs sit, and natural products famously
and routinely violate it while being excellent drugs anyway: ciclosporin is the standard
example, at well over twice the molecular weight the rule allows. A strict filter here throws
away exactly the chemistry you came for, so set generous bounds and let later stages
discriminate.

**PAINS filters.** Pan-Assay INterference compoundS: substructures that show activity in
*everything*. Reactive groups, aggregators, fluorescence artefacts, redox cyclers. They are not
hits, they are assay noise, and they will eat a wet-lab budget with a smile.

```python
from rdkit.Chem.FilterCatalog import FilterCatalog, FilterCatalogParams

_params = FilterCatalogParams()
_params.AddCatalog(FilterCatalogParams.FilterCatalogs.PAINS)
_pains = FilterCatalog(_params)


def flagged(mol) -> bool:
    # A PAINS match is not proof of interference, only a reason to spend a
    # scarce assay slot on something less likely to waste it.
    return _pains.HasMatch(mol)
```

Worth knowing that the PAINS alerts were derived from a specific set of AlphaScreen assays and
are over-applied as a universal rule. Treat a hit as a deprioritisation, not a verdict.

**Scaffold diversity.** Without a cap, your top 300 are twenty variations on three scaffolds. If
one of those scaffolds turns out to be a dead end, you have learned one thing from 300
experiments. Capping molecules per Murcko scaffold buys *information* rather than ranking.

**Docking.** Does the molecule physically fit the pocket, and how snugly? An orthogonal check:
geometry and physics rather than statistics, scored in kcal/mol, where more negative means a
better predicted fit. The [next post](/posts/2026/04/docking-without-jargon/) covers it
properly. Worth flagging that this is the stage the field has moved on most since I built the
pipeline. Co-folding models that predict the protein-ligand complex directly, and in some cases
a binding affinity alongside it, now sit next to classical docking rather than behind it. They
are genuinely useful, and they are also trained on the same public bioactivity data your ML
stage was trained on, so treat them as a second opinion from a related witness, not an
independent one.

**Interaction analysis.** A good docking score is not enough: the pose has to contact the
residues that matter. For a cysteine protease, is the molecule sitting on the catalytic Cys-His
dyad, or parked in a decorative surface groove with a flattering score?

---

## 8. The final ranking

Consensus, deliberately, from three signals that fail in different ways.

$$
\text{priority} = w_1 \cdot p_{\text{ML}} + w_2 \cdot \tilde{s}_{\text{dock}}
+ w_3 \cdot \tilde{d}_{\text{drug-like}}
$$

The tildes are min-max normalisation within the surviving set, because a docking score in
kcal/mol and a calibrated probability do not share a scale. The weights are ours, not derived
from anything, and the weighted sum is not especially principled.

It earns its place for a different reason:

```
  signal           blind to                     fooled by
  ─────────────────────────────────────────────────────────────────
  ML probability   chemotypes it never saw      assay artefacts
  docking score    desolvation, entropy, water  greasy blobs
  drug-likeness    whether it binds at all      almost anything
  ─────────────────────────────────────────────────────────────────
       three failure modes that barely overlap
            └────────> consensus rank ────────┘
```

Any one of those signals can be gamed by an artefact. Agreement across all three is much harder
to fake, and that, not the arithmetic, is the argument.

Then the honest caveat: **this produces a hypothesis list, not drugs.** Every compound on it
needs a real assay before it means anything. The pipeline's job is to make the wet lab's fifty
experiments far more likely to contain something real than fifty random picks would be. Good
virtual screening campaigns report confirmed hit rates in the low single-digit per cent, against
a random-screening baseline well below a tenth of that. That is all it does, and it is a lot.

---

## 9. Ways this goes wrong

Collected the hard way.

**Activity cliffs.** Two molecules at Tanimoto 0.95 with a thousand-fold difference in potency.
Fingerprint models are close to blind here by construction, because the inputs they see are
nearly identical. If your target's literature is full of cliffs, expect your held-out numbers to
be optimistic even after a clean split.

**Assay heterogeneity.** An IC₅₀ from a biochemical binding assay and an IC₅₀ from a cell-based
assay are not the same quantity. Merging them without recording `assay_type` injects noise you
cannot diagnose afterwards, because the column that would have explained it is gone.

**Decoy bias.** If your negatives are random ZINC molecules and your positives are drug-like
actives, you are back in the
[shortcut-learning problem](/posts/2026/02/honest-negatives-peptide-benchmark/) from the last
post. The model learns "drug-like or not", not "active or not". Property-match your decoys or
accept that your AUC is fiction.

**Docking-score worship.** Docking scores are extremely rough. A -9.2 is not meaningfully better
than a -8.8. Use them as a coarse filter and a plausibility check, never as a fine ranking.

**Leakage through duplicates.** The same molecule appears under different names and identifiers
in ChEMBL and BindingDB, and lands on both sides of your split. Deduplicate on the standardised
structure, never on name or database ID.

**Believing the funnel diagram.** The counts in section 7 are what one run looked like. Change
the drug-likeness bounds and the 180,000 becomes 300,000. The shape is the lesson, not the
digits.

---

## 10. The short version

- Natural products are **evolution-vetted chemical matter**, and COCONUT makes hundreds of
  thousands of them free to download.
- Viral proteases are validated targets, and the **understudied ones (dengue, Zika)** are where
  computation has the most headroom.
- Curation is the real work: standardise structures, harmonise units to nM, **respect the `>`
  qualifier**, pre-declare thresholds, keep viruses strictly isolated.
- **Scaffold-clustered splits, not random.** The gap on our data is roughly 0.94 against 0.78
  AUC, and only the second number predicts deployment.
- At screening scale the **base rate dominates**. You are building a ranker plus orthogonal
  filters, not a classifier, and better accuracy does not rescue you.
- The funnel works because each stage fails *differently*: physicochemistry, ML, PAINS,
  diversity, docking, interactions.
- Keep the tooling current: the RDKit generator API, Chemprop v2, and co-folding models that now
  sit alongside docking rather than behind it.
- The output is a **prioritised hypothesis list**. The wet lab still decides.

---

*Series: **Machine Learning for Biology**. Next up,
[docking explained without the jargon](/posts/2026/04/docking-without-jargon/): what a docking
score actually is, and why you should not trust it as much as you want to.*
