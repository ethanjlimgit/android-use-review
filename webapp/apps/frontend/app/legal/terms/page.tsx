import { Navigation } from "@/components/navigation";
import { Card, CardContent } from "@droiduse/shared-ui/card";
import type { Metadata } from "next";
import { getSiteName } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getSiteName();
  const description = `Read the ${siteName} Terms of Use. Understand the terms governing your use of our AI-powered Android automation platform.`;

  return {
    title: `Terms of Use - ${siteName}`,
    description,
    openGraph: {
      title: `Terms of Use - ${siteName}`,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `Terms of Use - ${siteName}`,
      description,
    },
  };
}

export default function TermsPage() {
  return (
    <>
      <Navigation />
      <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-4xl font-bold tracking-tight mb-4">Terms of Use</h1>
            <p className="text-muted-foreground">
              Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          <Card>
            <CardContent className="p-8 space-y-6">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Welcome to Android Use. These Terms of Use ("Terms," "Agreement") constitute a legally binding agreement between you ("User," "you," or "your") and Android Use ("we," "us," or "our") governing your access to and use of the Android Use mobile application, web platform, and related services (collectively, the "Service").
                </p>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  <strong className="text-foreground">By creating an account, installing our mobile application, or using any part of the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.</strong> If you do not agree with these Terms, you must not use the Service.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms apply to all users of the Service, including visitors, registered users, and contributors to our skill marketplace.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Android Use is an AI-powered mobile automation assistant that enables users to accomplish tasks on their Android devices using natural language commands. The Service includes:
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                  <li><strong>Mobile Application:</strong> An Android app that uses accessibility services to read screen content and perform actions on your behalf</li>
                  <li><strong>AI Agent System:</strong> Artificial intelligence models that understand your requests and plan multi-step automation workflows</li>
                  <li><strong>Web Platform:</strong> A dashboard for managing devices, viewing task history, and accessing settings</li>
                  <li><strong>Skill Marketplace:</strong> A community-driven repository of app-specific automation guides and workflows</li>
                  <li><strong>Backend Services:</strong> Cloud infrastructure that processes requests, coordinates AI models, and manages data</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  The Service leverages Android accessibility APIs, AI language models, computer vision, and automation technologies to understand your device screen and execute tasks ranging from simple actions (sending messages, setting reminders) to complex workflows (multi-step research, data entry, app navigation).
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. Eligibility and Account Requirements</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">3.1 Age Requirements</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You must be at least 13 years old to use the Service. If you are between 13 and 18 years old (or the age of majority in your jurisdiction), you may only use the Service with the consent and supervision of a parent or legal guardian. By using the Service, you represent that you meet these age requirements.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">3.2 Account Registration</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      To use the Service, you must create an account. You agree to:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Provide accurate, current, and complete registration information</li>
                      <li>Maintain and promptly update your account information</li>
                      <li>Maintain the security and confidentiality of your login credentials</li>
                      <li>Notify us immediately of any unauthorized use of your account</li>
                      <li>Accept responsibility for all activities that occur under your account</li>
                      <li>Use only one account per person (no multiple or shared accounts)</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">3.3 Account Security</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You are solely responsible for maintaining the confidentiality of your password and account. We recommend using a strong, unique password and enabling two-factor authentication if available. You agree not to share your account credentials with others or allow others to access your account.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">3.4 Account Suspension and Termination</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      You may terminate your account at any time through your account settings. We reserve the right to suspend or terminate your account, with or without notice, if you:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Violate these Terms or our policies</li>
                      <li>Engage in fraudulent, abusive, or illegal activities</li>
                      <li>Pose a security risk to the Service or other users</li>
                      <li>Provide false or misleading information</li>
                      <li>Attempt to circumvent usage limits or payment obligations</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Permissions and Accessibility Services</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">4.1 Required Permissions</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      <strong className="text-foreground">The Android Use mobile app requires Android Accessibility Service permissions to function.</strong> By granting these permissions, you authorize the Service to:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Observe and read the content displayed on your screen</li>
                      <li>Retrieve window content and UI hierarchy information</li>
                      <li>Perform actions such as tapping, swiping, and text input on your behalf</li>
                      <li>Detect which apps are currently active</li>
                      <li>Receive notifications about screen changes and events</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">4.2 Scope of Access</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      The Service accesses screen content <strong>only when you actively request an automation task</strong>. We do not continuously monitor your device or collect data when you are not using Android Use. You may revoke accessibility permissions at any time through Android system settings, though this will prevent the Service from functioning.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">4.3 Additional Permissions</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      Depending on your tasks, the Service may request additional permissions:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Overlay permission (to display visual indicators)</li>
                      <li>Network access (to communicate with our servers)</li>
                      <li>Storage access (to save screenshots or files)</li>
                      <li>Notification access (to read or send notifications)</li>
                    </ul>
                    <p className="text-muted-foreground leading-relaxed mt-2">
                      You may deny optional permissions, but certain features may not be available.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">4.4 Responsible Use of Permissions</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You acknowledge that accessibility permissions are powerful and sensitive. You agree to use these permissions responsibly and not to abuse the Service to access unauthorized content, bypass security measures, or violate the rights of others.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. AI Processing and Third-Party Services</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">5.1 AI Model Providers</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      The Service uses artificial intelligence models from third-party providers including OpenAI, Anthropic, Google, and DeepSeek to process your commands and screen content. By using the Service, you acknowledge and consent to:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Your task requests being sent to these AI providers for processing</li>
                      <li>Screenshots and screen content being analyzed by AI models</li>
                      <li>Natural language commands being processed to understand your intent</li>
                      <li>Data processing in accordance with our Privacy Policy and the AI providers' terms</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">5.2 AI Limitations and Accuracy</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">AI-powered automation is not perfect.</strong> You acknowledge that the Service may occasionally misinterpret commands, make errors, or produce unexpected results. You are responsible for reviewing and verifying all automated actions, especially those involving sensitive data, financial transactions, or important communications.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">5.3 Third-Party App Integration</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Android Use automates interactions with third-party apps installed on your device. We are not affiliated with, endorsed by, or responsible for these third-party apps. You are responsible for complying with the terms of service of any third-party apps you automate using our Service.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Acceptable Use and Prohibited Activities</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">6.1 Permitted Uses</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      You may use the Service to:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Automate repetitive tasks on your own Android devices</li>
                      <li>Accomplish legitimate personal or business tasks</li>
                      <li>Create and share skill entries to help others</li>
                      <li>Use the Service in accordance with all applicable laws</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">6.2 Prohibited Activities</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      <strong className="text-foreground">You agree NOT to use the Service to:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
                      <li><strong>Violate Laws:</strong> Engage in any illegal activities, including fraud, harassment, copyright infringement, or unauthorized access to systems</li>
                      <li><strong>Abuse Third-Party Services:</strong> Violate the terms of service of third-party apps, create fake accounts, spam, scrape data without authorization, or manipulate social media metrics</li>
                      <li><strong>Bypass Security:</strong> Circumvent authentication, break CAPTCHAs, defeat rate limits, or attempt to hack or exploit vulnerabilities</li>
                      <li><strong>Harm Others:</strong> Harass, threaten, impersonate, or violate the privacy of others; spread misinformation or malicious content</li>
                      <li><strong>Abuse the Service:</strong> Reverse engineer our software, attempt to access others' accounts, create multiple accounts to evade bans, or interfere with Service operations</li>
                      <li><strong>Commercial Abuse:</strong> Resell the Service, use it for high-volume automated operations without authorization, or compete with our business</li>
                      <li><strong>Harmful Automation:</strong> Automate sending spam, creating fake reviews, manipulating online voting, bulk account creation, or any deceptive practices</li>
                      <li><strong>Financial Fraud:</strong> Use the Service for unauthorized financial transactions, money laundering, or fraudulent activities</li>
                      <li><strong>Data Harvesting:</strong> Scrape, collect, or harvest user data without proper authorization or in violation of privacy laws</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">6.3 Monitoring and Enforcement</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We reserve the right to monitor usage patterns to detect abuse. If we detect violations, we may suspend or terminate your account, report illegal activities to authorities, and seek legal remedies.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Device Control and Automation Responsibilities</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">7.1 User Responsibility</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">You are solely responsible for all actions performed by Android Use on your devices.</strong> This includes any messages sent, purchases made, data entered, settings changed, or other actions taken by the AI agent on your behalf.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">7.2 Authorization</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You represent and warrant that you have the legal right to control and automate actions on any device you connect to the Service. You must not connect devices owned by others without their explicit permission.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">7.3 Review and Verification</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You acknowledge that automated actions may have significant consequences. You are responsible for reviewing task execution, verifying outcomes, and taking corrective action if errors occur. For critical or sensitive tasks, you should review actions before they are executed.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">7.4 No Liability for Automation</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We are not liable for any damage, loss, or consequences resulting from automated actions, including but not limited to incorrect messages sent, unauthorized purchases, data loss, account suspensions, or other harm arising from AI-generated actions.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">7.5 Device and Data Safety</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We recommend maintaining backups of important data and using the Service responsibly. We are not responsible for any data loss, device damage, or other harm that may result from using automation features.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. User Content and Skill Marketplace</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">8.1 User-Generated Content</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      You may contribute content to the Service, including skill entries, automation guides, reviews, and feedback. You retain ownership of your content, but grant us certain rights to use it.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">8.2 License Grant</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      By submitting content to the Service, you grant Android Use a worldwide, non-exclusive, royalty-free, perpetual, transferable, sublicensable license to use, reproduce, modify, adapt, publish, translate, create derivative works from, distribute, publicly display, and publicly perform your content for the purposes of operating, promoting, and improving the Service.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">8.3 Content Representations</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      By submitting content, you represent and warrant that:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>You own or have the necessary rights to the content</li>
                      <li>The content does not infringe any intellectual property or other rights of third parties</li>
                      <li>The content is accurate, not misleading, and complies with these Terms</li>
                      <li>The content does not contain malicious code, viruses, or harmful instructions</li>
                      <li>The content does not violate any applicable laws or regulations</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">8.4 Content Moderation</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We reserve the right (but not the obligation) to review, edit, refuse to publish, or remove any content that violates these Terms, is harmful, illegal, or otherwise objectionable at our sole discretion. We may also remove content that receives excessive complaints or negative reports from users.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">8.5 Community Guidelines</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">
                      When contributing to the skill marketplace, you agree to:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                      <li>Provide accurate, helpful, and safe automation guides</li>
                      <li>Respect intellectual property rights of apps and services</li>
                      <li>Not share guides that facilitate prohibited activities</li>
                      <li>Be respectful and constructive in reviews and feedback</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Intellectual Property Rights</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">9.1 Our Intellectual Property</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      The Service and its original content, features, functionality, software, designs, graphics, user interface, and underlying technology are owned by Android Use and protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">9.2 Limited License to Use</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal or internal business purposes. You may not copy, modify, distribute, sell, lease, reverse engineer, decompile, or create derivative works of the Service or its components.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">9.3 Trademarks</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      "Android Use" and our logos are trademarks or registered trademarks of Android Use. You may not use our trademarks without our prior written permission. Android™ is a trademark of Google LLC.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">9.4 Copyright Infringement</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We respect intellectual property rights. If you believe content on our Service infringes your copyright, please contact us at legal@androiduse.com with details including: (1) description of copyrighted work, (2) location of infringing content, (3) your contact information, and (4) a statement of good faith belief that the use is unauthorized.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Subscription, Payments, and Refunds</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">10.1 Pricing and Plans</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We offer various subscription plans with different features and usage limits. Pricing is displayed on our website and may change with notice. You agree to pay all fees associated with your selected plan.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">10.2 Billing and Renewal</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Subscriptions automatically renew at the end of each billing period unless you cancel. You authorize us to charge your payment method for recurring fees. You are responsible for maintaining valid payment information.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">10.3 Cancellation</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of the current billing period. You will retain access to paid features until the end of the paid period.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">10.4 Refunds</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Refunds are generally not provided for partial months or unused portions of subscriptions. We may provide refunds at our discretion for technical issues, billing errors, or other exceptional circumstances. Contact support@androiduse.com to request a refund.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">10.5 Free Trials</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We may offer free trials for certain plans. If you do not cancel before the trial ends, you will be automatically charged for a paid subscription. We reserve the right to limit free trial eligibility.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Privacy and Data Protection</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  Your privacy is important to us. Our collection, use, and protection of your personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the Service, you consent to our data practices as described in the Privacy Policy.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Please review our Privacy Policy carefully to understand how we collect accessibility data, process screen content with AI, share information with third-party providers, and protect your information. You can access the Privacy Policy at /legal/privacy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">12. Service Availability and Modifications</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">12.1 Service Availability</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We strive to provide reliable service but do not guarantee uninterrupted or error-free access. The Service may be unavailable due to maintenance, updates, technical issues, or factors beyond our control. We are not liable for any unavailability or service interruptions.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">12.2 Service Modifications</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time, with or without notice. We may add or remove features, change pricing, or alter functionality. We are not liable for any modifications or discontinuation of the Service.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">12.3 Beta Features</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We may offer beta, experimental, or preview features marked as such. These features are provided "as is" without warranties and may be unstable, change frequently, or be discontinued. You use beta features at your own risk.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">12.4 Third-Party Dependencies</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      The Service relies on third-party services (AI providers, cloud infrastructure, app integrations). Changes or disruptions to these third-party services may affect our Service. We are not responsible for third-party service availability or changes.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">13. Disclaimers and Warranties</h2>

                <div className="space-y-3">
                  <p className="text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.</strong>
                  </p>

                  <p className="text-muted-foreground leading-relaxed">
                    TO THE MAXIMUM EXTENT PERMITTED BY LAW, ANDROID USE DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
                  </p>

                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                    <li>IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT</li>
                    <li>WARRANTIES THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE</li>
                    <li>WARRANTIES REGARDING THE ACCURACY, RELIABILITY, OR COMPLETENESS OF CONTENT OR RESULTS</li>
                    <li>WARRANTIES THAT DEFECTS WILL BE CORRECTED OR THAT THE SERVICE IS FREE OF VIRUSES OR HARMFUL COMPONENTS</li>
                  </ul>

                  <p className="text-muted-foreground leading-relaxed">
                    YOU ACKNOWLEDGE THAT:
                  </p>

                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                    <li>AI-POWERED AUTOMATION MAY PRODUCE ERRORS, UNEXPECTED RESULTS, OR UNINTENDED CONSEQUENCES</li>
                    <li>THE SERVICE MAY NOT WORK WITH ALL APPS, DEVICES, OR USE CASES</li>
                    <li>ACCESSIBILITY SERVICES MAY BE LIMITED OR RESTRICTED BY ANDROID SYSTEM UPDATES OR APP CHANGES</li>
                    <li>YOUR USE OF THE SERVICE IS AT YOUR SOLE RISK</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">14. Limitation of Liability</h2>

                <div className="space-y-3">
                  <p className="text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, ANDROID USE AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, AFFILIATES, AND LICENSORS SHALL NOT BE LIABLE FOR ANY DAMAGES ARISING FROM YOUR USE OF THE SERVICE.</strong>
                  </p>

                  <p className="text-muted-foreground leading-relaxed">
                    THIS LIMITATION APPLIES TO ALL TYPES OF DAMAGES, INCLUDING:
                  </p>

                  <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                    <li>DIRECT, INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, EXEMPLARY, OR PUNITIVE DAMAGES</li>
                    <li>LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES</li>
                    <li>DAMAGES RESULTING FROM UNAUTHORIZED ACCESS, DATA BREACHES, OR SECURITY INCIDENTS</li>
                    <li>DAMAGES FROM ERRORS, MISTAKES, OR INACCURACIES IN AUTOMATED ACTIONS</li>
                    <li>DAMAGES FROM SERVICE INTERRUPTIONS, MODIFICATIONS, OR TERMINATION</li>
                    <li>DAMAGES FROM THIRD-PARTY CONDUCT OR CONTENT</li>
                    <li>DAMAGES FROM DEVICE MALFUNCTIONS, DATA LOSS, OR OTHER TECHNICAL ISSUES</li>
                  </ul>

                  <p className="text-muted-foreground leading-relaxed">
                    THIS LIMITATION APPLIES EVEN IF ANDROID USE HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES AND REGARDLESS OF THE LEGAL THEORY (CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, OR OTHERWISE).
                  </p>

                  <p className="text-muted-foreground leading-relaxed">
                    IN JURISDICTIONS THAT DO NOT ALLOW THE EXCLUSION OR LIMITATION OF LIABILITY, OUR LIABILITY SHALL BE LIMITED TO THE MAXIMUM EXTENT PERMITTED BY LAW. IN NO EVENT SHALL OUR TOTAL LIABILITY EXCEED THE AMOUNT YOU PAID TO US IN THE 12 MONTHS PRECEDING THE CLAIM, OR $100 USD, WHICHEVER IS GREATER.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">15. Indemnification</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  You agree to defend, indemnify, and hold harmless Android Use and its officers, directors, employees, agents, affiliates, licensors, and service providers from and against any claims, liabilities, damages, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising from or relating to:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Your use or misuse of the Service</li>
                  <li>Your violation of these Terms or any applicable laws</li>
                  <li>Your violation of any rights of third parties, including intellectual property, privacy, or other rights</li>
                  <li>Content you submit or actions you automate through the Service</li>
                  <li>Unauthorized access to your account due to your failure to secure credentials</li>
                  <li>Any actions taken by AI agents on your behalf</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  We reserve the right to assume exclusive defense and control of any matter subject to indemnification, and you agree to cooperate with our defense of such claims.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">16. Dispute Resolution and Arbitration</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">16.1 Informal Resolution</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Before initiating formal proceedings, you agree to contact us at legal@androiduse.com to attempt to resolve the dispute informally. We will attempt to resolve disputes in good faith for at least 30 days.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">16.2 Binding Arbitration</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      If informal resolution fails, disputes shall be resolved through binding arbitration rather than in court, except that you may assert claims in small claims court if they qualify. Arbitration will be conducted by a neutral arbitrator in accordance with applicable arbitration rules.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">16.3 Class Action Waiver</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">You and Android Use agree that disputes will be resolved on an individual basis only.</strong> You waive any right to participate in class actions, class arbitrations, or representative actions. Each party may only bring claims against the other in an individual capacity.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">16.4 Exceptions</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Either party may seek injunctive or equitable relief in court to protect intellectual property rights or prevent unauthorized use of the Service.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">17. Governing Law and Jurisdiction</h2>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. To the extent arbitration does not apply, you agree to submit to the exclusive jurisdiction of the state and federal courts located in Delaware for resolution of any disputes.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">18. Export Compliance</h2>
                <p className="text-muted-foreground leading-relaxed">
                  The Service may be subject to U.S. export control laws and regulations. You agree to comply with all applicable export and re-export restrictions and not to use the Service in violation of any embargo or trade sanction. You represent that you are not located in a country subject to U.S. embargo and are not on any U.S. government list of prohibited or restricted parties.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">19. Miscellaneous Provisions</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">19.1 Entire Agreement</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      These Terms, together with our Privacy Policy, constitute the entire agreement between you and Android Use regarding the Service and supersede all prior agreements and understandings.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">19.2 Severability</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions will remain in full force and effect. The invalid provision will be modified to the minimum extent necessary to make it valid and enforceable.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">19.3 Waiver</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Our failure to enforce any right or provision of these Terms does not constitute a waiver of such right or provision. Any waiver must be in writing and signed by an authorized representative.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">19.4 Assignment</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      You may not assign or transfer these Terms or your account without our prior written consent. We may assign or transfer our rights and obligations without restriction.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">19.5 Force Majeure</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      We are not liable for any failure or delay in performance due to circumstances beyond our reasonable control, including acts of God, natural disasters, war, terrorism, labor disputes, or third-party service outages.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">19.6 Survival</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      Provisions that by their nature should survive termination (including disclaimers, limitations of liability, indemnification, and dispute resolution) will remain in effect after termination of these Terms.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">20. Changes to Terms</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We reserve the right to modify or update these Terms at any time. If we make material changes, we will:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Post the updated Terms on this page with a new "Last updated" date</li>
                  <li>Send email notification to your registered email address</li>
                  <li>Provide in-app notification of the changes</li>
                  <li>Provide at least 30 days notice before material changes take effect</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-3">
                  <strong className="text-foreground">Your continued use of the Service after changes take effect constitutes acceptance of the updated Terms.</strong> If you do not agree with the changes, you must stop using the Service and may request account deletion.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">21. Contact Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  If you have questions, concerns, or feedback about these Terms of Use, please contact us:
                </p>
                <div className="mt-4 p-4 bg-muted rounded-lg space-y-2">
                  <p className="text-muted-foreground">
                    <strong>Legal Department</strong>
                  </p>
                  <p className="text-muted-foreground">
                    <strong>Email:</strong> legal@androiduse.com
                  </p>
                  <p className="text-muted-foreground">
                    <strong>Support:</strong> support@androiduse.com
                  </p>
                  <p className="text-muted-foreground">
                    <strong>General Inquiries:</strong> hello@androiduse.com
                  </p>
                </div>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  We will respond to inquiries within a reasonable timeframe.
                </p>
              </section>

              <section className="mt-8 p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Acknowledgment:</strong> By creating an account or using Android Use, you acknowledge that you have read, understood, and agree to be bound by these Terms of Use and our Privacy Policy. You confirm that you meet the age requirements, have the authority to enter into this agreement, and will use the Service in compliance with all applicable laws and regulations.
                </p>
              </section>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

