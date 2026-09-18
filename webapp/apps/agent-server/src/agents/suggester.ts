/**
 * TaskSuggester - Analyzes screen state and suggests actionable tasks.
 *
 * Ported from Python: agent/suggester/suggester_agent.py (307 lines)
 *
 * Lightweight one-shot agent that:
 * 1. Takes the full phone state (accessibility tree + phone state + device context)
 * 2. Analyzes what the user is currently viewing
 * 3. Returns a list of suggested tasks the user might want to perform
 */

import type { BaseLlm, LlmRequest, LlmResponse } from '@google/adk';
import type { Content, Part } from '@google/genai';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('suggester');

// ── Types ──

export interface TaskSuggestion {
  title: string;
  description: string;
  command: string;
}

export interface TaskSuggestions {
  suggestions: TaskSuggestion[];
  context_summary: string;
}

export interface SuggestTasksInput {
  stateFull: Record<string, unknown>;
  screenshotBase64?: string;
  maxSuggestions?: number;
}

// ── System Prompt ──

const SUGGESTER_SYSTEM_PROMPT = `You are an intelligent assistant that analyzes Android device state and suggests helpful, COMPLEX tasks the user might want to perform.

You will receive the full device state including:
1. **Accessibility Tree**: JSON describing the current screen's UI elements (buttons, text, etc.)
2. **Phone State**: Current app, battery level, WiFi/cellular status, time, notifications, etc.
3. **Device Context**: Device model, screen size, Android version, installed apps, etc.
4. Optionally, a **screenshot** of the current screen

Based on this information, suggest 3-5 relevant, MULTI-STEP tasks that would take 5-10 actions to complete.

Guidelines:
- **Suggest COMPLEX workflows** that involve multiple steps, not simple one-click actions
- Analyze the current app context and suggest meaningful workflows within that app
- Consider cross-app workflows (e.g., copy from one app, paste in another)
- Think about realistic user goals that require several actions to accomplish
- Suggest tasks that provide real value and save the user significant time
- Commands should describe the END GOAL, not individual steps
- Keep titles concise (3-6 words) but make commands detailed enough to be unambiguous
- Use natural language that describes what the user wants to ACHIEVE

IMPORTANT: Avoid simple tasks like "Open app X" or "Click button Y". Instead, suggest complete workflows.

IMPORTANT: Return your response as valid JSON with the following structure:
{
  "context_summary": "Brief description of current screen and state",
  "suggestions": [
    {
      "title": "Short action title",
      "description": "What this multi-step task will accomplish",
      "command": "Detailed natural language command describing the goal"
    }
  ]
}

Example COMPLEX suggestions for a home screen:
- "Schedule meeting for tomorrow" → "Open Calendar, create a new event for tomorrow at 2pm titled 'Team Sync', set it for 30 minutes, and add a reminder"
- "Check weather and dress recommendation" → "Open the weather app, check today's forecast, and tell me what to wear based on the temperature"
- "Morning news briefing" → "Open Google News, read the top 3 headlines, and summarize them for me"

Example COMPLEX suggestions for Gmail inbox:
- "Process unread emails" → "Go through my unread emails, archive newsletters, and flag any that need a response"
- "Send meeting follow-up" → "Find the last email from my manager, reply with a thank you for the meeting, and ask about next steps"
- "Clean up promotions" → "Go to the Promotions tab, select all emails older than a week, and delete them"

Example COMPLEX suggestions for a messaging app:
- "Reply to unread messages" → "Check all my unread conversations and send a quick reply to each one"
- "Share my location with friend" → "Open the chat with Mom, send her my current location, and let her know I'll be home in 30 minutes"
- "Forward photo to group" → "Find the photo I received yesterday, forward it to the Family group chat with a caption"

Example COMPLEX suggestions for browser:
- "Research and bookmark" → "Search for the best restaurants near me, open the top 3 results, and bookmark any that look interesting"
- "Compare prices" → "Search for iPhone 15 cases, compare prices from the first 3 results, and tell me the cheapest option"

Example COMPLEX suggestions for settings/system:
- "Optimize battery life" → "Go to Settings, check which apps are using the most battery, force stop any that are draining excessively, and enable battery saver mode"
- "Free up storage" → "Open Settings, go to Storage, find the largest apps I haven't used recently, and clear their cache"
- "Setup Do Not Disturb" → "Enable Do Not Disturb mode, schedule it from 10pm to 7am, but allow calls from favorites"
`;

// ── Helpers ──

function truncateContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars) + '\n... (truncated)';
}

function parseSuggestionsResponse(responseText: string): TaskSuggestions {
  // Try to parse the whole response as JSON
  try {
    const data = JSON.parse(responseText) as TaskSuggestions;
    return data;
  } catch {
    // not valid JSON
  }

  // Try to find JSON block in the response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[0]) as TaskSuggestions;
      return data;
    } catch {
      // not valid JSON block
    }
  }

  log.warn('Failed to parse suggestions response, returning empty');
  return {
    suggestions: [],
    context_summary: 'Unable to parse screen context',
  };
}

// ── Main Function ──

/**
 * Generate task suggestions based on current device state.
 * One-shot LLM call — no multi-turn conversation.
 */
export async function suggestTasks(
  llm: BaseLlm,
  input: SuggestTasksInput,
): Promise<TaskSuggestions> {
  const maxSuggestions = input.maxSuggestions ?? 5;

  try {
    const a11yTree = input.stateFull.a11y_tree ?? {};
    const phoneState = input.stateFull.phone_state ?? {};
    const deviceContext = input.stateFull.device_context as Record<string, unknown> | undefined ?? {};

    // Build state description
    const stateParts: string[] = [];

    // Accessibility tree (most important for UI context)
    if (a11yTree && Object.keys(a11yTree as object).length > 0) {
      let treeStr = JSON.stringify(a11yTree, null, 2);
      treeStr = truncateContent(treeStr, 25000);
      stateParts.push(
        `## Accessibility Tree (Current Screen UI)\n\`\`\`json\n${treeStr}\n\`\`\``,
      );
    }

    // Phone state
    if (phoneState && Object.keys(phoneState as object).length > 0) {
      let phoneStr = JSON.stringify(phoneState, null, 2);
      phoneStr = truncateContent(phoneStr, 3000);
      stateParts.push(`## Phone State\n\`\`\`json\n${phoneStr}\n\`\`\``);
    }

    // Device context (summarized to save tokens)
    if (deviceContext && Object.keys(deviceContext).length > 0) {
      const contextSummary: Record<string, unknown> = {};
      for (const key of ['device_model', 'android_version', 'screen_width', 'screen_height']) {
        if (deviceContext[key] != null) {
          contextSummary[key] = deviceContext[key];
        }
      }
      if (Object.keys(contextSummary).length > 0) {
        const contextStr = JSON.stringify(contextSummary, null, 2);
        stateParts.push(
          `## Device Context\n\`\`\`json\n${contextStr}\n\`\`\``,
        );
      }
    }

    const fullStateStr = stateParts.join('\n\n');
    const userText = `Analyze this device state and suggest ${maxSuggestions} relevant tasks:\n\n${fullStateStr}`;

    // Build user message parts
    const parts: Part[] = [{ text: userText }];

    // Add screenshot if available
    if (input.screenshotBase64) {
      let imageData = input.screenshotBase64;
      // Strip data URL prefix to get raw base64
      if (imageData.startsWith('data:image')) {
        const commaIdx = imageData.indexOf(',');
        if (commaIdx !== -1) {
          imageData = imageData.slice(commaIdx + 1);
        }
      }
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: imageData,
        },
      });
    }

    // Build messages for the LLM
    const contents: Content[] = [
      { role: 'user', parts },
    ];

    // Build LlmRequest
    const llmRequest: LlmRequest = {
      contents,
      config: {
        systemInstruction: SUGGESTER_SYSTEM_PROMPT,
      },
      liveConnectConfig: {},
      toolsDict: {},
    };

    // Call LLM (non-streaming, collect final response)
    let lastResponse: LlmResponse | undefined;
    for await (const chunk of llm.generateContentAsync(llmRequest)) {
      lastResponse = chunk;
    }

    // Extract text from response
    const responseText =
      lastResponse?.content?.parts
        ?.map((p: { text?: string }) => p.text)
        .filter(Boolean)
        .join('') ?? '';

    log.debug(`Suggester raw response: ${responseText.slice(0, 500)}...`);

    // Parse response
    const suggestions = parseSuggestionsResponse(responseText);

    // Limit suggestions
    if (suggestions.suggestions.length > maxSuggestions) {
      suggestions.suggestions = suggestions.suggestions.slice(0, maxSuggestions);
    }

    log.info(
      `Generated ${suggestions.suggestions.length} task suggestions for context: ${suggestions.context_summary.slice(0, 50)}...`,
    );

    return suggestions;
  } catch (err) {
    log.error(`Failed to generate suggestions: ${(err as Error).message}`);
    return {
      suggestions: [],
      context_summary: '',
    };
  }
}
