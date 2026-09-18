package com.androiduse.autopilot.service

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.util.Log
import android.view.View
import android.view.animation.AccelerateDecelerateInterpolator
import android.widget.Toast
import androidx.core.app.NotificationCompat
import com.androiduse.autopilot.R
import com.androiduse.autopilot.auth.api.RetrofitClient
import com.androiduse.autopilot.client.BackendWebSocketClient
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.paywall.TaskLimitManager
import com.androiduse.autopilot.ui.TaskStateManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * Handles task submission and execution state
 */
class FloatingButtonTaskExecutor(
    private val context: Context,
    private val scope: CoroutineScope
) {
    companion object {
        private const val TAG = "FloatingButtonTaskExec"
        private const val NOTIFICATION_CHANNEL_ID = "task_results"
        private const val NOTIFICATION_ID = 1002
    }

    // Execution state
    private var isExecuting = false
    private var executingTaskId: String? = null
    private var pendingTaskId: String? = null

    // Animation
    private var executionAnimator: AnimatorSet? = null

    // Callbacks
    var onExecutionStarted: (() -> Unit)? = null
    var onExecutionEnded: (() -> Unit)? = null
    var onTaskLimitReached: (() -> Unit)? = null

    init {
        createNotificationChannel()
    }

    /**
     * Submit a task to the backend
     */
    fun submitTask(
        instruction: String,
        onSuccess: (String) -> Unit = {},
        onError: (String) -> Unit = {}
    ) {
        scope.launch {
            try {
                // Check task limit
                val taskLimitManager = TaskLimitManager.getInstance(context)
                if (taskLimitManager.hasReachedLimit()) {
                    Log.w(TAG, "Task limit reached")
                    onTaskLimitReached?.invoke()
                    return@launch
                }

                // Submit to backend
                val backendService = BackendWebSocketService.getInstance()
                if (backendService == null) {
                    Log.e(TAG, "BackendWebSocketService not available")
                    onError("Backend service not available")
                    return@launch
                }

                // Check if real-time voice command is enabled
                val configManager = ConfigManager.getInstance(context)
                val voiceCommandEnabled = configManager.realtimeVoiceCommandEnabled

                val taskId = backendService.submitTask(instruction, voiceCommandEnabled)
                if (taskId == null) {
                    Log.e(TAG, "Failed to get task ID from backend")
                    onError("Failed to submit task")
                    return@launch
                }

                if (voiceCommandEnabled) {
                    Log.d(TAG, "Task submitted with real-time voice enabled")
                }

                Log.d(TAG, "Task submitted with ID: $taskId")

                // Note: Credit usage is tracked server-side automatically
                // No need to increment locally - it will be synced from backend

                // Update global task state
                TaskStateManager.startTask(taskId, instruction)

                pendingTaskId = taskId
                onSuccess(taskId)

            } catch (e: Exception) {
                Log.e(TAG, "Error submitting task: ${e.message}", e)
                onError("Failed to submit task: ${e.message}")
            }
        }
    }

    /**
     * Handle task result from backend
     */
    fun handleTaskResult(result: BackendWebSocketClient.TaskResult) {
        // Update global task state
        TaskStateManager.stopTask()

        // Show notification
        showTaskResultNotification(result)

        Log.d(TAG, "Task ${result.taskId} completed: ${result.success}")
    }

    /**
     * Start execution animation - scales button down and pulses subtly
     */
    fun startExecutionAnimation(view: View?) {
        if (view == null) {
            Log.e(TAG, "startExecutionAnimation - view is null!")
            return
        }
        if (isExecuting) {
            Log.d(TAG, "startExecutionAnimation - already executing, skipping")
            return
        }

        isExecuting = true
        Log.d(TAG, "startExecutionAnimation - starting animation on view: $view")

        // Cancel any existing animation
        executionAnimator?.cancel()
        view.clearAnimation()

        // Reset to original size before starting animation
        view.scaleX = 1.0f
        view.scaleY = 1.0f

        // Create shrink animation: from 1.0 to 0.7
        val scaleXAnimator = ObjectAnimator.ofFloat(view, "scaleX", 1.0f, 0.95f).apply {
            duration = 300
        }
        val scaleYAnimator = ObjectAnimator.ofFloat(view, "scaleY", 1.0f, 0.95f).apply {
            duration = 300
        }

        // Pulse animation after shrinking: between 0.7 and 0.6
        val pulseScaleX = ObjectAnimator.ofFloat(view, "scaleX", 0.95f, 0.8f).apply {
            duration = 500
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
            interpolator = AccelerateDecelerateInterpolator()
        }
        val pulseScaleY = ObjectAnimator.ofFloat(view, "scaleY", 0.95f, 0.8f).apply {
            duration = 500
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
            interpolator = AccelerateDecelerateInterpolator()
        }

        // First shrink from original size, then pulse while small
        val shrinkSet = AnimatorSet().apply {
            playTogether(scaleXAnimator, scaleYAnimator)
        }
        val pulseSet = AnimatorSet().apply {
            playTogether(pulseScaleX, pulseScaleY)
        }

        executionAnimator = AnimatorSet().apply {
            playSequentially(shrinkSet, pulseSet)
            start()
        }

        onExecutionStarted?.invoke()
        Log.d(TAG, "Execution animation started - button shrinking from 1.0 to 0.7, then pulsing")
    }

    /**
     * Stop execution animation - restores button to original size
     */
    fun stopExecutionAnimation(view: View?) {
        Log.d(TAG, "stopExecutionAnimation called - isExecuting: $isExecuting, view: $view")

        // Cancel any running animator
        executionAnimator?.cancel()
        executionAnimator = null

        // Reset scale to original size
        view?.scaleX = 1.0f
        view?.scaleY = 1.0f
        view?.clearAnimation()

        if (!isExecuting) {
            Log.d(TAG, "stopExecutionAnimation - was already stopped")
            return
        }

        isExecuting = false
        onExecutionEnded?.invoke()
        Log.d(TAG, "Execution animation stopped - button restored to normal size")
    }

    /**
     * Check if currently executing
     */
    fun isCurrentlyExecuting(): Boolean = isExecuting

    /**
     * Get current executing task ID
     */
    fun getExecutingTaskId(): String? = executingTaskId

    /**
     * Stop execution - clears all execution state
     */
    fun stopExecution() {
        Log.d(TAG, "Stopping execution - isExecuting: $isExecuting, executingTaskId: $executingTaskId, pendingTaskId: $pendingTaskId")

        // Reset local state regardless of current state
        isExecuting = false
        executingTaskId = null
        pendingTaskId = null

        onExecutionEnded?.invoke()
        Log.d(TAG, "Execution stopped and state cleared")
    }

    /**
     * Show task result notification
     */
    private fun showTaskResultNotification(result: BackendWebSocketClient.TaskResult) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val title = if (result.success) "Task Completed" else "Task Failed"
        val message = result.reason

        val notification = NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(NOTIFICATION_ID, notification)
        Log.d(TAG, "Task result notification shown")
    }

    /**
     * Create notification channel for task results
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Task Results"
            val descriptionText = "Notifications for task completion"
            val importance = NotificationManager.IMPORTANCE_DEFAULT
            val channel = NotificationChannel(NOTIFICATION_CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }

            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
            Log.d(TAG, "Notification channel created")
        }
    }

    /**
     * Get pending task ID
     */
    fun getPendingTaskId(): String? = pendingTaskId

    /**
     * Clear pending task ID
     */
    fun clearPendingTaskId() {
        pendingTaskId = null
    }
}
