package com.androiduse.autopilot.cache

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.androiduse.autopilot.model.Task
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

/**
 * Local cache for recent tasks
 *
 * Caches tasks in SharedPreferences for fast initial display
 * while fetching fresh data from the server.
 */
class TaskCache private constructor(context: Context) {

    companion object {
        private const val TAG = "TaskCache"
        private const val PREFS_NAME = "androiduse_task_cache"
        private const val KEY_TASKS = "cached_tasks"
        private const val KEY_CACHE_TIMESTAMP = "cache_timestamp"
        private const val KEY_NEXT_CURSOR = "next_cursor"
        private const val MAX_CACHED_TASKS = 50
        private const val CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000L // 24 hours

        @Volatile
        private var instance: TaskCache? = null

        fun getInstance(context: Context): TaskCache {
            return instance ?: synchronized(this) {
                instance ?: TaskCache(context.applicationContext).also { instance = it }
            }
        }
    }

    private val sharedPreferences: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val gson = Gson()

    /**
     * Save tasks to local cache
     * @param tasks List of tasks to cache
     * @param nextCursor Cursor for pagination (null if no more pages)
     * @param append If true, append to existing cache; if false, replace
     */
    fun saveTasks(tasks: List<Task>, nextCursor: String?, append: Boolean = false) {
        try {
            val tasksToSave = if (append) {
                val existing = getCachedTasks()
                val combined = existing.toMutableList()
                // Add new tasks, avoiding duplicates
                tasks.forEach { newTask ->
                    if (combined.none { it.id == newTask.id }) {
                        combined.add(newTask)
                    }
                }
                // Limit to max cached tasks
                combined.takeLast(MAX_CACHED_TASKS)
            } else {
                tasks.take(MAX_CACHED_TASKS)
            }

            val json = gson.toJson(tasksToSave)
            sharedPreferences.edit().apply {
                putString(KEY_TASKS, json)
                putLong(KEY_CACHE_TIMESTAMP, System.currentTimeMillis())
                putString(KEY_NEXT_CURSOR, nextCursor)
                apply()
            }
            Log.d(TAG, "Cached ${tasksToSave.size} tasks")
        } catch (e: Exception) {
            Log.e(TAG, "Error saving tasks to cache: ${e.message}", e)
        }
    }

    /**
     * Get cached tasks
     * @return List of cached tasks, or empty list if none cached
     */
    fun getCachedTasks(): List<Task> {
        return try {
            val json = sharedPreferences.getString(KEY_TASKS, null) ?: return emptyList()
            val type = object : TypeToken<List<Task>>() {}.type
            gson.fromJson<List<Task>>(json, type) ?: emptyList()
        } catch (e: Exception) {
            Log.e(TAG, "Error reading tasks from cache: ${e.message}", e)
            emptyList()
        }
    }

    /**
     * Get cached next cursor for pagination
     */
    fun getCachedNextCursor(): String? {
        return sharedPreferences.getString(KEY_NEXT_CURSOR, null)
    }

    /**
     * Check if cache is still valid (not expired)
     */
    fun isCacheValid(): Boolean {
        val timestamp = sharedPreferences.getLong(KEY_CACHE_TIMESTAMP, 0)
        return System.currentTimeMillis() - timestamp < CACHE_EXPIRY_MS
    }

    /**
     * Check if cache has any tasks
     */
    fun hasCachedTasks(): Boolean {
        val json = sharedPreferences.getString(KEY_TASKS, null)
        return !json.isNullOrEmpty() && json != "[]"
    }

    /**
     * Update a specific task in the cache (e.g., when status changes)
     */
    fun updateTask(updatedTask: Task) {
        try {
            val tasks = getCachedTasks().toMutableList()
            val index = tasks.indexOfFirst { it.id == updatedTask.id }
            if (index >= 0) {
                tasks[index] = updatedTask
                val json = gson.toJson(tasks)
                sharedPreferences.edit().putString(KEY_TASKS, json).apply()
                Log.d(TAG, "Updated cached task: ${updatedTask.id}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error updating task in cache: ${e.message}", e)
        }
    }

    /**
     * Remove a task from the cache (e.g., when archived)
     */
    fun removeTask(taskId: String) {
        try {
            val tasks = getCachedTasks().toMutableList()
            val removed = tasks.removeAll { it.id == taskId }
            if (removed) {
                val json = gson.toJson(tasks)
                sharedPreferences.edit().putString(KEY_TASKS, json).apply()
                Log.d(TAG, "Removed task from cache: $taskId")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error removing task from cache: ${e.message}", e)
        }
    }

    /**
     * Add a new task to the cache (e.g., when user submits a new task)
     */
    fun addTask(task: Task) {
        try {
            val tasks = getCachedTasks().toMutableList()
            // Check if task already exists
            if (tasks.none { it.id == task.id }) {
                tasks.add(task)
                // Keep within limit
                val trimmedTasks = tasks.takeLast(MAX_CACHED_TASKS)
                val json = gson.toJson(trimmedTasks)
                sharedPreferences.edit().apply {
                    putString(KEY_TASKS, json)
                    putLong(KEY_CACHE_TIMESTAMP, System.currentTimeMillis())
                    apply()
                }
                Log.d(TAG, "Added task to cache: ${task.id}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error adding task to cache: ${e.message}", e)
        }
    }

    /**
     * Clear all cached tasks
     */
    fun clearCache() {
        sharedPreferences.edit().clear().apply()
        Log.d(TAG, "Task cache cleared")
    }

    /**
     * Get cache age in milliseconds
     */
    fun getCacheAge(): Long {
        val timestamp = sharedPreferences.getLong(KEY_CACHE_TIMESTAMP, 0)
        return if (timestamp > 0) System.currentTimeMillis() - timestamp else Long.MAX_VALUE
    }
}
