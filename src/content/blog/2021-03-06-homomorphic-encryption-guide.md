---
title: "Homomorphic Encryption (HE) Explained: A Beginner’s Guide to Secure AI on Encrypted Data"
description: "What homomorphic encryption really does, which scheme to pick, what a ciphertext costs in bytes and depth, and where it still loses to a trusted enclave."
date: 2021-03-06
permalink: "/posts/2021/03/homomorphic-encryption-guide/"
tags:
  - "privacy"
  - "encryption"
  - "machine learning"
  - "homomorphic encryption"
  - "AI security"
math: false
---

*I wrote the first version of this post in 2021 and I was far too excited. The magic is real:
you can run a computation on data you cannot read. What I skipped was the price, the failure
modes, and the fact that for most privacy problems the answer in 2026 is still something else.
This is the version I should have written, with the numbers in it.*

---

## 1. A calculator you can post through a letterbox

Here is the whole idea in one picture. You lock the number 5 in a box and post it to me. I
cannot open the box. But I have a strange machine: I feed the locked box in one end, turn a
crank marked "add 3", and a different locked box comes out. I post that back. You unlock it and
find 8.

I never saw 5. I never saw 8. I did the arithmetic anyway.

That is **homomorphic encryption**: an encryption scheme where certain operations on ciphertexts
correspond to operations on the plaintexts underneath. Precisely, for addition:

```
Dec( Enc(a)  +  Enc(b) )  =  a + b
Dec( Enc(a)  *  Enc(b) )  =  a * b
```

The `+` and `*` on the left are operations on big lumps of encrypted data. The ones on the right
are ordinary arithmetic. The scheme guarantees the two agree.

Everything interesting follows from a single consequence: **addition and multiplication are
enough to build any arithmetic circuit.** Dot products, polynomials, statistics, a logistic
regression, a convolution. If you can write it as adds and multiplies, you can in principle run
it on data you never decrypt. The words "in principle" are doing a lot of work, and sections 4
and 5 are about how much.

---

## 2. Who holds the key is the entire design

This is the part people skip, and it is the only part that determines whether your system is
private at all.

```
CLIENT                                  SERVER
holds: secret key                       holds: public + evaluation keys
─────────────────                       ───────────────────────────────
 5 ──Enc──► [ciphertext] ─────────────► [ciphertext]
                                              │  add 3, multiply, sum
                                              ▼
 8 ◄──Dec── [ciphertext] ◄───────────── [ciphertext]

only the left-hand column ever holds a number a human could read
```

The server gets a **public key** (to encrypt, if it needs to) and **evaluation keys**
(relinearisation keys, which stop ciphertexts growing after every multiply, and Galois keys,
which shift the encrypted values around inside a ciphertext). It never gets the secret key. That
asymmetry is the product.

Two consequences that surprise people:

**Whoever decrypts is whoever learns the answer.** In the diagram, the client learns the score.
The server does not, and therefore cannot act on it. If your product needs the server to block a
message, homomorphic encryption alone does not get you there: someone still has to decrypt a
decision, and that someone learns something. Be honest with yourself about who that is before
you write any crypto.

**If the server holds the secret key, you have built nothing.** I have reviewed designs where a
single service generated the keypair, encrypted the data, computed on it, and decrypted the
result. That is an expensive way to write plaintext to a socket. HE moves trust; it does not
delete it.

---

## 3. The three schemes you will actually meet

Craig Gentry's 2009 thesis showed the first fully homomorphic scheme, and for a few years that
was the whole story. It is not the story now. Three families cover essentially all practical
work, and picking the wrong one is the most common early mistake.

```
What are you computing?
│
├─ exact integer arithmetic
│    counts, sums, exact equality, database-style aggregates
│    └─► BFV or BGV
│
├─ real numbers, small rounding error acceptable
│    dot products, linear and logistic models, statistics,
│    neural network layers
│    └─► CKKS      (almost all "AI on encrypted data" is this)
│
└─ arbitrary functions of small integers, unbounded depth
     comparisons, sign, branches, lookup tables
     └─► TFHE / FHEW  (programmable bootstrapping)
```

**BFV and BGV** do exact integer arithmetic modulo a plaintext modulus. If you need the answer
to be right to the last digit, this is your family.

**CKKS** is the one that matters for machine learning. It encrypts vectors of real numbers and
treats encryption noise as part of the floating-point error budget: results come back
approximately correct, the way float arithmetic is approximately correct. That trade is what
makes encrypted inference plausible at all. It also means CKKS is not the scheme for anything
where a rounding error is a bug rather than a nuisance.

**TFHE** takes a different bargain. It works on small integers, one at a time, and bootstraps
after every gate, so depth is unlimited by construction. A single TFHE bootstrap is on the order
of milliseconds on a CPU core, which sounds slow until you notice it can evaluate an arbitrary
lookup table for free while it runs. That makes non-polynomial things (a comparison, a sign, a
ReLU) cheap in TFHE and awkward in CKKS.

The rule I use: **CKKS if the computation is a big pile of arithmetic, TFHE if it is a small
pile of decisions.**

---

## 4. Noise, levels, and why depth is the real budget

Every ciphertext carries deliberate random noise. Decryption works because the noise is small
enough to round away. Addition grows noise slowly. Multiplication grows it fast. Cross the
threshold and the ciphertext stops decrypting to anything meaningful.

In CKKS you manage this with a **ladder of moduli**. Each multiplication consumes one rung.

```
coeff_mod_bit_sizes = [60, 40, 40, 60]
                        │   │   │   └── key-switching prime (not a level)
                        │   │   └────── level 1 becomes level 0
                        │   └────────── level 2 becomes level 1
                        └────────────── final level, holds the answer

 fresh          after 1 mult    after 2 mult    after 3 mult
 level 2   ──►  level 1    ──►  level 0    ──►  nothing left
 q = 140 bits   q = 100 bits    q = 60 bits     decryption fails
 ~280 KB        ~200 KB         ~120 KB
```

So `[60, 40, 40, 60]` buys you a **multiplicative depth of 2**. Not two multiplications: two
levels of multiplication. A dot product of any width is depth 1, because the additions are free.
A two-layer network with a squared activation is depth 4 or so, and you will need a longer
ladder.

You cannot simply make the ladder longer. Security depends on the ratio between the polynomial
degree `N` and the total modulus bits. At `N = 8192`, the standard parameter tables cap you at
218 bits of modulus for 128-bit security, and `[60, 40, 40, 60]` spends 200 of them. Want more
depth? Double `N` to 16384, which roughly doubles ciphertext size and more than doubles the time
per operation. Depth is expensive in a way that feels unfamiliar if you come from ordinary
numerics.

The escape hatch is **bootstrapping**: homomorphically evaluating the decryption circuit to
reset the noise, which is Gentry's original insight and the thing that makes a scheme "fully"
homomorphic. In CKKS it works, it is implemented in OpenFHE, and it costs seconds per
ciphertext. In TFHE it costs milliseconds but only refreshes a tiny payload. Most production
designs I have seen avoid bootstrapping entirely by keeping the circuit shallow on purpose.

---

## 5. Batching is not an optimisation, it is the whole economy

A CKKS ciphertext at `N = 8192` does not hold one number. It holds **4096 independent slots**,
and every operation applies to all of them at once, SIMD style.

```
one CKKS ciphertext at N = 8192  =  4096 independent slots

 [ x0 | x1 | x2 | ... | x4095 ]   one ciphertext, ~280 KB
   *    *    *          *
 [ w0 | w1 | w2 | ... | w4095 ]   one plaintext vector, free to the server
   =    =    =          =
 [ y0 | y1 | y2 | ... | y4095 ]   one multiply, 4096 products

 unbatched: 16 bytes of payload  ->  280 KB ciphertext   (~17,000x)
 batched:   32 KB of payload     ->  280 KB ciphertext   (~9x)
```

That size comes from arithmetic you can check yourself: a ciphertext is two polynomials of `N`
coefficients, each coefficient reduced modulo a `q` of about 140 bits. Two times 8192 times 140
bits is roughly 280 KB. The original version of this post said a ciphertext was 10 KB to 100 KB.
That was wrong for any parameter set you would actually deploy.

The lesson is in the last two lines. Encrypt two floats and you pay a five-figure expansion
factor. Fill the slots and you pay single digits. If your design encrypts scalars one at a time,
you have not built a slow system, you have built an unusable one. Lay your data out so a batch
of records, or a whole feature vector, or a whole row of a matrix, lands in one ciphertext.

Summing across slots needs **rotations**, which is what the Galois keys are for, and a full sum
over 4096 slots costs about 12 rotations using the standard doubling trick. Rotations are not
free. Structure your computation so you need few of them.

---

## 6. A worked example that actually runs

The classic toy: score a message as safe or violating, using two features, without the server
seeing either feature. If the dot product is unfamiliar, my
[linear algebra primer](/posts/2023/01/math-for-ai-linear-algebra-basics/) covers it.

[TenSEAL](https://github.com/OpenMined/TenSEAL) is the gentlest Python on-ramp. It wraps
Microsoft SEAL and gives you a tensor-flavoured API.

```python
import tenseal as ts

# Depth 2: enough for one plaintext-ciphertext dot product plus a bias.
# 200 modulus bits at N=8192 stays inside the 218-bit cap for 128-bit security.
context = ts.context(
    ts.SCHEME_TYPE.CKKS,
    poly_modulus_degree=8192,
    coeff_mod_bit_sizes=[60, 40, 40, 60],
)
context.global_scale = 2**40
context.generate_galois_keys()

# The client keeps this context and its key; only the copy below crosses the wire.
secret_key = context.secret_key()

server_context = context.copy()
server_context.make_context_public()  # public + galois + relin keys only

# --- client side ---------------------------------------------------------
# Features are normalised so neither dominates the score and so the CKKS
# scale stays in a sane range. Raw counts and raw lengths do not mix well.
features = [3.0 / 10.0, 50.0 / 280.0]
enc = ts.ckks_vector(server_context, features)
payload = enc.serialize()  # this, and only this, goes over the wire

# --- server side ---------------------------------------------------------
# The server has the payload and a public context. No secret key exists here.
srv_vec = ts.ckks_vector_from(server_context, payload)
weights = [0.9, -0.4]  # the model stays in plaintext; only the data is hidden
bias = -0.1
enc_score = srv_vec.dot(weights) + bias
reply = enc_score.serialize()

# --- client side again ---------------------------------------------------
score_vec = ts.ckks_vector_from(context, reply)
score = score_vec.decrypt(secret_key)[0]
print(f"score={score:.4f} -> {'violating' if score > 0 else 'safe'}")
```

```
score=0.0986 -> violating
```

Four things in that snippet are worth more than the snippet.

**The 2021 version of this post had a bug.** It created the vector from a public context and
then called `.decrypt()` on it. There is no secret key in a public context, so that cannot work.
The fix is the shape above: serialise the ciphertext, move it, and decrypt on the side that
holds the key. The bug is instructive because it is exactly the mistake that makes a demo look
like it works while the trust boundary is imaginary.

**The comparison happens in plaintext, on the client.** `score > 0` is a branch, and CKKS cannot
branch. If the server needed to make that decision, you would need TFHE's programmable
bootstrapping to evaluate the sign homomorphically, and you would pay for it.

**The model is not hidden.** The weights are plaintext on the server. Hiding the data is one
problem; hiding the model from the client is a different and harder one, usually solved with
two-party computation rather than plain HE.

**Feature scaling matters more than usual.** CKKS precision is tied to the scale you pick, and
values of wildly different magnitudes eat precision. Normalise before you encrypt.

One cost the snippet does not print: the encrypted arithmetic here is milliseconds of CPU, and
the payload is hundreds of kilobytes in each direction for a single score. Bandwidth is the
bill, and that is the argument for batching in section 5.

---

## 7. The CKKS decryption trap

This is the most important thing that changed after the original post, and it caught a lot of
people, including me.

Li and Micciancio showed in 2021 that CKKS is not secure under the usual definition when the
adversary gets to see decrypted results of ciphertexts it supplied. Because CKKS decryption
returns an approximation, the low-order bits of the result carry information about the noise,
and the noise carries information about the secret key. Enough queries and the key falls out.

The practical rule that follows:

> Never hand a raw decrypted CKKS value back to the party that produced or influenced the
> ciphertext, unless you have added noise flooding first.

In the example above the client decrypts and keeps the answer, so it is fine. Change the design
so the client returns the score to the server, or logs it somewhere the server can read, and you
have built the vulnerable pattern. Libraries now ship noise-flooding options for exactly this:
add extra random noise, large relative to the accumulated error, before releasing a decrypted
value. It costs you some precision, and you should budget for it rather than discover it.

This is the same lesson I keep relearning in other contexts, most recently while writing about
[safe-by-default agents](/posts/2025/12/safe-by-default-agents/): the property has to be
enforced by the mechanism, not by everyone remembering to be careful.

---

## 8. The library landscape in 2026

The 2021 version of this table has aged badly, so here is an honest one.

| Library | Schemes | Where it stands |
|---|---|---|
| [OpenFHE](https://github.com/openfheorg/openfhe) | BGV, BFV, CKKS, TFHE, FHEW, bootstrapping | The successor to PALISADE and the most complete open library. Where I would start for anything serious. C++, with Python bindings. |
| [Microsoft SEAL](https://github.com/microsoft/SEAL) | BFV, BGV, CKKS | Stable, widely embedded, excellent documentation, no bootstrapping. Development has been quiet for a while. |
| [TenSEAL](https://github.com/OpenMined/TenSEAL) | CKKS, BFV (via SEAL) | Still the easiest Python entry point, and lightly maintained. Fine for learning and prototypes. |
| [Concrete ML](https://github.com/zama-ai/concrete-ml) | TFHE | Compiles quantised scikit-learn models and small torch networks straight to FHE. The most practical route if you want a model to run without writing crypto. |
| [Lattigo](https://github.com/tuneinsight/lattigo) | BFV, BGV, CKKS, multiparty | Pure Go, good multiparty and threshold support. Pick it if your stack is Go. |
| [Pyfhel](https://github.com/ibarrond/Pyfhel) | BFV, CKKS (via SEAL) | Small, readable, good for teaching. |

One removal worth stating plainly: **PySyft is no longer the encrypted-tensor library it was in
2021.** It moved to a remote data science model, and reaching for it because a 2020 tutorial
said so will waste your afternoon.

For parameters, do not hand-tune. Use your library's defaults or the tables published by
[homomorphicencryption.org](https://homomorphicencryption.org/), and treat any parameter set you
invented yourself as insecure until someone who does lattice estimates says otherwise.

---

## 9. What HE does not give you, and what to use instead

Confidentiality is one property. Here are the ones people assume come with it and do not.

**Integrity.** A malicious server can return a ciphertext encrypting anything at all, or run a
different function, and you cannot tell from the plaintext you decrypt. Verifiable FHE exists as
research and is not something I would deploy in 2026. If you need to know the computation was
the one you asked for, HE is not the tool on its own.

**Metadata privacy.** Ciphertext sizes, timing, and access patterns leak. If your server fetches
a different encrypted row depending on the query, the fetch pattern is the query.

**A solution to the scanning debate.** The original post listed "detect child exploitation in
encrypted messages" as a use case. HE can genuinely compute a score without reading a message,
and that is worth something. It settles none of the hard questions: who chooses the classifier,
who holds the key that decrypts the verdict, what happens when the classifier is wrong, and what
stops the same pipeline being pointed at a different target next year. Those are governance
questions wearing a cryptography costume, and a scheme cannot answer them.

Set against the alternatives:

| Approach | Hides data from the operator | You must trust | Rough cost |
|---|---|---|---|
| Homomorphic encryption | yes, cryptographically | lattice assumptions, your parameters | 100x to 10,000x compute |
| Secure multi-party computation | yes, if parties do not collude | non-collusion between parties | many network rounds, latency |
| Trusted execution (SGX, TDX, SEV-SNP, confidential GPUs) | yes, from the OS and operator | a silicon vendor and its attestation | single-digit to low-double-digit percent |
| Federated learning | partly; gradients leak without extra work | the protocol, plus differential privacy | coordination and drift |
| Differential privacy | no; it protects individuals in outputs | your epsilon accounting | accuracy |
| Not collecting the data | completely | nobody | product changes |

The honest summary for machine learning in 2026: **encrypted linear models, small tree
ensembles, and modest statistics work today and are genuinely deployable.** Encrypted
convolutional networks work in minutes per image and remain a research demo for most teams.
Encrypted LLM inference is not close, and the things actually shipping under the "confidential
AI" label are trusted execution environments on GPUs, not homomorphic encryption. Saying
otherwise sells the field short by overselling it.

---

## 10. The short version

- HE lets a server compute on ciphertexts so that decrypting the output gives the right answer.
  Add and multiply are enough to build most of what you want.
- **Who holds the secret key is the design.** If the server holds it, you have built nothing.
  Whoever decrypts is whoever learns the answer, so decide that first.
- **CKKS** for arithmetic on reals (all the machine learning), **BFV/BGV** for exact integers,
  **TFHE** when you need comparisons, branches, and unbounded depth.
- Multiplicative **depth** is the budget, not operation count. `[60, 40, 40, 60]` at `N = 8192`
  buys depth 2, and buying more depth means a bigger `N` and a much slower everything.
- **Batch, or don't bother.** One ciphertext holds 4096 slots. Unbatched, expansion is around
  17,000x; full, it is around 9x.
- Never return a raw decrypted CKKS value to the party that supplied the ciphertext. Add noise
  flooding, or you are leaking towards the secret key.
- Start with OpenFHE or Concrete ML; TenSEAL for learning. PySyft is no longer an HE library.
- HE gives confidentiality, not integrity, not metadata privacy, and not governance. For most
  production "private AI" today, a confidential-computing enclave is the boring answer that
  works.
