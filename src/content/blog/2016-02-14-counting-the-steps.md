---
title: "Counting the Steps: What Your Loop Actually Costs"
description: "Before any algorithm makes sense you need one habit: counting how many times a line runs. Here is that habit, built from four small C++ programs and a stopwatch."
date: 2016-02-14
permalink: "/posts/2016/02/counting-the-steps/"
lang: en
tags:
  - "algorithms"
  - "complexity"
  - "problem solving"
  - "beginners"
series: "Problem Solving From Zero"
seriesOrder: 1
math: true
---

*Every algorithm you will ever learn is an answer to the same question: how many times does this line run? Not "is this fast", which depends on your laptop, but "how many steps", which does not. This part builds that one habit, because nothing else in the series makes sense without it. The code is in C++, which for our purposes is C with a standard library, and I will lean on that library as we go.*

I want to start somewhere genuinely small. Not with a definition, and not with a Greek letter. With a program that adds up numbers.

## 1. The first program, and the first question

You are given a list of numbers and asked for their sum.

```cpp
long long total(const vector<int> &v) {
    long long sum = 0;
    for (int x : v)
        sum += x;
    return sum;
}
```

Now the only question that matters: **how many times does `sum += x` run?**

Once per number. If the vector has 10 numbers it runs 10 times. If it has 1,000,000 it runs 1,000,000 times. Write that down as a rule and you have said something true about this program on every computer that has ever existed:

```
  steps  =  n
```

where `n` is how many numbers there are. That is the whole idea. Everything else in this series is that idea applied to harder programs.

(The standard library already has this, and once you can count the loop you should use it: `#include <numeric>` and write `accumulate(v.begin(), v.end(), 0LL)`. It runs the same `n`-step loop; it just hides it. Knowing what it hides is the point of this post.)

Notice what we did *not* do. We did not time it. Timing tells you about your laptop, the weather in the data centre, and whether your browser was open. Counting tells you about the program.

## 2. A second program that looks the same and is not

Now a different task. You are given a list of numbers, and asked: is there a pair that adds up to zero?

Here is the honest first attempt, the one everybody writes:

```cpp
bool has_zero_pair(const vector<int> &v) {
    int n = v.size();
    for (int i = 0; i < n; i++)
        for (int j = 0; j < n; j++)
            if (i != j && v[i] + v[j] == 0)
                return true;
    return false;
}
```

How many times does the comparison run? For each of the `n` values of `i`, the inner loop runs `n` times. So:

```
  steps  =  n × n  =  n²
```

Those two programs look about equally complicated on the page. They are not remotely equally expensive. Put numbers on it:

| n | sum: n steps | pair: n² steps |
|---|---|---|
| 10 | 10 | 100 |
| 1,000 | 1,000 | 1,000,000 |
| 100,000 | 100,000 | 10,000,000,000 |
| 1,000,000 | 1,000,000 | 1,000,000,000,000 |

Read the bottom row again. One million steps is instant. One *trillion* steps, at a very optimistic billion steps per second, is about seventeen minutes. Same-looking code, seventeen minutes versus nothing.

This is the moment the habit pays for itself, and it is why we count before we write.

## 3. The rule of thumb that will get you through a contest

Modern hardware does very roughly $10^8$ to $10^9$ simple operations per second. Contest problems are usually set with a one or two second limit. So the working rule is:

> Your solution should do somewhere under a hundred million steps.

Combine that with the size of the input the problem gives you, and the problem has told you which algorithm it wants. This table is the single most useful thing in this post. I still use it.

| If n is up to | you can afford | which means |
|---|---|---|
| 10 | $n!$ | try every ordering |
| 20 | $2^n$ | try every subset |
| 500 | $n^3$ | three nested loops |
| 5,000 | $n^2$ | two nested loops |
| $10^6$ | $n \log n$ | sort it, or a heap |
| $10^7$ | $n$ | one pass |
| $10^{18}$ | $\log n$ | binary search, or maths |

A problem that says "n up to 200,000" is telling you, in plain language, that $n^2$ is not going to work and you need to find something around $n \log n$. That is not a hint hidden in the statement. It *is* the statement.

## 4. Where the steps hide

Counting is easy when the loops are visible. The mistakes come from steps you did not write.

**A loop inside a library call.** This looks like one line:

```cpp
bool present(const vector<int> &v, int x) {
    return find(v.begin(), v.end(), x) != v.end();   // walks v: up to n steps
}
```

It is not one step. `find` walks the vector looking for `x`, so it is up to `n` steps. Put it inside a loop over the same vector and you have written $n^2$ without typing a nested loop. Load the values into a hash set once and the same question becomes roughly one step:

```cpp
long long count_present(const vector<int> &v, const vector<int> &queries) {
    unordered_set<int> seen(v.begin(), v.end());   // build the set: n steps, once
    long long hits = 0;
    for (int x : queries)
        hits += seen.count(x);                     // each query: about 1 step
    return hits;
}
```

**String building in a loop.** This is a subtle one, and C++ actually gets it right where many languages do not. Rebuilding the string each time copies everything you have so far, and the copies add up to $1 + 2 + 3 + \dots + n$, which is $n(n+1)/2$, which is $n^2$ dressed up:

```cpp
string bad(const vector<char> &chars) {
    string s;
    for (char c : chars)
        s = s + c;            // s + c builds a whole new string: O(n²) total
    return s;
}
```

Append in place instead. `push_back` (and `+=`) grow the string's own buffer, so the whole loop is linear:

```cpp
string good(const vector<char> &chars) {
    string s;
    for (char c : chars)
        s.push_back(c);       // grows in place: O(1) amortised each, O(n) total
    return s;
}
```

**Copying a subrange.** Taking "everything after the first element" as a fresh vector, `vector<int>(v.begin() + 1, v.end())`, copies those elements: $\mathcal{O}(n)$. A recursive function that does that on every call is doing far more work than the recursion suggests. Pass indices, or a range, not a copy.

The habit that catches all three: for every line in your loop, ask *is this really one step*. If the line touches a whole collection, it is not.

## 5. Worked example: the largest sum of a run

Here is a real problem, and the three versions of it worth seeing. The problem: given a list of numbers, find the largest possible sum of a **contiguous** run of them. For `[3, -2, 5, -1]` the answer is `6`, from `[3, -2, 5]`.

**Version one: try every run, add it up.** Two loops to pick the start and end, and a third to add.

```cpp
long long best_v1(const vector<int> &a) {
    int n = a.size();
    long long best = a[0];
    for (int i = 0; i < n; i++)
        for (int j = i; j < n; j++) {
            long long s = 0;
            for (int k = i; k <= j; k++)
                s += a[k];
            best = max(best, s);
        }
    return best;
}
```

Three nested loops: $n^3$. At $n = 5000$ that is $1.25 \times 10^{11}$ steps. Far too slow.

**Version two: stop re-adding.** The third loop is pure waste. As `j` moves right by one, the sum only needs one addition, not a fresh walk.

```cpp
long long best_v2(const vector<int> &a) {
    int n = a.size();
    long long best = a[0];
    for (int i = 0; i < n; i++) {
        long long s = 0;
        for (int j = i; j < n; j++) {
            s += a[j];
            best = max(best, s);
        }
    }
    return best;
}
```

$n^2$. At $n = 5000$ that is 25 million steps, which is fine. At $n = 10^6$ it is not.

**Version three: ask a better question.** Instead of "what is the best run", ask "what is the best run *that ends here*". Walk left to right, and at each position you have exactly two choices: extend the run you were already building, or throw it away and start fresh at this element.

```cpp
long long best_v3(const vector<int> &a) {
    long long best = a[0], here = a[0];
    for (size_t i = 1; i < a.size(); i++) {
        here = max((long long)a[i], here + a[i]);   // extend, or start again
        best = max(best, here);
    }
    return best;
}
```

One loop. $n$ steps. At $n = 10^6$ it is a millisecond.

```
  a       3    -2     5    -1
          |     |     |     |
  here    3     1     6     5      extend or restart
  best    3     3     6     6      the running answer
```

That is Kadane's algorithm, and I am not showing it because you need to memorise it. I am showing it because of the shape of the story: $n^3 \to n^2 \to n$, and each step came from noticing repeated work and refusing to do it twice. That is what algorithm design *is*. Almost every part of this series is another instance of it.

## 6. The thing nobody tells you first

Counting steps tells you how the cost *grows*. It deliberately says nothing about the constant in front. A program doing $100n$ steps and one doing $2n$ steps are both "$n$", and one is fifty times slower.

That is not a flaw, it is the point. Growth is the part that survives a new laptop; the constant is not. But it means two honest things follow:

1. For small inputs, the "worse" algorithm often wins. Insertion sort beats quicksort below about a dozen elements, which is why real sort implementations switch to it at the bottom.
2. When two solutions have the same growth, the constant is all there is, and then you *do* measure. Part 21 of this series is entirely about constants that come from memory rather than from step counts.

## 7. Practice that actually helps

Do this for a week and the habit sticks. Take any function you have written and answer three questions in writing:

1. What is `n`? Name it. Half of all confusion here is a program with two different sizes in it, like a grid that is `r` rows by `c` columns, being described with one letter.
2. How many times does the innermost line run, in terms of `n`?
3. Given the input size the problem allows, is that under a hundred million?

If you cannot answer question one, you do not yet understand the problem. That happens more often than you would like, and finding out early is the whole benefit.

## The short version

- Count how many times the innermost line runs. Do not time it; timing measures your laptop, counting measures your program.
- $n$ and $n^2$ look equally simple on the page. At a million elements one is instant and the other takes seventeen minutes.
- Roughly a hundred million steps per second is the budget. The input size in the problem statement tells you which algorithm is being asked for.
- Steps hide inside innocent-looking lines: `find` on a vector, rebuilding a string with `s = s + c`, copying a subrange. If a line touches a whole collection, it is not one step.
- Better algorithms almost always come from spotting work being repeated and refusing to repeat it. That is the whole trick, and the rest of this series is variations on it.

Next: putting a name to the growth, and why $\mathcal{O}(n)$ is a claim about the shape of a curve rather than a speed.
