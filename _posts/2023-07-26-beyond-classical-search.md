---
title: "Beyond Classical Search: Hill-Climbers, Hidden Worlds & Agents That Learn on the Fly"
date: 2023-07-26
permalink: /posts/2023/07/beyond-search/
tags:
  - artificial intelligence
  - search algorithms
  - local search
  - stochastic
  - partial observability
  - online learning
  - beginner
math: true
---

*If you’ve ever tried every twist of a Rubik’s cube,  
searched for Wi-Fi by inching your laptop around,  
or navigated a dark room with arms outstretched—  
congrats! You already know **local search**, **nondeterminism**, and **partial observability**.*

This gentle tour covers **Chapter 4 of classic AI texts**—the cool stuff that comes **after** Bread-and-Butter A\*:

1. **Local Search & Optimization**  
2. **Continuous Spaces**  
3. **Nondeterministic Actions**  
4. **Partial Observations**  
5. **Online Search in Unknown Worlds**

No headache math—just tiny formulas, bite-size code, and cartoons-in-words.

---

## 1 Local Search Algorithms & Optimization (4 · 1)

> **Big idea:** keep **one** state, tweak it, keep the better one—repeat.

| Algorithm             | Core move             | Gets stuck? | Escape trick |
|-----------------------|-----------------------|-------------|--------------|
| **Hill Climbing**     | Best neighbour        | ✔️          | None         |
| **Simulated Annealing** | Random neighbour, sometimes accept worse | 🔥 lowers chance over time | Temperature |
| **Genetic Algorithm** | Recombine & mutate a *population* | Rare | Diversity |

### 1·1 One-Screen Demo – Hill-Climb Eight Queens

```python
import random

def conflicts(board):
    n = len(board)
    return sum(
        board[i] == board[j] or
        abs(board[i] - board[j]) == j - i
        for i in range(n) for j in range(i+1, n)
    )

def hill_climb(n=8, max_steps=1000):
    board = [random.randrange(n) for _ in range(n)]
    for _ in range(max_steps):
        if conflicts(board) == 0:
            return board
        # pick the queen with most clashes
        col = max(range(n), key=lambda c: sum(
            board[c] == board[j] or abs(board[c]-board[j]) == j-c
            for j in range(n) if j != c))
        # try every row in that column
        best_row = min(range(n), key=lambda r: conflicts(board[:col]+[r]+board[col+1:]))
        board[col] = best_row
    return None

print(hill_climb())
```

Run; most runs solve in milliseconds.

---

## 2 Local Search in **Continuous** Spaces (4 · 2)

When the world isn’t a chessboard but a **smooth landscape**, we use calculus-flavoured tweaks.

### 2·1 Gradient Descent, Micro-Edition

$$
\theta_{t+1} = \theta_t - \eta \nabla J(\theta_t)
$$

- **\( \nabla J \)** = slope of the cost hill  
- **\( \eta \)** = tiny step size

> **Analogy:** feel the slope under your boots and step *downhill* until level ground.

---

## 3 Searching with **Nondeterministic** Actions (4 · 3)

> **“Turn key → maybe car starts, maybe not.”**

| Model           | Plan shape | Goal test |
|-----------------|------------|-----------|
| **AND-OR tree** | Branches when *any* vs *all* outcomes matter | Find a subtree that guarantees success |
| **Min-Max-Cost**| Costs depend on worst outcome | Choose safest path |

Small trick: replace nodes with **sets of possible states** → plan for *all* outcomes.

---

## 4 Searching with **Partial Observations** (4 · 4)

> **You’re in a fog; every step reveals a few metres.**

- Keep a **belief state** \( B \) = probability distribution over where you *might* be.  
- Actions map \( B \to B' \) via **prediction**; sensors shrink \( B' \) via **update** (Bayes).

### 4·1 Tiny Code – Updating a Belief Grid

```python
import numpy as np
def sense_update(belief, sensor, world, p_correct=0.8):
    hit = (world == sensor)
    return normalise(belief * (hit * p_correct + (~hit) * (1-p_correct)))

def normalise(m):
    s = m.sum()
    return m / s if s else m
```

Belief stays a 2-D matrix; each move is a convolution, each sensor ping a pixel-wise multiply.

---

## 5 **Online** Search Agents & Unknown Environments (4 · 5)

> **Plan a bit, act a bit, learn a bit**—like playing a new video game level.

| Algorithm | Key memory       | Behaviour                           |
|-----------|------------------|-------------------------------------|
| **LRTA\*** (Learning Real-Time A\*) | Table of local heuristic corrections | Walks, updates cost estimate, never stops improving |
| **Real-Time Dynamic A\*** | Maintains a frontier under time cap | Pauses to think when safe; otherwise greedy |

### 5·1 Micro-Demo – LRTA\* in a Maze

*(Pseudo-code)*

```
h[s] ← heuristic(s)
loop:
    if s is goal: break
    choose a' ∈ N(s) minimising c(s,a',s') + h[s']
    h[s] ← c(s,a',s') + h[s']
    s ← s'
```

The agent **learns** a better heuristic on the fly—next time it revisits, it’s smarter.

---

## 6 Cheat-Sheet 🧾

```
Local search    = Keep one (or few) states and tweak
Hill climbing   = Greedy climb up/down the slope
Simulated anneal= Accept some bad moves early, cool later
Genetic alg.    = Evolve a population with crossover & mutation
Gradient descent= Local search in ℝ^n using derivatives

Nondeterminism  = Actions give branches → AND-OR plans
Partial info    = Track belief state (probabilities)
Online search   = Interleave planning & execution; learn h(n) on the run
LRTA*           = A* that repairs its own heuristic table
```

---

## 7 Try It Yourself 🧪

1. **Simulated-Anneal Eight-Queens**  
   Replace hill-climb loop with a temperature schedule. Plot “energy” over time.
2. **Hidden Robot**  
   On a 10×10 grid, hide the agent’s coordinates; give noisy distance sensors; implement the belief update.
3. **Online Maze Race**  
   Compare A\* (full map) vs LRTA\* (unknown map) on a 30×30 random maze. Count moves before goal.

---

### 🚀Final Words

When plain old A\* hits a wall—too big, too uncertain, too slippery—**Chapter 4** tools step in:

- **Local search** when the map is huge.
- **Gradient tricks** when the world is smooth.
- **AND-OR plans** when fate rolls dice.
- **Belief states** when your eyes are fogged.
- **Online learners** when the map isn’t even drawn yet.

Master these and your agents won’t just *find* paths—they’ll invent them as they go.

**Happy exploring, and may your local optimum always have an escape tunnel!**