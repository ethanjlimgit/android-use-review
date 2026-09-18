"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@droiduse/shared-ui/button"
import { Badge } from "@droiduse/shared-ui/badge"
import {
  Car,
  Heart,
  Calendar,
  Layers,
  ShieldCheck,
  BatteryCharging,
  Download,
  ArrowRight,
  Smartphone,
  Sparkles,
  Check,
  Quote,
  ChevronDown,
  UserPlus,
  Zap,
  Eye,
} from "lucide-react"
import { Navigation } from "@/components/navigation"
import { useSettings } from "@/providers/settings-provider"

// ── Feature data ──────────────────────────────────────────────────────────────

const features = [
  {
    icon: Car,
    title: "Driver Mode",
    description:
      "Compare Uber, Lyft, and DoorDash rates in real-time. Boris auto-accepts the highest-paying ride so you never miss a surge.",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  {
    icon: Heart,
    title: "Dating Autopilot",
    description:
      "Smart swiping, profile optimization, and AI-powered conversation starters across Tinder, Hinge, and Bumble.",
    color: "text-pink-400",
    bg: "bg-pink-400/10",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description:
      "Automate appointment booking, calendar syncing, and reminder management across all your apps.",
    color: "text-sky-400",
    bg: "bg-sky-400/10",
  },
  {
    icon: Layers,
    title: "Multi-App Workflows",
    description:
      "Chain actions across apps. Copy a restaurant address from Yelp, open Maps, then send the ETA to your group chat.",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    icon: ShieldCheck,
    title: "Privacy Shield",
    description:
      "All data stays on your device. No screenshots stored, no conversations logged. You're always in control.",
    color: "text-violet-400",
    bg: "bg-violet-400/10",
  },
  {
    icon: BatteryCharging,
    title: "Battery Efficient",
    description:
      "Lightweight background processing that sips battery. Boris runs all day without draining your phone.",
    color: "text-emerald-300",
    bg: "bg-emerald-300/10",
  },
]

// ── How It Works steps ────────────────────────────────────────────────────────

const steps = [
  {
    num: "01",
    icon: Download,
    title: "Install Boris",
    description: "Download from Google Play and grant accessibility permissions in one tap.",
  },
  {
    num: "02",
    icon: Smartphone,
    title: "Pick Your Mode",
    description: "Choose Driver Mode, Dating Autopilot, or create a custom workflow.",
  },
  {
    num: "03",
    icon: Sparkles,
    title: "Let Boris Work",
    description: "Boris runs in the background. Use your phone normally while it handles the rest.",
  },
  {
    num: "04",
    icon: Check,
    title: "Review & Earn",
    description: "Check your results dashboard. More rides accepted, more matches made, more time saved.",
  },
]

// ── Testimonials ──────────────────────────────────────────────────────────────

const testimonials = [
  {
    quote:
      "I made $340 more last week just by letting Boris auto-switch between Uber and Lyft during surge pricing. Game changer for full-time drivers.",
    author: "Jamal T.",
    role: "Rideshare Driver",
    city: "Atlanta",
  },
  {
    quote:
      "Honestly? Boris got me more dates in two weeks than I got in six months of swiping. The conversation starters actually work.",
    author: "Priya K.",
    role: "Product Designer",
    city: "Austin",
  },
  {
    quote:
      "I set up a workflow that checks my DoorDash, Instacart, and Amazon deliveries every morning. Takes 0 effort now.",
    author: "Marcus L.",
    role: "Freelance Developer",
    city: "Chicago",
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProductBoris() {
  const { getSetting } = useSettings()
  const playstoreUrl = getSetting("url.playstore.closed.beta")
  const betaGroupUrl = getSetting("url.beta.google.group")

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation product="ask-boris" />

      {/* ─── 1. Hero Section ─────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 px-6 overflow-hidden lg:min-h-screen lg:flex lg:items-center lg:pt-16">
        {/* Gradient background blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-[80%] bg-gradient-to-b from-emerald-500/15 via-emerald-500/5 to-transparent blur-3xl" />
          <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-teal-500/10 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] bg-cyan-500/8 rounded-full blur-[80px]" />
        </div>

        <div className="relative mx-auto max-w-6xl w-full">
          <div className="flex flex-col items-center text-center">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Badge
                variant="secondary"
                className="mb-6 gap-2 px-4 py-1.5 text-sm border border-emerald-500/30 bg-emerald-500/10"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Now in Closed Beta
              </Badge>
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-[1.05]"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Drive Safe.
              <br />
              Date More.
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
                Do Less.
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className="mt-6 text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              Boris automates your phone&apos;s busywork -- rideshare apps, dating
              profiles, daily errands -- so you can focus on what actually matters.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="mt-10 flex flex-col sm:flex-row items-center gap-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.35 }}
            >
              <a
                href={betaGroupUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  className="gap-2 text-base md:text-lg px-8 py-6 rounded-full font-semibold shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:shadow-emerald-500/30 transition-all bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  <UserPlus className="h-5 w-5" />
                  Join the Beta
                </Button>
              </a>
              <a
                href={playstoreUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  className="gap-2 text-base md:text-lg px-8 py-6 rounded-full font-semibold border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all"
                >
                  <Download className="h-5 w-5" />
                  Google Play
                </Button>
              </a>
            </motion.div>

            {/* Social proof */}
            <motion.p
              className="mt-6 text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Free during beta &middot; No credit card &middot; Android only
            </motion.p>
          </div>

          {/* Scroll indicator */}
          <motion.div
            className="mt-16 flex justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <a
              href="#features"
              className="inline-flex flex-col items-center gap-1 text-muted-foreground hover:text-emerald-400 transition-colors"
            >
              <span className="text-sm">See what Boris can do</span>
              <motion.div
                animate={{ y: [0, 5, 0] }}
                transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              >
                <ChevronDown className="h-5 w-5" />
              </motion.div>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ─── 2. Features Grid ────────────────────────────────────────────── */}
      <section id="features" className="py-24 lg:py-32 px-6 scroll-mt-16">
        <div className="mx-auto max-w-6xl w-full">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-4 border-emerald-500/20 bg-emerald-500/10">
              Features
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
              Your Phone, Supercharged
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Six powerful modes that turn your Android into an autonomous productivity machine.
            </p>
          </motion.div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                whileHover={{ scale: 1.02, y: -4 }}
                className="group relative rounded-2xl glass-panel p-6 md:p-8 border border-white/5 hover:border-emerald-500/20 transition-all duration-300"
              >
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/0 to-emerald-500/0 group-hover:from-emerald-500/5 group-hover:to-transparent transition-all duration-300 pointer-events-none" />

                <div className="relative">
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.bg} mb-4`}>
                    <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <h3 className="font-bold text-xl mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 3. How It Works ─────────────────────────────────────────────── */}
      <section className="py-24 lg:py-32 px-6 relative overflow-hidden">
        {/* Subtle background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-5xl w-full">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-4 border-emerald-500/20 bg-emerald-500/10">
              How It Works
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
              Up and Running in Minutes
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
              Four simple steps from install to autopilot.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="relative"
              >
                {/* Connector line (desktop only) */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-[calc(50%+32px)] w-[calc(100%-32px)] h-px bg-gradient-to-r from-emerald-500/30 to-emerald-500/10" />
                )}

                <div className="flex flex-col items-center text-center">
                  {/* Step number + icon */}
                  <div className="relative mb-5">
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                      <step.icon className="h-8 w-8 text-emerald-400" />
                    </div>
                    <span className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/30">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px]">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 4. Testimonials ─────────────────────────────────────────────── */}
      <section className="py-24 lg:py-32 px-6 border-t border-border/50">
        <div className="mx-auto max-w-6xl w-full">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-4 border-emerald-500/20 bg-emerald-500/10">
              Testimonials
            </Badge>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
              Real People, Real Results
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
              Hear from beta users who let Boris take the wheel.
            </p>
          </motion.div>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.author}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                whileHover={{ y: -4 }}
                className="relative rounded-2xl glass-panel p-6 md:p-8 border border-white/5 hover:border-emerald-500/20 transition-all duration-300"
              >
                {/* Quote icon */}
                <Quote className="absolute top-4 right-4 h-8 w-8 text-emerald-500/15" />

                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Zap key={j} className="h-4 w-4 fill-emerald-400 text-emerald-400" />
                  ))}
                </div>

                <p className="text-foreground leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>

                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-sm">
                    {t.author.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.author}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.role} &middot; {t.city}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 5. Bottom CTA Section ───────────────────────────────────────── */}
      <section className="relative py-24 lg:py-32 px-6 overflow-hidden">
        {/* Emerald gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.08),transparent_50%)]" />

        {/* Decorative shapes */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-black/10 rounded-full blur-3xl" />

        <div className="relative mx-auto max-w-3xl text-center w-full">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white/90 text-sm font-medium"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <Eye className="h-4 w-4" />
              Limited beta spots remaining
            </motion.div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-5">
              Stop Swiping.
              <br />
              Start Living.
            </h2>
            <p className="text-lg md:text-xl text-white/80 mb-10 max-w-xl mx-auto">
              Join thousands of drivers and busy professionals who let Boris handle their phone while they handle their life.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={playstoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto"
              >
                <Button className="w-full sm:w-auto gap-2 text-base md:text-lg px-8 py-6 rounded-full font-semibold bg-white text-emerald-700 hover:bg-white/90 shadow-xl hover:shadow-2xl transition-all">
                  <Download className="h-5 w-5" />
                  Download on Google Play
                </Button>
              </a>
              <Link href="/auth/signup?product=ask-boris" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto gap-2 text-base md:text-lg px-8 py-6 rounded-full font-semibold border-2 border-white/30 text-white hover:bg-white/10 hover:text-white transition-all"
                >
                  Create Free Account
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>

            <p className="mt-8 text-sm text-white/50">
              Free during closed beta &middot; No credit card required &middot; Uninstall anytime
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
