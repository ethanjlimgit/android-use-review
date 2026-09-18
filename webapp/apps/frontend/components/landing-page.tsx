"use client"

import Home from "@/components/pages/home"
import HomeVariantB from "@/components/pages/home-variant-b"
import HomeVariantC from "@/components/pages/home-variant-c"
import HomeHub from "@/components/pages/home-hub"
import { useExperimentTracking, type ExperimentVariant } from "@/hooks/use-experiment"
import { Navigation } from "@/components/navigation"

const EXPERIMENT_KEY = "landing-page-v2"

interface LandingPageProps {
  variant: ExperimentVariant
}

/**
 * Client wrapper for the landing page A/B test
 *
 * Receives the variant from the server and handles client-side conversion tracking.
 */
export function LandingPage({ variant }: LandingPageProps) {
  const { trackCTA } = useExperimentTracking({
    experimentKey: EXPERIMENT_KEY,
    variant,
  })

  const handleCTAClick = (ctaName: string, ctaLocation: string) => {
    trackCTA(ctaName, ctaLocation)
  }

  const renderVariant = () => {
    if (variant === "hub") {
      return <HomeHub onCTAClick={handleCTAClick} />
    }
    if (variant === "variant-c") {
      return <HomeVariantC onCTAClick={handleCTAClick} />
    }
    if (variant === "test") {
      return <HomeVariantB onCTAClick={handleCTAClick} />
    }
    return <Home onCTAClick={handleCTAClick} />
  }

  return (
    <>
      <Navigation />
      {renderVariant()}
    </>
  )
}
