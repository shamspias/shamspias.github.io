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
seriesOrder: 17
math: true
---

*Number theory in competitive programming is a short list of tools rather than a subject. Sieve for primes, Euclid for divisors, fast exponentiation, modular inverses, and the combinatorics that sits on top. Each is about ten lines. This part is all of them, with the traps that make correct-looking code give wrong answers.*

## 1. Primes: trial division, then the sieve

Is one number prime? Trial division up to the square root.

```cpp
bool is_prime(long long n) {
    if (n < 2)
        return false;
    if (n % 2 == 0)
        return n == 2;
    long long d = 3;
    while (d * d <= n) {
        if (n % d == 0)
            return false;
        d += 2;
    }
    return true;
}
```

$\mathcal{O}(\sqrt n)$. The square root bound is the only insight: if `n = a × b` with both above $\sqrt n$, then `a × b > n`, so at least one factor is at or below the root. Note `d * d <= n` rather than `d <= sqrt(n)`, which avoids floating point entirely and is therefore exactly right rather than nearly right.

For *many* numbers, sieve instead.

```cpp
// Boolean array: prime[i] is true if i is prime, for i up to n.
vector<bool> sieve(int n) {
    vector<bool> prime(n + 1, true);
    prime[0] = prime[1] = false;
    for (int i = 2; i * i <= n; ++i) {
        if (prime[i]) {
            for (int j = i * i; j <= n; j += i)   // start at i*i, not 2*i
                prime[j] = false;
        }
    }
    return prime;
}
```

$\mathcal{O}(n \log \log n)$, which for any practical purpose is linear. At `n = 10^7` it runs in a small fraction of a second in C++, and `vector<bool>` packs the flags one to a bit, so the table costs about 1.2 MB rather than 10 MB.

Two details that are not cosmetic. The inner loop starts at `i * i`, because every smaller multiple of `i` has a smaller prime factor and was already crossed out. And the outer loop stops at $\sqrt n$, because a composite number at most `n` has a factor at most $\sqrt n$.

### The sieve variant that does more

Instead of a boolean, store the **smallest prime factor** of each number. Same cost, and now factorising anything in the range is a walk down its factors.

```cpp
vector<int> smallest_factor(int n) {
    vector<int> spf(n + 1);
    for (int i = 0; i <= n; ++i)
        spf[i] = i;
    for (int i = 2; i * i <= n; ++i) {
        if (spf[i] == i) {                        // i is prime
            for (int j = i * i; j <= n; j += i)
                if (spf[j] == j)                  // not yet assigned
                    spf[j] = i;
        }
    }
    return spf;
}

map<int, int> factorise(int x, const vector<int>& spf) {
    map<int, int> out;
    while (x > 1) {
        int p = spf[x];
        while (x % p == 0) {
            out[p] += 1;
            x /= p;
        }
    }
    return out;
}
```

Factorising becomes $\mathcal{O}(\log x)$ instead of $\mathcal{O}(\sqrt x)$. When a problem asks you to factorise a hundred thousand numbers, this is the difference between passing and not.

Without a sieve, single-number factorisation is trial division:

```cpp
map<long long, int> factorise_one(long long n) {
    map<long long, int> out;
    long long d = 2;
    while (d * d <= n) {
        while (n % d == 0) {
            out[d] += 1;
            n /= d;
        }
        d += 1;
    }
    if (n > 1)
        out[n] += 1;                          // the last prime factor
    return out;
}
```

The `if n > 1` at the end is the line people drop. After the loop, whatever remains is either 1 or a prime larger than $\sqrt n$, and forgetting it loses that factor silently.

## 2. Greatest common divisor

Euclid's algorithm, which is two thousand years old and still the answer.

```cpp
long long gcd(long long a, long long b) {
    while (b) {
        long long r = a % b;
        a = b;
        b = r;
    }
    return a;
}
```

$\mathcal{O}(\log \min(a, b))$. It works because any common divisor of `a` and `b` also divides `a % b`, so the pair `(b, a % b)` has the same common divisors and strictly smaller numbers.

Least common multiple, with the division done first to avoid overflow:

```cpp
long long lcm(long long a, long long b) {
    return a / std::gcd(a, b) * b;            // divide first
}
```

`a * b / std::gcd(a, b)` gives the same answer, but C++ forms the product `a * b` first and it overflows `long long` once both values get large. Divide first. The result is exact because `gcd(a, b)` divides `a`.

### Extended Euclid, which gives you more

Beyond the gcd, we often want `x` and `y` with

$$
ax + by = \gcd(a, b)
$$

That is Bézout's identity, and the coefficients are what give modular inverses.

```cpp
// Returns (g, x, y) with a*x + b*y = g = gcd(a, b).
tuple<long long, long long, long long> ext_gcd(long long a, long long b) {
    if (b == 0)
        return {a, 1LL, 0LL};
    auto [g, x1, y1] = ext_gcd(b, a % b);
    return {g, y1, x1 - (a / b) * y1};
}
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

**Negative remainders.** In C++, `-5 % 3` is `-2`, not the mathematically conventional `1`. Integer division truncates toward zero, so `%` takes the sign of its left operand, and any subtraction under a modulus needs wrapping:

```cpp
long long sub_mod_naive(long long a, long long b, long long MOD) {
    return (a - b) % MOD;                 // can come out negative when b > a
}
```
```cpp
long long sub_mod(long long a, long long b, long long MOD) {
    return ((a - b) % MOD + MOD) % MOD;   // C and C++: force it non-negative
}
```

**Overflow.** In C++ with 32-bit `int`, multiplying two numbers just under $10^9$ overflows. Use `long long` for the intermediate: two values below $10^9$ multiply to under $10^{18}$, which still fits comfortably. Watch the subtlety that `int * int` is computed as `int` even when you assign the result to a `long long`, so cast one operand before multiplying.

### Fast exponentiation

Computing $a^b \bmod m$ by multiplying `b` times is $\mathcal{O}(b)$, and `b` can be $10^{18}$. Square instead: exponentiation by squaring, from [part 8](/posts/2017/07/recursion-and-backtracking/).

```cpp
long long power(long long a, long long b, long long m) {
    long long result = 1;
    a %= m;
    while (b) {
        if (b & 1)
            result = result * a % m;
        a = a * a % m;                        // needs 64 bits: m can be 1e9
        b >>= 1;
    }
    return result;
}
```

$\mathcal{O}(\log b)$. The C++ standard library has no modular exponentiation of its own (`std::pow` is floating point and loses precision here), so this is a loop you write out once and keep in your template.

## 4. Modular inverses, and division

To divide by `a` modulo `m`, multiply by the **inverse** of `a`: the number $a^{-1}$ with $a \cdot a^{-1} \equiv 1 \pmod m$.

An inverse exists exactly when `gcd(a, m) = 1`. Two ways to find it.

**Fermat's little theorem, when `m` is prime.** For prime `m` and `a` not divisible by `m`,

$$
a^{m-1} \equiv 1 \pmod m \quad\Longrightarrow\quad a^{-1} \equiv a^{m-2} \pmod m
$$

```cpp
const long long MOD = 1000000007;

long long power(long long a, long long b, long long m) {   // no modpow in the library
    long long result = 1;
    a %= m;
    while (b) {
        if (b & 1)
            result = result * a % m;
        a = a * a % m;
        b >>= 1;
    }
    return result;
}

long long inverse(long long a) {
    return power(a, MOD - 2, MOD);            // MOD must be prime
}
```

One line, and the reason $10^9+7$ is chosen as the modulus everywhere: it is prime, so this works.

**Extended Euclid, for any coprime modulus.**

```cpp
tuple<long long, long long, long long> ext_gcd(long long a, long long b) {
    if (b == 0)
        return {a, 1LL, 0LL};
    auto [g, x1, y1] = ext_gcd(b, a % b);
    return {g, y1, x1 - (a / b) * y1};
}

// Returns the inverse of a modulo m, or -1 when a and m share a factor.
long long inverse_any(long long a, long long m) {
    long long g, x;
    tie(g, x, ignore) = ext_gcd(((a % m) + m) % m, m);
    if (g != 1)
        return -1;                            // no inverse: a and m share a factor
    return ((x % m) + m) % m;                 // force it non-negative
}
```

**All inverses from 1 to `n`, in linear time.** When you need many, this is much better than `n` calls to `power`.

```cpp
vector<long long> inverses_up_to(int n, long long m) {
    vector<long long> inv(n + 1, 0);
    inv[1] = 1;
    for (int i = 2; i <= n; ++i)
        inv[i] = (m - (m / i) * inv[m % i] % m) % m;   // the product needs 64 bits
    return inv;
}
```

That recurrence is worth having in your notes even if you never derive it. It comes from writing `m = (m / i) * i + (m % i)`, taking it modulo `m`, and rearranging.

## 5. Binomial coefficients modulo a prime

The single most common application. $\binom{n}{k}$ counts the ways to choose `k` things from `n`, and the formula

$$
\binom{n}{k} = \frac{n!}{k!\,(n-k)!}
$$

has a division in it, so we need inverses.

Precompute factorials and their inverses once, then answer each query in constant time.

```cpp
const long long MOD = 1000000007;
const int N = 200001;

vector<long long> fact(N, 1);
vector<long long> inv_fact(N, 1);

long long power(long long a, long long b, long long m) {
    long long result = 1;
    a %= m;
    while (b) {
        if (b & 1)
            result = result * a % m;
        a = a * a % m;
        b >>= 1;
    }
    return result;
}

void build_tables() {                         // call this once from main
    for (int i = 1; i < N; ++i)
        fact[i] = fact[i - 1] * i % MOD;

    inv_fact[N - 1] = power(fact[N - 1], MOD - 2, MOD);
    for (int i = N - 1; i > 0; --i)            // backwards: one power, not N
        inv_fact[i - 1] = inv_fact[i] * i % MOD;
}

long long choose(int n, int k) {
    if (k < 0 || k > n)
        return 0;
    return fact[n] * inv_fact[k] % MOD * inv_fact[n - k] % MOD;
}
```

The backwards loop for `inv_fact` is the trick worth keeping. Since $\frac{1}{(i-1)!} = \frac{1}{i!} \times i$, one modular exponentiation at the top gives every inverse factorial below it. The naive version calls `power` `N` times and is a hundred times slower.

The `if (k < 0 || k > n) return 0;` guard matches the mathematical convention and, more urgently, prevents an out-of-range `vector` read, which in C++ is undefined behaviour rather than a clean exception. Put it in; it saves a debugging session.

## 6. The Chinese remainder theorem, briefly

Occasionally a problem gives you several congruences and wants the number satisfying all of them:

$$
x \equiv a_1 \pmod{m_1}, \quad x \equiv a_2 \pmod{m_2}, \quad \dots
$$

If the moduli are pairwise coprime there is exactly one solution modulo the product.

```cpp
tuple<long long, long long, long long> ext_gcd(long long a, long long b) {
    if (b == 0)
        return {a, 1LL, 0LL};
    auto [g, x1, y1] = ext_gcd(b, a % b);
    return {g, y1, x1 - (a / b) * y1};
}

// pairs is a list of (a, m) with the m pairwise coprime.
// Returns (x, lcm of the moduli); (-1, -1) means the system is inconsistent.
pair<long long, long long> crt(const vector<pair<long long, long long>>& pairs) {
    long long a0 = 0, m0 = 1;
    for (auto [a, m] : pairs) {
        long long g, p;
        tie(g, p, ignore) = ext_gcd(m0, m);
        if ((a - a0) % g != 0)
            return {-1, -1};                  // inconsistent
        long long lcm_val = m0 / g * m;
        long long md = m / g;
        long long shift = (a - a0) / g % md * (p % md) % md;
        shift = (shift + md) % md;            // C++ % can come out negative
        a0 = (a0 + m0 * shift) % lcm_val;
        m0 = lcm_val;
    }
    return {a0, m0};
}
```

It comes up in two situations: a modulus that is not prime but factorises into distinct primes, so you solve modulo each and combine; and problems literally about cycles that align.

## 7. Two more tools

**Euler's totient**, $\varphi(n)$, counts the integers below `n` coprime to it. From the factorisation:

$$
\varphi(n) = n \prod_{p \mid n} \left(1 - \frac{1}{p}\right)
$$

```cpp
long long totient(long long n) {
    long long result = n;
    long long p = 2;
    while (p * p <= n) {
        if (n % p == 0) {
            while (n % p == 0)
                n /= p;
            result -= result / p;
        }
        p += 1;
    }
    if (n > 1)
        result -= result / n;
    return result;
}
```

It generalises Fermat: $a^{\varphi(m)} \equiv 1 \pmod m$ for any `a` coprime to `m`, so the inverse is $a^{\varphi(m)-1}$ even when `m` is composite.

**Counting divisors from the factorisation.** If $n = p_1^{e_1} p_2^{e_2} \cdots$ then the number of divisors is $\prod (e_i + 1)$ and their sum is $\prod \frac{p_i^{e_i+1}-1}{p_i-1}$. Both follow from the fact that a divisor picks an exponent from 0 to $e_i$ for each prime, independently. Almost every "how many divisors" problem is that one line.

## 8. The traps, collected

These are the ones that produce wrong answers from code that looks right.

**Forgetting the last prime factor.** The `if n > 1` after trial division.

**Negative modulo.** In C++, `%` keeps the sign of its left operand. Always add the modulus back after a subtraction: `((a - b) % m + m) % m`.

**Overflow in the intermediate.** `a * b` before the `% m`. Two 32-bit `int`s near $10^9$ wrap around silently; make at least one operand `long long` first.

**Using Fermat with a composite modulus.** `power(a, m - 2, m)` is silently wrong unless `m` is prime. If the modulus is $2^{32}$ or $10^9$, it does not apply.

**No inverse when the base shares a factor with the modulus.** Check `gcd` before dividing.

**Calling `power` inside a loop.** Precompute factorials and inverse factorials, and use the backwards trick.

**Starting the sieve's inner loop at `2 * i`.** Correct but slower. Start at `i * i`.

**Using floating point.** `(long long)sqrt(n)` can be off by one for large `n`, because a `double` carries only 53 bits of mantissa, and `floor(a / (double)b)` is not integer division. Keep everything in integers: `d * d <= n`, and plain `/` between integer types.

## The short version

- Trial division to $\sqrt n$ for one number, a sieve for many. The sieve's inner loop starts at `i * i` and the outer stops at $\sqrt n$.
- A smallest-prime-factor sieve costs the same as a boolean one and makes factorising anything in range $\mathcal{O}(\log x)$.
- After trial division, `if n > 1` picks up the remaining large prime factor. Forgetting it loses a factor silently.
- Euclid for gcd; divide before multiplying for lcm. Extended Euclid gives Bézout coefficients, which give inverses.
- Addition, subtraction and multiplication pass through a modulus. Division does not: multiply by the inverse instead.
- With a prime modulus the inverse is `power(a, m - 2, m)` by fast exponentiation. That is why $10^9+7$ is prime, and it is silently wrong for a composite modulus.
- For binomial coefficients, precompute factorials, then compute the inverse factorials backwards from a single `power` call. One exponentiation, not `n`.
- Keep everything in integers. `d * d <= n`, never `d <= sqrt(n)`.

Next: strings. Hashing, KMP, and the Z-function, which answer "where does this pattern occur" in linear time.
