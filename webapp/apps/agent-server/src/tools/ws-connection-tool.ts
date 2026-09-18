/**
 * WebSocket Connection Tool - Uses an existing WebSocket connection for device control.
 * Ported from Python: tools/websocket_connection_tool.py (1139 lines)
 *
 * This tool is used when the phone initiates a connection to the backend.
 * All device commands are sent through the existing connection.
 *
 * UI interactions use semantic element matching (find by text, id, desc, class)
 * rather than index-based references.
 */

import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { createChildLogger } from '../logger.js';
import {
  filterTree,
  formatDeviceState,
  type TreeNode,
  type DeviceContext,
  type FormattedState,
  type PhoneState,
} from './tree-filter.js';

const log = createChildLogger('ws-connection-tool');

interface DeviceCommand {
  method: string;
  params: Record<string, unknown>;
  type: 'coordinate' | 'semantic';
}

/** Read-only methods (not recorded for replay) */
const READ_ONLY_METHODS = new Set([
  'state_full',
  'screenshot',
  'apps',
  'packages',
  'date',
  'time',
  'version',
  'overlay_offset',
]);

/** Semantic methods (retryable during replay) */
const SEMANTIC_METHODS = new Set([
  'find_and_click',
  'find_and_input',
  'find_and_long_press',
  'open_app',
]);

export class WebSocketConnectionTool {
  private websocket: WebSocket;
  private pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
  }>();

  // Caches
  private rawTreeCache: TreeNode | null = null;
  private filteredTreeCache: TreeNode | null = null;
  private lastStateUpdate: number | null = null;
  private cachedFormattedState: FormattedState | null = null;

  // Date caching
  private initialDeviceDate: string | null = null;
  private initialServerTime: number | null = null;

  // Task state
  memory: string[] = [];
  reason: string | null = null;
  success: boolean | null = null;
  finished = false;

  // Device command tracking for replay recording
  private deviceCommands: DeviceCommand[] = [];

  // Cancellation
  private cancelled = false;

  constructor(
    websocket: WebSocket,
    private visionEnabled = true,
  ) {
    this.websocket = websocket;
  }

  // ── Connection Management ──

  private ensureConnected(): void {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new Error(
        'WebSocket connection is closed. Phone may have disconnected.',
      );
    }
  }

  async cleanup(): Promise<void> {
    const count = this.pendingRequests.size;
    if (count > 0) {
      log.info(`Cleaning up ${count} pending request(s)`);
    }
    for (const [, { reject }] of this.pendingRequests) {
      reject(new Error('Request cancelled during cleanup'));
    }
    this.pendingRequests.clear();
  }

  cancel(): void {
    this.cancelled = true;
    log.info('cancel: task cancellation requested');
  }

  // ── Request/Response Protocol ──

  private async sendRequest(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<unknown> {
    this.ensureConnected();

    // Record action commands for replay (skip read-only queries)
    if (!READ_ONLY_METHODS.has(method)) {
      this.deviceCommands.push({
        method,
        params: { ...params },
        type: SEMANTIC_METHODS.has(method) ? 'semantic' : 'coordinate',
      });
    }

    const requestId = randomUUID();
    const request = { id: requestId, method, params };

    // Determine timeout based on method
    let timeout: number;
    if (method === 'screenshot') timeout = 15_000;
    else if (['app/start', 'apps', 'app/stop'].includes(method))
      timeout = 20_000;
    else timeout = 10_000;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(
          new Error(
            `Request '${method}' timed out after ${timeout}ms. Phone may not be responding.`,
          ),
        );
      }, timeout);

      // Wrap resolve/reject to clear timer
      const origResolve = resolve;
      const origReject = reject;
      this.pendingRequests.set(requestId, {
        resolve: (value: unknown) => {
          clearTimeout(timer);
          origResolve(value);
        },
        reject: (reason: Error) => {
          clearTimeout(timer);
          origReject(reason);
        },
      });

      log.info(`>> WS send: ${method} id=${requestId.slice(0, 8)} params=${JSON.stringify(params)}`);
      this.websocket.send(JSON.stringify(request));
    });
  }

  /** Handle JSON response from phone */
  handleResponse(message: string): void {
    try {
      const data = JSON.parse(message) as Record<string, unknown>;

      if ('id' in data) {
        const requestId = data.id as string;
        const status = data.status as string | undefined;
        log.info(`<< WS recv: id=${(requestId as string).slice(0, 8)} status=${status ?? 'none'}`);

        const pending = this.pendingRequests.get(requestId);
        this.pendingRequests.delete(requestId);

        if (pending) {
          if (status === 'success') {
            pending.resolve(data.result ?? data);
          } else if (status === 'error') {
            log.warn(`<< WS error response: ${data.error ?? 'Unknown error'}`);
            pending.reject(
              new Error(`Phone error: ${data.error ?? 'Unknown error'}`),
            );
          } else {
            // No status field - return full data
            pending.resolve(data);
          }
        } else {
          log.warn(`<< WS recv for unknown request id=${(requestId as string).slice(0, 8)}`);
        }
      }
    } catch (err) {
      log.error(`Failed to parse JSON response: ${(err as Error).message}`);
    }
  }

  /** Handle binary response (e.g., screenshot) */
  handleBinaryResponse(data: Buffer): void {
    if (data.length < 36) return;

    const requestId = data.subarray(0, 36).toString('utf-8');
    const payload = data.subarray(36);

    log.info(`<< WS binary: id=${requestId.slice(0, 8)} size=${payload.length} bytes`);

    const pending = this.pendingRequests.get(requestId);
    this.pendingRequests.delete(requestId);

    if (pending) {
      pending.resolve(payload);
    } else {
      log.warn(`<< WS binary for unknown request id=${requestId.slice(0, 8)}`);
    }
  }

  // ── State Cache ──

  private updateStateCache(stateData: Record<string, unknown>): void {
    if (
      typeof stateData !== 'object' ||
      !('a11y_tree' in stateData) ||
      !('phone_state' in stateData)
    ) {
      return;
    }

    const deviceContext = (stateData.device_context ?? {}) as DeviceContext;
    this.rawTreeCache = stateData.a11y_tree as TreeNode;
    this.filteredTreeCache = filterTree(this.rawTreeCache, deviceContext);

    const formatted = formatDeviceState(
      this.filteredTreeCache,
      stateData.phone_state as PhoneState,
    );
    this.cachedFormattedState = formatted;
    this.lastStateUpdate = performance.now();
  }

  // ── Device Operations ──

  async getState(forceFresh = false): Promise<FormattedState> {
    this.ensureConnected();

    // Check cache (500ms TTL)
    if (
      !forceFresh &&
      this.cachedFormattedState &&
      this.lastStateUpdate !== null
    ) {
      const cacheAge = performance.now() - this.lastStateUpdate;
      if (cacheAge < 500) {
        log.info(`getState: using cache (age: ${cacheAge.toFixed(0)}ms)`);
        return this.cachedFormattedState;
      }
    }

    log.info(`getState: fetching fresh state (forceFresh=${forceFresh})`);

    // Fetch fresh state with retry for "No active window" errors
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    let result: unknown = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        result = await this.sendRequest('state_full', {});
        break;
      } catch (err) {
        if (
          (err as Error).message.includes('No active window') &&
          attempt < MAX_RETRIES
        ) {
          log.warn(
            `No active window on attempt ${attempt}/${MAX_RETRIES}, retrying...`,
          );
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
        } else {
          throw err;
        }
      }
    }

    if (!result) {
      throw new Error('Received null response from state_full request');
    }

    // Parse nested response format
    let combinedData = result as Record<string, unknown>;
    if (typeof result === 'object' && 'result' in (result as object)) {
      const nested = (result as Record<string, unknown>).result;
      combinedData =
        typeof nested === 'string'
          ? (JSON.parse(nested) as Record<string, unknown>)
          : (nested as Record<string, unknown>);
    }

    if (!('a11y_tree' in combinedData) || !('phone_state' in combinedData)) {
      throw new Error(
        `Missing a11y_tree or phone_state. Keys: ${Object.keys(combinedData).join(', ')}`,
      );
    }

    const deviceContext = (combinedData.device_context ?? {}) as DeviceContext;
    this.rawTreeCache = combinedData.a11y_tree as TreeNode;
    this.filteredTreeCache = filterTree(this.rawTreeCache, deviceContext);

    const formatted = formatDeviceState(
      this.filteredTreeCache,
      combinedData.phone_state as PhoneState,
    );
    this.cachedFormattedState = formatted;
    this.lastStateUpdate = performance.now();

    log.info(`getState: received state (text length: ${formatted.formattedText.length} chars)`);
    return formatted;
  }

  async inputText(text: string, clear = false): Promise<string> {
    this.ensureConnected();
    log.info(`inputText: text="${text.slice(0, 50)}" clear=${clear}`);
    try {
      const base64Text = Buffer.from(text, 'utf-8').toString('base64');
      const result = await this.sendRequest('keyboard/input', {
        base64_text: base64Text,
        clear,
      });
      this.maybeCacheState(result);
      log.info(`inputText: success`);
      return `Text '${text}' input successfully`;
    } catch (err) {
      log.warn(`inputText: failed - ${(err as Error).message}`);
      return `Failed to input text: ${(err as Error).message}`;
    }
  }

  async takeScreenshot(hideOverlay = true): Promise<Buffer> {
    this.ensureConnected();
    log.info(`takeScreenshot: requesting (hideOverlay=${hideOverlay})`);
    const result = await this.sendRequest('screenshot', {
      hideOverlay,
    });

    if (result instanceof Buffer || result instanceof Uint8Array) {
      return Buffer.from(result);
    }
    if (typeof result === 'object' && result !== null) {
      const data = (result as Record<string, unknown>).data;
      if (typeof data === 'string') {
        return Buffer.from(data, 'base64');
      }
    }
    if (typeof result === 'string') {
      return Buffer.from(result, 'base64');
    }
    throw new Error(`Invalid screenshot response format: ${typeof result}`);
  }

  async swipe(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    durationMs = 1000,
  ): Promise<boolean> {
    this.ensureConnected();
    log.info(`swipe: (${startX},${startY}) -> (${endX},${endY}) duration=${durationMs}ms`);
    try {
      const result = await this.sendRequest('swipe', {
        startX,
        startY,
        endX,
        endY,
        duration: durationMs / 1000,
      });
      this.maybeCacheState(result);
      log.info(`swipe: success`);
      return true;
    } catch (err) {
      log.warn(`swipe: failed - ${(err as Error).message}`);
      return false;
    }
  }

  async drag(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    durationSec = 3,
  ): Promise<boolean> {
    this.ensureConnected();
    log.info(`drag: (${startX},${startY}) -> (${endX},${endY}) duration=${durationSec}s`);
    try {
      const result = await this.sendRequest('swipe', {
        startX,
        startY,
        endX,
        endY,
        duration: durationSec,
      });
      this.maybeCacheState(result);
      log.info(`drag: success`);
      return true;
    } catch (err) {
      log.warn(`drag: failed - ${(err as Error).message}`);
      return false;
    }
  }

  async pressKey(keycode: number): Promise<string> {
    this.ensureConnected();
    log.info(`pressKey: keycode=${keycode}`);
    try {
      const result = await this.sendRequest('keyevent', { keycode });
      this.maybeCacheState(result);
      log.info(`pressKey: success`);
      return `Key ${keycode} pressed successfully`;
    } catch (err) {
      log.warn(`pressKey: failed - ${(err as Error).message}`);
      return `Failed to press key: ${(err as Error).message}`;
    }
  }

  async back(): Promise<string> {
    return this.pressKey(4); // KEYCODE_BACK
  }

  async startApp(packageName: string, activity = ''): Promise<string> {
    this.ensureConnected();
    log.info(`startApp: package=${packageName} activity=${activity || '(default)'}`);
    try {
      const params: Record<string, unknown> = { package: packageName };
      if (activity) params.activity = activity;
      const result = await this.sendRequest('app/start', params);
      this.maybeCacheState(result);
      log.info(`startApp: success`);
      return `Started app: ${packageName}`;
    } catch (err) {
      log.warn(`startApp: failed - ${(err as Error).message}`);
      return `Failed to start app: ${(err as Error).message}`;
    }
  }

  async getApps(
    includeSystem = false,
  ): Promise<Array<{ package: string; label: string }>> {
    this.ensureConnected();
    try {
      const result = (await this.sendRequest('apps', {})) as Record<
        string,
        unknown
      >;
      let apps = (
        Array.isArray(result) ? result : (result.apps as Array<Record<string, unknown>>) ?? []
      ) as Array<Record<string, unknown>>;
      if (!includeSystem) {
        apps = apps.filter((a) => !a.isSystemApp);
      }
      return apps.map((a) => ({
        package: (a.packageName as string) ?? '',
        label: (a.label as string) ?? '',
      }));
    } catch {
      return [];
    }
  }

  async listPackages(includeSystem = false): Promise<string[]> {
    this.ensureConnected();
    try {
      const params = includeSystem ? { includeSystem: true } : {};
      const result = (await this.sendRequest('packages', params)) as Record<
        string,
        unknown
      >;
      const packages = Array.isArray(result)
        ? result
        : ((result.packages as string[]) ?? []);
      return (packages as string[]).sort();
    } catch {
      return [];
    }
  }

  async getDate(): Promise<string> {
    if (this.initialDeviceDate && this.initialServerTime) {
      const elapsedMs = Date.now() - this.initialServerTime;
      try {
        const d = new Date(this.initialDeviceDate);
        d.setTime(d.getTime() + elapsedMs);
        return d.toISOString();
      } catch {
        this.initialDeviceDate = null;
        this.initialServerTime = null;
      }
    }

    this.ensureConnected();
    try {
      const result = (await this.sendRequest('date', {})) as Record<
        string,
        unknown
      >;
      const date =
        typeof result === 'object'
          ? ((result.data as string) ?? 'unknown')
          : String(result);
      if (date !== 'unknown') {
        this.initialDeviceDate = date;
        this.initialServerTime = Date.now();
      }
      return date;
    } catch {
      return 'unknown';
    }
  }

  // ── Semantic Element Operations ──

  async tapElement(by: string, pattern: string): Promise<string> {
    this.ensureConnected();
    log.info(`tapElement: by=${by} pattern="${pattern}"`);
    try {
      const result = await this.sendRequest('find_and_click', { by, pattern });
      this.maybeCacheState(result);
      const msg =
        typeof result === 'object'
          ? ((result as Record<string, unknown>).data as string) ??
            JSON.stringify(result)
          : String(result);
      log.info(`tapElement: success - ${msg}`);
      return `Tapped element matching ${by}='${pattern}': ${msg}`;
    } catch (err) {
      log.warn(`tapElement: failed (${by}='${pattern}') - ${(err as Error).message}`);
      return `Failed to tap element (${by}='${pattern}'): ${(err as Error).message}`;
    }
  }

  async inputTextElement(
    text: string,
    by: string,
    pattern: string,
    clear = false,
  ): Promise<string> {
    this.ensureConnected();
    log.info(`inputTextElement: by=${by} pattern="${pattern}" text="${text.slice(0, 50)}" clear=${clear}`);
    try {
      const base64Text = Buffer.from(text, 'utf-8').toString('base64');
      const result = await this.sendRequest('find_and_input', {
        by,
        pattern,
        base64_text: base64Text,
        clear,
      });
      this.maybeCacheState(result);
      log.info(`inputTextElement: success`);
      return `Typed '${text}' into element matching ${by}='${pattern}'`;
    } catch (err) {
      log.warn(`inputTextElement: failed (${by}='${pattern}') - ${(err as Error).message}`);
      return `Failed to type into element (${by}='${pattern}'): ${(err as Error).message}`;
    }
  }

  async longPressElement(by: string, pattern: string): Promise<string> {
    this.ensureConnected();
    log.info(`longPressElement: by=${by} pattern="${pattern}"`);
    try {
      const result = await this.sendRequest('find_and_long_press', {
        by,
        pattern,
      });
      this.maybeCacheState(result);
      const msg =
        typeof result === 'object'
          ? ((result as Record<string, unknown>).data as string) ??
            JSON.stringify(result)
          : String(result);
      log.info(`longPressElement: success - ${msg}`);
      return `Long pressed element matching ${by}='${pattern}': ${msg}`;
    } catch (err) {
      log.warn(`longPressElement: failed (${by}='${pattern}') - ${(err as Error).message}`);
      return `Failed to long press element (${by}='${pattern}'): ${(err as Error).message}`;
    }
  }

  // ── Memory & Completion ──

  remember(information: string): string {
    if (!information?.trim()) return 'Error: Please provide valid information.';
    this.memory.push(information.trim());
    if (this.memory.length > 10) {
      this.memory = this.memory.slice(-10);
    }
    log.info(`remember: stored "${information.slice(0, 100)}" (total: ${this.memory.length})`);
    return `Remembered: ${information}`;
  }

  getMemory(): string[] {
    return [...this.memory];
  }

  complete(success: boolean, reason = ''): void {
    this.success = success;
    this.reason = reason || (success ? 'Task completed successfully.' : '');
    if (!success && !reason) {
      throw new Error('Reason for failure is required if success is false.');
    }
    this.finished = true;
    log.info(`complete: success=${success} reason="${this.reason}"`);
  }

  // ── Device Commands ──

  getDeviceCommands(): DeviceCommand[] {
    return [...this.deviceCommands];
  }

  clearDeviceCommands(): void {
    this.deviceCommands = [];
  }

  // ── Helpers ──

  private maybeCacheState(result: unknown): void {
    if (
      typeof result === 'object' &&
      result !== null &&
      'a11y_tree' in (result as object) &&
      'phone_state' in (result as object)
    ) {
      this.updateStateCache(result as Record<string, unknown>);
    }
  }
}
