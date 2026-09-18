package com.androiduse.autopilot.service

import com.androiduse.autopilot.api.ApiHandler
import com.androiduse.autopilot.api.ApiResponse
import org.json.JSONArray
import org.json.JSONObject

/**
 * Dispatches actions (tap, swipe, etc.) to the appropriate handler.
 * Provides consistent action handling across different service layers.
 */
class ActionDispatcher(private val apiHandler: ApiHandler) {

    companion object {
        private const val DEFAULT_SWIPE_DURATION_MS = 300
        // Delay after UI-changing actions to let animations finish
        private const val POST_ACTION_DELAY_MS = 500L
    }

    enum class Origin {
        HTTP,
        WEBSOCKET,
    }

    /**
     * Dispatch a command based on the action name and parameters.
     *
     * @param action The action/endpoint name (e.g. "tap", "swipe", "/action/tap")
     * @param params The JSON parameters for the action
     * @return ApiResponse result
     */
    fun dispatch(
        action: String,
        params: JSONObject,
        origin: Origin = Origin.WEBSOCKET
    ): ApiResponse {
        // Normalize action name (handle both "action.tap" and "/action/tap" styles)
        return when (
            val method =
                action.removePrefix("/action/").removePrefix("action.").removePrefix("/")
        ) {
            "tap", "click" -> {
                val x = params.optInt("x", 0)
                val y = params.optInt("y", 0)
                val result = apiHandler.performTap(x, y)
                // Wait for animations to finish before returning
                Thread.sleep(POST_ACTION_DELAY_MS)
                result
            }

            "swipe" -> {
                val startX = params.optInt("startX", 0)
                val startY = params.optInt("startY", 0)
                val endX = params.optInt("endX", 0)
                val endY = params.optInt("endY", 0)
                val duration = params.optInt("duration", DEFAULT_SWIPE_DURATION_MS)
                val result = apiHandler.performSwipe(startX, startY, endX, endY, duration)
                // Wait for animations to finish (swipe duration + settle time)
                Thread.sleep(duration.toLong() + POST_ACTION_DELAY_MS)
                result
            }

            "global" -> {
                val actionId = params.optInt("action", 0)
                val result = apiHandler.performGlobalAction(actionId)
                // Wait for animations to finish (e.g., back navigation, home screen)
                Thread.sleep(POST_ACTION_DELAY_MS)
                result
            }

            "app", "app/start" -> {
                val pkg = params.optString("package", "")
                val activity = params.optString("activity", "")
                // JSON optString returns "" for missing keys
                // Let's be safe: treat empty string or "null" literal as null
                val finalActivity =
                    if (activity.isNullOrEmpty() || activity == "null") null else activity
                val result = apiHandler.startApp(pkg, finalActivity)
                // Wait for app launch animations to finish
                Thread.sleep(POST_ACTION_DELAY_MS)
                result
            }

            "keyboard/input", "input" -> {
                val text = params.optString("base64_text", "")
                val clear = params.optBoolean("clear", true)
                val result = apiHandler.keyboardInput(text, clear)
                // Small delay for keyboard animations and autocomplete
                Thread.sleep(200)
                result
            }

            "keyboard/clear", "clear" -> {
                apiHandler.keyboardClear()
            }

            "keyboard/key", "key", "keyevent" -> {
                val keyCode = params.optInt("keycode", params.optInt("key_code", 0))
                apiHandler.keyboardKey(keyCode)
            }

            "overlay_offset" -> {
                val offset = params.optInt("offset", 0)
                apiHandler.setOverlayOffset(offset)
            }

            "screenshot" -> {
                // Default to hiding overlay unless specified otherwise
                val hideOverlay = params.optBoolean("hideOverlay", true)
                apiHandler.getScreenshot(hideOverlay)
            }

            "packages" -> {
                apiHandler.getPackages()
            }

            "state", "state_full" -> {
                // Always filter for network efficiency (compact tree)
                apiHandler.getStateFull(filter = true)
            }

            "version" -> {
                apiHandler.getVersion()
            }

            "time" -> {
                apiHandler.getTime()
            }

            "date" -> {
                apiHandler.getDate()
            }

            "apps" -> {
                val includeSystem = params.optBoolean("includeSystem", true)
                apiHandler.getApps(includeSystem)
            }

            "install" -> {
                if (origin == Origin.HTTP)
                    return ApiResponse.Error("Install is only supported over WebSocket")

                val hideOverlay = params.optBoolean("hideOverlay", false)

                val urlsArray: JSONArray? = params.optJSONArray("urls")
                if (urlsArray == null || urlsArray.length() == 0)
                    return ApiResponse.Error("Missing required param: 'urls'")

                val urls = mutableListOf<String>()
                for (i in 0 until urlsArray.length()) {
                    val url = urlsArray.optString(i, "").trim()
                    if (url.isNotEmpty()) urls.add(url)
                }

                if (urls.isEmpty())
                    ApiResponse.Error("Missing required param: 'urls'")
                else
                    apiHandler.installFromUrls(urls, hideOverlay)
            }

            "find_and_click" -> {
                val by = params.optString("by", "text")
                val pattern = params.optString("pattern", "")
                if (pattern.isEmpty()) {
                    ApiResponse.Error("Missing required param: 'pattern'")
                } else {
                    val result = apiHandler.findAndClick(by, pattern)
                    Thread.sleep(POST_ACTION_DELAY_MS)
                    result
                }
            }

            "find_and_input" -> {
                val by = params.optString("by", "text")
                val pattern = params.optString("pattern", "")
                val base64Text = params.optString("base64_text", "")
                val clear = params.optBoolean("clear", true)
                if (pattern.isEmpty()) {
                    ApiResponse.Error("Missing required param: 'pattern'")
                } else {
                    val result = apiHandler.findAndInput(by, pattern, base64Text, clear)
                    Thread.sleep(200)
                    result
                }
            }

            "find_and_long_press" -> {
                val by = params.optString("by", "text")
                val pattern = params.optString("pattern", "")
                if (pattern.isEmpty()) {
                    ApiResponse.Error("Missing required param: 'pattern'")
                } else {
                    val result = apiHandler.findAndLongPress(by, pattern)
                    Thread.sleep(POST_ACTION_DELAY_MS)
                    result
                }
            }

            else -> ApiResponse.Error("Unknown method: $method")
        }
    }
}
