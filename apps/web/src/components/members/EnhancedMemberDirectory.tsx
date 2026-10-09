'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  Filter, 
  MapPin, 
  Briefcase, 
  Star,
  Users,
  TrendingUp,
  Award,
  MessageSquare,
  UserPlus,
  Grid,
  List,
  SlidersHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { FactLine } from '@/components/common/FactLine';

interface Member {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  headline: string;
  location: string;
  skills: string[];
  industries: string[];
  experience: string;
  connections: number;
  verified: boolean;
  online: boolean;
  matchScore?: number;
}

export function EnhancedMemberDirectory() {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    role: 'all',
    location: 'all',
    experience: 'all',
    availability: 'all',
    verified: false,
  });

  const members: Member[] = [
    {
      id: '1',
      name: 'Alex Johnson',
      avatar: '/avatars/alex.jpg',
      role: 'Founder',
      headline: 'Building the future of FinTech | Ex-Goldman Sachs',
      location: 'New York, NY',
      skills: ['Product Strategy', 'Fundraising', 'Team Building'],
      industries: ['FinTech', 'B2B SaaS'],
      experience: '10+ years',
      connections: 847,
      verified: true,
      online: true,
      matchScore: 92,
    },
    {
      id: '2',
      name: 'Maria Garcia',
      avatar: '/avatars/maria.jpg',
      role: 'Investor',
      headline: 'Angel Investor | Focus on AI & Healthcare',
      location: 'San Francisco, CA',
      skills: ['Due Diligence', 'Portfolio Management', 'Mentorship'],
      industries: ['AI/ML', 'HealthTech'],
      experience: '15+ years',
      connections: 1243,
      verified: true,
      online: false,
      matchScore: 88,
    },
    {
      id: '3',
      name: 'David Chen',
      avatar: '/avatars/david.jpg',
      role: 'Mentor',
      headline: 'Serial Entrepreneur | 3 Exits | Startup Advisor',
      location: 'Austin, TX',
      skills: ['Growth Strategy', 'Sales', 'Marketing'],
      industries: ['E-commerce', 'Consumer Tech'],
      experience: '20+ years',
      connections: 2156,
      verified: true,
      online: true,
      matchScore: 85,
    },
    {
      id: '4',
      name: 'Sarah Williams',
      avatar: '/avatars/sarah.jpg',
      role: 'Founder',
      headline: 'Co-founder @ TechStartup | Looking for Technical Co-founder',
      location: 'Boston, MA',
      skills: ['Business Development', 'Product Management', 'UX Design'],
      industries: ['EdTech', 'SaaS'],
      experience: '5+ years',
      connections: 456,
      verified: false,
      online: true,
      matchScore: 95,
    },
  ];

  const filteredMembers = members.filter(member => {
    const matchesSearch = 
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRole = filters.role === 'all' || member.role === filters.role;
    const matchesVerified = !filters.verified || member.verified;
    
    return matchesSearch && matchesRole && matchesVerified;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight"><BilingualText en="Member Directory" el="Κατάλογος μελών" compact /></h2>
          <p className="text-muted-foreground">
            Discover and connect with {members.length}+ members
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button aria-label="Grid view"
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="icon-sm" />
          </Button>
          <Button aria-label="List view"
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="icon-sm" />
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
            <Input
              placeholder={bilingualInline("Search by name, skills, or industry…", "Αναζήτηση με όνομα, δεξιότητες ή κλάδο…")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <SlidersHorizontal className="icon-sm" />
            Filters
            {Object.values(filters).filter(v => v !== 'all' && v !== false).length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {Object.values(filters).filter(v => v !== 'all' && v !== false).length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="emd-role"><BilingualText en="Role" el="Ρόλος" compact /></label>
                  <Select
                    value={filters.role}
                    onValueChange={(value) => setFilters({ ...filters, role: value })}
                  >
                    <SelectTrigger id="emd-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all"><BilingualText en="All Roles" el="Όλοι οι ρόλοι" compact /></SelectItem>
                      <SelectItem value="Founder"><BilingualText en="Founders" el="Ιδρυτές" compact /></SelectItem>
                      <SelectItem value="Investor"><BilingualText en="Investors" el="Επενδυτές" compact /></SelectItem>
                      <SelectItem value="Mentor"><BilingualText en="Mentors" el="Μέντορες" compact /></SelectItem>
                      <SelectItem value="Organization"><BilingualText en="Organizations" el="Οργανισμοί" compact /></SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="emd-location"><BilingualText en="Location" el="Τοποθεσία" compact /></label>
                  <Select
                    value={filters.location}
                    onValueChange={(value) => setFilters({ ...filters, location: value })}
                  >
                    <SelectTrigger id="emd-location">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all"><BilingualText en="All Locations" el="Όλες οι τοποθεσίες" compact /></SelectItem>
                      <SelectItem value="ny"><BilingualText en="New York" el="Νέα Υόρκη" compact /></SelectItem>
                      <SelectItem value="sf"><BilingualText en="San Francisco" el="Σαν Φρανσίσκο" compact /></SelectItem>
                      <SelectItem value="austin"><BilingualText en="Austin" el="Όστιν" compact /></SelectItem>
                      <SelectItem value="boston"><BilingualText en="Boston" el="Βοστώνη" compact /></SelectItem>
                      <SelectItem value="remote"><BilingualText en="Remote" el="Εξ αποστάσεως" compact /></SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="emd-experience"><BilingualText en="Experience" el="Εμπειρία" compact /></label>
                  <Select
                    value={filters.experience}
                    onValueChange={(value) => setFilters({ ...filters, experience: value })}
                  >
                    <SelectTrigger id="emd-experience">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all"><BilingualText en="All Levels" el="Όλα τα επίπεδα" compact /></SelectItem>
                      <SelectItem value="0-2">0-2 years</SelectItem>
                      <SelectItem value="3-5">3-5 years</SelectItem>
                      <SelectItem value="6-10">6-10 years</SelectItem>
                      <SelectItem value="10+">10+ years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="emd-availability"><BilingualText en="Availability" el="Διαθεσιμότητα" compact /></label>
                  <Select
                    value={filters.availability}
                    onValueChange={(value) => setFilters({ ...filters, availability: value })}
                  >
                    <SelectTrigger id="emd-availability">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all"><BilingualText en="All" el="Όλα" compact /></SelectItem>
                      <SelectItem value="online"><BilingualText en="Online Now" el="Σε σύνδεση τώρα" compact /></SelectItem>
                      <SelectItem value="available"><BilingualText en="Available" el="Διαθέσιμος" compact /></SelectItem>
                      <SelectItem value="busy"><BilingualText en="Busy" el="Απασχολημένος" compact /></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.verified}
                    onChange={(e) => setFilters({ ...filters, verified: e.target.checked })}
                    className="rounded"
                  />
                  <BilingualText en="Verified members only" el="Μόνο επαληθευμένα μέλη" compact />
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilters({
                    role: 'all',
                    location: 'all',
                    experience: 'all',
                    availability: 'all',
                    verified: false,
                  })}
                >
                  <BilingualText en="Clear filters" el="Καθαρισμός φίλτρων" compact />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {filteredMembers.length} of {members.length} members
        </span>
        <Select defaultValue="match">
          <SelectTrigger aria-label="Sort by" className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="match"><BilingualText en="Best Match" el="Καλύτερο ταίριασμα" compact /></SelectItem>
            <SelectItem value="recent"><BilingualText en="Recently Joined" el="Πρόσφατες εγγραφές" compact /></SelectItem>
            <SelectItem value="connections"><BilingualText en="Most Connections" el="Περισσότερες συνδέσεις" compact /></SelectItem>
            <SelectItem value="name"><BilingualText en="Name (A-Z)" el="Όνομα (Α-Ω)" compact /></SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Members Grid/List */}
      <div className={cn(
        "grid grid-cols-1 gap-4",
        viewMode === 'grid' ? "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"
      )}>
        {filteredMembers.map((member) => (
          <Card key={member.id} className="hover:border-primary/30 transition-colors">
            <CardContent className="pt-6">
              <div className={cn(
                "flex gap-4",
                viewMode === 'list' ? "items-center" : "flex-col items-center text-center"
              )}>
                <div className="relative">
                  <Avatar className={cn(viewMode === 'list' ? "h-12 w-12" : "h-16 w-16")}>
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback>{member.name[0]}</AvatarFallback>
                  </Avatar>
                  {member.online && (
                    <span className="absolute bottom-0 right-0 h-4 w-4 bg-status-success-mark rounded-full border-2 border-background" />
                  )}
                  {member.verified && (
                    <span className="absolute -top-1 -right-1 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
                      <Award className="icon-sm text-primary-foreground" />
                    </span>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <div>
                    <div className="flex items-center gap-2 justify-center md:justify-start">
                      <h3 className="font-semibold">{member.name}</h3>
                      {member.matchScore && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="icon-sm fill-current" />
                          {member.matchScore}%
                        </Badge>
                      )}
                    </div>
                    <Badge variant="outline" className="mt-1">
                      {member.role}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {member.headline}
                  </p>

                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="icon-sm" />
                      {member.location}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="icon-sm" />
                      {member.connections} connections
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Briefcase className="icon-sm" />
                      {member.experience}
                    </div>
                  </div>

                  {viewMode === 'list' && (
                    <>
                      <FactLine items={[...member.skills.slice(0, 3), member.skills.length > 3 ? `+${member.skills.length - 3}` : null]} />
                      <FactLine items={member.industries} />
                    </>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1 gap-2" asChild>
                      <Link href={`/profiles/${member.id}`}>
                        <UserPlus className="icon-sm" aria-hidden="true" />
                        <BilingualText en="Connect" el="Σύνδεση" compact />
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2" asChild>
                      <Link href={`/messages?to=${member.id}`}>
                        <MessageSquare className="icon-sm" aria-hidden="true" />
                        <BilingualText en="Message" el="Μήνυμα" compact />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredMembers.length === 0 && (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Users className="icon-xl text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold"><BilingualText en="No members found" el="Δεν βρέθηκαν μέλη" compact /></h3>
              <p className="text-sm text-muted-foreground mt-1">
                <BilingualText en="Try adjusting your search or filters" el="Δοκιμάστε άλλη αναζήτηση ή φίλτρα" wrap />
              </p>
            </div>
            <Button onClick={() => {
              setSearchQuery('');
              setFilters({
                role: 'all',
                location: 'all',
                experience: 'all',
                availability: 'all',
                verified: false,
              });
            }}>
              <BilingualText en="Clear all filters" el="Καθαρισμός όλων των φίλτρων" compact />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
