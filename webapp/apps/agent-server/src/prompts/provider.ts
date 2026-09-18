/**
 * Nunjucks prompt provider for rendering agent prompt templates.
 *
 * Configures a Nunjucks environment pointing at the prompts/ directory
 * and exports an ADK InstructionProvider factory for each agent type.
 *
 * Templates (ported from Python) use snake_case variable names while
 * DroidAgentState uses camelCase. `buildTemplateContext` bridges the two.
 *
 * Python reference: droiduse_backend/agent/codeact/codeact_agent.py,
 *   manager/manager_agent.py, executor/executor_agent.py
 */

import nunjucks from 'nunjucks';
import path from 'node:path';
import type { InstructionProvider, ReadonlyContext } from '@google/adk';
import type { FunctionTool } from '@google/adk';
import type { DroidAgentState } from '../agents/state.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('prompt-provider');

/**
 * Build a one-line tool description from a FunctionTool.
 */
function describeToolOneLiner(tool: FunctionTool): string {
  return `- ${tool.name}: ${tool.description ?? '(no description)'}`;
}

/**
 * Format an array of FunctionTools into a text block suitable for
 * the `{{ tool_descriptions }}` template variable.
 */
export function formatToolDescriptions(tools: FunctionTool[]): string {
  return tools.map(describeToolOneLiner).join('\n');
}

/**
 * Build structured atomic action descriptions for the executor template's
 * `{{ atomic_actions }}` variable.
 *
 * Returns an iterable of [name, { description, arguments }] pairs,
 * matching the Python `atomic_tools.items()` pattern used in the template:
 *   {% for action_name, action_info in atomic_actions %}
 */
export function formatAtomicActions(
  tools: FunctionTool[],
): Array<[string, { description: string; arguments: string[] }]> {
  return tools.map((tool) => {
    const argNames: string[] = [];
    try {
      const decl = tool._getDeclaration();
      const props = decl.parameters?.properties;
      if (props) {
        argNames.push(...Object.keys(props));
      }
    } catch {
      // Fallback: no argument names
    }
    return [
      tool.name,
      { description: tool.description ?? '', arguments: argNames },
    ];
  });
}

/**
 * Map camelCase DroidAgentState fields → snake_case template variables
 * expected by the .njk templates (ported from Python Jinja2).
 *
 * Matches the context-building in:
 * - Python CodeAct: _build_system_prompt()
 * - Python Manager: _build_system_prompt()
 * - Python Executor: prepare_context()
 */
export function buildTemplateContext(
  state: Partial<DroidAgentState> & Record<string, unknown>,
): Record<string, unknown> {
  // ── Error history (Manager template) ──
  // Python zips action_history, summary_history, error_descriptions for failed entries.
  // In TS the actionHistory already has all fields; filter to failures only.
  const actionHistory = state.actionHistory ?? [];
  const errorHistory = actionHistory
    .filter((a) => !a.outcome)
    .map((a) => ({
      action: a.action,
      summary: a.summary,
      error: a.error ?? '',
    }));

  // ── Action history for executor (last 5) ──
  // Python format: {action, summary, outcome, error}
  const recentActions = actionHistory.slice(-5).map((a) => ({
    action: a.action,
    summary: a.summary,
    outcome: a.outcome,
    error: a.error ?? '',
  }));

  // ── Voice instruction history ──
  const voiceHistory = state.voiceInstructionHistory ?? [];
  const voiceInstructionHistory = voiceHistory.slice(-5).map((v) => ({
    instruction: v.instruction,
    step_number: v.stepNumber,
  }));

  return {
    // ── Pass-through keys (same name in state and templates) ──
    instruction: state.instruction ?? '',
    plan: state.plan ?? '',
    memory: state.memory ?? '',

    // ── Manager template vars ──
    voice_instruction: state.lastVoiceInstruction || undefined,
    voice_instruction_history:
      voiceInstructionHistory.length > 0
        ? voiceInstructionHistory
        : undefined,
    app_card: state.appCard || undefined,
    error_history: errorHistory.length > 0 ? errorHistory : undefined,

    // ── Executor template vars ──
    device_state: state.formattedDeviceState || undefined,
    subgoal: state.currentSubgoal || undefined,
    progress_status: state.progressSummary || undefined,
    action_history: recentActions.length > 0 ? recentActions : undefined,

    // ── Custom variables (available to all templates as {{ variables.key }}) ──
    variables: state.customVariables ?? {},
  };
}

/**
 * Create an ADK InstructionProvider that renders a Nunjucks template
 * with the current session state merged with extra static context.
 *
 * @param agentType   - Sub-directory under promptsDir (e.g. 'codeact', 'manager', 'executor')
 * @param promptsDir  - Absolute path to the prompts root directory
 * @param extraContext - Static context merged into every render
 *   (tool_descriptions, config flags, atomic_actions, etc.)
 */
export function createInstructionProvider(
  agentType: string,
  promptsDir: string,
  extraContext: Record<string, unknown> = {},
): InstructionProvider {
  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(promptsDir),
    { autoescape: false, throwOnUndefined: false },
  );

  const templatePath = path.join(agentType, 'system.njk');

  return (ctx: ReadonlyContext): string => {
    try {
      const state = (ctx.state ?? {}) as Partial<DroidAgentState> &
        Record<string, unknown>;

      const templateContext: Record<string, unknown> = {
        // Map camelCase state → snake_case template vars
        ...buildTemplateContext(state),
        // Extra context overrides (tool descriptions, config flags, etc.)
        ...extraContext,
      };

      const rendered = env.render(templatePath, templateContext);
      log.info(`Rendered ${agentType} prompt (${rendered.length} chars)`);
      return rendered;
    } catch (err) {
      log.error(`Failed to render ${agentType} prompt: ${(err as Error).message}`);
      // Re-throw so ADK doesn't silently fall back to empty instruction
      throw err;
    }
  };
}
