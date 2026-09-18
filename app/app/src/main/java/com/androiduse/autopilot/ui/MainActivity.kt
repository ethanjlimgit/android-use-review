package com.androiduse.autopilot.ui

import android.content.ComponentName
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.provider.Settings
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import com.androiduse.autopilot.cache.TaskCache
import com.androiduse.autopilot.config.ConfigManager
import com.androiduse.autopilot.adapter.TaskConversationAdapter
import com.androiduse.autopilot.auth.api.RetrofitClient
import com.androiduse.autopilot.paywall.StripePaymentActivity
import com.androiduse.autopilot.paywall.TaskLimitManager
import com.androiduse.autopilot.paywall.ReviewManager
import com.androiduse.autopilot.profile.ProfileActivity
import com.androiduse.autopilot.api.ApiHandler
import com.androiduse.autopilot.core.StateRepository
import com.androiduse.autopilot.input.AndroidUseKeyboardIME
import com.androiduse.autopilot.service.AndroidUseAccessibilityService
import com.androiduse.autopilot.service.BackendServiceInitializer
import com.androiduse.autopilot.service.BackendWebSocketService
import com.androiduse.autopilot.service.FloatingButtonService
import com.androiduse.autopilot.R
import com.androiduse.autopilot.databinding.ActivityMainBinding
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/**
 * Main Activity - Home screen with task submission
 *
 * Features:
 * - Text input with send button
 * - Voice input with microphone button
 * - Suggested action cards
 * - Credit limit enforcement (600 credits for free tier)
 * - Profile navigation
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var aiInputFragment: AiInputFragment? = null

    // Task history
    private var taskHistoryAdapter: TaskConversationAdapter? = null
    private var isInHistoryMode = false
    private var nextCursor: String? = null
    private var isLoadingMoreTasks = false
    private var hasMoreTasks = true
    private val allTasks = mutableListOf<com.androiduse.autopilot.model.Task>()

    // Task cache
    private lateinit var taskCache: TaskCache

    // Backend service
    private var backendWsServiceConnection: ServiceConnection? = null
    private var boundBackendService: BackendWebSocketService? = null

    // Coroutine scope for background tasks
    private val serviceScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    companion object {
        private const val TAG = "MainActivity"
        private const val TASK_HISTORY_PAGE_SIZE = 10
        private const val STATE_IS_HISTORY_MODE = "is_history_mode"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Enable edge-to-edge display
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // Initialize View Binding
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Initialize task cache
        taskCache = TaskCache.getInstance(this)

        // Ensure BackendWebSocketService is started (like FloatingButtonService does)
        BackendServiceInitializer.ensureServiceStarted(this)

        // Setup components
        setupWindowInsets()
        setupHeader()
        setupSuggestedActions()
        setupTaskHistory()
        setupAiInputFragment()
        observeTaskState()
        observeConnectionStatus()

        // Initialize backend
        initializeBackendWebSocket()

        // Restore previous mode if coming back from saved state
        if (savedInstanceState != null) {
            val wasInHistoryMode = savedInstanceState.getBoolean(STATE_IS_HISTORY_MODE, false)
            if (wasInHistoryMode) {
                enterHistoryMode()
            }
        }

        Log.d(TAG, "MainActivity created")
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean(STATE_IS_HISTORY_MODE, isInHistoryMode)
    }

    override fun onResume() {
        super.onResume()

        // Ensure backend connection is active
        BackendServiceInitializer.ensureConnected()

        // Start floating button if overlay permission is granted
        // (regardless of accessibility permission - permission is checked when submitting tasks)
        startFloatingButtonIfNeeded()

        // Preload apps cache in background
        preloadAppsCache()

        // Sync credit usage from server (non-blocking)
        serviceScope.launch {
            try {
                val taskLimitManager = TaskLimitManager.Companion.getInstance(this@MainActivity)
                taskLimitManager.syncFromServer()
                Log.d(TAG, "Credit usage synced: ${taskLimitManager.creditsUsed}/${taskLimitManager.creditAllowance}")
            } catch (e: Exception) {
                Log.e(TAG, "Error syncing credit usage: ${e.message}", e)
            }
        }
    }

    /**
     * Start floating button service if overlay permission is granted
     * and user hasn't dismissed the floating button
     */
    private fun startFloatingButtonIfNeeded() {
        try {
            // Check if overlay permission is granted
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (!Settings.canDrawOverlays(this)) {
                    Log.d(TAG, "Overlay permission not granted, skipping floating button start")
                    return
                }
            }

            // Check if user previously dismissed the floating button
            val configManager = ConfigManager.getInstance(this)
            if (configManager.floatingButtonDismissed) {
                Log.d(TAG, "Floating button was dismissed by user, not starting")
                return
            }

            // Check if service is already running
            if (FloatingButtonService.getInstance() != null) {
                Log.d(TAG, "Floating button service already running")
                return
            }

            // Start FloatingButtonService
            val intent = Intent(this, FloatingButtonService::class.java)
            startService(intent)
            Log.d(TAG, "Floating button service started from MainActivity")
        } catch (e: Exception) {
            Log.e(TAG, "Error starting floating button service: ${e.message}", e)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        // Forward to AI input fragment for microphone permission
        if (requestCode == 1003) { // REQUEST_CODE_AUDIO_PERMISSION from AiInputFragment
            val granted = grantResults.isNotEmpty() &&
                         grantResults[0] == android.content.pm.PackageManager.PERMISSION_GRANTED
            aiInputFragment?.handlePermissionResult(granted)
        }
    }

    override fun onDestroy() {
        super.onDestroy()

        // Unbind service
        backendWsServiceConnection?.let {
            try {
                unbindService(it)
            } catch (e: Exception) {
                Log.e(TAG, "Error unbinding service: ${e.message}", e)
            }
        }

        Log.d(TAG, "MainActivity destroyed")
    }

    // ==================== Setup Methods ====================

    /**
     * Configure window insets for edge-to-edge display
     */
    private fun setupWindowInsets() {
        // Get the base margin from resources
        val baseMarginBottom = resources.getDimensionPixelSize(R.dimen.input_bar_margin_bottom)

        ViewCompat.setOnApplyWindowInsetsListener(binding.root) { view, windowInsets ->
            val systemBars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
            val ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime())

            // Apply top padding for status bar
            binding.headerContainer.updatePadding(top = systemBars.top)

            // Move the entire bottom input container up when keyboard is shown
            // Combine base margin with keyboard/navigation bar inset
            val bottomPadding = if (ime.bottom > 0) {
                // Keyboard is open - add base margin to keyboard height
                // This positions input bar above keyboard with proper spacing
                baseMarginBottom + ime.bottom
            } else {
                // Keyboard is closed - add base margin to navigation bar height
                baseMarginBottom + systemBars.bottom
            }

            // Apply padding to the bottom input container
            // This moves the entire input bar (including AI input fragment) above the keyboard
            binding.bottomInputContainer.updatePadding(bottom = bottomPadding)

            windowInsets
        }
    }

    /**
     * Setup header section click handlers
     */
    private fun setupHeader() {
        binding.settingsButton.setOnClickListener {
            openSettings()
        }

        binding.profileButton.setOnClickListener {
            openProfile()
        }

        binding.logoImage.setOnClickListener {
            Toast.makeText(this, "PhoneGPT", Toast.LENGTH_SHORT).show()
        }

        binding.backButton.setOnClickListener {
            exitHistoryMode()
        }
    }

    /**
     * Setup suggested action cards
     */
    private fun setupSuggestedActions() {
        binding.cardDoordash.setOnClickListener {
            aiInputFragment?.setInputText("Add a burger to my doordash cart and checkout")
        }

        binding.cardSilentMode.setOnClickListener {
            aiInputFragment?.setInputText("Put my phone on silent for two hours")
        }

        binding.cardUber.setOnClickListener {
            aiInputFragment?.setInputText("Book me an uber to 160 Broadway, San Francisco")
        }

        binding.cardWallpaper.setOnClickListener {
            aiInputFragment?.setInputTextAndSubmit("Open the Messages app. Locate the most recent conversation at the top of the list and open it. Type exactly the following text and send it to that contact: \"i didn't even type this. boris just sent it on autopilot. it's like a way better Siri that actually controls your apps. check it out: https://androiduse.com/\"")
        }
    }

    /**
     * Setup task history view
     */
    private fun setupTaskHistory() {
        // View history button
        binding.viewHistoryButton.setOnClickListener {
            enterHistoryMode()
        }

        // Setup task history recycler with stackFromEnd to start at bottom
        taskHistoryAdapter = TaskConversationAdapter(
            onTaskClicked = { task ->
                // Copy task goal to input
                aiInputFragment?.setInputText(task.goal)
            },
            onTaskLongClicked = { task ->
                showTaskOptionsPopup(task)
            }
        )
        val linearLayoutManager = LinearLayoutManager(this@MainActivity)
        linearLayoutManager.stackFromEnd = true
        binding.taskHistoryRecycler.apply {
            layoutManager = linearLayoutManager
            adapter = taskHistoryAdapter
        }

        // Setup pull-to-load-more
        binding.historySwipeRefresh.setOnRefreshListener {
            if (!isLoadingMoreTasks && hasMoreTasks) {
                loadMoreTasks()
            } else {
                binding.historySwipeRefresh.isRefreshing = false
            }
        }
        // Set swipe refresh colors
        binding.historySwipeRefresh.setColorSchemeResources(R.color.androiduse_primary)
        binding.historySwipeRefresh.setProgressBackgroundColorSchemeResource(R.color.background_card)
    }

    /**
     * Show popup menu with task options (archive, share)
     */
    private fun showTaskOptionsPopup(task: com.androiduse.autopilot.model.Task) {
        val options = arrayOf("Archive Task", "Share with Friend")
        android.app.AlertDialog.Builder(this)
            .setTitle("Task Options")
            .setItems(options) { _, which ->
                when (which) {
                    0 -> archiveTask(task)
                    1 -> shareTask(task)
                }
            }
            .show()
    }

    /**
     * Archive a task by calling the backend API
     */
    private fun archiveTask(task: com.androiduse.autopilot.model.Task) {
        serviceScope.launch {
            try {
                val archiveRequest = com.androiduse.autopilot.auth.api.ArchiveTaskRequest(
                    archivedAt = java.time.Instant.now().toString()
                )
                val response = RetrofitClient.api.archiveTask(task.id, archiveRequest)
                runOnUiThread {
                    if (response.isSuccessful) {
                        // Remove task from local list and update adapter
                        allTasks.removeAll { it.id == task.id }
                        val sortedTasks = allTasks.sortedBy { it.createdAt }
                        taskHistoryAdapter?.submitList(sortedTasks.toList())

                        // Remove from cache
                        taskCache.removeTask(task.id)

                        Toast.makeText(this@MainActivity, "Task archived", Toast.LENGTH_SHORT).show()
                        Log.d(TAG, "Task archived: ${task.id}")
                    } else {
                        Toast.makeText(this@MainActivity, "Failed to archive task", Toast.LENGTH_SHORT).show()
                        Log.w(TAG, "Failed to archive task: ${response.code()}")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error archiving task: ${e.message}", e)
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Error archiving task", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    /**
     * Share a task with a friend
     */
    private fun shareTask(task: com.androiduse.autopilot.model.Task) {
        val shareText = "Check out this task I ran with AndroidUse:\n\n\"${task.goal}\"\n\nStatus: ${task.status}"
        val shareIntent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(android.content.Intent.EXTRA_TEXT, shareText)
        }
        startActivity(android.content.Intent.createChooser(shareIntent, "Share Task"))
    }

    /**
     * Setup AI Input Fragment callbacks
     */
    private fun setupAiInputFragment() {
        aiInputFragment = supportFragmentManager.findFragmentById(R.id.aiInputFragmentContainer) as? AiInputFragment

        // Set callbacks
        aiInputFragment?.onTaskSubmitted = { taskId ->
            Log.d(TAG, "Task submitted from fragment: $taskId")

            // Close MainActivity after task submission
            closeMainActivity()
        }

        aiInputFragment?.onPaywallRequired = {
            showPaywall()
        }

        aiInputFragment?.onPartialSpeechResult = { text ->
            binding.partialSpeechText.text = text
            binding.partialSpeechText.visibility = View.VISIBLE
        }

        aiInputFragment?.onSpeechStarted = {
            binding.partialSpeechText.visibility = View.VISIBLE
        }

        aiInputFragment?.onSpeechEnded = {
            binding.partialSpeechText.visibility = View.GONE
        }
    }

    /**
     * Observe task execution state and trigger floating button animation
     */
    private fun observeTaskState() {
        lifecycleScope.launch {
            TaskStateManager.taskState.collectLatest { state ->
                if (state.isExecuting) {
                    // Task started - trigger floating button animation
                    triggerFloatingButtonAnimation()
                } else {
                    // Task stopped - stop animation and check for review
                    stopFloatingButtonAnimation()

                    // Check if user should be prompted for app review
                    checkAndRequestReview()
                }
            }
        }
    }

    /**
     * Observe backend connection status and update UI indicator
     */
    private fun observeConnectionStatus() {
        lifecycleScope.launch {
            while (true) {
                try {
                    val backendService = BackendWebSocketService.getInstance()
                    val isConnected = backendService?.getConnectionStatus() == "Connected"
                    updateConnectionStatusIndicator(isConnected)
                } catch (e: Exception) {
                    Log.e(TAG, "Error checking connection status: ${e.message}")
                    updateConnectionStatusIndicator(false)
                }
                // Check every 2 seconds
                kotlinx.coroutines.delay(2000)
            }
        }
    }

    /**
     * Update the connection status indicator in the header
     */
    private fun updateConnectionStatusIndicator(connected: Boolean) {
        val drawableRes = if (connected) {
            R.drawable.status_indicator_active
        } else {
            R.drawable.status_indicator_inactive
        }
        binding.connectionStatusIndicator.setBackgroundResource(drawableRes)
    }

    /**
     * Check if user should be prompted for app review
     * Shows in-app review prompt if user has used 300+ credits and hasn't been asked before
     */
    private fun checkAndRequestReview() {
        lifecycleScope.launch {
            try {
                // Sync credit usage from server first
                val taskLimitManager = TaskLimitManager.getInstance(this@MainActivity)
                taskLimitManager.syncFromServer()

                // Check if review should be requested
                val reviewManager = ReviewManager.getInstance(this@MainActivity)
                if (reviewManager.shouldCheckForReview()) {
                    val requested = reviewManager.checkAndRequestReview(this@MainActivity)
                    if (requested) {
                        Log.d(TAG, "In-app review flow initiated")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error checking for review: ${e.message}", e)
            }
        }
    }

    /**
     * Trigger zoom in/out animation on floating button service
     */
    private fun triggerFloatingButtonAnimation() {
        val floatingService = FloatingButtonService.Companion.getInstance()
        floatingService?.startExecutionAnimation()
        Log.d(TAG, "Triggered floating button animation")
    }

    /**
     * Stop floating button animation
     */
    private fun stopFloatingButtonAnimation() {
        val floatingService = FloatingButtonService.Companion.getInstance()
        floatingService?.stopExecutionAnimation()
        Log.d(TAG, "Stopped floating button animation")
    }

    // ==================== Task History Mode ====================

    /**
     * Enter task history mode - shows full task list
     */
    private fun enterHistoryMode() {
        isInHistoryMode = true

        // Update header
        binding.backButton.visibility = View.VISIBLE
        binding.logoImage.visibility = View.GONE
        binding.headerTitle.text = getString(R.string.task_history_title)

        // Hide home content
        binding.mainTitle.visibility = View.GONE
        binding.suggestedActionsContainer.visibility = View.GONE
        binding.viewHistoryButton.visibility = View.GONE

        // Show history container
        binding.taskHistoryContainer.visibility = View.VISIBLE

        // Load full task history
        loadTaskHistory()

        Log.d(TAG, "Entered task history mode")
    }

    /**
     * Exit task history mode - returns to home view
     */
    private fun exitHistoryMode() {
        isInHistoryMode = false

        // Restore header
        binding.backButton.visibility = View.GONE
        binding.logoImage.visibility = View.VISIBLE
        binding.headerTitle.text = getString(R.string.header_title)

        // Show home content
        binding.mainTitle.visibility = View.VISIBLE
        binding.suggestedActionsContainer.visibility = View.VISIBLE
        binding.viewHistoryButton.visibility = View.VISIBLE

        // Hide history container
        binding.taskHistoryContainer.visibility = View.GONE

        Log.d(TAG, "Exited task history mode")
    }

    /**
     * Load initial task history (first page)
     * Loads from cache immediately for fast display, then fetches from network
     */
    private fun loadTaskHistory() {
        // Reset pagination state
        nextCursor = null
        hasMoreTasks = true
        allTasks.clear()

        // Load from cache immediately for instant display
        val cachedTasks = taskCache.getCachedTasks()
        if (cachedTasks.isNotEmpty()) {
            allTasks.addAll(cachedTasks)
            nextCursor = taskCache.getCachedNextCursor()
            hasMoreTasks = nextCursor != null

            val sortedTasks = allTasks.sortedBy { it.createdAt }
            binding.historyEmptyState.visibility = View.GONE
            binding.taskHistoryRecycler.visibility = View.VISIBLE
            taskHistoryAdapter?.submitList(sortedTasks.toList()) {
                binding.taskHistoryRecycler.scrollToPosition(sortedTasks.size - 1)
            }
            Log.d(TAG, "Loaded ${sortedTasks.size} tasks from cache")
        }

        // Fetch fresh data from network
        serviceScope.launch {
            try {
                // Show loading only if cache was empty
                runOnUiThread {
                    if (cachedTasks.isEmpty()) {
                        binding.historyLoadingProgress.visibility = View.VISIBLE
                        binding.historyEmptyState.visibility = View.GONE
                    }
                }

                val response = RetrofitClient.api.getTasks(limit = TASK_HISTORY_PAGE_SIZE, cursor = null)

                runOnUiThread {
                    binding.historyLoadingProgress.visibility = View.GONE

                    if (response.isSuccessful && response.body() != null) {
                        val pageResponse = response.body()!!
                        val tasks = pageResponse.tasks
                        nextCursor = pageResponse.nextCursor

                        // Save to cache
                        taskCache.saveTasks(tasks, nextCursor, append = false)

                        if (tasks.isEmpty()) {
                            binding.historyEmptyState.visibility = View.VISIBLE
                            binding.taskHistoryRecycler.visibility = View.GONE
                            hasMoreTasks = false
                        } else {
                            binding.historyEmptyState.visibility = View.GONE
                            binding.taskHistoryRecycler.visibility = View.VISIBLE

                            // Replace all tasks with fresh data
                            allTasks.clear()
                            allTasks.addAll(tasks)
                            hasMoreTasks = nextCursor != null

                            // Sort by createdAt ascending (oldest first for conversation flow)
                            val sortedTasks = allTasks.sortedBy { it.createdAt }
                            taskHistoryAdapter?.submitList(sortedTasks.toList()) {
                                // Scroll to bottom after list is updated
                                binding.taskHistoryRecycler.scrollToPosition(sortedTasks.size - 1)
                            }
                            Log.d(TAG, "Loaded ${sortedTasks.size} tasks from network")
                        }
                    } else {
                        Log.w(TAG, "Failed to load task history: ${response.code()}")
                        // Only show empty state if cache was also empty
                        if (cachedTasks.isEmpty()) {
                            binding.historyEmptyState.visibility = View.VISIBLE
                            binding.taskHistoryRecycler.visibility = View.GONE
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading task history: ${e.message}", e)
                runOnUiThread {
                    binding.historyLoadingProgress.visibility = View.GONE
                    // Only show empty state if cache was also empty
                    if (cachedTasks.isEmpty()) {
                        binding.historyEmptyState.visibility = View.VISIBLE
                        binding.taskHistoryRecycler.visibility = View.GONE
                    }
                }
            }
        }
    }

    /**
     * Load more tasks (pagination)
     */
    private fun loadMoreTasks() {
        if (isLoadingMoreTasks || !hasMoreTasks) return
        isLoadingMoreTasks = true

        serviceScope.launch {
            try {
                val response = RetrofitClient.api.getTasks(limit = TASK_HISTORY_PAGE_SIZE, cursor = nextCursor)

                runOnUiThread {
                    isLoadingMoreTasks = false
                    binding.historySwipeRefresh.isRefreshing = false

                    if (response.isSuccessful && response.body() != null) {
                        val pageResponse = response.body()!!
                        val tasks = pageResponse.tasks
                        nextCursor = pageResponse.nextCursor

                        if (tasks.isEmpty()) {
                            hasMoreTasks = false
                        } else {
                            allTasks.addAll(tasks)
                            hasMoreTasks = nextCursor != null

                            // Save to cache (append mode)
                            taskCache.saveTasks(tasks, nextCursor, append = true)

                            // Sort by createdAt ascending (oldest first for conversation flow)
                            val sortedTasks = allTasks.sortedBy { it.createdAt }
                            taskHistoryAdapter?.submitList(sortedTasks.toList())
                            Log.d(TAG, "Loaded ${tasks.size} more tasks, total: ${allTasks.size}")
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading more tasks: ${e.message}", e)
                runOnUiThread {
                    isLoadingMoreTasks = false
                    binding.historySwipeRefresh.isRefreshing = false
                }
            }
        }
    }

    /**
     * Handle back button press
     */
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (isInHistoryMode) {
            exitHistoryMode()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    /**
     * Preload apps cache in background
     * This ensures the cache is ready when backend requests app list
     */
    private fun preloadAppsCache() {
        serviceScope.launch {
            try {
                Log.d(TAG, "Preloading apps cache...")
                val accessibilityService = AndroidUseAccessibilityService.getInstance()
                if (accessibilityService == null) {
                    Log.w(TAG, "AndroidUseAccessibilityService not available, skipping cache preload")
                    return@launch
                }

                val stateRepo = StateRepository(accessibilityService)
                val apiHandler = ApiHandler(
                    stateRepo = stateRepo,
                    getKeyboardIME = { AndroidUseKeyboardIME.getInstance() },
                    getPackageManager = { packageManager },
                    appVersionProvider = {
                        try {
                            packageManager.getPackageInfo(packageName, 0).versionName ?: "unknown"
                        } catch (e: Exception) {
                            "unknown"
                        }
                    },
                    context = this@MainActivity
                )
                apiHandler.preloadAppsCache()
                Log.d(TAG, "Apps cache preload initiated")
            } catch (e: Exception) {
                Log.e(TAG, "Error preloading apps cache: ${e.message}", e)
            }
        }
    }

    /**
     * Initialize and bind to backend WebSocket service
     */
    private fun initializeBackendWebSocket() {
        val connection = BackendServiceInitializer.createServiceConnection(
            onConnected = { service ->
                boundBackendService = service
                Log.d(TAG, "Bound to BackendWebSocketService")
            },
            onDisconnected = {
                boundBackendService = null
                Log.d(TAG, "Unbound from BackendWebSocketService")
            }
        )

        backendWsServiceConnection = connection
        BackendServiceInitializer.bindService(this, connection)
    }

    // ==================== Action Handlers ====================

    /**
     * Open profile activity
     */
    private fun openProfile() {
        try {
            val intent = Intent(this, ProfileActivity::class.java)
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error opening profile: ${e.message}", e)
            Toast.makeText(this, "Error opening profile", Toast.LENGTH_SHORT).show()
        }
    }

    private fun openSettings() {
        try {
            val intent = Intent(this, SettingsActivity::class.java)
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error opening settings: ${e.message}", e)
            Toast.makeText(this, "Error opening settings", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Show paywall activity
     */
    private fun showPaywall() {
        try {
            val intent = Intent(this, StripePaymentActivity::class.java)
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Error opening paywall: ${e.message}", e)
            Toast.makeText(this, "Error opening paywall", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Close MainActivity after task submission
     */
    private fun closeMainActivity() {
        Log.d(TAG, "Closing MainActivity after task submission")

        // Use a small delay to allow the task submission toast to be displayed
        lifecycleScope.launch {
            delay(500) // 500ms delay to show the "Task submitted" toast
            finish()
        }
    }
}
