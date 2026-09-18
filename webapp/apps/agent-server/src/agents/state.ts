/**
 * DroidAgent state interface.
 * Ported from Python: agent/droid/state.py (DroidAgentState)
 *
 * In ADK, state is stored in Session.state as a plain Record<string, unknown>.
 * This file provides typed accessors and a builder for the state shape.
 */

export interface ActionHistoryEntry {
  action: string;
  summary: string;
  outcome: boolean;
  error?: string;
}

export interface VoiceInstructionEntry {
  instruction: string;
  timestamp: number;
  stepNumber: number;
}

export interface ScripterHistoryEntry {
  task: string;
  result: string;
  success: boolean;
}

/**
 * Typed shape of the DroidAgent's session state.
 * Keys are stored as flat `state['key']` in ADK Session.
 */
export interface DroidAgentState {
  // Task context
  instruction: string;
  stepNumber: number;
  taskStartTime: number;
  runtype: string;
  userId: string | null;
  jwtToken: string | null;
  deviceId: string | null;
  connectionId: string | null;
  taskId: string | null;

  // Device state (current)
  formattedDeviceState: string;
  focusedText: string;
  a11yTree: Array<Record<string, unknown>>;
  phoneState: Record<string, unknown>;
  screenshot: string | null; // base64 encoded
  width: number;
  height: number;

  // Device state (previous)
  previousFormattedDeviceState: string;

  // App tracking
  appCard: string;
  currentPackageName: string;
  currentActivityName: string;
  visitedPackages: string[];
  visitedActivities: string[];

  // Thought/Plan tracking
  lastThought: string;
  previousPlan: string;
  progressSummary: string;

  // Planning state (Manager sets these)
  plan: string;
  currentSubgoal: string;
  managerAnswer: string;

  // Action tracking
  actionHistory: ActionHistoryEntry[];
  summaryHistory: string[];
  actionOutcomes: boolean[];
  errorDescriptions: string[];
  lastAction: Record<string, unknown>;
  lastSummary: string;

  // Memory
  memory: string;

  // Message history (for stateful agents)
  messageHistory: Array<Record<string, unknown>>;

  // Error handling
  errorFlagPlan: boolean;
  errToManagerThresh: number;

  // Script execution
  scripterHistory: ScripterHistoryEntry[];
  lastScripterMessage: string;
  lastScripterSuccess: boolean;

  // Text manipulation
  hasTextToModify: boolean;
  textManipulationHistory: Array<Record<string, unknown>>;
  lastTextManipulationSuccess: boolean;

  // Voice command
  voiceCommandEnabled: boolean;
  lastVoiceInstruction: string;
  voiceInstructionTimestamp: number;
  voiceInstructionHistory: VoiceInstructionEntry[];

  // Custom variables
  customVariables: Record<string, unknown>;
  outputDir: string;
}

/**
 * Create initial state for a new DroidAgent session.
 */
export function createInitialState(
  overrides: Partial<DroidAgentState> = {},
): DroidAgentState {
  return {
    instruction: '',
    stepNumber: 0,
    taskStartTime: performance.now(),
    runtype: 'developer',
    userId: null,
    jwtToken: null,
    deviceId: null,
    connectionId: null,
    taskId: null,

    formattedDeviceState: '',
    focusedText: '',
    a11yTree: [],
    phoneState: {},
    screenshot: null,
    width: 0,
    height: 0,

    previousFormattedDeviceState: '',

    appCard: '',
    currentPackageName: '',
    currentActivityName: '',
    visitedPackages: [],
    visitedActivities: [],

    lastThought: '',
    previousPlan: '',
    progressSummary: '',

    plan: '',
    currentSubgoal: '',
    managerAnswer: '',

    actionHistory: [],
    summaryHistory: [],
    actionOutcomes: [],
    errorDescriptions: [],
    lastAction: {},
    lastSummary: '',

    memory: '',
    messageHistory: [],

    errorFlagPlan: false,
    errToManagerThresh: 2,

    scripterHistory: [],
    lastScripterMessage: '',
    lastScripterSuccess: true,

    hasTextToModify: false,
    textManipulationHistory: [],
    lastTextManipulationSuccess: false,

    voiceCommandEnabled: false,
    lastVoiceInstruction: '',
    voiceInstructionTimestamp: 0,
    voiceInstructionHistory: [],

    customVariables: {},
    outputDir: '',

    ...overrides,
  };
}
