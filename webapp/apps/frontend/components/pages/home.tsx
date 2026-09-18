"use client"

import Link from "next/link"
import { Button } from "@droiduse/shared-ui/button"
import { Badge } from "@droiduse/shared-ui/badge"
import { TerminalInput } from "@/components/terminal-input"
import {
  Smartphone,
  Sparkles,
  Zap,
  Shield,
  ArrowRight,
  Star,
  Users,
  Package,
  Play,
} from "lucide-react"
import { SiGithub } from "react-icons/si"
import { useSettings } from "@/providers/settings-provider"

interface HomeProps {
  onCTAClick: (ctaName: string, ctaLocation: string) => void
}

const stats = [
  { icon: Star, value: "12.5k", label: "GitHub Stars" },
  { icon: Users, value: "8.2k", label: "Active Users" },
  { icon: Package, value: "2.4k", label: "Skill Entries" },
];

const features = [
  {
    icon: Smartphone,
    title: "Device Control",
    description: "Connect and control Android devices remotely with real-time status updates and instruction relay.",
  },
  {
    icon: Sparkles,
    title: "AI Skills",
    description: "Leverage AI skills and app-specific automation to help agents understand mobile interfaces.",
  },
  {
    icon: Zap,
    title: "Fast Automation",
    description: "Execute complex multi-step tasks across apps with optimized action sequences and smart retries.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "End-to-end encryption for device communication. Your data never leaves your control.",
  },
];

const getSteps = (siteName: string) => [
  {
    step: "01",
    title: "Connect Device",
    description: `Install the ${siteName} app on your Android device and pair it with your account using a secure code.`,
  },
  {
    step: "02",
    title: "Set Up Automation",
    description: "Configure pre-built automation skills for your favorite apps.",
  },
  {
    step: "03",
    title: "Automate Tasks",
    description: "Send natural language instructions to your device and watch the AI agent execute them in real-time.",
  },
];

/**
 * Landing page Variant A (Control) - Original design
 *
 * Features terminal input, feature grid, how-it-works steps
 */
export default function Home({ onCTAClick }: HomeProps) {
  const { getSetting } = useSettings();
  const siteName = getSetting("site.name");

  return (
    <div className="min-h-screen">
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl text-center">
          <Badge variant="secondary" className="mb-6 gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            API FOR ANDROID
          </Badge>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            ENABLE AI TO
            <br />
            <span className="text-primary">CONTROL</span>
            <br />
            ANDROID
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            The <span className="text-primary font-semibold">ECOSYSTEM</span> built around the world's most-loved mobile automation library.
          </p>

          <div className="mt-10 max-w-2xl mx-auto">
            <TerminalInput />
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              onClick={() => onCTAClick("get_started", "hero")}
            >
              <Button size="lg" className="gap-2" data-testid="button-get-started">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="outline"
              size="lg"
              className="gap-2"
              asChild
              data-testid="button-github"
              onClick={() => onCTAClick("view_github", "hero")}
            >
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                <SiGithub className="h-4 w-4" />
                View on GitHub
              </a>
            </Button>
          </div>

          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2 text-muted-foreground">
                <stat.icon className="h-5 w-5" />
                <span className="text-foreground font-semibold">{stat.value}</span>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Everything you need for mobile automation</h2>
            <p className="mt-3 text-muted-foreground">
              Powerful tools for developers and AI practitioners
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-lg border border-border bg-card p-6 hover-elevate active-elevate-2 transition-all duration-200"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
            <p className="mt-3 text-muted-foreground">
              Get started in three simple steps
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {getSteps(siteName).map((step, index) => (
              <div key={step.step} className="relative">
                {index < getSteps(siteName).length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-border -translate-x-1/2" />
                )}
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-background mb-4">
                    <span className="text-xl font-bold text-primary">{step.step}</span>
                  </div>
                  <h3 className="font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-border bg-card p-8 md:p-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-4">
              Ready to automate your Android?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of developers using {siteName} to build powerful mobile automation solutions.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/devices"
                onClick={() => onCTAClick("connect_device", "footer_cta")}
              >
                <Button size="lg" className="gap-2" data-testid="button-connect-device">
                  <Play className="h-4 w-4" />
                  Connect Your Device
                </Button>
              </Link>
              <Link
                href="/auth/signup"
                onClick={() => onCTAClick("create_account", "footer_cta")}
              >
                <Button variant="outline" size="lg" data-testid="button-create-account">
                  Create Account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
