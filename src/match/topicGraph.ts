/**
 * Adjacent concepts used for Discovery: sessions the attendee would not search for directly but that follow
 * naturally from what they already know or want to grow. Keys and values are normalized aliases.
 */
export const TOPIC_NEIGHBORS: Record<string, string[]> = {
  lambda: ["serverless", "event-driven architecture", "lambda-based applications", "powertools"],
  "api gateway": ["api design", "rate limiting", "appsync", "resilience"],
  dynamodb: ["nosql", "data modeling", "global tables", "distributed systems", "consistency"],
  "step functions": ["workflow orchestration", "saga", "distributed transactions", "durable execution"],
  sqs: ["event-driven architecture", "messaging", "eventbridge", "idempotency"],
  sns: ["event-driven architecture", "messaging", "eventbridge", "fan-out"],
  eventbridge: ["event-driven architecture", "choreography", "event sourcing"],
  iam: ["identity & access management", "multi-account", "least privilege", "organizations"],
  serverless: ["event-driven architecture", "containers", "platform engineering"],
  "event-driven architecture": ["event sourcing", "cqrs", "streaming", "kafka", "kinesis"],
  resilience: ["chaos engineering", "fault injection", "disaster recovery", "multi-region", "cell-based architecture"],
  "multi-region": ["global tables", "disaster recovery", "route 53", "active-active"],
  architecture: ["well-architected framework", "trade-offs", "platform engineering", "cell-based architecture"],
  "distributed systems": ["consistency", "idempotency", "cell-based architecture", "saga"],
  observability: ["monitoring & observability", "opentelemetry", "tracing", "x-ray"],
  containers: ["kubernetes", "ecs", "fargate"],
  eks: ["kubernetes", "karpenter", "platform engineering"],
  bedrock: ["agentic ai", "generative ai", "rag", "agentcore"],
  "agentic ai": ["agentcore", "mcp", "multi-agent"],
};
