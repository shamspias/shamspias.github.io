---
title: "Recursion and Backtracking: Trusting a Function You Have Not Finished Writing"
description: "Recursion is hard because everyone traces it. The habit that makes it mechanical: write the contract, trust the smaller call, never trace the stack."
date: 2017-07-30
permalink: "/posts/2017/07/recursion-and-backtracking/"
lang: en
tags:
  - "algorithms"
  - "recursion"
  - "backtracking"
  - "problem solving"
series: "Problem Solving From Zero"
seriesOrder: 7
math: true
---

*The reason recursion is hard is that everyone tries to trace it. You follow the calls down, lose your place three levels in, and conclude you are not clever enough. You are: the technique is to stop tracing. Write down what the function promises, assume it keeps that promise for smaller inputs, and use it. This part is that habit, then backtracking, which is recursion that undoes itself.*

## 1. Stop tracing

Here is the function everyone starts with.

```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)
```

The wrong way to understand this: "it calls factorial(4), which calls factorial(3), which calls..." You can hold three levels in your head. You cannot hold thirty, and the problems that need recursion need thirty.

The right way is two sentences:

1. **The contract.** `factorial(n)` returns `n!`. That is a promise about what comes out, not a description of how.
2. **The leap of faith.** Assume `factorial(n - 1)` already keeps that promise. Then `n * factorial(n - 1)` is `n × (n-1)!`, which is `n!`. The promise is kept.

Plus a base case, so the chain of promises has a bottom.

That is the whole method, and it scales. You never need more than one level in your head, ever, because the recursive call is treated as a finished, working function that someone else wrote.

Concretely, three questions, always in this order:

1. **What does this function promise?** Write it as a docstring before writing the body. This is the step people skip and it is the step that does all the work.
2. **What is the smallest case I can answer without recursing?** That is the base case.
3. **Assuming the smaller calls work, how do I build my answer from theirs?** That is the body.

## 2. The habit applied to a tree

Trees are where recursion stops feeling like a trick and starts feeling like the only sensible option, because a tree is *defined* recursively: a node with subtrees, each of which is a tree.

```python
class Node:
    def __init__(self, value, left=None, right=None):
        self.value, self.left, self.right = value, left, right
```

Height of a tree. Contract: "returns the number of nodes on the longest path from here down to a leaf". Base case: an empty tree has height 0. Body: assume `height` works on both children.

```python
def height(node):
    """Number of nodes on the longest downward path from node."""
    if node is None:
        return 0
    return 1 + max(height(node.left), height(node.right))
```

Sum of all values. Contract, base case, body:

```python
def total(node):
    """Sum of every value in the subtree rooted at node."""
    if node is None:
        return 0
    return node.value + total(node.left) + total(node.right)
```

Is this a valid binary search tree? This one is instructive, because the naive contract is not strong enough. "Is the subtree at this node a BST" is not enough information: a node deep on the left of the root must still be less than the root, and a check that only looks at parents and children misses it.

```python
def is_bst(node, low=float('-inf'), high=float('inf')):
    """True if the subtree at node is a BST with every value in (low, high)."""
    if node is None:
        return True
    if not (low < node.value < high):
        return False
    return (is_bst(node.left, low, node.value)
            and is_bst(node.right, node.value, high))
```

The fix was to **strengthen the contract**: carry the allowed range down. That is the single most useful recursion move there is. When a recursive solution does not seem to have enough information, the answer is almost never a cleverer body. It is more parameters.

## 3. Recursion is a stack, and the stack has a floor

Every call keeps its own local variables somewhere, and that somewhere is the call stack. It is finite.

```
  factorial(4)  waiting on  factorial(3)
                waiting on  factorial(2)
                waiting on  factorial(1)  -> 1
                            returns 2
                returns 6
  returns 24
```

Python's default limit is 1000 frames, and a recursion over a 200,000-node list will crash. Options, in order of preference:

**Raise the limit** when the depth is bounded and modest.

```python
import sys
sys.setrecursionlimit(300000)
```

**Rewrite as a loop** when the recursion is a simple chain. Any tail-recursive function is a `while` loop wearing a costume.

```python
def factorial_loop(n):
    out = 1
    for i in range(2, n + 1):
        out *= i
    return out
```

**Manage your own stack** when the structure is genuinely a tree but too deep. Push work onto a list and loop until it is empty. This is what part 12 does for depth-first search on large graphs, and it is the standard answer for a graph with $10^5$ nodes in a language without deep stacks.

```python
def total_iterative(root):
    stack, out = [root], 0
    while stack:
        node = stack.pop()
        if node is None:
            continue
        out += node.value
        stack.append(node.left)
        stack.append(node.right)
    return out
```

## 4. Backtracking: recursion that undoes itself

Now the second half. Backtracking is recursion for searching a space of choices: make a choice, recurse, then **undo the choice** and try the next one.

The shape is always this:

```
  def solve(state):
      if state is complete:
          record it
          return
      for each choice available:
          apply choice          <- do
          solve(state)          <- recurse
          undo choice           <- undo. the line people forget
```

The undo is what makes it backtracking rather than a leak. Forget it and every branch is polluted by the last one.

### All permutations

```python
def permutations(items):
    out, used, current = [], [False] * len(items), []

    def build():
        if len(current) == len(items):
            out.append(current[:])           # a copy, not the list itself
            return
        for i, x in enumerate(items):
            if used[i]:
                continue
            used[i] = True; current.append(x)      # do
            build()                                # recurse
            current.pop(); used[i] = False         # undo
    build()
    return out
```

Two details that cause real bugs. `current[:]` makes a copy: append `current` itself and every entry in `out` is the same list, which ends up empty. And the undo has to reverse *both* changes, in either order, but completely.

Cost: $n!$ permutations, and building each costs $\mathcal{O}(n)$, so $\mathcal{O}(n \cdot n!)$. That is fine to about `n = 10` and hopeless at `n = 15`, exactly as [part 2's table](/posts/2016/04/big-o-without-the-maths/) said.

### All subsets

Simpler: for each element, either take it or do not.

```python
def subsets(items):
    out, current = [], []

    def build(i):
        if i == len(items):
            out.append(current[:])
            return
        build(i + 1)                    # skip items[i]
        current.append(items[i])        # take it
        build(i + 1)
        current.pop()                   # undo
    build(0)
    return out
```

$2^n$ subsets. For `n ≤ 20` this is a perfectly good answer, and part 10 shows how to do it with bitmasks instead, which is faster and often clearer.

### Where backtracking earns its keep: pruning

Enumerating everything is rarely the point. The point is **stopping early**, and that is where backtracking beats generating all candidates and filtering.

The N-queens problem: place `n` queens on an `n × n` board with none attacking another.

```python
def n_queens(n):
    cols, diag, anti = set(), set(), set()
    solutions = []
    placement = []

    def place(row):
        if row == n:
            solutions.append(placement[:])
            return
        for col in range(n):
            if col in cols or (row - col) in diag or (row + col) in anti:
                continue                      # pruned: cannot work
            cols.add(col); diag.add(row - col); anti.add(row + col)
            placement.append(col)
            place(row + 1)
            placement.pop()
            cols.remove(col); diag.remove(row - col); anti.remove(row + col)
    place(0)
    return solutions
```

The three sets are the whole trick. A queen at `(row, col)` attacks its column, its down-right diagonal where `row - col` is constant, and its down-left diagonal where `row + col` is constant. Checking those is $\mathcal{O}(1)$, so an impossible branch is abandoned immediately rather than after placing seven more queens.

```
  n = 4, first solution

  . Q . .        row 0, col 1
  . . . Q        row 1, col 3
  Q . . .        row 2, col 0
  . . Q .        row 3, col 2

  the search that found it:
  row 0: col 0 -> row 1: col 0 x  col 1 x  col 2 ok -> row 2: all x, back
                  col 3 ok -> row 2: col 1 ok -> row 3: all x, back
                  ... back to row 0
         col 1 -> row 1: col 3 -> row 2: col 0 -> row 3: col 2  found
```

Without pruning there are $4^4 = 256$ placements to check for `n = 4`, and $8^8 = 16{,}777{,}216$ for `n = 8`. With pruning, `n = 8` explores about two thousand nodes. Same algorithm shape; the pruning is what makes it possible.

That is the general lesson: **backtracking's cost is the size of the tree you actually explore, not the size of the space.** Time spent making the pruning test cheap and sharp is time spent making the algorithm feasible.

## 5. Divide and conquer, which is recursion with a different shape

One more shape worth naming. Backtracking explores choices; divide and conquer splits the *input*.

```
  backtracking          divide and conquer
  ------------          ------------------
  choose, recurse,      split in half,
  undo, choose again    solve both, combine

  cost: size of the     cost: work per level
  explored tree         times number of levels
```

Merge sort from [part 4](/posts/2016/10/sorting-what-to-know/) is the example. So is binary search, so is quickselect, so is fast exponentiation:

```python
def power(base, exp, mod):
    """base ** exp mod, in O(log exp) multiplications."""
    if exp == 0:
        return 1
    half = power(base, exp // 2, mod)
    result = half * half % mod
    if exp % 2:
        result = result * base % mod
    return result
```

$\log(\text{exp})$ multiplications instead of `exp` of them. Computing $3^{1000000007}$ takes about thirty multiplications. That function appears in part 16 on number theory and you will use it constantly.

To reason about the cost of these, the pattern is: work per level times number of levels. Splitting in half gives $\log n$ levels; if each level does linear work the total is $n \log n$, and if each level does constant work it is $\log n$.

## 6. Common mistakes

**No base case, or an unreachable one.** `f(n - 2)` with a base case at `n == 1` never terminates for even `n`. Check that every path reaches the base.

**Forgetting to undo.** The most common backtracking bug, and the symptom is answers that are correct at first and get progressively more wrong.

**Storing a reference instead of a copy.** `out.append(current)` rather than `out.append(current[:])`. Every stored answer is the same object, and it ends up empty.

**Recomputing the same subproblem.** `fib(n) = fib(n-1) + fib(n-2)` written naively is $\mathcal{O}(1.618^n)$, because `fib(30)` computes `fib(10)` many thousands of times. That is not a recursion bug, it is the entire motivation for the next part.

**Mutating shared state without care.** If the recursive function reads a set that a sibling branch modified and did not restore, you get bugs that only appear on the third or fourth branch and are miserable to find.

## The short version

- Do not trace recursion. Write the contract as a docstring, find the base case, then assume the smaller call already works and build your answer from it. One level in your head, ever.
- When a recursion seems to lack information, strengthen the contract by adding parameters. That is the fix far more often than a cleverer body.
- Recursion depth is finite. Raise the limit for bounded depth, rewrite as a loop for simple chains, and manage your own stack for deep trees.
- Backtracking is do, recurse, undo. The undo is not optional and forgetting it is the classic bug.
- Store copies of your partial answer, not references to it.
- Backtracking costs the size of the tree you explore, not the size of the space. Cheap, sharp pruning is what turns $8^8$ into two thousand nodes.
- Divide and conquer splits the input rather than the choices. Its cost is work per level times number of levels.
- A recursion that recomputes the same subproblem is not broken, it is un-memoised, and that is the next part.

Next: memoisation. Paying once for an answer and never computing it again.
