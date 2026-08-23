---
title: "Depth-First Search: Cycles, Components, and Topological Order"
description: "BFS goes wide, DFS goes deep, and the difference is not stylistic. DFS answers questions about structure that a queue simply cannot see."
date: 2019-02-17
permalink: "/posts/2019/02/dfs-cycles-topological-order/"
lang: en
tags:
  - "algorithms"
  - "graphs"
  - "dfs"
  - "topological sort"
  - "problem solving"
series: "Problem Solving From Zero"
seriesOrder: 13
math: true
---

*Swap the queue for a stack and breadth-first search becomes depth-first search. That sounds like a detail and it is not: going deep first means you learn when you finish with a vertex, and that single extra piece of information is what detects cycles, orders tasks by dependency, and finds the pieces a graph falls into.*

## 1. The code, both ways

Recursive, which is how DFS wants to be written:

```python
def dfs(g, u, seen):
    seen.add(u)
    for v in g[u]:
        if v not in seen:
            dfs(g, v, seen)
```

Iterative, for when the graph is deeper than your stack:

```python
def dfs_iter(g, start):
    seen = {start}
    stack = [start]
    while stack:
        u = stack.pop()
        for v in g[u]:
            if v not in seen:
                seen.add(v)
                stack.append(v)
    return seen
```

Both are $\mathcal{O}(V + E)$. And with `V = 200,000` the recursive one will overflow Python's stack, so raise the limit or use the iterative form. [Part 7](/posts/2017/07/recursion-and-backtracking/) has the full discussion.

```
        1 --- 2 --- 5
        |     |
        0     3 --- 4

  bfs from 0:  0, 1, 2, 3, 5, 4     layer by layer
  dfs from 0:  0, 1, 2, 3, 4, 5     down one branch, then back
```

## 2. The information DFS has that BFS does not

Here is the actual difference. In DFS, each vertex has two timestamps: when you **entered** it and when you **left** it, having finished everything below.

```python
def dfs_times(g, u, seen, enter, leave, clock):
    seen.add(u)
    enter[u] = clock[0]; clock[0] += 1
    for v in g[u]:
        if v not in seen:
            dfs_times(g, v, seen, enter, leave, clock)
    leave[u] = clock[0]; clock[0] += 1
```

Those two numbers nest: if `v` is a descendant of `u` in the search, then `u`'s interval strictly contains `v`'s.

```
  u  enter                                    leave
     |------------------------------------------|
        v  enter        leave
           |--------------|
```

That nesting is the source of everything else in this post. BFS has no equivalent, because a queue finishes with a vertex the moment it looks at its neighbours, so there is nothing to nest.

## 3. Counting components

The simplest use. Run DFS from every vertex not yet seen; each run covers exactly one component.

```python
def components(g, n):
    seen, count = set(), 0
    for s in range(n):
        if s in seen:
            continue
        count += 1
        stack = [s]
        seen.add(s)
        while stack:
            u = stack.pop()
            for v in g[u]:
                if v not in seen:
                    seen.add(v)
                    stack.append(v)
    return count
```

The outer loop is the point. A graph is not required to be connected, and forgetting to restart is one of the most common graph bugs there is. BFS would do this job equally well; components need reachability, not depth.

This is also how you count islands in a grid, count friend circles, or check whether a network is fully connected.

## 4. Cycle detection, and the three-colour trick

Now something DFS does and BFS cannot do cleanly. The two cases are genuinely different, so keep them apart.

### Undirected graphs

A cycle exists if DFS ever reaches a vertex it has already seen, *other than* the one it came from.

```python
def has_cycle_undirected(g, n):
    seen = set()

    def go(u, parent):
        seen.add(u)
        for v in g[u]:
            if v == parent:
                continue                 # the edge we arrived on
            if v in seen:
                return True              # a second way to reach v
            if go(v, u):
                return True
        return False

    return any(go(s, None) for s in range(n) if s not in seen)
```

The `v == parent` skip is what stops every single edge from looking like a two-vertex cycle. If the graph can have parallel edges, skip by edge identity instead of by vertex, or the check will miss a genuine two-edge cycle.

### Directed graphs

Here "already seen" is not enough, and this is the important part. Reaching a vertex you have finished with is fine: it means two paths converge, which is not a cycle. A cycle means reaching a vertex that is still **on the current path**.

Three colours:

- **white**: not visited
- **grey**: visited, still on the stack, we are inside its call
- **black**: visited and finished

An edge to a grey vertex is a **back edge**, and a back edge is a cycle.

```python
WHITE, GREY, BLACK = 0, 1, 2

def has_cycle_directed(g, n):
    colour = [WHITE] * n

    def go(u):
        colour[u] = GREY
        for v in g[u]:
            if colour[v] == GREY:
                return True              # back edge: cycle
            if colour[v] == WHITE and go(v):
                return True
        colour[u] = BLACK                # finished, off the path
        return False

    return any(colour[s] == WHITE and go(s) for s in range(n))
```

```
  1 -> 2 -> 3        no cycle: 1 finishes before 3 is revisited
       ^    |
       +----+        cycle: 3 -> 2 and 2 is still grey

  colours during the walk
  1 grey
    2 grey
      3 grey
        edge 3 -> 2, and 2 is GREY   ->  cycle found
```

The two-colour version, which just asks "have I seen this vertex", reports a cycle for the perfectly acyclic diamond `1 -> 2, 1 -> 3, 2 -> 4, 3 -> 4`: vertex 4 is reached twice and there is no cycle. I have seen that bug in production code. Three colours, always, for directed graphs.

## 5. Topological order

A **topological order** of a directed acyclic graph is an ordering of vertices where every edge points forwards. It is what you want for "run these tasks, respecting dependencies": build systems, course prerequisites, spreadsheet recalculation.

### With DFS, and why reversed finish order works

Push a vertex onto a list when you **finish** it, then reverse the list.

```python
def topo_dfs(g, n):
    colour = [0] * n            # 0 white, 1 grey, 2 black
    order = []

    def go(u):
        colour[u] = 1
        for v in g[u]:
            if colour[v] == 1:
                raise ValueError('graph has a cycle')
            if colour[v] == 0:
                go(v)
        colour[u] = 2
        order.append(u)         # finished: everything after u is already in
    for s in range(n):
        if colour[s] == 0:
            go(s)
    return order[::-1]
```

Why does that work? When `u` finishes, every vertex reachable from `u` has already finished, so every one of them is already in `order` before `u`. Reverse the list and `u` comes before all of them, which is exactly what an edge pointing forwards means. That is the timestamp nesting from section 2 doing the work, and it is why BFS cannot do this directly.

### With in-degrees, which is often nicer

Kahn's algorithm. Repeatedly take a vertex with no remaining incoming edges.

```python
from collections import deque

def topo_kahn(g, n):
    indeg = [0] * n
    for u in range(n):
        for v in g[u]:
            indeg[v] += 1
    q = deque(u for u in range(n) if indeg[u] == 0)
    order = []
    while q:
        u = q.popleft()
        order.append(u)
        for v in g[u]:
            indeg[v] -= 1
            if indeg[v] == 0:
                q.append(v)
    if len(order) != n:
        raise ValueError('graph has a cycle')
    return order
```

Two things I like about this version. It detects cycles for free: if a cycle exists, its vertices never reach in-degree zero, so the output is short. And swapping the deque for a **heap** gives you the lexicographically smallest valid order, which problems ask for surprisingly often.

```
  courses:  maths -> physics -> engineering
            maths -> chemistry

  in-degrees   maths 0,  physics 1,  chemistry 1,  engineering 1

  take maths        -> physics 0, chemistry 0
  take chemistry    ->
  take physics      -> engineering 0
  take engineering

  order: maths, chemistry, physics, engineering
```

## 6. DFS on a DAG is dynamic programming

Worth naming explicitly, because it connects two things that look unrelated. Once a graph is acyclic and topologically ordered, DP over it is just DP with the order handed to you.

Longest path in a DAG, which is NP-hard in a general graph and linear here:

```python
def longest_path(g, n):
    order = topo_kahn(g, n)
    dp = [0] * n
    for u in reversed(order):            # process after its successors
        for v in g[u]:
            dp[u] = max(dp[u], dp[v] + 1)
    return max(dp)
```

Counting paths between two vertices is the same shape with `+` instead of `max`. This is [part 9's four questions](/posts/2018/02/dp-as-a-table/) again, with question four, the order, answered by the topological sort.

## 7. Strongly connected components, briefly

In a directed graph, `u` and `v` are **strongly connected** if each can reach the other. The maximal such groups are the strongly connected components, and contracting each one to a single vertex always leaves a DAG. That is genuinely useful: it turns any directed graph into a DAG plus a lookup table.

Kosaraju's algorithm is two passes of DFS:

```python
def kosaraju(g, n):
    order, seen = [], set()

    def first(u):                          # pass one: finish times
        seen.add(u)
        for v in g[u]:
            if v not in seen:
                first(v)
        order.append(u)

    for s in range(n):
        if s not in seen:
            first(s)

    rg = {u: [] for u in range(n)}         # reverse every edge
    for u in range(n):
        for v in g[u]:
            rg[v].append(u)

    comp, seen2 = [-1] * n, 0

    def second(u, label):                  # pass two: on the reverse graph
        comp[u] = label
        for v in rg[u]:
            if comp[v] == -1:
                second(v, label)

    for u in reversed(order):
        if comp[u] == -1:
            second(u, seen2)
            seen2 += 1
    return comp, seen2
```

Two DFS passes, $\mathcal{O}(V + E)$. I am not going to prove it here; the thing to take away is that it exists, it is linear, and the reason it works is once again about finish times. Tarjan's algorithm does the same in one pass and is shorter to run but harder to remember.

## 8. Choosing between BFS and DFS

| You want | Use | Because |
|---|---|---|
| Shortest path, unweighted | BFS | it visits in distance order |
| Any path, or just reachability | either | DFS is usually shorter to write |
| Detect a cycle | DFS | needs the on-the-current-path notion |
| Topological order | either | DFS finish times, or Kahn's in-degrees |
| Connected components | either | both cover a component fully |
| Strongly connected components | DFS | finish times again |
| Explore a huge or infinite space | BFS | DFS can wander down one branch forever |
| Memory is tight, the graph is deep | BFS holds a layer, DFS holds a path | whichever is smaller |

The last row is the practical one people miss: on a wide shallow graph BFS holds an enormous frontier, and on a deep narrow graph DFS holds an enormous stack. Which is cheaper depends on the shape.

## The short version

- DFS is BFS with a stack instead of a queue, and the consequence is that you learn when a vertex *finishes*. That is the extra information everything else here is built on.
- Always loop over all vertices to start new searches. Graphs are not required to be connected, and forgetting this is a top-three graph bug.
- For undirected cycle detection, skip the edge you arrived on. For directed, two colours are not enough: use white, grey and black, and a cycle is an edge to a grey vertex. A diamond is not a cycle and the two-colour version says it is.
- Topological order is the reverse of DFS finish order, or Kahn's algorithm on in-degrees. Kahn's detects cycles for free, and a heap instead of a queue gives the lexicographically smallest order.
- Once a graph is a DAG in topological order, DP over it is just DP with the fill order handed to you. Longest path becomes linear.
- Strongly connected components take two DFS passes and turn any directed graph into a DAG.
- Choose BFS for shortest paths and for exploring huge spaces; choose DFS for anything about structure. If memory is tight, pick whichever of "a layer" and "a path" is smaller for your graph's shape.

Next: shortest paths when the edges have weights, and the three algorithms worth knowing.
