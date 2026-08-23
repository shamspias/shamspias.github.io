---
title: "From One Brain to Many: Understanding Mixture of Experts (MoE) Like You're 12"
description: "How sparse mixture-of-experts really works: per-token routing, top-k gating, load balancing, and the memory bill you pay for the compute you save."
date: 2025-02-08
permalink: "/posts/2025/02/moe-explained-simply/"
tags:
  - "mixture of experts"
  - "neural networks"
  - "AI basics"
  - "machine learning"
  - "simple explanations"
  - "educational"
  - "MoE fundamentals"
series: "Mixture of Experts"
seriesOrder: 1
math: true
---

*Part 1 of two. What a mixture-of-experts model actually does to a single token, why "one expert
per subject" is the comfortable lie in every MoE explainer including my own first draft of this
one, and the memory bill you pay for the compute you save.*

---

## 1. One brain, or many

Start with the classroom, because the classroom is genuinely the right picture for about ninety
seconds.

One student who must be excellent at maths, poetry, music, biology and Bangla grammar has a
problem: every hour spent on one is an hour not spent on the others, and the only way to be good
at all of them is to be enormous. Five students who each own one subject can cover the same
ground, and when a question arrives you only need to wake the one or two who can answer it.

That is the whole idea. A **dense** neural network runs every one of its parameters on every
input. A **sparse mixture-of-experts** network holds many parallel sub-networks, and a small
learned component decides which two or three of them run. The rest sit in memory doing nothing.

The precise version: MoE decouples **how many parameters a model has** from **how much
arithmetic it does per token**, a token being one chunk of text, usually a short word or a piece
of one. DeepSeek-V3 has 671 billion parameters and spends about 37 billion of them on any given
token. That ratio, roughly 5%, is the entire point of the architecture. Everything else in this
post is a consequence of it.

The cost, stated up front so it does not arrive as a surprise in section 7: you must still hold
all 671 billion parameters in memory. You save compute. You do not save VRAM, the memory that
sits on the GPU itself. Most of the disappointment people feel with MoE comes from expecting
otherwise.

---

## 2. An expert is a feed-forward network, not a subject specialist

Here is where the classroom analogy needs its first correction.

In a transformer, each layer does two things: attention, which lets tokens look at each other,
and a feed-forward network (FFN), which processes each token on its own. If you want the
attention half, I wrote it up in [transformers and attention made
simple](/posts/2022/06/transformers-attention-made-simple/).

An MoE model replaces the FFN, and only the FFN, with a bank of FFNs. Attention stays dense and
shared. So an "expert" is not a small model that knows about biology. It is one copy of the
feed-forward block, identical in shape to the dense one it replaced.

```
DENSE FFN BLOCK                  SPARSE MoE BLOCK (top-2 of 8)

    token                            token
      │                                │
 ┌────▼────┐                      ┌────▼────┐
 │attention│ dense, shared        │attention│ dense, shared
 └────┬────┘                      └────┬────┘
      │                                │
 ┌────▼────┐                      ┌────▼────┐
 │   FFN   │ always runs          │ router  │ Linear(d, 8)
 └────┬────┘                      └────┬────┘
      │                     ┌──────────┼──────────┐
      │                    0.60       0.40       0.00
      │                  ┌──▼──┐    ┌──▼──┐    ┌─────┐
      │                  │ E0  │    │ E2  │    │ E1  │  E3..E7
      │                  └──┬──┘    └──┬──┘    └─────┘  resident
      │                     └────┬─────┘        idle    but idle
      ▼                          ▼
   output                     output
```

This is also why Mixtral 8x7B has 46.7 billion parameters and not 56. The name suggests eight
copies of a 7B model glued together. What actually got copied is the FFN stack. Attention,
embeddings and the output head are shared, so the total lands well below eight times seven.

The vocabulary, once, so the rest of the post can use it:

| Term | What it means |
|---|---|
| **Expert** | One copy of the feed-forward block. Usually 8 to a few hundred per layer. |
| **Router** (or gate) | A single linear layer that scores every expert for every token. |
| **Top-k** | Run only the k highest-scoring experts. Typically k is 2, 4 or 8. |
| **Sparse** | Most experts do no work on any given token. |
| **Active parameters** | The parameters that actually multiply, per token. |
| **Load balancing** | Stopping the router from sending everything to its favourite expert. |

---

## 3. The router, precisely

The router is smaller than people expect. It is one matrix $W_r$ of shape $d \times N$, where
$d$ is the model width and $N$ the number of experts. For a token vector $x$ it produces $N$
scores, you keep the best $k$, and you softmax over just those $k$ to get mixing weights:

$$
y = \sum_{i \in \mathcal{T}} g_i \, E_i(x), \qquad
\mathcal{T} = \operatorname{top-}k(x W_r), \qquad
g = \operatorname{softmax}\big((x W_r)_{\mathcal{T}}\big)
$$

Worked through with real numbers. Eight experts, $k = 2$, and the router emits these logits for
one token:

```
expert      E0     E1     E2     E3     E4     E5     E6     E7
logit      2.10  -0.40   1.70   0.20  -1.30   0.90  -0.70   0.50
                                                selected: E0, E2

softmax over the two survivors only:
  exp(2.10) = 8.166        8.166 / 13.640 = 0.599
  exp(1.70) = 5.474        5.474 / 13.640 = 0.401

y = 0.60 * E0(x) + 0.40 * E2(x)
```

Two details in that arithmetic matter more than they look.

**Softmax comes after top-k, not before.** If you softmax over all eight and then take the two
biggest, your two weights are 0.40 and 0.27 and they do not sum to 1, so the FFN output is
silently scaled down and the scaling wanders around depending on how confident the router was.
Mixtral takes the softmax over the chosen k. DeepSeek-V3 uses a sigmoid per expert and then
normalises the selected ones. Either way you renormalise. The original version of this post used
raw score proportions (9 and 3 giving 0.75 and 0.25) which is intuitive and not what anyone
does.

**Nothing here is discrete in the gradient.** The top-k selection has no derivative, so
gradients reach the router only through $g_i$, the weights of experts that were actually chosen.
An expert that is never chosen receives no gradient and never improves, which is the failure
mode in section 5. Shazeer's [original sparsely-gated MoE
paper](https://arxiv.org/abs/1701.06538) added Gaussian noise to the logits to force
exploration. Most 2024-onwards models dropped the noise and handle balance directly instead.

---

## 4. Routing happens per token, per layer

This is the part that every simple explanation gets wrong, mine included, and it is worth being
blunt about because it changes what you expect from the architecture.

The router does not look at your question and pick a specialist. It looks at **one token vector,
at one layer**, and picks experts for that token. The next token in the same sentence goes
somewhere else. The same token at the next layer goes somewhere else again. A 60-layer model
with an MoE block in every layer makes 60 independent routing decisions for every single token.

```
sentence:   "the   protein   folds   in   water"

layer  4     E1      E6       E6     E1    E3
layer 12     E0      E3       E7     E0    E3
layer 27     E5      E2       E2     E5    E4

E1 and E0 are not "the grammar expert". They are wherever
function-word vectors happened to land in that layer's router.
```

So when I wrote in 2025 that Rimi is the maths expert and Hasan is the writing expert, that was
a teaching crutch that quietly misleads. Interpretability work on trained MoE models
consistently finds that experts specialise on shallow, local features: token identity,
whitespace and punctuation, numerals, a particular language's morphology. Clean topic experts
are rare and mostly wishful. Domain specialisation does appear at the level of *routing
statistics*, meaning code tokens hit a different distribution of experts than Bangla tokens do,
but no single expert owns a subject the way a person does.

Do not let this make MoE sound broken. It works extremely well. It just does not work for the
reason the classroom picture suggests, and if you go looking for the biology expert you will
waste a week.

---

## 5. Load balancing, or how experts die

Left alone, routers collapse. Early in training one expert is very slightly better, so it gets
picked slightly more, so it gets more gradient, so it gets better, so it gets picked more.
Within a few thousand steps two experts do all the work and the other six are dead weight you
are still paying to store.

Three mechanisms keep that from happening, and you will meet all three in real code.

**An auxiliary loss.** Switch Transformer's version, still the baseline, penalises the product
of how many tokens went to each expert and how much probability the router assigned it:

$$
\mathcal{L}_{\text{aux}} = \alpha \, N \sum_{i=1}^{N} f_i P_i
$$

where $f_i$ is the fraction of tokens dispatched to expert $i$ and $P_i$ the mean router
probability for it, with $\alpha$ usually 0.01. It is minimised when both are uniform. Set
$\alpha$ too high and you get balance at the cost of quality, because you are actively punishing
the router for having an opinion.

**A capacity factor, plus dropping.** Each expert gets a fixed number of slots per batch. Tokens
arriving at a full expert are dropped: they skip the FFN entirely and the residual connection
carries them through unchanged.

```
capacity = CF x (tokens in batch / num_experts)
CF = 1.25, 4096 tokens, 8 experts  ->  640 slots per expert
(that is the top-1 form; with top-k routing, multiply by k)

expert 3   ████████████████████████ 640/640   overflow: 112 dropped
expert 6   ██████████░░░░░░░░░░░░░░ 261/640
expert 1   ███░░░░░░░░░░░░░░░░░░░░░  74/640

a dropped token is not an error and nothing crashes.
the model just quietly gets worse.
```

Dropping exists because kernels want fixed-size tensors, not because it is a good idea. Modern
training stacks using grouped matrix multiplies (MegaBlocks and its descendants) run dropless,
which is strictly better and now the default.

**Aux-loss-free balancing.** DeepSeek-V3's contribution, and the one I would reach for now: keep
a per-expert bias $b_i$ that is added to the routing scores **for selection only**, never for
the gate weights. After each step, nudge $b_i$ down for overloaded experts and up for starved
ones. Balance is enforced by a controller outside the loss, so the gradient never fights the
objective. It is a small idea with a good payoff and it reads like about fifteen lines of code.

Worth naming a fourth option: [expert-choice routing](https://arxiv.org/abs/2202.09368) inverts
the problem so each expert picks its top tokens instead of each token picking experts. Balance
becomes free by construction. The catch is that a token can end up chosen by zero experts, and
during autoregressive decoding an expert cannot see future tokens to choose from, so it suits
encoders and training better than it suits generation.

---

## 6. A real MoE layer, in about fifty lines

The version below is the thing itself: correct, vectorised, and close enough to production that
the differences are kernels rather than concepts. It replaces the four separate toy models this
post used to carry.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


class Expert(nn.Module):
    """One expert is an ordinary SwiGLU FFN, same shape as the dense one."""

    def __init__(self, d_model: int, d_ff: int):
        super().__init__()
        self.gate = nn.Linear(d_model, d_ff, bias=False)
        self.up = nn.Linear(d_model, d_ff, bias=False)
        self.down = nn.Linear(d_ff, d_model, bias=False)

    def forward(self, x):
        return self.down(F.silu(self.gate(x)) * self.up(x))


class MoELayer(nn.Module):
    def __init__(self, d_model=1024, d_ff=2816, n_experts=8, top_k=2):
        super().__init__()
        self.n_experts = n_experts
        self.top_k = top_k
        self.router = nn.Linear(d_model, n_experts, bias=False)
        self.experts = nn.ModuleList(
            Expert(d_model, d_ff) for _ in range(n_experts)
        )

    def forward(self, x):
        b, t, d = x.shape
        # Tokens are the unit of routing. Sequence structure is irrelevant here.
        x = x.reshape(-1, d)
        logits = self.router(x)

        top_logits, top_idx = logits.topk(self.top_k, dim=-1)
        # Softmax over the chosen k so weights sum to 1 with no second pass.
        weights = F.softmax(top_logits, dim=-1, dtype=torch.float32).to(x.dtype)

        out = torch.zeros_like(x)
        for e, expert in enumerate(self.experts):
            tok, slot = torch.where(top_idx == e)
            if tok.numel() == 0:
                continue
            # One gather and one dense matmul per expert, not one per token.
            out.index_add_(0, tok, expert(x[tok]) * weights[tok, slot, None])

        return out.view(b, t, d), self._balance_loss(logits, top_idx)

    def _balance_loss(self, logits, top_idx, alpha=0.01):
        probs = F.softmax(logits, dim=-1)
        mean_prob = probs.mean(0)
        ones = torch.ones(top_idx.numel(), device=logits.device,
                          dtype=mean_prob.dtype)
        dispatched = torch.zeros_like(mean_prob).index_add_(
            0, top_idx.flatten(), ones
        ) / top_idx.numel()
        return alpha * self.n_experts * (dispatched * mean_prob).sum()
```

Three things to notice.

The loop is over **experts**, not tokens. The old version of this post looped over the batch and
called one expert per sample, which is correct and roughly a hundred times slower, because it
turns one large matrix multiply into thousands of tiny ones. With `n_experts` around 8 to 32 the
Python loop overhead is irrelevant next to the matmuls. Above that, or across multiple GPUs, you
want grouped-GEMM kernels and expert parallelism instead.

The auxiliary loss is returned, not added. The caller does `loss = criterion(out, y) +
sum(aux_losses)`, summing across every MoE layer. Forgetting to add it is the single most common
way a from-scratch MoE quietly collapses.

There is no capacity limit, so nothing is dropped. That is the modern default and it is one less
hyperparameter to get wrong.

---

## 7. What it actually costs

The original version of this post had a cheerful function that printed "75% less work" and I
want to take it back, because the number is measured against the wrong baseline. Top-2 of 8 does
not make a model four times cheaper than the dense model you would otherwise have trained. It
makes a model with roughly eight times the FFN parameters cost about twice the FFN compute. The
saving is against the dense model of the *same total size*, which nobody could afford to run
anyway.

Here is the honest accounting, using DeepSeek-V3 because its numbers are published.

```
DeepSeek-V3: 671B total parameters, 37B active per token

weights you must hold in memory
████████████████████████████████████████████████  671B

weights that do arithmetic on one token
██▋                                                37B

you pay                             you get
  671 GB of VRAM at fp8               compute of a ~37B dense model
  all-to-all traffic every layer      quality far above 37B dense
  a router that can collapse          cheap capacity growth
```

That first line is the one that bites. At fp8, one byte per parameter, the weights alone need
more than eight 80 GB GPUs can hold, before you make room for the KV cache that every in-flight
request keeps while it generates. This is a multi-node deployment before you have served a
single user. MoE moves your bottleneck from FLOPs to memory and interconnect, and if your
cluster is short on either, MoE makes your life worse rather than better.

The other real costs:

**All-to-all communication.** When experts live on different GPUs, every MoE layer ships tokens
to wherever their experts are and ships the results back. Twice per layer, sixty layers deep.
This is the dominant serving cost at scale, and it produces the straggler problem that [part 2
of this series](/posts/2025/07/slowest-kid-moe-straggler/) is entirely about.

**Batch size changes the economics.** Decoding one token for one user, you read only the active
experts from memory, so a sparse model can feel wonderfully fast on a single machine. That is
why a 30B model with 3B active runs pleasantly on a laptop that would choke on a 30B dense
model. Push the batch to hundreds of concurrent sequences and the tokens scatter across every
expert, so you read all the weights anyway and you are back to needing the full memory bandwidth
plus the comms overhead.

**Fine-tuning is fussier.** Sparse models overfit small datasets more readily than dense ones,
and a full fine-tune can wreck a routing distribution that took a trillion tokens to settle. In
practice people apply LoRA, a small trainable adapter bolted onto frozen weights, to the
attention layers and leave the router alone, and when they do touch the experts they use a much
lower learning rate than they would dense.

---

## 8. What people actually run, as of 2026

When I first published this post in early 2025, sparse MoE was the interesting option. It is now
simply how open frontier models are built, and dense architectures have retreated to the small
end, under roughly 30B, where holding every parameter in memory is affordable and simplicity
wins.

| Model | Total params | Active per token | Routing |
|---|---|---|---|
| Switch-C (2021) | 1.6T | ~1B | top-1 of 2048 |
| Mixtral 8x7B (2023) | 46.7B | 12.9B | top-2 of 8 |
| Mixtral 8x22B (2024) | 141B | 39B | top-2 of 8 |
| DeepSeek-V3 (2024) | 671B | 37B | top-8 of 256, plus 1 shared |
| Qwen3-30B-A3B (2025) | 30.5B | 3.3B | top-8 of 128 |
| Qwen3-235B-A22B (2025) | 235B | 22B | top-8 of 128 |
| Kimi K2 (2025) | 1T | 32B | top-8 of 384, plus 1 shared |
| gpt-oss-120b (2025) | ~117B | ~5.1B | top-4 of 128 |

Read down the routing column and you can watch the field learn something. Eight experts became
128 or more, and top-2 became top-8. This is **fine-grained expert** design, from
[DeepSeekMoE](https://arxiv.org/abs/2401.06066): make each expert smaller, activate more of
them, keep the FLOPs the same and buy an enormous increase in the number of distinct
combinations. Top-2 of 8 gives you $\binom{8}{2} = 28$ possible expert teams. Top-8 of 256 gives
you about $4 \times 10^{14}$. Same arithmetic per token, vastly more ways to specialise.

The same line of work added **shared experts**: one or two experts that every token always
passes through, absorbing the general-purpose knowledge that would otherwise have to be
duplicated across all the routed ones. DeepSeek-V3 uses one. It is a cheap idea that works.

One correction to the old version of this post. It repeated the widely circulated claim that
GPT-4 is a mixture of experts. Nobody outside OpenAI has confirmed that, then or now, and closed
models' architectures remain unpublished. Do not build an argument on it. The open models in the
table above are enough to make every point that needs making.

---

## 9. When not to reach for MoE

Being honest about the negative cases is more useful than another list of advantages.

**Your model is small.** Under about 10B parameters, the memory overhead of holding idle experts
usually costs you more than the compute sparsity saves. Train dense.

**You are memory-bound, not compute-bound.** If you already cannot fit your dense model, adding
seven idle copies of every FFN is not the fix you are looking for. Quantisation and distillation
are.

**You are fine-tuning on a small domain dataset.** A few thousand examples will not repair a
routing distribution, and may well damage one. Adapt a dense model, or use LoRA and keep the
router frozen.

**You are serving at low, spiky concurrency on one node.** MoE rewards either very high batch
throughput or single-stream local inference. The awkward middle, a handful of concurrent users
on hardware that barely fits the weights, is where it feels worst.

**You are writing the kernels yourself.** Dispatch, capacity, balance and all-to-all are each a
week of work you did not budget. Use a stack that already has them.

---

## 10. The short version

- A dense network runs every parameter on every token. An MoE network holds many copies of the
  feed-forward block and runs two or eight of them, chosen per token.
- The point is decoupling **parameter count** from **compute per token**. DeepSeek-V3 spends
  about 5% of its 671B parameters on any given token.
- You save FLOPs. You do not save memory. Every expert must be resident, so MoE trades a compute
  bottleneck for a memory and interconnect one.
- The router is one linear layer. Take top-k logits, then softmax over just those k, so the
  weights sum to 1.
- Routing is **per token, per layer**, not per question. Experts specialise on shallow features,
  not on subjects. There is no biology expert.
- Routers collapse without help. Use an auxiliary balance loss, or better, DeepSeek's
  aux-loss-free per-expert bias that keeps balance out of the gradient entirely.
- The field moved from top-2 of 8 to top-8 of 256 fine-grained experts plus a shared always-on
  expert. Same FLOPs, far more combinations.
- Skip MoE below roughly 10B parameters, when memory is already your constraint, or when you are
  fine-tuning on a small dataset.

Further reading worth your time: the [sparsely-gated MoE
paper](https://arxiv.org/abs/1701.06538) for where it started, [Switch
Transformer](https://arxiv.org/abs/2101.03961) for the simplification that made it practical,
[Mixtral](https://arxiv.org/abs/2401.04088) and [DeepSeek-V3](https://arxiv.org/abs/2412.19437)
for what current systems actually do, and Hugging Face's [MoE
explainer](https://huggingface.co/blog/moe) for a good second pass over the same ground.

*Part 2 takes the cost I glossed over here, all-to-all communication, and asks what happens when
one expert is slower than the rest: [the slowest kid
problem](/posts/2025/07/slowest-kid-moe-straggler/).*
