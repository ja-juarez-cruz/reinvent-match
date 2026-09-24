/**
 * Re:Match taxonomy: the dimensions every session is tagged on. Rules combine the catalog's own labels (topics,
 * areas of interest, services, roles), the AWS track in the session code and keywords in the title/abstract.
 * Matching uses normalized, word-boundary text (see ../match/labels.ts).
 */

export interface Rule {
  topics?: string[];
  areas?: string[];
  /** Matched against service aliases, so "EKS" matches "Amazon Elastic Kubernetes Service (Amazon EKS)". */
  services?: string[];
  /** Searched in the title only: titles state what a session is about; abstracts mention everything. */
  titleKeywords?: string[];
  /** Searched in title and abstract. */
  textKeywords?: string[];
}

export interface TagDefinition extends Rule {
  id: string;
  label: string;
}

export const DOMAINS: TagDefinition[] = [
  {
    id: "ai",
    label: "AI & Machine Learning",
    topics: ["Artificial Intelligence", "Business Agents"],
    areas: ["Agentic AI", "Generative AI", "Machine Learning", "Responsible AI"],
    services: ["Bedrock", "SageMaker", "SageMaker AI", "Nova", "Trainium", "Inferentia", "Q", "AgentCore"],
    titleKeywords: ["AI", "agent", "agents", "agentic", "generative", "GenAI", "LLM", "LLMs", "machine learning", "RAG", "MCP"],
  },
  {
    id: "serverless",
    label: "Serverless",
    topics: ["Serverless"],
    areas: ["Lambda-Based Applications", "Serverless"],
    services: ["Lambda", "Step Functions", "API Gateway", "App Runner"],
    titleKeywords: ["serverless", "Lambda", "Step Functions", "durable functions"],
  },
  {
    id: "containers",
    label: "Containers & Kubernetes",
    topics: ["Containers"],
    areas: ["Kubernetes", "Containers"],
    services: ["EKS", "ECS", "Fargate", "ECR"],
    titleKeywords: ["Kubernetes", "K8s", "container", "containers", "EKS", "ECS", "Karpenter"],
  },
  {
    id: "compute",
    label: "Compute, HPC & Quantum",
    topics: ["Compute"],
    services: ["EC2", "Graviton", "Batch", "Parallel Computing Service", "ParallelCluster", "Braket", "EC2 Linux"],
    titleKeywords: ["HPC", "Graviton", "EC2", "GPU", "GPUs", "quantum", "instances"],
  },
  {
    id: "databases",
    label: "Databases",
    topics: ["Databases"],
    services: [
      "DynamoDB",
      "Aurora",
      "Aurora for PostgreSQL",
      "Aurora DSQL",
      "RDS",
      "ElastiCache",
      "Neptune",
      "DocumentDB",
      "Keyspaces",
      "MemoryDB",
      "Timestream",
    ],
    titleKeywords: ["database", "databases", "DynamoDB", "Aurora", "PostgreSQL", "SQL", "NoSQL", "data modeling", "graph"],
  },
  {
    id: "analytics",
    label: "Analytics, Streaming & Data",
    topics: ["Analytics"],
    areas: ["Business Intelligence", "Open Data"],
    services: [
      "Redshift",
      "Athena",
      "Glue",
      "EMR",
      "Kinesis",
      "MSK",
      "OpenSearch",
      "OpenSearch Service",
      "QuickSight",
      "DataZone",
      "Lake Formation",
      "Managed Service for Apache Flink",
    ],
    titleKeywords: ["analytics", "data lake", "lakehouse", "Iceberg", "streaming", "Kafka", "ETL", "data pipeline", "data pipelines", "BI"],
  },
  {
    id: "storage",
    label: "Storage & Backup",
    topics: ["Storage"],
    services: ["S3", "EBS", "EFS", "FSx for NetApp ONTAP", "FSx", "Backup", "Storage Gateway"],
    titleKeywords: ["S3", "storage", "backup", "EBS", "file system"],
  },
  {
    id: "integration",
    label: "Application Integration & Events",
    topics: ["Application Integration"],
    areas: ["Event-Driven Architecture"],
    services: ["EventBridge", "SQS", "SNS", "MQ", "AppSync"],
    titleKeywords: ["event-driven", "events", "messaging", "queue", "queues", "pub/sub", "orchestration", "orchestrating", "workflow", "workflows", "EventBridge"],
  },
  {
    id: "networking",
    label: "Networking & Content Delivery",
    topics: ["Networking & Content Delivery"],
    areas: ["Global Infrastructure", "Edge Computing"],
    services: ["VPC", "CloudFront", "Route 53", "Direct Connect", "Transit Gateway", "VPC Lattice", "ELB", "Global Accelerator"],
    titleKeywords: ["network", "networks", "networking", "VPC", "DNS", "CDN", "CloudFront", "PrivateLink"],
  },
  {
    id: "security",
    label: "Security, Identity & Compliance",
    topics: ["Security & Identity"],
    areas: [
      "Application Security",
      "Governance, Risk & Compliance",
      "Identity & Access Management",
      "Data Protection",
      "Threat Detection & Incident Response",
      "DevSecOps",
      "Network & Infrastructure Security",
      "Culture of Security",
      "Threat Intelligence",
      "Digital Sovereignty",
    ],
    services: ["IAM", "KMS", "GuardDuty", "Security Hub", "WAF", "Cognito", "Security Agent", "STS", "Macie", "Inspector", "Secrets Manager", "Verified Access"],
    titleKeywords: ["security", "secure", "zero trust", "identity", "compliance", "threat", "threats", "IAM", "permissions", "encryption"],
  },
  {
    id: "observability",
    label: "Observability & Operations",
    topics: ["Cloud Operations"],
    areas: ["Monitoring & Observability", "Management & Governance", "Automation", "DevOps"],
    services: ["CloudWatch", "X-Ray", "Distro for OpenTelemetry", "CloudTrail", "Systems Manager", "Config", "DevOps Agent", "Managed Service for Prometheus", "Managed Grafana"],
    titleKeywords: ["observability", "monitoring", "operations", "incident", "incidents", "SRE", "telemetry", "OpenTelemetry", "CloudWatch", "ops"],
  },
  {
    id: "devtools",
    label: "Developer Tools & Open Source",
    topics: ["Developer Tools", "Open Source"],
    areas: ["Front-End Web & Mobile"],
    services: ["Kiro", "Cloud Development Kit", "CDK", "CloudFormation", "Amplify", "CodePipeline", "CodeBuild"],
    titleKeywords: ["developer", "developers", "CI/CD", "infrastructure as code", "IaC", "Kiro", "CDK", "Terraform", "IDE", "coding", "open source", "spec-driven"],
  },
  {
    id: "architecture",
    label: "Architecture & Resilience",
    topics: ["Architecture"],
    areas: ["Resilience", "Well-Architected Framework", "Disaster Response & Recovery"],
    services: ["Resilience Hub", "Application Recovery Controller", "Fault Injection Service"],
    titleKeywords: ["architecture", "architectures", "architect", "architecting", "resilient", "resilience", "multi-Region", "Well-Architected", "patterns", "trade-offs", "cell-based", "disaster recovery"],
  },
  {
    id: "migration",
    label: "Migration & Modernization",
    topics: ["Migration & Modernization"],
    areas: ["VMware", "Microsoft & .NET", "SAP"],
    services: ["Transform", "Application Migration Service", "Database Migration Service"],
    titleKeywords: ["migration", "migrate", "migrating", "modernization", "modernize", "modernizing", "mainframe", "legacy", "VMware", ".NET"],
  },
  {
    id: "cost",
    label: "Cost & FinOps",
    areas: ["Cost Optimization"],
    services: ["Billing and Cost Management", "Cost Explorer"],
    titleKeywords: ["cost", "costs", "FinOps", "pricing", "spend", "economics"],
  },
  {
    id: "business",
    label: "Business, Leadership & Partners",
    topics: ["Business Applications"],
    areas: ["Innovation & Transformation", "Customer Enablement", "Learning from Amazon", "Tech for Impact", "SaaS"],
    services: ["Connect", "Quick", "Quick Suite", "Marketplace"],
    titleKeywords: ["leader", "leaders", "leader's", "strategy", "business", "executive", "executives", "ROI", "transformation", "partner", "partners"],
  },
  {
    id: "hybrid",
    label: "Hybrid, Edge & Multicloud",
    topics: ["Hybrid Cloud & Multicloud"],
    services: ["Outposts", "Local Zones", "EKS Anywhere", "Wavelength"],
    titleKeywords: ["hybrid", "edge", "multicloud", "on-premises", "sovereign", "sovereignty"],
  },
  {
    id: "industry",
    label: "Industry Solutions",
    topics: ["Industry Solutions"],
  },
  {
    id: "learning",
    label: "Learning, Certification & Community",
    areas: ["Training & Certification"],
    titleKeywords: ["certification", "certified", "exam", "career", "careers", "skills"],
  },
];

/** AWS tracks encoded in the session code prefix, with the domain each one is primarily about. */
export const TRACKS: Record<string, { label: string; domain?: string }> = {
  AIM: { label: "AI/ML", domain: "ai" },
  SEC: { label: "Security", domain: "security" },
  IND: { label: "Industries", domain: "industry" },
  MAM: { label: "Migration & Modernization", domain: "migration" },
  DAT: { label: "Databases", domain: "databases" },
  STG: { label: "Storage", domain: "storage" },
  CMP: { label: "Compute", domain: "compute" },
  COP: { label: "Cloud Operations", domain: "observability" },
  BIZ: { label: "Business Applications", domain: "business" },
  ANT: { label: "Analytics", domain: "analytics" },
  CON: { label: "Containers", domain: "containers" },
  DVT: { label: "Developer Tools", domain: "devtools" },
  ARC: { label: "Architecture", domain: "architecture" },
  SVS: { label: "Serverless", domain: "serverless" },
  TNC: { label: "Training & Certification", domain: "learning" },
  NET: { label: "Networking", domain: "networking" },
  COM: { label: "Community", domain: "learning" },
  HMC: { label: "Hybrid & Multicloud", domain: "hybrid" },
  PEX: { label: "Partner Experience", domain: "business" },
  INV: { label: "Innovation talks (500)" },
  GHJ: { label: "AI League (gamified)", domain: "ai" },
  OPN: { label: "Open Source", domain: "devtools" },
  API: { label: "Application Integration", domain: "integration" },
  SNR: { label: "Senior leaders", domain: "business" },
  AMZ: { label: "Amazon stories" },
};

export const AI_SUBTOPICS: TagDefinition[] = [
  {
    id: "agentic-ai",
    label: "Agentic AI & agents",
    areas: ["Agentic AI"],
    services: ["AgentCore"],
    titleKeywords: ["agent", "agents", "agentic", "multi-agent", "AgentCore", "Strands"],
  },
  { id: "generative-ai", label: "Generative AI & LLMs", areas: ["Generative AI"], titleKeywords: ["generative", "GenAI", "LLM", "LLMs", "foundation model", "foundation models", "Nova", "prompt"] },
  { id: "rag", label: "RAG, search & knowledge", titleKeywords: ["RAG", "retrieval", "vector", "knowledge base", "knowledge bases", "semantic", "embeddings", "search"] },
  { id: "mcp", label: "MCP & tool integration", textKeywords: ["MCP", "Model Context Protocol"] },
  { id: "ml-training", label: "ML training & MLOps", areas: ["Machine Learning"], services: ["SageMaker", "SageMaker AI"], titleKeywords: ["training", "fine-tuning", "fine-tune", "MLOps", "reinforcement", "RLVR", "model customization"] },
  { id: "ai-infra", label: "AI infrastructure & inference", services: ["Trainium", "Inferentia"], titleKeywords: ["inference", "Trainium", "Inferentia", "GPU", "GPUs", "accelerated"] },
  { id: "ai-dev", label: "AI for developers", services: ["Kiro", "Q"], titleKeywords: ["Kiro", "coding agent", "coding agents", "AI-native development", "AI-assisted", "spec-driven", "vibe"] },
  { id: "responsible-ai", label: "Responsible AI, evaluation & safety", areas: ["Responsible AI"], titleKeywords: ["evaluation", "evaluate", "evals", "guardrails", "safety", "trust", "responsible", "hallucination", "hallucinations"] },
];

/** Technologies worth tagging that the catalog does not list as AWS services. Searched in title and abstract. */
export const EXTRA_TECHNOLOGIES: { label: string; keywords: string[]; domain: string }[] = [
  { label: "Apache Kafka", keywords: ["Kafka"], domain: "analytics" },
  { label: "Kubernetes", keywords: ["Kubernetes", "K8s"], domain: "containers" },
  { label: "Karpenter", keywords: ["Karpenter"], domain: "containers" },
  { label: "Apache Iceberg", keywords: ["Iceberg"], domain: "analytics" },
  { label: "Apache Spark", keywords: ["Spark"], domain: "analytics" },
  { label: "Apache Flink", keywords: ["Flink"], domain: "analytics" },
  { label: "PostgreSQL", keywords: ["PostgreSQL", "Postgres"], domain: "databases" },
  { label: "OpenTelemetry", keywords: ["OpenTelemetry", "OTel"], domain: "observability" },
  { label: "Terraform", keywords: ["Terraform"], domain: "devtools" },
  { label: "MCP", keywords: ["MCP", "Model Context Protocol"], domain: "ai" },
  { label: "Bedrock AgentCore", keywords: ["AgentCore"], domain: "ai" },
  { label: "Strands Agents", keywords: ["Strands"], domain: "ai" },
  { label: "Powertools for Lambda", keywords: ["Powertools"], domain: "serverless" },
  { label: "GraphQL", keywords: ["GraphQL"], domain: "integration" },
  { label: "Rust", keywords: ["Rust"], domain: "devtools" },
  { label: "Java", keywords: ["Java"], domain: "devtools" },
  { label: "Python", keywords: ["Python"], domain: "devtools" },
  { label: "TypeScript", keywords: ["TypeScript"], domain: "devtools" },
];

/** Catalog roles grouped into the profiles an attendee recognizes themselves in. */
export const AUDIENCES: { id: string; label: string; roles: string[] }[] = [
  { id: "developer", label: "Developer / Engineer", roles: ["Developer / Engineer"] },
  { id: "architect", label: "Architect", roles: ["Solution / Systems Architect"] },
  { id: "devops", label: "DevOps & Operations", roles: ["DevOps Engineer", "System Administrator", "IT Administrator"] },
  { id: "data", label: "Data & ML practitioner", roles: ["Data Engineer", "Data Scientist"] },
  { id: "security", label: "Security specialist", roles: ["Cloud Security Specialist"] },
  { id: "tech-leader", label: "Technical leadership", roles: ["IT Professional / Technical Manager", "IT Executive"] },
  {
    id: "business",
    label: "Business & strategy",
    roles: ["Business Executive", "Sales / Marketing", "Entrepreneur (Founder/Co-Founder)", "Venture Capitalist", "Advisor / Consultant"],
  },
  { id: "explorer", label: "Explorer, student & research", roles: ["Academic / Researcher", "Student", "Tech Explorer"] },
];

export const LEARNING_STYLES: { id: string; label: string; formats: string[] }[] = [
  { id: "hands-on", label: "Hands-on build", formats: ["workshop", "bootcamp", "lab", "builders-session", "gamified"] },
  { id: "discussion", label: "Interactive discussion", formats: ["chalk-talk", "dev-chat"] },
  { id: "live-coding", label: "Live coding", formats: ["code-talk"] },
  { id: "presentation", label: "Presentation", formats: ["breakout", "lightning-talk", "keynote", "panel", "other"] },
  { id: "certification", label: "Certification prep", formats: ["exam-prep"] },
];

export const CONTENT_TYPES: TagDefinition[] = [
  { id: "customer-story", label: "Customer story" },
  { id: "partner", label: "Partner / sponsored" },
  { id: "community", label: "Community-led" },
  { id: "launch", label: "Launches & what's new", titleKeywords: ["introducing", "what's new", "launch", "launches", "announcing", "now available", "latest"] },
  { id: "deep-technical", label: "Deep technical", titleKeywords: ["deep dive", "under the hood", "internals", "behind the scenes", "inside"] },
  { id: "patterns", label: "Patterns & trade-offs" },
  { id: "getting-started", label: "Getting started", titleKeywords: ["getting started", "get started", "fundamentals", "introduction to", "basics", "101", "first steps"] },
  { id: "leadership", label: "Leadership & strategy", titleKeywords: ["leader", "leaders", "leader's", "executive", "strategy", "roadmap", "ROI", "business case", "operating model"] },
  { id: "research", label: "Research & innovation" },
];

/** Cross-cutting architecture and engineering concepts, independent of the service used. */
export const CONCEPTS: TagDefinition[] = [
  { id: "resilience", label: "Resilience & disaster recovery", areas: ["Resilience", "Disaster Response & Recovery"], textKeywords: ["resilience", "resilient", "resiliency", "disaster recovery", "failover", "fault tolerance", "fault-tolerant", "chaos engineering", "high availability", "fault isolation"] },
  { id: "multi-region", label: "Multi-Region", textKeywords: ["multi-Region", "cross-Region", "global tables", "active-active"] },
  { id: "event-driven", label: "Event-driven architecture", areas: ["Event-Driven Architecture"], textKeywords: ["event-driven", "event sourcing", "pub/sub", "choreography", "event bus"] },
  { id: "decoupling", label: "Microservices & decoupling", textKeywords: ["microservices", "microservice", "decoupling", "decoupled", "coupling", "service boundaries", "domain-driven"] },
  { id: "multi-tenant", label: "Multi-tenant & SaaS", areas: ["SaaS"], textKeywords: ["multi-tenant", "multi-tenancy", "tenant isolation", "SaaS"] },
  { id: "cell-based", label: "Cell-based & blast radius", textKeywords: ["cell-based", "blast radius", "blast-radius"] },
  { id: "distributed-data", label: "Distributed data & transactions", textKeywords: ["distributed transactions", "saga", "idempotency", "idempotent", "consistency", "exactly-once"] },
  { id: "scale-performance", label: "Scale & performance", titleKeywords: ["at scale", "scale", "scaling", "latency", "throughput", "high-performance", "performance", "1M", "millions"] },
  { id: "cost-optimization", label: "Cost optimization", areas: ["Cost Optimization"], textKeywords: ["cost optimization", "reduce costs", "cost-effective", "FinOps"] },
  { id: "observability", label: "Observability", areas: ["Monitoring & Observability"], textKeywords: ["observability", "telemetry", "tracing", "distributed tracing"] },
  { id: "zero-trust", label: "Zero trust & least privilege", textKeywords: ["zero trust", "zero-trust", "least privilege", "least-privilege", "fine-grained access"] },
  { id: "multi-account", label: "Multi-account & governance", textKeywords: ["multi-account", "AWS Organizations", "Control Tower", "landing zone", "guardrails at scale"] },
  { id: "platform-engineering", label: "Platform engineering", textKeywords: ["platform engineering", "internal developer platform", "golden path", "golden paths", "platform team"] },
  { id: "iac", label: "Infrastructure as code", textKeywords: ["infrastructure as code", "IaC", "AWS CDK", "Terraform", "CloudFormation"] },
  { id: "data-governance", label: "Data governance & mesh", textKeywords: ["data governance", "data mesh", "lineage", "data catalog", "data products"] },
  { id: "modernization", label: "Modernization of legacy", textKeywords: ["mainframe", "legacy", "monolith", "monoliths", "modernize", "modernization"] },
  { id: "sovereignty", label: "Sovereignty & data residency", areas: ["Digital Sovereignty"], textKeywords: ["sovereignty", "sovereign", "data residency"] },
];

export const LEVEL_BINS = [
  { id: "100", label: "100 Foundational" },
  { id: "200", label: "200 Intermediate" },
  { id: "300", label: "300 Advanced" },
  { id: "400+", label: "400–500 Expert" },
  { id: "none", label: "No level" },
] as const;
