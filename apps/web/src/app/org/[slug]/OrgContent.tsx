'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Building2, MapPin, Globe, Mail, Calendar, Users,
  Briefcase, GraduationCap, ExternalLink, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getOrgOpportunities, getOrgCohorts, getOrgMembers, type OrgProfile, type OpportunityItem, type CohortItem, type OrgMember } from '@/lib/api';
import { cn, formatRelativeTime } from '@/lib/utils';
import { RelativeTime } from '@/components/common/RelativeTime';
import { AppShell } from '@/components/layout/AppShell';
import { ListEmptyState } from '@/components/common/EmptyStates';
import { qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { StatusText } from '@/components/common/StatusText';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { FollowButton } from '@/components/updates/FollowButton';
import { FactLine } from '@/components/common/FactLine';
import { CardHead, CardFoot } from '@/components/common/CardAnatomy';

/** The organisation's rounded square, the kind's glyph standing in for a
 * missing logo (the Programs card's mark). */
function OrgMark({ org, icon: Icon }: { org: OrgProfile; icon: LucideIcon }) {
  return (
    <Avatar className="h-10 w-10 rounded-xl">
      <AvatarImage src={org.avatarUrl ?? undefined} alt="" />
      <AvatarFallback data-keep-icon className="rounded-xl bg-primary/10 text-primary-accessible">
        <Icon className="icon-md" aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  );
}

interface OrgContentProps {
  org: OrgProfile;
  slug: string;
}

export function OrgContent({ org, slug }: OrgContentProps) {
  const { data: opportunitiesData, isLoading: oppsLoading } = useQuery({
    queryKey: qk('org', 'opportunities', slug),
    queryFn: () => getOrgOpportunities(slug),
  });

  const { data: cohortsData, isLoading: cohortsLoading } = useQuery({
    queryKey: qk('org', 'cohorts', slug),
    queryFn: () => getOrgCohorts(slug),
  });

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: qk('org', 'members', slug),
    queryFn: () => getOrgMembers(slug),
  });

  const opportunities: OpportunityItem[] = opportunitiesData?.opportunities ?? [];
  const cohorts: CohortItem[] = cohortsData?.cohorts ?? [];
  const members: OrgMember[] = membersData?.members ?? [];
  const [tab, setTab] = useState('opportunities');

  return (
    <AppShell>
      <div className="w-full min-w-0 space-y-6">
        {/* The same top card as a profile, the way a company page reads:
            a calm cover, the logo as a rounded square (organisations are
            squares; the old header drew a circle), name in the h1, tagline,
            facts on one wrapping line, and the actions in one row. */}
        <ProfileHero
          headingLevel="h1"
          shape="organisation"
          name={org.name}
          ariaLabel={`${org.name} · Organisation · Οργανισμός`}
          avatarUrl={org.avatarUrl}
          headline={org.tagline}
          meta={[
            org.location ? <><MapPin className="icon-sm shrink-0" aria-hidden="true" />{org.location}</> : null,
            org.website ? (
              <a href={org.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground">
                <Globe className="icon-sm shrink-0" aria-hidden="true" />
                {(() => { try { return new URL(org.website).hostname; } catch { return org.website; } })()}
                <ExternalLink className="icon-sm" aria-hidden="true" />
              </a>
            ) : null,
            org.email ? (
              <a href={`mailto:${org.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
                <Mail className="icon-sm shrink-0" aria-hidden="true" />{org.email}
              </a>
            ) : null,
            <><Calendar className="icon-sm shrink-0" aria-hidden="true" /><BilingualText en="On the platform since" el="Στην πλατφόρμα από" compact />{' '}<RelativeTime date={org.createdAt} format={formatRelativeTime} /></>,
          ]}
          aside={
            org.industry ? (
              <Badge variant="outline" className="gap-1.5 text-xs">
                <Building2 className="icon-sm" aria-hidden="true" />
                {org.industry.split(',')[0]?.trim()}
              </Badge>
            ) : null
          }
          actions={
            <>
              {/* An organisation is an account (role "org"), so following it
                  is the same follow as a person's: its updates reach the
                  reader's /updates, and unfollowing removes the row. It was a
                  disabled button that said following was not supported. */}
              <FollowButton userId={org.id} />
              {org.email || org.website ? (
                <Button size="sm" variant="outline" className="gap-1.5" asChild>
                  <a href={org.email ? `mailto:${org.email}` : org.website!} target={org.email ? undefined : '_blank'} rel="noopener noreferrer">
                    <Mail className="icon-sm" aria-hidden="true" />
                    <BilingualText en="Contact" el="Επικοινωνία" compact />
                  </a>
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5" disabled title="This organisation has not listed a contact · Ο οργανισμός δεν έχει δηλώσει στοιχεία επικοινωνίας">
                  <Mail className="icon-sm" aria-hidden="true" />
                  <BilingualText en="Contact" el="Επικοινωνία" compact />
                </Button>
              )}
            </>
          }
        />

        {org.description ? (
          <Card>
            <CardContent>
              <p className="card-body max-w-3xl text-foreground/80 first-letter:uppercase">{org.description}</p>
            </CardContent>
          </Card>
        ) : null}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Opportunities', labelEl: 'Ευκαιρίες', value: org._count.opportunities, tab: 'opportunities' },
            { label: 'Programs', labelEl: 'Προγράμματα', value: org._count.cohorts, tab: 'programs' },
            { label: 'Members', labelEl: 'Μέλη', value: org._count.members, tab: 'members' },
            { label: 'Events', labelEl: 'Εκδηλώσεις', value: org._count.events, tab: null },
          ].map(({ label, labelEl, value, tab: target }) => {
            const body = (
              <>
                <div className="text-2xl font-bold text-foreground tabular-nums">{value}</div>
                <div className="text-xs text-muted-foreground mt-0.5"><BilingualText en={label} el={labelEl} compact wrap /></div>
              </>
            );
            // A figure that has a tab opens it: the tile was a second copy
            // of the tab's count with nothing to do.
            return target ? (
              <button
                key={label}
                type="button"
                onClick={() => setTab(target)}
                aria-pressed={tab === target}
                className={'rounded-xl border bg-card px-3 pt-5 pb-4 text-center transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' + (tab === target ? 'border-primary/40' : 'border-border')}
              >
                {body}
              </button>
            ) : (
              <Card key={label} className="border-border">
                <CardContent className="pt-5 pb-4 text-center">{body}</CardContent>
              </Card>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="h-9">
            <TabsTrigger value="opportunities" className="text-sm gap-1.5">
              <Briefcase className="icon-sm" aria-hidden="true" />
              <BilingualText en="Opportunities" el="Ευκαιρίες" compact />
              {opportunities.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-xs">{opportunities.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="programs" className="text-sm gap-1.5">
              <GraduationCap className="icon-sm" aria-hidden="true" />
              <BilingualText en="Programs" el="Προγράμματα" compact />
              {cohorts.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-xs">{cohorts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="members" className="text-sm gap-1.5">
              <Users className="icon-sm" aria-hidden="true" />
              <BilingualText en="Members" el="Μέλη" compact />
              {members.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-xs">{members.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="about" className="text-sm gap-1.5">
              <Building2 className="icon-sm" aria-hidden="true" />
              <BilingualText en="About" el="Σχετικά" compact />
            </TabsTrigger>
          </TabsList>

          {/* Opportunities */}
          <TabsContent value="opportunities" className="space-y-3">
            {oppsLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="pt-5">
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : opportunities.length === 0 ? (
              <ListEmptyState
                icon={Briefcase}
                tone="info"
                size="compact"
                title={<BilingualText en="No open opportunities" el="Δεν υπάρχουν ανοιχτές ευκαιρίες" wrap />}
                description={<BilingualText en="This organization is not currently hiring or posting collaboration calls." el="Ο οργανισμός δεν προσλαμβάνει ούτε δημοσιεύει προσκλήσεις συνεργασίας αυτή τη στιγμή." wrap />}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {opportunities.map((opp) => (
                  // The Opportunities card: the organisation's mark, the
                  // title with the kind and place under it, the state at
                  // the right; the sentence and the foot on the mark's edge.
                  <Card key={opp.id} className="transition-all hover:border-primary/20">
                    <CardContent className="space-y-3">
                      <CardHead
                        mark={<OrgMark org={org} icon={Briefcase} />}
                        title={(
                          <Link href={`/opportunities#opportunity-${encodeURIComponent(opp.id)}`} className="transition-colors hover:text-primary-accessible">
                            {opp.title}
                          </Link>
                        )}
                        subtitle={(
                          <FactLine
                            className="text-sm"
                            items={[<StatusText key="type" value={opp.type} />, opp.location]}
                          />
                        )}
                        aside={(
                          <Badge variant="outline" className={cn('text-xs', opp.isActive ? 'border-primary/30 bg-primary/10 text-primary-accessible' : 'text-muted-foreground')}>
                            {opp.isActive ? <BilingualText en="Active" el="Ενεργή" compact /> : <BilingualText en="Closed" el="Έκλεισε" compact />}
                          </Badge>
                        )}
                      />
                      {opp.description && (
                        <p className="card-body line-clamp-2 text-muted-foreground first-letter:uppercase">{opp.description}</p>
                      )}
                      <CardFoot meta={<RelativeTime date={opp.createdAt} format={formatRelativeTime} />}>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/opportunities#opportunity-${encodeURIComponent(opp.id)}`}><BilingualText en="View" el="Προβολή" compact /></Link>
                        </Button>
                      </CardFoot>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Programs */}
          <TabsContent value="programs" className="space-y-3">
            {cohortsLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="pt-5">
                      <div className="space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : cohorts.length === 0 ? (
              <ListEmptyState
                icon={GraduationCap}
                tone="success"
                size="compact"
                title={<BilingualText en="No public programs yet" el="Δεν υπάρχουν ακόμη δημόσια προγράμματα" wrap />}
                description={<BilingualText en="When this organization publishes accelerators, bootcamps, or incubators, they will appear here with open applications." el="Όταν ο οργανισμός δημοσιεύσει επιταχυντές, bootcamps ή θερμοκοιτίδες, θα εμφανιστούν εδώ με ανοιχτές αιτήσεις." wrap />}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {cohorts.map((cohort) => (
                  <Card key={cohort.id} className="transition-all hover:border-primary/20">
                    <CardContent className="space-y-3">
                      <CardHead
                        mark={<OrgMark org={org} icon={GraduationCap} />}
                        title={cohort.name}
                        subtitle={(
                          <FactLine
                            className="text-sm"
                            items={[org.name, <BilingualText key="kind" en="Programme" el="Πρόγραμμα" compact />]}
                          />
                        )}
                        aside={(
                          <Badge variant="outline" className={cn('text-xs', cohort.isActive ? 'border-primary/30 bg-primary/10 text-primary-accessible' : 'text-muted-foreground')}>
                            {cohort.isActive ? <BilingualText en="Active" el="Ενεργό" compact /> : <BilingualText en="Inactive" el="Ανενεργό" compact />}
                          </Badge>
                        )}
                      />
                      {cohort.description && (
                        <p className="card-body line-clamp-2 text-muted-foreground first-letter:uppercase">{cohort.description}</p>
                      )}
                      <FactLine
                        items={[
                          <BilingualText key="members" en={`${cohort._count?.members ?? 0} members`} el={`${cohort._count?.members ?? 0} μέλη`} compact />,
                          cohort.capacity ? <BilingualText key="capacity" en={`Capacity ${cohort.capacity}`} el={`Χωρητικότητα ${cohort.capacity}`} compact /> : null,
                          cohort.startDate ? (
                            <BilingualText key="start" en={`Starts ${new Date(cohort.startDate).toLocaleDateString('en-GB', { timeZone: 'UTC' })}`} el={`Ξεκινά ${new Date(cohort.startDate).toLocaleDateString('el-GR', { timeZone: 'UTC' })}`} compact />
                          ) : null,
                        ]}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Members */}
          <TabsContent value="members" className="space-y-3">
            {membersLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="pt-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted" />
                        <div className="space-y-2 flex-1">
                          <div className="h-3.5 bg-muted rounded w-24" />
                          <div className="h-3 bg-muted rounded w-32" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : members.length === 0 ? (
              <ListEmptyState
                icon={Users}
                tone="primary"
                size="compact"
                title={<BilingualText en="No public members listed" el="Δεν εμφανίζονται δημόσια μέλη" wrap />}
                description={<BilingualText en="Members appear here once they accept a program invite and choose to display their affiliation publicly." el="Τα μέλη εμφανίζονται εδώ μόλις αποδεχτούν πρόσκληση σε πρόγραμμα και επιλέξουν να δείχνουν δημόσια τη σύνδεσή τους." wrap />}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {members.map((member) => (
                  <Card key={member.id} className="transition-all hover:border-primary/20">
                    <CardContent className="space-y-3">
                      <CardHead
                        mark={(
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.avatarUrl ?? undefined} />
                            <AvatarFallback className="bg-primary/10 font-semibold text-primary-accessible">
                              {member.displayName?.[0]?.toUpperCase() ?? 'M'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        title={(
                          <Link href={`/profiles/${member.id}`} className="transition-colors hover:text-primary-accessible">
                            {member.displayName}
                          </Link>
                        )}
                        subtitle={member.headline ? <span className="line-clamp-2">{member.headline}</span> : undefined}
                      />
                      <FactLine items={[member.cohortName, member.location]} />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* About */}
          <TabsContent value="about">
            <Card>
              <CardHeader>
                <CardTitle><BilingualText en={`About ${org.name}`} el={`Σχετικά με ${org.name}`} wrap /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {org.mission && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"><BilingualText en="Mission" el="Αποστολή" compact /></h3>
                    <p className="card-body text-foreground/80 first-letter:uppercase">{org.mission}</p>
                  </div>
                )}
                {org.industry && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"><BilingualText en="Industry" el="Κλάδος" compact /></h3>
                    <FactLine className="text-sm text-foreground" items={org.industry.split(',').map((ind: string) => ind.trim())} />
                  </div>
                )}
                {org.focus && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"><BilingualText en="Focus Areas" el="Πεδία εστίασης" compact /></h3>
                    <FactLine className="text-sm text-foreground" items={org.focus.split(',').map((f: string) => f.trim())} />
                  </div>
                )}
                {org.size && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"><BilingualText en="Size" el="Μέγεθος" compact /></h3>
                    <p className="text-sm text-foreground/80">{org.size}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
