/**
 * Local Logging Plugin - Records task and step data to database.
 *
 * Uses Prisma directly via @droiduse/shared-lib/server (shared singleton).
 * This replaces the Python backend's HTTP API calls to Next.js.
 */

import { prisma } from '../prisma.js';
import { createChildLogger } from '../logger.js';
import {
  PluginEventType,
  getPluginManager,
  type Plugin,
  type TaskStartEvent,
  type TaskStepEvent,
  type TaskEndEvent,
} from './manager.js';

const log = createChildLogger('local-logging');

export class LocalLoggingPlugin implements Plugin {
  name = 'local-logging';

  /** Maps taskId → deviceId (DB PK) for use in recordTaskEnd */
  private taskDeviceMap = new Map<string, string>();

  async initialize(): Promise<void> {
    // Verify Prisma connectivity
    try {
      await prisma.$connect();
      log.info('Local logging plugin initialized (Prisma connected)');
    } catch (err) {
      log.warn(
        `Prisma connection failed, DB logging disabled: ${(err as Error).message}`,
      );
    }

    const mgr = getPluginManager();

    mgr.on(PluginEventType.TASK_START, (data) => {
      const event = data as TaskStartEvent;
      log.info(
        `Task started: ${event.taskId} - "${event.command.slice(0, 80)}"`,
      );
      this.recordTaskStart(event).catch((err) =>
        log.error(`Failed to record task start: ${(err as Error).message}`),
      );
    });

    mgr.on(PluginEventType.TASK_STEP, (data) => {
      const event = data as TaskStepEvent;
      this.recordTaskStep(event).catch((err) =>
        log.error(`Failed to record task step: ${(err as Error).message}`),
      );
    });

    mgr.on(PluginEventType.TASK_END, (data) => {
      const event = data as TaskEndEvent;
      log.info(
        `Task ended: ${event.taskId} - success=${event.success}, steps=${event.stepCount}`,
      );
      this.recordTaskEnd(event).catch((err) =>
        log.error(`Failed to record task end: ${(err as Error).message}`),
      );
    });
  }

  async shutdown(): Promise<void> {
    log.info('Local logging plugin shut down');
  }

  private async recordTaskStart(event: TaskStartEvent): Promise<void> {
    // Store deviceId mapping for use in recordTaskEnd
    if (event.deviceId) {
      this.taskDeviceMap.set(event.taskId, event.deviceId);
    }

    if (!event.deviceId) {
      log.warn(`Task ${event.taskId}: no deviceId available, skipping DB record`);
      return;
    }

    await prisma.task.upsert({
      where: { id: event.taskId },
      update: { status: 'RUNNING' },
      create: {
        id: event.taskId,
        goal: event.command,
        status: 'RUNNING',
        userId: event.userId,
        deviceId: event.deviceId,
      },
    });
  }

  private async recordTaskStep(event: TaskStepEvent): Promise<void> {
    // Extract text content from the ADK event
    const adkEvent = event.event as {
      content?: { parts?: Array<{ text?: string }> };
      author?: string;
    } | null;

    const text = adkEvent?.content?.parts
      ?.map((p) => p.text)
      .filter(Boolean)
      .join('') ?? '';

    const agentType = adkEvent?.author ?? 'unknown';

    await prisma.taskStep.create({
      data: {
        taskId: event.taskId,
        stepNumber: event.stepNumber,
        agentType,
        status: 'SUCCESS',
        summary: text.slice(0, 500) || null,
        fullResponse: text || null,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  private async recordTaskEnd(event: TaskEndEvent): Promise<void> {
    const status = event.success ? 'COMPLETED' : 'FAILED';
    const deviceId = this.taskDeviceMap.get(event.taskId) ?? null;

    // Clean up the mapping
    this.taskDeviceMap.delete(event.taskId);

    if (!deviceId) {
      log.warn(`Task ${event.taskId}: no deviceId available, skipping DB record`);
      return;
    }

    await prisma.task.upsert({
      where: { id: event.taskId },
      update: {
        status,
        totalSteps: event.stepCount,
        response: event.success ? event.reason : null,
        error: event.success ? null : event.reason,
        completedAt: new Date(),
      },
      create: {
        id: event.taskId,
        goal: '',
        status,
        totalSteps: event.stepCount,
        response: event.success ? event.reason : null,
        error: event.success ? null : event.reason,
        completedAt: new Date(),
        deviceId,
      },
    });
  }
}
