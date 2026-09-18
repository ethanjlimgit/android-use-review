"use client"

import { useCallback } from "react"
import posthog from "posthog-js"
import type { ExperimentVariant } from "@/lib/posthog-server"

export type { ExperimentVariant }

interface UseExperimentTrackingOptions {
  experimentKey: string
  variant: ExperimentVariant
}

interface UseExperimentTrackingReturn {
  trackConversion: (conversionType: string, properties?: Record<string, any>) => void
  trackCTA: (ctaName: string, ctaLocation: string) => void
}

/**
 * Hook for tracking conversions in a server-side rendered experiment
 *
 * Use this in client components that receive the variant from a server component.
 *
 * @example
 * ```tsx
 * // Client component receiving variant from server
 * function LandingPage({ variant }: { variant: ExperimentVariant }) {
 *   const { trackCTA } = useExperimentTracking({
 *     experimentKey: "landing-page-v2",
 *     variant,
 *   })
 *
 *   return <Button onClick={() => trackCTA("signup", "hero")}>Sign Up</Button>
 * }
 * ```
 */
export function useExperimentTracking({
  experimentKey,
  variant,
}: UseExperimentTrackingOptions): UseExperimentTrackingReturn {
  const trackConversion = useCallback(
    (conversionType: string, properties?: Record<string, any>) => {
      posthog.capture("experiment_conversion", {
        experiment_key: experimentKey,
        experiment_variant: variant,
        conversion_type: conversionType,
        ...properties,
      })
    },
    [experimentKey, variant]
  )

  const trackCTA = useCallback(
    (ctaName: string, ctaLocation: string) => {
      posthog.capture("cta_clicked", {
        experiment_key: experimentKey,
        experiment_variant: variant,
        cta_name: ctaName,
        cta_location: ctaLocation,
      })
    },
    [experimentKey, variant]
  )

  return {
    trackConversion,
    trackCTA,
  }
}
