# Session taxonomy

🇪🇸 [Versión en español](TAXONOMY.es.md)

Re:Match tags every session on nine dimensions so the catalog can be explored, filtered and matched beyond the catalog's own labels. Definitions live in [`src/taxonomy/taxonomy.ts`](../src/taxonomy/taxonomy.ts) and the rules in [`src/taxonomy/tagger.ts`](../src/taxonomy/tagger.ts).

| Dimension | Values | Derived from |
|---|---|---|
| **Main topic** (one per session) | 19 topics: AI & ML, Serverless, Containers & Kubernetes, Compute/HPC, Databases, Analytics & Streaming, Storage, Application Integration & Events, Networking, Security, Observability & Operations, Developer Tools, Architecture & Resilience, Migration & Modernization, Cost & FinOps, Business & Leadership, Hybrid & Edge, Industry, Learning & Community | The AWS track in the session code (`SVS` → Serverless, `ARC` → Architecture…); for tracks without one (`INV`, `AMZ`), the first catalog topic |
| **Topics** (several) | Same 19 | Catalog `topics`, `areasOfInterest`, `services`, `industries`, and keywords in the **title** |
| **AI subtopic** | Agentic AI, Generative AI & LLMs, RAG & search, MCP, ML training & MLOps, AI infrastructure, AI for developers, Responsible AI & evaluation | Only for sessions in the AI topic; areas, services and title keywords |
| **Technology** | Every AWS service in the catalog (short names such as "Amazon EKS") plus Kafka, Kubernetes, Iceberg, Spark, Flink, PostgreSQL, OpenTelemetry, Terraform, MCP, AgentCore, Strands, Powertools, languages | Catalog `services`; title and abstract for the rest |
| **Audience** | Developer, Architect, DevOps & Operations, Data & ML, Security, Technical leadership, Business & strategy, Explorer & research | Catalog `roles`, grouped |
| **Learning style** | Hands-on build, Interactive discussion, Live coding, Presentation, Certification prep | Session format |
| **Content type** | Customer story, Partner/sponsored, Community-led, Launches, Deep technical, Patterns & trade-offs, Getting started, Leadership & strategy, Research & innovation | Features, code suffix/prefix, level, architecture depth, title keywords |
| **Concept** | Resilience & DR, Multi-Region, Event-driven, Microservices & decoupling, Multi-tenant & SaaS, Cell-based, Distributed data & transactions, Scale & performance, Cost optimization, Observability, Zero trust, Multi-account, Platform engineering, IaC, Data governance, Modernization, Sovereignty | Areas of interest and keywords in title/abstract |
| **Level** | 100, 200, 300, 400–500 | Catalog `level` |

Plus logistics: day, venue and AWS track.

## Rules of thumb

- **Titles decide topics; abstracts only add technologies and concepts.** Abstracts mention everything ("…with AI…"), so topic keywords are searched in titles only.
- **One main topic, many topics.** AI appears in 71% of re:Invent 2026 sessions, so "AI" as a flat label says little; the main topic keeps each session in one place for counts and cross-tabs.
- **The catalog's labels are respected, including its noise.** A session the catalog tags `Serverless` is tagged Serverless even if the title is about LLM inference.

## Using it

- `rematch report <eventId>` prints every dimension with counts; `--json` returns the tagged sessions.
- **Insights** in the web app: click any bar or heatmap cell to filter; every chart and the session list follow the filters.
