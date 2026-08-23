---
title: "From Chaos to Focus: Understanding Transformers & Attention"
description: "Attention and the transformer block from first principles, plus what changed by 2026: pre-norm, RMSNorm, RoPE, grouped-query attention and the KV cache."
date: 2022-06-06
permalink: "/posts/2022/06/transformers-attention-made-simple/"
tags:
  - "AI"
  - "transformers"
  - "deep learning"
  - "attention"
  - "beginner"
  - "education"
math: false
---

*I wrote this in 2022 for people who found the transformer paper impenetrable. The central idea
has not aged a day. Almost every engineering detail around it has, so this is the original
explanation with the 2026 practice bolted back on.*

---

## 1. The one problem attention solves

Imagine reading a novel through a letterbox that shows one word at a time, and you are only
allowed to keep a single note in your pocket. Every new word, you rewrite the note. By chapter
three, whatever you learned on page one has been rewritten hundreds of times and is mostly gone.

That is a recurrent network. Information travels from position to position, and each hop is a
chance to lose it. Attention removes the hops. Every position reads every other position
directly, in one step.

```
Recurrent: one path, five hops

   The ──▶ cat ──▶ sat ──▶ on ──▶ the ──▶ mat
    h1      h2      h3      h4     h5      h6

   Whatever "The" contributes has to survive five rewrites.

Attention: every position reads every other in one hop

        to:  The  cat  sat   on  the  mat
   from The   *    *    *    *    *    *
        cat   *    *    *    *    *    *
        sat   *    *    *    *    *    *
        on    *    *    *    *    *    *
        the   *    *    *    *    *    *
        mat   *    *    *    *    *    *

   Path length between any two words: 1.
   Cost: 36 dot products instead of 5 sequential steps, and all
   36 of them run at the same time.
```

That trade is the whole architecture. You spend quadratic compute (double the sentence length
and the work goes up fourfold) to buy a constant path length and full parallelism during
training. In 2017 that was a bargain, because GPUs are much happier doing 36 independent things
than 5 dependent ones. It is still a bargain, though section 8 has the bill.

## 2. Attention is a weighted average, and nothing more

Before any notation, do it by hand.

Three people are in a room and you ask: "who helped with the science project?"

| Person  | What they said                          | Relevance |
|---------|-----------------------------------------|-----------|
| Alice   | "I helped build the volcano"            | 9         |
| Bob     | "I was playing games"                   | 1         |
| Charlie | "I brought the materials"               | 7         |

Turn the relevance scores into shares by dividing by their total, 17:

```
Alice   9/17 = 53%
Bob     1/17 =  6%
Charlie 7/17 = 41%
```

Then the answer you form is `0.53 x Alice's information + 0.06 x Bob's + 0.41 x Charlie's`.

That is attention. Score every source against what you are looking for, normalise the scores so
they sum to one, take the weighted average of what the sources contain. Everything after this is
about how the scores get computed and how to do it fast.

Two details separate the toy from the real thing. Real attention normalises with **softmax**
rather than plain division, because scores can be negative and softmax handles that while
sharpening the gap between winners and losers. And real attention never actually ignores anyone:
Bob still gets his 6%, which is why a model can be quietly poisoned by an irrelevant token.

## 3. Query, key, value

The awkward part of attention is that each position plays three roles at once, and the names for
them are borrowed from databases in a way that helps nobody.

Think of a conference poster session. When you walk up to a poster you have a **query**: the
thing you came looking for. Every poster has a **title**, which is its **key**, the advertising
it uses to match against your interest. And every poster has actual **content**, its **value**,
which is what you take away if you decide to read it. Title and content differ on purpose. A
poster can advertise itself with words that have nothing to do with the detail it delivers.

In a transformer, the same vector produces all three through three learned matrices.

```
  "sat"
    │
    ├──── Wq ────▶ q      what am I looking for
    ├──── Wk ────▶ k      what do I advertise
    └──── Wv ────▶ v      what do I hand over

              q · kⱼ
   score_j = ────────     compatibility with position j
              √d_head

   w = softmax(scores)    positive, sums to 1, one weight per position

   out = w₁v₁ + w₂v₂ + ... + w₆v₆        a blend of the whole sentence
```

Self-attention just means q, k and v all come from the same sequence: the sentence interrogating
itself. Cross-attention means the queries come from one sequence and the keys and values from
another, which is how a translation decoder looks back at the source text.

The `√d_head` bothers people, so here is the reason. If q and k have `d_head` entries each drawn
independently with variance 1, their dot product has variance `d_head`, so its size grows like
`√d_head`. At `d_head = 128` you get raw scores in the tens, softmax saturates into a
one-hot spike, and the gradient through it goes to nearly zero. Dividing by `√d_head` puts the
scores back on a scale where softmax still has opinions. It is variance control, not mysticism.

## 4. The mechanism in code

Here is the entire thing written out, and then the same thing as the single call you should
actually use.

```python
import torch
import torch.nn.functional as F

torch.manual_seed(0)
batch, heads, seq, head_dim = 1, 1, 6, 64
q = torch.randn(batch, heads, seq, head_dim)
k = torch.randn(batch, heads, seq, head_dim)
v = torch.randn(batch, heads, seq, head_dim)

# The mechanism, spelled out.
scores = (q @ k.transpose(-2, -1)) / head_dim**0.5
causal = torch.ones(seq, seq, dtype=torch.bool).tril()
scores = scores.masked_fill(~causal, float("-inf"))
weights = scores.softmax(dim=-1)
manual = weights @ v

# The same maths, dispatched to a fused kernel.
fused = F.scaled_dot_product_attention(q, k, v, is_causal=True)

print(torch.allclose(manual, fused, atol=1e-5))   # True
```

A matrix product, a scale, a mask, a softmax and another matrix product. That is genuinely all
of it.

The `masked_fill` is the causal mask, and it is the difference between a model that predicts the
next word and a model that cheats. Setting future scores to `-inf` makes their softmax weight
exactly zero, so position 3 cannot read position 4. Forget it and your training loss will look
spectacular and your generations will be gibberish, because at training time the answer was
sitting one column to the right.

If you are shaky on why `q @ k.transpose(-2, -1)` is "every query against every key", the
[linear algebra post](/posts/2023/01/math-for-ai-linear-algebra-basics/) covers matrix products
as batched dot products.

The `F.scaled_dot_product_attention` line is the 2026 update to this section. It arrived in
PyTorch 2.0 and it dispatches to a fused FlashAttention-style kernel that never materialises the
`seq x seq` score matrix at all. Same numbers, far less memory. Write the manual version once to
understand it, then never ship it.

## 5. Multi-head, and why 2026 shares the keys

One set of Wq, Wk, Wv can only learn one notion of relevance. Split the vector into several
groups of dimensions instead, run attention independently inside each, and concatenate. Now one
head can specialise in subject-verb agreement while another tracks which noun a pronoun refers
to. Eight heads on a 512-dimensional model means each head works in 64 dimensions, so multi-head
attention costs roughly the same as single-head attention and buys several opinions.

That much is from the original paper. What changed is the key and value side.

During generation, every key and value you have computed must be kept, because token 5,000 still
needs to attend to token 1. That store is the **KV cache**, and it dominates inference memory.
Grouped-query attention shrinks it by letting several query heads share one key/value head.

```
Multi-head attention (32 query heads, 32 KV heads)

   q  q  q  q   q  q  q  q   ...   q  q  q  q     32 queries
   │  │  │  │   │  │  │  │         │  │  │  │
   k  k  k  k   k  k  k  k   ...   k  k  k  k     32 KV pairs

Grouped-query attention (32 query heads, 8 KV heads)

   q  q  q  q   q  q  q  q   ...   q  q  q  q     32 queries
   └──┴──┴──┘   └──┴──┴──┘         └──┴──┴──┘
       k            k        ...       k          8 KV pairs
```

Query capacity is unchanged. The cache is a quarter of the size. Quality loss is small enough
that essentially every open-weight model released since 2023 ships with it.

```python
import torch.nn as nn
import torch.nn.functional as F

class GroupedQueryAttention(nn.Module):
    """Causal self-attention with fewer KV heads than query heads."""

    def __init__(self, d_model, n_heads, n_kv_heads):
        super().__init__()
        self.n_heads, self.n_kv_heads = n_heads, n_kv_heads
        self.head_dim = d_model // n_heads
        # No biases: they cost parameters and buy nothing once you normalise.
        self.q_proj = nn.Linear(d_model, n_heads * self.head_dim, bias=False)
        self.k_proj = nn.Linear(d_model, n_kv_heads * self.head_dim, bias=False)
        self.v_proj = nn.Linear(d_model, n_kv_heads * self.head_dim, bias=False)
        self.o_proj = nn.Linear(d_model, d_model, bias=False)

    def forward(self, x):
        b, t, _ = x.shape
        q = self.q_proj(x).view(b, t, self.n_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).view(b, t, self.n_kv_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).view(b, t, self.n_kv_heads, self.head_dim).transpose(1, 2)

        # Rotary embeddings would be applied to q and k right here.
        share = self.n_heads // self.n_kv_heads
        k = k.repeat_interleave(share, dim=1)
        v = v.repeat_interleave(share, dim=1)

        out = F.scaled_dot_product_attention(q, k, v, is_causal=True)
        return self.o_proj(out.transpose(1, 2).reshape(b, t, -1))
```

## 6. Where position comes from

Attention has no idea what order anything is in. Shuffle the input and the output shuffles with
it, unchanged. "Dog bites man" and "man bites dog" are the same bag of vectors. Position has to
be injected deliberately.

The 2017 answer was a fixed sinusoidal pattern added to the embeddings, a different frequency
per dimension, so every position gets a unique signature and neighbours get similar ones.
Elegant, and now almost extinct.

The 2026 answer is **rotary position embedding**, RoPE. Instead of adding position to the input,
you rotate each pair of dimensions in q and k by an angle proportional to the position, just
before the dot product. Because a dot product between two rotated vectors depends on the
*difference* of the rotation angles, the score between position 100 and position 105 comes out
the same as between 500 and 505. Position enters as relative distance, for free, in the one
place it is actually used. It also extends to longer contexts more gracefully, which is why
scaling the RoPE frequencies is how most long-context models got long.

If you read the original post's sinusoidal code and wondered why nobody uses it, that is the
answer. Sinusoidal was fine. Relative is better.

## 7. The block as it is actually built today

The transformer block is attention plus a small feed-forward network, each wrapped in a residual
connection and a normalisation. The residual matters more than it looks: it gives gradients an
uninterrupted path from the output back to the input, which is the only reason you can stack
eighty of these.

The 2017 paper put the normalisation *after* the residual addition. Everyone now puts it
*before*.

```
2017, post-norm               2026, pre-norm

      x                             x
      │                             ├──────────────┐
  attention                      RMSNorm           │
      │                             │              │
      + ◀── x                   attention          │
      │                             │              │
  LayerNorm                         + ◀────────────┘
      │                             │
      │                             ├──────────────┐
  feed-fwd                       RMSNorm           │
      │                             │              │
      + ◀── x                   feed-fwd           │
      │                             │              │
  LayerNorm                         + ◀────────────┘
      │                             │
      y                             y
```

Look at the right-hand spine. In pre-norm there is a clean identity path from x straight to y
with nothing on it. In post-norm every residual passes through a LayerNorm, which rescales the
signal at every layer and makes deep stacks unstable at the start of training. Post-norm is why
the original recipe needed a careful warmup schedule to avoid diverging in the first thousand
steps. Pre-norm mostly removes that problem.

```python
class Block(nn.Module):
    """Pre-norm, RMSNorm, SwiGLU: the common 2026 shape."""

    def __init__(self, d_model=1024, n_heads=16, n_kv_heads=4):
        super().__init__()
        self.attn_norm = nn.RMSNorm(d_model)
        self.attn = GroupedQueryAttention(d_model, n_heads, n_kv_heads)
        self.ffn_norm = nn.RMSNorm(d_model)
        # 8/3 keeps parameters level with a 4x ReLU FFN, because SwiGLU
        # needs three matrices where ReLU needed two.
        hidden = int(8 * d_model / 3)
        self.w_gate = nn.Linear(d_model, hidden, bias=False)
        self.w_up = nn.Linear(d_model, hidden, bias=False)
        self.w_down = nn.Linear(hidden, d_model, bias=False)

    def forward(self, x):
        x = x + self.attn(self.attn_norm(x))
        h = self.ffn_norm(x)
        return x + self.w_down(F.silu(self.w_gate(h)) * self.w_up(h))
```

Two more substitutions in there. `nn.RMSNorm` (PyTorch 2.4 and later) drops the mean-centring
and the bias from LayerNorm, keeping only the rescaling, which is cheaper and loses nothing.
And the feed-forward network uses SwiGLU, a gated activation where one branch multiplies the
other, rather than a plain ReLU.

Worth knowing what that feed-forward block is doing at all, because it is roughly two thirds of
the parameters in a dense model. Attention moves information between positions. The FFN is where
each position does its own thinking, independently. In many 2026 models it is replaced by a
[mixture of experts](/posts/2025/02/moe-explained-simply/), so only a slice runs per token.

Here is the honest summary of what moved between the paper and now:

| Piece | 2017 paper | Common in 2026 |
|---|---|---|
| Norm placement | post-norm | pre-norm |
| Normaliser | LayerNorm | RMSNorm |
| Feed-forward | ReLU, 4x width | SwiGLU, ~8/3 width, no bias |
| Position | sinusoidal, absolute | RoPE, relative |
| KV heads | one per query head | grouped, 4x to 8x fewer |
| Attention kernel | materialise the matrix | fused, FlashAttention-style |
| Overall shape | encoder plus decoder | decoder-only for generation |
| FFN capacity | dense | frequently mixture of experts |

Encoder-decoder has not died, it has narrowed. Anything that generates text is decoder-only.
Encoder-only BERT-style models are still the right tool for embeddings and rerankers, and the
recipe got a proper refresh in 2024 with ModernBERT.

## 8. What it costs

The 2022 version of this post said "attention is quadratic, so keep sequences under 512". That
advice is dead. Context windows in 2026 routinely run into the hundreds of thousands of tokens.
Two things changed, and neither is what people assume.

**Memory stopped being quadratic; compute did not.** FlashAttention-style kernels compute
attention in tiles and never store the full score matrix. To see why that matters, price the
matrix you are not storing: at 128k tokens, one head's score matrix in bf16 is
`131072² × 2 bytes ≈ 34 GB`. Per head. Not materialising that is the entire trick. The
multiplications are still quadratic, so doubling your context still roughly quadruples the
attention FLOPs, but you no longer run out of memory before you run out of patience.

**The real inference cost moved to the KV cache.** Every token you have generated leaves behind
a key and a value in every layer, and they all have to stay resident. The arithmetic is simple
enough to do on a napkin:

```
bytes per token = 2 (K and V)
                x n_layers
                x n_kv_heads
                x head_dim
                x bytes per element
```

For a 70B-class model shape (80 layers, 8 KV heads after grouping, head dimension 128, bf16):

```
2 x 80 x 8 x 128 x 2 = 327,680 bytes = 320 KiB per token

128k tokens of context -> 320 KiB x 131,072 = 40 GiB
```

Forty gibibytes of cache, per sequence, before you have loaded a single weight. Batch eight
users and you need 320 GiB just for cache. Without grouped-query attention, at 64 KV heads
instead of 8, multiply by eight. This is why paged and quantised KV caches exist, why providers
price cached input tokens differently, and why "just increase the context window" is a hardware
procurement decision rather than a config change.

If you are building on top of models rather than building models, this is the number to carry:
**your context length is a memory budget, and it is spent per concurrent request.**

## 9. Five things I got wrong

Every one of these is a mistake I made, several of them in the original version of this post.

**Storing positional encodings as a plain attribute.** A bare
`self.positional_encoding = torch.zeros(...)` is neither a parameter nor a buffer, so
`model.to("cuda")` silently leaves it on the CPU and you get a device mismatch a hundred lines
away. Use `self.register_buffer("pe", pe)`.

**Asking `nn.MultiheadAttention` for the weights.** Passing `need_weights=True` disables the
fast fused path entirely, so your training run slows down for a debugging print you forgot to
remove. It also returns weights averaged over heads by default, which is rarely what you wanted;
pass `average_attn_weights=False` if you genuinely need per-head maps.

**Reading attention maps as explanations.** Attention weights show where the softmax mass went,
which is not the same as what determined the output. Models reliably dump large amounts of
attention on the first token and on punctuation, using them as a place to park probability mass
when a head has nothing to say. A pretty heatmap is a debugging aid, not evidence.

**Reaching for an exotic efficient-attention variant too early.** In 2021 there was a new
linear-attention paper every fortnight. Almost none are in production models. Standard attention
with a good fused kernel beat the clever approximations, because hardware efficiency won.
Check that `F.scaled_dot_product_attention` is really your bottleneck before you replace it.

**Believing the learning rate could be handled later.** Transformers are genuinely sensitive
here. Warmup for the first few hundred to few thousand steps, cosine decay after, AdamW, and
gradient clipping at norm 1.0. If your loss spikes and never recovers, this is the first place
to look, not the architecture.

## 10. Where to go next

- [Attention Is All You Need](https://arxiv.org/abs/1706.03762), the 2017 paper. Short, and
  more readable than its reputation.
- [The Annotated Transformer](https://nlp.seas.harvard.edu/annotated-transformer/), the paper
  reimplemented line by line.
- [nanoGPT](https://github.com/karpathy/nanoGPT), a complete, readable, trainable decoder-only
  model in a few hundred lines.
- [Transformer Explainer](https://poloclub.github.io/transformer-explainer/), an interactive
  visualisation you can poke at in a browser.
- [FlashAttention](https://arxiv.org/abs/2205.14135), [RoPE](https://arxiv.org/abs/2104.09864)
  and [grouped-query attention](https://arxiv.org/abs/2305.13245) for the three changes that
  did the most work.

## 11. The short version

- Attention is a weighted average. Score every position against a query, softmax the scores,
  blend the values. The rest is bookkeeping.
- Query, key and value are three learned views of the same vector: what I want, what I
  advertise, what I hand over. Dividing by `√d_head` is variance control so softmax stays soft.
- Write the manual version once to understand it, then use
  `F.scaled_dot_product_attention` and let the fused kernel do the work.
- The causal mask is the difference between predicting the next token and cheating. Getting it
  wrong produces a suspiciously good loss curve.
- Since 2017 the block changed in seven places: pre-norm, RMSNorm, SwiGLU, RoPE, grouped-query
  attention, fused kernels, decoder-only. The attention maths itself did not change at all.
- Memory is no longer quadratic in sequence length; compute still is. Plan for FLOPs to
  quadruple when you double the context.
- At inference the binding constraint is the KV cache, roughly 320 KiB per token for a 70B-class
  model, which is 40 GiB at 128k context, per concurrent request.
- Attention heatmaps are a debugging aid, not an explanation of the model's decision.
