---
title: "LLM Security in Practice: A Checklist and the Mindset Behind It"
seoTitle: "LLM Security Best Practices"
description: "The whole series as a checklist, plus the one habit that generates it: assume the model is compromised, and design so that assumption is survivable."
date: 2025-11-20
permalink: "/posts/2025/11/llm-security-best-practices/"
lang: en
tags:
  - "security"
  - "llm security"
  - "agents"
  - "best practices"
series: "LLM and Agent Security"
seriesOrder: 6
math: false
---

*This closes the series with two things: a checklist you can run against a design, and the single mindset that produces the whole checklist so you do not have to memorise it. The mindset is one sentence, and everything else follows from it.*

## 1. The one habit

Every part of this series is a consequence of one assumption:

> **Assume the model is compromised, and design so that assumption is survivable.**

Not "try to keep the model from being misled", which you [cannot guarantee](/posts/2025/07/prompt-injection/), but "arrange things so that a misled model cannot do much harm". A security engineer looks at an AI feature and asks the same question they ask of any component with authority and untrusted input: *if this is fully turned against us, what is the worst that happens, and is that acceptable?* If the answer is not acceptable, you change the architecture until it is, by removing access, adding gates, or shrinking the blast radius, not by adding words to a prompt.

That is the whole discipline. The checklist below is just that question, asked at each place it matters.

## 2. The design checklist

Run this against any LLM feature before it ships.

**The trifecta.** For this feature, does the model have all three of untrusted input, private-data access, and an exfiltration channel? If yes, that is your danger zone: find the cheapest leg to remove, and remove it. If no, note which leg is missing and make sure it stays missing.

**Inputs.**
- Is any text the model reads influenced by someone you do not control, including third parties (web pages, emails, documents, uploads)? Treat all of it as potential [injection](/posts/2025/07/prompt-injection/).
- If you filter input, is it a labelled speed bump and not your actual defence?
- Is untrusted content clearly delimited in the prompt, with the model told to treat it as data? (Helps, does not suffice.)

**Data going in.**
- Are you passing the [minimum data](/posts/2025/09/sensitive-data-pii-secrets/) the task needs, and no more?
- Are secrets kept out of the prompt entirely, used only by tools on the trusted side?
- Is PII masked or pseudonymised before it reaches the context, detected in trusted code?
- Is the model given only data the current user is allowed to see?

**Tools and actions.**
- Does the agent hold only [narrow, intent-named tools](/posts/2025/08/agent-blast-radius/) the task needs, not general "run SQL" or "run shell"?
- Does it act with the current user's authority, with every tool query user-scoped on the trusted side, never a powerful service account?
- Is every consequential or irreversible action behind a [human confirm gate](/posts/2025/08/agent-blast-radius/) that shows the real action, from the tool call, not the model's summary?
- Do tools that run code or touch the world run in a sandbox with no secrets and no network by default?
- Are there per-run budgets and rate limits on powerful tools?

**Output coming out.**
- Is model output treated as [untrusted](/posts/2025/10/exfiltration-through-model-output/) everywhere it lands: escaped for HTML, parameterised into queries, argument-array into shells, resolved-and-checked as paths?
- Can rendered output make the browser fetch an arbitrary URL (a markdown image or link)? If so, that is an exfiltration channel: allowlist domains, set a CSP on `img-src` and `connect-src`, or render as text.
- Where possible, is the model constrained to a validated structured schema rather than free text?

**The classic layer, still there.**
- [Authentication and authorisation](/posts/2024/07/broken-access-control/) on every request, unchanged by the presence of a model.
- [Parameterised queries](/posts/2024/04/sql-injection/), [output encoding](/posts/2024/05/cross-site-scripting/), [CSRF protection](/posts/2024/06/cross-site-request-forgery/), [TLS](/posts/2024/10/network-security-and-tls/): none of it is optional because there is a model in the loop.

**Visibility.**
- Is every tool call and its result [logged](/posts/2025/08/agent-blast-radius/), append-only, with the user and any approval?
- Are prompt logs masked, so your logs are not a second copy of everyone's private data?
- Do you have an alarm for the shapes that signal an attack: reads followed by an outbound send, a tool called for the wrong user, a spike?

If a design passes all of that, a successful prompt injection is a contained event, not a breach. That is the goal: not a model that is never fooled, but a system where fooling it does not matter much.

## 3. The traps worth naming one more time

The mistakes I see most, collected so you can check yourself against them.

- **Treating prompt-level defences as the wall.** They raise the cost of an attack; they do not close the hole. Architecture is the wall.
- **Trusting model output because it came from your backend.** It was shaped by untrusted input. It is untrusted.
- **Running the agent as a powerful service account.** One injection in one session then reaches everyone's data. Inherit the user's authority.
- **Confirmation that shows the model's summary instead of the real action.** The model can lie in the summary. Show the effect from the tool call.
- **Logging raw prompts.** Your debug logs become the largest, least-protected copy of all the sensitive data you ever processed.
- **Using an LLM to guard an LLM.** The guard has the same weakness and can be injected. Guards belong in trusted, deterministic code.
- **Forgetting classic appsec.** The model does not exempt the app from SQL injection, XSS, access control, or any of it, and it gives an attacker a new way to drive them.

## 4. Where this is going

Two honest notes to close on. First, the field is young and moving. Model-level defences against injection are improving, and some day the picture may be less bleak than "cannot be solved". Until then, containment is the engineering answer, and containment is durable: it will still be good practice even when models get better, because defence in depth always is.

Second, the containment mindset is not new, and that is reassuring. It is the same one that secures every powerful component fed untrusted input: least privilege, deny by default, human approval for consequential actions, isolate the dangerous parts, log everything, and never trust one control to hold alone. The language model is a new and unusually persuadable component, but the way you make a persuadable component safe is old, and it works.

## The short version

- The whole series reduces to one habit: assume the model is compromised, and design so that assumption is survivable. Ask of any AI feature, "if this is fully turned against us, what is the worst that happens, and is that acceptable?"
- Run the checklist: check the trifecta and remove a leg; treat all model-read text as injectable; minimise and mask data going in; give narrow, user-scoped tools with confirm gates and sandboxes; treat all output as untrusted going out; keep every classic appsec control; and log and alarm everything.
- The recurring traps: prompt defences as the wall, trusting output because it came from your backend, running the agent as a service account, confirmations that show the model's summary, logging raw prompts, guarding an LLM with an LLM, and forgetting classic appsec.
- A design that passes the checklist turns a successful injection into a contained event, not a breach. The goal is not a model that is never fooled, but a system where fooling it does not matter much.
- The containment mindset is the old one that secures any powerful component fed untrusted input: least privilege, deny by default, human approval, isolation, logging, no single point of trust. The model is new; the way to make it safe is not.

This series and the [one before it](/posts/2024/03/what-security-actually-is/) are the same idea twice: a system is only as safe as its trust boundaries, and a boundary is only as safe as the check that guards it. The language model just moved the boundary somewhere new, and made the input more persuasive.
