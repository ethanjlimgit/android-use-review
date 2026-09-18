"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@droiduse/shared-ui/button"
import {
  ArrowRight,
  Cpu,
  UserX,
  Shield,
  MessageSquare,
  CalendarCheck,
  Eye,
  PieChart,
  Search,
  Tags,
  Mail,
  Bot,
} from "lucide-react"
import { Navigation } from "@/components/navigation"

// Accent color: #573CFF (Electric Violet)
const ACCENT = "#573CFF"
const ACCENT_LIGHT = "#8F7FFF"

export default function ProductAndroidUse() {
  return (
    <div
      className="min-h-screen text-[#E0E0E6]"
      style={{
        backgroundColor: "#0B0B0F",
        backgroundSize: "40px 40px",
        backgroundImage:
          "linear-gradient(to right, rgba(87,60,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(87,60,255,0.05) 1px, transparent 1px)",
      }}
    >
      <Navigation product="androiduse" />

      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <header className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden px-6">
        {/* Background bloom */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full blur-[120px] pointer-events-none"
          style={{ backgroundColor: ACCENT, opacity: 0.1 }}
        />

        <div className="max-w-5xl mx-auto relative z-10 text-center">
          <motion.div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold uppercase tracking-wider mb-8"
            style={{
              backgroundColor: "#15151F",
              borderColor: "rgba(87,60,255,0.3)",
              color: ACCENT_LIGHT,
            }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            System Status: Undetectable
          </motion.div>

          <motion.h1
            className="text-5xl lg:text-7xl font-bold tracking-tight mb-8 leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Scale TikTok Marketing
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, #FFFFFF 0%, ${ACCENT_LIGHT} 100%)`,
              }}
            >
              On Real Android Devices.
            </span>
          </motion.h1>

          <motion.p
            className="text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Stop getting shadowbanned by APIs and Emulators. AndroidUse
            automates your TikTok presence using{" "}
            <strong className="text-white">physical phones</strong> and{" "}
            <strong className="text-white">human-like AI behavior</strong>.
            Post, reply, and analyze at scale.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Link href="/auth/signup?product=androiduse">
              <Button
                className="text-lg px-8 py-6 rounded-full font-bold text-white w-full sm:w-auto"
                style={{
                  backgroundColor: ACCENT,
                  boxShadow: `0 0 20px rgba(87,60,255,0.3)`,
                }}
              >
                Start Automating
              </Button>
            </Link>
            <a href="#features">
              <Button
                variant="outline"
                className="px-8 py-6 rounded-full font-medium text-gray-300 hover:text-white border-gray-700 hover:border-white w-full sm:w-auto"
              >
                How It Works
              </Button>
            </a>
          </motion.div>
        </div>
      </header>

      {/* ─── Why Traditional Automation Fails ─────────────────────────────── */}
      <section
        id="features"
        className="py-20 px-6 border-t scroll-mt-16"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold mb-4">
              Why Traditional Automation Fails
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              TikTok knows when you're using a bot. AndroidUse is different
              because we simulate the hardware, not just the request.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Cpu,
                color: ACCENT,
                bg: `rgba(87,60,255,0.15)`,
                title: "Real Hardware Matrix",
                desc: "Your account runs on a real Android device in our cloud facility. Valid IMEIs, real fingerprints, genuine carrier signals. Zero emulation flags.",
              },
              {
                icon: UserX,
                color: "#22c55e",
                bg: "rgba(34,197,94,0.1)",
                title: "Human-Like Behavior",
                desc: "Our AI doesn't just API-blast. It scrolls, pauses, watches other videos, and mimics human touch patterns before posting to warm up your account.",
              },
              {
                icon: Shield,
                color: "#3b82f6",
                bg: "rgba(59,130,246,0.1)",
                title: "Residential IP Rotation",
                desc: 'Each device is paired with high-quality 4G/5G residential proxies. No datacenter IPs that scream "spam bot" to the algorithm.',
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                className="rounded-2xl p-8 relative overflow-hidden group transition-all"
                style={{
                  background: "rgba(21,21,31,0.7)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(87,60,255,0.1)",
                }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{
                  y: -5,
                  borderColor: "rgba(87,60,255,0.4)",
                  boxShadow: "0 10px 40px -10px rgba(87,60,255,0.2)",
                }}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-6"
                  style={{ backgroundColor: card.bg }}
                >
                  <card.icon className="h-5 w-5" style={{ color: card.color }} />
                </div>
                <h3 className="text-xl font-semibold mb-3 text-white">
                  {card.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {card.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AI Social Media Manager ──────────────────────────────────────── */}
      <section
        id="automation"
        className="py-24 px-6 border-y scroll-mt-16"
        style={{
          backgroundColor: "#15151F",
          borderColor: "rgba(255,255,255,0.06)",
        }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Left copy */}
            <div className="lg:w-1/2">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <span
                  className="inline-block px-3 py-1 rounded text-xs font-bold uppercase mb-4"
                  style={{
                    backgroundColor: `rgba(87,60,255,0.1)`,
                    color: ACCENT,
                  }}
                >
                  24/7 Operation
                </span>
                <h2 className="text-4xl font-bold mb-6 text-white">
                  Your AI Social Media Manager{" "}
                  <span className="text-gray-500">That Never Sleeps.</span>
                </h2>
                <p className="text-gray-400 mb-8 text-lg">
                  Manage hundreds of accounts from a single dashboard. Let AI
                  handle the tedious engagement while you focus on strategy.
                </p>
              </motion.div>

              <div className="space-y-6">
                {[
                  {
                    icon: MessageSquare,
                    title: "Smart Auto-Reply",
                    desc: "Our LLM reads comments, understands context/sentiment, and replies authentically to boost engagement scores. It can even handle customer support queries.",
                  },
                  {
                    icon: CalendarCheck,
                    title: "Matrix Scheduling",
                    desc: "Upload one video, schedule it across 50 different accounts with slightly varied captions and hashtags to dominate a niche.",
                  },
                  {
                    icon: Eye,
                    title: "Video Understanding",
                    desc: "Analyze your competitors. Our vision AI watches top videos in your niche and extracts data on pacing, hooks, and visual patterns.",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    className="flex items-start gap-4"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `rgba(87,60,255,0.15)` }}
                    >
                      <item.icon className="h-4 w-4" style={{ color: ACCENT }} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-lg">
                        {item.title}
                      </h4>
                      <p className="text-sm text-gray-400 mt-1">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Right - Dashboard mockup */}
            <motion.div
              className="lg:w-1/2 w-full"
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div
                className="rounded-2xl p-6 shadow-2xl"
                style={{
                  backgroundColor: "#0B0B0F",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 0 50px rgba(87,60,255,0.15)",
                }}
              >
                {/* Window chrome */}
                <div className="flex items-center justify-between mb-6 border-b border-gray-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <div className="text-xs text-gray-500 font-mono">
                    AndroidUse_Dashboard_v2.0
                  </div>
                </div>

                {/* Device grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-400">
                        Device #1042
                      </span>
                      <span className="text-xs text-green-400">● Active</span>
                    </div>
                    <div className="text-sm text-white mb-1">
                      Action:{" "}
                      <span style={{ color: ACCENT_LIGHT }}>
                        Replying to Comment
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2">
                      <motion.div
                        className="h-1.5 rounded-full w-3/4"
                        style={{ backgroundColor: ACCENT }}
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                  </div>

                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-gray-400">
                        Device #1043
                      </span>
                      <span className="text-xs text-green-400">● Active</span>
                    </div>
                    <div className="text-sm text-white mb-1">
                      Action:{" "}
                      <span style={{ color: ACCENT_LIGHT }}>
                        Warming Up (Scrolling)
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 h-1.5 rounded-full mt-2">
                      <motion.div
                        className="bg-yellow-500 h-1.5 rounded-full w-1/2"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    </div>
                  </div>
                </div>

                {/* Chat simulation */}
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-800">
                  <div className="text-xs text-gray-500 mb-3 uppercase font-bold tracking-wider">
                    Live AI Auto-Reply Log
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-gray-700 flex-shrink-0" />
                      <div className="bg-gray-800 rounded-lg rounded-tl-none p-2 text-xs text-gray-300 w-3/4">
                        User: &quot;Where can I get this?&quot;
                      </div>
                    </div>
                    <div className="flex gap-3 flex-row-reverse">
                      <div
                        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: ACCENT }}
                      >
                        <Bot className="h-3 w-3 text-white" />
                      </div>
                      <div
                        className="rounded-lg rounded-tr-none p-2 text-xs text-white w-3/4"
                        style={{
                          backgroundColor: `rgba(87,60,255,0.15)`,
                          border: `1px solid rgba(87,60,255,0.2)`,
                        }}
                      >
                        <span
                          className="text-[10px] block mb-1"
                          style={{ color: ACCENT_LIGHT }}
                        >
                          AI Agent (Sentiment: Interested)
                        </span>
                        Check the link in bio for the launch discount! 🔥
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Deep Social Intelligence ─────────────────────────────────────── */}
      <section id="intelligence" className="py-20 px-6 scroll-mt-16">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold mb-4">
              Deep Social Intelligence
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto mb-16">
              Understand what's happening in your niche without spending hours
              scrolling.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: PieChart,
                title: "Trend Detection",
                desc: 'Identify rising sounds and hashtags before they peak. Our devices monitor "For You" feeds 24/7.',
              },
              {
                icon: Search,
                title: "Competitor Spy",
                desc: "Track competitor accounts. Get alerted when they post and analyze their comment sections for customer complaints.",
              },
              {
                icon: Tags,
                title: "Brand Safety",
                desc: "Monitor your brand mentions across TikTok. Auto-hide spam or negative comments based on keywords.",
              },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                className="p-6 rounded-xl group transition-all duration-300"
                style={{
                  border: "1px solid rgba(255,255,255,0.06)",
                  background:
                    "linear-gradient(to bottom, rgba(17,17,24,1), transparent)",
                }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{
                  borderColor: "rgba(87,60,255,0.4)",
                }}
              >
                <div className="w-16 h-16 bg-gray-800 rounded-full mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition">
                  <card.icon
                    className="h-6 w-6"
                    style={{ color: ACCENT_LIGHT }}
                  />
                </div>
                <h3 className="font-bold text-lg mb-2 text-white">
                  {card.title}
                </h3>
                <p className="text-sm text-gray-400">{card.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA / Contact ────────────────────────────────────────────────── */}
      <section
        id="contact"
        className="py-24 px-6 relative overflow-hidden scroll-mt-16"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(to top, rgba(87,60,255,0.1), transparent)`,
          }}
        />

        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Ready to Deploy?
            </h2>
            <p className="text-xl text-gray-400 mb-10">
              Join the platform that treats automation as a science, not a hack.
              <br />
              Deploy your army of Android devices today.
            </p>
          </motion.div>

          <motion.div
            className="max-w-lg mx-auto rounded-2xl p-8 shadow-2xl"
            style={{
              backgroundColor: "rgba(17,17,24,0.8)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="flex flex-col gap-4">
              <Link href="/auth/signup?product=androiduse" className="w-full">
                <Button
                  className="w-full font-bold py-6 text-lg rounded-lg text-white"
                  style={{
                    backgroundColor: ACCENT,
                    boxShadow: `0 0 20px rgba(87,60,255,0.3)`,
                  }}
                >
                  <Mail className="h-5 w-5 mr-2" />
                  Request Access
                </Button>
              </Link>
              <Link href="#features" className="w-full">
                <Button
                  variant="outline"
                  className="w-full py-6 rounded-lg font-medium text-gray-300 border-gray-700 hover:border-white hover:text-white"
                >
                  See How It Works
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <p className="text-xs text-gray-500 mt-2">
                Limited spots available for the beta program.
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
