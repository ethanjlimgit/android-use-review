/**
 * Plugin Manager - Fire-and-forget event dispatch system.
 * Ported from Python: plugins/manager.py + plugins/base.py
 *
 * Plugins never block the main agent workflow.
 * Events are dispatched asynchronously and failures are logged but not propagated.
 */

import { EventEmitter } from 'eventemitter3';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('plugin-manager');

// ── Event Types ──

export enum PluginEventType {
  TASK_START = 'task_start',
  TASK_STEP = 'task_step',
  TASK_END = 'task_end',
  TRAJECTORY_STEP = 'trajectory_step',
  SCREENSHOT_CAPTURED = 'screenshot_captured',
  AGENT_INIT = 'agent_init',
  AGENT_FINALIZE = 'agent_finalize',
  PACKAGE_VISIT = 'package_visit',
}

export interface TaskStartEvent {
  taskId: string;
  command: string;
  userId: string | null;
  deviceId: string | null;
}

export interface TaskStepEvent {
  taskId: string;
  stepNumber: number;
  event: unknown; // ADK Event
}

export interface TaskEndEvent {
  taskId: string;
  success: boolean;
  reason: string;
  stepCount: number;
}

export interface ScreenshotEvent {
  taskId: string;
  stepNumber: number;
  screenshot: Buffer;
}

// ── Plugin Base ──

export interface Plugin {
  name: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

// ── Plugin Manager ──

class PluginManager {
  private emitter = new EventEmitter();
  private plugins: Plugin[] = [];

  /**
   * Register a plugin.
   */
  async register(plugin: Plugin): Promise<void> {
    try {
      await plugin.initialize();
      this.plugins.push(plugin);
      log.info(`Plugin registered: ${plugin.name}`);
    } catch (err) {
      log.error(
        `Failed to initialize plugin ${plugin.name}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Subscribe to a plugin event.
   */
  on(event: PluginEventType, handler: (...args: unknown[]) => void): void {
    this.emitter.on(event, handler);
  }

  /**
   * Emit an event to all subscribers (fire-and-forget).
   */
  private emit(event: PluginEventType, data: unknown): void {
    try {
      this.emitter.emit(event, data);
    } catch (err) {
      log.error(
        `Plugin event error (${event}): ${(err as Error).message}`,
      );
    }
  }

  // ── Typed Event Emitters ──

  emitTaskStart(data: TaskStartEvent): void {
    this.emit(PluginEventType.TASK_START, data);
  }

  emitTaskStep(data: TaskStepEvent): void {
    this.emit(PluginEventType.TASK_STEP, data);
  }

  emitTaskEnd(data: TaskEndEvent): void {
    this.emit(PluginEventType.TASK_END, data);
  }

  emitScreenshot(data: ScreenshotEvent): void {
    this.emit(PluginEventType.SCREENSHOT_CAPTURED, data);
  }

  /**
   * Shut down all plugins.
   */
  async shutdown(): Promise<void> {
    for (const plugin of this.plugins) {
      try {
        await plugin.shutdown();
        log.info(`Plugin shut down: ${plugin.name}`);
      } catch (err) {
        log.error(
          `Failed to shut down plugin ${plugin.name}: ${(err as Error).message}`,
        );
      }
    }
    this.emitter.removeAllListeners();
    this.plugins = [];
  }
}

// ── Singleton ──

let instance: PluginManager | null = null;

export function getPluginManager(): PluginManager {
  if (!instance) {
    instance = new PluginManager();
  }
  return instance;
}

export function resetPluginManager(): void {
  instance = null;
}
