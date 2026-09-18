#!/usr/bin/env node

/**
 * CLI entry point for the agent server.
 * Replaces Python's droiduse-backend CLI built with click/argparse.
 */

import { Command } from 'commander';
import { startServer } from './server.js';
import { loadConfig, loadDefaultConfig } from './config/index.js';
import { createLlm } from './models/index.js';

const program = new Command();

program
  .name('agent-server')
  .description('DroidUse Agent Server - AI-powered Android device automation')
  .version('1.0.0');

// ── serve command ──

program
  .command('serve')
  .description('Start the WebSocket server')
  .option('-H, --host <host>', 'Host to bind to', '0.0.0.0')
  .option('-p, --port <port>', 'Port to listen on', '8000')
  .option('-c, --config <path>', 'Path to config JSON file')
  .option('--debug', 'Enable debug logging')
  .action(async (opts: { host: string; port: string; config?: string; debug?: boolean }) => {
    await startServer({
      host: opts.host,
      port: parseInt(opts.port, 10),
      configPath: opts.config,
      debug: opts.debug,
    });
  });

// ── validate-config command ──

program
  .command('validate-config')
  .description('Validate a configuration file')
  .requiredOption('-c, --config <path>', 'Path to config JSON file')
  .action((opts: { config: string }) => {
    try {
      const config = loadConfig(opts.config);
      console.log('Configuration is valid!');
      console.log(`  Agent: ${config.agent.name}`);
      console.log(`  Reasoning: ${config.agent.reasoning}`);
      console.log(`  Max Steps: ${config.agent.maxSteps}`);
      console.log(`  Max Time: ${config.agent.maxTime}s`);
      console.log(
        `  LLM Profiles: ${Object.keys(config.llmProfiles).join(', ')}`,
      );
      console.log(
        `  Auth: ${config.websocketServer.authEnabled ? 'enabled' : 'disabled'}`,
      );
    } catch (err) {
      console.error(`Configuration validation failed: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── test-llm command ──

program
  .command('test-llm')
  .description('Test LLM connectivity for configured profiles')
  .option('-c, --config <path>', 'Path to config JSON file')
  .option(
    '-p, --profile <name>',
    'Test specific profile (e.g., "manager", "executor")',
  )
  .option('-v, --verbose', 'Verbose output')
  .action(
    async (opts: {
      config?: string;
      profile?: string;
      verbose?: boolean;
    }) => {
      const config = opts.config
        ? loadConfig(opts.config)
        : loadDefaultConfig();

      if (opts.profile && !config.llmProfiles[opts.profile]) {
        console.error(`Profile "${opts.profile}" not found in config`);
        console.error(
          `Available profiles: ${Object.keys(config.llmProfiles).join(', ')}`,
        );
        process.exit(1);
      }

      const profiles = opts.profile
        ? { [opts.profile]: config.llmProfiles[opts.profile]! }
        : config.llmProfiles;

      for (const [name, profile] of Object.entries(profiles)) {
        console.log(`\nTesting profile: ${name}`);
        console.log(`  Provider: ${profile.provider}`);
        console.log(`  Model: ${profile.model}`);

        try {
          createLlm(profile, config.apiKeys);
          console.log(`  Status: LLM instance created successfully`);

          if (opts.verbose) {
            console.log(
              `  Temperature: ${profile.temperature}`,
            );
            if (profile.baseUrl)
              console.log(`  Base URL: ${profile.baseUrl}`);
          }
        } catch (err) {
          console.error(
            `  Status: FAILED - ${(err as Error).message}`,
          );
        }
      }
    },
  );

// ── Parse and run ──

program.parse();
