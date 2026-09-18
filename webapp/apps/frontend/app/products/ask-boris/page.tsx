import type { Metadata } from "next"
import ProductBoris from "@/components/pages/product-boris"

export const metadata: Metadata = {
  title: "Ask Boris — Drive Safe. Date More. Do Less.",
  description: "Automate rideshare apps, dating profiles, and daily phone tasks. Boris handles the repetitive work so you can focus on living.",
  keywords: [
    "dating automation",
    "rideshare automation",
    "phone automation",
    "AI assistant",
    "Ask Boris",
    "Android automation",
    "daily task automation",
  ],
  openGraph: {
    title: "Ask Boris — Drive Safe. Date More. Do Less.",
    description: "Automate rideshare apps, dating profiles, and daily phone tasks. Boris handles the repetitive work so you can focus on living.",
    type: "website",
    url: "/products/ask-boris",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ask Boris — Drive Safe. Date More. Do Less.",
    description: "Automate rideshare apps, dating profiles, and daily phone tasks. Boris handles the repetitive work so you can focus on living.",
  },
}

export default function AskBorisPage() {
  return <ProductBoris />
}
