'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings, Globe, Lock, Users, ChevronDown, Shield, UserMinus, Crown,
  Copy, Check, Loader2, X, Eye, Edit3, UserPlus, Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { qk } from '@/lib/query-keys';
import {
  updateResearchBoard,
  listResearchCollaborators,
  addResearchCollaborator,
  updateResearchCollaborator,
  removeResearchCollaborator,
  searchProfiles,
  getUserOrganizations,
  type SearchHit,
  type ResearchBoard,
  type ResearchCollaborator,
  type OrgMembershipItem,
  type ResearchBoardVisibility,
} from '@/lib/api';
import { bilingualInline } from '@/lib/i18n/format';

interface BoardSettingsPanelProps {
  board: ResearchBoard;
  open: boolean;
  onClose: () => void;
  currentUserId: string;
}

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private', icon: Lock, desc: 'Only you and collaborators' },
  { value: 'team', label: 'Team', icon: Users, desc: 'All team members' },
  { value: 'organization', label: 'Organization', icon: Shield, desc: 'All org members' },
  { value: 'public', label: 'Public', icon: Globe, desc: 'Anyone with the link' },
] as const;

const ROLE_LABELS: Record<string, { label: string; icon: React.ElementType; desc: string }> = {
  owner: { label: 'Owner', icon: Crown, desc: 'Full control' },
  admin: { label: 'Admin', icon: Shield, desc: 'Can manage collaborators' },
  editor: { label: 'Editor', icon: Edit3, desc: 'Can edit nodes' },
  viewer: { label: 'Viewer', icon: Eye, desc: 'Read-only access' },
};

function CollaboratorRow({
  collab,
  isOwner,
  currentUserId,
  boardId,
  onUpdated,
}: {
  collab: ResearchCollaborator;
  isOwner: boolean;
  currentUserId: string;
  boardId: string;
  onUpdated: () => void;
}) {
  const { success, error: showError } = useToast();
  const roleInfo = ROLE_LABELS[collab.role] ?? ROLE_LABELS.viewer;
  const RoleIcon = roleInfo.icon;
  const canManage = isOwner && collab.role !== 'owner';

  const updateMutation = useMutation({
    mutationFn: (role: 'viewer' | 'editor' | 'admin') =>
      updateResearchCollaborator(boardId, collab.userId, role),
    onSuccess: () => { onUpdated(); success('Role updated', ''); },
    onError: () => showError('Failed', 'Could not update role'),
  });

  const removeMutation = useMutation({
    mutationFn: () => removeResearchCollaborator(boardId, collab.userId),
    onSuccess: () => { onUpdated(); success('Removed', 'Collaborator removed'); },
    onError: () => showError('Failed', 'Could not remove collaborator'),
  });

  return (
    <div className="flex items-center gap-3 py-2.5 border-b last:border-0">
      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden shrink-0">
        {collab.avatarUrl ? (
          <img src={collab.avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
        ) : (
          <span className="text-xs font-semibold text-primary-accessible">
            {(collab.displayName ?? collab.email)[0].toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{collab.displayName ?? collab.email}</p>
        {collab.headline && <p className="text-xs text-muted-foreground truncate">{collab.headline}</p>}
      </div>
      <div className="flex items-center gap-2">
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" disabled={updateMutation.isPending}>
                <RoleIcon className="icon-sm" />
                {roleInfo.label}
                <ChevronDown className="icon-sm" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(['viewer', 'editor', 'admin'] as const).map((r) => {
                const info = ROLE_LABELS[r];
                const Icon = info.icon;
                return (
                  <DropdownMenuItem
                    key={r}
                    onClick={() => updateMutation.mutate(r)}
                    className={cn('gap-2', collab.role === r && 'text-primary-accessible')}
                  >
                    <Icon className="icon-sm" />
                    <div>
                      <p className="text-sm">{info.label}</p>
                      <p className="text-xs text-muted-foreground">{info.desc}</p>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-1 text-xs text-muted-foreground px-2">
            <RoleIcon className="icon-sm" />
            <span>{roleInfo.label}</span>
          </div>
        )}
        {canManage && (
          <Button aria-label="Remove member"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive-accessible"
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
          >
            <UserMinus className="icon-sm" />
          </Button>
        )}
        {!isOwner && collab.userId === currentUserId && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-destructive-accessible"
            onClick={() => removeMutation.mutate()}
          >
            Leave
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Organization Ownership Section ─── */
function OrgOwnershipSection({
  board,
  onUpdate,
}: {
  board: ResearchBoard;
  onUpdate: (data: { visibility?: ResearchBoardVisibility }) => void;
}) {
  const { data: orgData, isLoading } = useQuery({
    queryKey: qk('org', 'my-memberships'),
    queryFn: () => getUserOrganizations(),
  });

  const memberships = orgData?.memberships ?? [];
  const currentOrgId = (board as ResearchBoard & { orgId?: string | null }).orgId;

  return (
    <div className="space-y-2">
      <p id="bsp-org" className="text-sm font-semibold flex items-center gap-1.5">
        <Building2 className="icon-sm text-muted-foreground" />
        Organization Ownership
      </p>
      <p className="text-xs text-muted-foreground">
        Assign this board to an organization to share it with all members.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="icon-sm animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading organizations…</span>
        </div>
      ) : memberships.length === 0 ? (
        <div className="rounded-lg border border-border p-3 text-center">
          <Building2 className="icon-md mx-auto mb-1.5 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">You don&apos;t belong to any organizations yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-1.5" role="group" aria-labelledby="bsp-org">
          {/* Personal (no org) option */}
          <button
            onClick={() => !currentOrgId ? undefined : onUpdate({ visibility: 'private' })}
            className={cn(
              'flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all',
              !currentOrgId
                ? 'border-primary bg-primary/5 text-primary-accessible'
                : 'border-border hover:border-primary/40',
            )}
          >
            <Lock className="icon-sm shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Personal</p>
              <p className="text-xs text-muted-foreground">Owned by you only</p>
            </div>
            {!currentOrgId && <Check className="icon-sm text-primary-accessible shrink-0" />}
          </button>

          {/* Org options */}
          {memberships.map((m) => {
            const isActive = currentOrgId === m.organizationId;
            return (
              <button
                key={m.organizationId}
                onClick={() => {
                  if (!isActive) onUpdate({ visibility: 'organization' });
                }}
                className={cn(
                  'flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all',
                  isActive
                    ? 'border-primary bg-primary/5 text-primary-accessible'
                    : 'border-border hover:border-primary/40',
                )}
              >
                {m.organization.avatarUrl ? (
                  <img src={m.organization.avatarUrl} alt="" className="h-6 w-6 rounded-md object-cover shrink-0" loading="lazy" decoding="async" referrerPolicy="no-referrer" width={24} height={24} />
                ) : (
                  <div className="h-6 w-6 rounded-md bg-primary/20 flex items-center justify-center shrink-0">
                    <Building2 className="icon-sm text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.organization.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                </div>
                {isActive && <Check className="icon-sm text-primary-accessible shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BoardSettingsPanel({ board, open, onClose, currentUserId }: BoardSettingsPanelProps) {
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  const [activeTab, setActiveTab] = useState<'general' | 'sharing'>('general');
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor' | 'admin'>('viewer');
  const [copied, setCopied] = useState(false);
  const isOwner = board.ownerId === currentUserId;

  const { data: collabData, refetch: refetchCollabs } = useQuery({
    queryKey: qk('research-boards', 'collaborators', board.id),
    queryFn: () => listResearchCollaborators(board.id),
    enabled: open,
  });

  const { data: searchData } = useQuery<{ hits: SearchHit[]; total: number }>({
    queryKey: qk('user-search-invite', inviteQuery),
    queryFn: () => searchProfiles({ q: inviteQuery, limit: 5 }),
    enabled: inviteQuery.length >= 2,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateResearchBoard>[1]) => updateResearchBoard(board.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('research-boards', 'board', board.id) });
      queryClient.invalidateQueries({ queryKey: qk('research-boards') });
      success('Board updated', '');
    },
    onError: () => showError('Failed', 'Could not update board settings'),
  });

  const addCollabMutation = useMutation({
    mutationFn: (userId: string) => addResearchCollaborator(board.id, { userId, role: inviteRole }),
    onSuccess: () => {
      refetchCollabs();
      setInviteQuery('');
      success('Invited', 'Collaborator added to the board');
    },
    onError: () => showError('Failed', 'Could not add collaborator'),
  });

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/research/${board.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      success('Copied', 'Board link copied to clipboard');
    } catch {
      showError('Failed', 'Could not copy link');
    }
  }, [board.id, success, showError]);

  const currentVisibility = VISIBILITY_OPTIONS.find((v) => v.value === board.visibility) ?? VISIBILITY_OPTIONS[0];
  const VisIcon = currentVisibility.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="icon-sm" />
            Board Settings
          </DialogTitle>
          <DialogDescription>Manage visibility and collaborators for "{board.title}"</DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-0 border-b px-6 mt-4">
          {(['general', 'sharing'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'text-sm font-medium py-2.5 px-4 border-b-2 capitalize transition-colors',
                activeTab === tab
                  ? 'border-primary text-primary-accessible'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {activeTab === 'general' && (
            <>
              {/* Visibility */}
              <div className="space-y-2">
                <p id="bsp-visibility" className="text-sm font-semibold">Visibility</p>
                <div className="grid grid-cols-1 gap-2" role="group" aria-labelledby="bsp-visibility">
                  {VISIBILITY_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    const isActive = board.visibility === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => isOwner && updateMutation.mutate({ visibility: opt.value })}
                        disabled={!isOwner}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
                          isActive
                            ? 'border-primary bg-primary/5 text-primary-accessible'
                            : 'border-border hover:border-primary/40',
                          !isOwner && 'cursor-not-allowed opacity-60',
                        )}
                      >
                        <Icon className="icon-sm shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                        {isActive && <Check className="icon-sm text-primary-accessible shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Organization Ownership */}
              {isOwner && (
                <OrgOwnershipSection board={board} onUpdate={(data) => updateMutation.mutate(data as Parameters<typeof updateResearchBoard>[1])} />
              )}

              {/* Share Link */}
              <div className="space-y-2">
                <label htmlFor="bsp-f1" className="text-sm font-semibold">Share Link</label>
                <div className="flex gap-2">
                  <Input id="bsp-f1"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/research/${board.id}`}
                    className="text-xs text-muted-foreground bg-secondary/50"
                  />
                  <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5 shrink-0">
                    {copied ? <Check className="icon-sm" /> : <Copy className="icon-sm" />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'sharing' && (
            <>
              {/* Invite */}
              {isOwner && (
                <div className="space-y-2">
                  <label htmlFor="bsp-f2" className="text-sm font-semibold">Invite Collaborators</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input id="bsp-f2"
                        placeholder={bilingualInline("Search users by name…", "Αναζήτηση χρηστών με όνομα…")}
                        value={inviteQuery}
                        onChange={(e) => setInviteQuery(e.target.value)}
                        className="pr-3"
                      />
                      {searchData && inviteQuery.length >= 2 && searchData.hits.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border rounded-lg shadow-lg overflow-hidden">
                          {searchData.hits.map((hit) => (
                            <button
                              key={hit.userId}
                              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent text-left"
                              onClick={() => { addCollabMutation.mutate(hit.userId); }}
                            >
                              {hit.avatarUrl ? (
                                <img src={hit.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" loading="lazy" decoding="async" referrerPolicy="no-referrer" width={24} height={24} />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                  <span className="text-xs font-bold text-primary-accessible">{(hit.displayName ?? 'U')[0]}</span>
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm truncate">{hit.displayName ?? 'Unknown'}</p>
                                {hit.headline && <p className="text-xs text-muted-foreground truncate">{hit.headline}</p>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1 shrink-0 capitalize">
                          {inviteRole}
                          <ChevronDown className="icon-sm" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(['viewer', 'editor', 'admin'] as const).map((r) => (
                          <DropdownMenuItem key={r} onClick={() => setInviteRole(r)} className="capitalize">
                            {ROLE_LABELS[r].label}
                            <span className="ml-2 text-xs text-muted-foreground">{ROLE_LABELS[r].desc}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )}

              {/* Collaborators List */}
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  People with access
                  {collabData && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      ({1 + (collabData.collaborators?.length ?? 0)})
                    </span>
                  )}
                </p>
                {collabData ? (
                  <div className="border rounded-lg px-3">
                    <CollaboratorRow
                      key="owner"
                      collab={collabData.owner}
                      isOwner={isOwner}
                      currentUserId={currentUserId}
                      boardId={board.id}
                      onUpdated={refetchCollabs}
                    />
                    {collabData.collaborators.map((c) => (
                      <CollaboratorRow
                        key={c.userId}
                        collab={c}
                        isOwner={isOwner}
                        currentUserId={currentUserId}
                        boardId={board.id}
                        onUpdated={refetchCollabs}
                      />
                    ))}
                    {collabData.collaborators.length === 0 && (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        <UserPlus className="icon-lg mx-auto mb-2 opacity-40" />
                        No collaborators yet
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="icon-md animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
