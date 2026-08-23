---
title: "Classical Planning 101: From STRIPS Blocks to Graphplan Magic"
description: "STRIPS, state-space search and planning graphs: turning a to-do list into an algorithm that guarantees the order works."
date: 2024-01-15
permalink: "/posts/2024/01/classical-planning/"
tags:
  - "artificial intelligence"
  - "planning"
  - "strips"
  - "state-space search"
  - "planning graph"
  - "hierarchical planning"
  - "beginner"
series: "AI Foundations"
seriesOrder: 9
math: true
---

*If you’ve ever written a to-do list—**“get key → unlock door → leave house”**—  
you’ve already built a **plan**. Classical planning turns that intuition into algorithms that guarantee the sequence really works.*

This post distills Chapter 10 staples into snack-sized blocks:

1. **What Counts as *Classical* Planning?**  
2. **State-Space Algorithms (Forward, Backward, Heuristics)**  
3. **Planning Graphs & the Graphplan Algorithm**  
4. **Other Approaches (Partial-Order, SAT, Hierarchical)**  
5. **How to Pick the Right Tool**  

No heavy proofs—just tiny STRIPS tables, pocket code, and aha! moments.

---

## 1 Definition of Classical Planning (10·1)

Assumptions—so neat they fit on a postcard:

| Assumption | Means |
|------------|-------|
| **Deterministic** | Each action’s effects are certain |
| **Fully Observable** | The agent always knows the current state |
| **Static** | World changes **only** when agent acts |
| **Discrete & Finite** | Countable states, actions |
| **Goal = logical formula** | e.g. `At(robot, RoomB) ∧ Holding(key)` |

A **problem** is ⟨*States*, *Actions*, *Start*, *Goal*⟩.  
A **solution** is an **ordered list of actions** turning *Start* into any *Goal* state.

---

### 1·1 STRIPS Action Schema

| Field   | Example (`Pickup(x)`) |
|---------|-----------------------|
| **Preconditions** | `HandEmpty ∧ OnTable(x)` |
| **Add list**      | `Holding(x)` |
| **Delete list**   | `HandEmpty, OnTable(x)` |

Think *subtract + add* patches to the world’s fact set.

---

## 2 Algorithms for Planning as **State-Space Search** (10·2)

### 2·1 Forward vs Backward

| Direction | Node = | Branching | Pros |
|-----------|--------|-----------|------|
| **Forward (Progression)** | current state | #actions true now | Easy preconditions |
| **Backward (Regression)** | goal-subgoal | #actions that could achieve subgoal | Ignores irrelevant facts |

### 2·2 Heuristics for Planning

A popular trick: **delete-relaxation**—pretend actions never delete facts ⇒ the relaxed problem is easy and its solution length `h⁺` is **admissible**.

```python
from planning import reachable, actions      # tiny helper stubs
def h_delete_relax(state, goal):
    layer, world = 0, {state}
    while not any(g ⊆ s for s in world):
        layer += 1
        new_states = { s | a.add for s in world for a in actions if a.pre ⊆ s }
        if not new_states: return float("inf")
        world |= new_states
    return layer
```

Combine with **A*** or **Greedy Best-First** for fast solutions on Blocks World.

---

## 3 **Planning Graphs** (10·3)

Graphplan builds a leveled graph:

1. **State levels** $$ ( S_0, S_1, … ) $$ – facts that *could* hold.  
2. **Action levels** $$ ( A_0, A_1, … ) $$ – actions whose pre-conditions appear in $$ ( S_k ) $$.  
3. **Mutex links** – facts/actions that cannot co-occur.

Algorithm:

1. Expand levels until **all goal literals** appear **non-mutex**.  
2. **Backward search** through the graph chooses consistent actions → yields a plan.  
3. If search fails, add another level and repeat.

> **Magic:** Graphplan’s mutual-exclusion pruning often slashes the search space by orders of magnitude.

---

## 4 Other Classical Planning Approaches (10·4)

| Family | Core Idea | Famous Systems |
|--------|-----------|----------------|
| **Partial-Order (POP)** | Leave steps unordered unless needed → flexible plan | UCPOP |
| **Planning-as-SAT** | Encode time-stamped actions as Boolean vars → hand to SAT solver | Blackbox |
| **CSP Encoding** | Similar to SAT but multi-valued vars | Optiplan |
| **Hierarchical Task Networks (HTN)** | Decompose abstract tasks into subtasks | SHOP2 |

> **Rule of thumb:**  
> *Deep recipe with reusable steps?* → **POP/HTN**.  
> *Shallow but huge branching?* → **SAT**.

---

## 5 Analysis & Trade-Offs (10·5)

| Criterion          | State-Search | Graphplan | SAT/CSP | HTN |
|--------------------|-------------|-----------|---------|-----|
| **Plan optimality?** | Yes (with A\*) | Yes | Yes/No (depends) | Designer-guided |
| **Memory use**     | Low          | Medium    | High (CNF grows) | Variable |
| **Domain modeling**| Simple STRIPS | STRIPS | Boolean encode   | Rich (methods) |
| **Scales to 1000s actions?** | Needs good heuristic | Often | Yes (SAT solvers love big) | Yes |

---

## 6 Cheat-Sheet 🧾

```
Classic planning = deterministic, fully observable, finite
STRIPS           = Pre, Add, Delete lists
Progression      = search forward through states
Regression       = search backward from goal
Delete-relax h+  = ignore deletes to get admissible length
Planning graph   = levels of facts/actions + mutex; Graphplan extracts plan
POP              = only order what must be ordered
SAT planning     = encode as Boolean CNF, solve with modern SAT
HTN              = top-down task decomposition
```

---

## 7 Try It Yourself 🧪

1. **Blocks World Race**  
   Implement delete-relax heuristic; compare A\* vs plain BFS on 4-block towers.
2. **Graphplan Visualizer**  
   Build a tiny script that prints each level’s mutex pairs—watch conflicts vanish as levels grow.
3. **SAT Logistics**  
   Encode a 2-city delivery problem (Trucks + Planes) into CNF; feed into a SAT solver; decode model into an action list.

---

### 🚀Final Words

Classical planning is the art of **turning goals into guaranteed recipes**—no surprises, no dice rolls.

*Forward search* plows ahead, *regression* works backward, *Graphplan* meets in the middle, and SAT planners brute-force with modern Boolean muscle. Choose the flavor that matches your puzzle pieces, sprinkle in a smart heuristic, and the plan practically writes itself.

**Happy planning—may your delete lists never bite and your goals appear mutex-free!**
