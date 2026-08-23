---
title: "Adversarial Search 101: From Minimax to AlphaZero—How A I Plans When an Opponent Fights Back"
description: "Minimax, alpha-beta pruning and Monte Carlo tree search: how a program plans when an opponent is planning against it."
date: 2023-08-05
permalink: "/posts/2023/08/adversarial-search/"
tags:
  - "artificial intelligence"
  - "game ai"
  - "adversarial search"
  - "minimax"
  - "alpha-beta pruning"
  - "monte carlo tree search"
  - "beginner"
series: "AI Foundations"
seriesOrder: 5
math: true
---

*If you’ve ever played chess, Rock-Paper-Scissors, or even ‘‘Guess Which Hand?’’  
you already grasp the soul of **adversarial search**:  
make a move that’s good for you **and** bad for the other side.*

This post walks through Chapter 5 style topics—one friendly slice at a time:

1. **Games & Game Trees**  
2. **Optimal Play: the Minimax Decision**  
3. **Alpha–Beta Pruning (search twice as deep, same work)**  
4. **Imperfect, Real-Time Decisions (cutoffs & evaluation)**  
5. **Stochastic Games (dice on the board)**  
6. **Partially Observable Games (poker & fog-of-war)**  
7. **State-of-the-Art Game Programs**  
8. **Alternative Approaches (RL, self-play, MCTS)**  

No scary proofs—just bite-size math, pocket code, and visual metaphors.

---

## 1 Games = Trees with Turns (5 · 1)

| Ingredient | Meaning in code |
|------------|-----------------|
| **State**  | Snapshot of the board |
| **Player(s)** | Whose turn? “MAX” vs “MIN” |
| **Actions** | Legal moves from the state |
| **Terminal ?** | Win / lose / draw flag |
| **Utility** | +1, 0, –1 (or a score) |

Draw arrows for moves → voilà, a **game tree**.  
Leaf utilities ripple *upward* to tell us which root move guarantees best outcome.

---

## 2 Optimal Decisions = **Minimax** (5 · 2)

> **Rule:** MAX picks the move with the **largest worst-case** utility.

$$
\text{Minimax}(s) =
\begin{cases}
\max\limits_{a}\; \text{Minimax}(\text{Succ}(s,a)) & \text{if MAX turn}\\[4pt]
\min\limits_{a}\; \text{Minimax}(\text{Succ}(s,a)) & \text{if MIN turn}\\[4pt]
\text{Utility}(s) & \text{if terminal}
\end{cases}
$$

Think of it as MAX saying “Assume my rival is perfect; what move still leaves me happiest?”

---

### 2·1 One-Screen Demo – Pure Minimax Tic-Tac-Toe

```python
def minimax(state, player):
    if terminal(state):
        return utility(state), None
    best_val = -float('inf') if player=='X' else float('inf')
    best_act = None
    for a in actions(state):
        val, _ = minimax(result(state, a), opponent(player))
        if (player=='X' and val>best_val) or (player=='O' and val<best_val):
            best_val, best_act = val, a
    return best_val, best_act
```

Works… but visits every node → **slow** for chess-sized trees.

---

## 3 Alpha–Beta Pruning (5 · 3)

> Skip exploring any branch that **can’t possibly** change the answer.

- Keep two bounds: **α** = best found for MAX so far, **β** = best for MIN.  
- If a node’s value proves **≤ α** or **≥ β**, prune!

**Win:** same answer as full minimax; often cuts search **by an order of magnitude**.

```python
def alphabeta(s, depth, α, β, player):
    if depth==0 or terminal(s):
        return eval(s)
    if player=='MAX':
        v=-float('inf')
        for a in actions(s):
            v = max(v, alphabeta(result(s,a), depth-1, α, β, 'MIN'))
            α = max(α, v)
            if β <= α: break          # β-cutoff
        return v
    else:
        v=float('inf')
        for a in actions(s):
            v = min(v, alphabeta(result(s,a), depth-1, α, β, 'MAX'))
            β = min(β, v)
            if β <= α: break          # α-cutoff
        return v
```

Add **iterative deepening** + **move ordering** → search 6–8 plies in chess under a second on a laptop.

---

## 4 Imperfect, Real-Time Decisions (5 · 4)

Big games need answers **before** the hourglass empties.

1. **Depth Cut-off** – search N plies, then use `eval(state)`.
2. **Evaluation Function** – quick maths that estimates utility.  
   - Chess: *material + mobility + king safety*.  
   - Othello: *disc diff + corner possession*.
3. **Iterative Deepening** – run depth 1, 2, 3… until time up → always have a best move ready.

---

## 5 Stochastic Games (5 · 5)

Add dice → use **Expectiminimax**:

$$
V(s) =
\begin{cases}
\max_a V(\text{Succ}(s,a)) & \text{MAX node}\\
\min_a V(\text{Succ}(s,a)) & \text{MIN node}\\
\sum_{s'} P(s'|s,a)\,V(s') & \text{Chance node}\\
\end{cases}
$$

Backgammon agents roll with this plus alpha-beta-style pruning called **σ-cuts**.

---

## 6 Partially Observable Games (5 · 6)

Poker, Battleship, Stratego…

- Maintain **belief states** over hidden cards.  
- Use **Monte Carlo Sampling**: simulate many deals consistent with your observations, run minimax/MCTS on each, pick the move with highest average payoff.

> **Liberatus (Poker AI)** crushed pros via **Counterfactual Regret Minimization (CFR)**—it learns a near-Nash strategy across **all** hidden possibilities.

---

## 7 State-of-the-Art Game Programs (5 · 7)

| Game      | Technique                           | Milestone |
|-----------|-------------------------------------|-----------|
| **Chess** | Alpha–Beta + heuristics + table-bases | Deep Blue (1997) |
| **Go**    | **Monte Carlo Tree Search + Deep Nets** | AlphaGo (2016) |
| **Shogi / Chess 2.0** | **Self-play RL (AlphaZero)** | 2017 |
| **Poker** | CFR + self-play                       | Libratus (2017) |
| **StarCraft II** | **Policy gradient + MCTS + scripted micro** | AlphaStar (2019) |

---

## 8 Alternative Approaches (5 · 8)

1. **Monte Carlo Tree Search (MCTS)** – build tree by sampling playouts; balance explore/exploit with **UCT**.
2. **Reinforcement Learning** – learn evaluation or policy via self-play (TD-Gammon → AlphaZero).
3. **Neuro-Symbolic Mixes** – deep nets for pattern recognition, symbolic search for exact tactics.

---

## 9 Cheat-Sheet 🧾

```
Game tree       = Nodes alternate MAX / MIN / chance
Minimax         = Optimal play vs perfect foe
Alpha-Beta      = Same result, prunes hopeless branches
Cutoff + Eval   = Play fast with an informed guess
Expectiminimax  = Minimax + probability at chance nodes
Belief state    = Probability over hidden info
MCTS            = Build tree by random rollouts (good for Go)
AlphaZero       = Self-play RL + MCTS → beats everything
```

---

## 10 Try It Yourself 🧪

1. **Write an Alpha-Beta Connect-Four**  
   Use a simple evaluation (center-column bonus). How many plies can you reach in <2 seconds?
2. **MCTS vs Minimax Tic-Tac-Toe**  
   Replace evaluation with 10 000 random rollouts per move—see who wins more.
3. **Stochastic Mini-Yahtzee**  
   Code a tiny expectiminimax; compare vs a greedy baseline.

---

### 🚀Final Words

Classical search finds paths in a friendly world, but **adversarial search** fights a moving target.

- **Minimax** teaches defence.  
- **Alpha–Beta** teaches efficiency.  
- **MCTS & self-play RL** teach *intuition* beyond brute force.

Master these and your code will not just *solve* puzzles—it will **outfox living, plotting opponents**.

**Happy gaming, and may your branch always prune early!**
