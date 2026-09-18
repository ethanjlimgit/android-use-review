/**
 * FCM (Firebase Cloud Messaging) Service
 *
 * Handles sending push notifications to Android devices for task execution.
 * This implementation assumes FCM is running on non-Google infrastructure.
 */

import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app'
import { getMessaging } from 'firebase-admin/messaging'

// Initialize Firebase Admin SDK
function initializeFirebaseAdmin() {
  if (getApps().length === 0) {
    // Load service account from environment variable
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON

    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set')
    }

    let serviceAccount: ServiceAccount
    try {
      serviceAccount = JSON.parse(serviceAccountJson)
    } catch (error) {
      throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON')
    }

    initializeApp({
      credential: cert(serviceAccount),
    })
  }

  return getMessaging()
}

/**
 * Task notification payload sent to device via FCM
 */
export interface TaskNotificationPayload {
  taskId: string
  goal: string
  maxSteps?: number
  timeoutSec?: number
  isReasoning?: boolean
}

/**
 * Task status update payload sent from device to server
 */
export interface TaskStatusUpdate {
  taskId: string
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMED_OUT'
  currentStep?: number
  totalSteps?: number
  error?: string
}

/**
 * Send a task execution notification to a device via FCM
 *
 * Message structure matches Android AndroidUseFCMService:
 * {
 *   "data": {
 *     "type": "agentic_task",
 *     "task_id": "unique-task-identifier",
 *     "command": "The task command to execute",
 *     "priority": "high",
 *     "parameters": "{...}"
 *   }
 * }
 *
 * @param fcmToken - The device's FCM registration token
 * @param payload - Task details to execute
 * @returns Promise resolving to FCM message ID
 * @throws Error if FCM send fails
 */
export async function sendTaskNotification(
  fcmToken: string,
  payload: TaskNotificationPayload
): Promise<string> {
  const messaging = initializeFirebaseAdmin()

  try {
    // Build parameters JSON string
    const parameters = JSON.stringify({
      maxSteps: payload.maxSteps,
      timeoutSec: payload.timeoutSec,
      isReasoning: payload.isReasoning,
    })

    const messageId = await messaging.send({
      token: fcmToken,
      data: {
        type: 'agentic_task',
        task_id: payload.taskId,
        command: payload.goal,
        priority: 'high',
        parameters: parameters,
      },
      // Android-specific options
      android: {
        priority: 'high',
        ttl: 3600000, // 1 hour in milliseconds
      },
    })

    return messageId
  } catch (error) {
    console.error('FCM send error:', error)
    throw new Error(`Failed to send FCM notification: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Send a task cancellation notification to a device via FCM
 *
 * @param fcmToken - The device's FCM registration token
 * @param taskId - ID of the task to cancel
 * @returns Promise resolving to FCM message ID
 */
export async function sendTaskCancellation(
  fcmToken: string,
  taskId: string
): Promise<string> {
  const messaging = initializeFirebaseAdmin()

  try {
    const messageId = await messaging.send({
      token: fcmToken,
      data: {
        type: 'cancel_task',
        task_id: taskId,
      },
      android: {
        priority: 'high',
      },
    })

    return messageId
  } catch (error) {
    console.error('FCM send error:', error)
    throw new Error(`Failed to send task cancellation: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Send a health check message to a device via FCM
 *
 * @param fcmToken - The device's FCM registration token
 * @returns Promise resolving to FCM message ID
 */
export async function sendHealthCheck(
  fcmToken: string
): Promise<string> {
  const messaging = initializeFirebaseAdmin()

  try {
    const messageId = await messaging.send({
      token: fcmToken,
      data: {
        type: 'health_check',
      },
      android: {
        priority: 'normal',
      },
    })

    return messageId
  } catch (error) {
    console.error('FCM send error:', error)
    throw new Error(`Failed to send health check: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Send a configuration update to a device via FCM
 *
 * @param fcmToken - The device's FCM registration token
 * @param config - Configuration data as JSON string
 * @returns Promise resolving to FCM message ID
 */
export async function sendConfigUpdate(
  fcmToken: string,
  config: Record<string, any>
): Promise<string> {
  const messaging = initializeFirebaseAdmin()

  try {
    const messageId = await messaging.send({
      token: fcmToken,
      data: {
        type: 'config_update',
        config: JSON.stringify(config),
      },
      android: {
        priority: 'normal',
      },
    })

    return messageId
  } catch (error) {
    console.error('FCM send error:', error)
    throw new Error(`Failed to send config update: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Verify that an FCM token is valid
 *
 * @param fcmToken - The FCM token to verify
 * @returns Promise resolving to true if valid, false otherwise
 */
export async function verifyFcmToken(fcmToken: string): Promise<boolean> {
  const messaging = initializeFirebaseAdmin()

  try {
    // Send a test message (dry run)
    await messaging.send(
      {
        token: fcmToken,
        data: { type: 'health_check' },
      },
      true // dryRun = true
    )
    return true
  } catch (error) {
    return false
  }
}
