package com.androiduse.autopilot.service

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.Animation
import android.view.animation.AnimationUtils
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import com.androiduse.autopilot.R
import com.androiduse.autopilot.ui.MainActivity

/**
 * Manages UI components for the floating button and fullscreen overlay
 */
class FloatingButtonUIController(
    private val context: Context,
    private val windowManager: WindowManager
) {
    companion object {
        private const val TAG = "FloatingButtonUI"
    }

    // Main thread handler for UI updates
    private val mainHandler = Handler(Looper.getMainLooper())

    // Simple floating button
    var floatingButtonView: View? = null
        private set
    var simpleFloatingButton: View? = null
        private set
    var buttonParams: WindowManager.LayoutParams? = null
        private set

    // Fullscreen overlay
    var overlayView: View? = null
        private set
    var overlayParams: WindowManager.LayoutParams? = null
        private set

    // Overlay UI components
    var overlayBackground: View? = null
        private set
    var settingsButton: View? = null
        private set
    var instructionInput: EditText? = null
        private set
    var actionButton: View? = null
        private set
    var micIcon: ImageView? = null
        private set
    var sendIcon: ImageView? = null
        private set
    var statusText: TextView? = null
        private set
    var statusContainer: FrameLayout? = null
        private set
    var partialSpeechText: TextView? = null
        private set
    var bottomInputContainer: LinearLayout? = null
        private set

    // Suggestions UI components
    var suggestionsContainer: LinearLayout? = null
        private set
    var suggestionsCardsContainer: LinearLayout? = null
        private set
    var suggestionsLoadingContainer: FrameLayout? = null
        private set
    var suggestionsLoadingIndicator: ImageView? = null
        private set

    // Button icon (for swapping between logo and stop icon)
    private var buttonIcon: ImageView? = null

    // Connection status indicator
    private var connectionStatusIndicator: View? = null

    // Loading animation
    private var loadingAnimation: Animation? = null

    // Edge glow overlay for task execution
    private var edgeGlowView: View? = null
    private var edgeGlowParams: WindowManager.LayoutParams? = null
    private var isEdgeGlowVisible = false
    private var glowAnimator: AnimatorSet? = null

    private var isOverlayVisible = false
    private var hideStatusRunnable: Runnable? = null

    // Callbacks
    var onOverlayBackgroundClicked: (() -> Unit)? = null
    var onSettingsButtonClicked: (() -> Unit)? = null
    var onMicButtonClicked: (() -> Unit)? = null
    var onSendButtonClicked: ((String) -> Unit)? = null
    var onFloatingButtonClicked: (() -> Unit)? = null
    var onSuggestionClicked: ((String) -> Unit)? = null // Called with the command to execute
    var onSuggestionCopied: ((String) -> Unit)? = null // Called with the command to copy to input

    /**
     * Create and show the floating button
     */
    fun createFloatingButton() {
        try {
            // Create a themed context for Material components
            val themedContext = android.view.ContextThemeWrapper(
                context,
                R.style.Theme_AndroidUse
            )
            val inflater = LayoutInflater.from(themedContext)

            // Create simple floating button
            floatingButtonView = inflater.inflate(R.layout.floating_button_simple, null)
            simpleFloatingButton = floatingButtonView?.findViewById(R.id.simpleFloatingButton)
            buttonIcon = floatingButtonView?.findViewById(R.id.buttonIcon)
            connectionStatusIndicator = floatingButtonView?.findViewById(R.id.statusIndicator)

            // Note: Click listener is handled by FloatingButtonGestureHandler
            // to avoid conflicts with drag detection

            // Create fullscreen overlay
            overlayView = inflater.inflate(R.layout.floating_button_fullscreen, null)

            // Ensure overlay is visible when created
            overlayView?.visibility = View.VISIBLE
            Log.d(TAG, "Overlay view inflated, visibility: ${overlayView?.visibility}")

            // Get references to overlay views
            overlayBackground = overlayView?.findViewById(R.id.overlayBackground)
            settingsButton = overlayView?.findViewById(R.id.settingsButton)
            statusText = overlayView?.findViewById(R.id.statusText)
            statusContainer = overlayView?.findViewById(R.id.statusContainer)
            partialSpeechText = overlayView?.findViewById(R.id.partialSpeechText)
            bottomInputContainer = overlayView?.findViewById(R.id.bottomInputContainer)

            // Get references to suggestions UI
            suggestionsContainer = overlayView?.findViewById(R.id.suggestionsContainer)
            suggestionsCardsContainer = overlayView?.findViewById(R.id.suggestionsCardsContainer)
            suggestionsLoadingContainer = overlayView?.findViewById(R.id.suggestionsLoadingContainer)
            suggestionsLoadingIndicator = overlayView?.findViewById(R.id.suggestionsLoadingIndicator)

            // Initialize loading animation
            loadingAnimation = AnimationUtils.loadAnimation(context, R.anim.rotate_loading)

            // Setup window insets for keyboard handling
            setupWindowInsets()

            // Inflate AI input fragment layout into container
            val aiInputContainer = overlayView?.findViewById<FrameLayout>(R.id.aiInputFragmentContainer)
            if (aiInputContainer != null) {
                val aiInputView = inflater.inflate(R.layout.fragment_ai_input, aiInputContainer, true)
                // Get references to AI input views
                instructionInput = aiInputView.findViewById(R.id.instructionInput)
                actionButton = aiInputView.findViewById(R.id.actionButton)
                micIcon = aiInputView.findViewById(R.id.micIcon)
                sendIcon = aiInputView.findViewById(R.id.sendIcon)
            }

            // Setup button listeners
            overlayBackground?.setOnClickListener {
                onOverlayBackgroundClicked?.invoke()
            }

            settingsButton?.setOnClickListener {
                onSettingsButtonClicked?.invoke()
            }

            // Combined action button - mic when empty, send when text exists
            actionButton?.setOnClickListener {
                val instruction = instructionInput?.text?.toString()?.trim() ?: ""
                if (instruction.isNotEmpty()) {
                    onSendButtonClicked?.invoke(instruction)
                } else {
                    onMicButtonClicked?.invoke()
                }
            }

            // Setup text change listener to toggle between mic/send icon
            instructionInput?.addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}

                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                    updateActionButtonState(s?.isNotEmpty() == true)
                }

                override fun afterTextChanged(s: Editable?) {}
            })

            // Create layout params for the button
            buttonParams = WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                x = 1000
                y = 100
            }

            // Create layout params for the overlay
            // Note: Removed FLAG_NOT_FOCUSABLE so overlay can receive touch events
            // FLAG_NOT_TOUCH_MODAL allows touches outside overlay to pass through
            // FLAG_LAYOUT_NO_LIMITS allows overlay to extend beyond screen bounds (covers status/nav bars)
            overlayParams = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.START
                // Adjust the window when keyboard appears
                softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
            }

            Log.d(TAG, "Overlay params created: ${overlayParams?.width}x${overlayParams?.height}")
            Log.d(TAG, "Overlay view visibility: ${overlayView?.visibility}")

            // Create edge glow overlay for task execution
            // FLAG_LAYOUT_NO_LIMITS allows glow to cover entire screen including status/nav bars
            edgeGlowView = inflater.inflate(R.layout.overlay_edge_glow, null)
            edgeGlowParams = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
            ).apply {
                gravity = Gravity.TOP or Gravity.START
            }

            // Add edge glow first (hidden), so floating button will be on top
            edgeGlowView?.visibility = View.GONE
            windowManager.addView(edgeGlowView, edgeGlowParams)

            // Add floating button to window (on top of edge glow)
            windowManager.addView(floatingButtonView, buttonParams)
            Log.d(TAG, "Floating button created and added to window")
            Log.d(TAG, "Button visibility: ${floatingButtonView?.visibility}")
            Log.d(TAG, "Button position: x=${buttonParams?.x}, y=${buttonParams?.y}")
            Log.d(TAG, "Button size: width=${floatingButtonView?.width}, height=${floatingButtonView?.height}")

        } catch (e: Exception) {
            Log.e(TAG, "Error creating floating button: ${e.message}", e)
            e.printStackTrace()
        }
    }

    /**
     * Setup window insets to handle keyboard (IME) adjustments
     */
    private fun setupWindowInsets() {
        val overlay = overlayView ?: return
        val inputContainer = bottomInputContainer ?: return

        // Base bottom margin (32dp from the original layout)
        val baseMarginBottom = context.resources.getDimensionPixelSize(R.dimen.overlay_input_margin_bottom)

        ViewCompat.setOnApplyWindowInsetsListener(overlay) { view, windowInsets ->
            val systemBars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
            val ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime())

            // Adjust bottom padding based on keyboard visibility
            val bottomPadding = if (ime.bottom > 0) {
                // Keyboard is open - add base margin to keyboard height
                baseMarginBottom + ime.bottom
            } else {
                // Keyboard is closed - add base margin to navigation bar height
                baseMarginBottom + systemBars.bottom
            }

            // Apply padding to the bottom input container
            inputContainer.updatePadding(bottom = bottomPadding)

            Log.d(TAG, "Window insets updated - IME: ${ime.bottom}, SystemBars: ${systemBars.bottom}, BottomPadding: $bottomPadding")

            windowInsets
        }

        // Request to apply window insets
        ViewCompat.requestApplyInsets(overlay)
    }

    /**
     * Show the fullscreen overlay
     * Thread-safe: can be called from any thread
     */
    fun showOverlay() {
        Log.d(TAG, "showOverlay() called")
        mainHandler.post {
            Log.d(TAG, "showOverlay: inside mainHandler.post")
            if (isOverlayVisible) {
                Log.d(TAG, "Overlay already visible, skipping")
                return@post
            }

            try {
                Log.d(TAG, "Attempting to add overlay to window...")
                Log.d(TAG, "overlayView null? ${overlayView == null}")
                Log.d(TAG, "overlayParams null? ${overlayParams == null}")

                // Add overlay to window
                windowManager.addView(overlayView, overlayParams)
                Log.d(TAG, "Overlay added to window successfully")

                // Animate bottom input container sliding up
                bottomInputContainer?.let { container ->
                    val slideUpAnim = AnimationUtils.loadAnimation(context, R.anim.slide_up)
                    container.startAnimation(slideUpAnim)
                }

                // Hide the simple floating button
                floatingButtonView?.visibility = View.GONE
                Log.d(TAG, "Floating button hidden")

                isOverlayVisible = true
                Log.d(TAG, "Overlay shown successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Error showing overlay: ${e.message}", e)
                e.printStackTrace()
            }
        }
    }

    /**
     * Hide the fullscreen overlay
     * Thread-safe: can be called from any thread
     */
    fun hideOverlay() {
        mainHandler.post {
            if (!isOverlayVisible) return@post

            try {
                // Animate bottom input container sliding down
                bottomInputContainer?.let { container ->
                    val slideDownAnim = AnimationUtils.loadAnimation(context, R.anim.slide_down)
                    slideDownAnim.setAnimationListener(object : Animation.AnimationListener {
                        override fun onAnimationStart(animation: Animation?) {}
                        override fun onAnimationRepeat(animation: Animation?) {}
                        override fun onAnimationEnd(animation: Animation?) {
                            mainHandler.post {
                                try {
                                    // Remove overlay from window after animation
                                    overlayView?.let { windowManager.removeView(it) }

                                    // Show the simple floating button again
                                    floatingButtonView?.visibility = View.VISIBLE

                                    // Clear input
                                    instructionInput?.text?.clear()

                                    // Clear suggestions and stop loading animation
                                    suggestionsContainer?.visibility = View.GONE
                                    suggestionsCardsContainer?.removeAllViews()
                                    suggestionsLoadingIndicator?.clearAnimation()

                                    isOverlayVisible = false
                                    Log.d(TAG, "Overlay hidden")
                                } catch (e: Exception) {
                                    Log.e(TAG, "Error hiding overlay after animation: ${e.message}", e)
                                }
                            }
                        }
                    })
                    container.startAnimation(slideDownAnim)
                } ?: run {
                    // Fallback if container is null
                    overlayView?.let { windowManager.removeView(it) }
                    floatingButtonView?.visibility = View.VISIBLE
                    instructionInput?.text?.clear()
                    isOverlayVisible = false
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error hiding overlay: ${e.message}", e)
            }
        }
    }

    /**
     * Check if overlay is currently visible
     */
    fun isOverlayCurrentlyVisible(): Boolean = isOverlayVisible

    /**
     * Set the input text in the instruction input field
     * Thread-safe: can be called from any thread
     *
     * @param text The text to set in the input field
     */
    fun setInputText(text: String) {
        mainHandler.post {
            instructionInput?.setText(text)
            // Move cursor to end of text
            instructionInput?.setSelection(text.length)
            Log.d(TAG, "Input text set: $text")
        }
    }

    /**
     * Update action button to show mic or send icon
     */
    private fun updateActionButtonState(hasText: Boolean) {
        if (hasText) {
            micIcon?.visibility = View.GONE
            sendIcon?.visibility = View.VISIBLE
        } else {
            micIcon?.visibility = View.VISIBLE
            sendIcon?.visibility = View.GONE
        }
    }

    /**
     * Update microphone button visual state (listening or not)
     * Thread-safe: can be called from any thread
     */
    fun updateMicButtonState(listening: Boolean) {
        mainHandler.post {
            val icon = micIcon ?: return@post
            if (listening) {
                // Change to stop icon when listening
                icon.setImageResource(R.drawable.ic_close)
                sendIcon?.visibility = View.GONE
                icon.visibility = View.VISIBLE
            } else {
                // Change back to mic icon when not listening
                icon.setImageResource(R.drawable.ic_mic)
                // Restore based on text state
                val hasText = !instructionInput?.text.isNullOrBlank()
                updateActionButtonState(hasText)
            }
        }
    }

    /**
     * Show status text
     * Thread-safe: can be called from any thread
     */
    fun showStatus(message: String) {
        mainHandler.post {
            statusText?.text = message
            statusContainer?.visibility = View.VISIBLE
        }
    }

    /**
     * Hide status text
     * Thread-safe: can be called from any thread
     */
    fun hideStatus() {
        mainHandler.post {
            statusContainer?.visibility = View.GONE
        }
    }

    /**
     * Show status and auto-hide after delay
     * Thread-safe: can be called from any thread
     */
    fun showStatusWithAutoHide(message: String, delayMs: Long = 5000) {
        mainHandler.post {
            statusText?.text = message
            statusContainer?.visibility = View.VISIBLE

            // Cancel previous hide runnable
            hideStatusRunnable?.let { overlayView?.removeCallbacks(it) }

            // Schedule new hide
            hideStatusRunnable = Runnable {
                statusContainer?.visibility = View.GONE
            }
            overlayView?.postDelayed(hideStatusRunnable!!, delayMs)
        }
    }

    /**
     * Show loading indicator for suggestions with rotation animation
     * Thread-safe: can be called from any thread
     */
    fun showSuggestionsLoading() {
        mainHandler.post {
            Log.d(TAG, "showSuggestionsLoading called - container: ${suggestionsContainer != null}, loadingContainer: ${suggestionsLoadingContainer != null}")
            suggestionsContainer?.visibility = View.VISIBLE
            suggestionsLoadingContainer?.visibility = View.VISIBLE
            suggestionsCardsContainer?.removeAllViews()

            // Start rotation animation
            loadingAnimation?.let { anim ->
                suggestionsLoadingIndicator?.startAnimation(anim)
            }
        }
    }

    /**
     * Hide suggestions container and stop loading animation
     * Thread-safe: can be called from any thread
     */
    fun hideSuggestions() {
        mainHandler.post {
            suggestionsContainer?.visibility = View.GONE
            suggestionsLoadingContainer?.visibility = View.GONE
            suggestionsCardsContainer?.removeAllViews()

            // Stop rotation animation
            suggestionsLoadingIndicator?.clearAnimation()
        }
    }

    /**
     * Update connection status indicator
     * Thread-safe: can be called from any thread
     *
     * @param connected true for green (connected), false for red (disconnected)
     */
    fun updateConnectionStatus(connected: Boolean) {
        mainHandler.post {
            val indicator = connectionStatusIndicator ?: return@post
            val drawableRes = if (connected) {
                R.drawable.status_indicator_active
            } else {
                R.drawable.status_indicator_inactive
            }
            indicator.setBackgroundResource(drawableRes)
            Log.d(TAG, "Connection status updated: ${if (connected) "connected" else "disconnected"}")
        }
    }

    /**
     * Data class for suggestion with title, description, and command
     */
    data class SuggestionData(
        val title: String,
        val description: String,
        val command: String
    )

    /**
     * Display task suggestions as clickable cards with copy button
     * Thread-safe: can be called from any thread
     *
     * @param suggestions List of suggestion data (title, description, command)
     */
    fun showSuggestions(suggestions: List<SuggestionData>) {
        mainHandler.post {
            Log.d(TAG, "showSuggestions called with ${suggestions.size} suggestions")
            suggestionsLoadingContainer?.visibility = View.GONE

            // Stop rotation animation
            suggestionsLoadingIndicator?.clearAnimation()

            if (suggestions.isEmpty()) {
                Log.d(TAG, "Suggestions empty, hiding container")
                suggestionsContainer?.visibility = View.GONE
                return@post
            }

            Log.d(TAG, "Showing ${suggestions.size} suggestions, container: ${suggestionsContainer != null}, cardsContainer: ${suggestionsCardsContainer != null}")
            suggestionsContainer?.visibility = View.VISIBLE
            suggestionsCardsContainer?.removeAllViews()

            // Create a themed context for Material components (MaterialCardView requires MaterialComponents theme)
            val themedContext = android.view.ContextThemeWrapper(
                context,
                R.style.Theme_AndroidUse
            )
            val inflater = LayoutInflater.from(themedContext)

            // Calculate card width as roughly half the screen width minus padding
            val displayMetrics = context.resources.displayMetrics
            val screenWidth = displayMetrics.widthPixels
            val horizontalPadding = (16 * displayMetrics.density).toInt() * 2 // 16dp padding on each side
            val cardMargin = (8 * displayMetrics.density).toInt() // 8dp margin between cards
            val cardWidth = (screenWidth - horizontalPadding - cardMargin) / 2

            for (suggestion in suggestions) {
                val cardView = inflater.inflate(R.layout.item_suggestion_card, suggestionsCardsContainer, false)

                // Set card width to half screen
                cardView.layoutParams = LinearLayout.LayoutParams(cardWidth, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                    marginEnd = cardMargin
                }

                // Set title
                cardView.findViewById<TextView>(R.id.suggestionTitle)?.text = suggestion.title

                // Set description
                cardView.findViewById<TextView>(R.id.suggestionDescription)?.text = suggestion.description

                // Set copy button click listener
                cardView.findViewById<View>(R.id.copyButton)?.setOnClickListener {
                    Log.d(TAG, "Suggestion copy clicked: ${suggestion.title} -> ${suggestion.command}")
                    onSuggestionCopied?.invoke(suggestion.command)
                }

                // Set card click listener (also copies to input)
                cardView.setOnClickListener {
                    Log.d(TAG, "Suggestion card clicked: ${suggestion.title} -> ${suggestion.command}")
                    onSuggestionCopied?.invoke(suggestion.command)
                }

                suggestionsCardsContainer?.addView(cardView)
            }

            Log.d(TAG, "Displayed ${suggestions.size} suggestion cards")
        }
    }

    /**
     * Open main activity
     */
    fun openMainActivity() {
        try {
            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            context.startActivity(intent)
            Log.d(TAG, "Opening MainActivity")
        } catch (e: Exception) {
            Log.e(TAG, "Error opening MainActivity: ${e.message}", e)
        }
    }

    /**
     * Show edge glow animation during task execution
     * Thread-safe: can be called from any thread
     */
    fun showEdgeGlow() {
        mainHandler.post {
            if (isEdgeGlowVisible) {
                Log.d(TAG, "Edge glow already visible, skipping")
                return@post
            }

            try {
                edgeGlowView?.let { view ->
                    Log.d(TAG, "Showing edge glow on view: $view")

                    // Show the edge glow (it's already added to window manager)
                    view.visibility = View.VISIBLE
                    view.alpha = 0.3f  // Start dim

                    // Cancel any existing animator
                    glowAnimator?.cancel()

                    // Create glow animation using ObjectAnimator
                    // Only animate alpha (brightness): dim to bright
                    // No scale animation - keeps glow at constant size
                    val alphaAnimator = ObjectAnimator.ofFloat(view, "alpha", 0.3f, 1.0f).apply {
                        duration = 1200
                        repeatCount = ValueAnimator.INFINITE
                        repeatMode = ValueAnimator.REVERSE
                        interpolator = AccelerateDecelerateInterpolator()
                    }

                    glowAnimator = AnimatorSet().apply {
                        play(alphaAnimator)
                        start()
                    }

                    isEdgeGlowVisible = true

                    // Change button to red stop sign (octagon background + white square icon)
                    buttonIcon?.setImageResource(R.drawable.ic_stop)
                    simpleFloatingButton?.setBackgroundResource(R.drawable.bg_floating_button_stop)
                    Log.d(TAG, "Edge glow shown with alpha animation")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error showing edge glow: ${e.message}", e)
            }
        }
    }

    /**
     * Hide edge glow animation
     * Thread-safe: can be called from any thread
     */
    fun hideEdgeGlow() {
        mainHandler.post {
            if (!isEdgeGlowVisible) {
                Log.d(TAG, "Edge glow already hidden, skipping")
                return@post
            }

            try {
                // Cancel the animator
                glowAnimator?.cancel()
                glowAnimator = null

                edgeGlowView?.let { view ->
                    view.clearAnimation()
                    view.alpha = 1f
                    view.visibility = View.GONE
                    isEdgeGlowVisible = false

                    // Restore button to normal logo
                    buttonIcon?.setImageResource(R.drawable.logo)
                    simpleFloatingButton?.setBackgroundResource(R.drawable.bg_floating_button)
                    Log.d(TAG, "Edge glow hidden")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error hiding edge glow: ${e.message}", e)
            }
        }
    }

    /**
     * Remove all views from window manager
     * Thread-safe: can be called from any thread
     */
    fun destroy() {
        mainHandler.post {
            try {
                floatingButtonView?.let { windowManager.removeView(it) }
                if (isOverlayVisible) {
                    overlayView?.let { windowManager.removeView(it) }
                }
                // Cancel glow animator and remove edge glow view
                glowAnimator?.cancel()
                glowAnimator = null
                edgeGlowView?.clearAnimation()
                edgeGlowView?.let { windowManager.removeView(it) }

                // Remove any pending callbacks
                hideStatusRunnable?.let { overlayView?.removeCallbacks(it) }

                Log.d(TAG, "UI controller destroyed")
            } catch (e: Exception) {
                Log.e(TAG, "Error destroying UI: ${e.message}", e)
            }
        }
    }
}
