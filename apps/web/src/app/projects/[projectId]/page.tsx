'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MoreVertical, Star, Share2, MessageSquare,
  Edit, Trash2, CheckCircle2, Circle, Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AppShell } from '@/components/layout/AppShell';
import { RoleBadge } from '@/components/common/RoleBadge';
import { ProjectNeedCard } from '@/components/commitments/ProjectNeedCard';
import { NonGuaranteeNote } from '@/components/commitments/NonGuaranteeNote';
import { BilingualText } from '@/components/common/BilingualText';
import { CfbGlyph } from '@/components/icons/CfbGlyph';
import { usePopupChat } from '@/contexts/PopupChatContext';
import { useToast } from '@/components/ui/toast';
import { useConfirm, deleteConfirmCopy } from '@/components/ui/confirm-dialog';
import { bilingualAria, formatShortDate } from '@/lib/i18n/format';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import {
  projectEn,
  projectEl,
  PROJECT_STAGE_FULL_KEYS,
} from '@/lib/i18n/strings-projects';
import { cn } from '@/lib/utils';
import { BUILDER_BTN } from '@/components/builder/BuilderStageChrome';
import { CANCELLED, ROW_GONE, rowOptions, usePageControls, type PageControlRunResult } from '@/lib/page-controls';
import {
  getDemoProject,
  toggleDemoStar,
  deleteDemoProject,
  requestJoinDemoProject,
  applyDemoRole,
  hasJoinRequest,
  appliedRolesFor,
  isOwnedProject,
  isJoinedProject,
  PROJECT_STATUS_GLYPH,
  type ProjectStatus,
} from '@/lib/projects-demo';
import { FactLine } from '@/components/common/FactLine';

const STATUS_COLOR: Record<ProjectStatus, string> = {
  idea: 'bg-status-accent-bg text-status-accent border-status-accent-border',
  validating: 'bg-status-warning-bg text-status-warning border-status-warning-border',
  building: 'bg-status-info-bg text-status-info border-status-info-border',
  launched: 'bg-status-success-bg text-status-success border-status-success-border',
  scaling: 'bg-status-info-bg text-status-info border-status-info-border',
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { primary } = useLanguagePreference();
  const { open: openAskAi, ask } = usePopupChat();
  const { success } = useToast();
  const confirm = useConfirm();
  const projectId = String(params?.projectId ?? '');
  const project = useMemo(() => getDemoProject(projectId), [projectId]);
  const [starred, setStarred] = useState(() => getDemoProject(projectId)?.isStarred ?? false);
  const [joinRequested, setJoinRequested] = useState(() => hasJoinRequest(projectId));
  const [appliedRoles, setAppliedRoles] = useState(() => appliedRolesFor(projectId));
  const owned = project ? isOwnedProject(project) : false;
  const joined = project ? isJoinedProject(project) : false;

  function handleShare() {
    if (!project) return;
    const url = `${window.location.origin}/projects/${project.id}`;
    void navigator.clipboard?.writeText(url).catch(() => undefined);
    success('Link copied', 'Anyone with the link can open this project.');
  }

  async function handleDelete(): Promise<PageControlRunResult> {
    if (!project) return ROW_GONE;
    if (!(await confirm(deleteConfirmCopy({ en: 'project', el: 'έργου' }, project.name)))) return CANCELLED;
    deleteDemoProject(project.id);
    success('Project deleted');
    router.push('/projects');
  }

  function handleJoin() {
    if (!project) return;
    if (requestJoinDemoProject(project.id)) {
      setJoinRequested(true);
      success('Request sent', 'The founder can accept from their inbox.');
    }
  }

  function handleApply(roleTitle: string) {
    if (!project) return;
    if (applyDemoRole(project.id, roleTitle)) {
      setAppliedRoles(appliedRolesFor(project.id));
      success('Application noted', 'The team will see it next to this role.');
    }
  }

  // Offered to the assistant, above the missing-project return: the header's
  // star, share and delete (which asks). Projects are kept in this browser
  // until a projects API exists, so each writes there.
  const missingEn = project ? undefined : 'This project was not found.';
  const missingEl = project ? undefined : 'Το έργο δεν βρέθηκε.';
  usePageControls([
    { id: 'star_project', labelEn: 'Star this project', labelEl: 'Αστέρι σε αυτό το έργο', writes: true, unavailableEn: missingEn ?? (starred ? 'It is already starred.' : undefined), unavailableEl: missingEl ?? (starred ? 'Έχει ήδη αστέρι.' : undefined), undo: () => ({ control: 'unstar_project' }), run: () => { if (project) setStarred(toggleDemoStar(project.id)); } },
    { id: 'unstar_project', labelEn: 'Unstar this project', labelEl: 'Αφαίρεση αστεριού από το έργο', writes: true, unavailableEn: missingEn ?? (starred ? undefined : 'It is not starred.'), unavailableEl: missingEl ?? (starred ? undefined : 'Δεν έχει αστέρι.'), undo: () => ({ control: 'star_project' }), run: () => { if (project) setStarred(toggleDemoStar(project.id)); } },
    { id: 'share_project', labelEn: 'Copy a link to this project', labelEl: 'Αντιγραφή συνδέσμου του έργου', writes: false, unavailableEn: missingEn, unavailableEl: missingEl, run: handleShare },
    { id: 'request_join', labelEn: 'Request to join this project', labelEl: 'Αίτημα ένταξης σε αυτό το έργο', writes: true, unavailableEn: missingEn ?? (owned ? 'You own this project.' : joined ? "You're on this team." : joinRequested ? 'Request already sent.' : undefined), unavailableEl: missingEl ?? (owned ? 'Αυτό το έργο είναι δικό σας.' : joined ? 'Είστε στην ομάδα.' : joinRequested ? 'Το αίτημα έχει ήδη σταλεί.' : undefined), run: handleJoin },
    { id: 'apply_role', labelEn: 'Apply to an open role', labelEl: 'Αίτηση σε ανοιχτό ρόλο', writes: true, unavailableEn: missingEn ?? (owned ? 'You own this project.' : !project?.rolesNeeded.length ? 'This project has no open roles.' : project.rolesNeeded.every((role) => appliedRoles.includes(role.title)) ? 'Applications are already noted.' : undefined), unavailableEl: missingEl ?? (owned ? 'Αυτό το έργο είναι δικό σας.' : !project?.rolesNeeded.length ? 'Αυτό το έργο δεν έχει ανοιχτούς ρόλους.' : project.rolesNeeded.every((role) => appliedRoles.includes(role.title)) ? 'Οι αιτήσεις έχουν ήδη καταχωρηθεί.' : undefined), options: rowOptions((project?.rolesNeeded ?? []).filter((role) => !appliedRoles.includes(role.title)), (role) => role.title, (role) => role.title), run: (v) => { if (v) handleApply(v); } },
    { id: 'delete_project', labelEn: 'Delete this project', labelEl: 'Διαγραφή του έργου', writes: true, unavailableEn: missingEn, unavailableEl: missingEl, run: () => handleDelete() },
  ]);

  if (!project) {
    return (
      <AppShell showHelp contentClassName="builder-copy overflow-x-clip">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
          <CfbGlyph name="briefcase" className="icon-lg text-muted-foreground/50" />
          <div>
            <p className="page-section font-medium text-foreground">
              <BilingualText en={projectEn('missing_title')} el={projectEl('missing_title')} />
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              <BilingualText en={projectEn('missing_hint')} el={projectEl('missing_hint')} />
            </p>
          </div>
          <Button className={BUILDER_BTN} asChild>
            <Link href="/projects">
              <BilingualText en={projectEn('back_projects')} el={projectEl('back_projects')} compact />
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const current = project;
  const stageKey = PROJECT_STAGE_FULL_KEYS[current.status];


  return (
    <AppShell
      showHelp
      askAi={
        current.name.includes('Harbor') || current.id === '1'
          ? 'Help with this Harbor project from Idea Core, the GTM board, and the $750K seed (Athens Tech Angels, $375K committed).'
          : 'Help me decide whether to join or start from Builder artefacts.'
      }
      contentClassName="builder-copy overflow-x-clip"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => {
              setStarred(toggleDemoStar(project.id));
            }}
            aria-label={bilingualAria(
              starred ? projectEn('unstar') : projectEn('star'),
              starred ? projectEl('unstar') : projectEl('star'),
            )}
          >
            <Star className={cn('icon-md', starred && 'fill-status-warning text-status-warning')} />
          </Button>
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={handleShare} aria-label={bilingualAria(projectEn('share'), projectEl('share'))}>
            <Share2 className="icon-md" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl" aria-label={bilingualAria(projectEn('more'), projectEl('more'))}>
                <MoreVertical className="icon-md" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={() => ask(
                current.name.includes('Harbor') || current.id === '1'
                  ? 'Draft an edit to this Harbor project from Idea Core, the GTM board, and the $750K seed (Athens Tech Angels, $375K committed).'
                  : 'Draft an edit to this project from Builder artefacts.',
              )}>
                <Edit className="icon-sm mr-2" />
                <BilingualText en={projectEn('edit')} el={projectEl('edit')} compact />
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/projects/${project.id}`}>
                  <CfbGlyph name="discover" className="icon-sm mr-2" />
                  <BilingualText en={projectEn('public_page')} el={projectEl('public_page')} compact />
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive-accessible" onClick={() => void handleDelete()}>
                <Trash2 className="icon-sm mr-2" />
                <BilingualText en={projectEn('delete')} el={projectEl('delete')} compact />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 rounded-xl"
            onClick={() => router.push('/projects')}
            aria-label={bilingualAria(projectEn('back_projects'), projectEl('back_projects'))}
          >
            <ArrowLeft className="icon-md" />
          </Button>
          <CfbGlyph name="briefcase" className="mt-2 icon-md shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="page-section font-semibold text-foreground">{project.name}</h2>
              <Badge variant="outline" className={cn('gap-1 rounded-full text-2xs', STATUS_COLOR[project.status])}>
                <CfbGlyph name={PROJECT_STATUS_GLYPH[project.status]} className="icon-sm" />
                {stageKey ? <BilingualText en={projectEn(stageKey)} el={projectEl(stageKey)} compact /> : project.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {project.taglineEl
                ? <BilingualText en={project.tagline} el={project.taglineEl} wrap />
                : project.tagline}
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          <BilingualText en={projectEn('link_into')} el={projectEl('link_into')} compact />
          {' · '}
          <Link href="/builder?tab=idea-core" className="text-foreground underline-offset-4 hover:underline">
            <BilingualText en={projectEn('link_idea')} el={projectEl('link_idea')} compact />
          </Link>
          {' · '}
          <Link href="/milestones" className="text-foreground underline-offset-4 hover:underline">
            <BilingualText en={projectEn('link_milestones')} el={projectEl('link_milestones')} compact />
          </Link>
          {' · '}
          <Link href="/research" className="text-foreground underline-offset-4 hover:underline">
            <BilingualText en={projectEn('link_research')} el={projectEl('link_research')} compact />
          </Link>
          {' · '}
          <Link href="/fundraising" className="text-foreground underline-offset-4 hover:underline">
            <BilingualText en={projectEn('link_fundraising')} el={projectEl('link_fundraising')} compact />
          </Link>
          {' · '}
          <Link href="/matches" className="text-foreground underline-offset-4 hover:underline">
            <BilingualText en={projectEn('link_matches')} el={projectEl('link_matches')} compact />
          </Link>
        </p>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="rounded-xl">
                <TabsTrigger value="overview" className="rounded-xl"><BilingualText en={projectEn('tab_overview')} el={projectEl('tab_overview')} compact /></TabsTrigger>
                <TabsTrigger value="team" className="rounded-xl"><BilingualText en={projectEn('tab_team')} el={projectEl('tab_team')} compact /></TabsTrigger>
                <TabsTrigger value="milestones" className="rounded-xl"><BilingualText en={projectEn('tab_milestones')} el={projectEl('tab_milestones')} compact /></TabsTrigger>
                <TabsTrigger value="updates" className="rounded-xl"><BilingualText en={projectEn('tab_updates')} el={projectEl('tab_updates')} compact /></TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* What the project needs and offers for it, as a need card. */}
                <ProjectNeedCard projectId={project.id} owned={owned} />
                <Card className="rounded-xl">
                  <CardHeader>
                    <CardTitle><BilingualText en={projectEn('about')} el={projectEl('about')} compact /></CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      {/* Seed projects carry a Greek translation with the same
                          paragraph structure; pair paragraphs by index. User
                          projects have no `descriptionEl` and render as typed. */}
                      {(() => {
                        const elParas = project.descriptionEl?.split('\n\n') ?? [];
                        return project.description.split('\n\n').map((p, i) => (
                          <p key={i} className="text-muted-foreground">
                            {elParas[i] ? <BilingualText en={p} el={elParas[i]} wrap /> : p}
                          </p>
                        ));
                      })()}
                    </div>
                    <FactLine className="mt-4" items={project.tags} />
                  </CardContent>
                </Card>

                {project.rolesNeeded.length > 0 && (
                <Card className="rounded-xl">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle><BilingualText en={projectEn('open_roles')} el={projectEl('open_roles')} compact /></CardTitle>
                    <Badge variant="outline" className="rounded-full">
                      {project.rolesNeeded.length} <BilingualText en={projectEn('positions')} el={projectEl('positions')} compact />
                    </Badge>
                  </CardHeader>
                  <CardContent className="card-rows">
                    {project.rolesNeeded.map((role) => (
                      <div key={role.title} className="min-w-0">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <h4 className="page-section font-semibold text-foreground">
                              {role.titleEl ? <BilingualText en={role.title} el={role.titleEl} wrap /> : role.title}
                            </h4>
                            {role.description ? (
                              <p className="text-sm text-muted-foreground">
                                {role.descriptionEl
                                  ? <BilingualText en={role.description} el={role.descriptionEl} wrap />
                                  : role.description}
                              </p>
                            ) : null}
                          </div>
                          {!owned ? (
                          <Button
                            size="sm"
                            className={BUILDER_BTN}
                            disabled={appliedRoles.includes(role.title)}
                            onClick={() => handleApply(role.title)}
                          >
                            <BilingualText
                              en={appliedRoles.includes(role.title) ? projectEn('applied_btn') : projectEn('apply')}
                              el={appliedRoles.includes(role.title) ? projectEl('applied_btn') : projectEl('apply')}
                              compact
                            />
                          </Button>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {role.commitment ? (
                            <span className="flex items-center gap-1">
                              <CfbGlyph name="briefcase" className="icon-sm" />
                              {role.commitment === 'Full-time'
                                ? <BilingualText en={projectEn('commit_full')} el={projectEl('commit_full')} compact />
                                : role.commitment === 'Part-time'
                                  ? <BilingualText en={projectEn('commit_part')} el={projectEl('commit_part')} compact />
                                  : role.commitment}
                            </span>
                          ) : null}
                          {role.equity ? (
                            <span className="flex items-center gap-1">
                              <CfbGlyph name="chart" className="icon-sm" />
                              {role.equity} <BilingualText en={projectEn('equity')} el={projectEl('equity')} compact />
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {project.rolesNeeded.some((role) => role.equity) ? <NonGuaranteeNote /> : null}
                  </CardContent>
                </Card>
                )}
              </TabsContent>

              <TabsContent value="team" className="space-y-4">
                <Card className="rounded-xl">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle><BilingualText en={projectEn('team_members')} el={projectEl('team_members')} compact /></CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {project.teamSize}/{project.maxTeamSize} <BilingualText en={projectEn('members')} el={projectEl('members')} compact />
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {project.members.map((member) => (
                      <div key={member.id} className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="bg-primary/10 text-primary-accessible">
                            {member.name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <Link href={`/profiles/${member.id}`} className="font-medium text-foreground transition-colors hover:text-primary-accessible">
                            {member.name}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {member.roleEl
                              ? <BilingualText en={member.role} el={member.roleEl} compact />
                              : member.role}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => openAskAi(member.id, 'messages')} aria-label={bilingualAria(`Message ${member.name}`, `Μήνυμα προς ${member.name}`)}>
                            <MessageSquare className="icon-sm" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" asChild aria-label={bilingualAria(`Schedule a call with ${member.name}`, `Προγραμματισμός κλήσης με ${member.name}`)}>
                            <Link href="/calendar">
                              <Video className="icon-sm" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="milestones" className="space-y-4">
                <Card className="rounded-xl">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle><BilingualText en={projectEn('milestones')} el={projectEl('milestones')} compact /></CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {project.progress ?? 0}% <BilingualText en={projectEn('complete_pct')} el={projectEl('complete_pct')} compact />
                    </span>
                  </CardHeader>
                  <CardContent>
                    <Progress value={project.progress ?? 0} className="mb-6 h-2" />
                    <div className="space-y-4">
                      {project.milestones.map((milestone) => (
                        <div key={milestone.id} className="flex items-start gap-4">
                          <div className={cn(
                            'mt-0.5 rounded-full p-1',
                            milestone.status === 'completed' && 'bg-status-success-bg text-status-success',
                            milestone.status === 'in_progress' && 'bg-status-info-bg text-status-info',
                            milestone.status === 'pending' && 'bg-muted text-muted-foreground',
                          )}>
                            {milestone.status === 'completed' ? (
                              <CheckCircle2 className="icon-sm" />
                            ) : milestone.status === 'in_progress' ? (
                              <CfbGlyph name="flag" className="icon-sm" />
                            ) : (
                              <Circle className="icon-sm" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <h4 className={cn('page-section font-medium', milestone.status === 'completed' && 'text-muted-foreground line-through')}>
                                {milestone.titleEl
                                  ? <BilingualText en={milestone.title} el={milestone.titleEl} wrap />
                                  : milestone.title}
                              </h4>
                              <span className="text-sm text-muted-foreground">
                                {formatShortDate(milestone.date, primary) || '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="updates" className="space-y-4">
                <Card className="rounded-xl">
                  <CardHeader>
                    <CardTitle><BilingualText en={projectEn('updates')} el={projectEl('updates')} compact /></CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {project.updates.map((update) => (
                      <div key={update.id} className="border-l-2 border-primary/30 py-2 pl-4">
                        <p className="text-sm text-foreground">
                          {update.contentEl
                            ? <BilingualText en={update.content} el={update.contentEl} wrap />
                            : update.content}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{update.author}</span>
                          <span>•</span>
                          <span>{formatShortDate(update.date, primary) || '—'}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-4">
            <Card className="rounded-xl">
              <CardContent className="space-y-3">
                {owned ? (
                  <p className="text-center text-sm text-muted-foreground">
                    <BilingualText en={projectEn('own_this')} el={projectEl('own_this')} />
                  </p>
                ) : joined ? (
                  <p className="text-center text-sm text-muted-foreground">
                    <BilingualText en={projectEn('on_team')} el={projectEl('on_team')} />
                  </p>
                ) : (
                  <Button
                    className={`w-full gap-2 ${BUILDER_BTN}`}
                    disabled={joinRequested}
                    onClick={handleJoin}
                  >
                    <CfbGlyph name="people" className="icon-sm" />
                    <BilingualText
                      en={joinRequested ? projectEn('requested') : projectEn('request_join')}
                      el={joinRequested ? projectEl('requested') : projectEl('request_join')}
                      compact
                    />
                  </Button>
                )}
                <Button variant="ghost" size="sm" className={`w-full gap-2 ${BUILDER_BTN}`} onClick={() => openAskAi(project.founder.id, 'messages')}>
                  <CfbGlyph name="messages" className="icon-sm" />
                  <BilingualText en={projectEn('message_team')} el={projectEl('message_team')} compact />
                </Button>
                <Button variant="ghost" size="sm" className={`w-full gap-2 ${BUILDER_BTN}`} asChild>
                  <Link href="/calendar">
                    <CfbGlyph name="calendar" className="icon-sm" />
                    <BilingualText en={projectEn('schedule_call')} el={projectEl('schedule_call')} compact />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle><BilingualText en={projectEn('project_info')} el={projectEl('project_info')} compact /></CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {([
                  { glyph: 'briefcase' as const, label: 'info_stage' as const, value: project.stage },
                  { glyph: 'target' as const, label: 'info_industry' as const, value: project.industry },
                  { glyph: 'building' as const, label: 'info_location' as const, value: project.location },
                ]).map((row) => (
                  <div key={row.label} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                      <CfbGlyph name={row.glyph} className="icon-sm text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xs text-muted-foreground">
                        <BilingualText en={projectEn(row.label)} el={projectEl(row.label)} compact />
                      </p>
                      <p className="text-sm font-medium">{row.value || '—'}</p>
                    </div>
                  </div>
                ))}
                {project.website ? (
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                      <CfbGlyph name="discover" className="icon-sm text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xs text-muted-foreground">
                        <BilingualText en={projectEn('info_website')} el={projectEl('info_website')} compact />
                      </p>
                      <a href={project.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary-accessible hover:underline">
                        {project.website.replace('https://', '')}
                      </a>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted">
                    <CfbGlyph name="calendar" className="icon-sm text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-2xs text-muted-foreground">
                      <BilingualText en={projectEn('info_founded')} el={projectEl('info_founded')} compact />
                    </p>
                    <p className="text-sm font-medium">{formatShortDate(project.createdAt, primary) || '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle><BilingualText en={projectEn('founder')} el={projectEl('founder')} compact /></CardTitle>
              </CardHeader>
              <CardContent>
                <Link href={`/profiles/${project.founder.id}`} className="group flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={project.founder.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary-accessible">
                      {project.founder.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground transition-colors group-hover:text-primary-accessible">
                      {project.founder.name}
                    </p>
                    <RoleBadge role={project.founder.role} size="sm" />
                  </div>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
