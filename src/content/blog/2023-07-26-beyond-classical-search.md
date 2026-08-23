---
title: "Beyond Classical Search: Hill-Climbers, Hidden Worlds & Agents That Learn on the Fly"
description: "Hill climbing, simulated annealing, belief states and online search: what to do when A* is the wrong tool, the world hides half of itself, or there is no map yet."
date: 2023-07-26
permalink: "/posts/2023/07/beyond-search/"
tags:
  - "artificial intelligence"
  - "search algorithms"
  - "local search"
  - "stochastic"
  - "partial observability"
  - "online learning"
  - "beginner"
series: "AI Foundations"
seriesOrder: 4
math: true
---

*You have done all of this already. Shuffling a laptop around the flat to find a better signal
is local search. Turning a key and not knowing whether the engine will catch is a
nondeterministic action. Feeling along an unfamiliar wall for the light switch is planning under
partial observability. Part 4 of AI Foundations is about what you do when A\* is the wrong
tool.*

---

## 1. Where A\* stops being the right tool

[Part 3](/posts/2023/04/ai-agents-search/) built agents that search for a *path*: a sequence of
moves from a start state to a goal. That is exactly right for a maze, a route, or a puzzle where
the moves themselves are the answer.

For a large family of problems, the path is worthless. Nobody cares in what order you placed the
eight queens, only that the final board has no queen attacking another. Nobody cares in what
order the timetabler assigned lecture slots. The same is true of chip floorplanning, delivery
routing, protein sequence design and hyperparameter tuning: you are handed a space of complete
candidate answers and asked for a good one.

That changes two things.

First, memory. A\* keeps a frontier, the states it has queued up to look at next, and an
explored set of everything it has already been to, and both of those grow with the search. If
you only want the final state, you can throw all of that away and keep a single candidate. For
8-queens in the one-queen-per-column encoding that is eight integers, against a state space of
$8^8 = 16{,}777{,}216$ boards (and 4.4 billion if you allow queens to share columns).

Second, direction. Instead of building an answer up from nothing, you start with a complete, bad
answer and repair it. That is the whole idea of **local search**.

```
Do you need the route, or only the final state?
│
├─ the route ........... A*, Dijkstra, IDA*  (part 3 of this series)
│
└─ only the final state
   │
   ├─ state is a vector of real numbers
   │  ├─ gradients available ...... AdamW, L-BFGS, trust region
   │  └─ no gradients ............. CMA-ES, Bayesian optimisation
   │
   └─ state is a discrete structure
      ├─ evaluation is cheap ...... hill climbing + random restarts,
      │                             simulated annealing, tabu search
      └─ evaluation is costly ..... population methods, surrogate
                                    models, Bayesian optimisation
```

## 2. Local search: keep one state and make it better

The idea in one sentence: hold one candidate, look at the candidates one small change away, move
to the best of them, repeat until nothing nearby is better.

The honest analogy is walking downhill in thick fog. You cannot see the valley. You can feel the
ground within a metre of your boots, so you step in whichever direction slopes down, and you
keep doing that until the ground is flat. Sometimes that is the valley floor. Often it is a
ditch halfway up the hillside.

```
cost
 ▲
 │   o start
 │    \
 │     \             plateau: every neighbour scores
 │      \            the same, so there is no signal
 │       \      ___________
 │        \    /           \
 │         \__/             \
 │      local minimum:       \
 │      every neighbour       \________
 │      is worse                 global minimum
 └───────────────────────────────────────────────▶ state
```

Read the picture as a strict descent and you can see the trap immediately: a climber that
starts at `o` walks down the slope, lands in the local minimum, and stops. It never reaches
the plateau at all, because getting there means climbing. The plateau is what a climber
starting further right would run into, and the global minimum is what neither of them finds.

Three failure modes, and they are the whole story of the algorithm:

- **Local minimum.** Every neighbour is worse, but you are not at the goal.
- **Plateau.** Every neighbour scores exactly the same, so the search has no signal to follow. A
  plateau that eventually slopes down again is a *shoulder*, and worth crossing.
- **Ridge.** A sequence of local peaks where every single-step move goes down but a diagonal
  move would go up. This one only exists in two or more dimensions, which is why it does not
  show in the sketch above and why it surprises people.

Here is steepest-descent hill climbing on 8-queens: place eight queens on a chessboard so that
none of them attack each other, where a queen attacks along its row, its column and both of its
diagonals. The cost function counts pairs of queens that attack each other, and a neighbour is
any board reachable by moving one queen within its column.

```python
import random

def conflicts(board):
    """board[c] is the row of the queen in column c. Count attacking pairs."""
    n = len(board)
    return sum(
        board[i] == board[j] or abs(board[i] - board[j]) == j - i
        for i in range(n) for j in range(i + 1, n)
    )

def best_neighbours(board):
    """Every single-queen move that ties for the lowest conflict count."""
    n, best, best_h = len(board), [], None
    for col in range(n):
        original = board[col]
        for row in range(n):
            if row == original:
                continue
            board[col] = row
            h = conflicts(board)
            if best_h is None or h < best_h:
                best, best_h = [(col, row)], h
            elif h == best_h:
                best.append((col, row))
        board[col] = original
    return best, best_h

def hill_climb(n=8, sideways_limit=0):
    board = [random.randrange(n) for _ in range(n)]
    h, steps, sideways = conflicts(board), 0, 0
    while True:
        if h == 0:
            return True, steps
        moves, h_next = best_neighbours(board)
        if h_next > h:
            return False, steps       # every neighbour is worse: stuck
        if h_next == h:
            if sideways >= sideways_limit:
                return False, steps   # flat for too long: give up
            sideways += 1
        else:
            sideways = 0
        # Break ties at random rather than taking the first best found.
        # This single line is worth 61 percentage points; see below.
        col, row = random.choice(moves)
        board[col] = row
        h, steps = h_next, steps + 1
```

Over 2,000 random starting boards on my machine, plain steepest descent (`sideways_limit=0`)
**solves about 14% of them**, taking on average 4.0 steps when it succeeds and getting stuck after 3.1
steps when it does not. It fails fast, which is the one virtue of a bad algorithm.

Allow it to keep moving while the score stays equal, up to 100 consecutive sideways moves, and
it **solves 94%**, averaging 19.6 steps on the wins and 59.5 on the losses. Crossing shoulders
is where almost all of the gain is.

The other easy fix is to stop caring about any single run. **Random-restart hill climbing** just
retries from a fresh random board until one succeeds. With no sideways moves it needs about 7
restarts and 23 steps in total; with sideways moves it needs 1.1 restarts and 24 steps. If your
success probability is $p$, the expected number of restarts is $1/p$, and $1/0.14 \approx 7$ is
exactly what came out.

### The bug I want to own

My first version of `best_neighbours` returned the first best neighbour it found rather than a
list. With sideways moves enabled, that version solved **33%**, not 94%. Deterministic
tie-breaking on a plateau walks the same short loop until the sideways budget runs out. Picking
uniformly at random among tied moves is what actually lets the search wander across the flat
ground and find the far edge. It is one line, it looks like a detail, and it is most of the
algorithm.

## 3. Getting unstuck: annealing, populations, and what actually wins

**Simulated annealing** takes the metallurgical idea seriously: heat a metal and the atoms move
freely, cool it slowly and they settle into a low-energy arrangement. So instead of always
taking the best neighbour, take a *random* neighbour, always accept it if it improves the score,
and accept a worsening move with probability

$$
P(\text{accept}) = e^{-\Delta / T}
$$

where $\Delta$ is how much worse the move is and $T$ is a temperature that falls over time.
Reckless early, fussy late.

```python
import math, random

def anneal(n=8, steps=20_000, t0=2.0, cooling=0.9995):
    board = [random.randrange(n) for _ in range(n)]
    h = conflicts(board)
    for t in range(steps):
        if h == 0:
            return True, t
        temperature = max(t0 * cooling**t, 1e-3)
        col, row = random.randrange(n), random.randrange(n)
        previous, board[col] = board[col], row
        h_next = conflicts(board)
        delta = h_next - h
        if delta <= 0 or random.random() < math.exp(-delta / temperature):
            h = h_next
        else:
            board[col] = previous     # reject, put the queen back
    return h == 0, steps
```

That schedule solved all 500 of my 8-queens runs, with a median of about 2,700 cost evaluations.
Now compare fairly. Random-restart hill climbing took roughly 24 steps, but each step evaluated
all $8 \times 7 = 56$ neighbours, so about 1,340 evaluations. **Annealing did not fail once, and
cost about twice as much.** Do not read that as a guarantee: the failure rate at this schedule
and a 20,000-step budget is small rather than zero, and a batch of 500 is not enough to see the
tail. That is the real trade, and it is the trade you will keep meeting: reliability bought
with evaluations.

| Method | What it keeps | Escapes local minima | Needs tuning |
|---|---|---|---|
| Steepest descent | one state | no | no |
| Sideways moves | one state | plateaus only | the sideways budget |
| Random restarts | one state, many times | yes, by luck | no |
| Simulated annealing | one state | yes, by design | temperature schedule |
| Local beam search | k states | partly, they share information | k |
| Genetic algorithm | a population | yes | a great deal |

A word on **genetic algorithms**, which the textbooks give more space than 2026 practice does.
They keep a population, splice good members together at a crossover point, and mutate. Beautiful
idea, rarely the winner: CMA-ES beats them on continuous problems, and a well-implemented local
search beats them on combinatorial ones, whether that search uses restarts, tabu memory (a short
list of the moves you have just made, which you are then forbidden to undo) or
large-neighbourhood search (rip out a chunk of the current answer and rebuild it optimally).
Crossover only pays when half of one good solution glued to half of another is itself good,
which is rarer than it sounds. Evolutionary methods still earn their keep in multi-objective
design, where NSGA-II remains standard, and in search over sequences and molecules, where there
is no gradient and no useful neighbourhood.

One more that the original version of this post skipped: **min-conflicts**, the local search
that made constraint problems tractable. Pick a variable that is currently in conflict, reassign
it to the value that minimises conflicts, repeat. It solved 8-queens in 60 steps and 100-queens
in 108 steps on my machine, and the step count grows far more slowly than the board does, so a
thousand queens is still routine. Two caveats, because that result gets quoted without them.
The count swings wildly from run to run, so quote a median and not your best run. And the speed
is a property of loosely constrained problems like n-queens, which have solutions almost
everywhere. On a tightly constrained instance min-conflicts stalls like any other hill climber
and needs restarts or a systematic solver. It is the bridge to [part 6 on constraint
satisfaction](/posts/2023/09/csp-basics/).

## 4. Continuous spaces: when there are infinitely many neighbours

If a state is a point in $\mathbb{R}^n$ rather than a board, "look at all the neighbours" is not
available. There are infinitely many, and they are all arbitrarily close. What you have instead
is the slope, and the slope tells you which way is down:

$$
\theta_{t+1} = \theta_t - \eta \nabla J(\theta_t)
$$

$\nabla J$ is the gradient, the direction of steepest increase in cost. $\eta$ is the step size,
which is a statement about how far you trust that direction before the landscape curves away.
Feel the slope under your boots, step downhill, repeat.

That equation is the same hill climbing as section 2 with the neighbour-picking replaced by
calculus, and it inherits the same failure modes. Which is why nobody runs it plain. In 2026,
the practical picks are:

```python
import torch

# AdamW rather than plain SGD: a per-parameter step size is what keeps
# descent working when coordinates are on wildly different scales.
opt = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=0.01)
sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=total_steps)
```

For smooth, low-dimensional problems with cheap exact gradients, `scipy.optimize.minimize` with
`method="L-BFGS-B"` is still the correct answer and converges in far fewer iterations. Full
Newton methods want the $n \times n$ Hessian, which is why they stop being an option the moment
$n$ is large.

When you have no gradient at all, the decision is governed by how much one evaluation costs:

- **Microseconds** (a simulator, a scoring function): CMA-ES, which adapts a covariance matrix
  and is the strongest general-purpose derivative-free optimiser I know of.
- **Minutes to hours** (a training run, a wet-lab assay): Bayesian optimisation. Optuna's TPE
  sampler plus successive-halving pruning is the pragmatic default, because it kills bad trials
  early instead of running every one to completion.

Grid search gets a mention only so that you stop using it. Random search covers the dimensions
that matter better for the same budget, and any sequential method beats both.

## 5. Nondeterministic actions: plans that branch

Turn the key and the engine may or may not start. A single sequence of actions is no longer a
plan, because the second action may not apply after the first one does something unexpected.

The fix is to make the plan a tree with two kinds of node. At an **OR node** the agent chooses,
so one good branch is enough. At an **AND node** the world chooses, so *every* branch has to
work. Searching this structure is called AND-OR search, and the output is a contingency plan: a
program with `if` statements, not a list of moves.

```
state: both squares dirty, robot standing on the left square

[suck]                                     ← the agent chooses (OR)
 ├─ outcome A: this square clean,          ← the world chooses (AND)
 │             the other still dirty
 │   └─ [right]
 │        └─ [suck] ──▶ goal
 └─ outcome B: both squares clean
     └─ goal

A plan counts as a solution only when EVERY branch under an AND node
reaches the goal. One lucky branch is not a plan.
```

Sometimes no acyclic plan exists, and the right answer is a loop: "keep trying to move left
until you actually move left." That is a valid solution as long as every attempt has some chance
of working, which is the assumption you are making whenever you write a retry.

The field moved on from here in a specific direction. Once you attach probabilities to those
outcomes and a reward to the goal, you have a Markov decision process, and value iteration or
reinforcement learning replaces AND-OR search. The structure survives anyway. If you have
written an LLM agent loop that calls a tool, checks whether it succeeded, and takes a different
branch if it did not, you have written a cyclic contingency plan. I go into that machinery in
[what is an agent harness](/posts/2025/08/what-is-an-agent-harness/).

## 6. Partial observations: searching over beliefs

Now the agent cannot see which state it is in. The move that makes everything else possible:
stop searching over physical states and start searching over **belief states**, where a belief
state is everything the agent's history is consistent with.

The original version of this post called a belief state "a probability distribution", and that
was sloppy of me. There are two different objects and it matters which one you are holding:

- **A set of states.** No probabilities, no sensor model, just "I could be in any of these." A
  plan is a solution if it reaches the goal from every member of the set. This is the classical
  search version, and it is what you want when you need a guarantee.
- **A distribution over states.** Probabilities, a motion model, a sensor model, Bayes. This is
  filtering, and with actions and rewards attached it is a POMDP. This is what you want when you
  need a best guess and a measure of how confident it is.

The set version explains why this is hard: with $n$ physical states there are $2^n$ belief
states. A 10 × 10 grid has 100 states and therefore $2^{100}$ beliefs, so nobody enumerates
them. You generate them lazily as the search touches them.

```
 no idea where I am     after moving right     after sensing a wall
 (10 candidates)        (the wheels slip, so   directly to the north
                         now 13)               (2 candidates)

 · · · · · ·            · · · · · ·            · · · · · ·
 · x x █ █ ·            · x x █ █ x            · · x █ █ ·
 · x x x x ·            · x x x x x            · · x x · ·
 · x x x x ·            · x x x x x            · · · · · ·
 · · · · · ·            · · · · · ·            · · · · · ·

 █ is a wall. Only the two cells directly beneath it have a wall to
 their north, which is why sensing one collapses 13 candidates to 2.

 Acting blurs the belief. Sensing sharpens it. The search happens
 over these pictures, never over a single square.
```

Here is the probabilistic version, which is two steps and not one. The original code only had
the sensing half, which is the half that does nothing on its own.

```python
import numpy as np

def predict(belief, move, p_slip=0.1):
    """Acting spreads the belief out: wheels do not always obey.

    move is (d_row, d_col), so (0, 1) is one step right.
    """
    moved = np.roll(belief, shift=move, axis=(0, 1))
    return (1 - p_slip) * moved + p_slip * belief

def update(belief, reading, world, p_correct=0.9):
    """Sensing concentrates it: multiply by the likelihood of the reading."""
    likelihood = np.where(world == reading, p_correct, 1 - p_correct)
    posterior = belief * likelihood
    total = posterior.sum()
    return posterior / total if total else belief
```

`np.roll` wraps around the edges of the grid, which no real robot does. A real motion model is a
convolution of the belief against the map, with probability mass that would land inside a wall
pushed back into the adjacent free cell. The shape is right, though: each move is a blur, each
sensor reading is a pixel-wise multiply and a renormalise. Run those two alternately and you
have a Bayes filter, which is what a particle filter and a Kalman filter both are underneath.

## 7. Online search: acting before you have the map

Everything so far assumed the agent could plan offline against a known model. An agent dropped
into an unmapped building has no such model. It has to interleave: act, observe, revise, act
again. It can only find out what an action does by doing it.

**LRTA\*** (Learning Real-Time A\*, Korf, 1990) is the clean version. Keep a table `H` of
cost-to-go estimates, one entry per state you have stood on, seeded from an ordinary heuristic.
On each move, take the neighbour with the lowest estimated total cost, then, crucially, *raise
the estimate for the state you just left* to reflect what you learned. Optimism about unvisited
neighbours is what drives exploration; each disappointment is written down so the agent does not
repeat it.

```python
def lrta_star(start, goal, actions, result, cost, h0, max_steps=100_000):
    H = {}      # learned cost-to-go for every state we have stood on
    seen = {}   # (state, action) -> the state it actually led to
    s, prev, prev_a = start, None, None
    for step in range(max_steps):
        if s == goal:
            return step, H
        H.setdefault(s, h0(s))

        def f(state, a):
            nxt = seen.get((state, a))
            if nxt is None:
                return h0(state)      # untried: optimistic by default
            return cost(state, a) + H.get(nxt, h0(nxt))

        if prev is not None:
            seen[(prev, prev_a)] = s
            H[prev] = min(f(prev, a) for a in actions(prev))
        a = min(actions(s), key=lambda a: f(s, a))
        prev, prev_a = s, a
        s = result(s, a)              # the world moves us; we only observe
    raise RuntimeError("no goal within the step budget")
```

On a 30 × 30 grid with 25% random walls, A\* with the full map finds a 58-move path. LRTA\* with
no map at all takes **400 moves on its first trial**. Keep the table between trials and it is
down to **78 moves by trial 10** and **58 moves, the optimum, by trial 50**. Nothing about the
maze changed. The agent just stopped being wrong about it.

Two caveats the cheerful version of this post skipped:

- **Irreversible actions are fatal.** LRTA\* assumes it can undo a bad move by walking back. In
  a world with cliffs, or an agent with a `DELETE FROM` tool, there is no such assumption and no
  online algorithm can be safe without an explicit model of what is unrecoverable.
- **No online algorithm is competitive in the worst case.** An adversary can build a maze where
  any agent without the map does arbitrarily worse than one with it. Online search is a bet that
  your world is not adversarial.

The lineage is worth naming, because it does not look like search any more. LRTA\* is doing
value iteration one state at a time, by walking. Real-time dynamic programming (Barto, Bradtke
and Singh, 1995) made that explicit. Monte Carlo tree search with a learned value function,
which is what [part 5](/posts/2023/08/adversarial-search/) is about, is the same instinct with a
better estimator.

## 8. What actually survived to 2026

Being blunt about which of these you will meet:

- **Local search runs modern combinatorial optimisation.** Vehicle routing, scheduling, chip
  placement and timetabling are all solved by guided local search and large-neighbourhood search
  under a time budget. Google's OR-Tools routing solver is local search with a metaheuristic on
  top. This is the most commercially important idea in the post.
- **Gradient descent ate everything differentiable**, and the interesting work moved into the
  optimiser, the learning-rate schedule and the data rather than into the search itself.
- **Simulated annealing is a good baseline and a poor headline.** Reach for it when you want
  something working in twenty minutes.
- **Evolutionary search persists where there is no gradient and no neighbourhood.** In my own
  peptide work the candidate is a sequence and the score comes from a model, so
  mutate-and-select over a population is the natural loop. I wrote about the screening side of
  that in [screening 400k natural products](/posts/2026/03/screening-400k-natural-products/).
- **Belief states became filtering.** Every robot doing SLAM, every tracker, every sensor-fusion
  stack is running predict-and-update.
- **Online search became the agent loop.** Plan a bit, act, observe, revise. The vocabulary
  changed; the control flow did not.

If you want to feel these rather than read about them: replace the hill-climbing loop with an
annealing schedule and plot the conflict count over time; hide a robot on a 10 × 10 grid, give
it noisy distance sensors, and watch the belief collapse; then race A\* with the full map
against LRTA\* without one on a 30 × 30 maze and count moves per trial until the curve flattens.

## 9. The short version

- When you need the final state and not the route, drop the frontier and keep one candidate.
  That is local search: it holds one state, however long it runs.
- Hill climbing fails at local minima, plateaus and ridges. On 8-queens it solves about 14% of random
  starts; allowing sideways moves takes that to 94%.
- Break ties at random. Deterministic tie-breaking cost me 61 percentage points on exactly the
  same algorithm.
- Simulated annealing solved every one of my runs but cost about twice the evaluations of
  random-restart hill climbing. Reliability is bought with evaluations, always.
- In continuous spaces the choice is set by evaluation cost: gradients if you have them, CMA-ES
  if evaluations are cheap, Bayesian optimisation if they are expensive.
- Nondeterminism turns a plan into an AND-OR tree, and a solution has to cover *every* branch
  the world can choose. Your retry loop is one of these.
- A belief state is either a set of possible states (guarantees) or a distribution over them
  (filtering). Pick deliberately; they are not the same object.
- Online agents learn by being wrong in a specific place and writing it down. LRTA\* went from
  400 moves to the 58-move optimum in fifty trials, on a maze it never saw.

*Next in the series: [adversarial search](/posts/2023/08/adversarial-search/), where the
landscape stops sitting still because something else is trying to beat you.*
