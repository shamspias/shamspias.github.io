---
title: "Greedy: When Taking the Best Now Is Provably Right"
description: "A greedy rule that passes the samples and fails the tests is the most common way to lose a contest. Here is how to tell a correct greedy rule from a plausible one."
date: 2017-04-08
permalink: "/posts/2017/04/greedy-when-it-works/"
lang: en
tags:
  - "algorithms"
  - "greedy"
  - "problem solving"
  - "proofs"
series: "Problem Solving From Zero"
seriesOrder: 6
math: true
---

*Greedy algorithms are the shortest correct solutions and the shortest wrong ones. The code is never the hard part: it is five lines and a sort. The hard part is knowing whether the rule you picked is actually right, and "it passed the samples" is not knowing. This part is mostly about that.*

## 1. What greedy means

A greedy algorithm builds an answer one piece at a time, and at each step it takes whatever looks best right now, with no plan to revise. No backtracking, no lookahead, no table.

The coin problem is the standard first example. Make 63 pence from coins of 50, 20, 10, 5, 2 and 1.

```python
def change(amount, coins):
    coins = sorted(coins, reverse=True)
    used = []
    for c in coins:
        while amount >= c:
            used.append(c)
            amount -= c
    return used
```

`change(63, [50,20,10,5,2,1])` gives `[50, 10, 2, 1]`: four coins, and that is optimal.

Now change the coin set to 1, 3 and 4, and ask for 6. Greedy takes 4, then 1, then 1: three coins. The optimal answer is 3 and 3: two coins. Same code, same rule, wrong answer.

That is the entire subject of this part. Greedy worked for one coin set and failed for another, and nothing in the code tells you which you have. The property lives in the *problem*, not the algorithm, and you have to check for it.

## 2. The two properties that make greedy correct

A greedy algorithm is correct when the problem has both of these. The names are standard and worth knowing, because they give you something specific to check.

**The greedy choice property.** There is an optimal solution that contains the choice greedy makes first. Not "greedy's choice is in every optimal solution", just "in at least one". If that holds, taking the greedy choice never closes the door on optimality.

**Optimal substructure.** After making that choice, what remains is a smaller instance of the same problem, and solving it optimally gives an optimal whole.

The second one is usually easy and obvious. The first is where the work is, and there is a standard technique for it.

### The exchange argument

This is the tool. It is worth learning properly because it turns "I think this is right" into "this is right".

The shape: take any optimal solution. If it does not already start with greedy's choice, *modify it* so it does, and show the modification does not make it worse. Then an optimal solution starting with greedy's choice exists, which is exactly the greedy choice property.

Let me do it for a real problem rather than describing it in the abstract.

## 3. Interval scheduling, proved

One room, `n` meetings each with a start and end. Hold as many as possible.

The rule: **sort by end time, take any meeting that starts after the last one you took ends.**

```python
def max_meetings(meetings):
    meetings = sorted(meetings, key=lambda m: m[1])   # by end time
    count, last_end = 0, float('-inf')
    for start, end in meetings:
        if start >= last_end:
            count += 1
            last_end = end
    return count
```

```
  meetings (start, end)

  (1,4)   ####
  (3,5)     ####
  (0,6)  #######
  (5,7)       ###
  (3,9)     #######
  (5,9)       #####
  (6,10)       #####
  (8,11)         #####
         0123456789...

  sorted by end: (1,4) (3,5) (0,6) (5,7) (3,9) (5,9) (6,10) (8,11)
  take (1,4)                  end 4
  skip (3,5) (0,6)            start before 4
  take (5,7)                  end 7
  skip (3,9) (5,9) (6,10)
  take (8,11)
  answer: 3
```

Now the proof. Let `g` be the meeting that ends earliest. Take any optimal solution `S`. Two cases:

- If `S` already contains `g`, done.
- If not, let `f` be the first meeting in `S` by end time. Since `g` ends no later than `f`, swapping `f` for `g` in `S` cannot cause a conflict: `g` ends at or before where `f` ended, so everything after `f` in `S` still starts after `g` ends. The swapped set is the same size and still valid, so it is also optimal, and it contains `g`.

Either way an optimal solution containing `g` exists. Remove `g` and every meeting overlapping it, and you have a smaller instance of the same problem, so optimal substructure holds. Greedy is correct.

That is about six lines of reasoning, and it is the difference between a solution you trust and one you hope about. Note what it hinged on: the *swap*, and the fact that ending earlier is never worse.

### Why sorting by start time fails

Because the swap argument breaks. The earliest-starting meeting can be enormous, blocking everything, and there is no way to exchange it for something better. Concretely:

```
  (0,10)  ##########
  (1,2)    #
  (3,4)      #
  (5,6)        #

  by start: take (0,10), then nothing fits.   answer 1
  by end:   take (1,2), (3,4), (5,6).          answer 3
```

Both rules are one line. One is right. The proof is what separates them, which is why I am labouring the point.

## 4. The greedy rules worth knowing

These come up over and over. Learn the rule *and* why it is right.

**Interval scheduling: sort by end time.** As above.

**Fractional knapsack: sort by value per weight.** You can take fractions, so fill with the densest item until the bag is full. The exchange argument: if an optimal solution leaves room while a denser item remains, swapping a unit of something less dense for a unit of the denser one raises the value. (This fails the moment items are indivisible, which is why the 0/1 knapsack needs dynamic programming. Part 10.)

**Minimum coins, only for canonical systems.** Greedy is optimal for real currency systems, including 1, 2, 5, 10, 20, 50, and provably not for arbitrary sets. If the coin set is given as input, use DP.

**Huffman coding: repeatedly merge the two least frequent.** The exchange argument here is elegant: in an optimal prefix code the two least frequent symbols can always be made siblings at the deepest level, because if they were not, swapping them with whatever is down there does not increase the total cost.

**Job sequencing to minimise total waiting time: shortest job first.** Swap any adjacent pair that is out of order and the total drops. This "swap adjacent elements" version of the exchange argument is especially clean, and it generalises: for many ordering problems, find the comparison under which swapping any adjacent out-of-order pair improves things, and sort by it.

**Activity selection with deadlines: sort by deadline, use a heap.** Take jobs in deadline order; if you overrun, drop the least valuable job taken so far. The heap is what makes "drop the worst so far" cheap.

## 5. A worked problem where the rule is not obvious

Here is one I got wrong the first time, which is why it is a good example.

You have `n` tasks. Task `i` takes `t[i]` time and has deadline `d[i]`. You run one task at a time starting from time zero. Maximise the number of tasks that finish by their deadlines.

First instinct: sort by deadline and take greedily. That is close but incomplete: it fails when an early-deadline task is very long.

The correct rule adds one move. Go through tasks in deadline order and take each one. If the running total exceeds the current deadline, **remove the longest task taken so far**. A max-heap of the taken durations makes that one operation.

```python
import heapq

def max_tasks(tasks):
    tasks.sort(key=lambda x: x[1])       # by deadline
    heap = []                            # negatives, for a max-heap
    total = 0
    for t, d in tasks:
        heapq.heappush(heap, -t)
        total += t
        if total > d:                    # cannot fit: drop the worst
            total += heapq.heappop(heap) # pop is negative, so this subtracts
    return len(heap)
```

Why is dropping the longest correct? Because the count is what we are maximising, and every task in the set counts equally. If the set does not fit, removing any one task makes it fit less badly, and removing the longest frees the most time, which can only help future tasks. That is an exchange argument again: swapping the longest for anything shorter never hurts.

```
  tasks (time, deadline), sorted by deadline

  (3, 4)   total 3   <= 4   keep      heap {3}
  (5, 5)   total 8   >  5   drop 5    heap {3},     total 3
  (2, 7)   total 5   <= 7   keep      heap {3,2}
  (6, 8)   total 11  >  8   drop 6    heap {3,2},   total 5
  (1, 9)   total 6   <= 9   keep      heap {3,2,1}

  answer: 3
```

$\mathcal{O}(n \log n)$: the sort, plus one heap operation per task.

## 6. How to decide, in a contest, in two minutes

You will not have time for a full proof. Here is the practical procedure, in order.

**Step 1: state the rule in one sentence.** "Take the meeting that ends earliest." If you cannot state it in one sentence, it is not a greedy algorithm.

**Step 2: try to break it on a small case.** Deliberately hunt for a counterexample with three or four items. Look for the shapes that break greedy rules: one huge item, ties, and items that are best on one measure and worst on another. If you find a counterexample in two minutes, you have saved yourself a wrong submission.

**Step 3: try the exchange argument in your head.** "If the optimal answer does not include my first pick, can I swap my pick in without making it worse?" If yes, you are probably right. If you cannot see how, you are probably wrong.

**Step 4: check the input size.** This is the practical tiebreaker. If `n` is 200,000 then DP over pairs is impossible and greedy or a data structure is the only option, which is evidence about the intended solution. If `n` is 100, DP is available and greedy is less likely to be the answer.

**Step 5: when in doubt, brute force against greedy.** Write the $\mathcal{O}(2^n)$ exhaustive solution, run both on a few thousand random inputs of size 8, and compare. This finds counterexamples faster than thinking does, and it takes five minutes. I do this more often than I do proofs.

```python
import itertools, random

def brute(items):
    best = 0
    for r in range(len(items) + 1):
        for combo in itertools.combinations(items, r):
            if valid(combo):
                best = max(best, len(combo))
    return best

for _ in range(2000):
    items = [(random.randint(1, 9), random.randint(1, 9)) for _ in range(7)]
    if greedy(items) != brute(items):
        print('counterexample:', items)
        break
```

That loop has saved me more contest points than any proof I have ever written.

## 7. When greedy is definitely wrong

Signals that you need dynamic programming instead:

- **Indivisible items with a capacity.** The 0/1 knapsack. Greedy by density fails because you cannot take a fraction of the item that would have filled the gap.
- **The choice depends on the future.** If the value of taking something now depends on what comes later, there is no "best now".
- **The coin set is part of the input.** As shown in section 1.
- **Small `n` and a suspiciously specific question.** `n ≤ 20` and "count the ways" is not a greedy problem.

Greedy and DP are the two answers to "build the solution one choice at a time". Greedy commits; DP keeps every option and pays for the bookkeeping. Parts 8 to 10 are the DP side of that coin.

## The short version

- Greedy takes the best-looking option now and never revises. The code is trivial; choosing the rule is the entire problem.
- The same code that solves the coin problem for 1, 2, 5, 10 fails for 1, 3, 4. The correctness lives in the problem, not the algorithm, so you have to check.
- Correctness needs the greedy choice property and optimal substructure. Prove the first with an exchange argument: take an optimal solution, swap your choice in, show it did not get worse.
- Interval scheduling sorts by end time, not start time, and the exchange argument is exactly what tells the two apart.
- In a contest: state the rule in one sentence, spend two minutes hunting a counterexample on four items, try the exchange in your head, and check whether the input size even allows DP.
- When unsure, write the exponential brute force and compare against greedy on a few thousand random size-8 inputs. Faster than proving, and it finds real counterexamples.
- Indivisible items with a capacity, choices that depend on the future, or a coin set given as input: those are dynamic programming, not greedy.

Next: recursion, and how to write a function that calls itself without losing your nerve.
