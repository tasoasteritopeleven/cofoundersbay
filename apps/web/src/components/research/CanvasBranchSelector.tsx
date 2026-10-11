'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GitBranch, ChevronDown, Check, Plus, Loader2, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { listCanvasBranches, type CanvasBranch } from '@/lib/api';
import { qk } from '@/lib/query-keys';

interface CanvasBranchSelectorProps {
  boardId: string;
  activeBranchId?: string | null;
  onBranchSelect: (branchId: string | null, branchName: string | null) => void;
  onCreateBranch?: () => void;
  className?: string;
}

export function CanvasBranchSelector({
  boardId,
  activeBranchId,
  onBranchSelect,
  onCreateBranch,
  className,
}: CanvasBranchSelectorProps) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: qk('research-boards', 'branches', boardId),
    queryFn: () => listCanvasBranches(boardId),
    enabled: open || !!activeBranchId,
    staleTime: 30_000,
  });

  const branches: CanvasBranch[] = data ?? [];
  const activeBranch = branches.find((b) => b.id === activeBranchId) ?? null;
  const label = activeBranch?.name ?? 'main';

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('h-8 gap-1.5 px-2.5 text-xs font-medium', className)}
        >
          <GitBranch className="icon-sm text-status-accent" />
          <span className="max-w-[100px] truncate">{label}</span>
          {isLoading && <Loader2 className="icon-sm animate-spin ml-0.5" />}
          {!isLoading && <ChevronDown className="icon-sm opacity-50 ml-0.5" />}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Switch branch
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Mainline */}
        <DropdownMenuItem
          className="flex items-center justify-between gap-2 cursor-pointer"
          onClick={() => { onBranchSelect(null, null); setOpen(false); }}
        >
          <div className="flex items-center gap-2">
            <GitBranch className="icon-sm text-muted-foreground" />
            <span className="text-sm">main</span>
            <Badge variant="secondary" className="text-2xs px-1.5 py-0 h-4">default</Badge>
          </div>
          {!activeBranchId && <Check className="icon-sm text-primary-accessible shrink-0" />}
        </DropdownMenuItem>

        {branches.filter((b) => !b.isDefault).length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-2xs text-muted-foreground font-normal uppercase tracking-wide px-2">
              Branches
            </DropdownMenuLabel>
            {branches
              .filter((b) => !b.isDefault)
              .map((b) => (
                <DropdownMenuItem
                  key={b.id}
                  className={cn(
                    'flex items-center justify-between gap-2 cursor-pointer',
                    b.status !== 'active' && 'opacity-50',
                  )}
                  onClick={() => { onBranchSelect(b.id, b.name); setOpen(false); }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {b.status === 'archived' ? (
                      <Archive className="icon-sm text-muted-foreground shrink-0" />
                    ) : (
                      <GitBranch className="icon-sm text-status-accent shrink-0" />
                    )}
                    <span className="text-sm truncate">{b.name}</span>
                    {b.status === 'merged' && (
                      <Badge variant="outline" className="text-2xs px-1.5 py-0 h-4 shrink-0 text-status-accent border-status-accent-border">merged</Badge>
                    )}
                  </div>
                  {activeBranchId === b.id && <Check className="icon-sm text-primary-accessible shrink-0" />}
                </DropdownMenuItem>
              ))}
          </>
        )}

        {onCreateBranch && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 cursor-pointer text-primary-accessible"
              onClick={() => { setOpen(false); onCreateBranch(); }}
            >
              <Plus className="icon-sm" />
              <span className="text-sm">New branch…</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
