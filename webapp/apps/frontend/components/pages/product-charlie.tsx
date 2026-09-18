"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@droiduse/shared-ui/button"
import { Badge } from "@droiduse/shared-ui/badge"
import {
  Mic,
  Layout,
  Users,
  Clock,
  ShieldAlert,
  Type,
  Download,
  Smartphone,
  Heart,
  Settings,
  ArrowRight,
  Quote,
  ChevronDown,
  Phone,
  Lock,
  Shield,
} from "lucide-react"
import { Navigation } from "@/components/navigation"
import { useSettings } from "@/providers/settings-provider"

// Data constants
const features = [
  {
    icon: Mic,
    title: "Voice Commands",
    description:
      "Just say what you need. \"Call my daughter\" or \"Open the weather\" and Charlie listens and acts, no tapping required.",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    icon: Layout,
    title: "Simplified Navigation",
    description:
      "Charlie replaces confusing menus with a clear, easy-to-read layout. Large buttons, simple words, and a calm interface.",
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
  {
    icon: Users,
    title: "Family Connection",
    description:
      "One-tap video calls, photo sharing with grandkids, and family group messages. Staying connected has never been easier.",
    color: "text-purple-300",
    bg: "bg-purple-300/10",
  },
  {
    icon: Clock,
    title: "Medication Reminders",
    description:
      "Gentle, reliable reminders with confirmation. Charlie makes sure prescriptions are never missed and logs each dose.",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    icon: ShieldAlert,
    title: "Emergency Access",
    description:
      "An always-visible SOS button that instantly calls emergency contacts or 911. Peace of mind for the whole family.",
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  {
    icon: Type,
    title: "Large Text & Icons",
    description:
      "Everything is bigger and clearer: text, buttons, icons. No more squinting or accidentally pressing the wrong thing.",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
]

const steps = [
  {
    icon: Download,
    title: "Download the App",
    desc: "Install Ask Charlie from the Google Play Store onto your loved one's phone.",
  },
  {
    icon: Settings,
    title: "Set It Up for Them",
    desc: "Add their contacts, set medication times, and customize the home screen in minutes.",
  },
  {
    icon: Smartphone,
    title: "Hand Them the Phone",
    desc: "Charlie takes over with a simple interface they can actually use. Voice-first, stress-free.",
  },
  {
    icon: Heart,
    title: "Stay Connected",
    desc: "Get notified if they need help. Check in remotely, send photos, and never worry about missed medications.",
  },
]

const testimonials = [
  {
    quote:
      "My mom used to call me five times a day asking how to open her photos. Since we installed Charlie, she does it herself and even sends me pictures of her garden.",
    author: "Jennifer M.",
    role: "Set it up for her mother, 78",
  },
  {
    quote:
      "Dad was so frustrated with his phone he wanted to go back to a flip phone. Charlie gave him his independence back. He even video calls the grandkids now.",
    author: "Robert T.",
    role: "Set it up for his father, 82",
  },
  {
    quote:
      "The medication reminder feature alone is worth it. We used to worry constantly. Now Charlie tracks everything and sends us a daily update.",
    author: "Priya K.",
    role: "Set it up for her grandmother, 74",
  },
]

export default function ProductCharlie() {
  const { getSetting } = useSettings()
  const playstoreUrl = getSetting("url.playstore.closed.beta")

  return (
    <div className="min-h-screen">
      <Navigation product="ask-charlie" />

      {/* 1. Hero Section */}
      <section className="relative pt-28 pb-20 px-6 overflow-hidden lg:min-h-screen lg:flex lg:items-center lg:pt-16">
        {/* Warm gradient background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-purple-500/15 via-amber-500/8 to-transparent blur-3xl" />
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-purple-400/15 rounded-full blur-3xl" />
          <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-amber-400/12 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-300/10 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl w-full text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-6 gap-1.5 text-sm">
              <Heart className="h-3.5 w-3.5 text-purple-400" />
              Built for Families Who Care
            </Badge>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Make Their Phone
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-purple-300 to-amber-400 bg-clip-text text-transparent">
              Simple Again.
            </span>
          </motion.h1>

          <motion.p
            className="mt-6 text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Ask Charlie turns any Android phone into an easy-to-use companion
            for your parents and grandparents. Voice commands, big buttons, and
            one-tap family calls. No tech skills needed.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <a
              href={playstoreUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="default"
                className="gap-2 text-base md:text-lg px-6 py-3 sm:px-8 sm:py-6 rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow bg-purple-500 hover:bg-purple-600 text-white"
              >
                <Download className="h-5 w-5" />
                Get It on Google Play
              </Button>
            </a>
            <Link href="/auth/signup?product=ask-charlie">
              <Button
                variant="outline"
                className="gap-2 text-base md:text-lg px-6 py-3 sm:px-8 sm:py-6 rounded-full font-semibold border-purple-400/30 hover:bg-purple-400/10"
              >
                Create Free Account
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </motion.div>

          <motion.p
            className="mt-5 text-sm md:text-base text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            Free to try. Set up in under 5 minutes. No credit card required.
          </motion.p>

          {/* Learn more arrow */}
          <motion.div
            className="mt-14"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <a
              href="#features"
              className="inline-flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="text-sm">See how it helps</span>
              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{
                  duration: 1.5,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "easeInOut",
                }}
              >
                <ChevronDown className="h-5 w-5" />
              </motion.div>
            </a>
          </motion.div>
        </div>
      </section>

      {/* 2. Features Grid */}
      <section
        id="features"
        className="py-20 lg:py-32 px-6 border-t border-border scroll-mt-16"
      >
        <div className="mx-auto max-w-md lg:max-w-5xl w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10 lg:mb-14"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              Everything They Need,
              <br />
              <span className="text-purple-400">Nothing They Don't</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Charlie strips away the complexity and keeps what matters most:
              staying connected, staying safe, and staying independent.
            </p>
          </motion.div>

          <div className="grid gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={`rounded-xl ${feature.bg} border border-white/10 p-6 md:p-7 hover:bg-white/10 transition-all`}
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/50">
                    <feature.icon
                      className={`h-5 w-5 ${feature.color}`}
                    />
                  </div>
                  <h3 className="font-bold text-lg md:text-xl">
                    {feature.title}
                  </h3>
                </div>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. How It Works */}
      <section className="py-20 lg:py-32 px-6 border-t border-border bg-muted/20">
        <div className="mx-auto max-w-md lg:max-w-3xl w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              Set It Up in{" "}
              <span className="text-amber-400">Minutes</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              You handle the setup. They enjoy the simplicity. Here is how it
              works from your side.
            </p>
          </motion.div>

          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[27px] md:left-[31px] top-8 bottom-8 w-0.5 bg-purple-400/20" />

            <div className="space-y-8 md:space-y-10">
              {steps.map((step, i) => (
                <motion.div
                  key={step.title}
                  className="relative flex gap-4 md:gap-6"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                >
                  <div className="relative flex-shrink-0">
                    <div className="flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full bg-background border-2 border-purple-400/50 shadow-lg shadow-purple-500/15">
                      <step.icon className="h-6 w-6 md:h-7 md:w-7 text-purple-400" />
                    </div>
                  </div>
                  <div className="pt-2 md:pt-3">
                    <h3 className="font-semibold text-lg md:text-xl lg:text-2xl mb-1">
                      {step.title}
                    </h3>
                    <p className="text-base md:text-lg text-muted-foreground">
                      {step.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Testimonials */}
      <section className="py-20 lg:py-32 px-6 border-t border-border">
        <div className="mx-auto max-w-md lg:max-w-4xl w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-10 lg:mb-14"
          >
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              Families{" "}
              <span className="text-purple-400">Love</span> Charlie
            </h2>
            <p className="text-lg text-muted-foreground">
              Real stories from people who set up Charlie for someone they care
              about.
            </p>
          </motion.div>

          <div className="grid gap-4 lg:gap-6 md:grid-cols-3">
            {testimonials.map((testimonial, i) => (
              <motion.div
                key={testimonial.author}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative rounded-xl glass-panel p-5 md:p-6"
              >
                <Quote className="absolute top-3 right-3 h-6 w-6 text-purple-400/20" />
                <p className="text-sm md:text-base text-foreground mb-4 leading-relaxed">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-400/20 text-purple-300 font-semibold text-sm">
                    {testimonial.author.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {testimonial.author}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {testimonial.role}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Peace of Mind for Families - Trust Section */}
      <section className="py-20 lg:py-32 px-6 border-t border-border bg-muted/20">
        <div className="mx-auto max-w-md lg:max-w-4xl w-full">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            <div className="flex-1 space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
                  Peace of Mind{" "}
                  <span className="text-purple-400">for Families.</span>
                </h2>
                <p className="text-lg text-muted-foreground">
                  We know you worry about your parents getting frustrated or scammed
                  online. Charlie is built to protect them while giving them
                  independence.
                </p>
              </motion.div>

              <div className="space-y-6">
                {[
                  {
                    icon: Lock,
                    title: "Privacy First",
                    description: "Your data stays on your phone. We don't sell personal information.",
                  },
                  {
                    icon: Phone,
                    title: "Remote Setup",
                    description: "Help mom or dad set it up once remotely, and it runs forever.",
                  },
                  {
                    icon: Shield,
                    title: "Scam Protection",
                    description: "Charlie helps filter out confusing pop-ups and suspicious links.",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    className="flex gap-4"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-purple-400/10 text-purple-400 flex items-center justify-center shrink-0">
                      <item.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-1">{item.title}</h3>
                      <p className="text-muted-foreground">{item.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div
              className="flex-1"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="rounded-2xl bg-gradient-to-br from-purple-500/10 to-amber-500/10 border border-purple-500/20 p-8 text-center">
                <p className="text-6xl font-bold text-purple-400 mb-2">10,000+</p>
                <p className="text-lg text-muted-foreground mb-6">Families trust Charlie</p>
                <p className="text-base text-muted-foreground leading-relaxed">
                  We worked with hundreds of seniors to make sure Charlie solves the
                  real problems they face every day. Large text, clear
                  confirmations, and patience built-in.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 6. Bottom CTA Section */}
      <section className="py-20 lg:py-32 px-6 bg-gradient-to-br from-purple-600 via-purple-500 to-purple-700">
        <div className="mx-auto max-w-2xl text-center w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Phone className="h-12 w-12 mx-auto mb-6 text-amber-300" />
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
              Give Them the Gift of Simplicity.
            </h2>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/80 mb-8 max-w-md lg:max-w-2xl mx-auto">
              Your parents deserve a phone that works for them, not against
              them. Set up Charlie today and give them their independence back.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <a
                href={playstoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto"
              >
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto gap-2 text-base md:text-lg px-6 py-3 sm:px-8 sm:py-6 rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow"
                >
                  <Download className="h-5 w-5" />
                  Download on Google Play
                </Button>
              </a>
              <Link href="/auth/signup?product=ask-charlie" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto gap-2 text-base md:text-lg px-6 py-3 sm:px-8 sm:py-6 rounded-full font-semibold border-2 border-white/30 text-white hover:bg-white/10 hover:text-white"
                >
                  Create Free Account
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>

            <p className="mt-6 text-sm md:text-base text-white/60">
              Free to try. No credit card required. Set up takes under 5
              minutes.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
