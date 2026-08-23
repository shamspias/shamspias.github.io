---
title: "Intelligent Agents & Search: A Baby-Steps Tour from ‘What is Rational?’ to ‘How do we find the goal?’"
description: "What an agent actually is, how to turn a problem into a search problem, and why changing one line of priority code turns breadth-first search into A*."
date: 2023-04-26
permalink: "/posts/2023/04/ai-agents-search/"
tags:
  - "artificial intelligence"
  - "intelligent agents"
  - "search algorithms"
  - "heuristic"
  - "beginner"
  - "python"
series: "AI Foundations"
seriesOrder: 3
math: true
---

*Part 3 of AI Foundations. If you have ever followed a maps app out of a traffic jam, you
already have the intuition for both halves of this post. My job is to make it precise, and
then to show you that breadth-first search and A\* are the same twenty lines of code with one
line changed.*

---

## 1. An agent is a loop, not a brain

A thermostat is an agent. It senses one number, compares it to a target, and switches a relay.
There is no cleverness anywhere in it, and it still satisfies the definition completely.

Precisely: an agent perceives its **environment** through **sensors** and acts on it through
**actuators**. One sensor reading is a **percept**, and the *agent function* maps every possible
**sequence** of percepts to an action. The *agent program* is the finite piece of code you
actually write, which almost never stores the whole history and instead keeps a summary of it.
That gap between the function and the program is the reason internal state exists at all, and it
is worth holding on to: everything in section 4 is a different answer to "how much of the past
do I need to keep?"

```
   ┌────────────────────── environment ───────────────────────┐
   │                                                          │
   │   ┌─────────┐                              ┌─────────┐   │
   └──▶│ sensors │                              │actuators│───┘
       └────┬────┘                              └────▲────┘
            │ percept                                │ action
            ▼                                        │
       ┌──────────────────────────────────────────────────┐
       │                  agent program                   │
       │   state?   world model?   goals?   utility?      │
       └──────────────────────────────────────────────────┘
```

| Agent | Sensors | Actuators | Environment |
|---|---|---|---|
| Robot vacuum | bump switch, cliff sensor, odometry | wheels, brush, fan | your living room |
| Chess engine | board position | legal move generator | the game |
| Trading bot | order book feed | order placement API | the market |
| LLM tool-calling agent | conversation, tool results | tool calls, final text | your systems |

That last row is the one people argue about in 2026. It is the same loop. What changed is that
the agent program is a large language model rather than a rule table, and the environment
became your production database. I have written about what that costs in
[what an agent harness actually is](/posts/2025/08/what-is-an-agent-harness/).

---

## 2. Rational is not the same as right

An agent is **rational** if it picks the action that maximises its expected performance, given
what it has perceived so far and what it knows in advance:

$$
a^{*} = \arg\max_{a}\; \mathbb{E}\big[\, \text{Performance} \;\big|\; \text{percepts}, a \,\big]
$$

Your maps app cannot see the lorry that is about to jack-knife two junctions ahead. It routes
you into the jam. It was still rational: it maximised expected time given what it knew. Rational
means *best bet*, never *correct in hindsight*, and never *omniscient*.

The part that bites in practice is the performance measure itself. Write it over the state of
the **environment**, not over the agent's behaviour. A vacuum scored on "amount of dirt sucked
up per hour" will learn to dump the dirt back out and suck it up again. Score it on "floor is
clean" instead. This failure has a modern name, reward hacking, and it is exactly the same
mistake at a larger scale.

---

## 3. Read the environment before you choose an algorithm

The environment decides which algorithms are even applicable. Check these five before writing
a line of code.

| Property | The question | Easy case | Hard case |
|---|---|---|---|
| Observable | can you see the whole state? | chess board | poker hand, a robot's fog |
| Deterministic | does the same action always give the same result? | a puzzle | a wet road |
| Episodic | does each decision stand alone? | image classification | driving, dialogue |
| Static | does the world hold still while you think? | crossword | a football match |
| Discrete | are the states and actions finite? | 8-puzzle | steering angle |

Everything in the rest of this post assumes the easy column: fully observable, deterministic,
static, discrete, and one agent. That is not a cop-out, it is the ladder. The next posts in the
series knock out one rung at a time, starting with
[worlds that are hidden or refuse to sit still](/posts/2023/07/beyond-search/) and then
[worlds with an opponent in them](/posts/2023/08/adversarial-search/).

---

## 4. Four agent programs, and when each one earns its place

**Simple reflex.** Look at the current percept, act. No memory.

```python
def reflex_vacuum(percept):
    """percept is (room, status); the agent has no memory at all."""
    room, status = percept
    if status == "Dirty":
        return "Suck"
    return "Right" if room == "A" else "Left"
```

Six lines of AI, and genuinely useful for two rooms. Now count the cost: written as a lookup
table, a reflex agent for $n$ rooms needs a row for every distinguishable percept, and if the
percept includes the dirt status of every room that is $n \cdot 2^{n}$ rows. Reflex agents do
not scale because tables do not scale.

**Model-based reflex.** Keep a belief about the parts you cannot currently see.

```python
class ModelBasedVacuum:
    def __init__(self, rooms):
        # A belief, not the truth. It goes stale the moment the cat walks in.
        self.believed_clean = {room: False for room in rooms}

    def __call__(self, percept):
        room, status = percept
        self.believed_clean[room] = status == "Clean"
        if not self.believed_clean[room]:
            return "Suck"
        dirty = [r for r, clean in self.believed_clean.items() if not clean]
        return f"Go to {dirty[0]}" if dirty else "NoOp"
```

The comment is the important line. A model is a claim about the world that nothing is verifying,
so every model-based agent needs an answer to "when do I distrust it?" Mine is crude: it never
does, which is why a real vacuum re-checks rooms on a timer.

**Goal-based.** It has a description of what "done" looks like, and it has to work out a
sequence of actions that reaches it. That work is search, and it is the rest of this post.

**Utility-based.** Some goals are reached better than others. A utility function puts a number
on outcomes so the agent can trade off speed against fuel against risk, and can act sensibly
when no plan reaches the goal with certainty.

Any of the four can be wrapped in a **learning** agent, where a critic scores behaviour and a
learning element edits the program. That is the whole of machine learning sitting inside one
box of this diagram, and it is
[part 2 of this series](/posts/2023/02/ml-101-pytorch-tf-decision-tree/).

---

## 5. Turning a real problem into a search problem

This is the step people skip, and it is where nearly all the leverage is. A search problem is
exactly five things:

1. **States.** What counts as a distinct situation.
2. **Initial state.** Where you start.
3. **Actions(s).** What is legal from a state.
4. **Result(s, a).** The transition model: where an action lands you.
5. **Is-goal(s)** and **Action-cost(s, a, s')**.

Get the state representation wrong and no algorithm saves you. For a delivery van, "position
plus set of parcels still on board" is a state; "position plus full GPS trace" is the same
situation written a million different ways, and your search will re-explore each one.

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class GridProblem:
    walls: frozenset      # frozen: a plain set would make the problem unhashable
    width: int
    height: int
    initial: tuple
    goal: tuple

    def actions(self, state):
        return ((1, 0), (-1, 0), (0, 1), (0, -1))

    def result(self, state, action):
        return (state[0] + action[0], state[1] + action[1])

    def is_legal(self, state):
        x, y = state
        return 0 <= x < self.width and 0 <= y < self.height and state not in self.walls

    def is_goal(self, state):
        return state == self.goal

    def action_cost(self, state, action, next_state):
        return 1
```

---

## 6. One algorithm, four names

Almost every classical search algorithm is the same loop. You keep a **frontier** of nodes you
have seen but not expanded, you pop one, you test it, you push its successors. The only thing
that differs between the famous algorithms is which node you agree to pop next.

```
       ┌───────────┐
       │ frontier  │   nodes seen but not yet expanded
       └─────┬─────┘
             │  pop the one with the smallest priority
             ▼
       ┌───────────┐   yes
       │ is goal?  ├────────▶  return the path
       └─────┬─────┘
             │  no
             ▼
       ┌───────────┐
       │  expand   │   generate every legal successor
       └─────┬─────┘
             │  push each successor with its priority
             └──────────────────▶  back to the frontier

   priority = depth          breadth-first search
   priority = g(n)           uniform-cost search (Dijkstra)
   priority = h(n)           greedy best-first search
   priority = g(n) + h(n)    A*
```

Here `g(n)` is the cost of the path found so far to `n`, and `h(n)` is an estimate of the cost
remaining from `n` to a goal. That is the entire idea. Now the code:

```python
import itertools
from heapq import heappush, heappop


def best_first(problem, priority):
    """priority(state, g) -> number. Change that one function, change the algorithm."""
    start = problem.initial
    tie = itertools.count()          # stops heapq falling back to comparing states
    frontier = [(priority(start, 0), 0, next(tie), start)]
    came_from = {start: None}
    best_g = {start: 0}
    expanded = 0

    while frontier:
        _, g, _, state = heappop(frontier)
        if g > best_g[state]:        # a stale copy; we already popped a cheaper one
            continue
        expanded += 1
        if problem.is_goal(state):
            return reconstruct(came_from, state), expanded
        for action in problem.actions(state):
            nxt = problem.result(state, action)
            if not problem.is_legal(nxt):
                continue
            new_g = g + problem.action_cost(state, action, nxt)
            if new_g < best_g.get(nxt, float("inf")):
                best_g[nxt] = new_g
                came_from[nxt] = state
                heappush(frontier, (priority(nxt, new_g), new_g, next(tie), nxt))
    return None, expanded


def reconstruct(came_from, state):
    path = []
    while state is not None:
        path.append(state)
        state = came_from[state]
    return path[::-1]
```

Three details in there are the ones blog implementations usually get wrong, and I got two of
them wrong in the first version of this post:

- **Goal-test on pop, not on generation.** For A\* and uniform-cost, a node generated cheaply is
  not necessarily reached cheaply. Testing when you generate it can return a worse-than-optimal
  path. Plain breadth-first search with unit costs is the one exception, and testing on
  generation there saves you most of one layer.
- **A tie-breaking counter in the heap tuple.** Without it, `heapq` compares the next field when
  priorities tie. My original code got away with it because Python happens to order tuples of
  ints, but the moment a state is a set, a dict, or a custom object, it raises `TypeError`.
- **Re-open a node when you find a cheaper path to it.** The `new_g < best_g` check is what
  makes this correct with a merely *admissible* heuristic, rather than requiring a consistent
  one. More on that next.

---

## 7. Heuristics: admissible, consistent, dominant

A heuristic $h(n)$ is a guess at the remaining cost. It is **admissible** if it never
overestimates, $h(n) \le h^{*}(n)$, where $h^{*}$ is the true remaining cost. It is
**consistent** if it also obeys the triangle inequality for every action:
$h(n) \le c(n, a, n') + h(n')$.

The plain-language version: an admissible heuristic is an optimist. It may tell you the goal is
closer than it is, never further. That optimism is exactly what stops A\* from settling for a
cheap-looking route before it has proved nothing better exists.

The straight-line distance between two cities is admissible for road distance, because roads
cannot be shorter than a straight line. Manhattan distance is admissible on a four-connected
grid for the same reason. For the 8-puzzle, "number of misplaced tiles" is admissible but weak;
"sum of Manhattan distances of each tile from its home" is also admissible and **dominates** it,
meaning it is at least as large everywhere. A dominating heuristic never expands more nodes, so
if it costs about the same per node, take it. "Never more" is the honest form of the result, not
"always fewer": the two can tie, and a heuristic that is expensive to compute can lose on the
clock while winning on node count.

Consistency is the stronger property and it is what lets you close a node permanently and never
look at it again. If you only have admissibility, you must be willing to re-open, which is what
the code above does.

| Strategy | Priority | Optimal? | Cost |
|---|---|---|---|
| Breadth-first | depth | yes, if every step costs the same | memory blows up first |
| Uniform-cost | $g$ | yes | expands in every direction equally |
| Depth-first | most recent | no | tiny memory, can run forever |
| Iterative deepening | depth, repeatedly | yes, with unit costs | re-expands nodes |
| Greedy best-first | $h$ | no | fast and sometimes badly wrong |
| A\* | $g + h$ | yes, with an admissible $h$ | keeps the whole frontier in memory |
| Weighted A\* | $g + w\,h$, $w > 1$ | within a factor $w$ of optimal | far fewer nodes |

A\* is optimally efficient in a narrow and precise sense: with a consistent heuristic it expands
every node whose $f$ falls strictly below the optimal cost, and so must any algorithm that uses
the same heuristic and still guarantees optimality. They can differ only on the nodes that tie
with the optimal cost. That sounds like the end of the story. It is not, because "keeps
the whole frontier in memory" is the constraint that actually kills you on large problems, which
is why iterative-deepening A\* and beam search exist.

---

## 8. Measured, on one 20 by 20 maze

Talk is cheap, so here is a single random maze, 20 by 20, with 118 of the 400 cells walled,
start at the bottom-left, goal at the top-right, unit step costs, Manhattan heuristic. Same
code, four priority functions.

| Priority | Nodes expanded | Path length |
|---|---|---|
| breadth-first (FIFO, goal-test on generation) | 272 | 38 |
| uniform-cost, $g$ | 273 | 38 |
| A\*, $g + h$ | 167 | 38 |
| weighted A\*, $g + 1.5h$ | 61 | 38 |
| greedy, $h$ alone | 62 | 48 |

```
uninformed (BFS/UCS)  A* (Manhattan h)      greedy (h only)
273 expanded          167 expanded          62 expanded
path 38               path 38               path 48

██······█···█····██o  ██  ····█···█  ··██o  ██      █   █    ██o
·······██·██ ██ooooo      ···██·██ ██ooooo         ██ ██ ██ooooo
··██·······██··o████    ██·······██ ·o████    ██       ██  o████
█·█······█·█·█·o····  █ █······█·█·█·o····  █ █      █ █ █ ooo··
·█····█··█·····o█···   █····█ ·█·····o█···   █    █  █      █o··
·····███···██··o···█    ···███···██··o···█       ███   ██    o·█
█····█·······ooo··█·  █ ···█  ·····ooo··█   █    █           o█·
 █·█·███·█···o█·█·█·   █·█ ███·█···o█ █ █    █ █ ███ █    █ █o█·
 █·██·██····oo█·····   █·██·██····oo█        █ ██ ██      █  ooo
 █·····█···oo█······   █·····█···oo█         █     █     █    ·o
█·········█o█····█··  █ ········█o█    █    █         █ █    █ o
█···█·█·█··o██······  █ ··█·█ █··o██        █   █ █ █   ██    oo
·█····██···o███··█·█   █····██···o███  █ █   █    ██    ███  █o█
·█···ooooooo·█··█··█   █···ooooooo·█  █  █   █           █  █ o█
·····o█··█······█···    ···o█  █      █           █  █      █ o·
·█·ooo██··█·········   █·ooo██  █            █    ██  █ ooooooo·
█··o████··██·█··█·█·  █··o████  ██ █  █ █   █   ████  ██o█  █ █
··█o····█····█·████·  ··█o····█    █ ████     █   ··█ ooo█ ████
oooo·····█·█··███  █  oooo·····█ █  ███  █  ooooooooo█o█  ███  █
o█·█·███···█·██ █  █  o█ █ ███   █ ██ █  █  o█ █ ███ooo█ ██ █  █

   █ wall    · expanded    o cells on the returned path
```

Three things to take from those pictures.

The uninformed search floods. It expands nearly every reachable cell, because it has no reason
to prefer one direction. A\* expands the same shape, but thinner: you can see the unexplored
white space in the bottom right where the heuristic said "that is away from the goal".

Greedy is a rocket that sometimes lands in the wrong country. It expanded under a quarter as
many nodes as uniform-cost and returned a path 26% longer than optimal. On this maze that is a
fine trade. On a delivery route billed per kilometre it is not. Count the marked cells in that
third panel and you get 61, not 62: greedy ignores `g`, so it re-opened one cell when a cheaper
route to it turned up later. A\* with a consistent heuristic never does that, which is why its
panel and its count agree.

Weighted A\* with $w = 1.5$ expanded 61 nodes, one fewer than greedy, and still returned the
optimal 38-step path. That is luck, not a guarantee: all that is promised is a path within
$1.5\times$ optimal. How much luck? Permute the order successors are generated in and the same
weighted A\* gives 69 nodes and a 42-step path, while greedy swings between 57 and 62 nodes.
Breadth-first, uniform-cost and A\* do not move at all. Any node count you quote from a
non-optimal search is a number about one tie-breaking order. Even so, weighted A\* is the knob I
reach for first on a real planner, because the node count usually falls off a cliff long before
the path quality does.

Note also that breadth-first and uniform-cost expanded 272 and 273 nodes. With unit costs they
are the same algorithm wearing different clothes, and the single-node difference is only the
early goal test.

---

## 9. What this looks like in 2026

The original version of this post ended at A\* as though A\* were the destination. It is the
baseline. Here is where the field actually sits.

**Road routing does not run A\* on the raw graph.** Continent-scale routing preprocesses the
network, with contraction hierarchies and similar techniques, so a query touches a tiny fraction
of the road graph and answers in well under a millisecond. The lesson generalises: if you will
answer many queries on a fixed graph, spend the time offline.

**Game and robot pathfinding change the graph, not the algorithm.** Navigation meshes, jump
point search on uniform grids, hierarchical decomposition, and flow fields for crowds all work
by making the search space smaller before A\* ever sees it. Robotics adds continuous state, so
you get hybrid A\* over a discretised pose lattice, or sampling planners like RRT\* where the
state space is too large to enumerate at all.

**The word "agent" has been taken over by LLM systems, and the definition still holds.** A
tool-calling model is a goal-based agent in a partially observable, non-deterministic, dynamic
environment. Everything hard about it is predicted by that sentence: it cannot see the whole
state, the same action does not always give the same result, and the world changes underneath
it. Search has not gone away either. It reappeared as sampling several candidate continuations
and scoring them, whether that is beam search over tokens or repeated rollouts of a plan with a
verifier picking the winner. `g + h` became "cost so far plus a learned guess at how promising
this branch is", and the awkward part is that the learned `h` is not admissible, so none of the
optimality guarantees in section 7 survive.

What does survive, and is the reason this chapter is still worth your afternoon, is the
formulation discipline in section 5. Most agent systems I have seen fail do so because nobody
wrote down the state, the actions, and the goal test. They fail on problem definition, not on
algorithm choice.

---

## 10. Three exercises that are actually worth doing

1. **Break the reflex agent.** Add a third room, C, to `reflex_vacuum` and try to keep it
   correct without memory. Watch where it deadlocks, then write the model-based version and
   count the lines you had to add.
2. **Race two heuristics on the 8-puzzle.** Implement misplaced-tiles and Manhattan-sum, run A\*
   with each on twenty random solvable boards, and record nodes expanded. The dominance result
   in section 7 predicts the direction; see how big the factor actually is.
3. **Find greedy's worst case.** Generate random mazes until you find one where greedy
   best-first returns a path more than twice the optimal length. Then look at the maze and
   explain, in one sentence, what shape defeats the heuristic.

---

## 11. The short version

- An agent is a sense-think-act loop. The agent *function* is over the whole percept history;
  the agent *program* keeps a summary, and choosing that summary is the real design work.
- Rational means best expected outcome given what is known, not correct in hindsight. Write the
  performance measure over the state of the world, or you get reward hacking.
- Check observability, determinism, episodicity, staticness and discreteness before choosing an
  algorithm. Classical search only applies to the easy column.
- Formulating the problem (states, initial state, actions, transition model, goal test, costs)
  matters more than which search you pick. A bad state representation cannot be rescued.
- Breadth-first, uniform-cost, greedy and A\* are one loop with four priority functions:
  depth, $g$, $h$, and $g + h$.
- A\* is optimal with an admissible heuristic, and between two admissible heuristics the larger
  one never does worse. Goal-test on pop, break ties with a counter, re-open on a cheaper path.
- On my 20 by 20 maze: 273 nodes for uniform-cost, 167 for A\*, 62 for greedy at the price of a
  26% longer path. Weighted A\* is usually the knob worth turning first.
- A\* is a baseline, not a destination. Real systems beat it by preprocessing the graph or
  shrinking the search space before the search starts.

---

*Next in the series: [what happens when the world is hidden, noisy, or refuses to hold
still](/posts/2023/07/beyond-search/), where hill climbing and simulated annealing replace the
frontier entirely.*
