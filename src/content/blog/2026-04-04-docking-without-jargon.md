---
title: "Molecular Docking Without the Jargon: A Key, a Lock, and Both of Them Wobble 🔑"
description: "What a docking score is, why the pose matters far more than the number, and six ways docking quietly lies to you."
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
why the number you get back deserves less trust than it invites.*

---

## 1. The lock-and-key picture, and where it breaks 🔓

Every textbook opens the same way: a drug is a key, its target protein is a lock, and drug
design is cutting a key that fits.

It's a good enough starting point. Then you have to break it, because both objects are wrong in
the same way.

**The lock breathes.** A protein at body temperature is not a rigid casting. Side chains rotate,
loops flap, whole domains hinge. The binding pocket you see in a crystal structure is one frame
of a movie. Some pockets don't even *exist* until a ligand arrives and induces them.

**The key bends.** A drug-sized molecule with six rotatable bonds has hundreds of accessible
shapes. It isn't one key; it's a keyring, and it picks whichever shape suits the lock.

**Water is in the keyhole.** The pocket is full of ordered water molecules. To bind, the ligand
has to evict some and may need to keep others as bridges. Water is a participant, not background.

So the real question is not *"does this key fit"*. It's:

> Out of all the shapes this molecule can take, and all the shapes this pocket can take, is
> there a pairing they'd both rather be in than floating separately in water?

**Docking** is our attempt to answer that with a computer, quickly, for a lot of molecules.

---

## 2. What docking actually computes 🧮

Two pieces: a **search** and a **score**.

**The search.** Generate many candidate placements of the ligand in the pocket, a *pose* being a
position, an orientation, and a set of torsion angles. Millions of possibilities, explored by
genetic algorithms, Monte Carlo, or gradient methods.

**The score.** For each pose, estimate binding affinity with a fast approximate function:

$$
\Delta G_{\text{bind}} \approx \underbrace{E_{\text{vdW}}}_{\text{shape fit}}
+ \underbrace{E_{\text{elec}}}_{\text{charges}}
+ \underbrace{E_{\text{hbond}}}_{\text{H-bonds}}
+ \underbrace{E_{\text{desolv}}}_{\text{water cost}}
+ \underbrace{E_{\text{torsion}}}_{\text{strain}}
$$

Reported in **kcal/mol**, and more negative is better:

| Score | Reading |
|---|---|
| −4 to −6 | weak; probably nothing |
| −6 to −8 | plausible, worth a look |
| **−8 to −10** | **good; typical hit threshold** |
| below −10 | strong, and be suspicious |

We use **≤ −8.0 kcal/mol** as the hit threshold in the
[screening pipeline](/posts/2026/03/screening-400k-natural-products/).

Now the important caveat, up front rather than buried: that scoring function is a **fast
approximation of an enormously complex thermodynamic quantity**. It has to run in seconds. It
approximates entropy crudely, treats water implicitly, and usually holds the protein rigid.

Typical correlation between docking scores and measured affinities is roughly $r \approx 0.5$ on
a good day. Useful. Not trustworthy at fine resolution.

---

## 3. Running it, roughly 🛠️

The mechanics, so the abstractions have something to sit on.

**Step 1. Prepare the protein.** Crystal structures are not simulation-ready. Add hydrogens
(X-ray usually can't see them), assign protonation states at physiological pH, remove
crystallographic waters and buffer molecules, fix missing side chains, assign charges.

Protonation is not a detail. A histidine that is protonated makes an ionic contact; the same
histidine neutral makes a hydrogen bond. Get it wrong and you're docking into a different pocket
than you think.

**Step 2. Define the box.** Where should the ligand go?

```python
# Best practice: centre the box on a KNOWN ligand from a co-crystal structure.
# This is what "ligand-informed" means.
box_center = known_ligand.centroid()      # from the PDB entry
box_size   = (22, 22, 22)                 # Angstroms
```

Blind docking over a whole protein surface mostly finds shallow decorative grooves with
flattering scores. Using a co-crystallised ligand to place the box is the single easiest way to
get sane results, which is why we insist on **ligand-informed structures** for every target.

**Step 3. Prepare the ligand.** SMILES is 2-D. You need 3-D coordinates, correct protonation,
and sensible starting geometry:

```python
from rdkit import Chem
from rdkit.Chem import AllChem

mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
AllChem.EmbedMultipleConfs(mol, numConfs=10, randomSeed=42)   # several starting shapes
AllChem.MMFFOptimizeMoleculeConfs(mol)                        # relax each one
```

**Step 4. Dock.** AutoDock Vina, Smina, GNINA, or a commercial engine. Out comes a ranked list
of poses with scores.

**Step 5. Look at the pose.** Not just the score. This is the step people skip, and it's the
step that matters most.

---

## 4. The score is the least interesting output 👀

A docking score is one number summarising a complicated geometric claim. The claim is where the
information is.

For our viral proteases the question is specific: **does the pose contact the catalytic
residues?**

```
       CATALYTIC SITE                     A DECORATIVE GROOVE
       ─────────────────                  ────────────────────
    His41 ─── Cys145                          surface pocket,
       ╲       ╱                              far from anything
        ╲     ╱                               functional
      [ ligand ]                              [ ligand ]
                                                  ↑
    score: -8.4   ✅ blocks catalysis         score: -8.9   ❌ blocks nothing
```

The second molecule scores *better* and is worthless. It sits somewhere that doesn't stop the
protease from cutting anything. If you rank purely on score, it goes to the wet lab and the good
molecule doesn't.

So the checks that actually gate a candidate:

**Catalytic contact.** SARS-CoV-2 Mpro is a cysteine protease with a His41–Cys145 dyad. HIV-1
protease is an aspartyl protease with two catalytic aspartates. Is the ligand *there*?

**Interaction fingerprints.** Encode the contacts as a bit vector: H-bond to residue X, π-stack
with residue Y, hydrophobic contact with Z. Then compare to the fingerprint of a *known*
inhibitor. A candidate reproducing the known binding mode is far more believable than one with a
good score and an unfamiliar contact pattern.

**Internal strain.** Some engines happily report a great score for a ligand twisted into a
conformation that costs more energy to adopt than the binding gains. Check the torsions.

**Buriedness.** Real binders are enclosed by the pocket. A ligand lying flat on the surface with
half its area exposed to solvent is usually an artefact.

---

## 5. Six ways docking lies to you 🤥

Learned by making most of these mistakes.

**1. The rigid-protein assumption.** Standard docking holds the protein fixed. If your target has
a flexible loop or an induced-fit pocket, a real binder can score badly simply because the
crystal conformation isn't the binding conformation. **Mitigation:** dock against several
structures of the same protein (ensemble docking), or allow selected side chains to move.

**2. Score inflation with size.** Bigger molecules make more contacts, so they score better,
almost mechanically. **Mitigation:** ligand efficiency,

$$
\text{LE} = \frac{-\Delta G}{N_{\text{heavy atoms}}}
$$

which rewards efficient binding rather than sheer bulk.

**3. Entropy is barely modelled.** A rigid ligand and a floppy ligand that make identical
contacts do *not* bind equally, because the floppy one pays an entropic price on binding.
Scoring functions approximate this with a crude torsion penalty at best.

**4. Water is treated as a continuum.** Individual bridging waters, and the entropic bonus from
evicting ordered water, matter enormously and are mostly invisible to fast scoring.

**5. False precision.** −9.2 versus −8.8 is noise. Treat scores as **bins**, not as a
leaderboard. This is the mistake I see most often in otherwise careful work.

**6. Metals and covalent binders.** Zinc-dependent proteases and covalent inhibitors need
specialised treatment; standard scoring functions handle them badly or not at all.

---

## 6. Where docking sits in the pipeline 🧩

Given all of that, why bother?

Because **docking fails differently from machine learning**, and that's the entire value.

| | ML model | Docking |
|---|---|---|
| Based on | statistics of past actives | geometry and physics |
| Needs | labelled data | a structure |
| Fails on | novel chemotypes | flexible pockets, entropy |
| Fooled by | dataset shortcuts | large greasy molecules |
| Speed | ~milliseconds | ~seconds to minutes |

An ML model trained on known HIV-protease inhibitors is skilled at recognising things that look
like known HIV-protease inhibitors, and its confidence is calibrated on that resemblance. It has
no notion of whether a molecule can physically fit.

Docking has no idea what has worked before, and every idea about fit.

When a molecule survives both, with a high ML probability *and* a plausible pose at the
catalytic site, you have two independent lines of evidence. Not proof, but the kind of agreement
worth spending a wet-lab slot on.

That's why the funnel is a funnel: **cheap and statistical first, expensive and physical
second.** ML narrows 400,000 to ~1,800; docking narrows ~300 to ~60; interaction analysis gets
you to twenty.

---

## 7. If you want to go deeper 🔬

Docking is the cheap end of a spectrum. Beyond it:

**MM-GBSA / MM-PBSA rescoring.** Take the docked pose and rescore with a better energy model.
Minutes per molecule instead of seconds. Modest accuracy gain, worth it for tens of compounds
but not thousands.

**Molecular dynamics.** Simulate the complex over nanoseconds and watch whether the pose holds.
Hours to days per molecule. This is the honest way to test pose stability, and a pose that drifts
out of the pocket in 10 ns was never real.

**Free-energy perturbation (FEP).** The gold standard for *relative* affinity between closely
related molecules. Expensive, needs careful setup, genuinely predictive within a series. Used for
lead optimisation, not for screening 400,000 compounds.

The progression is always the same trade: **speed for accuracy**. Start fast and coarse on
everything; spend the expensive methods only on survivors.

---

## 8. The short version 📝

- Docking = **search** over poses + **fast approximate score** in kcal/mol. More negative is
  better; ≤ −8.0 is a common hit threshold.
- Both key and lock are flexible, and water is in the pocket. Standard docking ignores most of
  that.
- Score–affinity correlation is around $r \approx 0.5$. Useful as a **filter**, not as a ranking.
- **Centre the box on a known co-crystallised ligand.** Blind docking finds decorative grooves.
- **Read the pose, not the number.** Does it touch the catalytic residues? Does the interaction
  fingerprint resemble a known inhibitor's?
- Correct for size with **ligand efficiency**; treat scores as bins.
- Docking is valuable because it **fails differently from ML**. Agreement between the two is the
  actual signal.

---

*Series: **Machine Learning for Biology**. Coming next, a change of subject. The same pose
estimation idea, applied to a body instead of a molecule:
[measuring a cricket bowler's action](/posts/2026/05/bowling-biomechanics-pose/).*
