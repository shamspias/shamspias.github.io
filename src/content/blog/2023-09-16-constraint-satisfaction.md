---
title: "Constraint Satisfaction 101: From Sudoku Logic to Map-Coloring Zen"
description: "Backtracking, arc consistency and the heuristics that make constraint solving fast, explained through Sudoku and map colouring."
date: 2023-09-16
permalink: "/posts/2023/09/csp-basics/"
tags:
  - "artificial intelligence"
  - "constraint satisfaction"
  - "csp"
  - "backtracking"
  - "arc consistency"
  - "sudoku"
  - "beginner"
series: "AI Foundations"
seriesOrder: 6
math: true
---

*If you’ve ever solved a Sudoku, arranged seats so rivals don’t sit together,  
or packed a suitcase “Tetris-style,” you already think like a **CSP solver**.*

This friendly tour distills Chapter&nbsp;6 topics into snack-sized bites:

1. **What *is* a Constraint Satisfaction Problem?**  
2. **Inference by Constraint Propagation (Arc Consistency)**  
3. **Backtracking Search that Actually Finishes**  
4. **Local Search for “Almost” Solutions**  
5. **Why Problem Structure Matters**

No heavy proofs—just colorful diagrams-in-words, tiny code, and aha! moments.

---

## 1 Defining a CSP (6·1)

A **CSP** is three lists:

| Symbol | Meaning | Example (Sudoku) |
|--------|---------|------------------|
| \(X\)  | Variables | 81 squares |
| \(D\)  | Domains   | {1 … 9} each |
| \(C\)  | Constraints | “Row has all digits 1-9” |

Goal: choose one value per variable so **all constraints are true**.

> **Metaphor:** fill the blanks so **every rule** on the puzzle box lights green. ✅

---

### 1·1 CSPs in One Line of Python

```python
# X = variables, D = domains, C = constraints (callable)
CSP = (X, D, C)  # tiny but captures every classic puzzle
```

---

## 2 Constraint Propagation – Inference in CSPs (6·2)

> **Idea:** Shrink domains *before* you search.

### 2·1 Arc Consistency (AC-3)

An **arc** $$ ( (X_i, X_j) ) $$ is consistent if   
for every value in $$ ( D_i ) $$ there exists some value in $$ ( D_j ) $$ satisfying the constraint.

AC-3 loop:

1. Put every arc in a queue `Q`.  
2. Pop $$ ((X_i,X_j)) $$ .  
3. **Revise** $$ (D_i) $$: delete any value that’s inconsistent with $$ (D_j) $$ .  
4. If $$ (D_i) $$ shrank, re-queue all neighbors of $$ (X_i) $$ .

Complexity: $$ ( O(e d^3) ) (edges × domain^3) $$ —cheap for puzzles like Sudoku.

```python
def ac3(csp):
    X, D, neighbors = csp
    Q = [(Xi, Xj) for Xi in X for Xj in neighbors[Xi]]
    while Q:
        Xi, Xj = Q.pop()
        if revise(D, Xi, Xj, neighbors[(Xi, Xj)]):
            if not D[Xi]:                      # domain wiped out → failure
                return False
            Q += [(Xk, Xi) for Xk in neighbors[Xi] if Xk != Xj]
    return True
```

---

## 3 Backtracking Search (6·3)

The *brute* solver—but with three superpowers:

| Trick                      | Why it rocks |
|----------------------------|--------------|
| **MRV** (Minimum-Remaining-Values) | Pick the “most desperate” variable first. |
| **Degree Heuristic**      | Break ties via variable with most constraints. |
| **Forward Checking**      | After a guess, prune domains of neighbors. |

Combined: millions → thousands of branches.

### 3·1 One-Screen Demo – Backtracking Sudoku

```python
def backtrack(assignment):
    if len(assignment) == 81:
        return assignment
    var = select_unassigned_var(assignment)     # MRV + Degree
    for val in order_domain_vals(var, assignment):  # Least-Constraining-Value
        if consistent(var, val, assignment):
            assignment[var] = val
            removed = forward_check(var, val)   # prune
            result = backtrack(assignment)
            if result:
                return result
            undo(assignment, removed)           # backtrack
    del assignment[var]
    return None
```

Solves a medium Sudoku in < 0.01 s on a laptop.

---

## 4 Local Search for CSPs (6·4)

When variables are numerous (timetables, 1 000-queen), try **Min-Conflicts**:

1. Start with a *random* complete assignment.  
2. While conflicts exist:  
   &nbsp;&nbsp;a. Pick a variable in conflict.  
   &nbsp;&nbsp;b. Set it to the value that creates the fewest conflicts.

> **Fun fact:** beats backtracking for $$ ( n )-queen even at ( n = 10^5 ) $$.

---

## 5 The Structure of Problems (6·5)

Not all graphs are equal:

| Topology              | Magic Tool | Why |
|-----------------------|-----------|-----|
| **Tree-structured**   | **Tree CSP** algorithm | Solve in \( O(nd^2) \) – linear! |
| **Nearly tree**       | **Cutset conditioning** | Remove a few vars → tree |
| **Planar / Grid**     | Heavy local structure → AC-3 rocks |

**Moral:** look at the constraint graph *first*; shape often beats algorithm tweaks.

---

## 6 Cheat-Sheet 🧾

```
CSP              = (Variables, Domains, Constraints)
Arc consistency  = Delete domain values with no support
AC-3             = Queue of arcs; prune till fixed point
Backtracking + MRV + FC = Classic exact solver
Min-Conflicts    = Hill-climb on number of constraint violations
Structure        = Tree → linear time; sparse graph → fast
```

---

## 7 Try It Yourself 🧪

1. **KenKen Killer**  
   Model a 4×4 KenKen as a CSP; watch AC-3 cut domains to singletons.
2. **Graph Coloring Challenge**  
   Random planar graph with 20 nodes—compare vanilla backtracking vs MRV+FC.
3. **1 000-Queen Speed Race**  
   Min-Conflicts vs Simulated Annealing; plot conflicts over iterations.

---

### 🚀Final Words

A Constraint Satisfaction Problem is **pure logic** in a tidy data structure.

- **Propagate** first—why guess 9 when 3, 5, 7 are already crossed out?  
- **Search smart**—let MRV choose the next headache and forward checking snip dead ends.  
- **Exploit shape**—a tree needs *zero* backtracking!

Master these moves and you’ll breeze through Sudoku, map coloring, scheduling, and any puzzle that whispers, “All rules must fit at once.”

**Happy constraining—may your domains shrink fast and your solutions fit like glove!**
