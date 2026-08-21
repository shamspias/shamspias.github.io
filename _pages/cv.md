---
layout: archive
title: "Curriculum Vitae"
permalink: /cv/
author_profile: true
redirect_from:
  - /resume
---

{% include base_path %}

**Senior Software Engineer** · Dhaka, Bangladesh

[info@shamspias.com](mailto:info@shamspias.com) · [shamspias.com](https://shamspias.com) ·
[github.com/shamspias](https://github.com/shamspias) ·
[linkedin.com/in/shamspias0](https://www.linkedin.com/in/shamspias0)

## Profile

Software engineer with over five years of professional experience designing scalable backend
systems, production machine-learning infrastructure, and developer tooling. Core expertise in
**Go** and **Python**, with hands-on experience deploying large language models at scale,
building multi-tenant platforms, and shipping real-time computer-vision pipelines. Active
research interests in computational biology — anti-inflammatory peptide prediction and
structure-aware virtual screening for drug discovery. Comfortable across the whole path from
research prototype to deployed service, including IoT and embedded edge inference. Open-source
contributor and Dify plugin author.

## Professional Experience

**Senior Software Engineer** — Mevrik, Dhaka · *Aug 2026 – Present*

Mevrik is an AI-powered customer-experience platform serving telecom operators and 700+ SMB
customers.

* Work across the AI surface of the product: conversational agents, retrieval, and the model
  serving infrastructure beneath them.
* Design and document feature specifications for engineering teams and leadership.

**Founder** — AlgolyzerLab · *2024 – Present*

An applied-AI studio for work that does not fit a standard product roadmap.

* **Athlete Intelligence** — multi-tenant athlete performance management system for elite
  sport (Go + `chi` + GORM + PostgreSQL, Next.js 16 / React 19 frontend), with an IOC-aligned
  clinical domain, strict tenant isolation, injury and illness registers, screening, workload,
  return-to-play tracking, and a CUDA **RTMPose (Halpe-26)** video pipeline that converts
  ordinary clips into clinical movement metrics via 2-D geometry and multi-view triangulation.
* **ChemberIQ** — full-stack medical case-management platform for doctors and clinics: Go/Gin
  REST API, Vue 3 SPA, WebSocket doctor↔patient chat, an offline-first **Flutter** doctor app
  that auto-discovers its backend and delta-syncs the medical dataset, and a purpose-built
  in-memory search engine (prefix → word → contains → token → fuzzy) that replaced Meilisearch.
* **Agri Remedy** — drone-based crop-disease monitoring: FastAPI backend with a **DINOv2**
  linear-probe classifier, canopy/lesion localization, ISO-6709 GPS extraction from video
  metadata, bilingual (English / বাংলা) treatment guidance, and a React 19 + TypeScript SPA.
* **Cricket Bowling Analyzer** — biomechanical analysis of bowling actions from video:
  18 parameters at 30+ FPS via MediaPipe pose estimation, automatic ICC 15° elbow-extension
  compliance checks, and PDF clinical reports.
* **Eventaic** — event-responsive advertising platform (FastAPI, Vue, PostgreSQL) that turns a
  live event plus a product into a complete, evaluated ad campaign.

**Senior Software Engineer** — Evoclick, Moscow (Remote) · *Jun 2024 – Jul 2026*

* Deployed **Qwen 3.5 27B** (INT4 and FP8 quantized) on **vLLM** for production workloads
  serving 1,000+ concurrent users; tuned throughput through continuous batching, KV-cache
  sizing, and quantization strategy selection.
* Built an OpenAI-compatible **LLM Gateway** (FastAPI, httpx) as a routing proxy with rerank
  support, error enrichment, and benchmark endpoints across multi-tenant workloads.
* Deployed and operated embedding models, vision-embedding models, and document regioning
  models on production GPU infrastructure.
* Implemented **page-index RAG**, combining layout-aware region extraction with vector
  retrieval for document understanding.
* Built an edge-vision pipeline with **YOLO on NPU hardware** for real-time anomaly detection,
  with offline-safe buffering for intermittently connected sites.
* Developed multi-agent services with **LangGraph** and **Dify** including human-in-the-loop
  review, retries, and provider fallback; shipped tool integrations over the **Model Context
  Protocol (MCP)**.
* Added observability hooks — structured logs, trace IDs, and evaluation harnesses — to track
  accuracy, drift, and SLA breaches across deployed devices.

**Software Engineer** — Evoclick, Moscow (Remote) · *May 2023 – Jun 2024*

* Designed legal-tech RAG systems (document intake → retrieval → answer drafting); improved
  retrieval quality over keyword baselines through better chunking, embedding selection,
  citation prompting, and reranking.
* Fine-tuned LLMs with **LoRA/QLoRA** (Unsloth) for domain-specific tasks; led the internal
  R&D track on agents and retrieval.
* Architected a multi-tenant AI orchestration platform (FastAPI, Vue 3, PostgreSQL/pgvector,
  Docker) with a DAG-based workflow engine and SSE streaming — comparable in scope to n8n or
  Dify.
* Built and maintained Dify plugins and workflow integrations for client deployments
  (GigaChat provider, FLUX Fill Pro, Together AI Image, Telegram Bot).

**Software Engineer** — OMNAIBLE, Amsterdam (Remote) · *Oct 2022 – Apr 2023*

* Added ML-powered recommendations to an e-commerce analytics platform, exposed as FastAPI
  microservices with caching and background jobs.
* Improved API responsiveness through query refactoring and pagination; wrote integration
  tests that stabilized releases.

**Software / DevOps Engineer** — CodeSmith Tech Ltd., Dhaka · *Mar 2021 – Aug 2022*

* Automated CI/CD pipelines with Docker; hardened REST and GraphQL APIs with monitoring and
  structured logging for faster incident resolution.
* Maintained deployments and unit tests (PyTest), increasing release confidence.
* Worked on IoT-integrated backend systems for sensor data ingestion and device communication.

## Education

**B.Sc. in Computer Science & Engineering** — Daffodil International University, Dhaka ·
*Jan 2016 – Nov 2020*

* Coursework: Data Structures, Algorithms, Machine Learning, Data Mining, Computer Networks,
  Database Systems, Software Engineering, Embedded Systems, Robotics.
* Final-year research on machine-learning applications in computational biology.

## Technical Skills

| Area | Tools |
|---|---|
| **Languages** | Go (Gin, `chi`, concurrency, actor model), Python (FastAPI, Django), TypeScript/JavaScript, C/C++ |
| **Agents & RAG** | LangGraph, LangChain, LlamaIndex, Dify, MCP, function calling, DAG workflow engines, evaluation harnesses |
| **LLM Ops** | vLLM (INT4/FP8 quantization), continuous batching, KV-cache tuning, embedding and vision-embedding models, reranking, benchmarking |
| **ML / DL** | PyTorch, TensorFlow, LoRA/QLoRA fine-tuning, distillation, GGUF quantization, linear probing, stacking ensembles |
| **Computer Vision** | YOLO, SAM, DINOv2, MediaPipe, RTMPose, OpenCV, NPU/embedded edge inference |
| **Comp. Biology** | RDKit, ChemProp, ESM-2 protein embeddings, molecular docking, scaffold-aware splits, ChEMBL/BindingDB/PubChem/COCONUT pipelines |
| **Data** | PostgreSQL (pgvector), MySQL, MongoDB, Qdrant, Pinecone, FAISS, Redis, ETL |
| **Infrastructure** | Docker, Nginx, Coolify, CI/CD, GPU deployment, Linux administration, S3/R2/MinIO |
| **Frontend** | Vue 3, Next.js, React, Flutter (working proficiency for full-stack delivery) |
| **Practices** | PyTest, observability and tracing, latency/cost budgets, Celery/async jobs, technical specification writing |

## Research

**AIPpred-Stack: Prediction of Anti-Inflammatory Peptides using Ensemble Learning with an
Experimentally Validated Dataset**

*Abdullah Al Mamun, Shamsuddin Ahmed, Francis M. Bui* — IEEE CCECE 2026 ·
University of Saskatchewan and Daffodil International University

* Two-stage stacking ensemble combining ~2,282 hand-crafted sequence descriptors (AAC, DPC,
  DDE, CKSAAP, CTD, PAAC, QSO, autocorrelation, physicochemical) with 1,280-dimensional
  **ESM-2** protein language model embeddings.
* The core contribution is a dataset correction: prior work drew negatives from random UniProt
  proteins, which turns the task into "short peptide vs. long protein". We use experimentally
  validated negatives from the same **IEDB** T-cell assays as the positives, and report the
  harder, more honest numbers that result.

**AI-Driven Discovery of Natural-Product Inhibitors of Viral Proteases** *(DeepNatProtease,
ongoing)*

* Integrates per-virus bioactivity data from ChEMBL, BindingDB, PubChem BioAssay, ZINC, and
  COVID Moonshot with full provenance; standardizes molecules and harmonizes units to nM.
* Enforces **scaffold-aware (Bemis–Murcko) splits** with zero scaffold overlap, then trains
  virus-specific model families (ChemProp GNN ensembles, RF/XGBoost/LightGBM/DNN) selected on
  pre-registered metrics.
* Screens the **COCONUT** natural-products library (>400k compounds), filters for
  PAINS/toxicophores and scaffold diversity, and docks survivors against ligand-informed
  protease structures — prioritizing candidates by consensus of ML probability, docking score,
  and drug-likeness.
* Targets: HIV-1 protease, HCV NS3/4A, SARS-CoV-2 Mpro, Dengue and Zika NS2B-NS3.

**Other interests**

* **NLP & lexical semantics** — context-aware lexical substitution with lightweight models;
  evaluation methodology for synonym generation (LexSubLM-Lite, benchmarked on SWORDS, ProLex,
  TSAR-2022).
* **AI systems** — multi-agent orchestration architectures, efficient LLM inference at scale,
  and layout-aware retrieval for document understanding.

## Selected Open-Source Projects

* [**Reins**](https://github.com/shamspias/reins) — a lightweight agent harness you bolt onto
  an existing app. Point it at your functions or ORM models and it derives intent-named
  capabilities, keeps reads and writes strictly separated in code, gates writes behind policy
  and approval, and runs everything through your own validation instead of raw SQL.
* [**Veldra**](https://github.com/shamspias/customizable-gpt-chatbot) — a self-hostable,
  local-first agent-harness platform where an agent is *data*, not code: a versioned
  `AgentSpec` row that the runtime interprets. Natural-language agent construction, MCP
  connectors, editable RAG knowledge bases, a visual workflow builder, agent teams, and
  feedback-driven self-improvement.
* [**Fennec**](https://github.com/shamspias/fennec) — zero-dependency Go library for
  SSIM/MS-SSIM-guided perceptual image compression: worker-pool batching, auto format
  selection, Lanczos-3 resize, target-file-size engine. 60–90% size reduction at SSIM ≥ 0.94.
* [**Clawkido**](https://github.com/shamspias/clawkido) — Go actor-model multi-agent swarm
  engine: goroutine-per-agent routing, swarm handoff, extensible skills, provider fallback
  (OpenAI/Groq/Ollama), Telegram and Discord integration. Single binary, ~50 MB RAM.
* [**VoidMon**](https://github.com/shamspias/voidmon) — high-performance Go TUI system monitor
  with per-core CPU, cross-platform GPU (NVIDIA/AMD/Intel/Apple Silicon), disk I/O, network,
  and process tracking.
* [**DeepNatProtease**](https://github.com/shamspias/DeepNatProtease) — the virtual-screening
  pipeline described above: curation, scaffold-aware splitting, model training, COCONUT
  screening, docking, and prioritization.
* [**LexSubLM-Lite**](https://github.com/shamspias/lexsublm-lite) — laptop-friendly lexical
  substitution toolkit: prompted generation via 4-bit causal LLMs, POS and morphological
  filtering (spaCy + pymorphy3), log-prob and cosine ranking, research-grade metrics
  (P@1, Recall@k, GAP, ProF1), and a YAML model registry for zero-code model swaps.
* [**RAG-Scout**](https://github.com/shamspias/RAG-Scout) — test harness that benchmarks
  sparse, dense, hybrid, late-interaction, and reranked retrieval stacks on any Q/A dataset
  and reports which one to build on.
* [**VibeVoice Studio**](https://github.com/shamspias/vibevoice-studio) — FastAPI + web UI for
  Microsoft VibeVoice TTS: voice training from uploaded or recorded audio, multi-speaker
  synthesis, cloning, and a voice library.
* [**PlugBot**](https://github.com/shamspias/PlugBot) — Next.js dashboard and FastAPI backend
  for managing many Dify apps and Telegram bots: streaming replies, health checks, encrypted
  secrets, one-command Docker deploy.
* **Dify plugins** —
  [GigaChat provider](https://github.com/shamspias/dify-gigachat-plugin),
  [PDF → image converter](https://github.com/shamspias/dify-pdf-image-converter),
  [Nmap network scanner](https://github.com/shamspias/dify-nmap),
  [Together AI image](https://github.com/shamspias/togetherai-dify-image),
  [FLUX Fill Pro](https://github.com/shamspias/flux-fill-pro-plugin-replicate),
  and [Telegram integration](https://github.com/shamspias/dify-telegram).

## Certifications

* **HackerRank** — Problem Solving (Basic, Intermediate), Python
* **Google** — Data Analytics, Machine Learning, and AI fundamentals

## Languages

* **Bangla** — native
* **English** — fluent (professional working proficiency)
