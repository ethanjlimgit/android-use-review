import type { Metadata } from "next"
import ProductAndroidUse from "@/components/pages/product-androiduse"

export const metadata: Metadata = {
  title: "AndroidUse — AI-Powered Social Media Automation for Teams",
  description: "Scale TikTok campaigns, automate social media management, and run device farms with real Android devices. Enterprise-grade AI automation for marketing teams.",
  keywords: [
    "TikTok automation",
    "social media automation",
    "Android device farm",
    "digital marketing automation",
    "AI social media manager",
    "TikTok marketing",
    "enterprise automation",
    "AndroidUse",
  ],
  openGraph: {
    title: "AndroidUse — AI-Powered Social Media Automation for Teams",
    description: "Scale TikTok campaigns, automate social media management, and run device farms with real Android devices. Enterprise-grade AI automation for marketing teams.",
    type: "website",
    url: "/products/androiduse",
  },
  twitter: {
    card: "summary_large_image",
    title: "AndroidUse — AI-Powered Social Media Automation for Teams",
    description: "Scale TikTok campaigns, automate social media management, and run device farms with real Android devices.",
  },
}

export default function AndroidUsePage() {
  return <ProductAndroidUse />
}
