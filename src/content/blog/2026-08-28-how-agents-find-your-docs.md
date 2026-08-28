---
title: "How an Agent Finds Your Docs, and Which Files It Actually Reads"
seoTitle: "llms.txt, AGENTS.md, ard.json: What Agents Read"
description: "Five file conventions claim to be the standard for AI agents. Here is what each one answers, who really reads it, and the evidence behind both claims."
date: 2026-08-28
permalink: "/posts/2026/08/how-agents-find-your-docs/"
lang: en
tags:
  - "agents"
  - "documentation"
  - "information retrieval"
  - "standards"
  - "MCP"
  - "beginner"
series: "Retrieval and RAG"
seriesOrder: 8
math: false
---

*Retrieval usually means searching a corpus you already have. This post is about the step before that, at internet scale: an agent arrives at a domain it has never seen and has to work out what is there. Five file conventions now claim to answer that, all of them are called "the standard for AI agents" by somebody, and they are not equally real. One of them is fetched far less than anybody selling it admits, and there is a study with 137,000 domains of server logs to prove it.*

---

## 1. Five files, five different questions

The confusion here is that these conventions are usually compared as rivals when they answer different questions.

![Five stacked layers: ard.json, llms.txt, AGENTS.md, plugin.json and MCP, each with the question it answers and a note on who reads it](/figures/agent-file-conventions.svg "The same agent may meet all five. Only the top one tells it what exists on a domain; only the bottom one is a live connection rather than a file.")

- **`ard.json`** says what agentic resources a domain offers and where they are.
- **`llms.txt`** says which pages of a site are worth reading, in markdown.
- **`AGENTS.md`** says how to work inside a repository: build it, test it, do not touch that directory.
- **`plugin.json`** packages skills and server configuration so an agent can install them.
- **MCP** is not a file at all. It is the protocol an agent speaks once it has connected to something.

The ARD specification puts the division cleanly: it is "a discovery protocol (an envelope), not an execution mechanism", which "wraps existing execution standards (like MCP, A2A, and OpenAPI)".

Now the part nobody publishes: which of these anything actually reads.

---

## 2. llms.txt: published everywhere, fetched by almost nobody

[llms.txt](https://llmstxt.org/) was proposed by Jeremy Howard in September 2024, and reached v2 in August 2026. It is a markdown file at your site root: an H1 with the project name, a blockquote summary, then H2 sections listing URLs worth reading. The v2 revision added discoverability through standard link relations, so a page can point at its own markdown version with `rel="alternate" type="text/markdown"` and at the llms.txt covering it with `rel="describedby"`.

Publishing is genuinely widespread. I checked: Anthropic, OpenAI, Google's Gemini docs, Stripe, Cloudflare, Perplexity, Svelte, Vercel and Cursor all serve one right now. Anthropic's `llms-full.txt` is 41.6 million bytes when I fetched it today, and Cloudflare's is 56.9 million. Both are far past what any context window can hold, which tells you something about who these files are really for.

Then there is the reading side. Ahrefs published a study in June 2026 over 137,210 domains with server-log visibility:

![Two bars: 28% of 137,210 domains publish an llms.txt, and 3% of those files were fetched even once in May 2026](/figures/llms-txt-reality.svg "Publishing is not being read, at least not by crawlers. Of the fetches that did happen, SEO audit tools were the largest category at 21.7%, and named AI tools accounted for 19.5%.")

Twenty-eight percent of those domains publish the file. **Ninety-seven percent of those files received zero traffic in May 2026.** The study also notes that no AI bot ever requested an llms.txt that did not exist: "They never go looking."

Be fair about the remaining 3%, though, because the breakdown is more interesting than the headline. Of the fetches that did happen, the largest single category was SEO audit tools at 21.7%. But 19.5% came from named AI tools across all the AI categories, with agents and agentic infrastructure at 10.5% and Claude Code the second most active individual bot. Dedicated AI retrieval bots were 1.1%.

So the accurate sentence is not "nothing reads it". It is that search crawlers ignore it, and the things that do fetch it are mostly coding agents sent there by a human, mid-task. That distinction decides whether the file is worth your time: as an SEO play it is dead, and as a map for an agent someone points at your docs it is doing real work.

Google has been blunt about it. John Mueller, on Bluesky in June 2025: "FWIW no AI system currently uses llms.txt", and a day later, "It's super-obvious if you look at your server logs. The consumer LLMs / chatbots (the ones that SEOs want traffic from) will fetch your pages, for training and grounding, but none of them fetch the llms.txt file." Asked in January 2026 whether Google publishing one at `ai.google.dev` counted as an endorsement, he answered: "I'm tempted to say something snarky since this has come up so often, but to be direct, no."

Two corrections worth carrying, because both are repeated constantly:

**`llms-full.txt` is not part of the specification.** It is a Mintlify feature from November 2024. It was formally proposed to the spec in a pull request in June 2025 and closed unmerged; fourteen months later v2 still does not mention it.

**No model provider has documented that its crawler reads llms.txt.** Publishing one, which they all do for their own docs, is not the same as reading one.

Is it therefore worthless? Not quite. It costs almost nothing, coding agents that fetch docs mid-task can use it when pointed at it, and the file is a decent artefact for your own retrieval pipeline. Just do not build a strategy on it being crawled.

---

## 3. AGENTS.md: the one that is genuinely read

[AGENTS.md](https://agents.md/) started in August 2025 from OpenAI's Codex team, and is now stewarded by the Agentic AI Foundation under the Linux Foundation, alongside MCP.

It has no schema at all. From its own FAQ: "Are there required fields? No. AGENTS.md is just standard Markdown." Convention puts build commands, test commands, code style and security notes in it, and agents read the nearest file up the tree, so a monorepo can have many. OpenAI's own main repository reportedly has 88 of them.

This is the convention with real consumption: over twenty shipping tools read it, including Codex, Cursor, Jules, Aider, Gemini CLI, goose, Zed, Warp, Devin, Windsurf and GitHub Copilot's coding agent.

One wrinkle worth knowing if you use Claude Code, because it is widely misreported. Anthropic's documentation says plainly: "Claude Code reads `CLAUDE.md`, not `AGENTS.md`. If your repository already uses `AGENTS.md` for other coding agents, create a `CLAUDE.md` that imports it." The supported bridge is a one-line `CLAUDE.md` containing `@AGENTS.md`, or a symlink. Meanwhile Cursor reads both, and states that it "reads `CLAUDE.md` files the same way it reads `AGENTS.md`". So the largest coding agent does not read the community standard, and a competitor reads that agent's proprietary file. Standards are made of politics as much as of syntax.

The headline adoption number, "used by over 60k open-source projects", is self-reported, has not moved since December 2025, and is repeated verbatim by the Linux Foundation, so treat it as one source rather than two.

---

## 4. ard.json: the newest, and the only one with production readers on day one

Agentic Resource Discovery was announced on **17 June 2026** by Google, with a working group including Microsoft, GitHub, Hugging Face, Cisco, Databricks, GoDaddy, NVIDIA, Salesforce, ServiceNow and Snowflake. Apache 2.0, spec at [agenticresourcediscovery.org](https://agenticresourcediscovery.org/).

A publisher serves a manifest listing what it offers. This is the template from the spec's own publishing guide:

```json
{
  "entries": [
    {
      "identifier": "urn:air:acme.com:server:weather",
      "displayName": "Acme Weather Telemetry Server",
      "type": "application/mcp-server+json",
      "url": "https://api.acme.com/mcp/weather.json",
      "capabilities": ["WeatherTool", "ForecastTool"],
      "description": "An enterprise weather MCP server providing live telemetry.",
      "representativeQueries": [
        "what is the current wind speed in Chicago",
        "get the 5-day forecast for Seattle"
      ]
    }
  ]
}
```

An entry must carry `identifier`, `displayName`, `type`, and either `url` or `data`. It should carry `representativeQueries`, and the spec is direct about why: "An entry without it cannot be found by search."

**Watch the filename.** It launched at `/.well-known/ai-catalog.json`. Version 0.91, published on 26 August 2026, two days before I wrote this, moved it to `/.well-known/ard.json` and made that path normative, with the old one demoted to a legacy path a consumer may additionally consult. In the wild the legacy name is still the more common one: Hugging Face and Vercel both serve `ai-catalog.json` today and not `ard.json`. Google itself serves neither at `google.com`.

Trust works through the domain. Identifiers are domain-anchored (`urn:air:acme.com:...`), and the spec's rule is that "an entry claiming `urn:air:google.com:...` is rejected by a verifying registry unless it can produce a verifiable attestation issued by google.com". ARD deliberately defines no signing scheme of its own, deferring to SPIFFE, DIDs or enterprise PKI. It is also honest about its limits: "ARD does not make any agentic resource trustworthy, it gives publishers a way to assert verifiable identity and provenance, and clients a way to verify it."

The consumption story is the strongest here. GitHub's Agent Finder implements it, on all Copilot plans. Hugging Face ships `hf discover` against it. Cisco and Ora run directories on it. The publisher side is the thin half: a handful of domains, mostly on the now-legacy path.

---

## 5. Agent Plugins: packaging, not discovery

Announced on **6 August 2026**, initiated by Vercel and refined with AWS, Anysphere, GitHub, Microsoft and OpenAI. Version 1.0.0, status Published, specification text under CC BY 4.0 and the schemas under Apache 2.0.

A plugin is a directory with a manifest and components in fixed places:

```text
my-plugin/
├── plugin.json
├── skills/
│   └── summarize/
│       ├── SKILL.md
│       └── scripts/
├── mcp.json
└── LICENSE
```

Version 1 defines exactly two portable component types: Agent Skills and MCP servers. Commands, hooks and rules are explicitly out of scope and live under reverse-domain extension namespaces, which is the mechanism that keeps one client's private features from breaking another's parser.

VS Code and Cursor both document loading spec-conformant plugins today. The honest caveat is on the authoring side: three weeks after launch, most real plugin content still ships in client-native layouts. OpenAI co-authored the standard, sits on its steering committee, and its own 62-plugin marketplace uses `.codex-plugin/plugin.json` rather than the portable root manifest, with no mention of the standard anywhere in its plugin documentation.

---

## 6. What I would actually do

If you publish documentation:

1. **Write an `AGENTS.md`** if you ship code. It is read, today, by tools your users already run. Keep it short and command-shaped.
2. **Serve clean markdown at predictable URLs**, and let a page point at its own markdown with a link relation. This helps every fetcher, including the ones that ignore every convention on this page.
3. **Publish an `llms.txt`** because it costs an hour, but do not expect traffic, and do not let anyone sell you an "llms.txt strategy". Check your own server logs after a month; you will learn more than from any blog post, this one included.
4. **Serve an `ard.json`** if you actually expose agentic resources, an MCP server or a hosted skill. This is where the real consumers are, and where being early is cheap. Serve the legacy `ai-catalog.json` path too until the ecosystem finishes moving.
5. **Do not chase all five.** Three of them are three weeks to three months old, and at least one will not exist in two years.

And if you are consuming rather than publishing, the ranking inverts: `ard.json` tells you what exists, MCP is how you use it, and the rest is context you fetch and read like any other page. Which lands you back at the problem the rest of this series is about, because a fetched page is just another document to [parse](/posts/2026/08/parsing-documents-for-rag/), [index and retrieve](/posts/2025/05/rag-retrieval-benchmark/).

---

## 7. The short version

- These five are not rivals. `ard.json` says what exists, `llms.txt` says what to read, `AGENTS.md` says how to work here, `plugin.json` says what to install, and MCP is what you speak once connected.
- llms.txt is published by nearly every AI lab and fetched by almost nothing: across 137,210 domains, 28% published one and 97% of those files got zero fetches in May 2026. Of the fetches that happened, SEO tools led at 21.7% and named AI tools were 19.5%, so it works as an agent's map and not as an SEO play.
- Google has said outright that no AI system uses it, and that publishing their own is not an endorsement.
- `llms-full.txt` is a Mintlify feature, not part of the specification, and was rejected from it in 2025.
- AGENTS.md is the one that is genuinely read, by more than twenty tools, though Claude Code still needs a one-line `CLAUDE.md` that imports it.
- ARD is the newest and has the strongest consumers: GitHub's Agent Finder and Hugging Face's discover command both query it. Its file was renamed from `ai-catalog.json` to `ard.json` on 26 August 2026, and most live publishers have not moved yet.
- Agent Plugins 1.0.0 is real and loaded by VS Code and Cursor, but most plugins, including OpenAI's own, still ship in client-native layouts.
- Publish AGENTS.md, serve clean markdown, publish llms.txt cheaply, serve ard.json if you expose agentic resources, and check your logs before believing anyone about any of it.

*Every figure and quotation here was checked against primary sources: the [llms.txt spec](https://llmstxt.org/), the [Ahrefs log study](https://ahrefs.com/blog/llmstxt-study/), [agents.md](https://agents.md/), Anthropic's [memory documentation](https://code.claude.com/docs/en/memory), the [ARD specification](https://agenticresourcediscovery.org/spec/), and the [Agent Plugins specification](https://agent-plugins.org/specification).*
