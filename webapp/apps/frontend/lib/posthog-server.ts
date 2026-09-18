import { PostHog } from "posthog-node"
import { cookies } from "next/headers"

const POSTHOG_DISTINCT_ID_COOKIE = "ph_distinct_id"

let posthogClient: PostHog | null = null

export function getPostHogClient() {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    })
  }
  return posthogClient
}

export async function shutdownPostHog() {
  if (posthogClient) {
    await posthogClient.shutdown()
  }
}

/**
 * Get or create a distinct ID for the current user from cookies
 */
export async function getDistinctId(): Promise<string> {
  const cookieStore = await cookies()
  let distinctId = cookieStore.get(POSTHOG_DISTINCT_ID_COOKIE)?.value

  if (!distinctId) {
    distinctId = crypto.randomUUID()
  }

  return distinctId
}

export type ExperimentVariant = "control" | "test" | "variant-c" | "hub"

interface GetExperimentResult {
  variant: ExperimentVariant
  distinctId: string
}

/**
 * Server-side experiment evaluation using PostHog feature flags
 *
 * @param experimentKey - The PostHog feature flag key
 * @returns The assigned variant and distinct ID
 *
 * @example
 * ```tsx
 * // In a Server Component
 * const { variant, distinctId } = await getExperiment("landing-page-v2")
 * ```
 */
export async function getExperiment(experimentKey: string): Promise<GetExperimentResult> {
  const posthog = getPostHogClient()
  const distinctId = await getDistinctId()

  try {
    const flagValue = await posthog.getFeatureFlag(experimentKey, distinctId)
    let variant: ExperimentVariant = "control"

    if (flagValue === "test") {
      variant = "test"
    } else if (flagValue === "variant-c") {
      variant = "variant-c"
    }

    // Capture experiment exposure server-side
    posthog.capture({
      distinctId,
      event: "$experiment_started",
      properties: {
        $experiment_key: experimentKey,
        $experiment_variant: variant,
      },
    })

    return { variant, distinctId }
  } catch (error) {
    console.error("Failed to get experiment:", error)
    return { variant: "control", distinctId }
  }
}
