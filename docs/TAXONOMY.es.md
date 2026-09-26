# Taxonomía de sesiones

🇬🇧 [English version](TAXONOMY.md)

Reinvent:Match etiqueta cada sesión en nueve dimensiones para explorar, filtrar y hacer match más allá de las etiquetas propias del catálogo. Las definiciones están en [`src/taxonomy/taxonomy.ts`](../src/taxonomy/taxonomy.ts) y las reglas en [`src/taxonomy/tagger.ts`](../src/taxonomy/tagger.ts).

| Dimensión | Valores | De dónde sale |
|---|---|---|
| **Tema principal** (uno por sesión) | 21 temas: IA y ML, Serverless, Contenedores y Kubernetes, Cómputo/HPC, Bases de datos, Analítica y streaming, Almacenamiento, Integración y eventos, Redes, Seguridad, Observabilidad y operación, Herramientas de desarrollo, Arquitectura y resiliencia, Migración y modernización, Costos y FinOps, Aplicaciones de negocio, Liderazgo y estrategia, Partners y Marketplace, Híbrido y edge, Industrias, Aprendizaje y comunidad | El track de AWS en el código de la sesión (`SVS` → Serverless, `ARC` → Arquitectura, `SNR`/`AMZ` → Liderazgo, `PEX` → Partners…); para tracks sin tema (`INV`), el primer tema del catálogo |
| **Temas** (varios) | Los mismos 19 | `topics`, `areasOfInterest`, `services` e `industries` del catálogo, y palabras clave en el **título** |
| **Subtema de IA** | IA agéntica, IA generativa y LLMs, RAG y búsqueda, MCP, entrenamiento y MLOps, infraestructura de IA, IA para desarrolladores, IA responsable y evaluación | Solo en sesiones del tema IA; áreas, servicios y palabras del título |
| **Tecnología** | Todos los servicios de AWS del catálogo (nombres cortos como "Amazon EKS") más Kafka, Kubernetes, Iceberg, Spark, Flink, PostgreSQL, OpenTelemetry, Terraform, MCP, AgentCore, Strands, Powertools y lenguajes | `services` del catálogo; título y abstract para el resto |
| **Audiencia** | Desarrollador, Arquitecto, DevOps y operación, Datos y ML, Seguridad, Liderazgo técnico, Negocio y estrategia, Exploradores e investigación | `roles` del catálogo, agrupados |
| **Estilo de aprendizaje** | Construir (hands-on), Discusión interactiva, Código en vivo, Presentación, Preparación de certificación | Formato de la sesión |
| **Tipo de contenido** | Caso de cliente, Partner/patrocinada, Comunidad, Lanzamientos, Técnica profunda, Patrones y trade-offs, Para empezar, Liderazgo y estrategia, Investigación e innovación | Features, sufijo/prefijo del código, nivel, profundidad de arquitectura, palabras del título |
| **Concepto** | Resiliencia y DR, Multi-Region, Event-driven, Microservicios y desacoplamiento, Multi-tenant y SaaS, Cell-based, Datos distribuidos y transacciones, Escala y rendimiento, Optimización de costos, Observabilidad, Zero trust, Multi-cuenta, Platform engineering, IaC, Gobierno de datos, Modernización, Soberanía | Áreas de interés y palabras en título/abstract |
| **Plataforma** | Microsoft & .NET, SAP, VMware, Oracle, Mainframe (central o mencionada) | Áreas, servicios y palabras del título (central); abstract (mención) |
| **Nivel** | 100, 200, 300, 400–500 | `level` del catálogo |

Además, logística: día, venue y track de AWS.

## Criterios

- **El título decide los temas; el abstract solo suma tecnologías y conceptos.** Los abstracts mencionan de todo ("…con IA…"), así que las palabras de tema se buscan solo en el título.
- **Un tema principal, varios temas.** La IA aparece en el 71% de las sesiones de re:Invent 2026, así que "IA" como etiqueta plana dice poco; el tema principal ubica cada sesión en un solo lugar para conteos y cruces.
- **Se respetan las etiquetas del catálogo, incluido su ruido.** Si el catálogo marca una sesión como `Serverless`, queda como Serverless aunque el título hable de inferencia de LLMs.

## Cómo usarla

- `reinvent-match report <eventId>` imprime cada dimensión con sus conteos; `--json` devuelve las sesiones etiquetadas.
- **Insights** en la app: haz clic en cualquier barra o celda del heatmap para filtrar; todas las gráficas y la lista de sesiones siguen los filtros.
