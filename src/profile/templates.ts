import type { Profile } from "./profile.js";

export interface ProfileTemplate {
  id: string;
  title: string;
  description: string;
  profile: Profile;
}

const COMMON_FORMATS = {
  "chalk-talk": 0.9,
  "builders-session": 0.9,
  workshop: 0.9,
  bootcamp: 0.9,
  "code-talk": 0.85,
  lab: 0.8,
  gamified: 0.7,
  breakout: 0.4,
  "lightning-talk": 0.3,
};

/** Starting points only: every template is meant to be edited to the attendee's real experience. */
export const TEMPLATES: ProfileTemplate[] = [
  {
    id: "serverless-to-architect",
    title: "Serverless developer → architect",
    description: "Builds with Lambda, API Gateway and DynamoDB; wants design trade-offs, resilience and multi-Region.",
    profile: {
      name: "Serverless developer → architect",
      goals: ["architecture-role", "deepen-known", "learn-new", "networking"],
      interests: [
        { name: "AWS Lambda", bucket: "know", proficiency: 3 },
        { name: "Amazon API Gateway", bucket: "know", proficiency: 2 },
        { name: "Amazon DynamoDB", bucket: "know", proficiency: 2 },
        { name: "AWS Step Functions", bucket: "know", proficiency: 2 },
        { name: "Amazon SQS", bucket: "know", proficiency: 2 },
        { name: "Architecture", bucket: "grow", proficiency: 1 },
        { name: "Resilience", bucket: "grow", proficiency: 1, keywords: ["resiliency", "fault tolerance"] },
        { name: "Multi-Region", bucket: "grow", proficiency: 1, keywords: ["cross-region"] },
        { name: "Event-Driven Architecture", bucket: "grow", proficiency: 1, keywords: ["event-driven"] },
        { name: "Amazon EventBridge", bucket: "explore" },
        { name: "Containers", bucket: "explore" },
      ],
      formatPreferences: COMMON_FORMATS,
      weights: {},
    },
  },
  {
    id: "data-engineer",
    title: "Data engineer",
    description: "Works with pipelines and analytics; wants streaming, lakehouse and data for AI.",
    profile: {
      name: "Data engineer",
      goals: ["deepen-known", "learn-new", "hands-on"],
      interests: [
        { name: "Amazon S3", bucket: "know", proficiency: 2 },
        { name: "AWS Glue", bucket: "know", proficiency: 2 },
        { name: "Amazon Athena", bucket: "know", proficiency: 2 },
        { name: "Analytics", bucket: "grow", proficiency: 1 },
        { name: "Streaming", bucket: "grow", proficiency: 1, keywords: ["Kinesis", "Kafka", "MSK"] },
        { name: "Apache Iceberg", bucket: "grow", proficiency: 1, keywords: ["lakehouse"] },
        { name: "Amazon Redshift", bucket: "explore" },
        { name: "Generative AI", bucket: "explore" },
      ],
      formatPreferences: COMMON_FORMATS,
      weights: {},
    },
  },
  {
    id: "security-engineer",
    title: "Security engineer",
    description: "Owns IAM and guardrails; wants multi-account governance, detection and data protection.",
    profile: {
      name: "Security engineer",
      goals: ["deepen-known", "architecture-role", "networking"],
      interests: [
        { name: "IAM", bucket: "know", proficiency: 2 },
        { name: "Identity & Access Management", bucket: "know", proficiency: 2 },
        { name: "Multi-account", bucket: "grow", proficiency: 1, keywords: ["AWS Organizations", "Control Tower"] },
        { name: "Threat Detection & Incident Response", bucket: "grow", proficiency: 1 },
        { name: "Governance, Risk & Compliance", bucket: "grow", proficiency: 1 },
        { name: "Data Protection", bucket: "grow", proficiency: 1 },
        { name: "Network & Infrastructure Security", bucket: "explore" },
        { name: "Responsible AI", bucket: "explore" },
      ],
      formatPreferences: COMMON_FORMATS,
      weights: {},
    },
  },
  {
    id: "new-to-aws",
    title: "New to AWS",
    description: "Early in the cloud journey; wants solid foundations before going deep.",
    profile: {
      name: "New to AWS",
      goals: ["learn-new", "hands-on", "networking"],
      interests: [
        { name: "Architecture", bucket: "grow", proficiency: 0 },
        { name: "Serverless", bucket: "explore" },
        { name: "Containers", bucket: "explore" },
        { name: "Databases", bucket: "explore" },
        { name: "Security & Identity", bucket: "explore" },
        { name: "Generative AI", bucket: "explore" },
      ],
      formatPreferences: { ...COMMON_FORMATS, breakout: 0.6 },
      weights: {},
    },
  },
];
