import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createInstructionProvider,
  formatToolDescriptions,
  formatAtomicActions,
  buildTemplateContext,
} from '../src/prompts/provider.js';
import type { ReadonlyContext } from '@google/adk';
import type { DroidAgentState } from '../src/agents/state.js';

// ── Helpers ──

/** Build a minimal ReadonlyContext stub with the given state. */
function fakeContext(state: Record<string, unknown> = {}): ReadonlyContext {
  return { state } as unknown as ReadonlyContext;
}

/** Create a FunctionTool-like object (only .name and .description are read). */
function fakeTool(name: string, description?: string) {
  return { name, description } as { name: string; description?: string };
}

/** Create a FunctionTool-like object with _getDeclaration for atomic actions. */
function fakeToolWithParams(
  name: string,
  description: string,
  params: string[],
) {
  return {
    name,
    description,
    _getDeclaration: () => ({
      name,
      description,
      parameters: {
        type: 'OBJECT',
        properties: Object.fromEntries(
          params.map((p) => [p, { type: 'STRING' }]),
        ),
      },
    }),
  };
}

// ── formatToolDescriptions ──

describe('formatToolDescriptions', () => {
  it('formats multiple tools as a bullet list', () => {
    const tools = [
      fakeTool('tap_element', 'Tap a UI element by text or ID'),
      fakeTool('swipe', 'Swipe from start to end coordinates'),
    ];

    const result = formatToolDescriptions(tools as never[]);

    expect(result).toBe(
      '- tap_element: Tap a UI element by text or ID\n' +
        '- swipe: Swipe from start to end coordinates',
    );
  });

  it('handles tool with no description', () => {
    const tools = [fakeTool('mystery_tool')];

    const result = formatToolDescriptions(tools as never[]);

    expect(result).toBe('- mystery_tool: (no description)');
  });

  it('returns empty string for empty array', () => {
    expect(formatToolDescriptions([])).toBe('');
  });
});

// ── formatAtomicActions ──

describe('formatAtomicActions', () => {
  it('extracts action names and parameter names', () => {
    const tools = [
      fakeToolWithParams('tap_element', 'Tap a UI element', ['by', 'pattern']),
      fakeToolWithParams('swipe', 'Swipe', [
        'start_x',
        'start_y',
        'end_x',
        'end_y',
      ]),
    ];

    const result = formatAtomicActions(tools as never[]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual([
      'tap_element',
      { description: 'Tap a UI element', arguments: ['by', 'pattern'] },
    ]);
    expect(result[1]).toEqual([
      'swipe',
      {
        description: 'Swipe',
        arguments: ['start_x', 'start_y', 'end_x', 'end_y'],
      },
    ]);
  });

  it('returns empty arguments when _getDeclaration fails', () => {
    const tool = {
      name: 'broken_tool',
      description: 'A broken tool',
      _getDeclaration: () => {
        throw new Error('nope');
      },
    };

    const result = formatAtomicActions([tool] as never[]);

    expect(result).toEqual([
      ['broken_tool', { description: 'A broken tool', arguments: [] }],
    ]);
  });
});

// ── buildTemplateContext ──

describe('buildTemplateContext', () => {
  it('maps camelCase state keys to snake_case template vars', () => {
    const state: Partial<DroidAgentState> = {
      instruction: 'Open Gmail',
      appCard: 'Gmail: Tap Compose to write',
      formattedDeviceState: 'UI elements: [Compose, Inbox]',
      currentSubgoal: 'Tap the Compose button',
      progressSummary: 'Step 1 of 3 done',
      plan: '1. Open Gmail\n2. Compose email',
      memory: 'User said to send to bob@test.com',
      customVariables: { foo: 'bar' },
    };

    const ctx = buildTemplateContext(state as Partial<DroidAgentState> & Record<string, unknown>);

    // snake_case aliases
    expect(ctx.app_card).toBe('Gmail: Tap Compose to write');
    expect(ctx.device_state).toBe('UI elements: [Compose, Inbox]');
    expect(ctx.subgoal).toBe('Tap the Compose button');
    expect(ctx.progress_status).toBe('Step 1 of 3 done');

    // Pass-through keys
    expect(ctx.instruction).toBe('Open Gmail');
    expect(ctx.plan).toBe('1. Open Gmail\n2. Compose email');
    expect(ctx.memory).toBe('User said to send to bob@test.com');
    expect(ctx.variables).toEqual({ foo: 'bar' });
  });

  it('builds error_history from failed actionHistory entries', () => {
    const state: Partial<DroidAgentState> = {
      actionHistory: [
        { action: 'tap Inbox', summary: 'Tapped Inbox', outcome: true },
        {
          action: 'tap Compose',
          summary: 'Tapped Compose',
          outcome: false,
          error: 'Element not found',
        },
        {
          action: 'swipe up',
          summary: 'Swiped up',
          outcome: false,
          error: 'Swipe failed',
        },
      ],
    };

    const ctx = buildTemplateContext(state as Partial<DroidAgentState> & Record<string, unknown>);

    expect(ctx.error_history).toEqual([
      { action: 'tap Compose', summary: 'Tapped Compose', error: 'Element not found' },
      { action: 'swipe up', summary: 'Swiped up', error: 'Swipe failed' },
    ]);
  });

  it('limits action_history to last 5 entries', () => {
    const entries = Array.from({ length: 8 }, (_, i) => ({
      action: `action_${i}`,
      summary: `summary_${i}`,
      outcome: true,
    }));

    const state: Partial<DroidAgentState> = { actionHistory: entries };
    const ctx = buildTemplateContext(state as Partial<DroidAgentState> & Record<string, unknown>);

    const history = ctx.action_history as Array<{ action: string }>;
    expect(history).toHaveLength(5);
    expect(history[0].action).toBe('action_3');
    expect(history[4].action).toBe('action_7');
  });

  it('maps voice instruction history with snake_case keys', () => {
    const state: Partial<DroidAgentState> = {
      lastVoiceInstruction: 'Stop everything',
      voiceInstructionHistory: [
        { instruction: 'Go back', stepNumber: 2, timestamp: 1000 },
        { instruction: 'Stop everything', stepNumber: 5, timestamp: 2000 },
      ],
    };

    const ctx = buildTemplateContext(state as Partial<DroidAgentState> & Record<string, unknown>);

    expect(ctx.voice_instruction).toBe('Stop everything');
    expect(ctx.voice_instruction_history).toEqual([
      { instruction: 'Go back', step_number: 2 },
      { instruction: 'Stop everything', step_number: 5 },
    ]);
  });

  it('omits optional fields when state is empty', () => {
    const ctx = buildTemplateContext({} as Partial<DroidAgentState> & Record<string, unknown>);

    expect(ctx.voice_instruction).toBeUndefined();
    expect(ctx.voice_instruction_history).toBeUndefined();
    expect(ctx.app_card).toBeUndefined();
    expect(ctx.error_history).toBeUndefined();
    expect(ctx.device_state).toBeUndefined();
    expect(ctx.subgoal).toBeUndefined();
    expect(ctx.progress_status).toBeUndefined();
    expect(ctx.action_history).toBeUndefined();
    // But these always have values
    expect(ctx.instruction).toBe('');
    expect(ctx.plan).toBe('');
    expect(ctx.memory).toBe('');
    expect(ctx.variables).toEqual({});
  });
});

// ── createInstructionProvider ──

describe('createInstructionProvider', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'prompt-provider-test-'));

    // Simple test template
    mkdirSync(join(tmpDir, 'testagent'));
    writeFileSync(
      join(tmpDir, 'testagent', 'system.njk'),
      [
        'Hello {{ name }}!',
        'Task: {{ instruction }}',
        'Tools: {{ tool_descriptions }}',
      ].join('\n'),
    );

    // Template with conditionals
    mkdirSync(join(tmpDir, 'conditional'));
    writeFileSync(
      join(tmpDir, 'conditional', 'system.njk'),
      [
        '{% if plan %}Plan: {{ plan }}{% endif %}',
        '{% if memory %}Memory: {{ memory }}{% endif %}',
      ].join('\n'),
    );

    // Template using snake_case vars from buildTemplateContext
    mkdirSync(join(tmpDir, 'snaketest'));
    writeFileSync(
      join(tmpDir, 'snaketest', 'system.njk'),
      [
        'App: {{ app_card }}',
        'State: {{ device_state }}',
        'Subgoal: {{ subgoal }}',
        '{% if error_history %}Errors: {{ error_history | length }}{% endif %}',
        '{% if action_history %}Actions: {{ action_history | length }}{% endif %}',
      ].join('\n'),
    );
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('renders template with session state variables', () => {
    const provider = createInstructionProvider('testagent', tmpDir, {
      name: 'DroidAgent',
    });
    const ctx = fakeContext({ instruction: 'Open Gmail' });

    const result = provider(ctx);

    expect(result).toContain('Hello DroidAgent!');
    expect(result).toContain('Task: Open Gmail');
  });

  it('merges extraContext into template rendering', () => {
    const provider = createInstructionProvider('testagent', tmpDir, {
      tool_descriptions: '- tap: Tap stuff\n- swipe: Swipe stuff',
    });
    const ctx = fakeContext({ name: 'Agent', instruction: 'test' });

    const result = provider(ctx);

    expect(result).toContain('Tools: - tap: Tap stuff');
    expect(result).toContain('- swipe: Swipe stuff');
  });

  it('extraContext overrides state-derived keys', () => {
    const provider = createInstructionProvider('testagent', tmpDir, {
      name: 'OverriddenName',
    });
    const ctx = fakeContext({ name: 'OriginalName', instruction: 'hi' });

    const result = provider(ctx);

    expect(result).toContain('Hello OverriddenName!');
    expect(result).not.toContain('OriginalName');
  });

  it('handles missing state keys gracefully', () => {
    const provider = createInstructionProvider('testagent', tmpDir);
    const ctx = fakeContext({});

    const result = provider(ctx);

    expect(result).toContain('Hello !');
    expect(result).toContain('Task: ');
  });

  it('handles conditional blocks in templates', () => {
    const provider = createInstructionProvider('conditional', tmpDir);

    const withPlan = provider(fakeContext({ plan: 'Step 1: Open app' }));
    expect(withPlan).toContain('Plan: Step 1: Open app');
    expect(withPlan).not.toContain('Memory:');

    const withBoth = provider(
      fakeContext({ plan: 'Step 1', memory: 'Saw confirmation screen' }),
    );
    expect(withBoth).toContain('Plan: Step 1');
    expect(withBoth).toContain('Memory: Saw confirmation screen');

    const withNeither = provider(fakeContext({}));
    expect(withNeither).not.toContain('Plan:');
    expect(withNeither).not.toContain('Memory:');
  });

  it('injects camelCase state as snake_case template vars', () => {
    const provider = createInstructionProvider('snaketest', tmpDir);
    const ctx = fakeContext({
      appCard: 'Gmail tips',
      formattedDeviceState: '[Compose] [Inbox]',
      currentSubgoal: 'Tap Compose',
      actionHistory: [
        { action: 'tap', summary: 'tapped', outcome: true },
        { action: 'swipe', summary: 'swiped', outcome: false, error: 'fail' },
      ],
    });

    const result = provider(ctx);

    expect(result).toContain('App: Gmail tips');
    expect(result).toContain('State: [Compose] [Inbox]');
    expect(result).toContain('Subgoal: Tap Compose');
    expect(result).toContain('Errors: 1');
    expect(result).toContain('Actions: 2');
  });

  it('renders real codeact/system.njk with tool_descriptions', () => {
    const realPromptsDir = join(__dirname, '..', 'prompts');
    const provider = createInstructionProvider('codeact', realPromptsDir, {
      tool_descriptions:
        '- tap_element: Tap a UI element\n- swipe: Swipe on screen',
    });

    const ctx = fakeContext({ instruction: 'Open Settings' });
    const result = provider(ctx);

    expect(result).toContain('- tap_element: Tap a UI element');
    expect(result).toContain('- swipe: Swipe on screen');
    expect(result.length).toBeGreaterThan(100);
  });

  it('renders real manager/system.njk with state and config flags', () => {
    const realPromptsDir = join(__dirname, '..', 'prompts');
    const provider = createInstructionProvider('manager', realPromptsDir, {
      text_manipulation_enabled: true,
      scripter_execution_enabled: true,
      scripter_max_steps: 10,
    });

    const ctx = fakeContext({
      instruction: 'Book a hotel in Tokyo',
      appCard: 'Booking.com: Use search bar for destinations',
      lastVoiceInstruction: 'Change to Osaka instead',
    });
    const result = provider(ctx);

    expect(result).toContain('Book a hotel in Tokyo');
    expect(result).toContain('Booking.com: Use search bar for destinations');
    expect(result).toContain('Change to Osaka instead');
    expect(result).toContain('TEXT_TASK');
    expect(result).toContain('<script>');
    expect(result.length).toBeGreaterThan(100);
  });

  it('renders real executor/system.njk with subgoal, plan, and atomic actions', () => {
    const realPromptsDir = join(__dirname, '..', 'prompts');
    const atomicActions = [
      ['tap_element', { description: 'Tap a UI element', arguments: ['by', 'pattern'] }],
      ['swipe', { description: 'Swipe on screen', arguments: ['start_x', 'start_y', 'end_x', 'end_y'] }],
    ];
    const provider = createInstructionProvider('executor', realPromptsDir, {
      atomic_actions: atomicActions,
    });

    const ctx = fakeContext({
      instruction: 'Send an email',
      plan: '1. Open Gmail\n2. Compose email',
      currentSubgoal: 'Tap the Compose button',
      formattedDeviceState: '[0] Compose button\n[1] Inbox',
      actionHistory: [
        { action: 'open_app', summary: 'Opened Gmail', outcome: true },
      ],
    });
    const result = provider(ctx);

    expect(result).toContain('Send an email');
    expect(result).toContain('EXECUTE THIS SUBGOAL: Tap the Compose button');
    expect(result).toContain('1. Open Gmail');
    expect(result).toContain('[0] Compose button');
    // Atomic actions rendered
    expect(result).toContain('tap_element');
    expect(result).toContain('by, pattern');
    expect(result).toContain('swipe');
    // Action history rendered
    expect(result).toContain('Opened Gmail');
    expect(result).toContain('Successful');
  });

  it('throws on missing template file', () => {
    const provider = createInstructionProvider('nonexistent', tmpDir);

    expect(() => provider(fakeContext({}))).toThrow();
  });
});
