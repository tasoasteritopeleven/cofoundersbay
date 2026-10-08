'use client';

import Link from 'next/link';
import { FileText, ArrowLeft, Shield, Users, MessageCircle, Scale, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LegalText } from '@/components/common/LegalText';
import { BilingualText } from '@/components/common/BilingualText';
import { MainLandmark } from '@/components/layout/AppShell';

const LAST_UPDATED = 'March 20, 2026';
const LAST_UPDATED_EL = '20 Μαρτίου 2026';

const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    icon: CheckCircle,
    content: `By accessing or using CoFounderBay ("the Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Platform.

These Terms constitute a legally binding agreement between you and CoFounderBay. We reserve the right to modify these Terms at any time. Continued use of the Platform after any modifications constitutes acceptance of the updated Terms.`,
  },
  {
    id: 'eligibility',
    title: '2. Eligibility',
    icon: Users,
    content: `To use CoFounderBay, you must:
• Be at least 18 years of age
• Have the legal capacity to enter into a binding agreement
• Not be prohibited from using the Platform under applicable laws
• Provide accurate and complete registration information

By using the Platform, you represent and warrant that you meet all eligibility requirements.`,
  },
  {
    id: 'accounts',
    title: '3. User Accounts',
    icon: Shield,
    content: `When you create an account, you agree to:
• Provide accurate, current, and complete information
• Maintain the security of your password and account
• Promptly update your information if it changes
• Accept responsibility for all activities under your account
• Notify us immediately of any unauthorized access

We reserve the right to suspend or terminate accounts that violate these Terms or engage in fraudulent activity.`,
  },
  {
    id: 'conduct',
    title: '4. User Conduct',
    icon: Scale,
    content: `You agree not to:
• Violate any applicable laws or regulations
• Impersonate any person or entity
• Harass, abuse, or harm other users
• Post false, misleading, or defamatory content
• Spam or send unsolicited communications
• Attempt to gain unauthorized access to the Platform
• Use the Platform for any illegal or unauthorized purpose
• Interfere with the proper functioning of the Platform
• Scrape, data mine, or collect user information without consent

Violations may result in immediate account termination.`,
  },
  {
    id: 'content',
    title: '5. User Content',
    icon: MessageCircle,
    content: `You retain ownership of content you post on CoFounderBay. By posting content, you grant us a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content in connection with the Platform.

You are solely responsible for your content and represent that:
• You own or have the right to post the content
• The content does not violate any third-party rights
• The content complies with these Terms and applicable laws

We may remove content that violates these Terms without notice.`,
  },
  {
    id: 'intellectual-property',
    title: '6. Intellectual Property',
    icon: FileText,
    content: `The Platform and its original content, features, and functionality are owned by CoFounderBay and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.

You may not copy, modify, distribute, sell, or lease any part of the Platform without our prior written consent.`,
  },
  {
    id: 'disclaimers',
    title: '7. Disclaimers',
    icon: AlertTriangle,
    content: `THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT GUARANTEE:
• The accuracy or completeness of any information
• That the Platform will be uninterrupted or error-free
• The results of any connections or collaborations
• The conduct or reliability of other users

You use the Platform at your own risk. We are not responsible for any decisions you make based on information obtained through the Platform.`,
  },
  {
    id: 'limitation',
    title: '8. Limitation of Liability',
    icon: Scale,
    content: `TO THE MAXIMUM EXTENT PERMITTED BY LAW, COFOUNDERBAY SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR GOODWILL.

Our total liability for any claims arising from your use of the Platform shall not exceed the amount you paid us in the twelve (12) months preceding the claim.`,
  },
  {
    id: 'termination',
    title: '9. Termination',
    icon: AlertTriangle,
    content: `We may terminate or suspend your account and access to the Platform immediately, without prior notice, for any reason, including:
• Violation of these Terms
• Fraudulent or illegal activity
• Conduct harmful to other users or the Platform
• At our sole discretion

Upon termination, your right to use the Platform ceases immediately. Provisions that by their nature should survive termination shall survive.`,
  },
  {
    id: 'governing-law',
    title: '10. Governing Law',
    icon: Scale,
    content: `These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which CoFounderBay is incorporated, without regard to conflict of law principles.

Any disputes arising from these Terms or your use of the Platform shall be resolved through binding arbitration, except where prohibited by law.`,
  },
  {
    id: 'contact',
    title: '11. Contact Information',
    icon: MessageCircle,
    content: `If you have any questions about these Terms, please contact us at:

Email: legal@cofounderbay.com
Address: CoFounderBay Legal Department

We will respond to inquiries within a reasonable timeframe.`,
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="icon-sm" />
            {/* "CoFounderBay" alone on a phone, so the bar keeps one line. */}
            <span className="text-sm font-medium"><span className="hidden sm:inline">Back to </span>CoFounderBay</span>
          </Link>
          <div className="flex min-w-0 items-center gap-0.5 sm:gap-3">
            <Button variant="ghost" size="sm" className="min-w-0 whitespace-nowrap px-2 text-xs sm:px-3" asChild>
              <Link href="/privacy"><BilingualText en="Privacy Policy" el="Πολιτική απορρήτου" compact /></Link>
            </Button>
            <Button variant="ghost" size="sm" className="min-w-0 whitespace-nowrap px-2 text-xs sm:px-3" asChild>
              <Link href="/help"><BilingualText en="Help Center" el="Κέντρο βοήθειας" compact /></Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-4xl px-4 py-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <FileText className="h-7 w-7 text-primary-accessible" />
          </div>
          <h1 className="text-3xl font-semibold text-foreground mb-2"><BilingualText en="Terms of Service" el="Όροι χρήσης" compact /></h1>
          <p className="text-muted-foreground">
            <BilingualText en={`Last updated: ${LAST_UPDATED}`} el={`Τελευταία ενημέρωση: ${LAST_UPDATED_EL}`} compact />
          </p>
          {/* Legal text is not machine-translated: a paraphrase could promise something the policy does not. */}
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            <BilingualText en="These terms are written in English; the English text is the version that applies." el="Οι παρακάτω όροι είναι γραμμένοι στα Αγγλικά· ισχύει το αγγλικό κείμενο." keepSecondaryOnMobile wrap />
          </p>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4"><BilingualText en="Table of Contents" el="Περιεχόμενα" compact /></h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <section.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{section.title}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <MainLandmark className="mx-auto max-w-4xl px-4 py-12">
        <div className="space-y-12">
          {sections.map((section) => (
            <Card key={section.id} id={section.id} className="scroll-mt-20 border-border">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <section.icon className="h-4 w-4 text-primary-accessible" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground pt-1">{section.title}</h2>
                </div>
                <LegalText content={section.content} />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 rounded-xl border border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            <BilingualText en="By using CoFounderBay, you acknowledge that you have read and agree to these Terms of Service." el="Χρησιμοποιώντας το CoFounderBay, δηλώνετε ότι διαβάσατε και αποδέχεστε αυτούς τους όρους χρήσης." wrap />
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/privacy"><BilingualText en="Read Privacy Policy" el="Διαβάστε την πολιτική απορρήτου" compact /></Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register"><BilingualText en="Create Account" el="Δημιουργία λογαριασμού" compact /></Link>
            </Button>
          </div>
        </div>
      </MainLandmark>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-4xl px-4 py-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} CoFounderBay. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
