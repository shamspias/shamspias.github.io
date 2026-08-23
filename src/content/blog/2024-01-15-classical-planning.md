---
title: "Classical Planning 101: From STRIPS Blocks to Graphplan Magic"
description: "How STRIPS turns a to-do list into an algorithm: factored states, progression and regression, delete relaxation, planning graphs, and what a 2026 planner really does."
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

*Part 9 of the AI Foundations series. A to-do list is already a plan: get the key, unlock the
door, leave the house. What classical planning adds is the machinery to check that the order
really works, and to find an order when you cannot see one yourself.*

---

## 1. Planning is search with the lid off

Back in [part 3](/posts/2023/04/ai-agents-search/) we searched over states, and a state was a
black box. You could ask "are these two states the same?" and "what does this action do to
this state?", and that was the whole interface. Every heuristic, that is, every cheap guess at
how far you still are from the goal, had to be handwritten by a human who understood the
domain.

Planning changes exactly one thing, and everything follows from it: **the state is opened up
into a set of facts, and the actions are described in the same vocabulary as the goal**. That
sounds like bookkeeping. It is the entire trick. Once the planner can read the goal and read
the action descriptions in the same language, it can derive its own heuristic, automatically,
for a domain it has never seen. That is why planning gets its own chapter instead of being a
footnote in the search chapter.

The classical setting fences off the easy corner of the world so the algorithms have something
firm to stand on:

| Assumption | What it means | What breaks without it |
|---|---|---|
| Deterministic | Each action has exactly one outcome | You need policies, not plans |
| Fully observable | The agent always knows the current state | You need belief states |
| Static | The world changes only when the agent acts | Your plan goes stale mid-execution |
| Discrete and finite | Countable facts, countable actions | You need numeric or continuous planning |
| Instantaneous | Actions have no duration and do not overlap | You need temporal planning |

A problem is the tuple $\langle F, A, s_0, g \rangle$: a set of facts, a set of actions, an
initial state (the subset of facts that start out true), and a goal (a set of facts that must
end up true). A solution is an ordered list of actions that carries $s_0$ into any state
containing $g$.

Every one of those assumptions is false in production. That is fine. Classical planning is the
base case, and the interesting extensions (probabilistic, partially observable, temporal) are
all defined as departures from it. Learn the base case properly and the rest reads as
modifications.

---

## 2. STRIPS: a state is a set, an action is a patch

STRIPS is from 1971 (Fikes and Nilsson at SRI, for the robot Shakey) and it is still the
mental model everyone uses. An action carries three sets of facts:

- **Preconditions**: facts that must be true before you can run it.
- **Delete list**: facts it makes false.
- **Add list**: facts it makes true.

Applying an action to a state is set arithmetic: `s' = (s - delete) | add`. Nothing else in
the world moves. That last part is the **STRIPS assumption**, and it is the cheap answer to
the frame problem we ran into in [part 7](/posts/2023/12/logical-agents/): rather than writing
axioms that say what stays the same, you declare that anything not mentioned stays the same.

```
      state s                 pick-up(A)                state s'
  ┌─────────────┐        ┌──────────────────┐        ┌─────────────┐
  │ on-table(A) │        │ pre  clear(A)    │        │ on-table(B) │
  │ on-table(B) │        │      on-table(A) │        │ clear(B)    │
  │ clear(A)    │        │      hand-empty  │        │ holding(A)  │
  │ clear(B)    │  ────▶ │ del  clear(A)    │  ────▶ │             │
  │ hand-empty  │        │      on-table(A) │        │             │
  │             │        │      hand-empty  │        │             │
  │             │        │ add  holding(A)  │        │             │
  └─────────────┘        └──────────────────┘        └─────────────┘
```

In practice nobody writes STRIPS tables any more. Since 1998 the interchange format has been
**PDDL**, written for the first International Planning Competition, and it is still what every
planner reads in 2026. It splits the model in two: a *domain* file with the action schemas, and
a *problem* file with the objects, the initial state and the goal. The add and delete lists
collapse into a single `:effect` where deletions are written as negations.

```pddl
(define (domain blocks)
  (:requirements :strips :typing)
  (:types block)
  (:predicates (on ?x - block ?y - block)
               (on-table ?x - block)
               (clear ?x - block)
               (hand-empty)
               (holding ?x - block))

  (:action pick-up
    :parameters (?x - block)
    :precondition (and (clear ?x) (on-table ?x) (hand-empty))
    :effect (and (holding ?x)
                 (not (clear ?x))
                 (not (on-table ?x))
                 (not (hand-empty))))

  (:action stack
    :parameters (?x - block ?y - block)
    :precondition (and (holding ?x) (clear ?y))
    :effect (and (on ?x ?y)
                 (clear ?x)
                 (hand-empty)
                 (not (holding ?x))
                 (not (clear ?y)))))
```

```pddl
(define (problem two-blocks)
  (:domain blocks)
  (:objects a b - block)
  (:init (on-table a) (on-table b) (clear a) (clear b) (hand-empty))
  (:goal (and (on a b))))
```

Two practical notes that cost me time when I first used this. First, the schema above is
*lifted*: it has a variable `?x`. Planners **ground** it, instantiating one action per legal
binding, before search begins. A dozen schemas over fifty objects routinely grounds to tens of
thousands of actions, and for large problems grounding is the step that runs out of memory,
not search. Second, PDDL kept growing: version 2.1 added durative actions and numeric fluents,
2.2 added derived predicates and timed initial literals, 3.0 added state trajectory constraints
and preferences. Support is uneven. Check what your planner actually implements before you
model against a feature.

---

## 3. Forward, backward, and which one won

There are two obvious directions to search, and the history of which one is preferred is worth
knowing because it explains why modern planners look the way they do.

```
  progression (forward)              regression (backward)
  ─────────────────────────          ─────────────────────────
  node = one complete state          node = a set of subgoals
  s0 ─▶ ? ─▶ ? ─▶ goal               s0 ◀─ ? ◀─ ? ◀─ goal
  branch on every applicable         branch on every action whose
  action, often thousands            add list supplies a subgoal
  every node is a real state         a subgoal set may be
  you could actually reach           unreachable, or self-contradictory
  goal test: g ⊆ s                   goal test: subgoals ⊆ s0
```

Regression looks better on paper. It only ever considers facts that are relevant to the goal,
and the branching factor is smaller. Through the 1970s and 1980s that argument won, and most
planners searched backward.

Then in the late 1990s the delete-relaxation heuristics arrived (HSP in 1998, FF in 2000) and
forward search overtook it almost overnight. The reason is that a progression node is a
complete, concrete state, so you can compute an informative heuristic on it cheaply. A
regression node is a partial description, and evaluating it means reasoning about a whole class
of states, which is harder and vaguer. A good heuristic on a fat branching factor beats a poor
heuristic on a thin one, every time. Nearly every satisficing planner that wins anything today
searches forward. The durable exception is the optimal track, where symbolic search, which
manipulates enormous sets of states at once rather than one state at a time, still takes
prizes without using a heuristic at all.

---

## 4. Where the heuristic comes from

This is the part I care about most, because it is the idea that transfers. You do not
handwrite a heuristic per domain. You **relax the problem automatically**, solve the easy
version, and use its cost as an estimate.

The relaxation that works is delete relaxation: throw away every delete list. Now facts only
ever accumulate, nothing you have achieved can be undone, and the resulting problem is
solvable in polynomial time. The optimal cost of that relaxed problem is called $h^+$, and
because deleting the delete lists can only make things easier, $h^+ \le h^*$: it is admissible,
meaning it never overestimates, which is the property A* needs to promise you an optimal plan.

There is a catch, and I taught it wrong for a while before I noticed. Computing $h^+$ exactly
is NP-hard, so nobody does it. Planners compute approximations, and only some of them are
ordered against the truth:

$$
h^{\max} \;\le\; h^{+} \;\le\; h^{*}
\qquad\text{and}\qquad
h^{\max} \;\le\; h^{\text{add}}
$$

Note what the second chain does not say. $h^{\text{add}}$ sits above $h^{\max}$ and it is
inadmissible, but it is not an upper bound on $h^{*}$. In a domain where the real difficulty
lives in the delete lists, every delete-relaxation heuristic, $h^{\text{add}}$ included, can
come in far under the true cost. Inadmissible means "sometimes too high", never "always too
high".

| Heuristic | How it estimates a set of facts | Admissible | Use it when |
|---|---|---|---|
| $h^{\max}$ | cost of the single hardest fact | yes | you want optimality and nothing better |
| $h^{\text{add}}$ | sum over facts, pretending independence | no | you want a sharper number |
| $h^{\text{FF}}$ | length of one extracted relaxed plan | no | satisficing search, the workhorse |
| LM-cut | landmark cuts over the relaxed graph | yes | optimal search, the modern default |

$h^{\max}$ is admissible but weak, because it charges you only for the hardest subgoal and
ignores everything else. $h^{\text{add}}$ is far more informative but double-counts shared
work, so it can overshoot and you lose the optimality guarantee. $h^{\text{FF}}$ splits the
difference: extract one actual relaxed plan and count its actions. That is at least $h^+$ and
usually close to it, and it tracks the true cost well enough that greedy best-first search with
$h^{\text{FF}}$ has been the default for satisficing search ever since 2000. Satisficing here
means find a good plan quickly and do not insist it is the shortest one.

Here is $h^{\max}$ computed honestly, for unit-cost actions, where the layer index at which a
fact first appears *is* its $h^{\max}$ value.

```python
# An action is (name, preconditions, add, delete); a state is a frozenset
# of facts. Delete lists are carried but never read here: that is the
# relaxation.

def relaxed_layers(state, actions):
    """Fact layers of the delete-relaxed problem, until nothing new appears."""
    facts = frozenset(state)
    layers = [facts]
    while True:
        applicable = [a for a in actions if a[1] <= facts]
        grown = facts.union(*(a[2] for a in applicable)) if applicable else facts
        if grown == facts:
            return layers          # levelled off, so this is a fixed point
        facts = grown
        layers.append(facts)


def h_max(state, goal, actions):
    """Admissible estimate: the cost of the hardest single goal fact."""
    layers = relaxed_layers(state, actions)
    if not goal <= layers[-1]:
        return float("inf")        # unreachable even when nothing deletes
    first_seen = {}
    for index, layer in enumerate(layers):
        for fact in layer:
            first_seen.setdefault(fact, index)
    return max((first_seen[g] for g in goal), default=0)
```

The `float("inf")` return is the quiet win. Delete relaxation is a **dead-end detector**: if a
goal fact cannot be reached even in a world where nothing is ever undone, it cannot be reached
at all, and the search can prune that entire branch without another thought.

---

## 5. Planning graphs and Graphplan

Graphplan (Blum and Furst, 1995) builds the relaxation into an explicit layered structure and
then adds back the one thing delete relaxation throws away: conflict.

The graph alternates fact levels and action levels. $S_0$ is the initial state. $A_k$ holds
every action whose preconditions all appear in $S_k$, plus a **no-op** for each fact so that
facts persist. $S_{k+1}$ is everything those actions add, plus everything carried over. That
much is just relaxed reachability.

The addition is **mutex** links, marking pairs that cannot happen or hold together at the same
level. Two actions are mutex under any of three conditions: one deletes what the other adds
(inconsistent effects), one deletes a precondition of the other (interference), or a
precondition of one is mutex with a precondition of the other (competing needs). Two facts are
mutex at a level if every way of producing the first is mutex with every way of producing the
second.

```
  level S0        level A0        level S1        level A1     level S2
  ───────────     ───────────     ───────────     ──────────   ──────────
  clear(A)        pick-up(A)      holding(A)      stack(A,B)   on(A,B)
  clear(B)        pick-up(B)      holding(B)      stack(B,A)   on(B,A)
  on-table(A)     no-ops          clear(A)        no-ops       clear(A)
  on-table(B)                     clear(B)                     hand-empty
  hand-empty                      on-table(A)                  holding(A)
                                  on-table(B)                  ...
                                  hand-empty
                  └── mutex ──┘   └── mutex ──┘
                  both consume    cannot hold two
                  hand-empty      blocks at once
```

Graphplan then alternates two phases. Expand one more level. Check whether every goal fact
appears in the newest fact level with no pair of them mutex. If so, run a backward extraction
search through the graph, level by level, choosing a non-mutex set of actions that achieves the
current subgoals. If extraction fails, record the failed subgoal set as a **nogood** for that
level so it is never re-tried, expand another level, and go again. Termination has a real proof
attached: the graph monotonically levels off, and once the graph and the nogood sets have both
stopped changing, the problem is provably unsolvable.

Two honest corrections to the way this is usually taught. First, Graphplan is optimal in the
**number of levels**, that is, in parallel makespan, and not in the number of actions. A plan
with fewer parallel steps can contain more actions than a sequentially optimal plan. Second,
almost nobody runs Graphplan itself in 2026. Its lasting contribution is the data structure:
the planning graph without mutexes is precisely what $h^{\max}$ and $h^{\text{FF}}$ compute
inside a forward search. Graphplan turned out to be a heuristic wearing a planner's coat.

---

## 6. The other families, and what became of them

| Family | Core idea | Notable system | Where it stands in 2026 |
|---|---|---|---|
| Partial-order planning | Commit to an order only when a threat forces you | UCPOP | Rare as a search strategy, alive as post-processing and in temporal planning |
| Planning as SAT | Encode a fixed horizon as one Boolean formula, call a SAT solver | SATPLAN, Madagascar | Still competitive on parallel-optimal problems, rides every SAT solver improvement free |
| Hierarchical task networks | Decompose abstract tasks using human-written methods | SHOP2 | Widely used in industry and games, standardised as HDDL since 2020 |
| Heuristic forward search | Ground, derive a heuristic, search forward | Fast Downward | The mainstream, and the thing to reach for first |

Partial-order planning deserves a note because the idea outlived the algorithm. Its insight is
that `wash-dishes` and `pay-rent` have no reason to be ordered, so do not order them. As a
search strategy it lost to heuristic forward search, mostly because nobody found good
heuristics for partially ordered plan spaces. But **plan deordering**, taking a sequential plan
and relaxing it back into a partial order, is genuinely useful when the plan will be executed
by several actors or when durations vary, and that is exactly the POP idea applied at the end
instead of throughout.

HTN planning is the one to understand if you build agents for a living. It is not really
searching for a plan; it is executing a library of human-written recipes with a search over
which recipe applies. That makes it fast and predictable and completely dependent on the
quality of the methods you wrote. Every "workflow engine with a planner bolted on" I have seen
in production is an HTN, whether or not its authors know the term.

---

## 7. What a planner actually does in 2026

If you want to run a classical planner today, the practical answer is Fast Downward, or one of
the portfolio planners built on it. The pipeline looks like this:

```
  domain.pddl  ┐
  problem.pddl ┴─▶ parse ─▶ invariants ─▶ ground ─▶ search ─▶ plan
                            │             │         │
                            │             │         └─ h_FF plus
                            │             │            preferred ops, or
                            │             │            LM-cut for optimal
                            │             └─ the blow-up: a dozen schemas
                            │                become tens of thousands of
                            │                ground actions
                            └─ finds mutually exclusive predicate groups
                               and merges them into finite-domain
                               variables (SAS+)
```

The invariant synthesis step is the piece missing from most tutorials, and it matters. It runs
on the lifted schemas, before grounding, which is what keeps it cheap. Rather than tracking
`on(a,b)`, `on(a,c)` and `on-table(a)` as three independent booleans that could all be true at
once, Fast Downward proves they are mutually exclusive and merges them into one finite-domain
variable `location-of-a` with three values. Smaller state, cheaper comparisons, better
heuristics. This is the same "multi-valued variables" idea we used in
[part 6 on constraint satisfaction](/posts/2023/09/csp-basics/), arrived at from the other
direction.

For Python, the [Unified Planning library](https://github.com/aiplan4eu/unified-planning) from
the AIPlan4EU project is the reasonable front end: you build the model in Python, and it hands
it to whichever planner you have installed. `pyperplan` is fine for teaching and far too slow
for anything real.

And the question everyone actually asks in 2026: can a language model just do this? The
evidence is consistent and unflattering. Ask a model to emit a plan directly and it produces
plans that look right and fail validation, with the failure rate climbing sharply as the plan
gets longer or as the domain is renamed to defeat memorisation. Reasoning-tuned models have
narrowed the gap on small, familiar domains such as Blocksworld, and they still degrade on
longer instances in a way a search algorithm simply does not. The pattern that works is the
boring one: **let the model write the PDDL, let a sound planner do the search, and let a
validator check the result**. That splits the work along the line where each side is strong,
which is the same argument I made about tool boundaries in
[what is an agent harness](/posts/2025/08/what-is-an-agent-harness/).

---

## 8. Try it yourself

1. **Watch the branching factor.** Ground the four-block blocks world by hand and count the
   actions. Then do six blocks. The count grows as the number of objects raised to the number
   of parameters in the schema, which is the argument for keeping parameter lists short.
2. **Break the heuristic.** Build a domain where $h^{\text{add}}$ badly overestimates: two
   goals that share almost all their work. Compare the node counts for $h^{\max}$,
   $h^{\text{add}}$ and plain breadth-first search.
3. **Print the mutexes.** Extend `relaxed_layers` above to also compute action mutexes, then
   print them per level. Watching mutex pairs disappear as levels grow is the clearest
   intuition for what Graphplan is doing that I know.
4. **Validate a plan you do not trust.** Take any plan, from a planner or from a language
   model, and run it through VAL, the plan validator used by the IPC. Being told exactly which
   action's precondition failed, and at which step, is worth more than any amount of staring.

---

## 9. The short version

- Planning is search where the state is a set of facts rather than a black box, and the goal
  is written in the same vocabulary as the actions. That is what lets a planner derive its own
  heuristic for a domain it has never seen.
- STRIPS is three sets per action: preconditions, deletes, adds. Applying it is
  `s' = (s - delete) | add`, and everything unmentioned stays put.
- PDDL, not STRIPS tables, is what you actually write. Grounding turns lifted schemas into
  concrete actions and is often where you run out of memory first.
- Forward search beat backward search once delete-relaxation heuristics existed, because
  concrete states are cheap to evaluate and partial descriptions are not.
- $h^+$ is admissible and NP-hard to compute. Use $h^{\text{FF}}$ for satisficing search and
  LM-cut for optimal search, and take the free dead-end detection either way.
- Graphplan's mutex reasoning is real and its plan extraction is mostly history. The planning
  graph survives as the machinery inside modern heuristics.
- HTN is what most production "planners" actually are: a library of human-written recipes with
  a small search over which one applies.
- Language models are unreliable plan generators and useful PDDL authors. Let the model model,
  let the planner search, and let a validator have the last word.

---

*Series: **AI Foundations**. Next, the last part, where we take all of this off the whiteboard:
[classical planning from the ground up](/posts/2024/02/classical-planning/), with real PDDL,
hierarchical task networks and more than one agent in the room.*
