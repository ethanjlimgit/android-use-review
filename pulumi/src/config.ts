import * as pulumi from "@pulumi/pulumi";

/**
 * Configuration interface for the AndroidUse infrastructure
 */
export interface InfraConfig {
  // Project
  projectName: string;
  environment: "development" | "staging" | "production";
  region: string;

  // Networking
  vpcIpRange: string; // e.g., "10.10.0.0/16"

  // Domain
  rootDomain: string; // e.g., "androiduse.com"
  domainName: string; // e.g., "dev.androiduse.com" or "androiduse.com" for prod
  subdomainPrefix: string; // e.g., "dev" or "" for prod
  manageDns: boolean;

  // Database
  dbSize: string;
  dbNodeCount: number;

  // Agent (Backend - WebSocket server)
  agentSize: string;
  agentCount: number;

  // Webapp (Frontend - Main Next.js app)
  webappSize: string;
  webappCount: number;

  // Admin (Admin CMS - Not behind load balancer)
  adminSize: string;
  adminCount: number;

  // SSH
  sshKeyName: string;

  // Monitoring
  alertEmails: string[];

  // Container Registry (GHCR)
  ghcrRegistry: string; // e.g., "ghcr.io/actionstatelabs"
  ghcrUsername: string; // GitHub username or org
  ghcrToken: pulumi.Output<string>; // GitHub PAT with read:packages scope
  imageTag: string; // e.g., "latest" or "v1.0.0"

  // Frontend Secrets
  authSecret: pulumi.Output<string>;

  // OAuth Providers (optional)
  authGithubId: pulumi.Output<string> | undefined;
  authGithubSecret: pulumi.Output<string> | undefined;
  authGoogleId: pulumi.Output<string> | undefined;
  authGoogleSecret: pulumi.Output<string> | undefined;
  authTwitterId: pulumi.Output<string> | undefined;
  authTwitterSecret: pulumi.Output<string> | undefined;

  // Stripe (optional)
  stripeSecretKey: pulumi.Output<string> | undefined;
  stripePublishableKey: string | undefined;
  stripeWebhookSecret: pulumi.Output<string> | undefined;

  // AWS S3 (optional)
  awsRegion: string | undefined;
  awsAccessKeyId: pulumi.Output<string> | undefined;
  awsSecretAccessKey: pulumi.Output<string> | undefined;
  awsS3BucketName: string | undefined;

  // Monitoring (optional)
  sentryAuthToken: pulumi.Output<string> | undefined; // For source map uploads
  posthogKey: string | undefined;
  posthogHost: string | undefined;

  // Email - SendGrid (optional)
  sendgridApiKey: pulumi.Output<string> | undefined;
  sendgridFromEmail: string | undefined;
  sendgridFromName: string | undefined;

  // Firebase FCM (optional)
  firebaseServiceAccountJson: pulumi.Output<string> | undefined;

  // LLM API Keys (optional)
  googleApiKey: pulumi.Output<string> | undefined;
  openaiApiKey: pulumi.Output<string> | undefined;
  anthropicApiKey: pulumi.Output<string> | undefined;
  deepseekApiKey: pulumi.Output<string> | undefined;
  groqApiKey: pulumi.Output<string> | undefined;

  // Monitoring API Keys (optional)
  posthogApiKey: pulumi.Output<string> | undefined;
  langfuseSecretKey: pulumi.Output<string> | undefined;
  langfusePublicKey: pulumi.Output<string> | undefined;
  langfuseHost: string | undefined;

  // Agent Settings
  agentEnableReasoning: boolean;
  elevenlabsApiKey: pulumi.Output<string> | undefined;
}

/**
 * Load configuration from Pulumi config
 */
export function loadConfig(): InfraConfig {
  const config = new pulumi.Config();

  const rootDomain = config.require("rootDomain");
  const environment = config.require("environment") as InfraConfig["environment"];

  // Compute subdomain prefix based on environment
  const subdomainPrefix = environment === "production" ? "" : environment === "staging" ? "staging" : "dev";

  // Compute full domain name
  const domainName = subdomainPrefix ? `${subdomainPrefix}.${rootDomain}` : rootDomain;

  // Default VPC IP ranges per environment to avoid conflicts
  const defaultVpcIpRange =
    environment === "production" ? "10.20.0.0/16" :
    environment === "staging" ? "10.11.0.0/16" :
    "10.10.0.0/16";

  return {
    projectName: config.require("projectName"),
    environment,
    region: config.require("region"),

    vpcIpRange: config.get("vpcIpRange") || defaultVpcIpRange,

    rootDomain,
    domainName,
    subdomainPrefix,
    manageDns: config.getBoolean("manageDns") ?? true,

    dbSize: config.get("dbSize") || "db-s-1vcpu-1gb",
    dbNodeCount: config.getNumber("dbNodeCount") || 1,

    agentSize: config.get("agentSize") || "s-2vcpu-4gb",
    agentCount: config.getNumber("agentCount") || 1,

    webappSize: config.get("webappSize") || "s-2vcpu-2gb",
    webappCount: config.getNumber("webappCount") || 1,

    adminSize: config.get("adminSize") || "s-1vcpu-1gb",
    adminCount: config.getNumber("adminCount") || 1,

    sshKeyName: config.require("sshKeyName"),

    alertEmails: config.getObject<string[]>("alertEmails") || [],

    // Container Registry (GHCR)
    ghcrRegistry: config.get("ghcrRegistry") || "ghcr.io/actionstatelabs",
    ghcrUsername: config.get("ghcrUsername") || "actionstatelabs",
    ghcrToken: config.requireSecret("ghcrToken"),
    imageTag: config.get("imageTag") || "latest",

    // Frontend Secrets
    authSecret: config.requireSecret("authSecret"),

    // OAuth Providers (optional)
    authGithubId: config.getSecret("authGithubId"),
    authGithubSecret: config.getSecret("authGithubSecret"),
    authGoogleId: config.getSecret("authGoogleId"),
    authGoogleSecret: config.getSecret("authGoogleSecret"),
    authTwitterId: config.getSecret("authTwitterId"),
    authTwitterSecret: config.getSecret("authTwitterSecret"),

    // Stripe (optional)
    stripeSecretKey: config.getSecret("stripeSecretKey"),
    stripePublishableKey: config.get("stripePublishableKey"),
    stripeWebhookSecret: config.getSecret("stripeWebhookSecret"),

    // AWS S3 (optional)
    awsRegion: config.get("awsRegion"),
    awsAccessKeyId: config.getSecret("awsAccessKeyId"),
    awsSecretAccessKey: config.getSecret("awsSecretAccessKey"),
    awsS3BucketName: config.get("awsS3BucketName"),

    // Monitoring (optional)
    sentryAuthToken: config.getSecret("sentryAuthToken"),
    posthogKey: config.get("posthogKey"),
    posthogHost: config.get("posthogHost") || "https://app.posthog.com",

    // Email - SendGrid (optional)
    sendgridApiKey: config.getSecret("sendgridApiKey"),
    sendgridFromEmail: config.get("sendgridFromEmail"),
    sendgridFromName: config.get("sendgridFromName"),

    // Firebase FCM (optional)
    firebaseServiceAccountJson: config.getSecret("firebaseServiceAccountJson"),

    // LLM API Keys (optional)
    googleApiKey: config.getSecret("googleApiKey"),
    openaiApiKey: config.getSecret("openaiApiKey"),
    anthropicApiKey: config.getSecret("anthropicApiKey"),
    deepseekApiKey: config.getSecret("deepseekApiKey"),
    groqApiKey: config.getSecret("groqApiKey"),

    // Monitoring API Keys (optional)
    posthogApiKey: config.getSecret("posthogApiKey"),
    langfuseSecretKey: config.getSecret("langfuseSecretKey"),
    langfusePublicKey: config.getSecret("langfusePublicKey"),
    langfuseHost: config.get("langfuseHost") || "https://cloud.langfuse.com",

    // Agent Settings
    agentEnableReasoning: config.getBoolean("agentEnableReasoning") ?? false,

    // Transcription Settings (ElevenLabs)
    elevenlabsApiKey: config.getSecret("elevenlabsApiKey"),
  };
}

/**
 * Generate resource name with environment prefix
 */
export function resourceName(config: InfraConfig, name: string): string {
  return `${config.projectName}-${config.environment}-${name}`;
}

/**
 * Common tags for all resources
 */
export function commonTags(config: InfraConfig): string[] {
  return [config.projectName, config.environment];
}
