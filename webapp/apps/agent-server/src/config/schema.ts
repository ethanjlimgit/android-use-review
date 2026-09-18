import { z } from 'zod';

// ── LLM Profile ──

export const llmProfileSchema = z.object({
  provider: z
    .enum([
      'Gemini',
      'GoogleGenAI',
      'OpenAI',
      'OpenAILike',
      'Anthropic',
      'DeepSeek',
      'Groq',
      'Ollama',
      'OpenRouter',
    ])
    .default('Gemini'),
  model: z.string().default('gemini-2.5-flash'),
  temperature: z.number().min(0).max(2).default(0.2),
  baseUrl: z.string().url().optional(),
  apiBase: z.string().url().optional(),
  kwargs: z.record(z.string(), z.unknown()).default({}),
});

export type LlmProfile = z.infer<typeof llmProfileSchema>;

// ── Agent Sub-Configs ──

export const codeActConfigSchema = z.object({
  vision: z.boolean().default(false),
  systemPrompt: z.string().default('system.njk'),
  userPrompt: z.string().default('user.njk'),
  safeExecution: z.boolean().default(false),
  llm: llmProfileSchema.optional(),
});

export const managerConfigSchema = z.object({
  vision: z.boolean().default(false),
  systemPrompt: z.string().default('system.njk'),
  stateless: z.boolean().default(false),
  llm: llmProfileSchema.optional(),
});

export const executorConfigSchema = z.object({
  vision: z.boolean().default(false),
  systemPrompt: z.string().default('system.njk'),
  llm: llmProfileSchema.optional(),
});

export const scripterConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxSteps: z.number().int().positive().default(10),
  executionTimeout: z.number().positive().default(30.0),
  systemPromptPath: z.string().default('system.njk'),
  safeExecution: z.boolean().default(false),
  llm: llmProfileSchema.optional(),
});

export const textManipulatorConfigSchema = z.object({
  llm: llmProfileSchema.optional(),
});

export const appOpenerConfigSchema = z.object({
  llm: llmProfileSchema.optional(),
});

export const structuredOutputConfigSchema = z.object({
  llm: llmProfileSchema.optional(),
});

export const suggesterConfigSchema = z.object({
  maxSuggestions: z.number().int().positive().default(5),
  llm: llmProfileSchema.optional(),
});

export const appCardConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(['local', 'server', 'composite', 'database']).default('local'),
  appCardsDir: z.string().default('config/app_cards'),
  serverUrl: z.string().url().nullable().default(null),
  serverTimeout: z.number().positive().default(2.0),
  serverMaxRetries: z.number().int().nonnegative().default(2),
});

// Pre-compute defaults for sub-schemas (Zod v4 requires full output type for .default())
const codeActDefaults = codeActConfigSchema.parse({});
const managerDefaults = managerConfigSchema.parse({});
const executorDefaults = executorConfigSchema.parse({});
const scripterDefaults = scripterConfigSchema.parse({});
const textManipulatorDefaults = textManipulatorConfigSchema.parse({});
const appOpenerDefaults = appOpenerConfigSchema.parse({});
const structuredOutputDefaults = structuredOutputConfigSchema.parse({});
const suggesterDefaults = suggesterConfigSchema.parse({});
const appCardDefaults = appCardConfigSchema.parse({});

// ── Agent Config ──

export const agentConfigSchema = z.object({
  name: z.string().default('droiduse'),
  useSemanticActions: z.boolean().default(false),
  maxSteps: z.number().int().positive().default(30),
  maxTime: z.number().positive().default(600.0),
  perStepTimeout: z.number().positive().default(20.0),
  reasoning: z.boolean().default(false),
  streaming: z.boolean().default(true),
  afterSleepAction: z.number().nonnegative().default(1.0),
  waitForStableUi: z.number().nonnegative().default(0.3),
  promptsDir: z.string().default('prompts'),

  codeact: codeActConfigSchema.default(codeActDefaults),
  manager: managerConfigSchema.default(managerDefaults),
  executor: executorConfigSchema.default(executorDefaults),
  scripter: scripterConfigSchema.default(scripterDefaults),
  textManipulator: textManipulatorConfigSchema.default(textManipulatorDefaults),
  appOpener: appOpenerConfigSchema.default(appOpenerDefaults),
  structuredOutput: structuredOutputConfigSchema.default(structuredOutputDefaults),
  suggester: suggesterConfigSchema.default(suggesterDefaults),
  appCards: appCardConfigSchema.default(appCardDefaults),
});

export type AgentConfig = z.infer<typeof agentConfigSchema>;

// ── API Keys ──

export const apiKeysConfigSchema = z.object({
  googleApiKey: z.string().default(''),
  openaiApiKey: z.string().default(''),
  anthropicApiKey: z.string().default(''),
  deepseekApiKey: z.string().default(''),
  groqApiKey: z.string().default(''),
});

export type ApiKeysConfig = z.infer<typeof apiKeysConfigSchema>;

// ── WebSocket Server ──

export const websocketServerConfigSchema = z.object({
  pingInterval: z.number().int().positive().default(20),
  pingTimeout: z.number().int().positive().default(60),
  closeTimeout: z.number().int().positive().default(30),
  maxMessageSize: z.number().int().positive().default(10 * 1024 * 1024),
  initialRecvTimeout: z.number().positive().default(120.0),
  authEnabled: z.boolean().default(true),
  appCardServerEnabled: z.boolean().default(false),
  appCardServerPort: z.number().int().positive().default(8001),
  webApiUrl: z.string().default('http://localhost:3000/api'),
  webApiAuthSecret: z.string().default(''),
  publicIpAddress: z.string().default(''),
  serverName: z.string().default(''),
  serverRegion: z.string().default('unknown'),
  serverCapacity: z.number().int().positive().default(10),
});

export type WebSocketServerConfig = z.infer<typeof websocketServerConfigSchema>;

// ── HTTP API Server ──

export const httpServerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  port: z.number().int().positive().default(8001),
});

// ── Heartbeat Server ──

export const heartbeatServerConfigSchema = z.object({
  enabled: z.boolean().default(false),
  heartbeatApiUrl: z.string().default(''),
  heartbeatInterval: z.number().int().positive().default(30),
});

// ── Logging ──

export const loggingConfigSchema = z.object({
  debug: z.boolean().default(false),
  richText: z.boolean().default(false),
});

// ── Tools ──

export const toolsConfigSchema = z.object({
  disabledTools: z.array(z.string()).default([]),
});

// ── Credentials ──

export const credentialsConfigSchema = z.object({
  enabled: z.boolean().default(false),
  filePath: z.string().default('config/credentials.json'),
});

// ── Plugin Configs ──

export const localLoggingPluginConfigSchema = z.object({
  enabled: z.boolean().default(true),
});

export const postHogPluginConfigSchema = z.object({
  enabled: z.boolean().default(false),
  apiKey: z.string().default(''),
  host: z.string().default(''),
});

export const tracingPluginConfigSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(['phoenix', 'langfuse']).default('langfuse'),
  screenshotsEnabled: z.boolean().default(false),
  langfuseSecretKey: z.string().default(''),
  langfusePublicKey: z.string().default(''),
  langfuseHost: z.string().default(''),
  langfuseUserId: z.string().default('anonymous'),
  langfuseSessionId: z.string().default(''),
});

export const trajectoryPluginConfigSchema = z.object({
  enabled: z.boolean().default(false),
  saveTrajectory: z.enum(['none', 'step', 'action']).default('none'),
  trajectoryPath: z.string().default('trajectories'),
  queueSize: z.number().int().positive().default(300),
  createGifs: z.boolean().default(true),
});

export const memorySummaryPluginConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxTaskSummaries: z.number().int().positive().default(50),
});

// Pre-compute plugin defaults
const localLoggingDefaults = localLoggingPluginConfigSchema.parse({});
const postHogDefaults = postHogPluginConfigSchema.parse({});
const tracingDefaults = tracingPluginConfigSchema.parse({});
const trajectoryDefaults = trajectoryPluginConfigSchema.parse({});
const memorySummaryDefaults = memorySummaryPluginConfigSchema.parse({});

export const pluginsConfigSchema = z.object({
  localLogging: localLoggingPluginConfigSchema.default(localLoggingDefaults),
  posthogTelemetry: postHogPluginConfigSchema.default(postHogDefaults),
  tracing: tracingPluginConfigSchema.default(tracingDefaults),
  trajectory: trajectoryPluginConfigSchema.default(trajectoryDefaults),
  memorySummary: memorySummaryPluginConfigSchema.default(memorySummaryDefaults),
});

// ── Transcription ──

export const transcriptionConfigSchema = z.object({
  enabled: z.boolean().default(false),
  elevenlabsApiKey: z.string().default(''),
  defaultLanguage: z.string().default(''),
  vadSilenceThreshold: z.number().min(0.5).max(1.5).default(1.0),
  maxSessionDuration: z.number().int().positive().default(300),
  modelId: z.string().default('scribe_v2_realtime'),
});

// ── Device Config ──

export const deviceConfigSchema = z.object({
  serial: z.string().nullable().default(null),
  useTcp: z.boolean().default(false),
  platform: z.enum(['android', 'ios']).default('android'),
  token: z.string().nullable().default(null),
  websocketPort: z.number().int().positive().default(8081),
});

// Pre-compute remaining defaults
const agentDefaults = agentConfigSchema.parse({});
const deviceDefaults = deviceConfigSchema.parse({});
const loggingDefaults = loggingConfigSchema.parse({});
const toolsDefaults = toolsConfigSchema.parse({});
const credentialsDefaults = credentialsConfigSchema.parse({});
const apiKeysDefaults = apiKeysConfigSchema.parse({});
const pluginsDefaults = pluginsConfigSchema.parse({});
const websocketServerDefaults = websocketServerConfigSchema.parse({});
const httpServerDefaults = httpServerConfigSchema.parse({});
const heartbeatServerDefaults = heartbeatServerConfigSchema.parse({});
const transcriptionDefaults = transcriptionConfigSchema.parse({});

// ── Root Config ──

export const androidUseConfigSchema = z.object({
  agent: agentConfigSchema.default(agentDefaults),
  llmProfiles: z.record(z.string(), llmProfileSchema).default({}),
  device: deviceConfigSchema.default(deviceDefaults),
  logging: loggingConfigSchema.default(loggingDefaults),
  tools: toolsConfigSchema.default(toolsDefaults),
  credentials: credentialsConfigSchema.default(credentialsDefaults),
  apiKeys: apiKeysConfigSchema.default(apiKeysDefaults),
  plugins: pluginsConfigSchema.default(pluginsDefaults),
  websocketServer: websocketServerConfigSchema.default(websocketServerDefaults),
  httpServer: httpServerConfigSchema.default(httpServerDefaults),
  heartbeatServer: heartbeatServerConfigSchema.default(heartbeatServerDefaults),
  transcription: transcriptionConfigSchema.default(transcriptionDefaults),
  externalAgents: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
});

export type AndroidUseConfig = z.infer<typeof androidUseConfigSchema>;
