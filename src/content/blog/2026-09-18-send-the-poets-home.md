---
title: "Send the Poets Home: Expert Pruning, a Student Model, and When to Pick Each"
seoTitle: "MoE Expert Pruning vs Teacher-Student for One Job"
description: "How to prune the experts a bank chatbot never uses, why that still breaks Bangla, and when to teach a small student model instead."
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

*Part 3 of three. A bank wants a support chatbot, and the mixture-of-experts model it likes also
writes poetry, explains recipes and debugs Rust. There are two ways to stop paying for the parts
nobody at the bank will use: delete the experts the bank's traffic never wakes, or have the big
model write the answer to every question a customer could ask and teach a small model from that
answer book. Which one you pick is decided mostly by the language your customers write in, and
this post says why, with numbers I measured.*

---

## 1. The bank that hired a whole school

Part 1 of this series opened with a classroom, and I want to keep it, because the mistake this
post is about is a classroom mistake.

A bank in Dhaka wants a chatbot for customer support. Balances, cards, transfers, fees, which
documents to bring to open an account, what to do when the ATM keeps your card. Customers write
in Bangla, some in English, and many in both at once. The bank has its policy documents and a
retrieval layer over them, the ordinary RAG setup. It tried an open mixture-of-experts model,
and the model answers well. It also needs a rack of GPUs, because, as
[part 1](/posts/2025/02/moe-explained-simply/) spent a whole section saying, MoE saves compute
and not memory. Every expert must be resident whether or not it ever does anything.

So somebody in the meeting says the obvious thing. "We are paying to keep the poetry expert and
the cooking expert in memory. Send them home."

That sentence is wrong in a way that is worth taking apart slowly, because the right version of
it is a real technique with real numbers, and the place where even the right version fails is
the most useful thing in this post.

Here are the three routes on the table, before any of them is explained.

```
 route            you keep              you save       it costs you
 ──────────────────────────────────────────────────────────────────────
 prune experts    the same model,       1.2x to 2x     a quiet loss of
                  fewer experts         of memory      quality to go find
 teacher, student a new, tiny model     10x to 100x    a dataset to build
                                                       and to check
 quantise only    the same model,       2x to 4x       the languages with
                  fewer bits per weight                the worst script
                                                       support
```

---

## 2. There is no poetry expert, but there is a usage table

Two facts from part 1 decide everything here, so here they are again in one breath. Routing is
per token, per layer: a sixty-layer model makes sixty independent choices for every token, and
the word "poem" is not sent to a poetry department, it is sent wherever vectors that look like
it happened to land in that layer's router. And experts specialise on shallow structure, not on
subjects. The [Mixtral paper](https://arxiv.org/abs/2401.04088) went looking for topic
specialisation across arXiv, biology, philosophy and code and wrote, with visible surprise: "we
do not observe obvious patterns in the assignment of experts based on the topic." What it found
instead was structural. At layer 15, between 23.6% and 28.4% of consecutive tokens went to the
same expert, against 12.5% if the router were rolling dice.

So there is no poetry expert to send home. What there is, once you run a month of the bank's
traffic through the model and count, is a **usage table**: for every layer, how many tokens
each expert saw, and with what weight.

```
one MoE layer, 16 experts, a month of bank questions (illustrative)

 E0  ████████████████████████████        E8  ██
 E1  ██████████████████                  E9  ████████████████████
 E2  ██                                  E10 ▌
 E3  ██████████████████████████████      E11 ██████████████
 E4  ▌                                   E12 ▏
 E5  ▏                                   E13 ████████
 E6  ██████████████                      E14 ▎
 E7  ▏                                   E15 ██████████████████████

 seven experts did most of the work. five barely woke up.
```

Those five are what pruning removes. They may or may not be "about" anything. It does not
matter. What matters is that on this traffic the router almost never picked them, so deleting
them changes almost nothing the bank will ever see, and the memory they took is freed.

The idea is older than most people think. Chen and colleagues wrote it up in 2022 as
[task-specific expert pruning](https://arxiv.org/abs/2206.00277): fine-tune a sparse model on
one downstream task, drop the least-used experts progressively as you go, and keep going until
one expert is left per layer. The result is a plain dense model, and they reported that it
"could preserve 99.3% benefits from MoE across six different types of tasks while enjoying 2x
inference speed." A whole school, reduced to one teacher, for one job. The versions people run
on today's models stop well short of one, but the logic is the same.

What you should say in the meeting, then, is not "send the poets home." It is "let us find out
which experts our customers never use, and delete those." Here is how.

---

## 3. Expert pruning, done properly

![Six numbered boxes from collect to verify, each with a note on the right: collect real traffic, trace the routing, score each expert, choose survivors per layer, rewire and heal, verify against the full model](/figures/expert-pruning-recipe.svg "The whole recipe. Steps 4 and 6 decide whether the result is any good, and step 6 is the one that gets skipped because the memory number already went down.")

**Collect the calibration traffic.** Real questions, in the languages and proportions you
actually serve, with the retrieved context attached the way it will be at serving time. No
answers are needed, which is the first big difference from the teacher-student route: pruning
only has to *watch*, and watching is cheap. A few hundred thousand tokens is plenty. The
Mixtral study I lean on below used 128 sequences of 2,048 tokens, about 262,000 tokens in all,
and got stable choices from it. The one thing this set must not be is "whatever English web
text the pruning script shipped with," and section 4 is about why.

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
$\binom{8}{6} = 28$ subsets per layer to try. It is not affordable on a fine-grained model.
Keep 64 of 128 and there are $\binom{128}{64} \approx 2.4 \times 10^{37}$, which is why REAP
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
only step that tells you what you paid.

Why I keep saying *calibration traffic* is decided by the figure below. Same model, same number
of experts removed, same method. The only thing that differs between a plain bar and the
accented one under it is what text the pruner watched while choosing.

![Five bars of GSM8K accuracy for Mixtral 8x7B: all 8 experts 58.61, keep 6 watching web text 41.02, keep 6 watching maths 51.25, keep 4 watching web text 24.87, keep 4 watching maths 37.07](/figures/pruning-calibration-gsm8k.svg "Lu et al., Table 3. Watch maths while choosing and you keep ten more points of maths ability, at both sizes. Watch generic web text and the pruner deletes experts that maths tokens were quietly relying on.")

Keep 6 of 8 and the model that watched web text scores 41.02 on GSM8K, against 51.25 for the
model that watched maths problems while choosing. Keep 4 of 8 and it is 24.87 against 37.07.
Nothing about the algorithm changed. For a bank, "watch maths" means "watch bank questions in
the languages your customers use," and the ten-point gap is what you buy by bothering.

The memory side of the same study: removing 2 of 8 experts cut Mixtral 8x7B's memory by about
24% and made inference 1.20 times faster; removing 4 of 8 cut it by about 48% at 1.27 times.
Those are the "1.2x to 2x" figures from the table in section 1, and notice how modest the speed
number is. Pruning is a memory technique. If you needed compute you already had it, because
only $k$ experts ever run.

REAP pushed the same idea onto the fine-grained models in part 1's table. They pruned half the
experts from models between 20B and a trillion parameters, Qwen3-Coder-480B and Kimi K2 among
them, and report "near-lossless compression on code generation tasks" at that 50%. Their other
finding is worth carrying with you. They compared pruning with **merging**, where you average
similar experts into one instead of deleting any, and concluded that "expert pruning is a
superior strategy for generative tasks," because merging loses the fine-grained routing control
that made the model good at generating in the first place.

One more knob that is not pruning but lives next to it. Lu and colleagues also **skip** experts
dynamically: at inference, if the second-chosen expert's weight is below some fraction $\beta$
of the first's, do not run it. That gave them another 1.08 to 1.33 times in speed at what they
call negligible loss. It saves compute, not memory, so it does not help the bank fit the model
on fewer GPUs, but it is nearly free once the routing trace exists.

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
model will run, produce fluent nonsense, and cost you a day.

---

## 4. Where pruning breaks: the language nobody calibrated on

Now the bank's real problem, which is not memory. It is Bangla.

The pruned model from section 3 is still the same model, and its Bangla was already the
thinnest thing in it. Three separate mechanisms then make it thinner, and this section exists
because people usually notice only the third.

**The router never sees the word.** Before anything is routed, the text is cut into tokens by
a vocabulary that was chosen mostly by counting English. I took six questions a customer might
ask, wrote each in English and in Bangla, and counted tokens with three small models' own
`tokenizer.json`.

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

So before either route in this post, run twenty lines against the candidate's `tokenizer.json`
and count tokens per word in your language against English. Anything much over two is a model
that will spend most of its capacity, and most of your latency budget, reassembling letters.

**No expert holds a language.** This is the point the classroom picture hides best, and it is
the one I most want to land. You might hope that Bangla lives in a few experts, so that a
careful pruner could simply keep those. The people who trained ST-MoE, a 269-billion-parameter
sparse model, hoped so too, and [wrote down what they
found](https://arxiv.org/abs/2202.08906): "One might expect experts to specialize in
languages, which appears as a natural criterion for divvying up batches of data among experts.
However, we find no evidence of language specialization." Their explanation is the load
balancing from part 1, section 5. Each batch holds only a few languages, the balance loss
insists that every expert take its share of every batch, so "all experts are encouraged to
handle tokens from all languages."

A language, then, is not in any expert. It is spread across all of them, at low weight, in
tokenised confetti. Now put that next to a usage table built from traffic that is mostly
English, or from the generic web text a pruning script ships with.

```
one layer, 12 experts, share of each language's tokens (illustrative)

          E0  E1  E2  E3  E4  E5  E6  E7  E8  E9  E10 E11
English   ███ ██▌ ▌   ███ ▎   ▏   ██  ▏   ▏   ▎   ▏   ██▌
Bangla    ▌   ▌   ▌   ▌   ▌   ▎   ▌   ▌   ▎   ▌   ▌   ▌

prune by usage, keep 6   ->   E0 E1 E3 E6 E11, plus one more

English keeps nearly all of its support.
Bangla loses half of a support that was already thin,
in every layer, sixty times over.
```

You cannot protect Bangla by choosing which experts to keep, because there is no expert that
has it. The experts that carry the most of it are, by construction, the least-used ones on
an English-heavy calibration set, and those are precisely the ones the pruner deletes. Putting
Bangla into the calibration set helps, and Lu's maths result above is exactly that effect. But
pruning keeps at best what was there, and what was there was thin.

**Quantisation cuts the same languages.** You will quantise the pruned model too, because
pruning alone does not get you from a rack to one card, and quantisation is not neutral across
scripts either. Cohere's study of [quantised multilingual
models](https://arxiv.org/abs/2407.03211) found that "languages are disparately affected by
quantization, with non-Latin script languages impacted worst," and, worse for anyone who
trusts a dashboard, that "a 1.7% average drop in Japanese across automatic tasks corresponds to
a 16.0% drop reported by human evaluators on realistic prompts." Your benchmark will say the
4-bit model is fine. Your customers, writing in a non-Latin script, will be the ones who
disagree.

Stack the three. A language the tokenizer shreds, routed thinly across experts that a usage
table marks as idle, in a model about to be squeezed to four bits. That is the pruned,
quantised MoE the bank was about to ship in Bangla. It is not that pruning is bad. It is that
pruning can only keep, and for this job you need something the big model can *give*.

---

## 5. The teacher writes the answer book

Here is the other route, and it is the one I would take for the bank.

Do not shrink the school. Ask the head teacher, the big model, to write the answer to every
question a customer could ask, in Bangla, in English, in the mix people actually type, using
the bank's own documents. Check the answers. Then train one small model on that answer book.
The small model never needs to know poetry. It needs to answer *these* questions the way the
head teacher would have, and that is a far smaller thing to know.

This has a name, [knowledge distillation](https://arxiv.org/abs/1503.02531), and the flavour
here is the simplest one, [sequence-level distillation](https://arxiv.org/abs/1606.07947):
the student trains on the teacher's finished answers, not on its probabilities. Training on the
probabilities is better when you can, but it needs an open-weight teacher that shares the
student's tokenizer, and you have just spent a section learning that tokenizers are the
problem. Answers work with any teacher.

![Seven numbered boxes from ask to compare: write the questions, answer them with the teacher and the same RAG, check every answer, build the dataset, pick a student by its tokenizer, LoRA fine-tune, compare student with teacher per language](/figures/teacher-student-recipe.svg "Steps 3 and 7 are the checks. Skip 3 and every wrong answer in the book is taught a thousand times. Skip 7 and you will find out from customers.")

**Write the questions.** This is where the money goes, and it should. Sources, in order of
value: real support transcripts with every name, number and account stripped, the way
[the PII post](/posts/2025/09/sensitive-data-pii-secrets/) describes; the agents' own scripts
and the FAQ; and then paraphrases, which the teacher will happily write for you, ten per
question, in Bangla, in English, and in romanised Bangla typed on a phone with the spelling
that implies. Build a coverage grid, intents down the side and languages and phrasings across
the top, and fill every cell. Add the questions you do *not* want answered: someone else's
balance, a request to ignore the instructions, a loan application the bot has no authority to
process. Those rows get a refusal or a hand-off to a person as their answer, and they matter as
much as the rest.

How many? Stanford's [Alpaca](https://crfm.stanford.edu/2023/03/13/alpaca.html) taught a 7B
model to follow instructions from 52,000 examples, and generating them "costed less than $500
using the OpenAI API." [LIMA](https://arxiv.org/abs/2305.11206) showed that a thousand
carefully chosen examples go a surprisingly long way. For one bank's support, ten to fifty
thousand rows is the range, and the quality of each row matters more than which end of the
range you land on.

**Answer with the teacher, through the same RAG.** For every question, retrieve the context the
way the deployed system will, put it in the exact prompt shape the student will see, and let
the teacher answer. This one detail decides whether the student is useful. If the teacher
answers from its own memory, the student learns to answer from *its* memory, and the day the
bank changes its transfer fee the student is confidently wrong forever. Train it to answer
from the context in front of it, and updating the bot becomes updating a document.

Which teacher? The best model you can reach that is good at your language, and whose terms
allow it. The Alpaca team had to note that their data "is based on OpenAI's text-davinci-003,
whose terms of use prohibit developing models that compete with OpenAI," and that clause has
relatives in most closed providers' terms. Read yours. Open-weight teachers such as DeepSeek-V3,
Qwen3-235B-A22B or Kimi K2 make the question go away, and they are the models in part 1's
table.

**Check every answer.** A wrong answer in the book is taught a thousand times, so nothing goes
in unchecked. First a second model, with a rubric: is the answer supported by the context, is
it in the customer's language, is it polite, did it refuse when it should have, did it invent a
fee. Then people, on a random sample and on every refusal and hand-off row, because those are
the ones a rubric grades badly. Anything that fails is dropped, not fixed by hand, unless a
person is willing to own the fix. The [post on knowing whether it
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

## 6. Which route, when

![A flowchart of three questions with yes and no branches: does the job need the whole model, how much smaller must it get, can you write down the questions, ending in keep the big model, prune experts, prune hard or pick a smaller MoE, and teach a student](/figures/choose-your-route.svg "Put a finger on the top box and follow it. The bank in this post answers no, ten times or more, yes, and lands on the student.")

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
to *choose* a model that handles the script and to decide how many bits it keeps. The bank in
this post is this case three times over.

**Do both** when the teacher is the expensive part. Writing fifty thousand answers with a
671B model is a real bill; prune that model on the bank's traffic first and write the book
with the pruned version. And keep the pruned big model around as the tier the student hands
off to, so "I do not know, let me pass you on" has somewhere to go that is not a person every
time.

**Do neither** when a stock model already fits. If Qwen3-30B-A3B at 8 bits sits in your one
GPU with room for the KV cache, and its Bangla is acceptable on your twenty questions, run it
with good retrieval and spend the month on the retrieval instead. Pruning and distillation are
what you do when the model you want does not fit. They are not a rite of passage.

---

## 7. The short version

- There is no poetry expert. Routing is per token, per layer, over shallow structure, so
  "send the poets home" means "delete the experts my traffic never wakes," which is measurable
  and real.
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
