---
layout: archive
title: "Projects"
permalink: /projects/
author_profile: true
---

{% include base_path %}

A working list of things I've built. Some are open source, some are client work, some are
research code. They're grouped by what they're *for* rather than by what they're written in.

## Agent harnesses

The layer between a language model and software that already exists. My view: most teams give
the model the wrong surface (raw tables, auto-generated specs) and then blame the model when it
guesses.

**[Reins](https://github.com/shamspias/reins)** · Python

A lightweight harness you bolt onto an existing app so an LLM can operate it. Point it at
functions you already have, or at your SQLAlchemy/Django models, and hand it a goal in plain
language. It works out which operations to call and in what order, runs them **through your own
code, never raw SQL**, and returns the result.

* `ask()` is read-only and cannot write; writes are opt-in and gated by policy, approval, and
  audit. That boundary is enforced in code, not in a prompt the model can talk its way around.
* `Agent.from_orm(...)` introspects models into intent-named verbs (`find_orders`,
  `get_user_by_email`), preferring unique natural keys over internal IDs.
* Anthropic, OpenAI, Gemini, Groq, Z.ai, Ollama, and vLLM in the box; `agent.explain()` shows
  every call it made and why.

**[Veldra](https://github.com/shamspias/customizable-gpt-chatbot)** · Python · Vue 3

A self-hostable, local-first agent-harness platform. The load-bearing idea: **an agent is
data, not code**, a versioned `AgentSpec` row in Postgres. "Build me an agent" compiles
natural language into a validated spec; "change it" is a JSON-Patch you approve; the runtime is
a pure interpreter of the current version.

* Natural-language agent and *team* construction (coordinator + specialists, depth-capped
  delegation).
* MCP connectors (Shopify, Alibaba, or any Streamable-HTTP / SSE / stdio server) alongside
  built-in tools; side-effecting connector tools require explicit approval.
* Editable knowledge bases with per-KB retrieval mode, embedding model, reranker, and vector
  store; citations carry page, section, and character span.
* A visual workflow builder, and agents that accumulate *lessons* from feedback and from their
  own failed tool calls.

**[Clawkido](https://github.com/shamspias/clawkido)** · Go

Actor-model multi-agent swarm engine: goroutine-per-agent routing, swarm handoff with
depth-limited chains, an extensible skill system, provider fallback, and Telegram/Discord
integration. Single binary, roughly 50 MB of RAM.

**[LangGraph Agent System](https://github.com/shamspias/langgraph-agent-system)** · Python

Production-shaped multi-agent system on LangGraph Platform: specialized agents, multi-provider
LLM support, LangGraph Studio compatibility.

## Machine learning for biology

**Anti-inflammatory peptide prediction** *(ongoing)*

A two-stage stacking ensemble that combines ~2,282 hand-crafted sequence descriptors (AAC, DPC,
DDE, CKSAAP, CTD, PAAC, QSO, autocorrelation, physicochemical) with 1,280-dimensional **ESM-2**
protein language model embeddings. The real contribution is not the architecture. It is the
dataset. Earlier methods drew negatives from random UniProt proteins, which quietly reduces the
task to "short peptide vs. long protein" and inflates accuracy. We use experimentally validated
negatives from the same **IEDB** T-cell assays as the positives and report the harder numbers
that follow.

**[DeepNatProtease](https://github.com/shamspias/DeepNatProtease)** · natural-product
inhibitors of viral proteases

An end-to-end virtual-screening pipeline: integrate per-virus bioactivity data (ChEMBL,
BindingDB, PubChem BioAssay, ZINC, COVID Moonshot) with full provenance → standardize and
harmonize units to nM → split by **Bemis–Murcko scaffold clusters** with zero overlap → train
virus-specific ChemProp GNN ensembles and classical models → screen the **COCONUT** library of
400k+ natural products → filter PAINS/toxicophores and enforce scaffold diversity → dock
survivors against ligand-informed structures → prioritize by consensus of ML probability,
docking score, and drug-likeness. Strict per-virus isolation throughout: HIV-1 protease,
HCV NS3/4A, SARS-CoV-2 Mpro, Dengue and Zika NS2B-NS3.

## Sports science and biomechanics

**Athlete Intelligence** *(AlgolyzerLab)* · Go · Next.js 16 · Python

Multi-tenant athlete performance management for elite sport, built on an IOC-aligned clinical
domain: athlete registry, injury and illness register, screening, fitness testing, workload,
return-to-play, and dashboard analytics, with strict tenant isolation and a soft-delete-first
data model so medical history is never destroyed. A separate GPU service runs **RTMPose
(Halpe-26)** over ordinary video and turns it into clinical movement metrics using 2-D geometry
and multi-view triangulation.

**Cricket Bowling Analyzer** *(AlgolyzerLab)* · Python · Go

Biomechanical analysis of a bowling action from a webcam, video, or a single image. MediaPipe
gives 33 landmarks; twelve of them and some plain trigonometry give front-knee angle, elbow
extension, trunk side-bend, and shoulder rotation, all checked against injury-risk ranges and
the ICC's 15° elbow-extension rule. The Go version tracks 18 parameters at 30+ FPS, holds player
profiles by bowler type, and generates PDF reports.

## Agriculture AI

**Agri Remedy** · FastAPI · React 19 · TypeScript

Farmers upload a drone flyover; the app finds diseased patches and explains, in plain English
or বাংলা, what the problem is and what to buy for it.

* **DINOv2-Small** as a frozen feature extractor with staff-trained **linear-probe heads**. The
  backbone supplies general visual understanding for *any* crop, and the crop-specific knowledge
  comes from labelled photos.
* Three-tier fallback so every crop works on day one: trained linear probe → k-NN centroid
  gallery → zero-shot colour/texture heuristic with confidence capped well below a trained
  model.
* Canopy and lesion segmentation drives severity (affected canopy area), the snapshot crop, and
  the anomaly mask; **ISO-6709 GPS** tags read from video metadata via `ffprobe` pin findings on
  a representative aerial frame.
* A staff console for the disease library, the product catalog, and the per-crop models: label
  boxes on real photos, train, and read a genuine cross-validated accuracy.

## Healthcare software

**ChemberIQ** *(AlgolyzerLab)* · Go · Vue 3 · Flutter

A medical case-management platform for doctors and clinics: public doctor portfolio, secure
clinical CRM, AI chatbot, real-time doctor↔patient WebSocket chat, and an offline-first Flutter
doctor app. The doctor types their clinic website, the app discovers the backend, downloads the
dataset, and works fully offline, behind a big-text, big-button UI designed for older doctors.
Search is a purpose-built in-memory engine (prefix → word → contains → token → fuzzy) that
replaced a Meilisearch dependency entirely.

## Systems and developer tools

**[Fennec](https://github.com/shamspias/fennec)** · Go

Zero-dependency library for SSIM/MS-SSIM-guided perceptual image compression: quality
targeting, batch worker pools, auto format selection, Lanczos-3 resize, EXIF auto-orientation,
a target-file-size engine, and context-aware cancellation. 60–90% size reduction at SSIM ≥ 0.94.

**[VoidMon](https://github.com/shamspias/voidmon)** · Go

Terminal system monitor with per-core CPU, cross-platform GPU support (NVIDIA via
`nvidia-smi`, AMD via ROCm, Intel via sysfs, Apple Silicon via `powermetrics`), disk I/O,
network throughput, battery, and top-process tracking.

**[RAG-Scout](https://github.com/shamspias/RAG-Scout)** · Python

Benchmarks sparse, dense, hybrid, late-interaction, and reranked retrieval stacks on any Q/A
dataset, then tells you which one to actually build on.

**[LexSubLM-Lite](https://github.com/shamspias/lexsublm-lite)** · Python

Laptop-friendly lexical substitution: prompted generation via 4-bit causal LLMs, POS and
morphological filtering (spaCy + pymorphy3), log-prob and cosine ranking, research-grade
metrics (P@1, Recall@k, GAP, ProF1), and a YAML registry for swapping models without code.

**[VibeVoice Studio](https://github.com/shamspias/vibevoice-studio)** · Python

Web app over Microsoft's VibeVoice TTS: train a voice from uploaded or recorded audio,
multi-speaker synthesis up to four speakers, cloning, real-time audio visualization, and a
voice library.

**[PlugBot](https://github.com/shamspias/PlugBot)** · Next.js · FastAPI

Dashboard for running many Dify apps and Telegram bots at once: streaming replies, health
checks, encrypted secrets, one-command Docker deploy.

## Dify plugins

Published for the open-source Dify community:

* [**GigaChat model provider**](https://github.com/shamspias/dify-gigachat-plugin): Sber
  GigaChat chat, vision, function calling, and embeddings with configurable scopes and SSL
  handling.
* [**PDF → image converter**](https://github.com/shamspias/dify-pdf-image-converter): page
  rasterization with DPI and quality options, file URLs, batch processing.
* [**Nmap network scanner**](https://github.com/shamspias/dify-nmap): port, OS, service, and
  vulnerability scans with safe-mode defaults and JSON/XML output.
* [**Together AI image**](https://github.com/shamspias/togetherai-dify-image) and
  [**FLUX Fill Pro**](https://github.com/shamspias/flux-fill-pro-plugin-replicate): text-to-image
  and professional inpainting/outpainting.
* [**Telegram**](https://github.com/shamspias/dify-telegram) and
  [**Slack**](https://github.com/shamspias/dify-slack-bot) integrations.

---

The full list, including the experiments that didn't work out, lives on
[GitHub](https://github.com/shamspias?tab=repositories).
