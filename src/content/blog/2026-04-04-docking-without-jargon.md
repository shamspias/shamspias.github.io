---
title: "Molecular Docking Without the Jargon: A Key, a Lock, and Both of Them Wobble"
seoTitle: "Molecular Docking Without the Jargon"
description: "What a docking score really is, why the pose matters more than the number, six ways docking lies to you, and where 2026 co-folding models fit."
date: 2026-04-04
permalink: "/posts/2026/04/docking-without-jargon/"
tags:
  - "drug discovery"
  - "molecular docking"
  - "cheminformatics"
  - "structural biology"
  - "bioinformatics"
  - "beginner"
series: "Machine Learning for Biology"
seriesOrder: 6
math: true
---

*Part 6 of the machine-learning-for-biology series. What a docking score is, what it isn't, and
why the number that comes back deserves considerably less trust than it invites.*

---

## 1. The lock and key, and where the picture breaks

Every textbook opens the same way. A drug is a key, its target protein is a lock, and drug
design is the business of cutting a key that fits.

That is a good enough place to start. Then you have to break it, because both objects in the
metaphor are wrong in the same direction: they are rigid, and nothing here is rigid.

**The lock breathes.** A protein at body temperature is not a casting. Side chains rotate, loops
flap, whole domains hinge. The pocket you see in a crystal structure is one frame of a film, and
usually a frame chosen by whatever was bound to it when the crystal was grown. Some pockets do
not exist at all until a ligand arrives and induces them.

**The key bends.** A drug-sized molecule with six rotatable bonds has hundreds of accessible
shapes at room temperature. It is not one key. It is a keyring, and it presents whichever shape
suits the lock, paying an energetic price for the privilege.

**Water is already in the keyhole.** The pocket is full of ordered water molecules. To bind, the
ligand has to evict some of them and may need to keep others as bridges. Water is a participant,
not background.

So the real question is not "does this key fit". In plain terms it is: are these two happier
together than apart? Stated precisely, is the free energy of the bound complex, plus the water
that got displaced into bulk, lower than the free energy of the two partners floating separately
and fully solvated?

**Docking** is our attempt to answer that with a computer, quickly, for a very large number of
molecules.

---

## 2. What docking actually computes

Two pieces, and it pays to keep them separate in your head: a **search** and a **score**.

```
  ligand (SMILES)                   protein (PDB entry)
         │                                   │
  3-D conformers                    pocket + search box
         │                                   │
         └───────────────┬───────────────────┘
                         ▼
          ┌──────────────────────────────┐
          │ SEARCH  propose a pose:      │◀─────┐
          │ x, y, z, orientation,        │      │
          │ torsion angles               │      │
          └──────────────┬───────────────┘      │ keep the good
                         ▼                      │ ones, perturb,
          ┌──────────────────────────────┐      │ repeat
          │ SCORE  shape fit, charge,    │──────┘
          │ H-bonds, desolvation, strain │
          └──────────────┬───────────────┘
                         ▼
              ranked poses, each with a
              number in kcal/mol
```

**The search** generates candidate placements. A *pose* is a position, an orientation, and a set
of torsion angles. The space is huge, so engines use genetic algorithms, Monte Carlo with local
gradient refinement, or both.

**The score** estimates the binding free energy of each pose with a function fast enough to run
millions of times:

$$
\Delta G_{\text{bind}} \approx \underbrace{E_{\text{vdW}}}_{\text{shape fit}}
+ \underbrace{E_{\text{elec}}}_{\text{charges}}
+ \underbrace{E_{\text{hbond}}}_{\text{H-bonds}}
+ \underbrace{E_{\text{desolv}}}_{\text{water cost}}
+ \underbrace{E_{\text{torsion}}}_{\text{strain}}
$$

Treat that as a sketch rather than a specification. AutoDock4 splits it roughly along those
lines. Vina uses a smaller empirical set of steric, hydrophobic and hydrogen-bonding terms
fitted to measured affinities, then divides the total by a factor that grows with the number
of rotatable bonds, so a floppy molecule gets no free credit for the extra contacts its
flexibility buys.
Different engines, different terms, same ambition.

The output is in **kcal/mol**, and more negative is better:

| Score (kcal/mol) | How I read it |
|---|---|
| -4 to -6 | weak, probably nothing |
| -6 to -8 | plausible, worth a look |
| **-8 to -10** | **good, and where I put the hit threshold** |
| below -10 | strong, and now be suspicious |

We use **≤ -8.0 kcal/mol** as the hit threshold in the
[400,000-compound screening pipeline](/posts/2026/03/screening-400k-natural-products/).

Now the caveat, up front rather than in a footnote. That scoring function is a fast
approximation of an enormously complex thermodynamic quantity. It has to return in seconds. It
approximates entropy crudely, treats water as a featureless continuum, and in the standard setup
holds the protein completely rigid.

The practical consequence is worth stating in the field's own vocabulary. Scoring functions have
decent **screening power**, meaning they enrich true binders near the top of a large ranked
list, and poor **ranking power**, meaning they order a handful of related molecules by affinity
barely better than chance. Correlations between docking score and measured affinity on diverse
benchmark sets are usually somewhere below $r \approx 0.5$, and within a single chemical series,
where you most want the answer, they collapse towards nothing. Useful as a sieve. Not a
measurement.

---

## 3. Running it, honestly

The mechanics, so the abstractions have something to stand on.

### Step 1. Prepare the protein

Crystal structures are not simulation-ready. You add hydrogens, because X-ray crystallography
mostly cannot see them. You assign protonation states at physiological pH. You strip
crystallographic waters and buffer components, decide which waters to keep, and rebuild missing
side chains.

Protonation is not a detail. A protonated histidine makes an ionic contact; the same histidine
neutral makes a hydrogen bond and points its atoms elsewhere. Get it wrong and you are docking
into a pocket that differs chemically from the one you believe you are studying.

In practice: PDBFixer for missing atoms and residues, PDB2PQR with PROPKA for pH-dependent
protonation, and Meeko to write the PDBQT files that AutoDock-family engines expect. If a
tutorial tells you to run `prepare_receptor4.py` from MGLTools, it is old. That toolchain is
Python 2 and effectively unmaintained. Meeko is where that job lives now.

### Step 2. Define the box

Where should the ligand be allowed to go?

```python
# Centre the box on a ligand from a co-crystal structure of this same target.
# "Ligand-informed" means exactly this, and nothing more mystical.
xyz = ref_ligand.GetConformer().GetPositions()   # RDKit, shape (N, 3)
box_center = xyz.mean(axis=0)
box_size = (22, 22, 22)                          # Angstroms per side
```

Blind docking across a whole protein surface mostly discovers shallow decorative grooves with
flattering scores, because a shallow groove is an easy place to make contacts without committing
to anything. Placing the box on a co-crystallised ligand is the single cheapest way to get sane
results, which is why every target in the pipeline has to come with a ligand-bound structure.

### Step 3. Prepare the ligand

SMILES is a 2-D string. Docking needs 3-D coordinates, a sensible protonation state at pH 7.4,
and a starting geometry that is not strained nonsense.

```python
from rdkit import Chem
from rdkit.Chem import AllChem

mol = Chem.AddHs(Chem.MolFromSmiles(smiles))

params = AllChem.ETKDGv3()   # torsion priors from crystal data, not raw geometry
params.randomSeed = 0xf00d   # docking gets re-run; irreproducible input is a trap
AllChem.EmbedMultipleConfs(mol, numConfs=10, params=params)
AllChem.MMFFOptimizeMoleculeConfs(mol)
```

Ionisation deserves its own tool. Dimorphite-DL or Open Babel's `obabel -p 7.4` will enumerate
the states a molecule plausibly occupies at physiological pH, and a carboxylic acid docked as a
neutral species is a different molecule from the one in the assay.

### Step 4. Dock

```python
from vina import Vina

v = Vina(sf_name="vina")
v.set_receptor("target.pdbqt")
v.set_ligand_from_file("ligand.pdbqt")
v.compute_vina_maps(center=[12.4, -3.1, 27.8], box_size=[22, 22, 22])

# Default exhaustiveness is 8. For anything I intend to act on, that is too low:
# the search is stochastic and 8 gives visibly unstable top poses.
v.dock(exhaustiveness=32, n_poses=20)
v.write_poses("out.pdbqt", n_poses=5, overwrite=True)
```

Vina, Smina, GNINA or a commercial engine. GNINA layers a convolutional-network rescorer on top
of Smina's sampling, and in my experience it improves which pose gets ranked first considerably
more than it improves the affinity number attached to it. That is the right trade, given how
little the number is worth.

### Step 5. Look at the pose

Not the score. The pose. This is the step people skip, and it is the step that decides whether
any of this was worth doing.

---

## 4. The score is the least interesting output

A docking score is one number summarising a complicated geometric claim. The claim is where the
information is.

For the viral proteases in this series the question is specific: does the pose contact the
catalytic residues?

```
   CATALYTIC SITE                    A DECORATIVE GROOVE
   ──────────────                    ───────────────────
   His41 ─── Cys145                  shallow surface dip,
      ╲         ╱                    far from anything
       ╲       ╱                     functional
      [ ligand ]                          [ ligand ]

   score          -8.4               score          -8.9
   blocks the enzyme   yes           blocks the enzyme   no
```

The second molecule scores better and is worthless. It sits somewhere that does not stop the
protease cutting anything. Rank on score alone and it takes the wet-lab slot while the useful
molecule goes in the bin.

So the checks that actually gate a candidate:

**Catalytic contact.** SARS-CoV-2 Mpro is a cysteine protease with a His41–Cys145 dyad. HIV-1
protease is an aspartyl protease with two catalytic aspartates at the dimer interface. Is the
ligand *there*, or merely nearby?

**Interaction fingerprints.** Encode the contacts as a bit vector: hydrogen bond to residue X,
pi-stack with residue Y, hydrophobic contact with Z. PLIP and ProLIF both do this. Then compare
against the fingerprint of a known inhibitor in the same pocket. A candidate that reproduces a
known binding mode is far more believable than one with a slightly better score and a contact
pattern nobody has seen before.

**Physical validity.** Since the PoseBusters work in 2023 and 2024 this has become a routine
gate rather than an afterthought. The checks are unglamorous and catch a lot: correct bond
lengths and angles, no internal clashes, no atoms overlapping the protein, stereochemistry
preserved from the input. Deep-learning docking methods in particular were producing poses that
looked excellent by their own metrics and were chemically impossible, and running a validity
filter is how that stopped being invisible.

**Internal strain.** Some engines will happily report a fine score for a ligand twisted into a
conformation that costs more energy to adopt than the binding gains back. Compare the docked
conformer's energy against a relaxed one.

**Buriedness.** Real binders are enclosed. A ligand lying flat on the surface with half its area
exposed to solvent is usually an artefact of a box that was too generous.

---

## 5. Six ways docking lies to you

I learned most of these by making them.

**1. The rigid-protein assumption.** Standard docking holds the receptor fixed, so a genuine
binder can score badly purely because the crystal conformation is not the binding conformation.
This shows up sharply in the gap between redocking a ligand into its own structure, which
succeeds a decent fraction of the time, and cross-docking it into a structure solved with a
different ligand, which is markedly worse. *Mitigation:* dock against an ensemble of structures
of the same protein, or let selected side chains rotate.

**2. Score inflation with size.** Bigger molecules make more contacts, so they score better
almost mechanically. Left alone, your top ten will be greasy and enormous. *Mitigation:* ligand
efficiency,

$$
\text{LE} = \frac{-\Delta G}{N_{\text{heavy atoms}}}
$$

which rewards binding per atom rather than sheer bulk.

**3. Entropy is barely modelled.** A rigid ligand and a floppy ligand making identical contacts
do not bind equally well, because the floppy one pays for the freedom it gives up. Fast scoring
functions approximate that with a torsion count, which is better than nothing and not much more.

**4. Water is a continuum.** A single structural water bridging ligand and protein can be worth
more than any term in the function, and the entropic bonus from evicting an unhappy ordered
water is invisible to implicit solvent.

**5. False precision.** A score of -9.2 against -8.8 is noise. Treat scores as **bins**, never
as a leaderboard. This is the mistake I see most often in otherwise careful work, usually in the
form of a sorted spreadsheet nobody questions.

**6. Metals and covalent binders.** Zinc-dependent proteases, haem, and covalent inhibitors need
specialised parameters or a covalent docking protocol. A general scoring function handles them
badly, and it will not tell you that it is doing so.

---

## 6. Why bother: docking fails differently from machine learning

Given all of that, why run it at all?

Because its failures do not overlap with the failures of the models sitting above it in the
funnel, and that is the entire value.

| | ML model | Docking |
|---|---|---|
| Built on | statistics of past actives | geometry and physics |
| Needs | labelled data | a structure |
| Fails on | novel chemotypes | flexible pockets, entropy |
| Fooled by | dataset shortcuts | large greasy molecules |
| Speed | milliseconds | seconds to minutes |

A model trained on known HIV-protease inhibitors is skilled at recognising things that resemble
known HIV-protease inhibitors, and its confidence is calibrated on that resemblance and nothing
else. It has no notion of whether a molecule can physically occupy the pocket.

Docking has no idea what has worked before, and every idea about fit.

When a molecule survives both, with a high ML probability *and* a physically valid pose against
the catalytic residues, you have two independent lines of evidence that fail for unrelated
reasons. That is not proof. It is the kind of agreement worth spending a wet-lab slot on.

That is why the funnel is shaped the way it is: cheap and statistical first, expensive and
physical second. Machine learning takes 400,000 to roughly 1,800, a diversity filter takes that
to about 300, docking takes 300 to about 60, and interaction analysis gets you to twenty.

---

## 7. Beyond docking, and what changed by 2026

### Co-folding models

The honest update, against how I would have written this three years ago: classical docking is
no longer the only way to get a pose. Since AlphaFold 3 in 2024 there has been a steady run of
models that fold protein and ligand together and predict the complex directly, several of them
with open weights, Boltz and Chai-1 among them. They need no search box and no PDBQT
preparation, which removes a whole category of setup error.

They are not a replacement for the funnel, for three reasons. They are far more expensive per
molecule than Vina and want a GPU, so they belong after the list is short, not at the top. They
reproduce binding modes best for pockets that resemble their training data, which is the same
generalisation problem I described for
[protein language models](/posts/2026/01/protein-language-models/), just with coordinates as the
output. And the newer ones that also predict affinity, Boltz-2 most loudly, are making genuinely
interesting claims about approaching free-energy-perturbation accuracy at a fraction of the
cost, which I would like to be true and would not yet build a decision on.

What I would actually do in 2026: dock to triage the library, then co-fold the survivors as an
independent second opinion on the binding mode. Where the two disagree about where the ligand
sits, that disagreement is information, and it is usually pointing at a flexible pocket.

### The cost ladder

Docking is the cheap end of a spectrum that stretches a long way.

```
  cheap ──────────────────────────────────────────────▶ expensive

  docking          MM-GBSA          MD 100 ns        FEP
  ~1-30 s          ~minutes         ~hours           hours to days
  400k molecules   ~1k molecules    ~10 molecules    ~10 pairs
  a pose, a bin    a better rank    does it hold     a delta you
                                                     can act on
```

**MM-GBSA rescoring** re-evaluates the docked pose with a better energy model and implicit
solvent. Minutes per molecule, a modest and inconsistent accuracy gain. Worth it for tens of
compounds, not for thousands.

**Molecular dynamics** simulates the complex and watches whether the pose survives. This is the
honest test of pose stability, and a ligand that drifts out of the pocket in 100 ns was never
really bound. Hours per molecule.

**Free-energy perturbation** is the reference method for *relative* affinity between closely
related molecules. Expensive, fussy to set up, genuinely predictive within a congeneric series.
It is a lead-optimisation tool, not a screening tool.

The progression is always the same trade, speed for accuracy. Start fast and coarse on
everything, and spend the expensive methods only on survivors.

---

## 8. The short version

- Docking is a **search** over poses plus a **fast approximate score** in kcal/mol. More
  negative is better, and ≤ -8.0 is a reasonable hit threshold.
- Both the key and the lock flex, and the keyhole is full of water. Standard docking ignores
  most of that, on purpose, to stay fast.
- Scoring functions have usable screening power and poor ranking power. Use scores as a sieve
  and as bins, never as a leaderboard.
- **Centre the box on a co-crystallised ligand.** Blind docking finds decorative grooves that
  score beautifully and block nothing.
- **Read the pose, not the number.** It has to touch the catalytic residues, reproduce the
  interaction fingerprint of a known inhibitor, and survive a physical-validity check.
- Correct for molecular size with ligand efficiency, or your shortlist will be large and greasy.
- Docking earns its place because it fails differently from ML. Agreement between the two is the
  actual signal.
- In 2026, co-folding models are a strong second opinion on the binding mode for a short list,
  and still too expensive and too training-set-shaped to run the top of the funnel.

---

*Series: **Machine Learning for Biology**. Coming next, a change of subject with the same idea
underneath. Pose estimation applied to a body rather than a molecule:
[measuring a cricket bowler's action](/posts/2026/05/bowling-biomechanics-pose/).*
