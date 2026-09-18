import { describe, it, expect } from 'vitest';
import { androidUseConfigSchema } from '../src/config/schema.js';

describe('Config Schema', () => {
  it('should parse empty config with defaults', () => {
    const config = androidUseConfigSchema.parse({});

    expect(config.agent.name).toBe('droiduse');
    expect(config.agent.maxSteps).toBe(30);
    expect(config.agent.maxTime).toBe(600.0);
    expect(config.agent.reasoning).toBe(false);
    expect(config.agent.streaming).toBe(true);
    expect(config.agent.codeact.vision).toBe(false);
    expect(config.websocketServer.pingInterval).toBe(20);
    expect(config.websocketServer.authEnabled).toBe(true);
    expect(config.plugins.localLogging.enabled).toBe(true);
  });

  it('should parse config with snake_case keys (after conversion)', () => {
    const input = {
      agent: {
        maxSteps: 50,
        reasoning: true,
        codeact: {
          vision: true,
          llm: {
            provider: 'Anthropic',
            model: 'claude-sonnet-4-5-20250929',
            temperature: 0.3,
          },
        },
      },
      websocketServer: {
        authEnabled: false,
        pingInterval: 30,
      },
    };

    const config = androidUseConfigSchema.parse(input);

    expect(config.agent.maxSteps).toBe(50);
    expect(config.agent.reasoning).toBe(true);
    expect(config.agent.codeact.vision).toBe(true);
    expect(config.agent.codeact.llm?.provider).toBe('Anthropic');
    expect(config.agent.codeact.llm?.model).toBe('claude-sonnet-4-5-20250929');
    expect(config.websocketServer.authEnabled).toBe(false);
    expect(config.websocketServer.pingInterval).toBe(30);
  });

  it('should reject invalid provider', () => {
    expect(() => {
      androidUseConfigSchema.parse({
        agent: {
          codeact: {
            llm: {
              provider: 'InvalidProvider',
              model: 'test',
            },
          },
        },
      });
    }).toThrow();
  });

  it('should set default LLM profiles', () => {
    const config = androidUseConfigSchema.parse({});
    // Default profiles are empty (set by loader, not schema)
    expect(config.llmProfiles).toEqual({});
  });

  it('should parse plugin config', () => {
    const config = androidUseConfigSchema.parse({
      plugins: {
        localLogging: { enabled: false },
        posthogTelemetry: { enabled: true, apiKey: 'test-key' },
        trajectory: {
          enabled: true,
          saveTrajectory: 'step',
          trajectoryPath: '/tmp/traj',
        },
      },
    });

    expect(config.plugins.localLogging.enabled).toBe(false);
    expect(config.plugins.posthogTelemetry.enabled).toBe(true);
    expect(config.plugins.posthogTelemetry.apiKey).toBe('test-key');
    expect(config.plugins.trajectory.enabled).toBe(true);
    expect(config.plugins.trajectory.saveTrajectory).toBe('step');
  });
});
