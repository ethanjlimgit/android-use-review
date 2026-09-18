package com.androiduse.autopilot.service

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Log

/**
 * Utility for initializing and managing BackendWebSocketService
 * Centralizes service startup logic used across multiple components
 */
object BackendServiceInitializer {
    private const val TAG = "BackendServiceInit"

    /**
     * Ensure BackendWebSocketService is started
     * Checks if service is already running before attempting to start
     *
     * @param context Context to start the service
     * @return true if service was started or already running, false on error
     */
    fun ensureServiceStarted(context: Context): Boolean {
        return try {
            if (BackendWebSocketService.getInstance() == null) {
                val intent = Intent(context, BackendWebSocketService::class.java)
                context.startService(intent)
                Log.d(TAG, "BackendWebSocketService started from ${context.javaClass.simpleName}")
                true
            } else {
                Log.d(TAG, "BackendWebSocketService already running")
                true
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error starting BackendWebSocketService: ${e.message}", e)
            false
        }
    }

    /**
     * Ensure backend connection is active
     * Triggers reconnection if service is running but disconnected
     *
     * @return true if connection check completed successfully
     */
    fun ensureConnected(): Boolean {
        return try {
            val backendService = BackendWebSocketService.getInstance()
            if (backendService != null) {
                backendService.ensureConnected()
                Log.d(TAG, "Backend connection check completed")
                true
            } else {
                Log.w(TAG, "BackendWebSocketService not available for connection check")
                false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking backend connection: ${e.message}", e)
            false
        }
    }

    /**
     * Create a ServiceConnection for binding to BackendWebSocketService
     * Useful for activities that need to bind to the service
     *
     * @param onConnected Callback when service is connected, receives BackendWebSocketService instance
     * @param onDisconnected Callback when service is disconnected
     * @return ServiceConnection instance
     */
    fun createServiceConnection(
        onConnected: (BackendWebSocketService) -> Unit = {},
        onDisconnected: () -> Unit = {}
    ): ServiceConnection {
        return object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
                val binder = service as? BackendWebSocketService.LocalBinder
                val backendService = binder?.getService()
                if (backendService != null) {
                    onConnected(backendService)
                    Log.d(TAG, "Bound to BackendWebSocketService")
                }
            }

            override fun onServiceDisconnected(name: ComponentName?) {
                onDisconnected()
                Log.d(TAG, "Unbound from BackendWebSocketService")
            }
        }
    }

    /**
     * Bind to BackendWebSocketService
     *
     * @param context Context to bind from
     * @param connection ServiceConnection created via createServiceConnection()
     * @return true if binding was successful
     */
    fun bindService(context: Context, connection: ServiceConnection): Boolean {
        return try {
            val intent = Intent(context, BackendWebSocketService::class.java)
            context.bindService(intent, connection, Context.BIND_AUTO_CREATE)
        } catch (e: Exception) {
            Log.e(TAG, "Error binding to BackendWebSocketService: ${e.message}", e)
            false
        }
    }
}
