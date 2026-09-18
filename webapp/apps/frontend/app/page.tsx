import { headers } from "next/headers"
import { LandingPage } from "@/components/landing-page"
import ProductCharlie from "@/components/pages/product-charlie"

export default async function Page() {
  const headersList = await headers()
  const host = headersList.get("host") || ""

  // Domain-based routing: getcharlie.ai → Ask Charlie product page
  if (host.includes("getcharlie.ai")) {
    return <ProductCharlie />
  }

  // Default: original variant-c landing page with video hero
  return <LandingPage variant="variant-c" />
}
