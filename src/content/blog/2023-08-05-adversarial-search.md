---
title: "Adversarial Search 101: From Minimax to AlphaZero, How AI Plans When an Opponent Fights Back"
seoTitle: "Adversarial Search: From Minimax to AlphaZero"
description: "Minimax, alpha-beta pruning, expectiminimax and MCTS: how a program plans when something is planning against it, and what neural evaluation changed."
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

*Part 5 of the AI Foundations series. Everything up to here assumed the world was indifferent:
the maze does not move its walls while you plan. This post is about what changes when
something on the other side of the board is spending its time trying to make your plan fail.*

---

## 1. The whole idea in one sentence

In [part 3](/posts/2023/04/ai-agents-search/) and [part 4](/posts/2023/07/beyond-search/),
search meant finding a path through a world that does not care about you. Adversarial search
is the same problem with one change: every other move belongs to someone whose goal is the
exact negation of yours.

Picture planning a drive across town where, after each turn you take, a rival gets to close
one road. Planning the shortest route is now useless. You have to plan the route that stays
good *after* the worst road closure they can pick, and then after the next one, and the next.

Formally, the classic setting is a game that is **two-player, zero-sum, deterministic,
turn-taking and fully observable**. No dice, no hidden cards, no simultaneous moves. Zero-sum
means one number describes the whole outcome: what is +1 for me is −1 for you. By convention
the two players are called MAX (trying to raise that number) and MIN (trying to lower it).

That is a lot of assumptions, and almost every interesting game breaks at least one of them.
Sections 6 to 8 are the repairs: dice, hidden cards, and games too big to evaluate by hand.

---

## 2. A game is a tree, and the vocabulary is small

Six pieces define a game. If you can write these six functions, every algorithm below runs on
your game unchanged.

| Piece | What it is | Chess example |
|---|---|---|
| Initial state | where you start | the opening position |
| To-move | whose turn it is | white |
| Actions(s) | legal moves | the legal moves in that position |
| Result(s, a) | the state after a move | the board after 1.e4 |
| Is-terminal(s) | is the game over | checkmate, stalemate, repetition |
| Utility(s) | the final score, for MAX | +1 win, 0 draw, −1 loss |

Chain them and you get a **game tree**: nodes are positions, edges are moves, and the layers
alternate between MAX and MIN. Leaf utilities are the only real information in the whole
structure. Everything else is inferred by pushing those values back up.

Here is the standard tiny example, two plies deep with three moves each. A *ply* is one move
by one player, so two plies is one move each:

```
                         MAX to move
                           value 3
              ┌───────────────┼───────────────┐
           MIN a1          MIN a2          MIN a3
              3               2               2
          ┌───┼───┐       ┌───┼───┐       ┌───┼───┐
          3  12   8       2   4   6      14   5   2
```

Read it bottom-up. Under a1, MIN will choose 3 (the smallest). Under a2, MIN chooses 2. Under
a3, MIN chooses 2. MAX then picks the best of 3, 2 and 2, so MAX plays a1 and the value of the
game is 3.

Note what MAX gives up. The single best leaf on the board is 14, sitting under a3. MAX will
never see it, because reaching it requires MIN to play a losing move. That is the whole
psychology of adversarial search in one number.

---

## 3. Minimax: assume the opponent is perfect

The rule is one line: **MAX takes the move with the best worst case.**

$$
\text{Minimax}(s) =
\begin{cases}
\text{Utility}(s) & \text{if } s \text{ is terminal}\\[4pt]
\max\limits_{a}\; \text{Minimax}(\text{Result}(s,a)) & \text{if MAX to move}\\[4pt]
\min\limits_{a}\; \text{Minimax}(\text{Result}(s,a)) & \text{if MIN to move}
\end{cases}
$$

In code, it is a depth-first walk that returns a value and the move that produced it:

```python
import math


def minimax(state, is_max):
    """Exact game value of `state`, plus the move that achieves it."""
    if is_terminal(state):
        return utility(state), None

    best_value = -math.inf if is_max else math.inf
    best_action = None
    for action in actions(state):
        value, _ = minimax(result(state, action), not is_max)
        # Strict comparison keeps the first best move found, so the agent
        # plays the same way twice and its bugs are reproducible.
        if (is_max and value > best_value) or (not is_max and value < best_value):
            best_value, best_action = value, action
    return best_value, best_action
```

One trap I have written into my own code more than once: if a position is not terminal but has
no legal moves, this returns ±infinity and `None`, and the caller then tries to play `None`.
Stalemate is exactly that position. Handle "no legal moves" inside `is_terminal`, not in the
loop.

**What it costs.** Time is $O(b^d)$ and space is $O(bd)$, for branching factor $b$ (the number
of legal moves in a typical position) and depth $d$ in plies. Tic-tac-toe has 255,168 possible
complete games, so pure minimax solves it in well under a second and you can genuinely prove
the game is a draw. Chess has a branching factor around 35 and games run 80 plies or more.
Shannon's estimate of the chess game tree is about $10^{120}$. Minimax on chess is not slow,
it is impossible, and no hardware ever fixes that. Everything in the rest of this post exists
because of that gap.

---

## 4. Alpha-beta pruning: the same answer, a fraction of the work

The insight is small enough to state in a sentence: **once you know a branch cannot change the
final decision, stop reading it.**

Everyday version. You are choosing between two restaurants by reading reviews. Restaurant A's
worst review gives it 3 stars. You start on restaurant B, and its very first review is 2
stars. You can close the tab. B's score can only go down from there, so it can never beat A,
and reading its other forty reviews is wasted time.

Precisely: carry two bounds down the tree. **Alpha** is the best value MAX can already
guarantee somewhere above; **beta** is the best MIN can already guarantee. At a MIN node, as
soon as its value drops to alpha or below, MAX will never choose this branch, so return
immediately. The mirror image applies at MAX nodes.

On the same tree from section 2, searching left to right:

```
                         MAX to move
                           value 3
              ┌───────────────┼───────────────┐
           MIN = 3         MIN ≤ 2         MIN ≤ 2
          ┌───┼───┐       ┌───┼───┐       ┌───┼───┐
          3  12   8       2   .   .      14   5   2
                              ^   ^
                              never evaluated
```

After a1 returns 3, alpha is 3. The first leaf under a2 is 2, so that MIN node can already
hold MAX to 2 or less, which is worse than the 3 in hand. The other two leaves are never
touched. Under a3, the leaves come in an unlucky order (14, then 5, then 2), so nothing is
saved there at all.

That last detail is the practical heart of it. Alpha-beta returns exactly the minimax value,
always, with no approximation. How much it saves depends entirely on move ordering:

```
   chess: branching factor b ≈ 35, depth d = 8 plies

   plain minimax           b^d        35^8  ≈ 2.3 × 10^12 nodes
   alpha-beta, random      b^(3d/4)   35^6  ≈ 1.8 × 10^9  nodes
   alpha-beta, best order  b^(d/2)    35^4  =   1,500,625 nodes
```

With perfect ordering the effective branching factor drops from $b$ to $\sqrt{b}$, which means
**the same time budget buys twice the depth**. That is why engines spend real effort guessing
the best move before searching it: try the previous iteration's best move first, then captures
ordered by most-valuable-victim, then moves that caused cutoffs at the same depth elsewhere
(killer moves).

```python
def alphabeta(state, depth, alpha, beta, is_max):
    if depth == 0 or is_terminal(state):
        return evaluate(state)

    if is_max:
        value = -math.inf
        for action in ordered_actions(state):  # ordering is where the wins are
            child = result(state, action)
            value = max(value, alphabeta(child, depth - 1, alpha, beta, False))
            alpha = max(alpha, value)
            if alpha >= beta:
                break  # MIN already has a better option elsewhere
        return value

    value = math.inf
    for action in ordered_actions(state):
        child = result(state, action)
        value = min(value, alphabeta(child, depth - 1, alpha, beta, True))
        beta = min(beta, value)
        if beta <= alpha:
            break  # MAX already has a better option elsewhere
    return value
```

Two things I would fix in the version of this code I published in 2023. It named its
evaluation function `eval`, shadowing a builtin, and it used the literal characters `α` and
`β` as variable names. Python accepts both. Neither survives contact with a colleague, a grep,
or a keyboard without a Greek layout.

The other cheap win is a **transposition table**: positions repeat through different move
orders, so hash each position (Zobrist hashing is the standard trick) and cache its value with
the depth it was searched to. In practice this turns the tree into a graph, and the best move
it remembers for a position feeds straight back into move ordering, which is where most of the
gain shows up.

---

## 5. Running out of time: cutoffs, evaluation, and the horizon

Alpha-beta still needs to reach terminal positions. In chess it never will. So we lie in a
controlled way:

1. **Cut off at depth N** and call an evaluation function instead of a real utility.
2. **Iterative deepening.** Search depth 1, then 2, then 3, until the clock runs out. You
   always have a legal move ready, and each pass hands better move ordering to the next.

An **evaluation function** is a fast guess at who is winning. The classic form is a weighted
sum of features: material balance, mobility, pawn structure, king safety. It is not a
probability and it is not exact; it only has to rank positions in roughly the right order.

Two failure modes are worth naming because they will bite you:

**The horizon effect.** If your search stops exactly one ply before your queen gets taken, the
position looks wonderful. Engines fix this with **quiescence search**: at the cutoff, keep
searching captures and checks only, until the position is quiet. It is a small amount of code
and one of the biggest single strength gains you can make.

**A cutoff is not a stopping condition.** Checking the clock between iterations is not enough;
a depth-9 search can overrun the whole budget. Real engines check the clock inside the search
and abandon the current iteration entirely, keeping the last completed depth's answer. A
half-finished depth is not a weaker answer, it is an unreliable one: the root moves it got
through carry depth-9 scores, the rest still carry depth-8 scores, and comparing across two
depths picks the wrong move.

---

## 6. Adding dice: expectiminimax

Backgammon has a third kind of node. Between your move and your opponent's, the dice decide
something, and nobody controls it. So insert a **chance node** whose value is the
probability-weighted average of its children.

$$
V(s) =
\begin{cases}
\max_a V(\text{Result}(s,a)) & \text{MAX node}\\[4pt]
\min_a V(\text{Result}(s,a)) & \text{MIN node}\\[4pt]
\sum_{s'} P(s' \mid s)\, V(s') & \text{chance node}
\end{cases}
$$

```python
def expectiminimax(state, depth):
    if depth == 0 or is_terminal(state):
        return evaluate(state)
    if node_type(state) == "chance":
        return sum(p * expectiminimax(child, depth - 1)
                   for child, p in outcomes(state))
    ...  # MAX and MIN branches exactly as in alphabeta()
```

Two consequences that surprise people:

**The tree explodes.** Backgammon has 21 distinct dice rolls, so the branching factor
multiplies by 21 at every chance layer. Depth 3 is real work.

**Your evaluation function's scale now matters.** Under plain minimax only the *order* of
evaluation values matters, since you only ever compare them. Averaging is arithmetic, so
doubling one feature's weight genuinely changes which move wins. Evaluation for stochastic
games should be a calibrated estimate of the expected outcome, not an arbitrary score.

Pruning still works, but not as plain alpha-beta. The correct family is Ballard's
**star-minimax** algorithms (star1 and star2), which prune chance nodes by bounding the
not-yet-computed children with the known range of the utility function. That only works if
your evaluation is bounded, which is another reason to normalise it.

---

## 7. Hidden information, and the mistake almost everyone makes first

Poker, Stratego, Battleship and fog-of-war strategy games break the "fully observable"
assumption. You do not know which state you are in, only a **belief state**: a probability
distribution over the states consistent with what you have seen.

The obvious repair is to sample. Deal the opponent a plausible hand, solve that fully-visible
game, repeat a thousand times, and play the move with the best average. This is called
perfect-information Monte Carlo, and it is what the original version of this post recommended.
It is wrong, and it is worth understanding why, because the failure is not a matter of
sampling more.

In every sampled world you already know the hidden cards, so **your agent never plays to find
things out and never plays to hide things**. It will not bluff, because bluffing only pays
when the opponent is uncertain, and in the sampled world nobody is. It will not scout, because
there is nothing left to learn. The technical names for the two defects are strategy fusion
and non-locality. The agent plans a different strategy in each world and then averages them,
which is not a strategy at all.

The correct framing is that the solution to an imperfect-information game is a **randomised
strategy**, a probability distribution over moves in each situation. The target is a Nash
equilibrium, a pair of strategies where neither player gains by changing theirs alone, rather
than a single best move. The workhorse algorithm is **counterfactual regret
minimisation** (CFR) and its faster variants: play the game against yourself millions of
times, track how much you regret not having played each action, and shift your mixed strategy
towards the actions you regret not playing. Libratus, which beat four top professionals at
heads-up no-limit Texas hold'em in 2017, combined a CFR-derived blueprint strategy with
re-solving the current subgame during play. Pluribus extended the same family to six-player
poker in 2019.

If you take one thing from this section: in a game with hidden information, an agent that
always plays its single best move is exploitable by definition. Randomising is not a hack, it
is the solution.

---

## 8. MCTS: searching when you cannot write an evaluation function

Go broke alpha-beta twice over. The branching factor is around 250, and, far worse, nobody
could write an evaluation function for a Go position that was both fast and any good. Material
counting does not exist there.

**Monte Carlo tree search** removes the need for one. Instead of evaluating a position, play
the game out to the end from it, many times, and count how often you won.

```
   root
    │
    ├─ 1 select    descend from the root, always taking the child
    │              with the best UCT score, until you reach a node
    │              with an untried move
    │
    ├─ 2 expand    add one child for that untried move
    │
    ├─ 3 evaluate  classic MCTS: play random moves to the end and
    │              score the result. AlphaZero: ask a value network
    │              and skip the rollout entirely
    │
    └─ 4 back up   add the result to the visit count N and total
                   value W of every node on the path

   repeat a few thousand times, then play the child of the root with
   the highest visit count, not the highest average value
```

The selection rule is the interesting part, because it is the explore-versus-exploit trade-off
in one formula. **UCT**, upper confidence bounds applied to trees, picks the child maximising

$$
\frac{W_i}{N_i} + c\sqrt{\frac{\ln N_{\text{parent}}}{N_i}}
$$

```python
def uct_score(child, parent_visits, c=1.4):
    if child.visits == 0:
        return math.inf  # every move gets tried at least once
    exploit = child.total_value / child.visits
    explore = c * math.sqrt(math.log(parent_visits) / child.visits)
    return exploit + explore
```

The first term is the child's average result so far. The second grows for children you have
rarely visited, so a promising-but-untested move keeps getting another look. With results
scaled to $[0, 1]$, $c \approx 1.4$ is the usual starting point, and it is worth tuning per
game.

Playing the **most visited** child rather than the highest-scoring one is not a detail. A
child with one lucky visit can have an average of 1.0. Visit count is the statistic the
algorithm actually spent its budget on.

AlphaGo and AlphaZero changed two things and won everything. Random rollouts were replaced by
a neural network with a **value head** (how good is this position) and a **policy head**
(which moves are worth considering), and the selection rule became **PUCT**, which weights
exploration by the policy's prior:

$$
Q(s,a) + c_{\text{puct}}\, P(s,a)\, \frac{\sqrt{\sum_b N(s,b)}}{1 + N(s,a)}
$$

Same skeleton, better guesses at both ends. AlphaZero learned entirely from self-play with no
human games, and by the published figures it searched on the order of a thousand times fewer
positions per second than a conventional chess engine while playing better. The lesson is not
"search is obsolete". It is that **a better evaluation makes a smaller search sufficient.**

---

## 9. Where this actually stands in 2026

| Game | What won | Milestone |
|---|---|---|
| Chess | alpha-beta, heavy pruning, transposition tables, endgame tables | Deep Blue, 1997 |
| Go | MCTS guided by policy and value networks | AlphaGo, 2016 |
| Chess, shogi, Go from scratch | self-play RL plus MCTS, no human games | AlphaZero, 2017 |
| Heads-up no-limit poker | CFR blueprint plus subgame re-solving | Libratus, 2017 |
| Six-player poker | the same family, cheaper search | Pluribus, 2019 |
| StarCraft II | league self-play, policy gradients, no tree search | AlphaStar, 2019 |
| Board games without the rules | a learned model, planning in latent space | MuZero, 2020 |

Three corrections to the way this used to be told, including by me.

**The "classical search versus neural networks" split is dead.** Stockfish, still the
strongest engine on ordinary hardware, has used an NNUE evaluation since 2020: a small neural
network, efficiently updatable as pieces move, evaluated on CPU inside a conventional
alpha-beta search. The hand-written evaluation was retired a few releases later. Leela Chess
Zero comes from the other direction, an AlphaZero-style network with MCTS. Both are hybrids.
The modern answer is a learned evaluation inside a classical search, not one replacing the
other.

**AlphaStar used no tree search.** It was supervised learning from human replays followed by
league self-play with policy-gradient methods. Whenever the action space is huge, continuous,
or real-time, tree search stops being the tool.

**Games do get finished.** Checkers was weakly solved in 2007 (perfect play is a draw). Every
chess position with seven pieces or fewer is fully solved and shipped as a lookup table, which
is why engines play endgames perfectly rather than well.

The last thing worth saying is that this machinery came back around. When a language model is
asked to produce several candidate solutions, score them with a verifier, expand the promising
ones and discard the rest, that is selection, expansion, evaluation and back-up wearing
different clothes. The hard part is the same as it was for chess in 1970 and Go in 2005: the
search is easy, and the evaluation function is the whole problem.

---

## 10. What I would actually build

```
   can both players see the whole state?
        │
        ├─ no ──→ hidden information
        │         belief states, self-play, CFR
        │         (poker, Stratego, most card games)
        │
        └─ yes ─→ is there randomness?
                     │
                     ├─ yes ─→ expectiminimax, star-minimax
                     │         (backgammon, Yahtzee)
                     │
                     └─ no ──→ can you write an evaluation
                               function you trust?
                                  │
                                  ├─ yes → alpha-beta, plus a
                                  │        learned evaluation
                                  │        (chess, checkers)
                                  │
                                  └─ no  → MCTS with a learned
                                           value network
                                           (Go, general games)
```

If you want to feel these rather than read them, three exercises in increasing order of pain.

1. **Connect Four with alpha-beta.** Evaluate by counting open three-in-a-rows, weighted, plus
   a centre-column bonus. Then add move ordering (centre columns first) and measure how many
   plies you reach in two seconds, before and after. The jump is the point of the exercise.
   Connect Four is solved, so you can check your engine against known perfect play.
2. **MCTS against minimax at tic-tac-toe.** Minimax will never lose, so the real question is
   how many rollouts MCTS needs before it also never loses. Plot it. It is fewer than you
   expect.
3. **A tiny expectiminimax for one round of Yahtzee.** Decide which dice to keep. Compare
   against a greedy baseline, and watch how quickly the chance-node branching factor eats your
   patience.

---

## 11. The short version

- Adversarial search is ordinary search where every other move is chosen by someone who wants
  you to lose. You optimise the worst case, not the best case.
- **Minimax** is exact and unusable on its own: $O(b^d)$, and chess is roughly $b = 35$ with
  $d = 80$.
- **Alpha-beta** returns the identical answer while skipping branches that cannot matter. With
  good move ordering the effective branching factor falls from $b$ to $\sqrt{b}$, which
  doubles the depth you can afford.
- Real engines add a depth cutoff, an evaluation function, iterative deepening, quiescence
  search and a transposition table. Quiescence search is the cheapest large gain available.
- **Dice** need chance nodes and expectiminimax, and they make the *scale* of your evaluation
  function matter, not just its ordering.
- **Hidden information** breaks sampling-based approaches: averaging over fully-visible worlds
  never bluffs and never scouts. The solution is a randomised strategy, learned with CFR.
- **MCTS** replaces the evaluation function with statistics from playouts, and AlphaZero
  replaced the playouts with a network. Play the most-visited child, not the highest-scoring
  one.
- In 2026 the split between classical search and neural evaluation is gone. Stockfish runs a
  neural evaluation inside alpha-beta; Leela runs MCTS around a network. Pick the search that
  fits your game, then spend your effort on the evaluation.

*Next in the series: [constraint satisfaction](/posts/2023/09/csp-basics/), where the problem
stops being a sequence of moves and becomes a set of variables that all have to agree with
each other.*
