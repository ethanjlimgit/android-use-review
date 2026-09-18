import { Navigation } from "@/components/navigation";
import { Card, CardContent } from "@droiduse/shared-ui/card";
import type { Metadata } from "next";
import { getSiteName } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName();
  const description = `Read the ${siteName} Privacy Policy. Learn how we collect, use, and protect your data, including accessibility service usage and AI processing.`;

  return {
    title: `Privacy Policy - ${siteName}`,
    description,
    openGraph: {
      title: `Privacy Policy - ${siteName}`,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `Privacy Policy - ${siteName}`,
      description,
    },
  };
}

export default function PrivacyPage() {
  return (
    <>
      <Navigation />
      <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">
              Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          <Card>
            <CardContent className="p-8 space-y-6">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Welcome to Android Use ("we," "our," or "us"). Android Use is an AI-powered mobile automation assistant that helps you accomplish tasks on your Android device through natural language commands. We are committed to protecting your privacy and being transparent about how we collect, use, and safeguard your information.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  This Privacy Policy explains our data practices when you use the Android Use mobile application, web platform, and related services. By using Android Use, you agree to the collection and use of information in accordance with this policy.
                </p>
              </section>

              {/* Prominent Privacy Commitments */}
              <section className="bg-green-500/10 border-2 border-green-500/30 p-6 rounded-lg">
                <h2 className="text-2xl font-semibold mb-4 text-foreground">🔒 Our Privacy Commitments</h2>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-green-600 text-xl">✓</span>
                    <p className="text-foreground leading-relaxed">
                      <strong>We do NOT sell your personal data.</strong> We never have and never will sell your information to advertisers, data brokers, or third parties for profit.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-green-600 text-xl">✓</span>
                    <p className="text-foreground leading-relaxed">
                      <strong>Accessibility services are used ONLY for core functionality.</strong> We use Android's accessibility API exclusively to perform automation tasks you explicitly request. We do not use this permission to spy, track, or collect data for advertising.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-green-600 text-xl">✓</span>
                    <p className="text-foreground leading-relaxed">
                      <strong>Active use only - no background monitoring.</strong> We access your screen content only when you actively initiate a task. We do not monitor your device when the app is not in use.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-green-600 text-xl">✓</span>
                    <p className="text-foreground leading-relaxed">
                      <strong>You have full control.</strong> You can view, download, and delete all your data at any time. Revoke permissions through Android settings to stop all data collection.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-green-600 text-xl">✓</span>
                    <p className="text-foreground leading-relaxed">
                      <strong>Data minimization.</strong> We collect only the minimum data necessary to perform the specific task you request. Temporary data is deleted after task completion.
                    </p>
                  </div>
                </div>
              </section>

              <section className="border-l-4 border-primary pl-6 bg-primary/5 p-6 rounded-r-lg">
                <h2 className="text-2xl font-semibold mb-4">2. Google Play Store Compliance & Accessibility Service Disclosure</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground">2.1 Why We Use Accessibility Services</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">Android Use is designed exclusively to assist users with task automation on their Android devices.</strong> We use Android's Accessibility Service API solely to enable our core functionality: allowing users to automate tasks through natural language commands.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground">2.2 What Accessibility Services Allow Us to Do</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      The Accessibility Service permission allows Android Use to:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Read screen content (text, buttons, UI elements) to understand what actions are available</li>
                      <li>Perform actions on your behalf (tap, swipe, type) when you request automation</li>
                      <li>Navigate between apps to complete multi-step tasks</li>
                      <li>Detect which app is currently active to provide context-aware automation</li>
                    </ul>
                  </div>

                  <div className="bg-background p-4 rounded-lg border border-border">
                    <h3 className="text-lg font-semibold mb-2 text-foreground">2.3 Critical Privacy Commitments</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      <strong className="text-foreground">We make the following commitments regarding accessibility service data:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                      <li><strong className="text-foreground">Only Used for Core Functionality:</strong> Accessibility service data is used ONLY to perform the automation tasks you explicitly request. It is not used for any other purpose.</li>
                      <li><strong className="text-foreground">Not Used for Advertising:</strong> We do NOT use accessibility service data for advertising, analytics, or marketing purposes.</li>
                      <li><strong className="text-foreground">Not Sold or Shared for Profit:</strong> We do NOT sell accessibility service data to third parties or share it for commercial gain.</li>
                      <li><strong className="text-foreground">Active Use Only:</strong> We access screen content ONLY when you actively initiate a task. We do not monitor your device in the background or when the app is not in use.</li>
                      <li><strong className="text-foreground">No Continuous Surveillance:</strong> Android Use does not continuously record, monitor, or track your device usage outside of requested automation tasks.</li>
                      <li><strong className="text-foreground">Temporary Processing:</strong> Screen content and accessibility data are processed temporarily to complete your task and are not permanently stored unless necessary for task execution logs (which you can delete).</li>
                      <li><strong className="text-foreground">User Control:</strong> You can revoke accessibility permissions at any time through Android Settings → Accessibility, which will stop all data collection (though the app will not function without this permission).</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground">2.4 Data Minimization Principle</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We adhere to strict data minimization principles. We collect only the minimum data necessary to perform the specific automation task you request. Once a task is completed, temporary data (screenshots, screen content) is discarded unless you choose to save task history.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground">2.5 Transparency and User Control</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You have complete control over Android Use's access to your device. You can:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground ml-4">
                      <li>View what data is collected in your task history dashboard</li>
                      <li>Delete individual tasks or all task history at any time</li>
                      <li>Revoke accessibility permissions through Android system settings</li>
                      <li>Request complete data deletion by deleting your account</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. Information We Collect</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">3.1 Account Information</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      When you create an account, we collect:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground ml-4">
                      <li>Name and email address</li>
                      <li>Password (encrypted and never stored in plain text)</li>
                      <li>Profile information and preferences you choose to provide</li>
                      <li>OAuth authentication tokens (for Google, GitHub, or Twitter sign-in)</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">3.2 Device Information</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We collect information about your Android device, including:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground ml-4">
                      <li>Device model, manufacturer, and operating system version</li>
                      <li>Unique device identifiers</li>
                      <li>Screen resolution and device capabilities</li>
                      <li>Device status (battery level, network connectivity, orientation)</li>
                      <li>Installed apps and package names (to enable app-specific automations)</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">3.3 Accessibility Service Data</h3>
                    <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg mb-3">
                      <p className="text-foreground leading-relaxed font-semibold mb-2">
                        ⚠️ Important Disclosure: Accessibility Service Usage
                      </p>
                      <p className="text-muted-foreground leading-relaxed text-sm">
                        Android Use requires accessibility service permissions to enable our core functionality - AI-powered task automation. This permission is <strong className="text-foreground">essential and exclusively used</strong> for executing automation tasks you explicitly request. It is NOT used for advertising, unauthorized tracking, or any purpose unrelated to task automation.
                      </p>
                    </div>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      When you grant accessibility service permissions, we collect:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground ml-4">
                      <li><strong>Screen content:</strong> The text, buttons, and UI elements visible on your screen</li>
                      <li><strong>UI hierarchy:</strong> The structure and layout of app interfaces (accessibility tree)</li>
                      <li><strong>Screen context:</strong> Information about which app is active and what actions are possible</li>
                      <li><strong>User interactions:</strong> Taps, swipes, and text input performed through our automation</li>
                    </ul>
                    <p className="text-muted-foreground leading-relaxed mt-3">
                      <strong className="text-foreground">Active use only:</strong> This data is collected <strong>only when you actively use Android Use to perform a task</strong> and is used solely to understand your screen and execute your requested automation. We do not continuously monitor your device, track your activity, or access screen content when the app is not actively performing a task you requested.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">3.4 Screenshots and Visual Data</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      To enable visual AI capabilities, we may capture:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground ml-4">
                      <li>Screenshots of your device screen during task execution</li>
                      <li>Visual overlays showing interactive elements</li>
                      <li>Image data processed by AI models to understand screen content</li>
                    </ul>
                    <p className="text-muted-foreground leading-relaxed mt-2">
                      Screenshots are captured only when necessary to complete your requested task and may be temporarily stored for processing.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">3.5 Task and Command Data</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We collect information about the tasks you request:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground ml-4">
                      <li>Natural language commands and instructions you provide</li>
                      <li>Task execution logs and automation trajectories</li>
                      <li>Success/failure status and error messages</li>
                      <li>Task duration and performance metrics</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">3.6 Skill and Marketplace Data</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      If you use our skill marketplace:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground ml-4">
                      <li>Skill entries you create, view, or contribute</li>
                      <li>App-specific automation guides you access</li>
                      <li>Search queries and browsing activity in the marketplace</li>
                      <li>Ratings, reviews, and feedback you provide</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">3.7 Usage and Analytics Data</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We automatically collect usage information:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground ml-4">
                      <li>App usage patterns, features used, and session duration</li>
                      <li>Error logs, crash reports, and diagnostic information</li>
                      <li>Performance metrics (response times, success rates)</li>
                      <li>IP address, browser type, and access times (for web platform)</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">3.8 Communication Data</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      When you contact us:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground ml-4">
                      <li>Support requests and correspondence</li>
                      <li>Feedback, bug reports, and feature requests</li>
                      <li>Community forum posts and comments</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We use the information we collect for the following purposes:
                </p>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold mb-1">4.1 Provide and Improve Our Services</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Execute AI-powered automation tasks on your device</li>
                      <li>Understand screen content and navigate app interfaces</li>
                      <li>Process natural language commands using AI models</li>
                      <li>Improve automation accuracy and success rates</li>
                      <li>Develop new features and capabilities</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">4.2 Personalization</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Customize automation suggestions based on your usage</li>
                      <li>Recommend relevant skill entries and guides</li>
                      <li>Remember your preferences and frequently used apps</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">4.3 Account Management</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Authenticate and authorize access to your account</li>
                      <li>Manage subscriptions and billing</li>
                      <li>Send account-related notifications and updates</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">4.4 Research and Development</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Train and improve AI models (using aggregated, anonymized data)</li>
                      <li>Analyze usage patterns to identify popular use cases</li>
                      <li>Research and develop new automation capabilities</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">4.5 Safety and Security</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Detect and prevent fraud, abuse, and security threats</li>
                      <li>Monitor for unusual activity and unauthorized access</li>
                      <li>Enforce our Terms of Service and policies</li>
                      <li>Debug and resolve technical issues</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">4.6 Communication</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Respond to support requests and inquiries</li>
                      <li>Send service announcements and updates</li>
                      <li>Provide tips and usage guidance (with your consent)</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">4.7 Legal Compliance</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Comply with legal obligations and regulatory requirements</li>
                      <li>Respond to lawful requests from authorities</li>
                      <li>Protect our rights and defend against legal claims</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Third-Party AI Service Providers</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Android Use uses advanced AI models to understand and execute your tasks. Your task commands, screen content, and related data may be processed by the following third-party AI providers:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li><strong>OpenAI:</strong> GPT-4 and other models for natural language understanding</li>
                  <li><strong>Anthropic:</strong> Claude models for task planning and reasoning</li>
                  <li><strong>Google:</strong> Gemini models for multimodal AI capabilities</li>
                  <li><strong>DeepSeek:</strong> Specialized models for specific automation tasks</li>
                  <li><strong>Other providers:</strong> Additional AI services as we expand capabilities</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  These providers process data in accordance with their own privacy policies. We use enterprise agreements with enhanced data protection where available. We do not authorize these providers to use your data for training their models without your explicit consent.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Information Sharing and Disclosure</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  <strong className="text-foreground">We do not sell your personal information.</strong> We may share your information only in the following limited circumstances:
                </p>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold mb-1">6.1 With Your Consent</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Skill entries you choose to make public in the marketplace</li>
                      <li>Data shared when you explicitly opt in to research programs</li>
                      <li>Information shared with specific services you authorize</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">6.2 Service Providers</h3>
                    <p className="text-muted-foreground leading-relaxed mb-1">
                      We share information with trusted third-party service providers who assist us:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Cloud hosting providers (database, file storage, servers)</li>
                      <li>AI and machine learning providers (as described above)</li>
                      <li>Analytics services (PostHog, Sentry for error tracking)</li>
                      <li>Payment processors (for subscription management)</li>
                      <li>Email and communication services</li>
                    </ul>
                    <p className="text-muted-foreground leading-relaxed mt-1">
                      These providers are contractually obligated to protect your data and use it only for the purposes we specify.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">6.3 Legal Requirements</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We may disclose information if required by law, legal process, or government request, or if we believe disclosure is necessary to:
                    </p>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground ml-4">
                      <li>Comply with legal obligations or court orders</li>
                      <li>Protect our rights, property, or safety</li>
                      <li>Protect the rights, property, or safety of our users or the public</li>
                      <li>Prevent fraud, abuse, or security threats</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">6.4 Business Transfers</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      If Android Use is involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction. We will provide notice and obtain consent if required.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">6.5 Aggregated and Anonymized Data</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We may share aggregated, anonymized, or de-identified data that cannot reasonably be used to identify you for research, analytics, or business purposes.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Data Security</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We implement comprehensive security measures to protect your information:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li><strong>Encryption:</strong> Data in transit is encrypted using TLS/SSL; sensitive data at rest is encrypted</li>
                  <li><strong>Authentication:</strong> JWT tokens with secure storage in Android EncryptedSharedPreferences</li>
                  <li><strong>Access Controls:</strong> Role-based access controls and principle of least privilege</li>
                  <li><strong>Secure Infrastructure:</strong> Cloud hosting with security best practices (VPC, firewalls, monitoring)</li>
                  <li><strong>Regular Audits:</strong> Security assessments and vulnerability scanning</li>
                  <li><strong>Data Minimization:</strong> We collect only data necessary for service functionality</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  However, no method of transmission or storage is 100% secure. While we strive to protect your information using commercially reasonable means, we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Data Retention</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We retain different types of data for varying periods:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li><strong>Account data:</strong> Retained while your account is active and for a reasonable period after deletion</li>
                  <li><strong>Task data:</strong> Execution logs retained for 90 days; anonymized analytics retained longer</li>
                  <li><strong>Screenshots:</strong> Temporary storage during task execution; deleted after processing unless saved by you</li>
                  <li><strong>Accessibility data:</strong> Processed in real-time and not stored except for immediate task execution</li>
                  <li><strong>Skill entries:</strong> Public contributions retained indefinitely; private entries deleted with account</li>
                  <li><strong>Legal data:</strong> Data required for legal compliance retained as legally required</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  When you delete your account, we will delete or anonymize your personal information within 30 days, except where we must retain it for legal, security, or fraud prevention purposes.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Your Rights and Choices</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  You have the following rights regarding your personal information:
                </p>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold mb-1">9.1 Access and Portability</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Request a copy of your personal data in a structured, machine-readable format through your account settings.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">9.2 Correction</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Update or correct your account information, profile, and preferences at any time in your account settings.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">9.3 Deletion</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Request deletion of your account and associated data. You can delete your account in settings or contact us for assistance.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">9.4 Withdraw Consent</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Revoke accessibility permissions or disconnect devices at any time through Android settings or the app.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">9.5 Opt-Out of Communications</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Unsubscribe from marketing emails using the link in emails or through account notification settings.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">9.6 Object to Processing</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Object to certain data processing activities, subject to our legitimate business interests and legal obligations.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">9.7 Restrict Processing</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Request restriction of processing in certain circumstances (e.g., while disputing data accuracy).
                    </p>
                  </div>
                </div>

                <p className="text-muted-foreground leading-relaxed mt-4">
                  To exercise these rights, contact us at privacy@androiduse.com. We will respond to verified requests within 30 days. Certain rights may be limited by local law or legitimate business needs.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Regional Privacy Rights</h2>

                <div className="space-y-3">
                  <div>
                    <h3 className="text-base font-semibold mb-1">10.1 European Economic Area (GDPR)</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      If you are in the EEA, you have additional rights under GDPR, including the right to lodge a complaint with your local data protection authority. Our legal basis for processing includes:
                    </p>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground ml-4">
                      <li>Contract performance (to provide services)</li>
                      <li>Consent (for accessibility data and AI processing)</li>
                      <li>Legitimate interests (for analytics, security, and improvements)</li>
                      <li>Legal compliance</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">10.2 California (CCPA/CPRA)</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      California residents have specific rights under CCPA/CPRA, including the right to know what personal information we collect, the right to delete, and the right to opt-out of sales (though we do not sell personal information).
                    </p>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold mb-1">10.3 Other Jurisdictions</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We comply with applicable data protection laws in all jurisdictions where we operate. Contact us for information specific to your region.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Children's Privacy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Android Use is not intended for children under the age of 13 (or the applicable age in your jurisdiction). We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately at privacy@androiduse.com and we will take steps to delete such information.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">12. International Data Transfers</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws different from those in your country. We ensure appropriate safeguards are in place for international transfers, including:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground ml-4">
                  <li>Standard contractual clauses approved by regulatory authorities</li>
                  <li>Adequacy decisions by competent authorities</li>
                  <li>Your explicit consent where required</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">13. Cookies and Tracking Technologies</h2>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  We use cookies and similar tracking technologies on our web platform:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li><strong>Essential cookies:</strong> Required for authentication and core functionality</li>
                  <li><strong>Analytics cookies:</strong> Help us understand usage patterns (PostHog, Sentry)</li>
                  <li><strong>Preference cookies:</strong> Remember your settings and preferences</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-2">
                  You can control cookies through your browser settings. Disabling certain cookies may limit functionality.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">14. Changes to This Privacy Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of material changes by:
                </p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground ml-4">
                  <li>Posting the updated policy on this page with a new "Last updated" date</li>
                  <li>Sending an email notification to your registered email address</li>
                  <li>Providing an in-app notification</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-2">
                  Your continued use of Android Use after changes become effective constitutes acceptance of the updated policy.
                </p>
              </section>

              <section className="border-l-4 border-primary pl-6 bg-primary/5 p-6 rounded-r-lg">
                <h2 className="text-2xl font-semibold mb-4">15. Google Play Data Safety Declaration</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  In compliance with Google Play Store requirements, we provide the following Data Safety information that aligns with our Play Store listing:
                </p>

                <div className="space-y-4">
                  <div className="bg-background p-4 rounded-lg border border-border">
                    <h3 className="text-lg font-semibold mb-2 text-foreground">Data Collection Summary</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="font-semibold text-sm text-foreground mb-1">Personal Information</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                          <li>Name, email address (for account creation)</li>
                          <li>User ID (generated)</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground mb-1">App Activity</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                          <li>App interactions (tasks you request)</li>
                          <li>In-app search history (marketplace searches)</li>
                          <li>User-generated content (skill entries)</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-foreground mb-1">Device or Other IDs</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground ml-4">
                          <li>Device identifiers (for authentication and service provision)</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-background p-4 rounded-lg border border-border">
                    <h3 className="text-lg font-semibold mb-2 text-foreground">Data Usage Purposes</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li><strong className="text-foreground">App functionality:</strong> Primary purpose - to execute automation tasks you request</li>
                      <li><strong className="text-foreground">Analytics:</strong> To understand app performance and improve features</li>
                      <li><strong className="text-foreground">Developer communications:</strong> To send service updates and respond to support requests</li>
                      <li><strong className="text-foreground">Account management:</strong> To maintain your account and preferences</li>
                    </ul>
                  </div>

                  <div className="bg-background p-4 rounded-lg border border-border">
                    <h3 className="text-lg font-semibold mb-2 text-foreground">Data Security Practices</h3>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li><strong className="text-foreground">Data encryption in transit:</strong> All data is encrypted using TLS/HTTPS</li>
                      <li><strong className="text-foreground">Data encryption at rest:</strong> Sensitive data is encrypted when stored</li>
                      <li><strong className="text-foreground">You can request data deletion:</strong> Account and data can be deleted through app settings or by contacting us</li>
                    </ul>
                  </div>

                  <div className="bg-background p-4 rounded-lg border border-destructive/50">
                    <h3 className="text-lg font-semibold mb-2 text-foreground">Accessibility Service Usage Declaration</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      <strong className="text-foreground">This app uses Accessibility Services for the following purposes:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                      <li><strong className="text-foreground">Core Feature:</strong> Accessibility services enable the primary functionality of our app - AI-powered task automation on behalf of the user.</li>
                      <li><strong className="text-foreground">User-Initiated Only:</strong> The accessibility service is activated only when users explicitly request task automation. It does not run in the background or monitor activity when not in active use.</li>
                      <li><strong className="text-foreground">Screen Reading:</strong> We read screen content to understand what actions are available and execute user commands.</li>
                      <li><strong className="text-foreground">Action Performance:</strong> We perform gestures (tap, swipe, type) on behalf of users to complete their requested tasks.</li>
                      <li><strong className="text-foreground">No Unauthorized Use:</strong> Accessibility service data is NOT used for advertising, analytics unrelated to task execution, or any purpose other than performing the automation tasks you request.</li>
                      <li><strong className="text-foreground">Compliance:</strong> Our use of accessibility services complies with Android's Accessibility Service policies and is essential for our app's core functionality.</li>
                    </ul>
                  </div>

                  <div className="bg-background p-4 rounded-lg border border-border">
                    <h3 className="text-lg font-semibold mb-2 text-foreground">Third-Party Data Sharing</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      We share data with third parties only for the following purposes:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li><strong className="text-foreground">App functionality:</strong> AI service providers (OpenAI, Anthropic, Google) process task requests</li>
                      <li><strong className="text-foreground">Analytics:</strong> PostHog, Sentry for performance monitoring and error tracking</li>
                      <li><strong className="text-foreground">Infrastructure:</strong> Cloud hosting providers for data storage and processing</li>
                    </ul>
                    <p className="text-muted-foreground leading-relaxed mt-2">
                      <strong className="text-foreground">We do NOT sell user data to third parties.</strong>
                    </p>
                  </div>

                  <div className="bg-green-500/10 p-4 rounded-lg border border-green-500/30">
                    <h3 className="text-lg font-semibold mb-2 text-foreground">Data Not Collected</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      The following types of data are <strong className="text-foreground">NOT collected</strong> by Android Use:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Photos and videos (except temporary screenshots for task execution)</li>
                      <li>Audio files or voice recordings</li>
                      <li>Music files</li>
                      <li>Files and documents (except task-related data you explicitly provide)</li>
                      <li>Calendar events</li>
                      <li>Contacts</li>
                      <li>SMS or call logs</li>
                      <li>Health and fitness data</li>
                      <li>Financial information or payment details (handled by third-party payment processors)</li>
                      <li>Location data (we do not track your physical location)</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">16. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
                </p>
                <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                  <p className="text-muted-foreground">
                    <strong>Privacy Team</strong>
                  </p>
                  <p className="text-muted-foreground">
                    <strong>Email:</strong> privacy@androiduse.com
                  </p>
                  <p className="text-muted-foreground">
                    <strong>Data Protection Officer:</strong> dpo@androiduse.com
                  </p>
                  <p className="text-muted-foreground">
                    <strong>Support:</strong> support@androiduse.com
                  </p>
                </div>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  We will respond to all verified requests within 30 days or as required by applicable law.
                </p>
              </section>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

