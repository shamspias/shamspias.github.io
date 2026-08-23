---
title: "The Slowest Kid Problem: How a Super Captain Solves MoE's Biggest Headache"
description: "Why a mixture-of-experts layer runs at the speed of its busiest expert, how to measure it, and when predictive prefetching actually helps."
date: 2025-07-18
permalink: "/posts/2025/07/slowest-kid-moe-straggler/"
tags:
  - "mixture of experts"
  - "neural networks"
  - "performance"
  - "straggler problem"
  - "AI"
  - "machine learning"
  - "simple explanations"
series: "Mixture of Experts"
seriesOrder: 2
math: true
---

*Part 2 of the mixture-of-experts series.
[Part 1](/posts/2025/02/moe-explained-simply/) explained why only a thin slice of a big model
ever runs. This is the bill that sparsity quietly hands you: a layer finishes at the speed of
whichever expert got the most work, and I spent a year fixing the wrong half of that sentence.*

---

## 1. The group project, and why Farhan was actually slow

The school version. Four of you split a project. Rimi finishes her part in five minutes, Hasan
in seven, Hamim in eight, and Farhan takes forty-five. Nobody can submit until Farhan is done,
so the group's time is forty-five minutes and three people sat around for most of it.

That is the straggler problem, and mixture-of-experts (MoE) inference has it badly. An MoE layer
is one layer of a network split into many parallel copies of the same small network, called
experts, with a tiny classifier called a router in front choosing which two of them each token
goes to. That is how a model can hold hundreds of billions of parameters and still cost only a
few billion per token: nearly all of it sits idle on any given word.

When I first wrote this post I explained the stall with fast experts and slow experts: a quick
maths expert, a sluggish history expert. That was wrong, and getting the cause wrong sends you
to the wrong fix.

Inside one MoE layer, every expert is the *same* stack of matrices with the same shapes. Hand
each of them one token and they all finish at the same instant. There is no slow expert.

Farhan is not slow. Farhan was handed eight of the ten questions.

The router decides which expert sees which token, and routers are not fair. Some experts attract
far more tokens than others, and the layer cannot finish until the busiest one is done. Here is
one layer of a Mixtral-shaped model: 4096 tokens across 8 experts, two experts per token, which
is what "top-2" means. The numbers below are illustrative, but the *shape* is what you will see,
and section 3 gives you the code to print your own.

```
   layer 17, 4096 tokens, top-2 of 8, ideal load = 1024 tokens/expert

   E0  ████████░░░░░░░░░░░░░░░░░░░░░░░░   612
   E1  ███████████████░░░░░░░░░░░░░░░░░  1180
   E2  ██████████░░░░░░░░░░░░░░░░░░░░░░   790
   E3  ████████████░░░░░░░░░░░░░░░░░░░░   933
   E4  ████████████████████████████████  2465  <- everyone waits here
   E5  ███████░░░░░░░░░░░░░░░░░░░░░░░░░   548
   E6  ██████████████░░░░░░░░░░░░░░░░░░  1074
   E7  ████████░░░░░░░░░░░░░░░░░░░░░░░░   590

   the layer's step time is set by E4: 2465 / 1024 = 2.4x the ideal
```

Written down, with $T$ tokens, $E$ experts and top-$k$ routing:

$$
\bar{n} = \frac{kT}{E}, \qquad \text{imbalance} = \frac{\max_e n_e}{\bar{n}}
$$

The whole game is pushing that ratio towards 1. Note what it does *not* depend on: how fast any
individual expert is. You cannot fix a 2.4x imbalance by buying a faster GPU, because the faster
GPU speeds up the idle experts too.

---

## 2. Two stragglers wearing the same costume

This is the distinction the original version of this post missed entirely, and it is the one
that decides which technique you should reach for. "My MoE stalls" has two completely different
causes.

```
   a token arrives at an MoE layer
        │
        ├── experts are all in GPU memory, sharded across GPUs
        │      │
        │      └── the slowest GPU sets the step time
        │            cause: uneven token counts per expert
        │            fix:   balance routing, replicate hot experts
        │            you are limited by: an all-to-all barrier
        │
        └── experts live in CPU RAM or on NVMe, paged in on demand
               │
               └── the PCIe transfer sets the step time
                     cause: a cache miss on the expert you chose
                     fix:   predict early, prefetch, cache
                     you are limited by: about 25 GB/s of bus
```

The top branch is what a serving cluster hits. Experts are spread over many GPUs, each GPU runs
the experts it owns, and then an all-to-all collective brings every token's result home. That
collective is a barrier, so every GPU waits for the one that drew the most tokens.

The bottom branch is what your workstation hits. The model does not fit in VRAM, so experts sit
in host memory and get copied in when the router picks them. Now the enemy is not imbalance, it
is latency, and the numbers are brutal.

Take a Mixtral 8x7B expert: hidden size 4096, intermediate 14336, three matrices for the SwiGLU
feed-forward. That is $3 \times 4096 \times 14336 \approx 176$M parameters, or 352 MB at
bfloat16.

- Copying it over PCIe 4.0 x16, which delivers roughly 25 GB/s in practice: about **14 ms**.
- Reading it from HBM on an A100, at roughly 2 TB/s: about **0.17 ms**.

The bus costs about eighty times what the GPU's own memory does, and at batch size one that read
is essentially the entire cost of running the expert. With 32 layers picking 2 experts each, a
fully cold token needs 64 loads, 22.5 GB of traffic, close to a second per token. That is the
whole problem in one number.

---

## 3. Measure the one you actually have

Before optimising anything, print your router's load. Hugging Face Transformers exposes the raw
gate outputs on the MoE architectures that implement `output_router_logits`, Mixtral among them.

```python
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

name = "mistralai/Mixtral-8x7B-Instruct-v0.1"
tok = AutoTokenizer.from_pretrained(name)
model = AutoModelForCausalLM.from_pretrained(
    name, dtype=torch.bfloat16, device_map="auto"
)

prompts = [...]   # a few hundred prompts from real traffic, not toy sentences
batch = tok(prompts, return_tensors="pt", padding=True).to(model.device)
out = model(**batch, output_router_logits=True)

# One tensor per MoE layer, shape (batch * seq_len, num_experts).
for layer, logits in enumerate(out.router_logits):
    keep = batch["attention_mask"].flatten().bool()   # padding routes too; drop it
    top = logits[keep].topk(2, dim=-1).indices
    counts = torch.bincount(top.flatten(), minlength=logits.shape[-1])
    ratio = counts.max().item() / counts.float().mean().item()
    print(f"layer {layer:2d}  imbalance {ratio:.2f}  {counts.tolist()}")
```

Two notes that cost me an afternoon each. Padding tokens get routed like any other token and
will skew your counts, hence the mask. And `dtype=` is the current argument: `torch_dtype=` was
deprecated in Transformers 4.54 and still appears in most blog posts, including the first draft
of this one.

Run that over a few hundred real prompts and you get the number that matters. Imbalance near 1.2
means routing is not your problem, so go and look at your attention kernels instead. Imbalance
above 2 means half your accelerator is idle and the rest of this post is for you.

---

## 4. Balancing the barrier straggler

If your experts are all resident and the barrier is the problem, prediction does nothing for
you. Every expert is already loaded. The only lever is *who does how much work*.

**Replicate the hot experts.** If E4 draws 2.4x its share, give E4 two copies on two different
GPUs and split its tokens between them. This is the idea behind DeepSeek's
[EPLB](https://github.com/deepseek-ai/EPLB), an expert-parallel load balancer they open-sourced
in early 2025 alongside [DeepEP](https://github.com/deepseek-ai/DeepEP), their all-to-all
kernels. It computes a placement of experts (including redundant copies of popular ones) onto
GPUs so the per-GPU load is roughly even, and it recomputes that placement as traffic changes.
vLLM and SGLang both ship expert-parallel serving with balancing along these lines. The cost is
memory: every replica is a full copy of the expert's weights.

**Keep a shared expert always on.** DeepSeek-V3 routes top-8 of 256 experts and additionally
runs one shared expert on every single token. That shared expert absorbs the generic work that
would otherwise make every router fight over the same few specialists, which flattens the load
curve. It costs a slice of compute on every token, unconditionally.

**Do not drop tokens at inference.** The old fix was a capacity factor: cap each expert at, say,
1.5x its average load and discard the overflow. That is a *training-time* technique, from the
GShard and Switch Transformer era, where dropping a few tokens per batch is an acceptable
regulariser. At inference the token you drop belongs to a user's sentence. The modern default is
dropless routing with grouped matrix multiplications, as in
[MegaBlocks](https://github.com/databricks/megablocks), which handles ragged expert loads
without padding or discarding anything. My original version of this post cheerfully recommended
capacity dropping and quoted a speedup for it. Please ignore that version.

---

## 5. Captain Bilal: predicting the offload straggler away

Now the bottom branch, where the expert is on the wrong side of a PCIe cable.

The analogy still works here, and it is the good half of the original post. Imagine Bilal, the
class captain, who watches the lesson, works out which student will be called on next, and
quietly wakes them up while the current student is still talking. When their name is called they
are already standing. The waking happened during time that was going to be spent anyway.

That is prefetching, and it works only if you can predict. The reason you can is the residual
stream. In a transformer, each block *adds* to a running vector rather than replacing it (see
[the attention post](/posts/2022/06/transformers-attention-made-simple/) for the mechanics). The
hidden state entering layer $L+1$ is the hidden state leaving layer $L$ plus a comparatively
small update. Routers are simple linear maps on that vector, so two consecutive routers, looking
at two nearly identical vectors, tend to reach for the same experts.

So you can run layer $L+1$'s gate early, on layer $L$'s output, before layer $L+1$'s attention
has even run. This is the pre-gating trick.

```python
@torch.no_grad()
def predict_next_experts(hidden, next_layer, k=2):
    """Guess layer L+1's experts from the residual stream as it stands after L.

    Attention at L+1 has not run yet, so this is the router's true input minus
    one attention update. That update is small relative to the residual, which
    is exactly why the guess is usually right.
    """
    x = next_layer.post_attention_layernorm(hidden)
    logits = next_layer.block_sparse_moe.gate(x)
    return logits.topk(k, dim=-1).indices
```

Measure your own hit rate by comparing that against the real router's choice per layer. Do not
trust a number from a blog post, mine included: it depends on the checkpoint, the depth (early
layers predict worse), and how many experts you have to choose between.

Then overlap the copy with compute on a second CUDA stream.

```python
import torch
from collections import OrderedDict

copy_stream = torch.cuda.Stream()


class ExpertCache:
    """Experts live pinned in host RAM; the hot ones are mirrored on the GPU."""

    def __init__(self, host_experts, capacity):
        self.host = host_experts   # {(layer, expert): pinned CPU tensor}
        self.gpu = OrderedDict()   # LRU, at most `capacity` entries
        self.events = {}           # in-flight copies, keyed the same way
        self.capacity = capacity

    def _evict_lru(self):
        for key in list(self.gpu):
            if key not in self.events:   # a copy in flight still owns its buffer
                del self.gpu[key]
                return
        raise RuntimeError("every entry is in flight; raise capacity")

    def prefetch(self, key):
        if key in self.gpu:
            return                 # resident, or already in flight
        while len(self.gpu) >= self.capacity:
            self._evict_lru()
        with torch.cuda.stream(copy_stream):
            buf = self.host[key].to("cuda", non_blocking=True)
        event = torch.cuda.Event()
        event.record(copy_stream)
        self.gpu[key], self.events[key] = buf, event

    def get(self, key):
        if key not in self.gpu:
            self.prefetch(key)     # miss: we pay the full transfer right now
        self.gpu.move_to_end(key)  # an LRU that never records use is just FIFO
        event = self.events.pop(key, None)
        if event is not None:
            torch.cuda.current_stream().wait_event(event)
        buf = self.gpu[key]
        buf.record_stream(torch.cuda.current_stream())  # keep the alloc alive
        return buf
```

Pinned host memory is not optional. Without it `non_blocking=True` silently becomes blocking,
because the driver has to stage through a pinned bounce buffer anyway, and your careful overlap
evaporates. The `record_stream` call is the other easy mistake: the caching allocator has no
idea the tensor is being used on a different stream and will happily recycle it under you.

What you buy, in a picture:

```
   on demand, one token, expert not cached

   compute  │ attn ├── stall 14 ms ──┤ ffn │ attn ├── stall 14 ms ──┤
   PCIe     │      ├── load expert ──┤     │      ├── load expert ──┤

   pre-gated and prefetched, prediction correct

   compute  │ attn │ ffn │ attn │ ffn │ attn │ ffn │
   PCIe     ├─ load L+1 ─┼─ load L+2 ─┼─ load L+3 ─┤
```

And written down, the expected stall per expert with hit rate $h$, expert size $S$ and bus
bandwidth $B$:

$$
\mathbb{E}[t_{\text{stall}}] = (1 - h) \cdot \frac{S}{B}
$$

Three knobs, and all three are worth pulling. Raise $h$ with better prediction and a bigger
cache. Cut $S$ with 4-bit expert quantisation, which turns that 352 MB expert into 88 MB and the
14 ms into about 3.5 ms. Raise $B$ by moving experts off NVMe and into host RAM if you have it.

---

## 6. Where prefetching stops working

The failure mode nobody mentions: **prefetching is a batch-size-1 technique.**

With one token per layer you touch 2 experts of 8, so caching the right 3 or 4 wins most of the
time. With 64 tokens in a batch, the union of experts those tokens want is, with near certainty,
*all eight*. There is nothing left to predict and nothing left to cache. Every offloading trick
in this post is for local single-stream inference, and every one of them quietly stops paying as
soon as you serve real concurrent traffic. That is the point where you stop offloading and start
sharding, which puts you back on the top branch of the diagram in section 2.

The other costs, honestly:

| Technique | Fixes which straggler | What it costs |
|---|---|---|
| Load-balancing loss in training | barrier | training-time only, no help post-hoc |
| Expert replication, EPLB style | barrier | a full weight copy per replica, plus rebalancing |
| Shared always-on expert | both | compute on every token, unconditionally |
| Capacity factor with token dropping | barrier | drops a user's tokens, so no |
| Pre-gating and prefetch | offload | wrong guesses burn scarce bus bandwidth |
| LRU expert cache | offload | GPU memory, and it dies at large batch |
| 4-bit expert quantisation | offload | some quality, for 4x less traffic |

A wrong prediction is not free. You spent 14 ms of bus time loading an expert nobody wanted, and
you evicted something to make room for it. There is a break-even hit rate below which
aggressive prefetching is worse than keeping a plain LRU cache and predicting nothing. Where it
sits depends on your cache size, your bus and your model, so measure it. I am not going to hand
you a digit I have not earned.

---

## 7. What changed since 2025

I wrote the first version of this post with Mixtral in my head: 8 experts, top-2, one obvious
straggler. The models that matter now are far sparser, and that changes the arithmetic in a way
that is not obvious.

DeepSeek-V3 uses 256 routed experts per layer with top-8 routing, hidden size 7168 and an expert
intermediate size of 2048. So one expert is $3 \times 7168 \times 2048 \approx 44$M parameters,
88 MB at bfloat16, and 256 of those across 58 MoE layers is where the headline 671B comes from.

Now compare cold traffic per layer:

```
   Mixtral 8x7B     top-2 of   8    2 x 352 MB  =  704 MB per layer
   DeepSeek-V3      top-8 of 256    8 x  88 MB  =  704 MB per layer
```

Identical. Sparser models did not reduce the bytes you have to move on a cold pass. What they
changed is everything around it: your cache now has 256 slots to guess between instead of 8, so
hit rates fall; the prediction problem is picking 8 of 256 rather than 2 of 8; and the imbalance
tail is longer, because with 256 experts there is always some expert having a very good day.

Two smaller corrections to the old version. It quoted a "GPT-4 is rumoured to be MoE" line,
which was gossip then and is pointless now, because there are open MoE checkpoints on disk you
can measure directly. And it quoted a table of speedups and accuracies for various strategies
which I had made up to illustrate a point. Nothing in this rewrite is a benchmark I did not run;
where I do not have a number, I have told you how to get yours.

---

## 8. The short version

- Experts in an MoE layer are all the same size and all the same speed. The straggler is caused
  by uneven token counts, not by a slow expert.
- Measure $\max_e n_e / \bar{n}$ from the router logits before optimising anything. Under 1.2,
  look elsewhere; over 2, keep reading.
- There are two stragglers: an all-to-all barrier when experts are sharded, and a PCIe transfer
  when experts are offloaded. They need opposite fixes.
- For the barrier: balance the routing and replicate hot experts, EPLB style. Do not drop tokens
  at inference; dropless grouped GEMMs exist.
- For the transfer: the residual stream changes slowly, so layer $L+1$'s router can be run early
  on layer $L$'s output and the expert fetched on a side stream while attention runs.
- Prefetching is a batch-size-1 technique. At batch 64 you touch every expert anyway, so
  there is nothing left to predict.
- A wrong prefetch costs a full transfer plus an eviction, so there is a break-even hit rate
  below which a plain LRU cache beats a clever predictor. Measure yours.
- Cheapest real win on a workstation, before any of this: quantise the experts to 4 bits and cut
  the traffic fourfold.

*That closes the mixture-of-experts series.
[Part 1](/posts/2025/02/moe-explained-simply/) covers routing, gating and sparsity from scratch
if you want the foundations under all of this.*
