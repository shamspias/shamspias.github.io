---
title: "Logical Agents 101: Slaying the Wumpus with Pure Reason"
description: "Knowledge bases, entailment, resolution and SAT solving, learned by staying alive in the Wumpus World, with runnable PySAT code."
date: 2023-12-02
permalink: "/posts/2023/12/logical-agents/"
tags:
  - "artificial intelligence"
  - "knowledge representation"
  - "propositional logic"
  - "theorem proving"
  - "sat solver"
  - "wumpus world"
  - "beginner"
series: "AI Foundations"
seriesOrder: 7
math: true
---

*Part 7 of AI Foundations. Every agent so far searched: it guessed a move, looked at the
result, and backed up when it went wrong. This one refuses to move until it can prove the
next square will not kill it. That is a different kind of machine, and the reason SAT
solvers ended up inside your package manager.*

---

## 1. The agent that knows things

If you have played Cluedo, you have run this loop. Somebody shows you a card, you cross a
box on your grid, and three turns later you announce the murderer without ever having seen
the weapon. You did not search the space of possible accusations. You accumulated facts and
took what followed from them.

That is a **knowledge-based agent**. It has three parts. The symbols in the table and the
diagram below get their proper definitions in sections 3 and 4; for now, read `¬` as "not",
`∨` as "or", `↔` as "if and only if", and `⊨` as "entails". The Wumpus is the monster in
the toy cave of section 2, and `P12` means "there is a pit in square (1,2)".

| Part | What it holds | Wumpus example |
|---|---|---|
| Knowledge base (KB) | sentences the agent has committed to | `B11 ↔ (P12 ∨ P21)` |
| Inference engine | derives new sentences from the KB | `¬P21` |
| Action rule | turns beliefs into moves | if `Safe(x,y)` and unvisited, go |

The loop is four steps, and it is worth naming them because the rest of the post is just
those four steps done properly:

```
            percept: breeze at (1,1)
                        │
                        ▼
                  TELL(KB, B11)
                        │
                        ▼
            ┌───────────────────────┐
            │  KB: rules + percepts │
            └───────────┬───────────┘
                        │
                  ASK(KB, ¬P21)
                        │
       ┌────────────────┼────────────────┐
       ▼                ▼                ▼
   KB ⊨ ¬P21        KB ⊨ P21       neither proved
    go there        never go       no safe move
```

Note the three-way split. This is the thing beginners get wrong, and I got it wrong the
first time I wrote one of these. `ASK` does not return true or false. It returns *proved
true*, *proved false*, or *I do not know*, and the third answer is the common one. An agent
that treats "not proved safe" as "proved unsafe" will refuse to move at all.

The material below follows chapter 7 of Russell and Norvig's *Artificial Intelligence: A
Modern Approach*, which is still the clearest treatment of this in print. What has changed
since the book, and what I have added, is section 6 onwards: the solvers.

---

## 2. The Wumpus World

The toy problem is a 4x4 cave. Somewhere in it there is gold, one Wumpus that eats you, and
some bottomless pits. You start at (1,1) and you cannot see. All you get is three local
percepts: a **stench** in any square adjacent to the Wumpus, a **breeze** in any square
adjacent to a pit, and a **glitter** in the square holding the gold.

Here is the standard layout, with every percept written into the square where you would feel
it:

```
          x=1       x=2       x=3       x=4
      ┌─────────┬─────────┬─────────┬─────────┐
  y=4 │ stench  │         │ breeze  │   PIT   │
      ├─────────┼─────────┼─────────┼─────────┤
  y=3 │ WUMPUS  │ stench  │   PIT   │ breeze  │
      │ stench  │ breeze  │         │         │
      │         │ glitter │         │         │
      ├─────────┼─────────┼─────────┼─────────┤
  y=2 │ stench  │         │ breeze  │         │
      ├─────────┼─────────┼─────────┼─────────┤
  y=1 │  START  │ breeze  │   PIT   │ breeze  │
      └─────────┴─────────┴─────────┴─────────┘
```

Why this problem and not something useful? Because it is the smallest world I know of where
searching is genuinely the wrong tool. There is no path to optimise. The map is unknown, the
mistakes are fatal and irreversible, and the only information you get is indirect. You
cannot see a pit. You can only feel a breeze and *work out* where the pit must be.

That last sentence is the whole subject.

---

## 3. Entailment, which is the only idea here

Four words get used constantly and they are easy to blur together.

**Syntax** is what counts as a well-formed sentence. `P12 ∧ ¬B11` is a sentence. `∧ ¬ P12 ∧`
is noise.

**Semantics** is what makes a sentence true. A *model* (I will say *world*) is one complete
assignment of true or false to every symbol. With 3 symbols there are 8 worlds. With 30
there are about a billion.

**Entailment**, written $KB \models \alpha$, means: in every world where the KB is true,
$\alpha$ is also true. It is not about proof or procedure. It is a statement about worlds.
The plain-language version: *if what I already believe is right, then this must be right
too*.

**Inference** is a procedure that actually finds those $\alpha$. Two properties matter:

- **Sound**: everything it derives is genuinely entailed. It never lies.
- **Complete**: everything entailed, it eventually derives. It never misses.

Soundness is the one you cannot trade away. An unsound Wumpus agent walks into pits.
Incompleteness just means it sometimes stands still when it could have moved, and I will
take a cautious agent over a dead one.

---

## 4. Writing the cave down in propositional logic

Propositional logic is the smallest thing that works. Atoms are plain symbols with no
internal structure: `P12` means "there is a pit in (1,2)", `B11` means "I feel a breeze in
(1,1)". Connectives are `¬` (not), `∧` (and), `∨` (or), `→` (implies), `↔` (if and only if).

Now the rule that connects a percept to the world. The naive version is:

$$
B_{1,1} \rightarrow (P_{1,2} \lor P_{2,1})
$$

Read: if I feel a breeze in (1,1), there is a pit in (1,2) or (2,1). True, and useless.
It tells you nothing when you feel *no* breeze, and the whole game is deducing safety from
absence. You need the biconditional:

$$
B_{1,1} \leftrightarrow (P_{1,2} \lor P_{2,1})
$$

Now `¬B11` immediately gives you `¬P12 ∧ ¬P21`, and you have two safe squares. I have
watched this exact bug turn a working agent into one that never leaves the start square,
and the fix was one character.

One rule per square, so 16 breeze rules and 16 stench rules, plus "there is at least one
Wumpus" (a 16-way disjunction) and "there is at most one Wumpus" (120 pairwise clauses like
`¬W11 ∨ ¬W12`). That at-most-one encoding, quadratic in the number of squares, is your first
warning sign about propositional logic. Hold that thought for section 8.

---

## 5. Model checking: just look at every world

The definition of entailment is directly executable. Enumerate every world, throw away the
ones where the KB is false, and check whether $\alpha$ survives in all the rest.

```python
from itertools import product


def entails_by_enumeration(symbols, kb, alpha):
    """KB ⊨ alpha, checked by brute force. kb and alpha are predicates
    over a dict of symbol -> bool."""
    for values in product([False, True], repeat=len(symbols)):
        world = dict(zip(symbols, values))
        if kb(world) and not alpha(world):
            return False          # a counterexample world exists
    return True


symbols = ["B11", "P12", "P21"]
kb = lambda w: (not w["B11"]) and (w["B11"] == (w["P12"] or w["P21"]))
print(entails_by_enumeration(symbols, kb, lambda w: not w["P21"]))  # True
```

Six lines, sound, complete, and correct by construction: it *is* the definition. It is also
$O(2^n)$, and $n$ here is the number of symbols, not squares. A full 4x4 Wumpus KB has
roughly 64 symbols before you add time. That is $2^{64}$ worlds, which is not a slow program,
it is a program that will not finish.

So we need the same answer without visiting every world.

---

## 6. Resolution: one rule, and it is complete

The trick is to stop asking "is $\alpha$ true everywhere?" and start asking "can I make
$\neg\alpha$ work?". If assuming the opposite of your query blows up, the query was
entailed. Formally, $KB \models \alpha$ exactly when $KB \land \neg\alpha$ is unsatisfiable.
This is proof by contradiction, and it is the move that makes everything after it possible.

Resolution is refutation with one inference rule. Convert everything to **conjunctive normal
form** (an AND of ORs, each OR called a clause), add $\neg\alpha$, then repeatedly apply:

$$
\frac{A \lor X, \quad \neg A \lor Y}{X \lor Y}
$$

If two clauses disagree about `A`, whatever else they say must cover the gap. Derive the
**empty clause** and you have your contradiction.

```python
def negate(lit):
    return lit[1:] if lit.startswith("~") else "~" + lit


def resolve(ci, cj):
    """Every resolvent of two clauses, tautologies dropped."""
    out = set()
    for lit in ci:
        if negate(lit) in cj:
            merged = (ci - {lit}) | (cj - {negate(lit)})
            # A clause holding both P and ~P is true in every world, so it
            # can never help close the proof and only widens the search.
            if not any(negate(x) in merged for x in merged):
                out.add(frozenset(merged))
    return out


def entails(kb, alpha):
    """KB ⊨ alpha, by refutation. alpha is a single literal."""
    clauses = set(kb) | {frozenset({negate(alpha)})}
    tried = set()
    while True:
        new = set()
        for ci in clauses:
            for cj in clauses:
                if ci is cj or (ci, cj) in tried:
                    continue
                tried.add((ci, cj))
                for r in resolve(ci, cj):
                    if not r:
                        return True       # empty clause: contradiction
                    new.add(r)
        if new <= clauses:
            return False                  # saturated, no proof exists
        clauses |= new


KB = {
    frozenset({"~P11"}),                     # the start square is safe
    frozenset({"~B11"}),                     # percept: no breeze at (1,1)
    frozenset({"~B11", "P12", "P21"}),       # B11 -> P12 v P21
    frozenset({"B11", "~P12"}),              # P12 -> B11
    frozenset({"B11", "~P21"}),              # P21 -> B11
}
print(entails(KB, "~P21"))   # True
```

The last three clauses are the biconditional from section 4, written out in CNF. The last
one is the half that says a pit at (2,1) would have produced a breeze at (1,1). Delete it
and `entails(KB, "~P21")` flips to `False`: that is the section 4 bug, reproduced in one
line of a Python literal. Delete the one before it instead and this query still succeeds,
but the symmetric query `entails(KB, "~P12")` fails. Each half of the biconditional buys
you exactly one square.

This is sound and it is refutation-complete, which is remarkable for one rule. It is also
the slowest thing in this post. `entails` as written can generate an exponential pile of
clauses. It terminates because there are only finitely many clauses over finitely many
symbols, so the set saturates and `new <= clauses` eventually holds; the `tried` set is a
speed optimisation that stops it re-resolving the same pair forever, not the thing that
makes it stop. Nobody runs this on real problems. It matters because it is the proof that
the idea works, and because the modern solvers are descendants of the same insight.

---

## 7. What actually gets used: SAT solvers

Once you have reduced entailment to "is this CNF satisfiable?", you have handed your problem
to one of the best-optimised pieces of software in computer science.

```
  KB ⊨ α   is the same question as   KB ∧ ¬α is unsatisfiable

  ┌────────────────────────┬────────────────────────────────┐
  │ truth-table            │ CDCL SAT solver                │
  │ enumeration            │ (DPLL + unit propagation       │
  │                        │  + clause learning + restarts) │
  ├────────────────────────┼────────────────────────────────┤
  │ walks all 2^n worlds   │ prunes with every conflict     │
  │ 30 symbols ≈ 10^9 rows │ millions of clauses is routine │
  │ 6 lines of Python      │ decades of engineering         │
  │ exact                  │ exact                          │
  └────────────────────────┴────────────────────────────────┘
```

Both columns give the same answer. The right-hand one gives it on problems the left-hand one
cannot begin. The mechanism, in one sentence each:

- **DPLL** is backtracking search over assignments, same shape as the backtracking in
  [the CSP post](/posts/2023/09/csp-basics/).
- **Unit propagation** is forced moves: a clause with one unassigned literal left leaves you
  no choice, so take it immediately. This is where most of the work happens.
- **Conflict-driven clause learning** is the big one. When the solver hits a contradiction,
  it analyses *why*, writes a new clause recording the cause, and never makes that class of
  mistake again anywhere in the search.
- **Restarts and activity-based variable ordering** stop the solver getting stuck in a bad
  region of the tree.

That is a CDCL solver, and it is why modern SAT is practical. Be clear about the ceiling
though: SAT is NP-complete, the good behaviour is empirical rather than guaranteed, and
small hand-crafted instances (pigeonhole, certain cryptographic encodings) still defeat every
solver on the annual SAT Competition. "Millions of clauses" describes structured industrial
instances, not arbitrary ones.

In Python, use PySAT:

```bash
pip install python-sat
```

```python
from pysat.formula import CNF, IDPool
from pysat.solvers import Solver

pool = IDPool()                             # names to ints, so I never
def P(x, y): return pool.id(f"P{x}{y}")     # hand-number variables
def B(x, y): return pool.id(f"B{x}{y}")
def W(x, y): return pool.id(f"W{x}{y}")

cnf = CNF()
cnf.append([-P(1, 1)])                      # the start square is safe
# B11 <-> (P12 v P21), as three clauses
cnf.append([-B(1, 1), P(1, 2), P(2, 1)])
cnf.append([B(1, 1), -P(1, 2)])
cnf.append([B(1, 1), -P(2, 1)])

with Solver(name="cadical195", bootstrap_with=cnf) as s:
    # "Suppose no breeze at (1,1) AND a pit at (2,1)." If that is
    # unsatisfiable, the KB entails there is no pit at (2,1).
    proved = not s.solve(assumptions=[-B(1, 1), P(2, 1)])
    print("(2,1) provably pit-free:", proved)   # True
```

Three things there are the actual engineering advice, and they are what I would change in
anything written before about 2020.

**Use `Solver(name=...)`, not the old per-class imports.** `Glucose3` and friends still work,
but the named constructor is the current idiom and lets you swap backends in one string.
Recent PySAT builds bundle `cadical153`, `cadical195`, `glucose42`, `minisat22` and others;
`Solver` raises on a name your build does not have, so check rather than guess.

**Use `IDPool`, never literal integers.** Hand-numbering variables is the single most common
source of silent bugs in encodings. You write `-7` meaning "no pit at (2,1)", you are
actually referring to `W34`, and the solver cheerfully returns a wrong answer with total
confidence.

**Use `assumptions=`, not a fresh solver per query.** A Wumpus agent asks dozens of
entailment questions against one slowly growing KB. Assumptions are temporary unit
constraints for a single `solve()` call, so the solver keeps every clause it learnt from
your previous questions. Building a new solver each time throws all of that away. This is
incremental SAT, and it is the difference between a responsive agent and a stuttering one.

For the permanent facts, `s.add_clause([...])` as percepts arrive. For "what if", use
assumptions.

---

## 8. The agent, and where it stops

Putting it together, safety needs two proofs, not one:

```python
def provably_safe(solver, percepts, x, y):
    """Safe means no pit AND no Wumpus, each proved by refutation.
    Two assumption-only calls, so all learnt clauses are retained."""
    no_pit = not solver.solve(assumptions=percepts + [P(x, y)])
    no_wumpus = not solver.solve(assumptions=percepts + [W(x, y)])
    return no_pit and no_wumpus
```

The agent then: start at (1,1), TELL the KB the start square is safe, and loop. Perceive,
TELL. If glitter, grab and head home. Otherwise ask `provably_safe` about each unvisited
neighbour and move to one that answers yes. If none does, back up to a visited square with
an unexplored frontier.

This agent is **sound**: it never enters a square it has not proved safe, so it never dies
by choice. It is not a complete *strategy*, and this is the honest limitation. Sooner or
later it faces three unexplored squares, all of them merely possible pits, and no proof
either way. Logic has nothing more to say. It will sit there forever while a probabilistic
agent works out that one square is far likelier to be safe than the others and takes the
bet. (Russell and Norvig run exactly this calculation in the chapter on probabilistic
reasoning, and the odds are not close.) Certainty runs out before the gold does.

The second limitation is the one that ends propositional logic. Everything above is written
per square. Sixteen breeze rules, sixteen stench rules, 120 pairwise clauses for "at most one
Wumpus". Go to a 100x100 cave and that last encoding alone is about fifty million pairwise
clauses, generated by a Python loop. That loop is the giveaway: you know a general rule ("a
breeze appears next to every pit") and your language cannot say it, so you hand-expand a
universally quantified statement because your logic has no variables and no objects.

That is exactly the gap first-order logic fills, and it is the next post.

---

## 9. Why this still matters in 2026

This chapter reads like history and is not. The reduction "encode the problem, hand it to a
solver" is now infrastructure:

- **Hardware and software verification.** Bounded model checking is a SAT problem, and it is
  how chips get verified before fabrication.
- **Dependency resolution.** Working out which package versions can coexist is a satisfiability
  problem, and several package managers solve it as one.
- **SMT solvers** (Z3, cvc5) are the grown-up version: SAT plus theories for arithmetic,
  arrays, strings and bit-vectors, so you can write `x + 2*y < 10` instead of encoding
  integers in bits by hand. If you reach for a solver today, reach for one of these first.

There is also a live connection to how I build LLM systems now. Language models are good at
translating a messy English requirement into a formal encoding and unreliable at executing
the search that encoding implies. Solvers are the reverse. So the pattern that works is LLM
as front end, solver as back end, with the guarantee living in the solver. It is the same
instinct as [enforcing rules in code rather than in a
prompt](/posts/2025/12/safe-by-default-agents/): put the part that must be right somewhere
you can check it.

---

## 10. The short version

- A knowledge-based agent runs perceive, TELL, ASK, act. `ASK` has three answers, and
  "unknown" is the common one.
- $KB \models \alpha$ means $\alpha$ holds in every world where the KB holds. Soundness is
  non-negotiable; incompleteness only costs you moves.
- Write percept rules as biconditionals. `B11 → (P12 ∨ P21)` cannot prove anything safe;
  `B11 ↔ (P12 ∨ P21)` can.
- Entailment becomes satisfiability: $KB \models \alpha$ iff $KB \land \neg\alpha$ has no
  model. That reduction is the whole reason solvers apply.
- Truth-table enumeration is six lines and dies at roughly 30 symbols. Resolution is one
  rule and complete but exponential. CDCL solvers are what you actually run.
- With PySAT: `Solver(name=...)`, `IDPool` for variable numbering, `assumptions=` for
  repeated queries against a growing KB.
- The agent stops when nothing is provable and it must gamble. That is where probability
  starts.
- Propositional logic has no objects and no variables, so rules get hand-expanded per square.
  That is the wall first-order logic breaks.

*Next: [First-Order Logic](/posts/2023/12/first-order-logic/), where the cave gets objects,
relations and quantifiers, and 120 pairwise clauses collapse into one sentence.*
