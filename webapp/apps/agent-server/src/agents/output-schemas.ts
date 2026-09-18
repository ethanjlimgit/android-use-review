/**
 * Output schemas for LlmAgent.outputSchema.
 *
 * When outputSchema is set on an LlmAgent, the agent can ONLY reply
 * with structured JSON — it CANNOT use any tools. This is the intended
 * behavior: DroidAgent parses the JSON and dispatches actions via
 * WebSocketConnectionTool.
 *
 * Uses @google/genai Schema + Type enum.
 */

import { Type } from '@google/genai';
import type { Schema } from '@google/genai';

/**
 * CodeAct schema — one action per step.
 *
 * { thought: string, action: string, args: { ... } }
 */
export const codeActOutputSchema: Schema = {
  type: Type.OBJECT,
  description: 'CodeAct agent response: one action per step',
  properties: {
    thought: {
      type: Type.STRING,
      description:
        'Your reasoning about the current screen state and what action to take next',
    },
    action: {
      type: Type.STRING,
      description:
        'The action to execute (e.g. tap_element, input_text, swipe, press_key, open_app, complete, remember)',
    },
    args: {
      type: Type.OBJECT,
      description:
        'Arguments for the action (varies by action type)',
      properties: {},
    },
  },
  required: ['thought', 'action', 'args'],
};

/**
 * Manager schema — planning output with optional completion signal.
 *
 * { thought, plan?, add_memory?, request_accomplished? }
 */
export const managerOutputSchema: Schema = {
  type: Type.OBJECT,
  description:
    'Manager agent response: high-level planning and progress tracking',
  properties: {
    thought: {
      type: Type.STRING,
      description:
        'Your analysis of the current state and rationale for the plan',
    },
    plan: {
      type: Type.STRING,
      description:
        'Updated numbered step plan for achieving the user request',
    },
    add_memory: {
      type: Type.STRING,
      description:
        'Important information to remember for later steps (with step context)',
    },
    request_accomplished: {
      type: Type.OBJECT,
      description:
        'Set this when the task is complete or cannot be completed',
      properties: {
        success: {
          type: Type.BOOLEAN,
          description: 'Whether the task was successfully completed',
        },
        reason: {
          type: Type.STRING,
          description:
            'Explanation of completion or failure reason',
        },
      },
      required: ['success', 'reason'],
    },
  },
  required: ['thought'],
};

/**
 * Executor schema — atomic action execution.
 *
 * { thought, action, args, description }
 */
export const executorOutputSchema: Schema = {
  type: Type.OBJECT,
  description:
    'Executor agent response: one atomic device action',
  properties: {
    thought: {
      type: Type.STRING,
      description:
        'Brief breakdown: what action, what target, what parameters',
    },
    action: {
      type: Type.STRING,
      description:
        'The atomic action to execute (e.g. tap_element, input_text, swipe, press_key, open_app)',
    },
    args: {
      type: Type.OBJECT,
      description:
        'Arguments for the action (varies by action type)',
      properties: {},
    },
    description: {
      type: Type.STRING,
      description: 'Brief description of the chosen action',
    },
  },
  required: ['thought', 'action', 'args', 'description'],
};
