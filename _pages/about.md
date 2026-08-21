---
permalink: /
title: "Shamsuddin Ahmed"
excerpt: "Senior Software Engineer — agent harnesses, LLM infrastructure, and machine learning for biology."
author_profile: true
redirect_from:
  - /about/
  - /about.html
---

I'm a software engineer from Dhaka, Bangladesh, with **five-plus years** spent on the same
stubborn question: *how do you take something that works in a notebook and make it survive
real users?*

Most of my work sits in three places — **backend systems**, **production machine learning**,
and the **harness layer** that lets a language model safely operate software that already
exists. Lately a fourth has crept in: **machine learning for biology**, where the datasets are
small, the labels are noisy, and being honest about your numbers matters more than beating a
leaderboard.

---

## Right now

#### Senior Software Engineer — [Mevrik](https://mevrik.com)
*Dhaka · since August 2026*

Mevrik is an AI-powered customer-experience platform used by telecom operators and hundreds of
smaller businesses. I work on the AI side of the product: agents, retrieval, and the serving
infrastructure underneath them.

#### Founder — AlgolyzerLab

A small studio I run for applied-AI work that doesn't fit neatly into a product roadmap:
sports-science tooling for elite cricket, clinical case-management software for doctors,
agriculture AI, and research engineering. Small team, real deployments, unglamorous problems.

---

## Before that

**Senior Software Engineer → Software Engineer, Evoclick** — Moscow (remote) · 2023 – 2026

Deployed quantised **Qwen 3.5 27B** (INT4 / FP8) on **vLLM** for a workload serving 1,000+
concurrent users, and built the OpenAI-compatible gateway that routed traffic to it. Shipped a
multi-tenant AI orchestration platform with a DAG workflow engine, layout-aware
(“page-index”) RAG for document understanding, LoRA/QLoRA fine-tunes for domain tasks, and a
YOLO edge-vision pipeline running on NPU hardware.

**Software Engineer, OMNAIBLE** — Amsterdam (remote) · 2022 – 2023

ML-powered recommendation microservices in FastAPI, plus the caching and query work that made
them fast enough to keep.

**Software / DevOps Engineer, CodeSmith Tech** — Dhaka · 2021 – 2022

Docker-based CI/CD, hardened REST and GraphQL APIs, and IoT data-ingestion backends.

---

## What I'm thinking about

**Agent harnesses.** A model is only as useful as the surface you give it. I'm convinced most
teams hand an LLM the wrong thing — raw tables and auto-generated OpenAPI specs instead of the
intent-named operations their own code already has. That idea drives
[**Reins**](https://github.com/shamspias/reins), a small harness you bolt onto an app so a
model can drive it safely, and [**Veldra**](https://github.com/shamspias/customizable-gpt-chatbot),
where an agent is stored as *data* — a versioned spec row — rather than code.

**Machine learning for biology.** I work on anti-inflammatory peptide prediction
(**AIPpred-Stack**, with collaborators at the University of Saskatchewan — IEEE CCECE 2026) and
on structure-aware virtual screening of natural products against understudied viral proteases
([**DeepNatProtease**](https://github.com/shamspias/DeepNatProtease)). Both taught me the same
lesson: the dataset you choose decides your result long before the model does.

**Systems that stay explainable.** [Fennec](https://github.com/shamspias/fennec) (SSIM-guided
image compression in Go), [VoidMon](https://github.com/shamspias/voidmon) (a terminal system
monitor), [Clawkido](https://github.com/shamspias/clawkido) (actor-model agent swarms) — small,
readable, zero-magic tools I actually use.

---

## Tools I reach for

| | |
|---|---|
| **Languages** | Go · Python · TypeScript |
| **AI / ML** | LangGraph · LangChain · vLLM · PyTorch · LoRA/QLoRA · MCP · Dify |
| **Vision** | YOLO · SAM · DINOv2 · MediaPipe / RTMPose · OpenCV |
| **Data** | PostgreSQL + pgvector · Qdrant · MongoDB · Redis |
| **Infra** | Docker · Nginx · Coolify · CI/CD · GPU and NPU deployment |

---

## Writing

I write to understand things, not to look clever. The posts here explain hard ideas the way I
wish someone had explained them to me — with analogies, runnable code, and honest numbers.
Start with the [**blog archive**](/year-archive/), or read the
[**CV**](/cv/) if you'd rather see the short version.

Say hello: **[info@shamspias.com](mailto:info@shamspias.com)** ·
[GitHub](https://github.com/shamspias) · [LinkedIn](https://www.linkedin.com/in/shamspias0)
