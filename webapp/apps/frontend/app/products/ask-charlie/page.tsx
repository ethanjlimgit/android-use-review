import type { Metadata } from "next"
import ProductCharlie from "@/components/pages/product-charlie"

export const metadata: Metadata = {
  title: "Ask Charlie — Elderly Phone Assistance",
  description: "Simple voice commands to navigate any app. Charlie makes smartphones accessible for seniors — no tech skills needed.",
  keywords: [
    "elderly phone assistance",
    "senior smartphone help",
    "voice commands",
    "accessibility",
    "Ask Charlie",
    "phone automation for seniors",
    "elderly tech support",
  ],
  openGraph: {
    title: "Ask Charlie — Elderly Phone Assistance",
    description: "Simple voice commands to navigate any app. Charlie makes smartphones accessible for seniors — no tech skills needed.",
    type: "website",
    url: "/products/ask-charlie",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ask Charlie — Elderly Phone Assistance",
    description: "Simple voice commands to navigate any app. Charlie makes smartphones accessible for seniors — no tech skills needed.",
  },
}

export default function AskCharliePage() {
  return <ProductCharlie />
}
