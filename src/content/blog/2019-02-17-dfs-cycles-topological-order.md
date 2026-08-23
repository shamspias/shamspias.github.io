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

```cpp
void dfs(const vector<vector<int>>& g, int u, vector<bool>& seen) {
    seen[u] = true;
    for (int v : g[u]) {
        if (!seen[v]) {
            dfs(g, v, seen);
        }
    }
}
```

Iterative, for when the graph is deeper than your stack:

```cpp
vector<bool> dfs_iter(const vector<vector<int>>& g, int start) {
    vector<bool> seen(g.size(), false);
    seen[start] = true;
    vector<int> stk{start};                  // a vector used as the stack
    while (!stk.empty()) {
        int u = stk.back();
        stk.pop_back();
        for (int v : g[u]) {
            if (!seen[v]) {
                seen[v] = true;
                stk.push_back(v);
            }
        }
    }
    return seen;
}
```

Both are $\mathcal{O}(V + E)$. And with `V = 200,000` the recursive one can overflow the call stack, because the usual 1 MB to 8 MB of stack space does not hold 200,000 nested frames, so raise the stack limit with `ulimit -s` or use the iterative form. [Part 7](/posts/2017/07/recursion-and-backtracking/) has the full discussion.

```
        1 --- 2 --- 5
        |     |
        0     3 --- 4

  bfs from 0:  0, 1, 2, 3, 5, 4     layer by layer
  dfs from 0:  0, 1, 2, 3, 4, 5     down one branch, then back
```

## 2. The information DFS has that BFS does not

Here is the actual difference. In DFS, each vertex has two timestamps: when you **entered** it and when you **left** it, having finished everything below.

```cpp
void dfs_times(const vector<vector<int>>& g, int u, vector<bool>& seen,
               vector<int>& enter, vector<int>& leave, int& clock) {
    seen[u] = true;
    enter[u] = clock++;
    for (int v : g[u]) {
        if (!seen[v]) {
            dfs_times(g, v, seen, enter, leave, clock);
        }
    }
    leave[u] = clock++;
}
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

```cpp
int components(const vector<vector<int>>& g, int n) {
    vector<bool> seen(n, false);
    int count = 0;
    for (int s = 0; s < n; s++) {
        if (seen[s]) {
            continue;
        }
        count++;
        vector<int> stk{s};
        seen[s] = true;
        while (!stk.empty()) {
            int u = stk.back();
            stk.pop_back();
            for (int v : g[u]) {
                if (!seen[v]) {
                    seen[v] = true;
                    stk.push_back(v);
                }
            }
        }
    }
    return count;
}
```

The outer loop is the point. A graph is not required to be connected, and forgetting to restart is one of the most common graph bugs there is. BFS would do this job equally well; components need reachability, not depth.

This is also how you count islands in a grid, count friend circles, or check whether a network is fully connected.

## 4. Cycle detection, and the three-colour trick

Now something DFS does and BFS cannot do cleanly. The two cases are genuinely different, so keep them apart.

### Undirected graphs

A cycle exists if DFS ever reaches a vertex it has already seen, *other than* the one it came from.

```cpp
bool has_cycle_undirected(const vector<vector<int>>& g, int n) {
    vector<bool> seen(n, false);

    // self is the lambda itself, which is how a lambda recurses
    auto go = [&](auto&& self, int u, int parent) -> bool {
        seen[u] = true;
        for (int v : g[u]) {
            if (v == parent) {
                continue;                // the edge we arrived on
            }
            if (seen[v]) {
                return true;             // a second way to reach v
            }
            if (self(self, v, u)) {
                return true;
            }
        }
        return false;
    };

    for (int s = 0; s < n; s++) {
        if (!seen[s] && go(go, s, -1)) {  // -1 stands for "no parent"
            return true;
        }
    }
    return false;
}
```

The `v == parent` skip is what stops every single edge from looking like a two-vertex cycle. If the graph can have parallel edges, skip by edge identity instead of by vertex, or the check will miss a genuine two-edge cycle.

### Directed graphs

Here "already seen" is not enough, and this is the important part. Reaching a vertex you have finished with is fine: it means two paths converge, which is not a cycle. A cycle means reaching a vertex that is still **on the current path**.

Three colours:

- **white**: not visited
- **grey**: visited, still on the stack, we are inside its call
- **black**: visited and finished

An edge to a grey vertex is a **back edge**, and a back edge is a cycle.

```cpp
const int WHITE = 0, GREY = 1, BLACK = 2;

bool has_cycle_directed(const vector<vector<int>>& g, int n) {
    vector<int> colour(n, WHITE);

    auto go = [&](auto&& self, int u) -> bool {
        colour[u] = GREY;
        for (int v : g[u]) {
            if (colour[v] == GREY) {
                return true;             // back edge: cycle
            }
            if (colour[v] == WHITE && self(self, v)) {
                return true;
            }
        }
        colour[u] = BLACK;               // finished, off the path
        return false;
    };

    for (int s = 0; s < n; s++) {
        if (colour[s] == WHITE && go(go, s)) {
            return true;
        }
    }
    return false;
}
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

```cpp
vector<int> topo_dfs(const vector<vector<int>>& g, int n) {
    vector<int> colour(n, 0);            // 0 white, 1 grey, 2 black
    vector<int> order;

    auto go = [&](auto&& self, int u) -> bool {   // returns false on a cycle
        colour[u] = 1;
        for (int v : g[u]) {
            if (colour[v] == 1) {
                return false;            // grey neighbour: the graph has a cycle
            }
            if (colour[v] == 0 && !self(self, v)) {
                return false;
            }
        }
        colour[u] = 2;
        order.push_back(u);              // finished: everything after u is already in
        return true;
    };

    for (int s = 0; s < n; s++) {
        if (colour[s] == 0 && !go(go, s)) {
            return {};                   // an empty result means "cyclic"
        }
    }
    reverse(order.begin(), order.end());
    return order;
}
```

Why does that work? When `u` finishes, every vertex reachable from `u` has already finished, so every one of them is already in `order` before `u`. Reverse the list and `u` comes before all of them, which is exactly what an edge pointing forwards means. That is the timestamp nesting from section 2 doing the work, and it is why BFS cannot do this directly.

### With in-degrees, which is often nicer

Kahn's algorithm. Repeatedly take a vertex with no remaining incoming edges.

```cpp
vector<int> topo_kahn(const vector<vector<int>>& g, int n) {
    vector<int> indeg(n, 0);
    for (int u = 0; u < n; u++) {
        for (int v : g[u]) {
            indeg[v]++;
        }
    }
    queue<int> q;
    for (int u = 0; u < n; u++) {
        if (indeg[u] == 0) {
            q.push(u);
        }
    }
    vector<int> order;
    while (!q.empty()) {
        int u = q.front();
        q.pop();
        order.push_back(u);
        for (int v : g[u]) {
            indeg[v]--;
            if (indeg[v] == 0) {
                q.push(v);
            }
        }
    }
    if ((int)order.size() != n) {
        return {};                       // short output means the graph has a cycle
    }
    return order;
}
```

Two things I like about this version. It detects cycles for free: if a cycle exists, its vertices never reach in-degree zero, so the output is short. And swapping the `std::queue` for a **heap**, a `priority_queue<int, vector<int>, greater<int>>`, gives you the lexicographically smallest valid order, which problems ask for surprisingly often.

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

```cpp
int longest_path(const vector<vector<int>>& g, int n) {
    vector<int> indeg(n, 0);                     // Kahn's order, as in section 5
    for (int u = 0; u < n; u++) {
        for (int v : g[u]) {
            indeg[v]++;
        }
    }
    queue<int> q;
    for (int u = 0; u < n; u++) {
        if (indeg[u] == 0) {
            q.push(u);
        }
    }
    vector<int> order;
    while (!q.empty()) {
        int u = q.front();
        q.pop();
        order.push_back(u);
        for (int v : g[u]) {
            if (--indeg[v] == 0) {
                q.push(v);
            }
        }
    }

    vector<int> dp(n, 0);
    for (int i = (int)order.size() - 1; i >= 0; i--) {   // process after its successors
        int u = order[i];
        for (int v : g[u]) {
            dp[u] = max(dp[u], dp[v] + 1);
        }
    }
    return dp.empty() ? 0 : *max_element(dp.begin(), dp.end());
}
```

Counting paths between two vertices is the same shape with `+` instead of `max`, but make the DP table `long long` or reduce it modulo whatever the problem asks for, because path counts grow exponentially and a 32-bit `int` overflows silently. This is [part 9's four questions](/posts/2018/02/dp-as-a-table/) again, with question four, the order, answered by the topological sort.

## 7. Strongly connected components, briefly

In a directed graph, `u` and `v` are **strongly connected** if each can reach the other. The maximal such groups are the strongly connected components, and contracting each one to a single vertex always leaves a DAG. That is genuinely useful: it turns any directed graph into a DAG plus a lookup table.

Kosaraju's algorithm is two passes of DFS:

```cpp
pair<vector<int>, int> kosaraju(const vector<vector<int>>& g, int n) {
    vector<int> order;
    vector<bool> seen(n, false);

    auto first = [&](auto&& self, int u) -> void {       // pass one: finish times
        seen[u] = true;
        for (int v : g[u]) {
            if (!seen[v]) {
                self(self, v);
            }
        }
        order.push_back(u);
    };

    for (int s = 0; s < n; s++) {
        if (!seen[s]) {
            first(first, s);
        }
    }

    vector<vector<int>> rg(n);                           // reverse every edge
    for (int u = 0; u < n; u++) {
        for (int v : g[u]) {
            rg[v].push_back(u);
        }
    }

    vector<int> comp(n, -1);
    int seen2 = 0;

    auto second = [&](auto&& self, int u, int label) -> void {   // pass two: on the reverse graph
        comp[u] = label;
        for (int v : rg[u]) {
            if (comp[v] == -1) {
                self(self, v, label);
            }
        }
    };

    for (int i = (int)order.size() - 1; i >= 0; i--) {
        int u = order[i];
        if (comp[u] == -1) {
            second(second, u, seen2);
            seen2++;
        }
    }
    return {comp, seen2};
}
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
