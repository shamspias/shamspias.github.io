---
title: "Send the Poets Home: Expert Pruning, a Student Model, and When to Pick Each"
seoTitle: "MoE Expert Pruning vs Teacher-Student for One Job"
description: "A bank rents the biggest MoE around, salary day brings a thousand customers, and the team learns what to prune, why Bangla breaks, and when to teach a student."
date: 2026-09-18
permalink: "/posts/2026/09/expert-pruning-or-student-model/"
lang: en
tags:
  - "mixture of experts"
  - "neural networks"
  - "machine learning"
  - "LLM"
  - "knowledge distillation"
  - "fine-tuning"
  - "quantization"
  - "simple explanations"
series: "Mixture of Experts"
seriesOrder: 3
math: true
---

*Part 3 of three, and this one is a story. A bank in Dhaka rents the biggest open model it can
find, because why would you talk to customers with anything less than the smartest brain
available. It works beautifully for one customer. Then salary day arrives with a thousand
customers at once, and the team spends eight weeks learning what you can delete from a
mixture-of-experts model, what you cannot, why Bangla breaks first, and how a very small
student ended up answering the phone. Every number in it is real; the bank is not.*

---

## 1. Week 1. The biggest brain money could rent

Three people at the bank matter for this story. Rafi is the engineer who read
[part 1](/posts/2025/02/moe-explained-simply/) of this series and is about to find out which
bits of it he skimmed. Tania runs customer support and has answered the question "what is the
minimum balance?" more times than she has eaten rice. Mr. Karim is the head of digital, and he
has a budget and a phrase, and the phrase is "let's do this properly."

Doing it properly, in week 1, meant the biggest model. Rafi made a table, which is how
engineers ask for money.

```
 model               total      active   per token
 ───────────────────────────────────────────────────
 Kimi K2             1T         32B      top-8 of 384
 DeepSeek-V3         671B       37B      top-8 of 256
 GLM-4.5             355B       32B
 Qwen3-235B-A22B     235B       22B      top-8 of 128
```

They wanted the trillion. The trillion needed more than a rack. They settled on
Qwen3-235B-A22B, which at one byte per weight is 235 GB and fits inside one node of eight
80 GB cards with room to spare, and whose Bangla in the demo was, honestly, lovely. Tania typed
in the question about the minimum balance. The model answered in clean, polite Bangla, quoted
the right section of the fee schedule from the retrieval layer, and offered to help with
anything else. Mr. Karim said the word "synergy" and nobody flinched. It was that good a demo.

It was a demo with one customer.

Before the story goes wrong, here is what they had rented, drawn as the building it behaves
like. Part 1 explained it properly; this is the picture to keep in your head.

![A building of seven floors standing in for 94, each floor a row of 32 cells standing for 128 rooms, eight cells lit in the accent on every floor and never the same eight, with a dashed arrow climbing the left side labelled one token, balance](/figures/school-of-experts.svg "The model is a school with 94 floors and 128 rooms on each. One word walks up the stairs, and on every floor a different eight rooms wake up to deal with it. The other 120 rooms are asleep. They still take up the building.")

Every floor is a layer. Every room is an expert, and there are 128 of them on each floor. When
a token, say the word "balance", arrives on a floor, the router (think of it as the floor
manager) wakes exactly eight rooms and lets the other 120 sleep. On the next floor, a different
eight. For the next token, a different eight again. That is why the model is cheap to run for
one customer: 22B parameters do the work while 235B sit in memory. The sleeping rooms are not
free. They are just quiet.

---

## 2. Week 4. Salary day

The chatbot launched on a Tuesday. On the first of the next month, at three minutes past ten,
salaries landed in a few hundred thousand accounts, and a thousand people opened the app at the
same time to ask whether theirs had.

Rafi's dashboard did something he had only seen in screenshots. GPU memory went to the top of
the chart and stayed there. Latency, which had been two seconds, became eleven, then forty.
Requests queued. The app timed out. Customers, being customers, retried, which is the same as
sending a second thousand. By half past ten Tania's phones were the chatbot.

Here is what had happened, and it was not that the model was slow. It was that the model was
big in a way the demo never exercised.

Every conversation a model is in the middle of keeps its **KV cache** on the GPU: the
attention keys and values for every token so far, so the next token does not have to re-read
the whole conversation from scratch. It is the model's short-term memory, one copy per
customer. For Qwen3-235B-A22B the arithmetic is public: 94 layers, 4 key-value heads of 128
dimensions, two bytes per number, so one token costs $2 \times 94 \times 4 \times 128 \times 2
= 192{,}512$ bytes, and one conversation holding 4,096 tokens of context and history keeps
0.79 GB on the card. One customer is nothing. Look at a thousand.

![Left, one stick figure with a small accent box marked 0.79 GB; middle, a grid of a thousand dots labelled 1,000 conversations in flight; right, a cloakroom drawn to scale with a grey block of 235 GB of weights, an accent stack of 789 GB of backpacks on top, and a dashed line at 640 GB marking the node](/figures/salary-day-crowd.svg "Each customer arrives with a 0.79 GB backpack, which is their conversation so far. The cloakroom holds 640 GB and the weights are already in it. A thousand backpacks do not fit, and no arrangement of the coats will change that.")

The picture is drawn to scale, and the bars below are the same arithmetic with the numbers on.

![Three bars of GPU memory for Qwen3-235B-A22B: weights at fp8 235 GB, KV cache for 100 conversations 79 GB, KV cache for 1,000 conversations 789 GB, with a dashed line at 640 GB marking one eight-card node](/figures/salary-day.svg "The weights were never the problem. A thousand conversations in flight at 4,096 tokens each need 789 GB of cache beside 235 GB of weights, and the node has 640.")

The weights, the thing everyone had worried about, were 235 GB. The thousand customers were
789 GB, and the node had 640 in total. Salary day did not fit, and no amount of clever routing
was going to make it fit, because the KV cache is attention, and part 1 said attention in an
MoE is dense and shared. The experts were never the bill. The customers were.

There was a second thing, quieter. Part 1 warned about it and Rafi had skimmed that paragraph.
Sparse models feel wonderfully cheap when one customer is talking, because only 8 of the 128
experts in each layer are read from memory. Push a thousand conversations through at once and
the tokens scatter across every expert, so every expert is read anyway. The model that spends
22B parameters per token was, at 10:03, moving all 235B of them through the memory bus for
every step, for every customer. The sparsity that made the demo fast was gone precisely when
it was needed.

Mr. Karim's first answer was the honest one: buy a second node. Then a third for headroom.
Finance asked how many nodes salary day would want next year, and nobody knew, and the meeting
went quiet in the way meetings do when the answer is a number with too many zeros.

Rafi, who had been staring at the table from week 1, said the thing out loud. "We are running
a school with 128 teachers on every one of 94 floors, so that a thousand people can ask what
their balance is."

---

## 3. Week 5. The meeting where someone said "send the poets home"

Mr. Karim had read the same explainers everyone has read. "The experts," he said. "One does
maths, one does poetry, one does cooking. We are a bank. Send the poets home. Keep the ones
that know about money."

It is a wonderful sentence and Rafi wished it were true, because the fix would take an
afternoon. Two facts from part 1 decide why it is not, so here they are in one breath.

Routing is per token, per layer. A 94-layer model makes 94 independent choices for every
token, and the word "poem" is not sent to a poetry department. It is sent wherever vectors that
look like it happened to land in that layer's router. And experts specialise on shallow
structure, not on subjects. The [Mixtral paper](https://arxiv.org/abs/2401.04088) went looking
for topic specialists across arXiv, biology, philosophy and code and wrote, with visible
surprise: "we do not observe obvious patterns in the assignment of experts based on the topic."
What it found instead was structural. At layer 15, between 23.6% and 28.4% of consecutive
tokens went to the same expert, against 12.5% if the router were rolling dice.

![Left, four doors labelled maths, poetry, cooking and money, the poetry and cooking doors outlined in the accent with a go home tag; right, the sentence what is my balance above three floors of ten rooms, with the two rooms the word balance wakes lit on each floor in a different place](/figures/poets-home.svg "The myth on the left: one room per subject, so send two of them home. The reality on the right: the word balance wakes two rooms on floor 1, two different rooms on floor 2, two more on floor 3, and the other words in the sentence are knocking elsewhere the whole time. There is no door marked poetry.")

So there is no poetry expert to send home. But Rafi said something else, and it is the
sentence that made the next three weeks happen. "There is no poetry expert. But there *is* a
usage table."

Run a month of the bank's real traffic through the model and count. For every layer, how many
tokens did each expert see, and with what weight?

![Left, sixteen horizontal bars of how many tokens per thousand woke each room on one floor, five of them tiny and marked swept in the accent; right, the same floor as a four by four grid with five rooms drawn as dotted outlines labelled gone](/figures/usage-broom.svg "One floor, one month, one broom. Seven rooms did nearly all the work; five were opened by about one token in a thousand. Sweep those five and the floor manager still has eleven rooms to choose eight from. The numbers are a sketch of the shape, not a measurement; the shape is what every real usage table looks like.")

Those five are what you can delete. They may or may not be "about" anything. It does not
matter. On this traffic the router almost never picked them, so removing them changes almost
nothing a customer will ever see, and the memory they took is freed. That is **expert
pruning**, and the correct version of Mr. Karim's sentence is: "Let us find out which experts
our customers never use, and delete those."

The idea is older than most people think. Chen and colleagues wrote it up in 2022 as
[task-specific expert pruning](https://arxiv.org/abs/2206.00277): fine-tune a sparse model on
one task, drop the least-used experts progressively as you go, and keep going until one expert
is left per layer. The result is a plain dense model, and they reported that it "could
preserve 99.3% benefits from MoE across six different types of tasks while enjoying 2x
inference speed." A whole school, reduced to one teacher, for one job. The versions people run
on today's models stop well short of one, but the logic is the same, and Rafi went off to do
it.

---

## 4. Week 6. Rafi prunes

![Six numbered boxes from collect to verify, each with a note on the right: collect real traffic, trace the routing, score each expert, choose survivors per layer, rewire and heal, verify against the full model](/figures/expert-pruning-recipe.svg "The whole recipe. Steps 4 and 6 decide whether the result is any good, and step 6 is the one that gets skipped because the memory number already went down.")

**Collect the calibration traffic.** Real questions, in the languages and proportions you
actually serve, with the retrieved context attached the way it will be at serving time. No
answers are needed, which is the first big difference from what comes later in this story:
pruning only has to *watch*, and watching is cheap. A few hundred thousand tokens is plenty.
The Mixtral study I lean on below used 128 sequences of 2,048 tokens, about 262,000 tokens in
all, and got stable choices from it. The one thing this set must not be is "whatever English
web text the pruning script shipped with," and section 5 is about why.

**Trace the routing.** Run the model over that traffic once with a hook on every MoE layer
that records, per token, which experts were chosen and with what gate weight. The `MoELayer`
from part 1 computes all of this in its `forward`; you are logging `top_idx` and `weights`,
and optionally the norm of each chosen expert's output.

**Score every expert.** Three families of score, in increasing order of cost and honesty.

Frequency: the share of tokens that picked expert $i$ at all.

$$
f_i = \frac{1}{T}\sum_{t=1}^{T} \mathbb{1}\!\left[i \in \mathcal{T}_t\right]
$$

Router-weighted activation, which is what Cerebras's [REAP](https://arxiv.org/abs/2510.13999)
uses: over the tokens $X_i$ that were routed to expert $i$, the average of the gate weight
times how much the expert actually said.

$$
s_i = \frac{1}{|X_i|}\sum_{x \in X_i} g_i(x)\,\bigl\lVert E_i(x) \bigr\rVert_2
$$

Reconstruction: for a candidate set of survivors $\mathcal{S}$, run the layer with only those
experts and measure how far its output moved on the calibration tokens. Keep the set that
moved it least.

$$
\mathcal{S}^{*} = \arg\min_{|\mathcal{S}| = r}\;\sum_{t}\bigl\lVert y_t - y_t^{(\mathcal{S})}\bigr\rVert
$$

Reconstruction is the only score that measures the thing you care about directly, and it is
what Lu and colleagues used in [Not All Experts are
Equal](https://arxiv.org/abs/2402.14800): enumerate every subset per layer and keep the one
with the smallest error. That is affordable at Mixtral's scale. Keep 6 of 8 and there are
$\binom{8}{6} = 28$ subsets per layer to try. It is not affordable on the bank's model. Keep
64 of 128 and there are $\binom{128}{64} \approx 2.4 \times 10^{37}$, which is why REAP
exists: a per-expert score you can sort, with a bound on the reconstruction error it implies.

**Choose survivors, per layer.** Sort by score, keep the top $r$, and let $r$ differ from
layer to layer if the scores say so; a layer whose experts are all busy deserves more
survivors than one where two experts do everything. Two rules have no exceptions. Never delete
a **shared expert**, the always-on one from part 1, because every token passes through it and
it holds exactly the general knowledge you are trying to keep. And never keep fewer than $k$
routed experts in a layer, because a top-$k$ router with fewer than $k$ candidates is a bug,
not a model.

**Rewire, then heal.** Deleting an expert means deleting its three weight matrices and the
matching row of the router. The router now scores only survivors, takes top-$k$ among them,
and the softmax over the chosen $k$ renormalises exactly as in part 1. What changes is that
every token which used to love a deleted expert now goes to its second choice at full weight,
and that is the damage. Most of it can be healed with a short fine-tune on your own data: LoRA
on attention and on the surviving experts, a low learning rate, a few thousand steps. In the
Mixtral study, after a fine-tune on maths data, the model with 7 experts scored 81.20 on
GSM8K against 81.35 for the one that kept all 8, and the 6-expert model scored 80.06. The gap
that pruning opened closed almost entirely once the survivors were allowed to adjust.

**Verify against the full model.** On held-out questions, per intent and per language, side by
side with the unpruned model. Not against a benchmark, against *your* traffic. This is the step
that gets skipped because the pruning "worked" and the memory number went down, and it is the
only step that tells you what you paid. Hold that thought until section 5.

Why the recipe keeps saying *your* traffic is decided by the figure below. Same model, same
number of experts removed, same method. The only thing that differs between a plain bar and
the accented one under it is what text the pruner watched while choosing.

![Five bars of GSM8K accuracy for Mixtral 8x7B: all 8 experts 58.61, keep 6 watching web text 41.02, keep 6 watching maths 51.25, keep 4 watching web text 24.87, keep 4 watching maths 37.07](/figures/pruning-calibration-gsm8k.svg "Lu et al., Table 3. Watch maths while choosing and you keep ten more points of maths ability, at both sizes. Watch generic web text and the pruner deletes experts that maths tokens were quietly relying on.")

Keep 6 of 8 and the model that watched web text scores 41.02 on GSM8K, against 51.25 for the
model that watched maths problems while choosing. Keep 4 of 8 and it is 24.87 against 37.07.
Nothing about the algorithm changed. For a bank, "watch maths" means "watch bank questions in
the languages your customers use," and the ten-point gap is what you buy by bothering.

The memory side of the same study: removing 2 of 8 experts cut Mixtral 8x7B's memory by about
24% and made inference 1.20 times faster; removing 4 of 8 cut it by about 48% at 1.27 times.
Notice how modest the speed number is. Pruning is a memory technique. If you needed compute
you already had it, because only $k$ experts ever run.

REAP pushed the same idea onto fine-grained models like the bank's. They pruned half the
experts from models between 20B and a trillion parameters, Qwen3-Coder-480B and Kimi K2 among
them, and report "near-lossless compression on code generation tasks" at that 50%. Their other
finding is worth carrying with you. They compared pruning with **merging**, where you average
similar experts into one instead of deleting any, and concluded that "expert pruning is a
superior strategy for generative tasks," because merging loses the fine-grained routing control
that made the model good at generating in the first place.

One more knob that is not pruning but lives next to it. Lu and colleagues also **skip** experts
dynamically: at inference, if the second-chosen expert's weight is below some fraction $\beta$
of the first's, do not run it. That gave them another 1.08 to 1.33 times in speed at what they
call negligible loss. It saves compute, not memory, so it would not have helped on salary day,
but it is nearly free once the routing trace exists.

Here is the tracing and choosing, in the form that is easy to read. It uses the `MoELayer`
from part 1 and re-runs each chosen expert inside the hook, which doubles expert compute during
calibration and is the price of keeping the code short.

```python
import torch
import torch.nn.functional as F


@torch.no_grad()
def trace_saliency(model, calib_batches, n_layers, n_experts):
    """REAP-style score per expert per layer: mean of gate weight x output norm
    over the tokens routed to that expert. Also returns the raw token counts."""
    score = torch.zeros(n_layers, n_experts)
    count = torch.zeros(n_layers, n_experts)
    hooks = []

    for l, layer in enumerate(model.moe_layers):
        def hook(mod, inputs, output, l=l):
            x = inputs[0].reshape(-1, inputs[0].shape[-1])
            top_logits, top_idx = mod.router(x).topk(mod.top_k, dim=-1)
            w = F.softmax(top_logits.float(), dim=-1)
            for e in range(n_experts):
                tok, slot = torch.where(top_idx == e)
                if tok.numel() == 0:
                    continue
                norms = mod.experts[e](x[tok]).float().norm(dim=-1)
                score[l, e] += (w[tok, slot] * norms).sum().cpu()
                count[l, e] += tok.numel()
        hooks.append(layer.register_forward_hook(hook))

    for batch in calib_batches:
        model(batch)
    for h in hooks:
        h.remove()
    return score / count.clamp(min=1), count


def choose_survivors(score, keep):
    """Top `keep` experts per layer. Shared experts are not in `score`; they never leave."""
    return score.topk(keep, dim=-1).indices.sort(dim=-1).values


def prune_layer(layer, survivors):
    keep = survivors.tolist()
    layer.experts = torch.nn.ModuleList(layer.experts[i] for i in keep)
    W = layer.router.weight.data                    # shape (n_experts, d_model)
    layer.router = torch.nn.Linear(W.shape[1], len(keep), bias=False)
    layer.router.weight.data = W[keep].clone()      # the survivors' rows, same order
    layer.n_experts = len(keep)
```

Three notes. The mean in `trace_saliency` is REAP's choice, and it means a rarely used expert
with large outputs scores well; if you want plain usage to count too, multiply by
`count / count.sum()` before sorting. `choose_survivors` takes one `keep` for every layer, and
a per-layer tensor is a two-line change. And `prune_layer` slices the router by *rows*
because `nn.Linear(d, n_experts)` stores its weight as `(out, in)`; get that transposed and the
model will run, produce fluent nonsense, and cost you a day. Rafi lost that day. It is why the
comment is there.

By Thursday he had it. Half the experts gone in every layer, chosen on a month of real
traffic. The weights had dropped by a little over half. He quantised the survivors to four
bits on top, and the whole thing now sat on two cards instead of eight. The English test set
agreed with the full model on nearly every question. He sent Mr. Karim a screenshot of the
memory graph and went home early for the first time in a month.

---

## 5. Week 6, Friday. The demo where Bangla broke

Tania asked the pruned model the minimum-balance question, in Bangla, in front of everyone.

The answer came back in Bangla for a sentence and a half. Then it switched to English. Then it
produced a word that was not in either language, quoted a minimum balance the bank has never
charged, and closed politely. Rafi's stomach did a thing. Mr. Karim, to his credit, said only
"hm."

The English tests had been telling the truth. The model's English was fine. Its Bangla had
been the thinnest thing in it from the start, and three separate mechanisms had just made it
thinner. People usually notice only the third, so here are all three.

**The router never sees the word.** Before anything is routed, the text is cut into tokens by
a vocabulary that was built mostly by counting English. I took six questions a customer might
ask, wrote each in English and in Bangla, and counted tokens with three small models' own
`tokenizer.json`. Small models, because they come back in the next section, but the shape is
the same at every size.

Start with one word, the Bangla word for "savings", six letters long, and watch three pairs of
scissors go at it.

![The Bangla word for savings in large type, then three rows: Gemma 3 cuts it into three syllable pieces, Qwen3 into six byte fragments, Llama 3.2 into nine, each piece with an arrow down to a different expert number](/figures/bangla-confetti.svg "The same word, as each tokenizer actually cuts it. Gemma 3 sees three syllables. Qwen3 and Llama 3.2 see six and nine pieces that are not letters in any language, and each piece is routed on its own. These are the real pieces from each model's tokenizer.json, not a drawing of the idea.")

Now the same thing for six whole questions, counted.

![Grouped bars, three tokenizers: English is 118 tokens for all three, Bangla is 120 tokens on Gemma 3, 468 on Qwen3 and 534 on Llama 3.2](/figures/bangla-tokens.svg "Six banking questions, 106 English words and 83 Bangla words, counted with each model's own tokenizer.json. The English bars are identical. The Bangla bars are the same sentences, in a different alphabet.")

In English the three agree: 118 tokens for 106 words. In Bangla, Gemma 3's 262,000-entry
vocabulary spends 120 tokens on 83 words, about 1.4 per word. Qwen3 spends 468 and Llama 3.2
spends 534, between five and six tokens per word. Look at what those tokens are. For the
Bangla word for "savings," six letters long, Gemma emits three pieces that are each a syllable.
Llama emits nine byte fragments that print as `à¦` and `¸`, which are not letters in any
language. The router in every layer sees those fragments one at a time. It cannot route "the
word for savings," because no such token exists. Whatever routing structure the model learned
for Bangla, it learned over confetti, and every layer's usage table for Bangla is a table of
confetti.

**No expert holds a language.** This is the point the classroom picture hides best, and it is
the one Rafi had been quietly counting on. You might hope Bangla lives in a few experts, so
that a careful pruner could simply keep those. The people who trained ST-MoE, a
269-billion-parameter sparse model, hoped so too, and [wrote down what they
found](https://arxiv.org/abs/2202.08906): "One might expect experts to specialize in
languages, which appears as a natural criterion for divvying up batches of data among experts.
However, we find no evidence of language specialization." Their explanation is the load
balancing from part 1, section 5. Each batch holds only a few languages, the balance loss
insists that every expert take its share of every batch, so "all experts are encouraged to
handle tokens from all languages."

A language, then, is not in any expert. It is spread across all of them, at low weight, in
tokenised confetti. Now put that next to a usage table built from a month of traffic that was,
because the launch had been in English first, mostly English.

```
one layer, 12 experts, share of each language's tokens (illustrative)

          E0  E1  E2  E3  E4  E5  E6  E7  E8  E9  E10 E11
English   ███ ██▌ ▌   ███ ▎   ▏   ██  ▏   ▏   ▎   ▏   ██▌
Bangla    ▌   ▌   ▌   ▌   ▌   ▎   ▌   ▌   ▎   ▌   ▌   ▌

prune by usage, keep 6   ->   E0 E1 E3 E6 E11, plus one more

English keeps nearly all of its support.
Bangla loses half of a support that was already thin,
in every layer, ninety-four times over.
```

You cannot protect Bangla by choosing which experts to keep, because there is no expert that
has it. The experts that carry the most of it are, by construction, the least-used ones on an
English-heavy calibration set, and those are precisely the ones the pruner deletes. Putting
more Bangla into the calibration set helps, and Lu's maths result above is exactly that
effect. But pruning keeps at best what was there, and what was there was thin.

**Quantisation cuts the same languages.** Rafi had squeezed the survivors to four bits to get
onto two cards, and quantisation is not neutral across scripts either. Cohere's study of
[quantised multilingual models](https://arxiv.org/abs/2407.03211) found that "languages are
disparately affected by quantization, with non-Latin script languages impacted worst," and,
worse for anyone who trusts a dashboard, that "a 1.7% average drop in Japanese across automatic
tasks corresponds to a 16.0% drop reported by human evaluators on realistic prompts." The
English benchmark said the 4-bit model was fine. Tania, writing in a non-Latin script, was the
human evaluator.

Stack the three. A language the tokenizer shreds, routed thinly across experts that a usage
table marks as idle, in a model squeezed to four bits. That is what stood in front of Mr.
Karim on Friday. It is not that pruning is bad. Pruning can only *keep*, and for this job the
bank needed something the big model could *give*.

---

## 6. Week 7. Tania's whiteboard

Tania had been quiet through the technical parts. On Monday she came in with a whiteboard.

"Our customers ask the same three hundred things," she said, "in about three thousand ways.
I know, because I have answered all of them. We do not need a model that knows everything. We
need one that knows *these*, in Bangla, and knows to hand over when it does not."

Rafi looked at the whiteboard for a while, and then at the big model, which was still sitting
on its node, perfect, one customer at a time. And the two ideas met.

![Four stations left to right: a stack of question cards marked 9,000 questions, a box for the 235B teacher with a small RAG tag reading section 4.2, four answer rows checked by people with one marked drop, and an accent box for the 4B student reading the checked book](/figures/answer-book.svg "The head teacher answers every question with the fee schedule open, people read the answers and throw out the wrong ones, and the student learns from what is left. The student never meets a question the teacher did not answer first.")

Do not shrink the school. Ask the head teacher, the big model, to write the answer to every
question a customer could ask: in Bangla, in English, in the mix people actually type, using
the bank's own documents. Check the answers. Then train one small model on that answer book.
The small model never needs to know poetry. It needs to answer *these* questions the way the
head teacher would have, and that is a far smaller thing to know.

This has a name, [knowledge distillation](https://arxiv.org/abs/1503.02531), and the flavour
here is the simplest one, [sequence-level distillation](https://arxiv.org/abs/1606.07947):
the student trains on the teacher's finished answers, not on its probabilities. Training on the
probabilities is better when you can, but it needs an open-weight teacher that shares the
student's tokenizer, and you have just watched a section about tokenizers. Answers work with
any teacher.

![Seven numbered boxes from ask to compare: write the questions, answer them with the teacher and the same RAG, check every answer, build the dataset, pick a student by its tokenizer, LoRA fine-tune, compare student with teacher per language](/figures/teacher-student-recipe.svg "Steps 3 and 7 are the checks. Skip 3 and every wrong answer in the book is taught a thousand times. Skip 7 and you find out from customers, which the bank had already tried once.")

**Write the questions.** This is where the money goes, and it should. Sources, in order of
value: real support transcripts with every name, number and account stripped, the way
[the PII post](/posts/2025/09/sensitive-data-pii-secrets/) describes; Tania's scripts and the
FAQ; and then paraphrases, which the teacher will happily write for you, ten per question, in
Bangla, in English, and in romanised Bangla typed on a phone with the spelling that implies.
Build a coverage grid, intents down the side and languages and phrasings across the top, and
fill every cell. Add the questions you do *not* want answered: someone else's balance, a
request to ignore the instructions, a loan application the bot has no authority to process.
Those rows get a refusal or a hand-off to a person as their answer, and they matter as much as
the rest.

How many? Stanford's [Alpaca](https://crfm.stanford.edu/2023/03/13/alpaca.html) taught a 7B
model to follow instructions from 52,000 examples, and generating them "costed less than $500
using the OpenAI API." [LIMA](https://arxiv.org/abs/2305.11206) showed that a thousand
carefully chosen examples go a surprisingly long way. For one bank's support, ten to fifty
thousand rows is the range, and the quality of each row matters more than which end of the
range you land on. Tania's three hundred questions, times ten phrasings, times three
languages, is nine thousand before a single transcript is opened.

**Answer with the teacher, through the same RAG.** For every question, retrieve the context the
way the deployed system will, put it in the exact prompt shape the student will see, and let
the teacher answer. This one detail decides whether the student is useful. If the teacher
answers from its own memory, the student learns to answer from *its* memory, and the day the
bank changes its transfer fee the student is confidently wrong forever. Train it to answer
from the context in front of it, and updating the bot becomes updating a document.

Which teacher? The bank already had one: the 235B model, still on its node, and finally with a
job it was the right size for. If you are renting instead, use the best model you can reach
that is good at your language and whose terms allow it. The Alpaca team had to note that their
data "is based on OpenAI's text-davinci-003, whose terms of use prohibit developing models
that compete with OpenAI," and that clause has relatives in most closed providers' terms. Read
yours. Open-weight teachers such as DeepSeek-V3, Qwen3-235B-A22B, GLM-4.5 or Kimi K2 make the
question go away.

**Check every answer.** A wrong answer in the book is taught a thousand times, so nothing goes
in unchecked. First a second model, with a rubric: is the answer supported by the context, is
it in the customer's language, is it polite, did it refuse when it should have, did it invent a
fee. Then people, on a random sample and on every refusal and hand-off row, because those are
the ones a rubric grades badly. Anything that fails is dropped, not fixed by hand, unless a
person is willing to own the fix. Tania's team spent a week on this, reading answers between
calls, and it is the week that made the rest work. The [post on knowing whether it
works](/posts/2026/08/do-you-know-if-it-works/) is about exactly this discipline.

**Build the dataset, in the serving format.** One row is one conversation: the system prompt
the bot will actually run with, the retrieved context, the question, the checked answer. On
disk it is one JSON line; here it is shown as Python so it fits on the page.

```python
row = {"messages": [
    {"role": "system", "content": (
        "You are the support assistant of Example Bank. Answer only from the context. "
        "If the context does not answer the question, say so and offer a human agent. "
        "Reply in the customer's language.")},
    {"role": "user", "content": (
        "Context:\n[Fees and Charges, section 4.2] A savings account must keep a minimum "
        "balance of Tk 500. ...\n\n"
        "Question: সেভিংস অ্যাকাউন্টের সর্বনিম্ন ব্যালেন্স কত?")},
    {"role": "assistant", "content": (
        "সেভিংস অ্যাকাউন্টে সর্বনিম্ন ৫০০ টাকা রাখতে হয়। এর নিচে নামলে ...")},
]}
```

Split the held-out set by *intent*, not by row. Ten paraphrases of one question, nine in
training and one in test, is a leak that makes every number you measure afterwards a lie.

**Pick the student by its tokenizer.** Two to four billion parameters. Gemma 3 4B is the
obvious candidate for Bangla on the figure above, and Google describes it as supporting "over
140 languages"; Qwen3 4B and Llama 3.2 3B are excellent models that would spend five tokens
on every Bangla word. Measure before you choose. Then ask the untrained student twenty of your
questions in Bangla and read the answers, because a tokenizer that handles the script is
necessary and not sufficient.

**Train with LoRA.** [LoRA](https://arxiv.org/abs/2106.09685) freezes the student and trains a
small low-rank adapter beside each weight matrix, which is exactly the right amount of change
for "answer these questions this way" and leaves the model's language intact. The paper's
headline was a ten-thousand-fold cut in trainable parameters against full fine-tuning of
GPT-3, and the practical consequence is that a 4B student trains on one 24 GB GPU.

```python
import torch
from datasets import load_dataset
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer
from trl import SFTConfig, SFTTrainer

base = "google/gemma-3-4b-it"
tok = AutoTokenizer.from_pretrained(base)
model = AutoModelForCausalLM.from_pretrained(base, dtype=torch.bfloat16, device_map="auto")

# One row per checked conversation: system, user (context + question), assistant (answer).
data = load_dataset("json", data_files={"train": "bank_train.jsonl", "eval": "bank_eval.jsonl"})

lora = LoraConfig(
    r=16, lora_alpha=32, lora_dropout=0.05, task_type="CAUSAL_LM",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
)
args = SFTConfig(
    output_dir="bank-student",
    num_train_epochs=2, learning_rate=1e-4, warmup_ratio=0.03,
    per_device_train_batch_size=4, gradient_accumulation_steps=8,
    max_length=4096, bf16=True,
    assistant_only_loss=True,      # learn the answer, not the context or the question
    eval_strategy="steps", eval_steps=200, logging_steps=20,
)
trainer = SFTTrainer(
    model=model, args=args, peft_config=lora, processing_class=tok,
    train_dataset=data["train"], eval_dataset=data["eval"],
)
trainer.train()
trainer.model.merge_and_unload().save_pretrained("bank-student-merged")
```

Rank 16 and two epochs at a learning rate of 1e-4 is a sensible first run, not a law. The
setting that is not optional is `assistant_only_loss`. Without it the student spends its
gradient learning to predict the bank's own policy documents back to itself, which it will be
handed at serving time anyway.

**Compare with the teacher, then quantise, then compare again.** On the held-out intents, the
same judge rubric, student against teacher, per language. Agreement in the high nineties on
in-scope questions is normal for a student trained on a checked book; a gap concentrated in
Bangla means the book was thin there, and the fix is more rows, not more epochs. Then quantise,
and run the Bangla evaluation again, because of the Cohere result above. If 4-bit costs you
Bangla, ship 8-bit or bf16. That is what a 4B student is *for*.

![Five bars of gigabytes: Mixtral 8x7B all 8 experts 93, 6 of 8 experts 71, 4 of 8 experts 49, Gemma 3 4B student at bf16 9, at 4-bit 3](/figures/memory-ladder.svg "Bytes per parameter is arithmetic. The two pruned rows use the 24% and 48% Lu et al. measured on this model. Pruning moved the model within the rack. The student moved it to a laptop.")

Mixtral 8x7B's 46.7 billion parameters are 93 GB at two bytes each. Pruning to 6 of 8 experts
makes that about 71 GB, and 4 of 8 about 49 GB, still a multi-GPU machine. Gemma 3 4B is about
9 GB at bf16 and under 3 GB at 4 bits. That is the difference between the two routes in one
picture: pruning moves the model within the rack, and the student moves it out of the building.

Two limits to be plain about. The student knows the book and nothing else, so anything off the
book must have a row that teaches it to say so and hand over. And the student is only as good as
the check in step 3; there is no later step that catches a wrong answer taught with confidence.

---

## 7. Which route, when

The bank's story is one path through a decision that other teams take differently, so here is
the decision on its own.

![A flowchart of three questions with yes and no branches: does the job need the whole model, how much smaller must it get, can you write down the questions, ending in keep the big model, prune experts, prune hard or pick a smaller MoE, and teach a student](/figures/choose-your-route.svg "Put a finger on the top box and follow it. The bank answers no, ten times or more, yes, and lands on the student.")

The same decision as a table, for the cases the flowchart cannot hold.

```
                     prune experts               teacher and student
 ──────────────────────────────────────────────────────────────────────
 you need            traffic, one GPU pass       questions, a teacher,
                                                 a checker, held-out set
 you get             the same model, 1.2x to     a new model, 10x to
                     2x smaller                  100x smaller
 breadth             mostly kept                 only what the book holds
 your language       whatever survived the cut   whatever the student's
                                                 tokenizer holds
 time to a result    a day                       one to three weeks
 quiet failure       quality loss on rare        a confident wrong answer
                     inputs, per language        on an unseen question
 how you find out    held-out vs the full model  held-out vs the teacher,
                                                 per language
```

**Prune** when the job is broad but the hardware is short by a small factor. An internal
assistant for engineers, in English, on a box that holds three quarters of the model: prune a
quarter of the experts on the engineers' own traffic, heal, verify, done in a day. Prune when
you cannot write the questions down because there is no fixed list, which is most agentic and
coding work, and where REAP's 50% on code models is the reference point.

**Teach a student** when the job is one job, you can enumerate it, and the hardware is short
by ten times or more. Customer support, form filling, one product's documentation, anything
with an intent list. And teach a student whenever the language is one that small models
tokenise badly or quantisation hurts, because the student is the only route on which you get
to *choose* a model that handles the script and to decide how many bits it keeps. The bank is
this case three times over.

**Do both** when the teacher is the expensive part. Writing fifty thousand answers with a
trillion-parameter model is a real bill; prune that model on your traffic first and write the
book with the pruned version. And keep the big model around as the tier the student hands off
to, so "I do not know, let me pass you on" has somewhere to go that is not a person every
time.

**Do neither** when a stock model already fits. If Qwen3-30B-A3B at 8 bits sits in your one
GPU with room for the KV cache your customers actually need, and its Bangla is acceptable on
your twenty questions, run it with good retrieval and spend the month on the retrieval instead.
Pruning and distillation are what you do when the model you want does not fit. They are not a
rite of passage.

---

## 8. Week 8. What they shipped

The student went live on the first of the following month. Gemma 3 4B, trained on eleven
thousand checked rows, served at 8 bits because 4 bits had cost it two points in Bangla and
Tania would not have it. Nine gigabytes of weights, so every 24 GB card holds a full copy with
room for a few dozen conversations beside it, and when salary day comes you add cards the way
a branch adds tellers. The KV cache that broke the node in week 4 is a fraction of the size
per conversation on a 4B model, and it is spread across cheap cards instead of stacked on
expensive ones.

![Left, a grid of a thousand dots for the customers; middle, four accent cards each labelled student, 9 GB on a 24 GB card, with the line 19 in 20 answered in Bangla under 2 seconds; right, a grey box for the big model, one node, one customer at a time, joined by a dashed line reading 1 in 20 goes up to it](/figures/what-they-shipped.svg "Salary day, second attempt. The crowd hits a row of cheap cards, each holding a whole copy of the student. Nineteen in twenty are answered there. The twentieth goes up the stairs to the big model, which now has exactly the job it was good at in the demo.")

The big model did not go home. It sits on its node, one customer at a time, exactly the job it
was good at in the demo, and the student hands over to it for the questions that are not in
the book. About one conversation in twenty goes up. The rest never leave the card.

At three minutes past ten, a thousand people asked whether their salary had arrived. It had.
The bot said so, in Bangla, in under two seconds, and Tania's phones stayed quiet. Mr. Karim
did not say "synergy." He said "hm," but the good kind.

And here is the whole eight weeks in one look, for anyone who skipped to the end.

![Seven boxes, one per week of the story: the biggest brain, salary day, the meeting, pruning, the Bangla demo, the answer book, the student](/figures/bank-story.svg "The whole story in one look. The two accented rows are the two bad days, which were also the only days anything was learned.")

---

## 9. The short version

- There is no poetry expert. Routing is per token, per layer, over shallow structure, so
  "send the poets home" means "delete the experts my traffic never wakes," which is measurable
  and real.
- Salary day is KV cache, not weights. A thousand conversations at 4,096 tokens on
  Qwen3-235B-A22B need 789 GB of cache beside 235 GB of weights, and at that concurrency every
  expert is read anyway, so the sparsity that made the demo fast is gone when it is needed.
- Expert pruning: collect real traffic, trace routing, score experts by frequency, by gate
  weight times activation norm, or by reconstruction error, keep the top few per layer, never
  touch a shared expert, rewire the router, heal with a short LoRA fine-tune, verify against
  the full model.
- It buys memory, about 24% for 2 of 8 experts and 48% for 4 of 8 on Mixtral, and only a
  little speed. Half the experts of a 480B code model went with near-lossless results in
  REAP. Pruning beats merging for generation.
- What the pruner watches decides what survives. Maths calibration kept ten more GSM8K points
  than web text at the same size. Calibrate on your traffic, in every language you serve.
- Pruning cannot protect a language, because no expert holds one. Bangla is shredded by an
  English-built tokenizer, five to six tokens per word on Qwen3 and Llama 3.2 against 1.4 on
  Gemma 3, spread thinly across every expert, and then hit hardest by quantisation.
- Teacher and student: write every question, answer with the big model through the same RAG
  the student will use, check every answer, train a 2B to 4B student with LoRA on the checked
  book, compare with the teacher per language, quantise last and compare again.
- Pick the student by its tokenizer, measured on your language, before anything else.
- Prune for broad jobs short of memory by a small factor. Teach a student for one enumerable
  job short by ten times or more, and for any language a small model handles badly. Do both
  when the teacher is expensive. Do neither when a stock model already fits.

*This closes the mixture-of-experts series. [Part 1](/posts/2025/02/moe-explained-simply/)
is the foundation, what a router does to a token and why you pay for memory you do not
compute with, and [part 2](/posts/2025/07/slowest-kid-moe-straggler/) is what happens when
one expert has more tokens than the rest.*
