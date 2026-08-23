---
title: "Sorting: What to Know, What to Call, and What to Sort By"
description: "You will almost never write a sort. You will constantly decide what to sort by, and that decision is where the problems are actually solved."
date: 2016-10-15
permalink: "/posts/2016/10/sorting-what-to-know/"
lang: en
tags:
  - "algorithms"
  - "sorting"
  - "problem solving"
  - "comparators"
series: "Problem Solving From Zero"
seriesOrder: 4
math: true
---

*There are two separate skills here and courses teach the less useful one. Skill one is implementing merge sort, which you will do once, for the understanding. Skill two is choosing what to sort by, which you will do in half the problems you ever solve. This part spends a little time on the first and most of it on the second.*

## 1. The one you should be able to write

Merge sort, because its cost is easy to see and it is the honest example of divide and conquer.

Split the array in half, sort each half, then merge the two sorted halves.

```cpp
vector<int> merge(const vector<int>& x, const vector<int>& y);   // defined below

vector<int> merge_sort(const vector<int>& a) {
    if (a.size() <= 1)
        return a;
    size_t mid = a.size() / 2;
    vector<int> left  = merge_sort(vector<int>(a.begin(), a.begin() + mid));
    vector<int> right = merge_sort(vector<int>(a.begin() + mid, a.end()));
    return merge(left, right);
}

vector<int> merge(const vector<int>& x, const vector<int>& y) {
    vector<int> out;
    size_t i = 0, j = 0;
    while (i < x.size() && j < y.size()) {
        if (x[i] <= y[j])                   // <= keeps equal items in order
            out.push_back(x[i++]);
        else
            out.push_back(y[j++]);
    }
    while (i < x.size()) out.push_back(x[i++]);
    while (j < y.size()) out.push_back(y[j++]);
    return out;
}
```

The cost, drawn rather than derived:

```
  level 0        [ 8 3 5 1 9 2 7 4 ]         8 elements merged
  level 1     [ 8 3 5 1 ] [ 9 2 7 4 ]        4 + 4  = 8
  level 2   [ 8 3 ][ 5 1 ][ 9 2 ][ 7 4 ]     2+2+2+2 = 8
  level 3   [8][3][5][1][9][2][7][4]         nothing to do

  log n levels, n work per level  ->  O(n log n)
```

Halving `n` down to 1 takes $\log_2 n$ levels, and each level touches every element exactly once during merging. So $\mathcal{O}(n \log n)$ time, and $\mathcal{O}(n)$ extra space for the output arrays.

Two properties worth naming, because they come up in interviews and in real bugs:

**Merge sort is stable.** Items that compare equal keep their original relative order. That is entirely down to the `<=` in the merge: on a tie it takes from the left half, which came first. Change it to `<` and stability is gone. Stability matters more than it sounds; see section 4.

**The recursion is the shape, not the cost.** The recursive calls are free; all the work is in `merge`. This is the general pattern for divide and conquer: find the level where the work happens, count the work per level, multiply by the number of levels.

## 2. The others, in one table, and why

You should recognise these. You should almost never write them.

| Algorithm | Time | Space | Stable | Why it exists |
|---|---|---|---|---|
| Insertion sort | $\mathcal{O}(n^2)$, $\mathcal{O}(n)$ if nearly sorted | $\mathcal{O}(1)$ | yes | tiny inputs, nearly-sorted inputs |
| Merge sort | $\mathcal{O}(n \log n)$ always | $\mathcal{O}(n)$ | yes | guaranteed, stable, parallelises |
| Quicksort | $\mathcal{O}(n \log n)$ average, $\mathcal{O}(n^2)$ worst | $\mathcal{O}(\log n)$ | no | fastest constant, sorts in place |
| Heapsort | $\mathcal{O}(n \log n)$ always | $\mathcal{O}(1)$ | no | guaranteed with no extra memory |
| Counting sort | $\mathcal{O}(n + k)$ | $\mathcal{O}(k)$ | yes | small integer range, beats the bound |
| Radix sort | $\mathcal{O}(dn)$ | $\mathcal{O}(n)$ | yes | fixed-width integers or strings |

Three notes that matter in practice.

**Insertion sort is not a joke algorithm.** On an almost-sorted array it is linear, and its constant is minute. Real library sorts switch to it below a dozen or two elements, which is why "quicksort" in a standard library is usually quicksort until the chunks get small and then insertion sort.

**Quicksort's worst case is a real input, not a theoretical one.** The naive "pick the first element as pivot" version degenerates to $\mathcal{O}(n^2)$ on an already-sorted array, which is the input you get most often in real life. Randomising the pivot fixes it, which is why library implementations do.

**Counting sort beats $n \log n$, legitimately.** The $\Omega(n \log n)$ lower bound applies to sorting by *comparison*. Counting sort never compares two elements: it counts how many of each value there are and then writes them out in order. If your values are integers in a small range, this is the answer.

```cpp
// Sort values in 0..k-1. O(n + k), and stable as written.
vector<int> counting_sort(const vector<int>& a, int k) {
    vector<int> count(k, 0);
    for (int x : a)
        count[x] += 1;
    vector<int> out;
    for (int v = 0; v < k; v++)
        out.insert(out.end(), count[v], v);   // write v out count[v] times
    return out;
}
```

At `n = 10^6` values in the range 0 to 1000, this is several times faster than any comparison sort, and it is four lines.

## 3. What you will actually write

This:

```cpp
struct Person {
    int score;
    string name;
    bool operator<(const Person& o) const { return score < o.score; }
};

void sorting_idioms(vector<Person>& a) {
    sort(a.begin(), a.end());                                   // in place
    vector<Person> b = a;                                       // a new vector
    sort(b.begin(), b.end());                                   //   sorted on its own
    sort(a.begin(), a.end(), [](const Person& p, const Person& q) {
        return p.score < q.score;                               // by a field
    });
    sort(a.begin(), a.end(), [](const Person& p, const Person& q) {
        return p.score > q.score;                               // descending, numerically
    });
    sort(a.rbegin(), a.rend());                                 // descending, generally
    stable_sort(a.begin(), a.end());                            // the same, but stable
}
```

C++'s `std::sort` is introsort: quicksort that switches to heapsort when the recursion gets too deep, plus insertion sort for small chunks. That is how it keeps quicksort's constant while ruling out its $\mathcal{O}(n^2)$ worst case, and the standard guarantees $\mathcal{O}(n \log n)$. It is *not* stable. `std::stable_sort` is the stable one: a merge sort that borrows a temporary buffer, $\mathcal{O}(n \log n)$ when it gets the memory and $\mathcal{O}(n \log^2 n)$ when it does not.

That is the whole implementation story. Now the part that matters.

## 4. Sorting by the right thing

Most problems that "need sorting" are really asking you to notice *which order makes the problem easy*. Four examples, increasing in slyness.

### Sort by the second field

Classic problem: you have `n` meetings with start and end times, and one room. What is the maximum number of meetings you can hold?

Sort by **end** time and take greedily. Sort by start time and you get the wrong answer. The reason is the whole of [part 7 on greedy algorithms](/posts/2017/04/greedy-when-it-works/), but the point here is that both are one-line sorts and only one is correct.

```cpp
struct Meeting {
    int start, end;
};

void sort_by_end(vector<Meeting>& meetings) {
    sort(meetings.begin(), meetings.end(),
         [](const Meeting& a, const Meeting& b) { return a.end < b.end; });
}
```

### Sort by a ratio

You have items with a weight and a value, and a knapsack that can carry any fraction of an item. Sort by value per unit weight, descending, and fill.

```cpp
struct Item {
    double value, weight;
};

void sort_by_ratio(vector<Item>& items) {
    sort(items.begin(), items.end(), [](const Item& a, const Item& b) {
        return a.value / a.weight > b.value / b.weight;   // value per unit weight, descending
    });
}
```

Careful with the division: if weights can be zero it breaks, and if `value` and `weight` are integer types, C++ integer division silently truncates the ratio, so `3/2` and `1/1` both compare as `1`. In a contest, compare `a.value * b.weight` against `b.value * a.weight` instead. Same ordering, no division, no floating point.

### Sort by two keys, one ascending and one descending

Very common: rank by score descending, and break ties by name ascending.

```cpp
struct Person {
    int score;
    string name;
};

void rank_people(vector<Person>& people) {
    sort(people.begin(), people.end(), [](const Person& a, const Person& b) {
        return make_pair(-a.score, a.name) < make_pair(-b.score, b.name);
    });
}
```

`std::pair` compares element by element, and the minus sign flips the first one; `std::tuple` works the same way for three or more keys. If the field is not numeric you cannot negate it, and then stability is the tool: sort by the *last* key first, then by the more important key. Because `std::stable_sort` is stable, the earlier ordering survives inside the ties. This trick needs `std::stable_sort` specifically: `std::sort` is not stable and is free to scramble the weaker key.

```cpp
struct Person {
    int score;
    string name;
};

void rank_people(vector<Person>& people) {
    stable_sort(people.begin(), people.end(), [](const Person& a, const Person& b) {
        return a.name < b.name;                    // weaker key first
    });
    stable_sort(people.begin(), people.end(), [](const Person& a, const Person& b) {
        return a.score > b.score;                  // stronger key last
    });
}
```

That is what stability is *for*, and it is the answer to "how do I sort by three keys with mixed directions".

### Sort something other than the data

The sly one. You have `n` points and want the pair closest together. Sorting the points does not obviously help. But sort them by `x`, and now any pair more than the current best distance apart in `x` can be skipped without computing anything. That single observation turns $\mathcal{O}(n^2)$ into $\mathcal{O}(n \log n)$.

The general habit: after reading a problem, ask **"is there an order in which this becomes obvious?"** Then check whether sorting into that order is cheap. Usually it is, because sorting is $n \log n$ and $n \log n$ is nearly free.

## 5. A worked problem

From a contest. You are given `n` intervals `[l, r]`. Merge all the overlapping ones and report the result.

The insight is entirely in the ordering. Sort by left endpoint. Then walk the list keeping one open interval: each new interval either overlaps the open one, in which case extend it, or it does not, in which case the open one is finished.

```cpp
vector<pair<int, int>> merge_intervals(vector<pair<int, int>> intervals) {
    if (intervals.empty())
        return {};
    sort(intervals.begin(), intervals.end());              // by l, then r
    vector<pair<int, int>> out{intervals[0]};
    for (size_t i = 1; i < intervals.size(); i++) {
        int l = intervals[i].first, r = intervals[i].second;
        if (l <= out.back().second)                        // overlaps the open interval
            out.back().second = max(out.back().second, r); // extend it
        else
            out.push_back({l, r});                         // start a new one
    }
    return out;
}
```

```
  input   [1,3] [8,10] [2,6] [15,18]

  sorted  [1,3] [2,6] [8,10] [15,18]

  open [1,3]
        [2,6]:   2 <= 3, overlap   ->  open [1,6]
        [8,10]:  8 >  6, no        ->  emit [1,6],  open [8,10]
        [15,18]: 15 > 10, no       ->  emit [8,10], open [15,18]
                                       emit [15,18]

  output  [1,6] [8,10] [15,18]
```

$\mathcal{O}(n \log n)$ for the sort and $\mathcal{O}(n)$ for the walk, so $\mathcal{O}(n \log n)$ overall. The `max(out[-1][1], r)` is the line people drop: an interval can be entirely inside the open one, and without the `max` you would shrink it.

Why does sorting by `l` make the walk correct? Because after sorting, everything still to come starts at or after the current interval's start. So if the next one does not touch the open interval, nothing later can either, and the open interval is safe to close. That sentence is the proof, and it is the kind of sentence worth writing out before trusting a greedy walk.

## 6. When not to sort

Sorting is cheap, not free. Three cases where it is the wrong reflex.

**You only need the smallest `k`.** Sorting is $n \log n$; a heap of size `k` is $n \log k$, and for `k = 10` out of a million that is a real difference. `std::priority_queue` is the heap, and `std::partial_sort` will put the smallest `k` in order at the front of a range for you.

**You only need the median, or the `k`-th smallest.** Quickselect does that in $\mathcal{O}(n)$ average, without sorting.

**The data arrives as a stream and you need answers as you go.** A sorted structure that supports insertion, such as a balanced tree or a Fenwick tree over values, is what you want. Part 19.

## The short version

- Be able to write merge sort once: split, sort halves, merge. $\log n$ levels, $n$ work per level, so $\mathcal{O}(n \log n)$, and the `<=` in the merge is what makes it stable.
- Know the others by their properties, not their code. Insertion sort for tiny or nearly-sorted input, quicksort for its constant, heapsort for a guarantee with no extra memory, counting or radix sort when the values are small integers.
- Counting sort beats $n \log n$ honestly, because the lower bound applies only to sorting by comparison and counting sort never compares.
- In practice you call `std::sort` and spend your thinking on the comparator. Sort by end time for interval scheduling, by ratio for fractional knapsack, by a `std::pair` or `std::tuple` for multiple keys.
- For mixed ascending and descending keys that cannot be negated, sort by the weakest key first and the strongest last, and let stability preserve the rest. That is what stability is for.
- Ask "is there an order in which this problem becomes obvious?" That question, not the sorting algorithm, is where the solution usually is.
- Do not sort when you only need the top `k`, only need the median, or the data is a stream.

Next: pointers and linked lists, the data structure built entirely from addresses, and the one place an array is not the answer.
