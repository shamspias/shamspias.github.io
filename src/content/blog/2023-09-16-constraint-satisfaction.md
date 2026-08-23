---
title: "Constraint Satisfaction 101: From Sudoku Logic to Map-Coloring Zen"
description: "Arc consistency, backtracking with MRV and min-conflicts, explained through Sudoku and map colouring, plus what you would actually use today."
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

*Part 6 of the AI Foundations series. Every previous part searched through states without
knowing what a state was made of. This is where the solver gets to look inside, and where
looking inside turns an impossible search into an easy one.*

---

## 1. The idea: rules that must all hold at once

If you have ever solved a Sudoku, arranged a wedding seating plan so two feuding uncles are
not at the same table, or worked out a university timetable, you have done constraint
satisfaction. You had a set of blanks, a set of things that could go in each blank, and a
list of rules that all had to be true at the end. There was no "score" to maximise. A
filling was either legal or it was not.

Formally, a **constraint satisfaction problem** is three things:

| Part | Meaning | Sudoku | Map colouring |
|---|---|---|---|
| $X$ | the variables | 81 cells | 7 Australian regions |
| $D$ | a domain per variable | $\{1..9\}$ each | $\{$red, green, blue$\}$ each |
| $C$ | constraints on subsets | rows, columns, boxes all-different | neighbours differ |

A **solution** is an assignment of one value from $D_i$ to every $X_i$ such that every
constraint in $C$ is satisfied.

Here is the map colouring problem drawn as what it really is, a graph where each edge is a
constraint:

```
                 ┌────┐
      ┌──────────│ NT │──────────┐
      │          └──┬─┘          │
   ┌──┴─┐        ┌──┴──┐       ┌─┴──┐
   │ WA │────────│ SA  │───────│ Q  │
   └────┘        └──┬──┘       └─┬──┘
              ┌─────┴─────┐      │
           ┌──┴──┐     ┌──┴──┐   │
           │  V  │─────│ NSW │───┘
           └─────┘     └─────┘

   ┌────┐
   │ T  │   an island: no constraints, so its colour is free
   └────┘
```

Seven variables, three values each, nine binary constraints (a binary constraint is one that
links exactly two variables). That picture is the whole problem, and in section 5 the shape of
that picture turns out to matter more than any algorithm you run on it.

**Why bother writing a problem this way?** In [part 3](/posts/2023/04/ai-agents-search/) a
state was an opaque blob, and the search algorithm could only ask "is this the goal?" and
"what are the neighbours?". A CSP state is transparent: the solver can see that the blob is a
partial assignment, which means it can reason about what is still possible before it commits
to anything. That single change is the difference between brute forcing $9^{81}$ fillings of a
Sudoku grid (about $10^{77}$, a number no amount of hardware will ever get through) and a
solver that finishes in milliseconds.

The cost, and I want to be honest about it up front, is that the modelling is now your job
and it is where most of the difficulty lives. Two correct models of the same problem can
differ by several orders of magnitude in solve time. Nothing in this post rescues a bad model.

---

## 2. Propagation: shrink the domains before you guess

The first move is not to search. It is to delete values that cannot possibly be part of any
solution, and then delete the values that the first round of deletions made impossible, and
so on until nothing changes.

The workhorse notion is **arc consistency**. An arc $(X_i, X_j)$ is consistent when, for every
value left in $D_i$, there is at least one value in $D_j$ that satisfies the constraint between
them. If some value $a \in D_i$ has no such partner, then $a$ can never appear in a solution,
so delete it. That deletion may in turn strip the last support from a value in some other
variable, which is why the process cascades.

**AC-3** is the standard way to run this to a fixed point. Keep a queue of arcs, pop one,
revise it, and if the revision removed anything, push back every arc pointing at the variable
you just shrank.

```python
from collections import deque


def revise(domains, xi, xj, allowed):
    """Drop values of xi that no remaining value of xj can support."""
    removed = False
    for a in list(domains[xi]):
        if not any(allowed(xi, a, xj, b) for b in domains[xj]):
            domains[xi].remove(a)
            removed = True
    return removed


def ac3(variables, domains, neighbours, allowed):
    """Prune to arc consistency. Returns False if some domain empties out."""
    queue = deque((xi, xj) for xi in variables for xj in neighbours[xi])
    while queue:
        xi, xj = queue.popleft()
        if revise(domains, xi, xj, allowed):
            if not domains[xi]:
                return False
            # xi lost values, so anything that leaned on xi may have lost support too
            queue.extend((xk, xi) for xk in neighbours[xi] if xk != xj)
    return True
```

AC-3 runs in $O(ed^3)$ for $e$ binary constraints and domain size $d$. For Sudoku that is 810
not-equal constraints (each cell shares a row, column or box with 20 peers, and
$81 \times 20 / 2 = 810$) with $d = 9$, so a few hundred thousand support checks in the worst
case. That is nothing. AC-4 achieves the theoretically better $O(ed^2)$ by caching support
counts, but its constants are bad enough that AC-3 usually wins in practice, which is a good
early lesson in reading complexity bounds.

### 2.1 What arc consistency cannot see

Arc consistency looks at two variables at a time, and there are things two variables at a time
simply cannot notice. Take three cells from the same Sudoku row:

```
   ┌──────────────┐   AC-3, pairwise    ┌──────────────┐
   │ A  {1, 2}    │                     │ A  {1, 2}    │
   │ B  {1, 2}    │  ─────────────────► │ B  {1, 2}    │
   │ C  {1, 2, 3} │   nothing removed   │ C  {1, 2, 3} │
   └──────────────┘                     └──────────────┘

   ┌──────────────┐   all-different     ┌──────────────┐
   │ A  {1, 2}    │   as one constraint │ A  {1, 2}    │
   │ B  {1, 2}    │  ─────────────────► │ B  {1, 2}    │
   │ C  {1, 2, 3} │   C loses 1 and 2   │ C  {3}       │
   └──────────────┘                     └──────────────┘
```

Pairwise, everything is fine: A can be 1 if B is 2, C can be 1 if A is 2. But A and B between
them have used up both 1 and 2, so C must be 3. A human Sudoku player calls this a "naked
pair" and spots it instantly. AC-3 on the decomposed binary constraints never will.

The fix is to keep `all-different` as a single **global constraint** and give it its own
propagator. Régin's 1994 algorithm does exactly this by building a bipartite graph of variables
against values and running a maximum matching: any value-edge that belongs to no maximum
matching can be deleted. This is generalised arc consistency, and it is the reason real solvers
ship a library of global constraints (`all_different`, `cumulative`, `circuit`, `table`) instead
of asking you to expand everything into binary pairs. If you take one modelling lesson from
this post, take that one: expressing a rule as one global constraint rather than $n^2$ small
ones is usually the single largest speedup available.

---

## 3. Backtracking, and the three heuristics that make it finish

Propagation alone rarely finishes the job. Easy Sudokus fall to pure propagation; harder ones
reach a fixed point with several candidates still alive in many cells. Then you have to guess,
and guessing means you need to be able to un-guess.

Backtracking search assigns one variable at a time and undoes the assignment when it fails. In
its naive form it is hopeless. Three cheap additions change that:

| Heuristic | What it does | Why it helps |
|---|---|---|
| MRV, minimum remaining values | smallest domain first | fail fast: two options, two tries |
| Degree | break MRV ties on most constraints | that assignment prunes the most domains |
| LCV, least constraining value | costs neighbours least | aim at the likeliest branch |

Note that MRV and LCV pull in opposite directions on purpose. On variables you want to fail
fast, because you must eventually try them all. On values you want to succeed fast, because you
only need one to work.

The fourth addition is to keep propagating during the search. **Forward checking** removes the
just-assigned value from the domains of the neighbours. **Maintaining arc consistency (MAC)**
goes further: it runs AC-3 with the queue seeded by the arcs pointing at the variable you just
assigned, and lets the cascade run wherever it goes from there. MAC costs more per node and it
is almost always worth it.

```python
def backtrack(assignment, domains, csp):
    if len(assignment) == len(csp.variables):
        return assignment

    var = min(
        (v for v in csp.variables if v not in assignment),
        key=lambda v: (len(domains[v]), -csp.degree[v]),  # MRV, degree breaks ties
    )

    for value in csp.order_values_lcv(var, domains):
        # MAC can prune any variable, not just the neighbours, so a partial
        # snapshot would restore the wrong state on backtrack. A trail of
        # (variable, value) removals is cheaper; a full copy is fine at this size.
        saved = {v: set(d) for v, d in domains.items()}
        assignment[var] = value
        domains[var] = {value}

        if csp.propagate(var, domains):  # forward checking, or MAC
            result = backtrack(assignment, domains, csp)
            if result is not None:
                return result

        domains.update(saved)
        del assignment[var]

    return None
```

The whole loop, propagate then choose then recurse, looks like this:

```
   ┌────────────────────────────────────────────────┐
   │ 1. propagate every constraint to a fixed point │
   └───────────────────────┬────────────────────────┘
                           ▼
                   any domain empty?   ─── yes ──►  backtrack
                           │
                          no
                           ▼
               every domain a singleton?   ─ yes ──►  solved
                           │
                          no
                           ▼
   ┌────────────────────────────────────────────────┐
   │ 2. take the smallest domain (MRV), then try    │
   │    its least-constraining value                │
   └───────────────────────┬────────────────────────┘
                           └───────────► back to 1
```

On real numbers: Peter Norvig's
[Solving Every Sudoku Puzzle](https://norvig.com/sudoku.html) is worth reading in full and
implements exactly this, constraint propagation plus MRV-ordered search. He reported average
solve times in the hundredths of a second on 2006 hardware for a set of puzzles chosen to be
hard. On a current laptop a straightforward Python implementation lands in the low
milliseconds for typical puzzles. The interesting part is not the absolute number, it is the
ratio: propagation plus MRV against naive backtracking on the same grid is orders of magnitude,
and on adversarially constructed puzzles the naive version does not finish at all.

I will admit my own past mistake here. The first Sudoku solver I wrote checked consistency
only at the moment of assignment and had no propagation, and I concluded that Python was too
slow for this. Python was fine. My algorithm was the problem.

---

## 4. Local search, for when you do not need a proof

Backtracking is complete: if a solution exists it will find one, and if none exists it will
eventually say so. That completeness is expensive, and often you do not need it. A timetable
with 20,000 variables does not need a proof of anything, it needs an answer by Friday.

**Min-conflicts** starts from a complete but broken assignment and repairs it:

1. Assign every variable, randomly or greedily.
2. While some constraint is violated, pick a variable involved in a violation and set it to
   the value that leaves the fewest violations overall. Break ties at random.

That is the whole algorithm, and it is startlingly effective on large uniform problems. The
classic result on n-queens, from Minton and colleagues around 1990, is that the number of
repair steps barely grows with $n$: the million-queens instance is reported at roughly fifty
repairs on average, while systematic backtracking is out of the question at that size.

This is hill climbing on the number of violated constraints, so everything from
[part 4](/posts/2023/07/beyond-search/) applies: it gets stuck in local minima, and the fixes
are the same ones, random restarts, sideways moves, simulated annealing, or a tabu list of
recently changed variables. Modern local search solvers add constraint weighting, which raises
the weight of constraints that keep being violated so the search stops circling the same
plateau.

What it costs: min-conflicts can never tell you a problem is unsatisfiable. It will just run
forever. If "no solution exists" is a possible and important answer, you need a systematic
solver.

---

## 5. Structure beats cleverness

Look at the constraint graph before you tune anything.

If the graph is a **tree**, you do not need backtracking at all. Root it anywhere, sweep from
the leaves to the root making every arc consistent with its parent, then sweep back down
assigning values. This is $O(nd^2)$, linear in the number of variables, and it never backtracks.

Most real graphs are not trees, but many are close. **Cutset conditioning** picks a small set
of $c$ variables whose removal leaves a tree, enumerates all $d^c$ assignments to that cutset,
and solves the remaining tree in linear time each go. Total cost $O(d^c \cdot (n-c)d^2)$, which
is excellent when $c$ is small and catastrophic when it is not. In the Australia map, deleting
SA alone leaves a tree, so $c = 1$: three assignments to SA, three linear sweeps, done.

The general version is **tree decomposition**, which groups variables into overlapping clusters
arranged in a tree; the cost is exponential in the tree width, the size of the largest cluster
minus one. Tree width is the single number that best predicts whether a CSP is tractable, and
it is worth computing an approximation of it before you decide the problem is hard.

The practical version of all this: sparse constraint graphs are easy and dense ones are not,
and how you write the model determines the density.

---

## 6. What you would actually use in 2026

Everything above is how the machinery works, and you should understand it. You should also not
implement it. The first version of this post treated a hand-rolled solver as the destination.
That was already the wrong advice in 2023, and it is thoroughly wrong now.

Reach for Google **OR-Tools CP-SAT**. It is a hybrid: a constraint programming front end with a
library of global constraints, over a SAT engine with clause learning and restarts, running in
parallel across cores. It consistently places at the top of the MiniZinc Challenge. In practice
it beats anything you or I would write by a margin that is not close.

```python
from ortools.sat.python import cp_model

clues = {(0, 0): 5, (0, 1): 3, (4, 4): 7}  # {(row, col): given digit}, 0-indexed

model = cp_model.CpModel()
cell = {
    (r, c): model.new_int_var(1, 9, f"c{r}{c}") for r in range(9) for c in range(9)
}

for i in range(9):
    model.add_all_different([cell[i, c] for c in range(9)])  # rows
    model.add_all_different([cell[r, i] for r in range(9)])  # columns

for br in range(0, 9, 3):
    for bc in range(0, 9, 3):
        model.add_all_different(
            [cell[br + r, bc + c] for r in range(3) for c in range(3)]
        )

for (r, c), given in clues.items():
    model.add(cell[r, c] == given)

solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = 10.0
status = solver.solve(model)
assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
```

Two notes on that snippet. First, `add_all_different` is one global constraint per group, not
36 pairwise inequalities, exactly the point from section 2.1. Second, the OR-Tools Python API
moved to snake_case (`new_int_var`, `add_all_different`, `solve`) during the 9.x line; older
tutorials show `NewIntVar` and `Solve`, which still work as aliases but are the tell of a stale
example.

| If you have | Use | Why |
|---|---|---|
| scheduling, rostering, routing, packing | OR-Tools CP-SAT | globals, clause learning |
| a model you want kept portable | MiniZinc | one model, several solver back ends |
| unbounded integers, bitvectors, strings | an SMT solver like Z3 | richer theories than CP |
| a huge instance, any feasible answer | min-conflicts | scales where search cannot |
| a teaching example or tiny puzzle | your own backtracking | you learn more, no dependencies |

One more 2026 point, because people get this wrong constantly. Do not ask a language model to
solve a constraint problem by reasoning through it. It will produce a fluent, confidently wrong
grid. Ask it to write the CP-SAT model, then run the solver, then check the solver's answer.
The model is good at translating a messy English specification into constraints, which is the
part humans find tedious; the solver is good at satisfying them, which is the part that needs a
guarantee. That division of labour is the same one this whole series keeps arriving at.

---

## 7. The short version

- A CSP is variables, domains and constraints, and its power comes from the solver being able
  to see inside a state instead of treating it as an opaque blob.
- Propagate before you search. Arc consistency deletes values that no partner value can
  support, and cascades until nothing changes.
- Pairwise arc consistency is blind to things like "these two cells have used up both
  candidates". Model with global constraints such as `all_different` and let their propagators
  see it.
- When you must guess, guess well: MRV picks the variable most likely to fail fast, degree
  breaks ties, LCV picks the value most likely to succeed, and MAC keeps propagating as you go.
- Min-conflicts repairs a broken complete assignment and scales to problems systematic search
  cannot touch, but it can never prove that no solution exists.
- Look at the constraint graph first. Trees solve in $O(nd^2)$ with no backtracking, and a
  small cutset gets you most of the way there.
- In production, use OR-Tools CP-SAT or MiniZinc. Write the solver yourself only to learn.
- Use a language model to write the model, not to solve it.

*Next in the series: [logical agents](/posts/2023/12/logical-agents/), where the constraints
stop being about values in domains and start being about what is true.*
