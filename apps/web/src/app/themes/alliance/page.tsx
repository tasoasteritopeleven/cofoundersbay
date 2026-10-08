'use client';

export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  Briefcase,
  Calendar,
  TrendingUp,
  MessageSquare,
  Heart,
  Share2,
  ChevronRight,
  Star,
  MapPin,
  Building,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { MainLandmark } from '@/components/layout/AppShell';

/**
 * Four different people from the demo world, so the specimen shows how the
 * theme treats varied names, roles and tags - four copies of one card showed
 * nothing but the card.
 */
const SPECIMEN = [
  { name: 'Elena Papadopoulos', role: 'Founder & CEO at Harbor', badge: 'Founder', pitch: 'Building the operating system for early-stage founders. Looking for a technical cofounder.', tags: ['SaaS', 'Product', 'Seed'], place: 'Athens, Greece', sector: 'Software', banner: 'from-blue-500 via-indigo-500 to-violet-500' },
  { name: 'Marcus Chen', role: 'Technical cofounder · Full-stack', badge: 'Builder', pitch: 'Ships MVPs in weeks. Looking for a complementary business founder.', tags: ['TypeScript', 'AI', 'Developer tools'], place: 'Berlin, Germany', sector: 'Developer tools', banner: 'from-cyan-500 via-sky-500 to-blue-600' },
  { name: 'Dr. Sarah Kim', role: 'Startup mentor · Ex-Google · 3x founder', badge: 'Mentor', pitch: 'Helping first-time founders reach product-market fit.', tags: ['Go-to-market', 'Leadership', 'Mentoring'], place: 'London, UK', sector: 'Marketplaces', banner: 'from-emerald-500 via-teal-500 to-cyan-600' },
  { name: 'Nikos Andreou', role: 'Angel investor · Seed', badge: 'Investor', pitch: 'Invests in Mediterranean B2B SaaS at pre-seed and seed.', tags: ['B2B', 'SaaS', 'Pre-seed'], place: 'Limassol, Cyprus', sector: 'Venture', banner: 'from-amber-500 via-orange-500 to-rose-500' },
] as const;

export default function AllianceThemePage() {
  const [activeTab, setActiveTab] = useState('discover');

  // A preview of a third-party theme, drawn as that theme draws it: its icons stay.
  return (
    <MainLandmark data-keep-icon="" className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="alliance-hero relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
              <Sparkles className="icon-sm" />
              <span className="text-sm font-medium"><BilingualText en="Alliance theme preview · sample content" el="Προεπισκόπηση θέματος Alliance · δείγμα περιεχομένου" wrap /></span>
            </div>
            <h1 className="text-4xl font-semibold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-100">
              <BilingualText en="Connect. Collaborate. Succeed." el="Συνδεθείτε. Συνεργαστείτε. Πετύχετε." compact wrap />
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              <BilingualText en="Join the premier network for startup founders, investors, and innovators" el="Μπείτε στο δίκτυο για ιδρυτές startups, επενδυτές και καινοτόμους" wrap />
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" className="bg-white text-slate-900 hover:bg-white/90" asChild>
                <Link href="/register">
                  <BilingualText en="Get Started" el="Ξεκινήστε" compact secondaryClassName="text-slate-700" />
                  <ChevronRight className="ml-2 icon-md" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
                <Link href="/pricing"><BilingualText en="Learn More" el="Μάθετε περισσότερα" compact /></Link>
              </Button>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Users, label: '10,000+', desc: 'Active Members' },
              { icon: Briefcase, label: '5,000+', desc: 'Opportunities' },
              { icon: TrendingUp, label: '$2B+', desc: 'Funding Raised' },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-center"
              >
                <stat.icon className="h-8 w-8 mx-auto mb-3 text-blue-100" />
                <div className="text-2xl font-bold mb-1">{stat.label}</div>
                <div className="text-sm text-blue-100">{stat.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-4 mb-8 overflow-x-auto pb-2">
          {[
            { id: 'discover', label: 'Discover', icon: Sparkles },
            { id: 'members', label: 'Members', icon: Users },
            { id: 'opportunities', label: 'Opportunities', icon: Briefcase },
            { id: 'events', label: 'Events', icon: Calendar },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-full font-medium transition-all whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {SPECIMEN.map((person) => (
              <Card key={person.name} className="overflow-hidden hover:border-foreground/20 transition-colors duration-300 border-border">
                <div className={cn('h-32 bg-gradient-to-br relative', person.banner)}>
                  <div className="absolute inset-0 bg-black/20"></div>
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-white/90 text-slate-900 hover:bg-white"><BilingualText en="Featured" el="Προβεβλημένο" compact /></Badge>
                  </div>
                </div>
                <CardContent>
                  {/* Wraps on a phone: name, role and Connect in one row pushed
                      Connect 80px past the card edge at 390px. */}
                  <div className="mb-4 flex flex-wrap items-start gap-x-4 gap-y-2">
                    <div className="relative z-10 -mt-12 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-4 border-card bg-gradient-to-br from-blue-400 to-purple-400 text-lg font-semibold text-white" aria-hidden="true">
                      {person.name.replace(/^Dr\.\s*/, '').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0 flex-1 basis-40 pt-2">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold sm:text-xl">{person.name}</h3>
                        <Badge variant="secondary" className="text-xs">
                          <Star className="icon-sm mr-1 fill-status-warning text-yellow-400" aria-hidden="true" />
                          {person.badge}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{person.role}</p>
                    </div>
                    <Button tabIndex={-1} aria-hidden="true" variant="outline" size="sm" className="shrink-0 rounded-full">
                      <Users className="icon-sm mr-2" />
                      <BilingualText en="Connect" el="Σύνδεση" compact />
                    </Button>
                  </div>

                  <p className="text-sm text-muted-foreground mb-4">
                    {person.pitch}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {person.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="rounded-full">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="icon-sm" />
                      {person.place}
                    </div>
                    <div className="flex items-center gap-1">
                      <Building className="icon-sm" />
                      {person.sector}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t">
                    <Button tabIndex={-1} aria-hidden="true" variant="ghost" size="sm" className="flex-1">
                      <Heart className="icon-sm mr-2" />
                      <BilingualText en="Like" el="Μου αρέσει" compact />
                    </Button>
                    <Button tabIndex={-1} aria-hidden="true" variant="ghost" size="sm" className="flex-1">
                      <MessageSquare className="icon-sm mr-2" />
                      <BilingualText en="Message" el="Μήνυμα" compact />
                    </Button>
                    <Button tabIndex={-1} aria-hidden="true" variant="ghost" size="sm" className="flex-1">
                      <Share2 className="icon-sm mr-2" />
                      <BilingualText en="Share" el="Κοινοποίηση" compact />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-6">
            <Card>
              <CardContent>
                <h3 className="font-semibold text-lg mb-4"><BilingualText en="Trending Topics" el="Δημοφιλή θέματα" compact /></h3>
                <div className="space-y-3">
                  {[
                    { tag: '#AIStartups', count: '2.5K posts' },
                    { tag: '#FundingRound', count: '1.8K posts' },
                    { tag: '#TechCofounder', count: '1.2K posts' },
                    { tag: '#StartupLife', count: '980 posts' },
                  ].map((topic) => (
                    <div
                      key={topic.tag}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="font-semibold text-status-info ">{topic.tag}</div>
                        <div className="text-xs text-muted-foreground">{topic.count}</div>
                      </div>
                      <TrendingUp className="icon-sm text-status-success" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/20 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
              <CardContent>
                <Sparkles className="icon-xl mb-3" />
                <h3 className="font-semibold text-lg mb-2"><BilingualText en="Upgrade to Pro" el="Αναβάθμιση σε Pro" compact /></h3>
                <p className="text-sm text-blue-100 mb-4">
                  <BilingualText en="Unlock premium features and connect with top founders" el="Ξεκλειδώστε premium λειτουργίες και γνωρίστε κορυφαίους ιδρυτές" wrap />
                </p>
                <Button className="w-full bg-white text-slate-900 hover:bg-white/90" asChild>
                  <Link href="/pricing"><BilingualText en="Get Started" el="Ξεκινήστε" compact secondaryClassName="text-slate-700" /></Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <h3 className="font-semibold text-lg mb-4"><BilingualText en="Upcoming Events" el="Προσεχείς εκδηλώσεις" compact /></h3>
                <div className="space-y-3">
                  {[
                    { title: 'Startup Pitch Night', date: 'Tomorrow, 6 PM' },
                    { title: 'AI Founders Meetup', date: 'Fri, Dec 20' },
                    { title: 'Investor Networking', date: 'Mon, Dec 23' },
                  ].map((event, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    >
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                        <Calendar className="icon-lg text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{event.title}</div>
                        <div className="text-xs text-muted-foreground">{event.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLandmark>
  );
}
