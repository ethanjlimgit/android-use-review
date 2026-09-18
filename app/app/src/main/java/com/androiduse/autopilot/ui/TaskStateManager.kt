package com.androiduse.autopilot.ui

import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Singleton to manage task execution state across the app
 *
 * Coordinates task state between MainActivity, FloatingButtonService, and AiInputFragment
 */
object TaskStateManager {
    private const val TAG = "TaskStateManager"

    // Task execution state
    data class TaskState(
        val isExecuting: Boolean = false,
        val taskId: String? = null,
        val instruction: String? = null
    )

    private val _taskState = MutableStateFlow(TaskState())
    val taskState: StateFlow<TaskState> = _taskState.asStateFlow()

    /**
     * Start task execution
     */
    fun startTask(taskId: String, instruction: String) {
        Log.d(TAG, "Starting task: $taskId - $instruction")
        _taskState.value = TaskState(
            isExecuting = true,
            taskId = taskId,
            instruction = instruction
        )
    }

    /**
     * Stop task execution
     */
    fun stopTask() {
        val taskId = _taskState.value.taskId
        Log.d(TAG, "Stopping task: $taskId")
        _taskState.value = TaskState(
            isExecuting = false,
            taskId = null,
            instruction = null
        )
    }

    /**
     * Check if a task is currently executing
     */
    fun isTaskExecuting(): Boolean {
        return _taskState.value.isExecuting
    }

    /**
     * Get current executing task ID
     */
    fun getCurrentTaskId(): String? {
        return _taskState.value.taskId
    }
}
