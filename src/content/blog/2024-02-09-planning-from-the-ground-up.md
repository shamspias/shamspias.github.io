---
title: "Brains Behind the Bots: Classical Planning from Ground Up"
description: "PDDL, heuristics that sometimes do nothing, HTN, temporal and multi-agent planning, with real planner numbers on Towers of Hanoi."
date: 2024-02-09
permalink: "/posts/2024/02/classical-planning/"
tags:
  - "classical planning"
  - "search"
  - "PDDL"
  - "HTN"
  - "multi-agent systems"
  - "knowledge representation"
  - "AI foundations"
  - "beginner"
series: "AI Foundations"
seriesOrder: 10
math: true
---

*Part 10 of the AI Foundations series, and the last one.
[Part 9](/posts/2024/01/classical-planning/) stopped at the algorithms. This one covers
everything between a clean algorithm and a robot that finishes the job: the file you actually
write, the heuristic that sometimes does nothing, time and fuel and failure, and where a
language model belongs in 2026.*

---

## 1. A plan is a model, a solver and an executive

Teaching a child to build a LEGO tower has two halves. First you work out the moves: pick up
the red brick, put it on the base, pick up the blue one. Then you carry them out with small
hands that wobble. When the tower falls over, the first question is which half failed. Was the
sequence wrong, or were the fingers?

Planning systems take that split seriously, and then add a third piece. You end up with three
things that fail in three different ways:

- The **model**, which says what actions exist and what they do. You write this.
- The **solver**, which searches for a sequence that reaches the goal. You almost never write
  this, and you should not want to.
- The **executive**, which runs the plan one step at a time and watches whether reality
  agrees.

Almost every planning bug I have had was in the model. Search algorithms are decades old and
well tested. Your description of what "pick up the box" actually requires is three days old
and written by you at midnight.

```
   domain.pddl + problem.pddl      you write these, and rewrite them
            │
            ▼
   ┌──────────────────────┐
   │ parse and ground     │  every action schema x every object tuple
   └──────────┬───────────┘
              ▼
   ┌──────────────────────┐
   │ search, guided by h  │  A*, greedy best first, lazy queues
   └──────────┬───────────┘
              ▼
     a plan: op1, op2, ... opN
              │
              ▼
   ┌──────────────────────┐
   │ executive            │  do one step, then read the sensors
   └──────────┬───────────┘
              │  the world disagrees
              ▼
   replan from where you now are, or go back and fix the model
```

## 2. PDDL is the part you actually write

PDDL, the Planning Domain Definition Language, is the format the whole field agreed on in 1998
and has extended ever since. It splits into two files, and the split is the useful idea. The
**domain** describes physics: the predicates that can be true and the actions that change
them. The **problem** describes one puzzle: which objects exist, what is true at the start,
what you want at the end. One domain, many problems.

Here is Towers of Hanoi. Three pegs, a stack of disks, move them all across, never put a big
disk on a small one.

```pddl
(define (domain hanoi)
  (:requirements :strips)
  (:predicates (clear ?x) (on ?d ?x) (smaller ?d ?x))

  (:action move
    :parameters (?d ?from ?to)
    :precondition (and (smaller ?d ?to) (on ?d ?from)
                       (clear ?d) (clear ?to))
    :effect (and (clear ?from) (on ?d ?to)
                 (not (on ?d ?from)) (not (clear ?to)))))
```

That is the entire game. One action, four preconditions, four effects. The `:strips`
requirement asks for the minimal core of the language, named after the 1971 SRI planner: facts
are symbols that are either true or false, and an action deletes some of them and adds others.
Note that `smaller` never appears in any effect: nothing the robot does changes which disk is
bigger. Predicates like that are called **static**, and good planners detect them and compile
them away before search starts. Predicates that do change, `on` and `clear` here, are the ones
that make the state space.

The problem file lists the objects and the two states you care about:

```pddl
(define (problem hanoi-3)
  (:domain hanoi)
  (:objects d1 d2 d3 pegA pegB pegC)
  (:init
      (smaller d1 d2) (smaller d1 d3) (smaller d2 d3)
      (smaller d1 pegA) (smaller d1 pegB) (smaller d1 pegC)
      (smaller d2 pegA) (smaller d2 pegB) (smaller d2 pegC)
      (smaller d3 pegA) (smaller d3 pegB) (smaller d3 pegC)
      (on d3 pegA) (on d2 d3) (on d1 d2)
      (clear d1) (clear pegB) (clear pegC))
  (:goal (and (on d3 pegC) (on d2 d3) (on d1 d2))))
```

Twelve `smaller` facts for three disks, which is every ordered pair that holds. The original
version of this post told you that you only needed the adjacent ones, four facts for five
disks, because "the planner infers transitivity". That is wrong, and it is worth being blunt
about why, because it is the single most common misunderstanding about this whole formalism. A
STRIPS planner has no idea that `smaller` means smaller. It is an uninterpreted symbol. There
is no arithmetic, no ordering theory, no inference rule waiting in the background. A fact is
either in the state or it is not. I checked rather than argued: cut the ten pairs for five
disks down to the four adjacent ones and pyperplan reports "No solution could be found",
because it can no longer prove that d1 is allowed to sit on d3.

If you want something that reasons about what the symbols mean, you want a different kind of
solver: the world of [first-order logic](/posts/2023/12/first-order-logic/) and SMT,
satisfiability modulo theories, where you can tell the solver that `smaller` is an ordering and
let it work out the rest. That is not classical planning.

Solving the pair takes one command. I have used
[pyperplan](https://github.com/aibasel/pyperplan) throughout this post, a small readable
planner written in Python:

```bash
pip install pyperplan
python -m pyperplan -H hff -s astar hanoi/domain.pddl hanoi/problem-3.pddl
```

It writes the plan to `hanoi/problem-3.pddl.soln` and logs the numbers that matter on the way
past: how many facts and operators grounding produced, how many nodes the search expanded, and
how long that took. Every figure in the next two sections came out of that log.

## 3. Grounding is where the blow-up starts

Before search begins, the planner **grounds** the domain: it takes each action schema and
substitutes every legal combination of objects, producing a flat list of operators with no
variables left. One `move` schema over six objects becomes sixty concrete operators. That is
where object counts turn into memory.

Real figures from pyperplan on the files above, one row per problem size:

| disks $n$ | facts | ground operators | states $3^n$ | optimal plan $2^n - 1$ |
|-----------|-------|------------------|--------------|------------------------|
| 3         | 24    | 60               | 27           | 7                      |
| 5         | 48    | 175              | 243          | 31                     |
| 7         | 80    | 378              | 2,187        | 127                    |
| 10        | 143   | 900              | 59,049       | 1,023                  |

Grounding grows politely here, with the cube of the object count, because `move` has three
parameters. The plan length does not. Hanoi is the textbook case where both numbers are
exponential: $3^n$ states to search, and $2^n - 1$ moves in the shortest plan, so even a
perfect planner has to emit a thousand moves for ten disks. No heuristic saves you from having
to write the answer down.

Typing is how you stop grounding from exploding in a real domain. Declare `(:types disk peg)`,
type the parameters, and the planner never builds the operator that puts a peg on a disk. The
original version of this post used `(either peg disk)` for parameters that accept both. It
parses in some tools, but it is a corner of the language with patchy support, so if you use
it, check your planner reads it the way you think. The safe options are plain untyped STRIPS,
as above, or a type hierarchy with a shared supertype.

## 4. Heuristics, and the day the heuristic did nothing

A heuristic $h(s)$ is a cheap guess at how many steps remain from state $s$. Walking to work,
straight-line distance is a heuristic: it ignores buildings, it is never an overestimate, and
it is enough to stop you exploring streets pointing the wrong way. That "never an
overestimate" property is called **admissibility**, and it is what buys A\* its guarantee of a
shortest plan.

The standard trick in planning, covered in [part 9](/posts/2024/01/classical-planning/), is
**delete relaxation**: pretend actions only ever add facts and never remove them. In the
relaxed world nothing can be undone, so solving it is easy, and its solution length is a lower
bound on the real one. `hmax`, which takes the most expensive goal fact, and `LM-cut` are
admissible. `hFF`, which extracts an actual plan for the relaxed problem and counts its steps,
and `hadd`, which sums the cost of every goal fact as if they were independent, are not, so
A\* with `hFF` gives you a plan fast but promises nothing about its length.

Now the part that textbooks skip. Here is the same ten-disk problem solved four ways on my
laptop, with pyperplan 2.1 and with Fast Downward driven through the `unified-planning`
library. "Satisficing" below means any valid plan will do; "optimal" means the planner must
also prove that no shorter one exists.

| planner and setting          | nodes expanded | plan length     | search time |
|------------------------------|----------------|-----------------|-------------|
| pyperplan, blind BFS         | about 59,000   | 1,023, optimal  | 3.2 s       |
| pyperplan, A\* with hFF      | about 56,000   | 1,023           | 78 s        |
| Fast Downward, satisficing   | not comparable | 1,193           | 0.3 s       |
| Fast Downward, optimal       | not comparable | 1,023, optimal  | 3.7 s       |

Read the first two rows again. The clever heuristic pruned five per cent of the search and
cost twenty-five times the wall clock. Hanoi is famously hostile to delete relaxation, because
if you are allowed to keep facts you never have to unstack anything, so the relaxed distance
stays tiny while the real one doubles with every disk. Blind breadth-first search expanded
58,904 nodes out of a 59,049-state space, which is to say it looked at essentially everything,
and still won on time because looking at a node is cheap and computing `hFF` is not.

The lesson is not "heuristics are bad". On logistics, transport and most International Planning
Competition domains the same heuristic buys orders of magnitude. The lesson is that a heuristic
is a bet: you pay per node for a guess that may or may not pay off in this domain, and the only
way to know is to measure both. Measure with a stopwatch, not with expanded-node counts, because
expanded nodes hide the price.

## 5. Choosing a solver family

There are three broad ways to turn a planning problem into computation, and one way that wins
by default in 2026.

| Route               | Big idea                              | Best when                      |
|---------------------|---------------------------------------|--------------------------------|
| Planning as SAT     | Fix a horizon of $k$ steps, call SAT  | Short plans, hard interactions |
| Constraint encoding | A variable per time slot, like Sudoku | Numeric limits dominate        |
| Heuristic search    | Expand from the start, guided by $h$  | Long plans and many objects    |

SAT is Boolean satisfiability: rewrite the question as one enormous true-or-false formula and
let a specialised solver find an assignment that satisfies it. That, and the constraint
encodings from the [constraint satisfaction](/posts/2023/09/csp-basics/) post, are the same
idea applied along a time axis. Both lost the default slot to heuristic search around 2000 and
have not taken it back, but modern
SAT solvers are very strong, and for problems whose plans are short and whose interactions are
nasty, encode-and-solve is still the right call.

```
   Do you already know the recipe, and must the plan be explainable?
        yes ─▶ HTN: you write the methods, the planner fills the gaps
        no
         │
   Are actions instant, effects certain, and the world fully known?
        no  ─▶ temporal / numeric / FOND planner, or plan and replan
        yes
         │
   Do you need a provably shortest plan?
        yes ─▶ A* with an admissible heuristic (LM-cut), or SAT
        no  ─▶ satisficing search. Start here. Almost always start here.
```

## 6. What I would actually run in 2026

Pyperplan is a teaching planner and says so: its own README notes that it prefers clean code
over fast code. That is exactly why it is worth reading. It is not what you ship.

The workhorse is [Fast Downward](https://www.fast-downward.org/), and the pleasant way to
reach it from Python is [unified-planning](https://github.com/aiplan4eu/unified-planning) from
the AIPlan4EU project, which puts one API over many engines so you can swap planners without
rewriting your model.

```bash
pip install unified-planning up-fast-downward
```

```python
import time
import unified_planning as up
from unified_planning.io import PDDLReader
from unified_planning.shortcuts import (
    OneshotPlanner,
    OptimalityGuarantee,
    MinimizeSequentialPlanLength,
)

up.shortcuts.get_environment().credits_stream = None  # quiet the banner

problem = PDDLReader().parse_problem("hanoi/domain.pddl", "hanoi/problem-10.pddl")

# Without a quality metric an optimal engine has nothing to optimise, and
# unified-planning refuses the request rather than guessing what you meant.
problem.add_quality_metric(MinimizeSequentialPlanLength())

start = time.perf_counter()
with OneshotPlanner(
    problem_kind=problem.kind,
    optimality_guarantee=OptimalityGuarantee.SOLVED_OPTIMALLY,
) as planner:
    result = planner.solve(problem)

print(result.status)                      # SOLVED_OPTIMALLY
print(len(result.plan.actions), "actions")  # 1023
print(f"{time.perf_counter() - start:.1f}s")
```

Drop the `optimality_guarantee` and the same call returns in 0.3 seconds with a 1,193-step
plan. That is the trade you are making, stated in one line of code: seventeen per cent more
moves for twelve times the speed. Most of the time, in a warehouse or a kitchen, seventeen per
cent more moves is fine and a planner that thinks for four seconds is not.

One more tool worth knowing. [VAL](https://github.com/KCL-Planning/VAL), the standard plan
validator, takes a domain, a problem and a plan and tells you whether the plan actually works,
which is not the same question as whether the planner believes it does. Wire it into your
tests. And the equivalent of a unit test suite here is a folder of small problems with known
answers, because the failure mode you will hit is a model that quietly allows something
physics does not.

## 7. Time, fuel and failure

Everything above assumes actions are instantaneous, effects are certain, and you see the whole
world. Real jobs break all three. PDDL grew to cover them, and so did the planners.

| Twist              | What changes                        | Concrete picture                  |
|--------------------|-------------------------------------|-----------------------------------|
| Durative actions   | Actions take time and can overlap   | Bake the cake as the kettle boils |
| Numeric fluents    | Actions spend quantities, not facts | The drone has 100 Wh, each leg 12 |
| Uncertainty        | An action has several outcomes      | "Pick up box" sometimes drops it  |
| Partial visibility | You know only what you have seen    | Is the door locked? Nobody said   |
| Execution drift    | The world moved while you planned   | The road closed, the pallet moved |

Durative actions and numeric fluents arrived with PDDL 2.1, written for the 2002 competition,
and are handled by temporal planners such as OPTIC and POPF and numeric ones such as ENHSP.
Support is genuinely uneven, so check what your engine reads before you model a whole factory
in it. `unified-planning` helps here: `problem.kind` reports which features your model uses,
and the library picks an engine that handles them, or tells you that nobody can.

Uncertainty splits two ways. If you only care that the plan works whatever happens, you want
**fully observable non-deterministic** planning, FOND, which produces a policy rather than a
sequence. If outcomes have probabilities and you want the best expected cost, you have left
planning and entered Markov decision processes.

## 8. HTN: when you already know the recipe

Classical planning discovers the recipe from first principles. Hierarchical task networks
assume you already have it and only need the details filled in. You give the planner **tasks**
and **methods**: ways of breaking a task into subtasks, with conditions on when each way
applies.

```
   cook breakfast                        a task, not an action
   ├── make eggs                         method: three primitive steps
   │   ├── crack
   │   ├── whisk
   │   └── fry
   ├── make toast
   │   ├── slice
   │   ├── toast
   │   └── butter
   └── serve
       ├── plate the food
       └── pour the juice
```

The planner refines tasks until only primitive actions remain. Because your methods rule out
most of the search space before search begins, HTN planners handle domains that would bury a
classical planner. The cost is that you are now the source of the intelligence: if you never
wrote a method for it, the planner will never find it, however obvious.

The old name here is SHOP2. In 2026 the live options are **HDDL**, which is PDDL extended with
tasks and methods and gave HTN planning a shared file format in 2020, planners such as PANDA
and Lilotane that read it, and [GTPyhop](https://github.com/dananau/GTPyhop), Dana Nau's
Python planner, if you would rather write methods as Python functions than in a modelling
language.

Pick HTN when a domain expert can describe the standard procedure, when plans must be legible
to a human afterwards, or when the classical planner is timing out and you know why.

## 9. When sensors lie

If the robot cannot tell whether the door is open, it has two honest options.

```
   contingent plan (decide now)       replan (decide later)
   ────────────────────────────       ────────────────────────────
   sense(door)                        walk through the door
     ├─ open   ─▶ walk through        on failure: sense, plan again
     └─ closed ─▶ unlock, walk
   every branch costs you time        each surprise costs a call
   at planning time                   to the planner
   nothing to decide at run time      needs a planner on the robot
```

A contingent plan is really a **policy**: do X, and if you observe Y do Z. It is the right
answer when replanning is impossible or too slow, which usually means the robot is on Mars,
underwater, or holding something heavy. Everywhere else, plan-and-replan wins on simplicity,
and it is what most deployed systems do. Behaviour trees, the standard in robotics and game
AI, are largely a tidy way of writing down the replanning policy by hand.

The piece people forget is **execution monitoring**: after each step, check that the state you
expected is the state you are in. Without it, a robot will happily execute step seven of a
plan whose assumptions died at step three. It is the same discipline as
[safe-by-default agents](/posts/2025/12/safe-by-default-agents/): assume the world moved,
verify before you act, and make failure cheap.

## 10. More than one robot

Three ways to plan for several agents, in increasing order of how much you trust them.

- **One brain.** Mash all the robots into a single problem with a joint action space. The
  logic is simple and the plans are optimal. The state space multiplies, so this dies at a
  handful of agents.
- **Separate brains that negotiate.** Each agent plans for itself, then they exchange
  proposals and repair conflicts. This is how real fleets work, and the interesting
  engineering is entirely in the conflict protocol.
- **Separate brains that compete.** Each has its own reward. Now you are in
  [adversarial search](/posts/2023/08/adversarial-search/) and game theory, not planning.

The specialised case worth knowing by name is **multi-agent path finding**, where many robots
share a floor and must not collide. Conflict-based search solves it by planning each robot
alone, finding the first collision, and splitting into two subproblems that each forbid one
side of it. Variants of that idea are what let a warehouse floor run hundreds of robots
without gridlock.

One modelling trick pays for itself everywhere here: treat "send a message" as an action with
a cost. Once communication is priced, the planner will tell you when silence is cheaper than
coordination, which is a question teams usually settle by argument.

## 11. Where language models fit

This is the part that has changed most since I first wrote this post, so let me be plain about
it.

Ask a strong 2026 model for a plan on a Blocksworld problem, the standard block-stacking
benchmark, and it will often give you a good one. Rename the predicates to nonsense words so
that the puzzle is structurally identical but no longer looks like anything in the training
data, and accuracy falls off a cliff. Lengthen the instances and it degrades further.
Reasoning-trained models are far better at this than the 2023 generation, and they still show
the same shape: strong on the familiar, brittle on the unfamiliar, and no guarantee anywhere.

That is not a reason to keep language models out. It is a reason to give them the job they are
actually good at, which is turning a vague human sentence into a formal model. The pattern
that works, sometimes called LLM-modulo, is a loop:

```
   English request  ─▶  model writes domain.pddl + problem.pddl
                              │
                              ▼
                        sound planner
                              │
                     ┌────────┴────────┐
                  plan found        no plan
                     │                 │
                     ▼                 ▼
              VAL validates      error goes back
              against the model  to the model, retry
```

The model proposes, the planner disposes, and a validator has the final word. You keep the
flexibility of natural language input and the guarantees of a sound solver, and the failure
mode becomes "I could not build a model of that", which is an honest answer. If that shape
sounds familiar, it is the argument in
[an agent is data, not code](/posts/2026/08/an-agent-is-data-not-code/): the useful artefact is
a declarative description that something trustworthy executes.

## 12. Try it yourself

1. **Break the model on purpose.** Delete `(clear ?to)` from the `move` precondition and solve
   the five-disk problem again. Mine came back in four moves instead of thirty-one:

   ```
   (move d1 d2 d2)
   (move d2 d3 d5)
   (move d2 d5 d3)
   (move d5 pega pegc)
   ```

   It moves d1 from d2 back onto d2, then carries the bottom disk to another peg with four
   disks still stacked on it. That is what a modelling bug looks like. Not a crash: a
   confident, cheerful, wrong answer.
2. **Find your heuristic's crossover.** Run BFS and A\* with `hFF` on your own domain at three
   sizes and plot wall clock, not node counts. Every domain has a size below which the
   heuristic is a waste of money.
3. **Price the messages.** Take two delivery robots and a single narrow bridge. Model
   communication as an action costing one unit, then ten, and watch the plan shift from
   coordination to two robots politely waiting.

## 13. The short version

- Planning has three parts that fail differently: the model you write, the solver you should
  not write, and the executive that runs the plan. Your bug is almost always in the model.
- PDDL splits physics (domain) from puzzle (problem), and a STRIPS planner has no theories
  underneath it: `smaller` is an uninterpreted symbol, so leaving out the pairs you assume are
  implied gives you "no solution", not a clever inference.
- Grounding turns action schemas into concrete operators, so object count is what fills
  memory. Plan length is a separate exponential and no heuristic can shorten it.
- Heuristics are a bet. On ten-disk Hanoi, `hFF` pruned five per cent of the search and cost
  twenty-five times the wall clock. Measure with a stopwatch on your own domain.
- Reach for Fast Downward through `unified-planning`, keep pyperplan for reading, and validate
  plans with VAL in your test suite.
- Satisficing beats optimal in almost every deployment. Seventeen per cent more moves for
  twelve times the speed is usually the right trade.
- Use HTN when a human already knows the procedure, contingent plans when replanning is
  impossible, and plan-and-replan the rest of the time.
- Let a language model write the model, not the plan, and put a sound planner and a validator
  downstream of it.

---

*That closes the AI Foundations series: ten posts from search to logic to plans. If you want to
see where all of it went, the modern descendant of the executive in section 1 is the
[agent harness](/posts/2025/08/what-is-an-agent-harness/), where the same questions about
monitoring, replanning and trust come back wearing different clothes.*
