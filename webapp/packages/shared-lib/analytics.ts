/**
 * Analytics abstraction layer
 *
 * This module provides a framework-agnostic interface for analytics tracking.
 * Currently implemented with PostHog, but can be swapped or extended.
 */

export interface AnalyticsClient {
  /**
   * Track a custom event
   * @param event - Event name
   * @param properties - Optional event properties
   */
  capture(event: string, properties?: Record<string, any>): void

  /**
   * Identify a user
   * @param userId - Unique user identifier
   * @param properties - Optional user properties
   */
  identify(userId: string, properties?: Record<string, any>): void

  /**
   * Reset user identity (e.g., on logout)
   */
  reset(): void

  /**
   * Set user properties
   * @param properties - User properties to set
   */
  setUserProperties(properties: Record<string, any>): void

  /**
   * Capture an exception
   * @param error - Error object or string
   * @param properties - Optional additional properties
   */
  captureException(error: Error | string, properties?: Record<string, any>): void
}

/**
 * No-op analytics client for server-side rendering or when analytics is disabled
 */
export class NoOpAnalyticsClient implements AnalyticsClient {
  capture(_event: string, _properties?: Record<string, any>): void {
    // No-op
  }

  identify(_userId: string, _properties?: Record<string, any>): void {
    // No-op
  }

  reset(): void {
    // No-op
  }

  setUserProperties(_properties: Record<string, any>): void {
    // No-op
  }

  captureException(_error: Error | string, _properties?: Record<string, any>): void {
    // No-op
  }
}

/**
 * Singleton no-op client instance
 */
export const noOpAnalytics = new NoOpAnalyticsClient()
