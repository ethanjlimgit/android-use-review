/**
 * ADK FunctionTool definitions for device actions.
 * Each tool wraps a WebSocketConnectionTool method.
 *
 * All UI interactions use semantic element matching (text, id, description, class)
 * rather than index-based references.
 */

import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import type { WebSocketConnectionTool } from './ws-connection-tool.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('device-tools');

/**
 * Create all device FunctionTools for a given WebSocketConnectionTool instance.
 * These tools are passed to ADK LlmAgent as its tool set.
 */
export function createDeviceTools(
  wsTool: WebSocketConnectionTool,
  options: { disabledTools?: string[] } = {},
): FunctionTool[] {
  const disabled = new Set(options.disabledTools ?? []);

  const allTools: FunctionTool[] = [
    // ── Semantic UI Interaction ──

    new FunctionTool({
      name: 'tap_element',
      description:
        'Find and tap a UI element by text, resource ID, or content description using regex pattern matching.',
      parameters: z.object({
        by: z
          .enum(['text', 'id', 'desc', 'class'])
          .describe('Search field: text, id, desc, or class'),
        pattern: z
          .string()
          .describe('Regex pattern to match (case-insensitive)'),
      }),
      execute: async ({ by, pattern }) => {
        return { result: await wsTool.tapElement(by, pattern) };
      },
    }),

    new FunctionTool({
      name: 'input_text_element',
      description:
        'Find a UI element by text/ID/description and type text into it.',
      parameters: z.object({
        text: z.string().describe('Text to type'),
        by: z
          .enum(['text', 'id', 'desc', 'class'])
          .describe('Search field'),
        pattern: z.string().describe('Regex pattern to match'),
        clear: z
          .boolean()
          .default(false)
          .describe('Clear existing text first'),
      }),
      execute: async ({ text, by, pattern, clear }) => {
        return {
          result: await wsTool.inputTextElement(text, by, pattern, clear),
        };
      },
    }),

    new FunctionTool({
      name: 'long_press_element',
      description:
        'Find and long press a UI element by text, resource ID, or content description.',
      parameters: z.object({
        by: z
          .enum(['text', 'id', 'desc', 'class'])
          .describe('Search field'),
        pattern: z.string().describe('Regex pattern to match'),
      }),
      execute: async ({ by, pattern }) => {
        return { result: await wsTool.longPressElement(by, pattern) };
      },
    }),

    new FunctionTool({
      name: 'input_text',
      description:
        'Type text into the currently focused input field. Use input_text_element to find and focus an element first if needed.',
      parameters: z.object({
        text: z.string().describe('Text to type'),
        clear: z
          .boolean()
          .default(false)
          .describe('Whether to clear existing text before typing'),
      }),
      execute: async ({ text, clear }) => {
        return { result: await wsTool.inputText(text, clear) };
      },
    }),

    // ── Navigation ──

    new FunctionTool({
      name: 'swipe',
      description:
        'Swipe from start coordinates to end coordinates. Use to scroll or navigate.',
      parameters: z.object({
        start_x: z.number().int().describe('Start X coordinate'),
        start_y: z.number().int().describe('Start Y coordinate'),
        end_x: z.number().int().describe('End X coordinate'),
        end_y: z.number().int().describe('End Y coordinate'),
        duration_ms: z
          .number()
          .int()
          .default(1000)
          .describe('Duration in milliseconds'),
      }),
      execute: async ({ start_x, start_y, end_x, end_y, duration_ms }) => {
        const ok = await wsTool.swipe(
          start_x,
          start_y,
          end_x,
          end_y,
          duration_ms,
        );
        return { success: ok };
      },
    }),

    new FunctionTool({
      name: 'drag',
      description:
        'Drag from start to end coordinates (long press + move). Useful for drag-and-drop.',
      parameters: z.object({
        start_x: z.number().int().describe('Start X coordinate'),
        start_y: z.number().int().describe('Start Y coordinate'),
        end_x: z.number().int().describe('End X coordinate'),
        end_y: z.number().int().describe('End Y coordinate'),
        duration_sec: z
          .number()
          .default(3)
          .describe('Duration in seconds'),
      }),
      execute: async ({ start_x, start_y, end_x, end_y, duration_sec }) => {
        const ok = await wsTool.drag(
          start_x,
          start_y,
          end_x,
          end_y,
          duration_sec,
        );
        return { success: ok };
      },
    }),

    new FunctionTool({
      name: 'press_key',
      description:
        'Press a key by Android keycode. Common codes: 4=BACK, 3=HOME, 66=ENTER, 67=DEL.',
      parameters: z.object({
        keycode: z.number().int().describe('Android keycode to press'),
      }),
      execute: async ({ keycode }) => {
        return { result: await wsTool.pressKey(keycode) };
      },
    }),

    // ── App Management ──

    new FunctionTool({
      name: 'open_app',
      description:
        'Open an app by its package name. Example: "com.google.android.gm" for Gmail.',
      parameters: z.object({
        package_name: z.string().describe('Package name of the app to open'),
        activity: z
          .string()
          .default('')
          .describe('Optional activity name to start'),
      }),
      execute: async ({ package_name, activity }) => {
        return { result: await wsTool.startApp(package_name, activity) };
      },
    }),

    new FunctionTool({
      name: 'list_packages',
      description: 'List installed packages on the device.',
      parameters: z.object({
        include_system: z
          .boolean()
          .default(false)
          .describe('Include system packages'),
      }),
      execute: async ({ include_system }) => {
        return { packages: await wsTool.listPackages(include_system) };
      },
    }),

    // ── State Management ──

    new FunctionTool({
      name: 'remember',
      description:
        'Store important information in memory for later reference. Use for remembering text, data, or context.',
      parameters: z.object({
        information: z.string().describe('Information to remember'),
      }),
      execute: async ({ information }) => {
        return { result: wsTool.remember(information) };
      },
    }),

    new FunctionTool({
      name: 'complete',
      description:
        'Mark the current task as finished. Call this when the task is done or cannot be completed.',
      parameters: z.object({
        success: z.boolean().describe('Whether the task was successful'),
        reason: z
          .string()
          .default('')
          .describe(
            'Explanation of completion or failure reason',
          ),
      }),
      execute: async ({ success, reason }) => {
        wsTool.complete(success, reason);
        return {
          status: success ? 'completed' : 'failed',
          reason,
        };
      },
    }),
  ];

  // Filter out disabled tools
  const enabledTools = allTools.filter((tool) => !disabled.has(tool.name));
  log.info(
    `Created ${enabledTools.length} device tools (disabled: ${disabled.size > 0 ? [...disabled].join(', ') : 'none'})`,
  );
  return enabledTools;
}
