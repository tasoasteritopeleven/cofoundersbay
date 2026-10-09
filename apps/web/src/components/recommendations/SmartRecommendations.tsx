'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Briefcase, 
  Calendar, 
  TrendingUp,
  Star,
  MapPin,
  Building,
  Sparkles,
  X,
  Check,
  ChevronRight,
  Target,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { FactLine } from '@/components/common/FactLine';

interface Recommendation {
  id: string;
  type: 'person' | 'opportunity' | 'event' | 'group';
  title: string;
  subtitle: string;
  description: string;
  image?: string;
  matchScore: number;
  matchReasons: string[];
  location?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export function SmartRecommendations() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<'all' | 'people' | 'opportunities' | 'events'>('all');

  const recommendations: Recommendation[] = [
    {
      id: '1',
      type: 'person',
      title: 'Sarah Chen',
      subtitle: 'Technical Co-founder | AI/ML Expert',
      description: 'Looking for business co-founder for AI SaaS startup',
      image: '/avatars/sarah.jpg',
      matchScore: 95,
      matchReasons: [
        'Complementary skills (Tech + Business)',
        'Similar startup stage interest',
        'Shared interest in AI/ML',
        '3 mutual connections'
      ],
      location: 'San Francisco, CA',
      tags: ['AI/ML', 'SaaS', 'Technical Co-founder'],
    },
    {
      id: '2',
      type: 'opportunity',
      title: 'Senior Product Manager',
      subtitle: 'TechCorp Inc.',
      description: 'Lead product strategy for B2B SaaS platform',
      matchScore: 88,
      matchReasons: [
        'Matches your PM experience',
        'Aligns with B2B SaaS expertise',
        'Competitive salary range',
        'Remote-friendly'
      ],
      location: 'Remote',
      tags: ['Product Management', 'B2B', 'SaaS'],
      metadata: { salary: '$150k-$200k', type: 'Full-time' }
    },
    {
      id: '3',
      type: 'event',
      title: 'Startup Founders Meetup',
      subtitle: 'Networking Event',
      description: 'Connect with 50+ founders and investors',
      matchScore: 92,
      matchReasons: [
        'Relevant to your founder journey',
        'In your city',
        '12 attendees match your interests',
        'Hosted by trusted organizer'
      ],
      location: 'New York, NY',
      tags: ['Networking', 'Founders', 'Investors'],
      metadata: { date: 'Mar 15, 2024', attendees: 50 }
    },
    {
      id: '4',
      type: 'person',
      title: 'Michael Rodriguez',
      subtitle: 'Angel Investor | Ex-Google PM',
      description: 'Investing in early-stage B2B SaaS startups',
      matchScore: 85,
      matchReasons: [
        'Active investor in your industry',
        'Relevant mentorship experience',
        'Strong track record',
        'Looking for deal flow'
      ],
      location: 'Austin, TX',
      tags: ['Investor', 'Mentor', 'B2B SaaS'],
    },
    {
      id: '5',
      type: 'opportunity',
      title: 'Co-founder for HealthTech Startup',
      subtitle: 'Equity-based Partnership',
      description: 'Building AI-powered patient management system',
      matchScore: 78,
      matchReasons: [
        'Matches your product expertise',
        'Growing market opportunity',
        'Strong founding team',
        'Pre-seed funding secured'
      ],
      location: 'Boston, MA',
      tags: ['HealthTech', 'AI', 'Co-founder'],
      metadata: { equity: '15-25%', stage: 'Pre-seed' }
    },
  ];

  const filteredRecommendations = recommendations.filter(rec => {
    if (dismissedIds.has(rec.id)) return false;
    if (activeCategory === 'all') return true;
    if (activeCategory === 'people') return rec.type === 'person';
    if (activeCategory === 'opportunities') return rec.type === 'opportunity';
    if (activeCategory === 'events') return rec.type === 'event';
    return true;
  });

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  const handleAccept = (id: string) => {
    console.log('Accepted recommendation:', id);
    // Implement accept logic
  };

  const getTypeIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'person':
        return <Users className="icon-sm" />;
      case 'opportunity':
        return <Briefcase className="icon-sm" />;
      case 'event':
        return <Calendar className="icon-sm" />;
      case 'group':
        return <Building className="icon-sm" />;
    }
  };

  const getTypeLabel = (type: Recommendation['type']) => {
    switch (type) {
      case 'person':
        return 'Connection';
      case 'opportunity':
        return 'Opportunity';
      case 'event':
        return 'Event';
      case 'group':
        return 'Group';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="icon-xl text-primary-accessible" />
            <BilingualText en="Smart Recommendations" el="Έξυπνες προτάσεις" compact />
          </h2>
          <p className="text-muted-foreground">
            <BilingualText en="Personalized suggestions based on your profile and activity" el="Εξατομικευμένες προτάσεις βάσει προφίλ και δραστηριότητας" wrap />
          </p>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2">
        <Button
          variant={activeCategory === 'all' ? 'default' : 'outline'}
          onClick={() => setActiveCategory('all')}
          className="gap-2"
        >
          <Target className="icon-sm" />
          <BilingualText en="All Recommendations" el="Όλες οι προτάσεις" compact />
        </Button>
        <Button
          variant={activeCategory === 'people' ? 'default' : 'outline'}
          onClick={() => setActiveCategory('people')}
          className="gap-2"
        >
          <Users className="icon-sm" />
          <BilingualText en="People" el="Άτομα" compact />
        </Button>
        <Button
          variant={activeCategory === 'opportunities' ? 'default' : 'outline'}
          onClick={() => setActiveCategory('opportunities')}
          className="gap-2"
        >
          <Briefcase className="icon-sm" />
          <BilingualText en="Opportunities" el="Ευκαιρίες" compact />
        </Button>
        <Button
          variant={activeCategory === 'events' ? 'default' : 'outline'}
          onClick={() => setActiveCategory('events')}
          className="gap-2"
        >
          <Calendar className="icon-sm" />
          <BilingualText en="Events" el="Εκδηλώσεις" compact />
        </Button>
      </div>

      {/* Recommendations Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredRecommendations.map((rec) => (
          <Card key={rec.id} className="relative overflow-hidden hover:border-primary/30 transition-colors">
            {/* Match Score Badge */}
            <div className="absolute top-4 right-4 z-10">
              <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary-accessible border-primary/20">
                <Star className="icon-sm fill-current" />
                {rec.matchScore}% Match
              </Badge>
            </div>

            <CardHeader className="pb-3">
              <div className="flex items-start gap-4">
                {rec.type === 'person' ? (
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={rec.image} />
                    <AvatarFallback>{rec.title[0]}</AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                    {getTypeIcon(rec.type)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="gap-1">
                      {getTypeIcon(rec.type)}
                      {getTypeLabel(rec.type)}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{rec.title}</CardTitle>
                  <CardDescription className="text-sm">
                    {rec.subtitle}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {rec.description}
              </p>

              {/* Location */}
              {rec.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="icon-sm" />
                  {rec.location}
                </div>
              )}

              {/* Metadata */}
              {rec.metadata && (
                <FactLine items={Object.entries(rec.metadata).map(([key, value]) => `${key}: ${value}`)} />
              )}

              {/* Tags */}
              {rec.tags && rec.tags.length > 0 && (
                <FactLine items={rec.tags} />
              )}

              {/* Match Reasons */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Zap className="icon-sm text-muted-foreground" />
                  Why this matches you:
                </div>
                <ul className="space-y-1">
                  {rec.matchReasons.slice(0, 3).map((reason, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="icon-sm text-primary-accessible mt-0.5 flex-shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => handleAccept(rec.id)}
                  className="flex-1 gap-2"
                >
                  <Check className="icon-sm" />
                  {rec.type === 'person' ? 'Connect' : 
                   rec.type === 'opportunity' ? 'Apply' : 
                   rec.type === 'event' ? 'Register' : 'Join'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleDismiss(rec.id)}
                  className="gap-2"
                >
                  <X className="icon-sm" />
                  <BilingualText en="Dismiss" el="Απόρριψη" compact />
                </Button>
                <Button variant="ghost" size="icon" aria-label={`View details for ${rec.title}`} disabled title="Recommendation details are not available yet">
                  <ChevronRight className="icon-sm" aria-hidden="true" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredRecommendations.length === 0 && (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Sparkles className="icon-xl text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold"><BilingualText en="No recommendations yet" el="Δεν υπάρχουν προτάσεις ακόμα" compact /></h3>
              <p className="text-sm text-muted-foreground mt-1">
                <BilingualText en="Complete your profile to get personalized recommendations" el="Ολοκληρώστε το προφίλ σας για εξατομικευμένες προτάσεις" wrap />
              </p>
            </div>
            <Button asChild><Link href="/profile/edit"><BilingualText en="Complete Profile" el="Ολοκλήρωση προφίλ" compact /></Link></Button>
          </div>
        </Card>
      )}

      {/* Recommendation Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="icon-md" />
            <BilingualText en="Recommendation Insights" el="Στοιχεία προτάσεων" compact />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="page-stat text-xl font-bold">{recommendations.length}</p>
              <p className="text-sm text-muted-foreground"><BilingualText en="Active Recommendations" el="Ενεργές προτάσεις" compact /></p>
            </div>
            <div className="space-y-1">
              <p className="page-stat text-xl font-bold">
                {Math.round(recommendations.reduce((acc, r) => acc + r.matchScore, 0) / recommendations.length)}%
              </p>
              <p className="text-sm text-muted-foreground"><BilingualText en="Average Match Score" el="Μέσος βαθμός ταιριάσματος" compact /></p>
            </div>
            <div className="space-y-1">
              <p className="page-stat text-xl font-bold">{dismissedIds.size}</p>
              <p className="text-sm text-muted-foreground"><BilingualText en="Dismissed Today" el="Απορρίφθηκαν σήμερα" compact /></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
