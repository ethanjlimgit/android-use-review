"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@droiduse/shared-ui/button"
import { Badge } from "@droiduse/shared-ui/badge"
import {
  Zap,
  Shield,
  Download,
  Car,
  Heart,
  TrendingUp,
  ArrowRight,
  User,
  ChevronDown,
  Globe,
  Users,
  Smartphone,
  Bot,
  EyeOff,
  Lock,
} from "lucide-react"
import { useSettings } from "@/providers/settings-provider"
import { PRODUCT_TAGLINES } from "@/lib/products"

interface HomeVariantCProps {
  onCTAClick: (ctaName: string, ctaLocation: string) => void
}

// Data constants
const stats = [
  { value: "5.3M+", label: "Video views", icon: Globe },
  { value: "10K+", label: "Beta users", icon: Users },
  { value: "50+", label: "Apps supported", icon: Smartphone },
  { value: "99.2%", label: "Task success rate", icon: Zap },
]

const pillars = [
  {
    icon: EyeOff,
    title: "Your Screen Is Never Stored",
    description: "Yes, the AI needs to see your screen to do its job. But what it sees is processed in the moment and immediately discarded. We never store, sell, or share your screen data with anyone.",
  },
  {
    icon: Shield,
    title: "Your Data Is Never Sold",
    description: "We make money from subscriptions, not your data. We do not sell, share, or hand your information to advertisers or third parties. Period.",
  },
  {
    icon: Lock,
    title: "You Are Always in Control",
    description: "Revoke permissions, pause automation, or delete your account and all associated data instantly. No lock-in, no dark patterns, no hassle.",
  },
]

// Products showcase
const products = [
  {
    href: "/products/ask-boris",
    title: "For Everyday People",
    tagline: "Personal Automation",
    description: "Stop wasting time on repetitive phone tasks. Automatically handle grocery delivery, dating profiles, reminders, and more, so you can focus on what actually matters.",
    icon: Car,
    color: "text-emerald-400",
    gradient: "from-emerald-500/20 to-emerald-500/5",
    border: "border-emerald-500/20 hover:border-emerald-500/40",
    cta: "Learn more",
  },
  {
    href: "/products/ask-charlie",
    title: "For Seniors & Family",
    tagline: "Elderly Assistance",
    description: "Help your parents or grandparents use their smartphone with confidence. Just speak naturally and the phone does the rest. No confusing menus or tiny buttons.",
    icon: Heart,
    color: "text-purple-400",
    gradient: "from-purple-500/20 to-purple-500/5",
    border: "border-purple-500/20 hover:border-purple-500/40",
    cta: "Learn more",
  },
  {
    href: "/products/androiduse",
    title: "For Marketers & Businesses",
    tagline: "Marketing Automation",
    description: "Run TikTok growth campaigns, manage social media at scale, and automate device farms. Built for agencies and teams who need results without the manual grind.",
    icon: TrendingUp,
    color: "text-blue-400",
    gradient: "from-blue-500/20 to-blue-500/5",
    border: "border-blue-500/20 hover:border-blue-500/40",
    cta: "Learn more",
  },
]


/**
 * Landing page Variant C - Mobile-first, animation-heavy design
 *
 * Section order:
 * 1. Hero (Beta Live, headline, subtitle, CTA, social proof, learn more arrow)
 * 2. Your New Superpowers (combined use cases grid)
 * 3. Testimonials (social proof quotes)
 * 4. How It Works (vertical timeline)
 * 5. Magic Features (feature cards)
 * 6. Final CTA
 * 7. Floating CTA
 */
export default function HomeVariantC({ onCTAClick }: HomeVariantCProps) {
  const { getSetting } = useSettings()
  const playstoreUrl = getSetting("url.playstore.closed.beta")
  const betaGroupUrl = getSetting("url.beta.google.group")

  return (
    <div className="min-h-screen">
      {/* 1. Hero Section */}
      <section className="relative pt-24 pb-16 px-6 overflow-hidden lg:min-h-screen lg:flex lg:items-center lg:pt-0">
        {/* Gradient background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-primary/20 via-primary/5 to-transparent blur-3xl" />
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl w-full">
          <div className="flex flex-col lg:flex-row lg:items-center lg:gap-12 xl:gap-20">
            {/* Left side - Text content */}
            <div className="flex-1 text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Badge variant="secondary" className="mb-6 gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Closed Beta - Now on Google Play
                </Badge>
              </motion.div>

              <motion.h1
                className="text-5xl md:text-6xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                PhoneGPT,
                <br />
                <span className="bg-gradient-to-r from-primary to-emerald-300 bg-clip-text text-transparent">
                  The Better Siri.
                </span>
              </motion.h1>

              <motion.p
                className="mt-6 text-lg md:text-xl lg:text-xl xl:text-2xl text-muted-foreground max-w-lg mx-auto lg:mx-0"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                The personal assistant that actually does the work for you. No more tapping, scrolling, or copy-pasting.
              </motion.p>

              <motion.div
                className="mt-12 flex flex-col items-center lg:items-start gap-4"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.3 }}
              >
                <a
                  href={betaGroupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onCTAClick("join_beta_signup", "hero")}
                >
                  <Button
                    variant="default"
                    className="gap-1.5 sm:gap-2 text-sm sm:text-base md:text-lg px-4 py-2.5 sm:px-8 sm:py-6 rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow"
                  >
                    <User className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" />
                    Join Closed Beta Group
                  </Button>
                </a>

                <p className="text-sm text-muted-foreground mt-2">
                  Then download on Google Play (won't work without joining first)
                </p>

                {/* Google Play Badge */}
                <a
                  href={playstoreUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onCTAClick("join_beta_playstore", "hero")}
                  className="transition-opacity hover:opacity-80"
                >
                  <img
                    src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                    alt="Get it on Google Play"
                    className="h-16 sm:h-20 md:h-24"
                  />
                </a>
              </motion.div>

              <motion.p
                className="mt-4 text-sm md:text-base text-muted-foreground text-center lg:text-left"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                Limited closed beta · No credit card required.
              </motion.p>

              {/* Stats row */}
              <motion.div
                className="mt-6 flex items-center justify-center lg:justify-start gap-5 divide-x divide-border/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                {stats.map((stat) => (
                  <div key={stat.label} className="pl-5 first:pl-0 text-center lg:text-left">
                    <p className="text-2xl font-bold leading-tight">{stat.value}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right side - Phone mockup with video */}
            <motion.div
              className="flex-shrink-0 mt-12 lg:mt-0 flex justify-center"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <div className="relative w-[240px] sm:w-[280px] md:w-[320px] lg:w-[300px] xl:w-[360px]">
                {/* Video positioned on the screen area (behind the frame) */}
                {/* SVG screen: x=33.75, y=33.75, width=652.5, height=1460.5, rx=90 out of 725x1528 */}
                {/* Percentages: left=4.66%, top=2.21%, width=90%, height=95.6%, borderRadius=12.4% */}
                <div
                  className="absolute z-10 overflow-hidden"
                  style={{
                    left: '4.66%',
                    top: '2.21%',
                    width: '90%',
                    height: '95.6%',
                    borderRadius: '12.4% / 5.9%',
                  }}
                >
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  >
                    <source src="/androiduse-demo.mp4" type="video/mp4" />
                  </video>
                </div>
                {/* Phone frame SVG (on top with transparent screen) */}
                <img
                  src="/Google_Pixel_9_front.svg"
                  alt="Google Pixel 9"
                  className="w-full h-auto relative pointer-events-none"
                />
              </div>
            </motion.div>
          </div>

          {/* Learn more arrow */}
          <motion.div
            className="mt-12 lg:mt-16 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <a
              href="#products"
              className="inline-flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="text-sm">Learn more</span>
              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              >
                <ChevronDown className="h-5 w-5" />
              </motion.div>
            </a>
          </motion.div>
        </div>
      </section>

      {/* 2. Products Section */}
      <section id="products" className="py-20 lg:py-32 px-6 border-t border-border scroll-mt-16">
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
              there's a use case designed for you.
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


      {/* 4. Platform Pillars Section */}
      <section className="py-20 lg:py-28 px-6 border-t border-border bg-muted/20">
        <div className="mx-auto max-w-4xl w-full">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              Your Privacy Is Non-Negotiable
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We know giving an AI access to your phone sounds scary. Here is exactly how we protect you.
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

      {/* 5. Bottom CTA */}
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
                onClick={() => onCTAClick("download_bottom", "bottom_cta")}
              >
                <Button variant="secondary" className="gap-2 text-base px-8 py-6 rounded-full font-semibold shadow-lg">
                  <Download className="h-5 w-5" />
                  Download on Google Play
                </Button>
              </a>
              <Link
                href="/auth/signup"
                onClick={() => onCTAClick("signup_bottom", "bottom_cta")}
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
