---
title: "The Number Theory You Actually Need"
description: "Sieves, greatest common divisors, modular arithmetic and inverses. Five tools, each about ten lines, that cover almost every number theory problem you will meet."
date: 2020-07-19
permalink: "/posts/2020/07/number-theory-you-need/"
lang: en
tags:
  - "algorithms"
  - "number theory"
  - "modular arithmetic"
  - "primes"
  - "problem solving"
series: "Problem Solving From Zero"
seriesOrder: 16
math: true
---

*Number theory in competitive programming is a short list of tools rather than a subject. Sieve for primes, Euclid for divisors, fast exponentiation, modular inverses, and the combinatorics that sits on top. Each is about ten lines. This part is all of them, with the traps that make correct-looking code give wrong answers.*

## 1. Primes: trial division, then the sieve

Is one number prime? Trial division up to the square root.

```python
def is_prime(n):
    if n < 2:
        return False
    if n % 2 == 0:
        return n == 2
    d = 3
    while d * d <= n:
        if n % d == 0:
            return False
        d += 2
    return True
```

$\mathcal{O}(\sqrt n)$. The square root bound is the only insight: if `n = a × b` with both above $\sqrt n$, then `a × b > n`, so at least one factor is at or below the root. Note `d * d <= n` rather than `d <= sqrt(n)`, which avoids floating point entirely and is therefore exactly right rather than nearly right.

For *many* numbers, sieve instead.

```python
def sieve(n):
    """Boolean array: prime[i] is True if i is prime, for i up to n."""
    prime = [True] * (n + 1)
    prime[0] = prime[1] = False
    i = 2
    while i * i <= n:
        if prime[i]:
            for j in range(i * i, n + 1, i):   # start at i*i, not 2*i
                prime[j] = False
        i += 1
    return prime
```

$\mathcal{O}(n \log \log n)$, which for any practical purpose is linear. At `n = 10^7` it runs in about a second in Python and instantly in C++.

Two details that are not cosmetic. The inner loop starts at `i * i`, because every smaller multiple of `i` has a smaller prime factor and was already crossed out. And the outer loop stops at $\sqrt n$, because a composite number at most `n` has a factor at most $\sqrt n$.

### The sieve variant that does more

Instead of a boolean, store the **smallest prime factor** of each number. Same cost, and now factorising anything in the range is a walk down its factors.

```python
def smallest_factor(n):
    spf = list(range(n + 1))
    i = 2
    while i * i <= n:
        if spf[i] == i:                       # i is prime
            for j in range(i * i, n + 1, i):
                if spf[j] == j:               # not yet assigned
                    spf[j] = i
        i += 1
    return spf

def factorise(x, spf):
    out = {}
    while x > 1:
        p = spf[x]
        while x % p == 0:
            out[p] = out.get(p, 0) + 1
            x //= p
    return out
```

Factorising becomes $\mathcal{O}(\log x)$ instead of $\mathcal{O}(\sqrt x)$. When a problem asks you to factorise a hundred thousand numbers, this is the difference between passing and not.

Without a sieve, single-number factorisation is trial division:

```python
def factorise_one(n):
    out = {}
    d = 2
    while d * d <= n:
        while n % d == 0:
            out[d] = out.get(d, 0) + 1
            n //= d
        d += 1
    if n > 1:
        out[n] = out.get(n, 0) + 1            # the last prime factor
    return out
```

The `if n > 1` at the end is the line people drop. After the loop, whatever remains is either 1 or a prime larger than $\sqrt n$, and forgetting it loses that factor silently.

## 2. Greatest common divisor

Euclid's algorithm, which is two thousand years old and still the answer.

```python
def gcd(a, b):
    while b:
        a, b = b, a % b
    return a
```

$\mathcal{O}(\log \min(a, b))$. It works because any common divisor of `a` and `b` also divides `a % b`, so the pair `(b, a % b)` has the same common divisors and strictly smaller numbers.

Least common multiple, with the division done first to avoid overflow:

```python
def lcm(a, b):
    return a // gcd(a, b) * b                 # divide first
```

`a * b // gcd(a, b)` gives the same answer and can overflow on the way in a fixed-width language. Divide first. The result is exact because `gcd(a, b)` divides `a`.

### Extended Euclid, which gives you more

Beyond the gcd, we often want `x` and `y` with

$$
ax + by = \gcd(a, b)
$$

That is Bézout's identity, and the coefficients are what give modular inverses.

```python
def ext_gcd(a, b):
    """Returns (g, x, y) with a*x + b*y = g = gcd(a, b)."""
    if b == 0:
        return a, 1, 0
    g, x1, y1 = ext_gcd(b, a % b)
    return g, y1, x1 - (a // b) * y1
```

## 3. Modular arithmetic

Almost every counting problem asks for the answer modulo a prime, usually $10^9 + 7$. The reason is practical: the true answer has thousands of digits, and a modulus keeps it in one machine word while still being a meaningful check on your algorithm.

The rules, which hold and are worth stating:

$$
(a + b) \bmod m = ((a \bmod m) + (b \bmod m)) \bmod m
$$
$$
(a \times b) \bmod m = ((a \bmod m) \times (b \bmod m)) \bmod m
$$

Addition, subtraction and multiplication all commute with taking the remainder. **Division does not**, and that is the whole difficulty.

Two traps before we get there.

**Negative remainders.** In Python, `-5 % 3` is `1`, which is the mathematically conventional answer. In C, C++, Java and Go it is `-2`. If you port code between them, wrap subtraction:

```python
result = (a - b) % MOD                        # Python: already correct
```
```c
result = ((a - b) % MOD + MOD) % MOD;         /* C: needs the fix */
```

**Overflow.** In C++ with 32-bit `int`, multiplying two numbers just under $10^9$ overflows. Use 64-bit types for the intermediate. Python has arbitrary precision, so this is one of the few places where Python is simply safer.

### Fast exponentiation

Computing $a^b \bmod m$ by multiplying `b` times is $\mathcal{O}(b)$, and `b` can be $10^{18}$. Square instead: exponentiation by squaring, from [part 7](/posts/2017/07/recursion-and-backtracking/).

```python
def power(a, b, m):
    result = 1
    a %= m
    while b:
        if b & 1:
            result = result * a % m
        a = a * a % m
        b >>= 1
    return result
```

$\mathcal{O}(\log b)$. Python has this built in as `pow(a, b, m)`, and it is faster than anything you write, so use it. Knowing the loop matters for other languages and for understanding what follows.

## 4. Modular inverses, and division

To divide by `a` modulo `m`, multiply by the **inverse** of `a`: the number $a^{-1}$ with $a \cdot a^{-1} \equiv 1 \pmod m$.

An inverse exists exactly when `gcd(a, m) = 1`. Two ways to find it.

**Fermat's little theorem, when `m` is prime.** For prime `m` and `a` not divisible by `m`,

$$
a^{m-1} \equiv 1 \pmod m \quad\Longrightarrow\quad a^{-1} \equiv a^{m-2} \pmod m
$$

```python
MOD = 10**9 + 7

def inverse(a):
    return pow(a, MOD - 2, MOD)               # MOD must be prime
```

One line, and the reason $10^9+7$ is chosen as the modulus everywhere: it is prime, so this works.

**Extended Euclid, for any coprime modulus.**

```python
def inverse_any(a, m):
    g, x, _ = ext_gcd(a % m, m)
    if g != 1:
        raise ValueError('no inverse: a and m share a factor')
    return x % m
```

**All inverses from 1 to `n`, in linear time.** When you need many, this is much better than `n` calls to `pow`.

```python
def inverses_up_to(n, m):
    inv = [0] * (n + 1)
    inv[1] = 1
    for i in range(2, n + 1):
        inv[i] = (m - (m // i) * inv[m % i] % m) % m
    return inv
```

That recurrence is worth having in your notes even if you never derive it. It comes from writing `m = (m // i) * i + (m % i)`, taking it modulo `m`, and rearranging.

## 5. Binomial coefficients modulo a prime

The single most common application. $\binom{n}{k}$ counts the ways to choose `k` things from `n`, and the formula

$$
\binom{n}{k} = \frac{n!}{k!\,(n-k)!}
$$

has a division in it, so we need inverses.

Precompute factorials and their inverses once, then answer each query in constant time.

```python
MOD = 10**9 + 7
N = 200_001

fact = [1] * N
for i in range(1, N):
    fact[i] = fact[i - 1] * i % MOD

inv_fact = [1] * N
inv_fact[N - 1] = pow(fact[N - 1], MOD - 2, MOD)
for i in range(N - 1, 0, -1):                 # backwards: one pow, not N
    inv_fact[i - 1] = inv_fact[i] * i % MOD

def choose(n, k):
    if k < 0 or k > n:
        return 0
    return fact[n] * inv_fact[k] % MOD * inv_fact[n - k] % MOD
```

The backwards loop for `inv_fact` is the trick worth keeping. Since $\frac{1}{(i-1)!} = \frac{1}{i!} \times i$, one modular exponentiation at the top gives every inverse factorial below it. The naive version calls `pow` `N` times and is a hundred times slower.

The `if k < 0 or k > n: return 0` guard prevents an index error and matches the mathematical convention. Put it in; it saves a debugging session.

## 6. The Chinese remainder theorem, briefly

Occasionally a problem gives you several congruences and wants the number satisfying all of them:

$$
x \equiv a_1 \pmod{m_1}, \quad x \equiv a_2 \pmod{m_2}, \quad \dots
$$

If the moduli are pairwise coprime there is exactly one solution modulo the product.

```python
def crt(pairs):
    """pairs is a list of (a, m) with the m pairwise coprime."""
    a0, m0 = 0, 1
    for a, m in pairs:
        g, p, _ = ext_gcd(m0, m)
        if (a - a0) % g:
            return None                       # inconsistent
        lcm_val = m0 // g * m
        shift = (a - a0) // g * p % (m // g)
        a0 = (a0 + m0 * shift) % lcm_val
        m0 = lcm_val
    return a0, m0
```

It comes up in two situations: a modulus that is not prime but factorises into distinct primes, so you solve modulo each and combine; and problems literally about cycles that align.

## 7. Two more tools

**Euler's totient**, $\varphi(n)$, counts the integers below `n` coprime to it. From the factorisation:

$$
\varphi(n) = n \prod_{p \mid n} \left(1 - \frac{1}{p}\right)
$$

```python
def totient(n):
    result = n
    p = 2
    while p * p <= n:
        if n % p == 0:
            while n % p == 0:
                n //= p
            result -= result // p
        p += 1
    if n > 1:
        result -= result // n
    return result
```

It generalises Fermat: $a^{\varphi(m)} \equiv 1 \pmod m$ for any `a` coprime to `m`, so the inverse is $a^{\varphi(m)-1}$ even when `m` is composite.

**Counting divisors from the factorisation.** If $n = p_1^{e_1} p_2^{e_2} \cdots$ then the number of divisors is $\prod (e_i + 1)$ and their sum is $\prod \frac{p_i^{e_i+1}-1}{p_i-1}$. Both follow from the fact that a divisor picks an exponent from 0 to $e_i$ for each prime, independently. Almost every "how many divisors" problem is that one line.

## 8. The traps, collected

These are the ones that produce wrong answers from code that looks right.

**Forgetting the last prime factor.** The `if n > 1` after trial division.

**Negative modulo.** Language-dependent. Always add the modulus after a subtraction, outside Python.

**Overflow in the intermediate.** `a * b` before the `% m`, in a fixed-width language.

**Using Fermat with a composite modulus.** `pow(a, m-2, m)` is silently wrong unless `m` is prime. If the modulus is $2^{32}$ or $10^9$, it does not apply.

**No inverse when the base shares a factor with the modulus.** Check `gcd` before dividing.

**Calling `pow` inside a loop.** Precompute factorials and inverse factorials, and use the backwards trick.

**Starting the sieve's inner loop at `2 * i`.** Correct but slower. Start at `i * i`.

**Using floating point.** `int(sqrt(n))` can be off by one for large `n`, and `math.floor(a / b)` is not integer division. Keep everything in integers: `d * d <= n`, and `//`.

## The short version

- Trial division to $\sqrt n$ for one number, a sieve for many. The sieve's inner loop starts at `i * i` and the outer stops at $\sqrt n$.
- A smallest-prime-factor sieve costs the same as a boolean one and makes factorising anything in range $\mathcal{O}(\log x)$.
- After trial division, `if n > 1` picks up the remaining large prime factor. Forgetting it loses a factor silently.
- Euclid for gcd; divide before multiplying for lcm. Extended Euclid gives Bézout coefficients, which give inverses.
- Addition, subtraction and multiplication pass through a modulus. Division does not: multiply by the inverse instead.
- With a prime modulus the inverse is `pow(a, m - 2, m)`. That is why $10^9+7$ is prime, and it is silently wrong for a composite modulus.
- For binomial coefficients, precompute factorials, then compute the inverse factorials backwards from a single `pow`. One exponentiation, not `n`.
- Keep everything in integers. `d * d <= n`, never `d <= sqrt(n)`.

Next: strings. Hashing, KMP, and the Z-function, which answer "where does this pattern occur" in linear time.
