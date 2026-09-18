package com.androiduse.autopilot.client

import android.util.Base64
import android.util.Log
import com.androiduse.autopilot.api.ApiResponse
import com.androiduse.autopilot.service.ActionDispatcher
import kotlinx.coroutines.delay
import org.json.JSONArray
import org.json.JSONObject

/**
 * Executes a pre-recorded sequence of actions (replay) on the device
 * without involving the LLM agent. Used for task memory replay.
 */
class MemoryReplayExecutor(private val actionDispatcher: ActionDispatcher) {

    companion object {
        private const val TAG = "MemoryReplayExecutor"
        private const val MAX_RETRIES = 3
        private const val RETRY_DELAY_MS = 1000L
        private const val INTER_ACTION_DELAY_MS = 500L
    }

    data class ReplayResult(
        val success: Boolean,
        val stepsCompleted: Int,
        val failedAtStep: Int?,
        val reason: String
    )

    /**
     * Execute a sequence of replay actions.
     *
     * @param actions JSONArray of action objects, each with:
     *   - method: String (e.g. "find_and_click", "click", "swipe")
     *   - params: Object with action parameters
     *   - type: "semantic" or "coordinate"
     * @return ReplayResult indicating success/failure
     */
    suspend fun execute(actions: JSONArray): ReplayResult {
        Log.d(TAG, "Starting replay execution with ${actions.length()} actions")

        for (i in 0 until actions.length()) {
            val action = actions.optJSONObject(i) ?: continue
            val method = action.optString("method", "")
            val params = action.optJSONObject("params") ?: JSONObject()
            val type = action.optString("type", "coordinate")

            if (method.isEmpty()) {
                Log.w(TAG, "Skipping action $i: empty method")
                continue
            }

            Log.d(TAG, "Executing action $i/${ actions.length()}: $method (type=$type)")

            val success = if (type == "semantic") {
                executeWithRetry(method, params, i)
            } else {
                executeSingle(method, params, i)
            }

            if (!success) {
                val reason = "Action failed at step $i: $method"
                Log.w(TAG, reason)
                return ReplayResult(
                    success = false,
                    stepsCompleted = i,
                    failedAtStep = i,
                    reason = reason
                )
            }

            // Delay between actions to let UI settle
            if (i < actions.length() - 1) {
                delay(INTER_ACTION_DELAY_MS)
            }
        }

        Log.d(TAG, "Replay completed successfully: ${actions.length()} actions")
        return ReplayResult(
            success = true,
            stepsCompleted = actions.length(),
            failedAtStep = null,
            reason = "All actions completed successfully"
        )
    }

    /**
     * Execute a single action with retries (for semantic actions that may
     * need the UI to settle before the element is found).
     */
    private suspend fun executeWithRetry(
        method: String,
        params: JSONObject,
        stepIndex: Int
    ): Boolean {
        for (attempt in 1..MAX_RETRIES) {
            val result = actionDispatcher.dispatch(
                action = method,
                params = params,
                origin = ActionDispatcher.Origin.WEBSOCKET
            )

            when (result) {
                is ApiResponse.Error -> {
                    val isNotFound = result.message.contains("not found", ignoreCase = true) ||
                            result.message.contains("no matching", ignoreCase = true)

                    if (isNotFound && attempt < MAX_RETRIES) {
                        Log.d(TAG, "Step $stepIndex attempt $attempt: element not found, retrying in ${RETRY_DELAY_MS}ms")
                        delay(RETRY_DELAY_MS)
                        continue
                    }

                    Log.e(TAG, "Step $stepIndex failed after $attempt attempts: ${result.message}")
                    return false
                }
                else -> {
                    Log.d(TAG, "Step $stepIndex succeeded on attempt $attempt")
                    return true
                }
            }
        }
        return false
    }

    /**
     * Execute a single coordinate-based action (no retries).
     */
    private fun executeSingle(
        method: String,
        params: JSONObject,
        stepIndex: Int
    ): Boolean {
        val result = actionDispatcher.dispatch(
            action = method,
            params = params,
            origin = ActionDispatcher.Origin.WEBSOCKET
        )

        return when (result) {
            is ApiResponse.Error -> {
                Log.e(TAG, "Step $stepIndex failed: ${result.message}")
                false
            }
            else -> {
                Log.d(TAG, "Step $stepIndex succeeded")
                true
            }
        }
    }
}
