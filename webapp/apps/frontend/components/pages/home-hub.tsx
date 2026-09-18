"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@droiduse/shared-ui/button"
import { Badge } from "@droiduse/shared-ui/badge"
import {
  ArrowRight,
  Car,
  Heart,
  TrendingUp,
  Smartphone,
  Bot,
  Shield,
  Download,
  Users,
  Zap,
  Globe,
} from "lucide-react"
import { useSettings } from "@/providers/settings-provider"
import { PRODUCT_TAGLINES } from "@/lib/products"

interface HomeHubProps {
  onCTAClick: (ctaName: string, ctaLocation: string) => void
}

const products = [
  {
    href: "/products/ask-boris",
    title: "Ask Boris",
    tagline: PRODUCT_TAGLINES.askBoris,
    description: "Automate rideshare apps, dating profiles, and daily phone tasks. Boris handles the repetitive work so you can focus on living.",
    icon: Car,
    color: "text-emerald-400",
    gradient: "from-emerald-500/20 to-emerald-500/5",
    border: "border-emerald-500/20 hover:border-emerald-500/40",
    cta: "Explore Ask Boris",
  },
  {
    href: "/products/ask-charlie",
    title: "Ask Charlie",
    tagline: PRODUCT_TAGLINES.askCharlie,
    description: "Simple voice commands to navigate any app. Charlie makes smartphones accessible for seniors. No tech skills needed.",
    icon: Heart,
    color: "text-purple-400",
    gradient: "from-purple-500/20 to-purple-500/5",
    border: "border-purple-500/20 hover:border-purple-500/40",
    cta: "Explore Ask Charlie",
  },
  {
    href: "/products/androiduse",
    title: "AndroidUse",
    tagline: PRODUCT_TAGLINES.androidUse,
    description: "Scale TikTok campaigns, automate social media management, and run device farms. Enterprise-grade Android automation for teams.",
    icon: TrendingUp,
    color: "text-blue-400",
    gradient: "from-blue-500/20 to-blue-500/5",
    border: "border-blue-500/20 hover:border-blue-500/40",
    cta: "Explore AndroidUse",
  },
]

const stats = [
  { value: "5.3M+", label: "Video views", icon: Globe },
  { value: "10K+", label: "Beta users", icon: Users },
  { value: "50+", label: "Apps supported", icon: Smartphone },
  { value: "99.2%", label: "Task success rate", icon: Zap },
]

const pillars = [
  {
    icon: Bot,
    title: "AI-Powered",
    description: "Visual AI that understands any app's interface. No special integrations needed.",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Your data stays on your device. Industry-standard encryption, zero data selling.",
  },
  {
    icon: Smartphone,
    title: "Works Everywhere",
    description: "Compatible with any Android app. If you can tap it, we can automate it.",
  },
]

export default function HomeHub({ onCTAClick }: HomeHubProps) {
  const { getSetting } = useSettings()
  const playstoreUrl = getSetting("url.playstore.closed.beta")

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-24 pb-20 px-6 overflow-hidden lg:min-h-[85vh] lg:flex lg:items-center lg:pt-0">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-primary/15 via-transparent to-transparent blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl w-full text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-6 gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              AndroidUse: AI-Powered Phone Automation
            </Badge>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            PhoneGPT,{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              The Better Siri.
            </span>
          </motion.h1>

          <motion.p
            className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            AndroidUse is one platform with three products, built for consumers, seniors,
            and businesses. AI that sees your screen and does the work for you.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Link
              href="/auth/signup"
              onClick={() => onCTAClick("hub_get_started", "hero")}
            >
              <Button className="gap-2 text-base px-6 py-5 rounded-full font-semibold shadow-lg">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#products">
              <Button variant="outline" className="gap-2 text-base px-6 py-5 rounded-full">
                Explore Products
                <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-6 border-t border-border bg-muted/30">
        <div className="mx-auto max-w-4xl w-full">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <stat.icon className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-2xl md:text-3xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Showcase */}
      <section id="products" className="py-20 lg:py-28 px-6 scroll-mt-16">
        <div className="mx-auto max-w-5xl w-full">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              Built for Everyone
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Whether you're a busy professional, helping a loved one, or scaling a business,
              there's a product designed for you.
            </p>
          </motion.div>

          <div className="grid gap-6 md:gap-8">
            {products.map((product, i) => (
              <motion.div
                key={product.href}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
              >
                <Link href={product.href} className="block group">
                  <div className={`relative rounded-2xl border ${product.border} bg-gradient-to-br ${product.gradient} p-6 md:p-8 transition-all group-hover:shadow-lg`}>
                    <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-background/50 border border-white/10">
                        <product.icon className={`h-7 w-7 ${product.color}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl md:text-2xl font-bold">{product.title}</h3>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full bg-background/50 ${product.color}`}>
                            {product.tagline}
                          </span>
                        </div>
                        <p className="text-muted-foreground">{product.description}</p>
                      </div>
                      <div className="flex items-center gap-1 text-sm font-medium group-hover:gap-2 transition-all shrink-0">
                        {product.cta}
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Pillars */}
      <section className="py-20 lg:py-28 px-6 border-t border-border bg-muted/20">
        <div className="mx-auto max-w-4xl w-full">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              The AndroidUse Engine
            </h2>
            <p className="text-lg text-muted-foreground">
              Every product is built on the same powerful AndroidUse automation engine.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {pillars.map((pillar, i) => (
              <motion.div
                key={pillar.title}
                className="rounded-xl glass-panel p-6 text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-primary/10 mb-4">
                  <pillar.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">{pillar.title}</h3>
                <p className="text-sm text-muted-foreground">{pillar.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 lg:py-28 px-6 bg-primary">
        <div className="mx-auto max-w-2xl text-center w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-primary-foreground mb-4">
              Ready to automate?
            </h2>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-md mx-auto">
              Join the beta today. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={playstoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onCTAClick("hub_download_bottom", "bottom_cta")}
              >
                <Button variant="secondary" className="gap-2 text-base px-8 py-6 rounded-full font-semibold shadow-lg">
                  <Download className="h-5 w-5" />
                  Download on Google Play
                </Button>
              </a>
              <Link
                href="/auth/signup"
                onClick={() => onCTAClick("hub_signup_bottom", "bottom_cta")}
              >
                <Button
                  variant="outline"
                  className="gap-2 text-base px-8 py-6 rounded-full font-semibold border-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  Create Free Account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
