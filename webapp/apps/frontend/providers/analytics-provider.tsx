"use client"

import { createContext, useContext, type ReactNode } from "react"
import posthog from "posthog-js"
import { type AnalyticsClient } from "@droiduse/shared-lib"

const AnalyticsContext = createContext<AnalyticsClient | null>(null)

/**
 * PostHog analytics client wrapper implementing AnalyticsClient interface
 */
const posthogClient: AnalyticsClient = {
  capture: (event: string, properties?: Record<string, any>) => {
    posthog.capture(event, properties)
  },

  identify: (userId: string, properties?: Record<string, any>) => {
    posthog.identify(userId, properties)
  },

  reset: () => {
    posthog.reset()
  },

  setUserProperties: (properties: Record<string, any>) => {
    posthog.setPersonProperties(properties)
  },

  captureException: (error: Error | string, properties?: Record<string, any>) => {
    const errorMessage = error instanceof Error ? error.message : error
    posthog.capture("$exception", {
      $exception_message: errorMessage,
      $exception_type: error instanceof Error ? error.name : "Error",
      $exception_stack: error instanceof Error ? error.stack : undefined,
      ...properties,
    })
  },
}

interface AnalyticsProviderProps {
  children: ReactNode
}

/**
 * Analytics provider component
 *
 * Provides analytics client to all child components via React Context.
 * This eliminates the need to import PostHog directly in every component.
 */
export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  return (
    <AnalyticsContext.Provider value={posthogClient}>
      {children}
    </AnalyticsContext.Provider>
  )
}

/**
 * Hook to access analytics client
 *
 * @throws Error if used outside of AnalyticsProvider
 * @returns AnalyticsClient instance
 *
 * @example
 * ```tsx
 * const analytics = useAnalytics()
 * analytics.capture("button_clicked", { button_id: "submit" })
 * ```
 */
export function useAnalytics(): AnalyticsClient {
  const analytics = useContext(AnalyticsContext)
  if (!analytics) {
    throw new Error("useAnalytics must be used within AnalyticsProvider")
  }
  return analytics
}
