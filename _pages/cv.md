---
layout: archive
title: "Resume-Shamsuddin-Ahmed"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

Summary
======
AI-focused software engineer with 5+ years building back-end services and agentic systems (function calling, tool use,
RAG). Ships reliable, observable AI workflows for ops, support, and document intelligence. Strengths: problem scoping,
evaluation & guardrails, and fast iteration from prototype to production.

Education
======

* **B.Sc. in Computer Science & Engineering**, Daffodil International University, Dhaka
    * Jan 2016 – Nov 2020
    * CGPA: 3.00/4.00

Technical Skills
======

* **Agents/RAG**: Function Calling, Toolformer patterns, LangGraph, LangChain, LlamaIndex, Dify, MCP
* **LLM/Gen-AI**: OpenAI, Gemini, embeddings, prompt design, safety filters, retrieval/evals
* **Vision**: YOLO, OpenCV; edge inference on NPU/embedded
* **Backend**: Python, FastAPI, Django; REST/Webhooks; Celery/async jobs; Docker
* **Data/DB**: PostgreSQL (pgvector), MySQL, MongoDB; Qdrant; ETL
* **ML/DL**: PyTorch, TensorFlow; fine-tuning, distillation, quantization (GGUF)
* **Ops/Obs**: Git, CI/CD, testing (PyTest), logging/tracing, latency/cost budgets

Professional Experience
======

* **Artificial Intelligence Engineer**, Evoclick (Remote – Moscow) — Jun 2024 – Present
    * Built low-latency edge-vision pipeline on NPU devices with YOLO; delivered real-time anomaly/events stream for
      industrial sensors with offline-safe buffering
    * Developed agent-based services using LangGraph & Dify to orchestrate multimodal models on embedded hardware; added
      human-in-the-loop review, retries, and fallbacks
    * Implemented observability hooks (structured logs, trace IDs, basic evals) to monitor accuracy, drift, and SLA
      breaches across devices

* **AI Software Engineer & LLM Researcher**, Evoclick (Remote – Moscow) — May 2023 – Jun 2024
    * Designed legal-tech solutions: document intake → RAG → answer drafting; improved retrieval quality over keyword
      baselines by better chunking, citation prompts, and reranking
    * Led a small RAG/Agents research track; shipped tools via Model Context Protocol (MCP) for safer tool use and
      controllable function calling
    * Created evaluation harnesses (correctness, grounding, refusal policies) and added cost/latency caps with graceful
      degradation

* **Software Engineer**, OMNAIBLE (Remote – Amsterdam) — Oct 2022 – Apr 2023
    * Added ML-powered recommendations to e-commerce analytics platform; exposed as FastAPI microservices with caching
      and background jobs
    * Improved API responsiveness via query refactors and pagination; wrote integration tests to stabilize releases

* **Software / DevOps Engineer**, CodeSmith Tech Ltd. (Dhaka) — Mar 2021 – Aug 2022
    * Automated CI/CD with Docker; hardened REST/GraphQL APIs; introduced monitoring and structured logging for faster
      incident resolution
    * Maintained deployments and unit tests (PyTest), increasing release confidence and reducing regressions

Selected Projects
======

* [**VibeVoice Studio**](https://github.com/shamspias/vibevoice-studio) — AI Voice Synthesis App  
  Web UI + FastAPI for Microsoft VibeVoice TTS; voice cloning/training, multi-speaker mixing, streaming generation,
  downloads

* [**PlugBot**](https://github.com/shamspias/PlugBot) — Dify ↔ Telegram Bridge  
  Next.js dashboard + FastAPI backend to manage multiple Dify apps and Telegram bots; streaming replies, health checks,
  encrypted secrets, Docker one-command deploy

* [**Dify Plugin: GigaChat Model Provider**](https://github.com/shamspias/dify-gigachat-plugin)  
  Adds Sber GigaChat text/vision/function-calling and embeddings to Dify with configurable scopes and SSL handling

* [**Dify Plugin: PDF → Image Converter**](https://github.com/shamspias/dify-pdf-image-converter)  
  Converts PDFs to page images (PNG/JPEG) with DPI/quality options; supports file URLs and batch processing

* [**Dify Plugin: Nmap Network Scanner**](https://github.com/shamspias/dify-nmap)  
  Enterprise-grade Nmap integration (port/OS/service/vuln scans), profiles and safe-mode defaults, JSON/XML outputs

* [**Customizable GPT Chatbot (Agentic Toolkit)**](https://github.com/shamspias/customizable-gpt-chatbot)  
  LangGraph toolkit for tool-calling agents; model swaps, API adapters, workflow customization; includes basic evals and
  cost/latency controls

* [**LexSubLM-Lite**](https://github.com/shamspias/lexsublm-lite) — Contextual Lexical Substitution  
  Lightweight MoE-style masked-LM pipeline; GGUF quantization, POS-aware filtering, ProLex/SWORDS evaluation

Current Ongoing Research
======

**AI-Driven Discovery of Natural Product Inhibitors for Viral Proteases**  
*Multi-source data integration, ML screening, docking validation*

* Aggregate bioactivity data (ChEMBL, BindingDB, PubChem, ZINC, COVID Moonshot); train virus-specific ensemble
  classifiers with scaffold-based splits for generalization
* Screen COCONUT (~695k natural compounds); shortlist via docking with hit threshold ≤ -8.0 kcal/mol; analyze
  interactions at catalytic residues; generate prioritized candidates for wet-lab validation

**Event-Responsive Ad Optimization System**  
*Two-input (product, event) → complete campaign generation*

* Pipeline includes relevance scoring, audience identification, LLM-based keyword/copy/visual generation, channel &
  timing selection, budget pacing, and CTR/ROI prediction; built for sub-5s responses with ethical guardrails
* Architecture implements event impact scoring, tone/visual theming, platform selection, A/B configuration, and
  monitoring. (Results in progress; full bibliography available on request)

Certifications
======

* HackerRank: Problem Solving (Basic & Intermediate), Python (Basic)
* Google: Baseline – Data, ML, AI

Languages
======

* Bangla (Native)
* English (Fluent)