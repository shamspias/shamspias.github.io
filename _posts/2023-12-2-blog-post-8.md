---
title: "Logical Agents 101: Slaying the Wumpus with Pure Reason"
date: 2023-12-02
permalink: /posts/2023/12/logical-agents/
tags:
  - artificial intelligence
  - knowledge representation
  - propositional logic
  - theorem proving
  - sat solver
  - wumpus world
  - beginner
math: true
---

*If you’ve ever used clues in a murder-mystery board game—  
“Mrs Peacock **and** the Revolver can’t **both** be innocent!”—  
you already reason like a **logical agent***.

This post unwraps Chapter 7 classics in snack-sized pieces:

1. **Knowledge-Based Agents**
2. **The Wumpus World (our cartoon dungeon)**
3. **What Even *Is* Logic?**
4. **Propositional Logic, the Tiny But Mighty**
5. **Theorem Proving by Resolution**
6. **Model Checking & SAT, Super-Fast Proof by Search**
7. **Building a Wumpus-Safe Agent**

No sweeping proofs—just pocket math, word-pictures, and tiny code.

---

## 1 Knowledge-Based Agents (7·1)

| Layer                | Purpose                           | Example                 |
|----------------------|-----------------------------------|-------------------------|
| **KB**               | Store *sentences* (facts + rules) | `B13 → P23`             |
| **Inference Engine** | Entail new sentences              | `¬P23`                  |
| **Action Rule**      | Map beliefs → actions             | “If gold ∧ safe → grab” |

> **Loop:** *Perceive → Tell KB → Ask KB → Act*.

---

## 2 Welcome to the **Wumpus World** (7·2)

A 4×4 grid with:

* **Gold** (yay)
* **Wumpus** (fangs)
* **Pits** (fall, game over)

Percepts:

- **Stench** ← Wumpus adjacent
- **Breeze** ← Pit adjacent
- **Glitter** ← Gold here

Goal: grab gold, climb out—alive.

> **Fun fact:** a real Wumpus agent won the early AAAI “gold-mining” contest.

---

## 3 Logic in One Sip (7·3)

| Concept        | One-liner                                                   |
|----------------|-------------------------------------------------------------|
| **Syntax**     | How you write sentences                                     |
| **Semantics**  | What makes them true/false                                  |
| **Entailment** | KB ⊨ α means every world where KB is true also makes α true |
| **Inference**  | Procedure that derives α from KB                            |

A system is **sound** if it never lies, **complete** if it finds every truth.

---

## 4 Propositional Logic: The Tiny Giant (7·4)

*Atoms* = symbols `P23`, `B13`, …  
*Connectives* = `¬, ∧, ∨, →`.

Example rule:

$$
B_{13} \;\rightarrow\; P_{23}\lor P_{14}.
$$

Read: *If I feel a breeze in (1,3), then there’s a pit in (2,3) **or** (1,4).*

---

## 5 Proving Theorems by **Resolution** (7·5)

1. Convert everything to **CNF** (clauses).
2. Add `¬α` (negated query).
3. Repeatedly apply the single rule:

$$
\frac{A\lor X,\;\;¬A\lor Y}{X\lor Y}
$$

4. Derive the **empty clause** ⇒ contradiction ⇒ KB ⊨ α.

> **Why it rocks:** one rule, easy for computers.

### 5·1 Mini Code – Resolution in 12 Lines

```python
def resolve(ci, cj):
    resolvents = set()
    for lit in ci:
        if ('¬' + lit) in cj or (lit.startswith('¬') and lit[1:] in cj):
            resolvents.add(tuple(sorted((ci - {lit}) | (cj - {lit.lstrip('¬')}))))
    return resolvents


def pl_resolution(kb, alpha):
    clauses = kb | {tuple('¬' + l for l in alpha)}
    new = set()
    while True:
        pairs = [(ci, cj) for i, ci in enumerate(clauses)
                 for cj in list(clauses)[i + 1:]]
        for (ci, cj) in pairs:
            for resolvent in resolve(set(ci), set(cj)):
                if not resolvent:  # derived empty clause
                    return True
                new.add(resolvent)
        if new.issubset(clauses):
            return False
        clauses |= new
```

Works for toy Wumpus deductions.

---

## 6 Effective Model Checking → **SAT** (7·6)

Truth-table enumeration is $$ (O(2^n)) $$ .  
Modern trick: hand the CNF to a **SAT solver** ⇒ millions of variables in seconds.

> **DPLL + unit propagation + clause learning** = industrial magic.

### 6·1 Snap-In Python SAT

```python
from pysat.solvers import Glucose3

g = Glucose3()
# add CNF clauses as lists of ints, e.g. [1, -2]  (P1 ∨ ¬P2)
for clause in cnf:
    g.add_clause(clause)
print(g.solve())
```

---

## 7 Agents Based on Propositional Logic (7·7)

**Wumpus Agent Algorithm**

1. Start in (1,1), KB ← `¬P11 ∧ ¬W11`.
2. Loop:
    * Perceive (`stench`, `breeze`, …) ⇒ add to KB.
    * Ask KB which neighboring squares are **safe** (`Ask(KB, Safe(x,y))`).
    * If safe ∧ unvisited ⇒ move there.
    * Else, if glitter ⇒ `Grab`; if at exit ⇒ `Climb`.
    * Else, plan safest route home.

Proved **sound**: never steps into a cell it’s unsure is safe.

---

## 8 Cheat-Sheet 🧾

```
KB agent  = Perceive → Tell → Ask → Act
Entailment (⊨) = All worlds of KB make α true
Resolution    = One-rule refutation proof in CNF
SAT solving   = Model checking via Boolean search
DPLL          = Backtracking SAT with smart pruning
Wumpus agent  = Marks safe cells, moves only where ⊨ Safe
Sound         = Never derives false; Complete = finds all truths
```

---

## 9 Try It Yourself 🧪

1. **Prove Safe Squares**  
   Encode a 2×2 Wumpus world; ask a SAT solver if (1,2) is pit-free after a breeze in (1,1).
2. **CNF Speed Test**  
   Grow random 50-symbol KBs; compare resolution vs PySAT runtime.
3. **Build a Mini Wumpus GUI**  
   Use Pygame; wire your logical agent to move live—watch it hesitate at breezes!

---

### 🚀Final Words

Classical search shows *how* to get somewhere once the world is friendly.  
**Logical agents** thrive when the world is *mysterious* but rule-bound:

- Stuff the facts into a KB,
- Let sound inference spit out certainties,
- And act only on what’s provably safe.

Master these moves and you’ll not just dodge the Wumpus—you’ll out-reason any labyrinth built of pure logic.

**Happy reasoning—may your clauses always resolve to truth!**