package com.androiduse.autopilot.core

/**
 * Thread-safe singleton holder utility for creating lazy-initialized singletons
 * with double-checked locking pattern.
 *
 * Usage example:
 * ```kotlin
 * class MyManager private constructor(context: Context) {
 *     companion object : SingletonHolder<MyManager, Context>(::MyManager)
 * }
 *
 * // Usage:
 * val instance = MyManager.getInstance(context)
 * ```
 *
 * @param P The parameter type required for initialization (e.g., Context)
 * @param T The singleton class type
 * @param creator Function that creates the singleton instance
 */
open class SingletonHolder<out T : Any, in P>(private val creator: (P) -> T) {
    @Volatile
    private var instance: T? = null

    /**
     * Get or create the singleton instance in a thread-safe manner
     * @param param Parameter required for initialization
     * @return The singleton instance
     */
    fun getInstance(param: P): T {
        return instance ?: synchronized(this) {
            instance ?: creator(param).also { instance = it }
        }
    }

    /**
     * Clear the singleton instance (useful for testing)
     * WARNING: Use with caution - this should only be used in tests
     */
    fun clearInstance() {
        synchronized(this) {
            instance = null
        }
    }

    /**
     * Check if instance has been initialized
     */
    fun isInitialized(): Boolean = instance != null
}
