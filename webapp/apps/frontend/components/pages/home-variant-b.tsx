"use client"

import Link from "next/link"
import { Button } from "@droiduse/shared-ui/button"
import { Badge } from "@droiduse/shared-ui/badge"
import {
  Smartphone,
  Sparkles,
  Zap,
  Shield,
  ArrowRight,
  CheckCircle2,
  Bot,
  Code2,
  Workflow,
} from "lucide-react"
import { SiGithub } from "react-icons/si"
import { useSettings } from "@/providers/settings-provider"

interface HomeVariantBProps {
  onCTAClick: (ctaName: string, ctaLocation: string) => void
}

const benefits = [
  "Control any Android device remotely",
  "Natural language task automation",
  "Pre-built automation skills",
  "Secure end-to-end encryption",
  "Open source & self-hostable",
]

const useCases = [
  {
    icon: Bot,
    title: "AI Agents",
    description: "Build autonomous agents that interact with mobile apps naturally.",
  },
  {
    icon: Code2,
    title: "Testing",
    description: "Automate mobile app testing with AI-powered test generation.",
  },
  {
    icon: Workflow,
    title: "Workflows",
    description: "Create complex cross-app automation workflows effortlessly.",
  },
]

const getTestimonials = (siteName: string) => [
  {
    quote: `${siteName} cut our mobile automation setup time from weeks to hours.`,
    author: "Sarah Chen",
    role: "Lead Engineer at TechCorp",
  },
  {
    quote: "The AI-powered automation is a game-changer for our QA team.",
    author: "Marcus Johnson",
    role: "QA Director at AppScale",
  },
]

/**
 * Landing page Variant B - Focused on benefits and social proof
 *
 * Key differences from control:
 * - Benefits-focused hero with checklist
 * - Social proof section with testimonials
 * - Use case cards instead of feature grid
 * - Single prominent CTA
 */
export default function HomeVariantB({ onCTAClick }: HomeVariantBProps) {
  const { getSetting } = useSettings();
  const siteName = getSetting("site.name");
  const testimonials = getTestimonials(siteName);

  return (
    <div className="min-h-screen">
      {/* Hero Section - Benefits focused */}
      <section className="relative pt-32 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-6 gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                NOW IN PUBLIC BETA
              </Badge>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                Let AI Control
                <br />
                <span className="text-primary">Your Android</span>
              </h1>

              <p className="mt-6 text-lg text-muted-foreground">
                The open-source platform that enables AI agents to interact with any Android device.
                Automate tasks, build agents, and scale mobile operations.
              </p>

              <ul className="mt-8 space-y-3">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3 text-foreground">
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    {benefit}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/auth/signup"
                  onClick={() => onCTAClick("get_started_free", "hero")}
                >
                  <Button size="lg" className="gap-2 text-base px-8">
                    Get Started Free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="lg"
                  className="gap-2"
                  asChild
                  onClick={() => onCTAClick("view_github", "hero")}
                >
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                    <SiGithub className="h-4 w-4" />
                    Star on GitHub
                  </a>
                </Button>
              </div>
            </div>

            {/* Demo/Visual */}
            <div className="relative">
              <div className="aspect-square rounded-2xl border border-border bg-card/50 backdrop-blur-sm p-8 glow-green">
                <div className="h-full rounded-xl bg-background/80 border border-border flex items-center justify-center">
                  <div className="text-center p-6">
                    <Smartphone className="h-16 w-16 text-primary mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">
                      Interactive demo coming soon
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Built for developers</h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Whether you're building AI agents, automating tests, or creating workflows,
              {siteName} gives you the tools you need.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {useCases.map((useCase) => (
              <div
                key={useCase.title}
                className="rounded-xl border border-border bg-card p-6 text-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mx-auto mb-4">
                  <useCase.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{useCase.title}</h3>
                <p className="text-sm text-muted-foreground">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/30">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Trusted by engineers</h2>
            <p className="mt-3 text-muted-foreground">
              See what developers are saying about {siteName}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.author}
                className="rounded-xl border border-border bg-card p-6"
              >
                <p className="text-foreground mb-4">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div>
                    <p className="font-medium text-sm">{testimonial.author}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex justify-center gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-primary">12.5k+</p>
              <p className="text-sm text-muted-foreground">GitHub Stars</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">8.2k+</p>
              <p className="text-sm text-muted-foreground">Active Users</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-primary">99.9%</p>
              <p className="text-sm text-muted-foreground">Uptime</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Start automating in minutes
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Free to start. No credit card required. Deploy on your own infrastructure.
          </p>
          <Link
            href="/auth/signup"
            onClick={() => onCTAClick("create_free_account", "footer_cta")}
          >
            <Button size="lg" className="gap-2 text-base px-10">
              Create Free Account
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">
            Or{" "}
            <Link
              href="/docs"
              className="text-primary hover:underline"
              onClick={() => onCTAClick("view_docs", "footer_cta")}
            >
              view documentation
            </Link>{" "}
            to see what's possible
          </p>
        </div>
      </section>
    </div>
  )
}
