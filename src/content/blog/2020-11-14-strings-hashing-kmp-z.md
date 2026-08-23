---
title: "Strings: Hashing, KMP, and the Z-Function"
description: "Where does this pattern occur? Three answers in linear time, each with a different trade: one is easy and probabilistic, two are exact and need a table."
date: 2020-11-14
permalink: "/posts/2020/11/strings-hashing-kmp-z/"
lang: en
tags:
  - "algorithms"
  - "strings"
  - "hashing"
  - "kmp"
  - "problem solving"
series: "Problem Solving From Zero"
seriesOrder: 18
math: true
---

*The naive way to find a pattern in a text compares every character at every position: $\mathcal{O}(nm)$. Three techniques get it to $\mathcal{O}(n + m)$. Hashing is the easiest to write and is probabilistic. KMP and the Z-function are exact and need a precomputed table. Learn hashing first, because it solves the most problems for the least effort.*

## 1. The problem, and why the obvious answer is slow

Find every position where `pattern` occurs in `text`.

```python
def naive(text, pattern):
    n, m = len(text), len(pattern)
    return [i for i in range(n - m + 1) if text[i:i + m] == pattern]
```

$\mathcal{O}(nm)$, and the worst case is real rather than theoretical: `text = "aaaa...a"` and `pattern = "aaa...ab"` compares almost the whole pattern at every position before failing on the last character. With both at $10^5$ that is $10^{10}$ steps.

## 2. Rolling hashes

The idea: compare a number instead of a string. Give every string a hash, and slide a window through the text updating the hash in constant time.

Treat the string as a number in base `B`:

$$
H(s) = s_0 B^{m-1} + s_1 B^{m-2} + \dots + s_{m-1} \pmod M
$$

Slide the window right by one and the update is: drop the leading term, multiply by `B`, add the new character.

```python
MOD = (1 << 61) - 1                     # a large prime
BASE = 131

def hash_string(s):
    h = 0
    for ch in s:
        h = (h * BASE + ord(ch)) % MOD
    return h

def find_hashed(text, pattern):
    n, m = len(text), len(pattern)
    if m > n:
        return []
    target = hash_string(pattern)
    top = pow(BASE, m, MOD)             # B^m, for removing the leading char

    h = hash_string(text[:m])
    out = []
    for i in range(n - m + 1):
        if h == target and text[i:i + m] == pattern:   # verify
            out.append(i)
        if i + m < n:
            h = (h * BASE + ord(text[i + m])) % MOD
            h = (h - ord(text[i]) * top) % MOD
    return out
```

$\mathcal{O}(n + m)$ expected. Four things about this code.

**Verify on a match.** `h == target and text[i:i+m] == pattern`. Hashes can collide, and the verification makes false positives harmless. It costs $\mathcal{O}(m)$ but only on a hash match, so with a good modulus it happens about as often as a real match.

**Use a large prime modulus.** $2^{61}-1$ is a Mersenne prime and gives collision probability around $10^{-18}$ per comparison. A 32-bit modulus is a mistake: by the birthday paradox, $10^5$ comparisons against a modulus of $10^9$ collide with probability around 0.5 percent, which is small enough to pass your tests and fail the judge's.

**Base above the alphabet size, and not a round number.** 131 or 1,000,003. Base 26 with letters `a` to `z` mapped to 0 to 25 makes `"a"` and `""` and `"aa"` all hash to zero, which is a real bug. Map characters starting from 1.

**Anti-hash tests exist.** On Codeforces, problem setters deliberately include inputs that collide against common fixed bases. Randomise the base at runtime if the problem is adversarial.

```python
import random
BASE = random.randint(256, MOD - 256)   # chosen at run time
```

### Why hashing is the one to learn first

Because prefix hashes let you compare **any two substrings in constant time**, which solves a whole class of problems that KMP does not touch.

```python
class Hashed:
    def __init__(self, s):
        n = len(s)
        self.h = [0] * (n + 1)
        self.p = [1] * (n + 1)
        for i, ch in enumerate(s):
            self.h[i + 1] = (self.h[i] * BASE + ord(ch)) % MOD
            self.p[i + 1] = self.p[i] * BASE % MOD

    def get(self, l, r):
        """Hash of s[l:r]."""
        return (self.h[r] - self.h[l] * self.p[r - l]) % MOD
```

That is [prefix sums from part 3](/posts/2016/07/prefix-sums-and-two-pointers/) with multiplication instead of addition, and the same subtraction trick. With it:

- **Are two substrings equal?** One comparison.
- **Longest common prefix of two suffixes?** Binary search on the length, testing equality by hash: $\mathcal{O}(\log n)$.
- **Longest repeated substring?** Binary search the length, and for each length put every window's hash in a set.
- **Count distinct substrings of a given length?** Hash every window into a set.

The combination of hashing and [binary search on the answer](/posts/2017/01/binary-search-on-the-answer/) is one of the most productive pairings in competitive programming.

## 3. KMP, and the prefix function

The exact method. The insight: when a mismatch happens after matching `k` characters, you already know those `k` characters. You do not need to restart, only to slide forward by the right amount.

The right amount comes from the **prefix function** $\pi$: for each position `i`, the length of the longest proper prefix of the pattern that is also a suffix of `pattern[0..i]`.

```python
def prefix_function(s):
    n = len(s)
    pi = [0] * n
    for i in range(1, n):
        k = pi[i - 1]
        while k and s[i] != s[k]:
            k = pi[k - 1]                 # fall back to a shorter border
        if s[i] == s[k]:
            k += 1
        pi[i] = k
    return pi
```

```
  s      a  b  a  b  c  a  b  a  b  a
  pi     0  0  1  2  0  1  2  3  4  3
                  ^              ^
            "ab" is both a       "abab" is both a prefix
            prefix and a suffix  and a suffix of "ababcabab"
```

$\mathcal{O}(n)$, and the reason is [the amortised argument from part 2](/posts/2016/04/big-o-without-the-maths/): `k` increases at most once per position and the inner `while` only decreases it, so the total decrease is bounded by the total increase, which is `n`.

Then searching is the same loop over the concatenation:

```python
def kmp_search(text, pattern):
    if not pattern:
        return []
    joined = pattern + '\x00' + text      # a separator not in either
    pi = prefix_function(joined)
    m = len(pattern)
    return [i - 2 * m for i, v in enumerate(pi) if v == m]
```

The separator matters: without it a match could straddle the boundary and report a position that does not exist. Use a character that cannot appear in the input.

### What the prefix function is good for beyond searching

**The shortest period of a string.** If `n % (n - pi[n-1]) == 0` then `n - pi[n-1]` is the shortest period, so `"abababab"` has period 2. This is the standard answer to "is this string a repetition of a shorter one".

**Counting occurrences of every prefix.** Walk the prefix function backwards accumulating counts.

**The shortest string containing two given strings as a prefix and a suffix.** Directly from the border structure.

## 4. The Z-function

Same power, different shape, and I find it easier to reason about. `z[i]` is the length of the longest common prefix of the string and its suffix starting at `i`.

```python
def z_function(s):
    n = len(s)
    z = [0] * n
    l = r = 0                             # the rightmost window we know about
    for i in range(1, n):
        if i < r:
            z[i] = min(r - i, z[i - l])   # reuse what we already computed
        while i + z[i] < n and s[z[i]] == s[i + z[i]]:
            z[i] += 1                     # extend by brute force
        if i + z[i] > r:
            l, r = i, i + z[i]            # a new rightmost window
    return z
```

```
  s      a  a  b  x  a  a  y  a  a
  z      0  1  0  0  2  1  0  2  1
               ^        ^        ^
            no match  "aa" again  "aa" at the end
```

$\mathcal{O}(n)$. The `[l, r)` window is the trick: it remembers the match that reaches furthest right, and inside that window the answer is already known from an earlier position, so the brute-force extension only ever pushes `r` forward. `r` moves at most `n` times in total, which is the amortised argument again.

Searching with it: same concatenation trick.

```python
def z_search(text, pattern):
    joined = pattern + '\x00' + text
    z = z_function(joined)
    m = len(pattern)
    return [i - m - 1 for i, v in enumerate(z) if v == m]
```

## 5. Choosing between them

| | Rolling hash | KMP | Z-function |
|---|---|---|---|
| Exact | no, verify or accept a tiny risk | yes | yes |
| Lines of code | fewest | few | few |
| Any two substrings comparable | **yes** | no | no |
| Gives string periods | no | **yes** | yes |
| Multiple patterns at once | yes, one set of hashes | no, one pass each | no |
| Vulnerable to adversarial input | yes, randomise the base | no | no |
| Extends to 2-D | **yes**, naturally | awkward | awkward |

My practical order:

1. **Hashing**, unless the problem is adversarial or requires certainty. It solves the widest range for the least code, especially combined with binary search.
2. **Z-function**, when you need exactness. Easier to remember than KMP, in my experience, and it does the same jobs.
3. **KMP**, when you specifically want the border structure, which is what period questions need.

And for many patterns at once, neither: that is Aho-Corasick, which is KMP generalised to a trie. Worth knowing it exists.

## 6. Two more tools worth naming

**Manacher's algorithm** finds all palindromic substrings in $\mathcal{O}(n)$. The same window trick as the Z-function, applied to palindromes. Without it, the standard approach is "expand around each of the `2n-1` centres", which is $\mathcal{O}(n^2)$ and usually fine.

```python
def longest_palindrome(s):
    """O(n^2) expand-around-centre. Fine to about n = 5000."""
    best = ''
    for centre in range(len(s)):
        for l, r in ((centre, centre), (centre, centre + 1)):
            while l >= 0 and r < len(s) and s[l] == s[r]:
                l, r = l - 1, r + 1
            if r - l - 1 > len(best):
                best = s[l + 1:r]
    return best
```

**Tries** for prefix questions. A tree where each edge is a character, so all strings sharing a prefix share a path. The right structure for autocomplete, for "how many stored words start with this", and for the maximum-xor-pair problem where the trie holds binary representations.

```python
class Trie:
    def __init__(self):
        self.children = {}
        self.count = 0                    # words passing through this node

    def insert(self, word):
        node = self
        for ch in word:
            node = node.children.setdefault(ch, Trie())
            node.count += 1

    def starting_with(self, prefix):
        node = self
        for ch in prefix:
            if ch not in node.children:
                return 0
            node = node.children[ch]
        return node.count
```

## 7. The mistakes

**A 32-bit hash modulus.** Collides in practice on $10^5$ comparisons. Use $2^{61}-1$.

**A base at or below the alphabet size.** Makes distinct strings hash identically. Also map characters from 1, not 0, so leading characters are not invisible.

**A single hash on an adversarial judge.** Randomise the base, or use two moduli.

**No separator in the concatenation trick.** Reports matches that straddle the join.

**Slicing in a loop.** `text[i:i+m] == pattern` inside the main loop, unconditionally, puts the $\mathcal{O}(nm)$ straight back. Only verify when the hashes match.

**Forgetting that Python strings are immutable.** Building a string with `s += c` in a loop is $\mathcal{O}(n^2)$, from [part 1](/posts/2016/02/counting-the-steps/). Collect into a list and `join`.

## The short version

- Naive matching is $\mathcal{O}(nm)$ and its worst case is a realistic input, not a contrived one.
- A rolling hash treats the string as a number in base `B` modulo a large prime, and the window updates in constant time. Verify on a hash match so collisions are harmless.
- Use $2^{61}-1$ as the modulus, a base larger than the alphabet, and map characters from 1. A 32-bit modulus collides in practice.
- Prefix hashes let you compare **any two substrings in constant time**. Combined with binary search that solves longest common prefix, longest repeated substring, and counting distinct substrings.
- KMP's prefix function gives, for each position, the longest proper prefix that is also a suffix. It is linear because `k` rises at most `n` times and the fallback loop only lowers it.
- The Z-function gives, for each position, the match length with the whole string. Same power, and the `[l, r)` window makes it linear by the same argument.
- Both search by matching against `pattern + separator + text`. The separator is not optional.
- Reach for hashing first, the Z-function when you need exactness, and KMP when you need the border structure for periods.

Next: Fenwick trees and segment trees, for when updates and queries are interleaved.
