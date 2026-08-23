---
title: "Why AI Security Is a New Problem: The Model Has No Data Channel"
seoTitle: "Why LLM Security Is a New Problem"
description: "Every security bug in the last series was data mistaken for code. A language model makes that its whole way of working: to it, all text is instructions."
date: 2025-06-11
permalink: "/posts/2025/06/why-ai-security-is-different/"
lang: en
tags:
  - "security"
  - "llm security"
  - "prompt injection"
  - "agents"
series: "LLM and Agent Security"
seriesOrder: 1
math: false
---

*The [previous security series](/posts/2024/03/what-security-actually-is/) turned on one idea: almost every vulnerability is data mistaken for code, crossing a boundary you drew without noticing. A language model takes that idea and makes it the entire product. To an LLM there is no boundary between instructions and data, because it was built not to have one. That is why AI security is genuinely new, and why the fixes that ended SQL injection do not exist here. This series is what to do instead.*

## 1. The one fact everything follows from

A traditional program has two channels. There is the code, written by you, and there is the data, supplied by the user, and the whole of the last series was about keeping the second from being read as the first. The [parameterised query](/posts/2024/04/sql-injection/) worked because the database could be told, structurally, "this part is program, this part is value, and the value can never become program".

A language model has one channel. Everything is text, and all text is read the same way: as something that might be an instruction. The system prompt you wrote and the email the model is summarising arrive as the same kind of thing, a sequence of tokens, and the model has no reliable way to know which one it is supposed to obey. There is no `?` placeholder. There is no way to hand the model a value and guarantee it will be treated as inert.

```
  traditional program        language model

  code  --+                  [ system prompt ] \
          |  two channels,    [ your rules    ]  |  one channel,
  data  --+  kept apart       [ the document  ]  |  all read as
                              [ user's text   ] /   instruction
```

That is the whole of it. Everything in this series is a consequence of the model having no data channel, and every defence is an attempt to build one *around* the model, since you cannot build one *inside* it.

## 2. So prompt injection is not a bug, it is the medium

In the last series, SQL injection was a mistake: write the query correctly and it goes away forever. Prompt injection is not a mistake you can stop making, because there is no "correct" way to feed untrusted text to a model that makes the text inert. If your application shows the model any text that an attacker can influence, a web page it browses, an email it reads, a document a user uploads, a review it summarises, then the attacker can put instructions in that text, and the model may follow them.

This is worth stating plainly because a great deal of effort is wasted denying it:

> **Prompt injection cannot be fully solved at the model level today. Treat it as a permanent property of the medium, and design so that a successful injection cannot do much harm.**

The mindset shift is from *prevention* to *containment*. You do not, and cannot, guarantee the model is never misled. You guarantee that when it is misled, the blast radius is small. That is the same shift good security always makes, and it is [part 2](/posts/2025/07/prompt-injection/) and beyond.

## 3. The lethal trifecta

Here is the sharpest way to reason about whether an AI feature is dangerous, and I use it as a first-pass filter on every design. A serious injection attack needs three things at once:

1. **Untrusted input.** The model processes text an attacker can control.
2. **Access to private data.** The model can reach secrets, personal data, internal systems, the user's account.
3. **An exfiltration channel.** The model can send data somewhere the attacker can see: make a web request, render a link or image, write to a shared place, email someone.

Any one or two of these is usually survivable. All three together is the lethal combination, because the attacker's injected instructions can tell the model to take the private data and push it out the exfiltration channel, and the model, having no data channel, obeys.

```
  untrusted input  +  private data  +  exfil channel  =  danger

  remove any ONE leg and the attack usually cannot complete.
  a summariser with no data access and no network: safe.
  an agent that reads your mail, browses, AND can send: all three.
```

The practical value is that it tells you where to cut. You often cannot remove the untrusted input, that is the feature. But you can very often remove the private-data access for that path, or remove the exfiltration channel, and breaking either leg breaks the attack. Much of secure AI design is finding which leg is cheapest to remove.

## 4. What is the same, and what is new

Most of classic application security still applies, and forgetting that is its own mistake. An LLM feature is still a web application: it has [authentication and authorisation](/posts/2024/07/broken-access-control/), it talks to a database that can still be [SQL-injected](/posts/2024/04/sql-injection/) if you let the model build queries by concatenation, it serves output to a browser that can still be [XSS-ed](/posts/2024/05/cross-site-scripting/) if you drop model output into a page unescaped. The model does not exempt you from any of it. In fact the model makes some of it worse, because now an attacker can try to *drive* those classic bugs through the model: inject a prompt that makes the model emit a `<script>` tag, or construct a malicious SQL string.

What is new is the second layer on top:

- The model itself is a **confused deputy**: a component with real authority that can be talked into misusing it by whoever controls its input. This is the [agent problem](/posts/2025/12/safe-by-default-agents/).
- The model's **output is untrusted**, even though it came from your own trusted system, because its output was shaped by untrusted input. Model output is attacker-influenced data, and must be handled like any other untrusted data.
- Data can leak in **new ways**: into training sets, into logs, into the context window of the next user, into a third-party model provider.

So the rule for the series: keep every classic defence, and add a new layer that assumes the model can be turned against you.

## 5. The threat model, restated for AI

The [four questions](/posts/2024/03/what-security-actually-is/) from the first series still frame it, with AI-specific answers:

- **What are you protecting?** Usually: private data the model can reach, the integrity of the actions the model can take, and the trust users place in the model's output.
- **Who is the attacker?** Often not the user in front of the model, but whoever authored the *content the model reads*: the web page, the email, the document, the code comment. Indirect prompt injection means the attacker is frequently a third party the user has never heard of.
- **What can they do?** Put instructions anywhere the model will read them.
- **What happens if they win?** Whatever the model's tools and data access allow. This is why the trifecta matters: the impact is bounded by what you connected the model to.

That third-party attacker is the part people miss. In a normal web app the attacker is the one sending requests. In an agent that browses the web or reads a shared inbox, the attacker is the one who planted a booby-trapped page or email months ago, and the victim is your user who innocently asked the agent to "summarise my messages".

## The short version

- A traditional program has two channels, code and data, and security is keeping data from being read as code. A language model has one channel: all text is potential instruction, by design. There is no placeholder that makes input inert.
- Prompt injection is therefore not a bug you can fix, the way you fix SQL injection. It is a permanent property of feeding untrusted text to a model. Shift from preventing it to containing it.
- The lethal trifecta is untrusted input, access to private data, and an exfiltration channel. All three together is dangerous; remove any one leg and the attack usually cannot complete. Design by finding the cheapest leg to cut.
- Everything from classic application security still applies, and the model can be used to drive those classic bugs too. The model exempts you from nothing.
- What is new is a layer on top: the model is a confused deputy with authority, its output is untrusted because untrusted input shaped it, and data leaks in new ways, into training, logs, and the next user's context.
- The attacker is often not your user but a third party who planted instructions in content the model reads. The victim is the user who asked the agent to read it.

Next: prompt injection in detail, direct and indirect, and why the filtering approach that fails for SQL injection fails even harder here.
