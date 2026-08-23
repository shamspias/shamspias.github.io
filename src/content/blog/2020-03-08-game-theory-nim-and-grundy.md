---
title: "Game Theory: Nim, Losing Positions, and the Grundy Number"
description: "Two players, perfect information, no luck. Who wins? The answer comes from labelling positions, and one theorem collapses any such game into a single number."
date: 2020-03-08
permalink: "/posts/2020/03/game-theory-nim-and-grundy/"
lang: en
tags:
  - "algorithms"
  - "game theory"
  - "nim"
  - "grundy"
  - "problem solving"
series: "Problem Solving From Zero"
seriesOrder: 15
math: true
---

*A game with two players, full information, no dice, and a player who cannot move loses. Every such game has a completely determined winner from the start, and finding it is a labelling exercise. Then the Sprague-Grundy theorem does something that still strikes me as remarkable: it collapses any such game into one number, and lets you add games together with exclusive or.*

## 1. The setting

The whole of this part concerns **impartial games under normal play**:

- Two players alternate moves.
- Both see everything. No hidden cards, no randomness.
- The moves available depend only on the *position*, not on whose turn it is. That is what "impartial" means, and it rules out chess, where each player moves their own pieces.
- A player with no legal move **loses**. That is "normal play", as opposed to misère, where they win.
- The game is finite: no infinite play.

Under those rules, every position is either a **win for the player about to move** or a **loss** for them. There is no third option and no luck. The standard names:

- **N-position**: the **N**ext player to move wins.
- **P-position**: the **P**revious player wins, so the player about to move loses.

## 2. The two rules that label everything

This is the whole theory, in two lines:

- A position is a **loss** (P) if **every** move leads to a win for the opponent.
- A position is a **win** (N) if **some** move leads to a loss for the opponent.

A position with no moves at all is a loss, since "every move leads to a win" is vacuously true when there are no moves. That base case falls out rather than being assumed, which is a good sign.

Those two rules are a recursion, so they are also a dynamic program.

### A worked example: take 1, 2 or 3 stones

One pile of `n` stones. A move removes 1, 2 or 3. Taking the last stone wins.

The rules translate directly into a table, and I am writing it out the long way
on purpose: the compact one-liner version needs a double negative, and a double
negative in a win-loss condition is where bugs live.

```python
def losing(n):
    dp = [False] * (n + 1)
    dp[0] = True                              # no moves: the mover loses
    for i in range(1, n + 1):
        dp[i] = True                          # assume a loss
        for k in (1, 2, 3):
            if k <= i and dp[i - k]:          # a move to a losing position
                dp[i] = False                 # so this is a win
                break
    return dp[n]
```

Run it and the pattern is immediate:

```
  n      0  1  2  3  4  5  6  7  8  9 10 11 12
  lose   L  W  W  W  L  W  W  W  L  W  W  W  L
         ^           ^           ^           ^
         multiples of 4 are losses
```

The player facing a multiple of 4 loses. The reason is clean: from a multiple of 4 every move leaves 1, 2 or 3 fewer, which is not a multiple of 4; and from a non-multiple you can always take the remainder and hand your opponent a multiple of 4. The winning strategy is "always leave a multiple of 4".

**The general lesson, and it is the practical one: compute the table for small `n`, then look for the pattern.** Very often the answer to a contest game problem is `n % (k + 1) == 0` or something equally small, and the fastest route to it is thirty lines of brute force and a printed table. I do this before trying to be clever, every time.

## 3. Nim

Now the game the whole theory is named after. Several piles. A move takes any positive number of stones from **one** pile. A player with no stones to take loses.

The answer is startling in its simplicity.

> The player about to move loses exactly when the exclusive or of all pile sizes is zero.

That exclusive or, `a₁ ^ a₂ ^ ... ^ aₙ`, is called the **Nim-sum**.

```python
from functools import reduce
from operator import xor

def nim_loses(piles):
    return reduce(xor, piles, 0) == 0
```

```
  piles  3, 4, 5

  3 = 0 1 1
  4 = 1 0 0
  5 = 1 0 1
  xor = 0 1 0  =  2   nonzero, so the mover WINS

  winning move: make the xor zero.
  target for pile 5 is 5 ^ 2 = 7, bigger, no good
  target for pile 4 is 4 ^ 2 = 6, bigger, no good
  target for pile 3 is 3 ^ 2 = 1, smaller: take 2 from the pile of 3
  leaves 1, 4, 5:  0 0 1 ^ 1 0 0 ^ 1 0 1 = 0
```

### Why the exclusive or

The proof is two halves, and both are short enough to be worth seeing.

**If the Nim-sum is zero, every move makes it nonzero.** A move changes exactly one pile, from `a` to `b` with `b < a`. The new Nim-sum is `0 ^ a ^ b`, which is `a ^ b`, and since `a ≠ b` that is nonzero. So from a zero position you always hand over a nonzero one.

**If the Nim-sum `s` is nonzero, some move makes it zero.** Let `h` be the highest set bit of `s`. Some pile `a` has that bit set, because otherwise the bit could not appear in the exclusive or. Then `a ^ s < a`, since it clears bit `h` and only changes lower bits. So reduce that pile to `a ^ s`, which is a legal move, and the new Nim-sum is `s ^ a ^ (a ^ s) = 0`.

Together: zero positions can only move to nonzero ones, and nonzero positions can always move to zero. Since the final position, all piles empty, has Nim-sum zero and is a loss, zero is a loss and nonzero is a win.

```python
def winning_move(piles):
    s = reduce(xor, piles, 0)
    if s == 0:
        return None                           # lost, no good move
    for i, a in enumerate(piles):
        target = a ^ s
        if target < a:
            return (i, a - target)            # take this many from pile i
    return None
```

## 4. Grundy numbers, and the theorem

Nim is solved. What about the hundred other games? Here is the idea that handles all of them at once.

Give every position a number, its **Grundy value** (also Sprague-Grundy value, or nimber):

$$
G(\text{position}) = \operatorname{mex}\{\, G(\text{next}) : \text{next reachable in one move} \,\}
$$

where **mex** is the *minimum excludant*: the smallest non-negative integer not in the set.

```python
def mex(values):
    s = set(values)
    i = 0
    while i in s:
        i += 1
    return i
```

Two facts, and the second is the theorem.

**Fact one: `G = 0` exactly when the position is a loss.** The mex of an empty set is 0, and a position is 0 only if no move leads to a 0, which is precisely the losing rule from section 2. So Grundy values generalise the win-loss labelling.

**Fact two, the Sprague-Grundy theorem: a game made of independent sub-games has Grundy value equal to the exclusive or of theirs.**

$$
G(A + B) = G(A) \oplus G(B)
$$

That is the remarkable part. Any impartial game is *equivalent* to a single Nim pile of size `G`, and playing several games at once is playing Nim on their Grundy values. Nim's exclusive-or rule was not a coincidence about stones; it is the general law, and Nim is the simplest game that exhibits it.

For a single Nim pile of `n`, the moves lead to `0, 1, ..., n-1`, whose mex is `n`. So `G(pile of n) = n`, and the theorem gives exactly the Nim-sum rule.

## 5. Using it: a subtraction game

Same one pile, but a move takes 1, 3 or 4 stones. What now? Compute Grundy values.

```python
def grundy_subtraction(n, moves=(1, 3, 4)):
    g = [0] * (n + 1)
    for i in range(1, n + 1):
        g[i] = mex(g[i - m] for m in moves if m <= i)
    return g
```

```
  n    0  1  2  3  4  5  6  7  8  9 10 11 12 13 14
  G    0  1  0  1  2  3  2  0  1  0  1  2  3  2  0
       L  W  L  W  W  W  W  L  W  L  W  W  W  W  L

  period 7 after the start: G(n) = G(n - 7) from n = 7 on
```

Losing positions are `n ≡ 0` or `n ≡ 2 (mod 7)`. Nobody derives that by cleverness; you compute the table and read it off. And now, thanks to the theorem, three piles of this game with sizes 5, 9 and 12 have Grundy value `3 ^ 0 ^ 3 = 0`, so the player about to move loses. Without the theorem that would be a search over a product of three state spaces.

## 6. Games worth knowing by their answer

**Nim.** Exclusive or of pile sizes.

**Take 1 to `k` from one pile.** Loss when `n % (k + 1) == 0`.

**Staircase Nim.** Coins on a staircase moving down one step at a time. Only the coins on odd-numbered steps matter, and it becomes Nim on those counts. The general trick, worth remembering: **look for the parity that makes half the position irrelevant.**

**Green Hackenbush**, or "cut an edge from a tree and discard the disconnected part". The Grundy value of a tree is computed bottom-up: a leaf is 0, and a subtree rooted at `v` contributes `G(child) + 1` for each child, all exclusive-or'ed together.

**Turning Turtles and similar coin-flipping games.** Grundy value is the exclusive or over the individual coins.

**Misère Nim**, where taking the last stone *loses*. The rule changes: if every pile has size 1, the mover wins when the number of piles is even; otherwise the normal Nim rule applies. Misère play is much harder in general, and Sprague-Grundy does not apply to it. If a problem says "the player who takes the last stone loses", stop and think rather than reaching for the exclusive or.

## 7. Recognising these problems, and the practical procedure

The signals: two players, alternating, both playing optimally, and a question of the form "who wins" or "how many first moves win".

The procedure I follow, in order:

1. **Write the brute-force recursion.** Position in, win or lose out, memoised. This is [part 8](/posts/2017/11/memoisation/) with a boolean result.
2. **Print the table for small inputs.** Look for a period, a modulus, a parity, or a power of two.
3. **If the game splits into independent parts, compute Grundy values and exclusive-or them.** Independence is the condition: the parts must not interact at all.
4. **Guess the pattern, then verify it against the brute force** for `n` up to a few thousand. This is the same brute-force-comparison habit from [part 6](/posts/2017/04/greedy-when-it-works/), and it is how you get certainty without a proof.

```python
from functools import lru_cache

def wins(state, moves_from):
    @lru_cache(maxsize=None)
    def go(s):
        return any(not go(t) for t in moves_from(s))
    return go(state)
```

That five-line function solves an enormous number of game problems directly, and when it is too slow it still generates the table you need to find the pattern.

## 8. Where it stops working

**Partisan games.** If the two players have different move sets, as in chess or Hackenbush with coloured edges, Sprague-Grundy does not apply. That is the theory of combinatorial games proper, with values that are not just numbers.

**Misère play.** As above.

**Games with draws or loops.** The finiteness assumption is load-bearing. Positions that can repeat forever need a different treatment.

**Scoring games.** "Who wins" is a different question from "maximise your score". The latter is minimax with values, not a win-loss labelling, and it is the subject of a different family of algorithms.

## The short version

- Impartial, alternating, perfect information, finite, and a player who cannot move loses: every position is a determined win or loss.
- A position is a loss if every move leads to a win, and a win if some move leads to a loss. No moves means a loss, which falls out rather than being assumed.
- Nim: the mover loses exactly when the exclusive or of the pile sizes is zero. From zero every move makes it nonzero; from nonzero you can always make it zero by clearing the top bit of the Nim-sum.
- The Grundy value of a position is the mex of the values of its successors. It is zero exactly for losing positions.
- Sprague-Grundy: independent games combine by exclusive or. Any impartial game is equivalent to one Nim pile of size `G`, which is why Nim's rule was the general law all along.
- In practice: brute force the small cases, print the table, and look for the period or modulus. Do not try to be clever first.
- Verify a guessed pattern against the brute force up to a few thousand. Certainty without a proof, in five minutes.
- It does not cover partisan games, misère play, loops or scoring. "The player who takes the last stone loses" means stop and think.

Next: the number theory you actually need. Sieves, greatest common divisors, modular arithmetic, and inverses.
