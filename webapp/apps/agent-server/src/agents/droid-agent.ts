/**
 * DroidAgent - Main orchestrator agent.
 * Ported from Python: agent/droid/droid_agent.py (1294 lines)
 *
 * This is a custom BaseAgent subclass that orchestrates sub-agents
 * (Manager, Executor, CodeAct) based on configuration.
 *
 * Sub-agents use `outputSchema` instead of tool-calling. The LLM
 * returns structured JSON which DroidAgent parses and dispatches
 * via WebSocketConnectionTool.
 */

import {
  BaseAgent,
  LlmAgent,
  InvocationContext,
  type Event,
} from '@google/adk';
import type { Content } from '@google/genai';
import type { BaseLlm } from '@google/adk';
import type { FunctionTool } from '@google/adk';
import type { WebSocketConnectionTool } from '../tools/ws-connection-tool.js';
import type { AgentConfig } from '../config/schema.js';
import type { DroidAgentState } from './state.js';
import { createInstructionProvider, formatToolDescriptions, formatAtomicActions } from '../prompts/provider.js';
import {
  codeActOutputSchema,
  managerOutputSchema,
  executorOutputSchema,
} from './output-schemas.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('droid-agent');

export interface DroidAgentConfig {
  agentConfig: AgentConfig;
  llms: Record<string, BaseLlm>;
  /** Device tools — kept for tool descriptions + action dispatching, NOT passed to LlmAgent */
  deviceTools: FunctionTool[];
  wsTool: WebSocketConnectionTool;
  promptsDir: string;
}

/**
 * Dispatch a parsed action to the appropriate WebSocketConnectionTool method.
 * Returns a string result (success/failure message).
 */
async function dispatchAction(
  wsTool: WebSocketConnectionTool,
  action: string,
  args: Record<string, unknown>,
): Promise<string> {
  switch (action) {
    case 'tap_element':
      return wsTool.tapElement(
        args.by as string,
        args.pattern as string,
      );

    case 'input_text_element':
      return wsTool.inputTextElement(
        args.text as string,
        args.by as string,
        args.pattern as string,
        (args.clear as boolean) ?? false,
      );

    case 'long_press_element':
      return wsTool.longPressElement(
        args.by as string,
        args.pattern as string,
      );

    case 'input_text':
      return wsTool.inputText(
        args.text as string,
        (args.clear as boolean) ?? false,
      );

    case 'swipe': {
      const ok = await wsTool.swipe(
        args.start_x as number,
        args.start_y as number,
        args.end_x as number,
        args.end_y as number,
        (args.duration_ms as number) ?? 1000,
      );
      return ok ? 'Swipe successful' : 'Swipe failed';
    }

    case 'drag': {
      const ok = await wsTool.drag(
        args.start_x as number,
        args.start_y as number,
        args.end_x as number,
        args.end_y as number,
        (args.duration_sec as number) ?? 3,
      );
      return ok ? 'Drag successful' : 'Drag failed';
    }

    case 'press_key':
      return wsTool.pressKey(args.keycode as number);

    case 'open_app':
      return wsTool.startApp(
        args.package_name as string,
        (args.activity as string) ?? '',
      );

    case 'list_packages': {
      const packages = await wsTool.listPackages(
        (args.include_system as boolean) ?? false,
      );
      return `Packages: ${packages.join(', ')}`;
    }

    case 'remember':
      return wsTool.remember(args.information as string);

    case 'complete':
      wsTool.complete(
        args.success as boolean,
        (args.reason as string) ?? '',
      );
      return `Task ${args.success ? 'completed' : 'failed'}: ${args.reason ?? ''}`;

    default:
      return `Unknown action: ${action}`;
  }
}

/**
 * Parse the LLM's JSON text response. The response may be raw JSON
 * or wrapped in markdown code fences.
 */
function parseLlmJson(text: string): Record<string, unknown> | null {
  let cleaned = text.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * DroidAgent orchestrates the execution of device automation tasks.
 *
 * Two modes:
 * - reasoning=false: Uses CodeActAgent directly (structured JSON output)
 * - reasoning=true: Uses Manager (planning) → Executor (action) loop
 */
export class DroidAgent extends BaseAgent {
  private config: DroidAgentConfig;
  private codeActAgent: LlmAgent;
  private managerAgent: LlmAgent;
  private executorAgent: LlmAgent;

  constructor(config: DroidAgentConfig) {
    const toolDescriptions = formatToolDescriptions(config.deviceTools);
    const atomicActions = formatAtomicActions(config.deviceTools);

    // Config-derived context shared across agent templates.
    // Matches Python: manager._build_system_prompt(), executor.prepare_context()
    const scripterEnabled = config.agentConfig.scripter.enabled;
    const scripterMaxSteps = config.agentConfig.scripter.maxSteps;
    const textManipulationEnabled = !!config.agentConfig.textManipulator.llm;
    // available_secrets and output_schema are task-level (optional).
    // They will be empty here; per-task injection can be added later
    // via state.customVariables or a dedicated field.

    // Create sub-agents — no tools, outputSchema forces JSON-only responses
    const codeActAgent = new LlmAgent({
      name: 'codeact_agent',
      model: config.llms.codeact ?? config.llms.manager,
      instruction: createInstructionProvider('codeact', config.promptsDir, {
        // Python: tool_descriptions, available_secrets, variables, output_schema
        tool_descriptions: toolDescriptions,
      }),
      description: 'Direct device automation via structured JSON output',
      outputSchema: codeActOutputSchema,
      generateContentConfig: {
        temperature:
          config.agentConfig.codeact.llm?.temperature ?? 0.2,
      },
    });

    const managerAgent = new LlmAgent({
      name: 'manager_agent',
      model: config.llms.manager,
      instruction: createInstructionProvider('manager', config.promptsDir, {
        // Python: instruction, device_date, app_card, important_notes,
        //   error_history, text_manipulation_enabled, scripter_execution_enabled,
        //   scripter_max_steps, available_secrets, variables, output_schema,
        //   voice_instruction, voice_instruction_history
        // State-derived vars (instruction, app_card, error_history, voice_*)
        // are injected by buildTemplateContext. Config flags go here:
        text_manipulation_enabled: textManipulationEnabled,
        scripter_execution_enabled: scripterEnabled,
        scripter_max_steps: scripterMaxSteps,
      }),
      description: 'High-level task planning and progress tracking',
      outputSchema: managerOutputSchema,
      outputKey: 'managerOutput',
      generateContentConfig: {
        temperature:
          config.agentConfig.manager.llm?.temperature ?? 0.2,
      },
    });

    const executorAgent = new LlmAgent({
      name: 'executor_agent',
      model: config.llms.executor ?? config.llms.manager,
      instruction: createInstructionProvider('executor', config.promptsDir, {
        // Python: instruction, app_card, device_state, plan, subgoal,
        //   progress_status, atomic_actions, action_history, available_secrets, variables
        // State-derived vars are injected by buildTemplateContext.
        // Static tool metadata goes here:
        atomic_actions: atomicActions,
      }),
      description: 'Low-level atomic action execution via structured JSON output',
      outputSchema: executorOutputSchema,
      generateContentConfig: {
        temperature:
          config.agentConfig.executor.llm?.temperature ?? 0.1,
      },
    });

    // NOTE: Do NOT pass sub-agents via `subAgents` here.
    // Registering them would set parentAgent = DroidAgent (a BaseAgent),
    // making rootAgent a non-LlmAgent. ADK's InstructionsLlmRequestProcessor
    // checks `agent.rootAgent instanceof LlmAgent` and bails out if false,
    // which would prevent our InstructionProvider from being called.
    // Since we manually call runAsync on each sub-agent, we don't need
    // ADK's agent-transfer mechanism.
    super({
      name: 'droid_agent',
      description: 'Android device automation orchestrator',
    });

    this.config = config;
    this.codeActAgent = codeActAgent;
    this.managerAgent = managerAgent;
    this.executorAgent = executorAgent;
  }

  protected async *runAsyncImpl(
    ctx: InvocationContext,
  ): AsyncGenerator<Event, void, void> {
    const state = ctx.session.state as unknown as DroidAgentState;
    const maxSteps = this.config.agentConfig.maxSteps;
    const maxTime = this.config.agentConfig.maxTime * 1000; // Convert to ms

    log.info(
      `Starting DroidAgent: reasoning=${this.config.agentConfig.reasoning}, maxSteps=${maxSteps}`,
    );

    if (!this.config.agentConfig.reasoning) {
      // ── CodeAct Mode (Structured JSON Output) ──
      yield* this.runCodeActMode(ctx, state, maxSteps, maxTime);
    } else {
      // ── Reasoning Mode (Manager → Executor Loop) ──
      yield* this.runReasoningMode(ctx, state, maxSteps, maxTime);
    }
  }

  protected async *runLiveImpl(
    ctx: InvocationContext,
  ): AsyncGenerator<Event, void, void> {
    yield* this.runAsyncImpl(ctx);
  }

  // ── CodeAct Mode ──

  private async *runCodeActMode(
    ctx: InvocationContext,
    state: DroidAgentState,
    maxSteps: number,
    maxTimeMs: number,
  ): AsyncGenerator<Event, void, void> {
    log.info('Running in CodeAct mode (structured JSON output)');

    for (let step = 0; step < maxSteps; step++) {
      // Check timeout
      const elapsed = performance.now() - state.taskStartTime;
      if (elapsed > maxTimeMs) {
        log.warn(`Task timed out after ${(elapsed / 1000).toFixed(1)}s`);
        break;
      }

      // Check if task is completed
      if (this.config.wsTool.finished) {
        log.info(
          `Task completed: success=${this.config.wsTool.success}, reason=${this.config.wsTool.reason}`,
        );
        break;
      }

      state.stepNumber = step + 1;

      log.info(`CodeAct step ${step + 1}/${maxSteps}: fetching device state...`);

      // Get current device state
      const deviceState = await this.config.wsTool.getState();

      // Update state for prompts
      state.formattedDeviceState = deviceState.formattedText;
      state.focusedText = deviceState.focusedText;

      // Take screenshot if vision is enabled
      let screenshotContent: Content | undefined;
      if (this.config.agentConfig.codeact.vision) {
        try {
          const screenshot = await this.config.wsTool.takeScreenshot();
          log.info(`CodeAct step ${step + 1}: screenshot captured (${screenshot.length} bytes)`);
          screenshotContent = {
            role: 'user',
            parts: [
              { text: `Step ${step + 1}:\n${deviceState.formattedText}` },
              {
                inlineData: {
                  data: screenshot.toString('base64'),
                  mimeType: 'image/png',
                },
              },
            ],
          };
        } catch (err) {
          log.warn(`Screenshot failed: ${(err as Error).message}`);
        }
      }

      // Build user message with device state
      const userMessage: Content = screenshotContent ?? {
        role: 'user',
        parts: [
          {
            text: `Step ${step + 1}:\n${deviceState.formattedText}`,
          },
        ],
      };

      // Run CodeAct agent for this step
      log.info(`CodeAct step ${step + 1}: calling LLM agent...`);
      const subCtx: InvocationContext = {
        ...ctx,
        userContent: userMessage,
      } as InvocationContext;

      let llmResponseText = '';
      for await (const event of this.codeActAgent.runAsync(subCtx)) {
        // Collect text parts from the response
        const parts = event.content?.parts ?? [];
        for (const part of parts) {
          if (part.text) {
            llmResponseText += part.text;
            log.info(`CodeAct step ${step + 1} LLM text: ${part.text.slice(0, 200)}`);
          }
        }
        yield event;
      }

      // Parse and dispatch the action from structured JSON
      if (llmResponseText) {
        const parsed = parseLlmJson(llmResponseText);
        if (parsed) {
          const action = parsed.action as string;
          const args = (parsed.args as Record<string, unknown>) ?? {};
          const thought = parsed.thought as string;

          log.info(`CodeAct step ${step + 1} thought: "${(thought ?? '').slice(0, 150)}"`);
          log.info(`CodeAct step ${step + 1} -> dispatch: ${action}(${JSON.stringify(args)})`);

          const result = await dispatchAction(this.config.wsTool, action, args);
          log.info(`CodeAct step ${step + 1} <- result: ${result.slice(0, 200)}`);
        } else {
          log.warn(`CodeAct step ${step + 1}: failed to parse LLM JSON: ${llmResponseText.slice(0, 200)}`);
        }
      }

      log.info(`CodeAct step ${step + 1}: complete`);

      // Wait for UI to stabilize
      const sleepMs = this.config.agentConfig.afterSleepAction * 1000;
      if (sleepMs > 0) {
        await new Promise((r) => setTimeout(r, sleepMs));
      }
    }
  }

  // ── Reasoning Mode (Manager → Executor Loop) ──

  private async *runReasoningMode(
    ctx: InvocationContext,
    state: DroidAgentState,
    maxSteps: number,
    maxTimeMs: number,
  ): AsyncGenerator<Event, void, void> {
    log.info('Running in Reasoning mode (Manager → Executor)');

    for (let step = 0; step < maxSteps; step++) {
      const elapsed = performance.now() - state.taskStartTime;
      if (elapsed > maxTimeMs) {
        log.warn(`Task timed out after ${(elapsed / 1000).toFixed(1)}s`);
        break;
      }

      if (this.config.wsTool.finished) {
        log.info(
          `Task completed: success=${this.config.wsTool.success}`,
        );
        break;
      }

      state.stepNumber = step + 1;

      log.info(`Reasoning step ${step + 1}/${maxSteps}: fetching device state...`);

      // Get current device state
      const deviceState = await this.config.wsTool.getState();
      state.formattedDeviceState = deviceState.formattedText;
      state.focusedText = deviceState.focusedText;

      // Take screenshot if vision enabled
      let screenshotBase64: string | undefined;
      if (this.config.agentConfig.manager.vision) {
        try {
          const screenshot = await this.config.wsTool.takeScreenshot();
          screenshotBase64 = screenshot.toString('base64');
          state.screenshot = screenshotBase64;
          log.info(`Reasoning step ${step + 1}: screenshot captured (${screenshot.length} bytes)`);
        } catch (err) {
          log.warn(`Reasoning step ${step + 1}: screenshot failed - ${(err as Error).message}`);
        }
      }

      // ── Manager Step: Create/update plan ──
      log.info(`Reasoning step ${step + 1}: calling manager agent...`);

      const managerMessage: Content = {
        role: 'user',
        parts: [
          {
            text: `Step ${step + 1}:\n${deviceState.formattedText}\n\nMemory: ${state.memory || 'None'}`,
          },
          ...(screenshotBase64
            ? [
                {
                  inlineData: {
                    data: screenshotBase64,
                    mimeType: 'image/png' as const,
                  },
                },
              ]
            : []),
        ],
      };

      const managerCtx: InvocationContext = {
        ...ctx,
        userContent: managerMessage,
      } as InvocationContext;

      let managerResponseText = '';
      for await (const event of this.managerAgent.runAsync(managerCtx)) {
        yield event;

        // Collect text parts
        const parts = event.content?.parts ?? [];
        for (const part of parts) {
          if (part.text) {
            managerResponseText += part.text;
          }
        }
      }

      // Parse manager structured JSON output
      if (managerResponseText) {
        const parsed = parseLlmJson(managerResponseText);
        if (parsed) {
          const thought = parsed.thought as string | undefined;
          const plan = parsed.plan as string | undefined;
          const addMemory = parsed.add_memory as string | undefined;
          const accomplished = parsed.request_accomplished as
            | { success: boolean; reason: string }
            | undefined;

          if (thought) {
            state.lastThought = thought;
            log.info(`Manager thought: "${thought.slice(0, 150)}"`);
          }

          if (plan) {
            state.plan = plan;
            // Extract first subgoal
            const lines = plan.split('\n').filter((l) => l.trim());
            state.currentSubgoal = lines[0]?.replace(/^\d+\.\s*/, '') ?? '';
            log.info(`Manager plan extracted, subgoal: "${state.currentSubgoal}"`);
          }

          if (addMemory) {
            state.memory += '\n' + addMemory;
            log.info(`Manager added memory: "${addMemory.slice(0, 100)}"`);
          }

          if (accomplished) {
            this.config.wsTool.complete(accomplished.success, accomplished.reason);
            state.managerAnswer = accomplished.reason;
            log.info(
              `Manager marked task as ${accomplished.success ? 'accomplished' : 'failed'}: ${accomplished.reason}`,
            );
            return;
          }
        } else {
          log.warn(`Manager: failed to parse JSON: ${managerResponseText.slice(0, 200)}`);
        }
      }

      // ── Check for TEXT_TASK or script tags ──
      if (state.currentSubgoal.startsWith('TEXT_TASK:')) {
        // Text manipulation - would delegate to TextManipulatorAgent
        log.info(
          `Text manipulation task: ${state.currentSubgoal}`,
        );
        // TODO: Implement TextManipulatorAgent delegation
        continue;
      }

      if (state.plan.includes('<script>')) {
        // Script execution - would delegate to ScripterAgent
        log.info('Script execution detected in plan');
        // TODO: Implement ScripterAgent delegation
        continue;
      }

      // ── Executor Step: Execute current subgoal ──
      if (!state.currentSubgoal) {
        log.warn('No subgoal from manager, skipping executor');
        continue;
      }

      log.info(
        `Reasoning step ${step + 1}: calling executor for subgoal: "${state.currentSubgoal}"`,
      );

      const executorMessage: Content = {
        role: 'user',
        parts: [
          {
            text: `Execute: ${state.currentSubgoal}\n\nDevice State:\n${deviceState.formattedText}`,
          },
          ...(screenshotBase64
            ? [
                {
                  inlineData: {
                    data: screenshotBase64,
                    mimeType: 'image/png' as const,
                  },
                },
              ]
            : []),
        ],
      };

      const executorCtx: InvocationContext = {
        ...ctx,
        userContent: executorMessage,
      } as InvocationContext;

      let executorResponseText = '';
      for await (const event of this.executorAgent.runAsync(executorCtx)) {
        const parts = event.content?.parts ?? [];
        for (const part of parts) {
          if (part.text) {
            executorResponseText += part.text;
            log.info(`Executor step ${step + 1} LLM text: ${part.text.slice(0, 200)}`);
          }
        }
        yield event;
      }

      // Parse and dispatch executor's action
      let actionOutcome = true;
      let actionResult = '';
      if (executorResponseText) {
        const parsed = parseLlmJson(executorResponseText);
        if (parsed) {
          const action = parsed.action as string;
          const args = (parsed.args as Record<string, unknown>) ?? {};
          const thought = parsed.thought as string;
          const description = parsed.description as string;

          log.info(`Executor step ${step + 1} thought: "${(thought ?? '').slice(0, 150)}"`);
          log.info(`Executor step ${step + 1} -> dispatch: ${action}(${JSON.stringify(args)}) — ${description ?? ''}`);

          actionResult = await dispatchAction(this.config.wsTool, action, args);
          log.info(`Executor step ${step + 1} <- result: ${actionResult.slice(0, 200)}`);
        } else {
          log.warn(`Executor step ${step + 1}: failed to parse JSON: ${executorResponseText.slice(0, 200)}`);
          actionOutcome = false;
          actionResult = 'Failed to parse executor response';
        }
      }

      log.info(`Reasoning step ${step + 1}: executor complete`);

      // Track action in history
      state.actionHistory.push({
        action: state.currentSubgoal,
        summary: `Step ${step + 1}: ${state.currentSubgoal}`,
        outcome: actionOutcome,
        ...(actionOutcome ? {} : { error: actionResult }),
      });

      // Wait for UI to stabilize
      const sleepMs = this.config.agentConfig.afterSleepAction * 1000;
      if (sleepMs > 0) {
        await new Promise((r) => setTimeout(r, sleepMs));
      }
    }
  }
}
