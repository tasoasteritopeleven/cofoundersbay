'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Plus, Search, MoreVertical, Pin, Archive, Trash2,
  Grid3X3, List, Loader2, AlertCircle, Copy, ArchiveRestore, ArrowRight,
} from 'lucide-react';
import type { Locale } from 'date-fns';
import { el as elLocale, enUS } from 'date-fns/locale';
import { AppShell } from '@/components/layout/AppShell';
import type { PageRailSection } from '@/components/layout/PageRail';
import { CANCELLED, choiceControl, ROW_GONE, rowOptions, settle, usePageControls, usePageList, type PageControlRunResult } from '@/lib/page-controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { useConfirm, deleteConfirmCopy } from '@/components/ui/confirm-dialog';
import { BilingualText } from '@/components/common/BilingualText';
import { RelativeTime } from '@/components/common/RelativeTime';
import { CfbGlyph, type CfbGlyphName } from '@/components/icons/CfbGlyph';
import { bilingualAria } from '@/lib/i18n/format';
import { commonEn, commonEl } from '@/lib/i18n/strings-common';
import {
  researchEn,
  researchEl,
  useResearchPrimaryText,
  RESEARCH_TAG_EL,
} from '@/lib/i18n/strings-research';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';
import {
  listResearchBoards,
  createResearchBoard,
  createResearchNode,
  updateResearchBoard,
  deleteResearchBoard,
  getResearchBoard,
  type ResearchBoard,
} from '@/lib/api';
import {
  BoardTemplatesDialog,
  BOARD_TEMPLATES,
  ResearchTemplateTile,
  type BoardTemplate,
} from '@/components/research/BoardTemplates';
import { BehavioralNudge } from '@/components/behavioral/BehavioralNudge';
import { BUILDER_BTN } from '@/components/builder/BuilderStageChrome';
import { builderEn, builderEl } from '@/lib/i18n/strings-builder';
import { qk } from '@/lib/query-keys';
import { FirstRunTour, type TourStep } from '@/components/common/FirstRunTour';

import { pressableProps } from '@/lib/pressable';
const RESEARCH_TOUR: TourStep[] = [
  {
    target: 'research-actions',
    titleEn: 'Start a board two ways',
    titleEl: 'Ξεκινήστε πίνακα με δύο τρόπους',
    bodyEn: '"Use template" seeds a board with a proven structure — validation, market, competitors, pitch. "New board" starts from a blank canvas you shape yourself.',
    bodyEl: 'Το «Χρήση προτύπου» γεμίζει έναν πίνακα με δοκιμασμένη δομή — επικύρωση, αγορά, ανταγωνιστές, pitch. Το «Νέος πίνακας» ξεκινά από κενό καμβά που διαμορφώνετε εσείς.',
  },
  {
    target: 'research-boards',
    titleEn: 'Your boards',
    titleEl: 'Οι πίνακές σας',
    bodyEn: 'Open a board to add notes, files and links as connected nodes. The card menu pins a board to the top, duplicates, archives or deletes it.',
    bodyEl: 'Ανοίξτε έναν πίνακα για να προσθέσετε σημειώσεις, αρχεία και συνδέσμους ως συνδεδεμένους κόμβους. Το μενού της κάρτας καρφιτσώνει τον πίνακα στην κορυφή, τον αντιγράφει, τον αρχειοθετεί ή τον διαγράφει.',
  },
  {
    target: 'research-templates',
    titleEn: 'Templates connect to the Builder',
    titleEl: 'Τα πρότυπα συνδέονται με τον Builder',
    bodyEn: 'Each template maps to a Builder stage, so what you capture here — interviews, market sizing, competitor notes — feeds Idea Core and Market Analysis directly.',
    bodyEl: 'Κάθε πρότυπο αντιστοιχεί σε στάδιο του Builder, ώστε όσα καταγράφετε εδώ — συνεντεύξεις, μέγεθος αγοράς, σημειώσεις ανταγωνισμού — να τροφοδοτούν απευθείας τον Πυρήνα ιδέας και την Ανάλυση αγοράς.',
  },
];

// Sized by the column, not the viewport: pinning the page tools narrows the column and breakpoints cannot see it.
const BOARD_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))] gap-5';

const BOARD_COLORS: { nameKey: 'color_default' | 'color_blue' | 'color_green' | 'color_purple' | 'color_orange' | 'color_pink' | 'color_cyan'; value: string | null }[] = [
  { nameKey: 'color_default', value: null },
  { nameKey: 'color_blue', value: '#3B82F6' },
  { nameKey: 'color_green', value: '#22C55E' },
  { nameKey: 'color_purple', value: '#A855F7' },
  { nameKey: 'color_orange', value: '#F97316' },
  { nameKey: 'color_pink', value: '#EC4899' },
  { nameKey: 'color_cyan', value: '#06B6D4' },
];

const BOARD_ICONS: { nameKey: 'icon_document' | 'icon_image' | 'icon_link' | 'icon_note' | 'icon_sparkles'; value: string; glyph: CfbGlyphName }[] = [
  { nameKey: 'icon_document', value: 'document', glyph: 'book' },
  { nameKey: 'icon_image', value: 'image', glyph: 'bookmark' },
  { nameKey: 'icon_link', value: 'link', glyph: 'compare' },
  { nameKey: 'icon_note', value: 'note', glyph: 'research' },
  { nameKey: 'icon_sparkles', value: 'sparkles', glyph: 'spark' },
];

function getBoardGlyph(iconValue: string | null): CfbGlyphName {
  return BOARD_ICONS.find((i) => i.value === iconValue)?.glyph ?? 'research';
}

/**
 * Greek for the preview board seeded by `lib/preview-api.ts`. Keyed by the
 * exact English description, so user-authored boards are never touched.
 */
const PREVIEW_BOARD_DESC_EL: Record<string, string> = {
  'Harbor GTM notes aligned with Idea Core and the $750K seed.':
    'Σημειώσεις GTM του Harbor σε συμφωνία με τον Πυρήνα ιδέας και τον γύρο $750K.',
};

const PREVIEW_BOARD_TITLE_EL: Record<string, string> = {
  'Go-to-market canvas': 'Καμβάς εισόδου στην αγορά',
};

type BoardFilter = 'all' | 'pinned' | 'empty' | 'archived';
type BoardSort = 'updated' | 'title' | 'nodes';

function sortBoards(list: ResearchBoard[], sort: BoardSort): ResearchBoard[] {
  const copy = [...list];
  if (sort === 'title') {
    copy.sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === 'nodes') {
    copy.sort((a, b) => b.nodeCount - a.nodeCount || a.title.localeCompare(b.title));
  } else {
    copy.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }
  return copy;
}

export default function ResearchBoardsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { success, error: showError } = useToast();
  const confirm = useConfirm();
  const t = useResearchPrimaryText();
  const { primary } = useLanguagePreference();
  const dateLocale = primary === 'el' ? elLocale : enUS;

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<BoardFilter>('all');
  const [sort, setSort] = useState<BoardSort>('updated');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [newBoardColor, setNewBoardColor] = useState<string | null>(null);
  const [newBoardIcon, setNewBoardIcon] = useState<string>('document');

  const showArchived = filter === 'archived';
  const { data, isLoading, error } = useQuery({
    queryKey: qk('research-boards', showArchived),
    queryFn: () => listResearchBoards({ archived: showArchived }),
  });
  const bootLoad = isLoading && !data && filter === 'all';

  const createMutation = useMutation({
    mutationFn: createResearchBoard,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: qk('research-boards') });
      success('Board created');
      setCreateDialogOpen(false);
      setNewBoardTitle('');
      setNewBoardDescription('');
      setNewBoardColor(null);
      setNewBoardIcon('document');
      router.push(`/research/${result.board.id}`);
    },
    onError: () => {
      showError('Failed to create board', 'Please try again');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ boardId, data }: { boardId: string; data: Parameters<typeof updateResearchBoard>[1] }) =>
      updateResearchBoard(boardId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk('research-boards') });
      if (variables.data.isArchived === true) success('Board archived');
      if (variables.data.isArchived === false) success('Board restored');
    },
    onError: () => {
      showError('Could not update your board', 'Please try again');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteResearchBoard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('research-boards') });
      success('Board deleted');
    },
    onError: () => {
      showError('Failed to delete', 'Please try again');
    },
  });

  const boards = data?.boards ?? [];
  const filteredBoards = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let list = boards.filter((b) =>
      b.title.toLowerCase().includes(q) ||
      b.description?.toLowerCase().includes(q) ||
      b.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
    if (filter === 'pinned') list = list.filter((b) => b.isPinned);
    if (filter === 'empty') list = list.filter((b) => b.nodeCount === 0);
    return sortBoards(list, sort);
  }, [boards, searchQuery, filter, sort]);

  const pinnedBoards = filteredBoards.filter((b) => b.isPinned);
  const regularBoards = filteredBoards.filter((b) => !b.isPinned);
  const useSplit = filter === 'all';
  const totalNodes = boards.reduce((sum, b) => sum + (b.nodeCount ?? 0), 0);
  const pinnedCount = boards.filter((b) => b.isPinned).length;
  const latest = sortBoards(boards, 'updated')[0] ?? null;

  const handleCreateBoard = () => {
    if (!newBoardTitle.trim()) return;
    createMutation.mutate({
      title: newBoardTitle.trim(),
      description: newBoardDescription.trim() || undefined,
      color: newBoardColor ?? undefined,
      icon: newBoardIcon,
    });
  };

  // Each settles with the server and says when the reader declined, so the
  // assistant reports a board change only once it is stored.
  const handleTogglePin = (board: ResearchBoard): Promise<PageControlRunResult> =>
    settle(() => updateMutation.mutateAsync({ boardId: board.id, data: { isPinned: !board.isPinned } }));

  const handleArchive = async (board: ResearchBoard): Promise<PageControlRunResult> => {
    const ok = await confirm({
      title: <BilingualText en={`Archive board “${board.title}”?`} el={`Αρχειοθέτηση πίνακα “${board.title}”;`} />,
      description: (
        <BilingualText
          en="It moves out of your active boards. You can restore it later."
          el="Μεταφέρεται εκτός των ενεργών πινάκων. Μπορείτε να τον επαναφέρετε αργότερα."
        />
      ),
      confirmLabel: <BilingualText en={researchEn('archive')} el={researchEl('archive')} compact />,
      variant: 'default',
    });
    if (!ok) return CANCELLED;
    return settle(() => updateMutation.mutateAsync({ boardId: board.id, data: { isArchived: true } }));
  };

  const handleRestore = async (board: ResearchBoard): Promise<PageControlRunResult> => {
    const ok = await confirm({
      title: <BilingualText en={researchEn('restore_title')} el={researchEl('restore_title')} />,
      description: <BilingualText en={researchEn('restore_desc')} el={researchEl('restore_desc')} />,
      confirmLabel: <BilingualText en={researchEn('restore')} el={researchEl('restore')} compact />,
      variant: 'default',
    });
    if (!ok) return CANCELLED;
    return settle(() => updateMutation.mutateAsync({ boardId: board.id, data: { isArchived: false } }));
  };

  const handleDelete = async (board: ResearchBoard): Promise<PageControlRunResult> => {
    if (!(await confirm(deleteConfirmCopy({ en: 'board', el: 'πίνακα' }, board.title)))) return CANCELLED;
    return settle(() => deleteMutation.mutateAsync(board.id));
  };

  const handleDuplicate = async (board: ResearchBoard): Promise<PageControlRunResult> => {
    try {
      const full = await getResearchBoard(board.id);
      const result = await createResearchBoard({
        title: `${board.title}${t(researchEn('copy_suffix'), researchEl('copy_suffix'))}`,
        description: board.description ?? undefined,
        color: board.color ?? undefined,
        icon: board.icon ?? undefined,
        tags: board.tags,
      });
      if (!result?.board) throw new Error('Board was not created');
      for (const node of full.board.nodes) {
        await createResearchNode(result.board.id, {
          type: node.type,
          title: node.title ?? undefined,
          content: node.content ?? undefined,
          url: node.url ?? undefined,
          posX: node.posX,
          posY: node.posY,
          width: node.width,
          height: node.height,
          color: node.color ?? undefined,
          metadata: node.metadata ?? undefined,
          tags: node.tags,
        });
      }
      queryClient.invalidateQueries({ queryKey: qk('research-boards') });
      success('Board duplicated');
      router.push(`/research/${result.board.id}`);
    } catch (err) {
      showError('Failed to duplicate', 'Please try again');
      return { error: err instanceof Error && err.message ? err.message : 'The board was not duplicated.' };
    }
  };

  const handleSelectTemplate = async (template: BoardTemplate) => {
    try {
      const result = await createResearchBoard({
        title: template.name,
        description: template.description,
        color: template.color,
        tags: template.tags,
      });
      if (!result?.board) throw new Error('Board was not created');

      for (const node of template.initialNodes) {
        await createResearchNode(result.board.id, {
          type: node.type,
          title: node.title,
          content: node.content,
          posX: node.posX,
          posY: node.posY,
          width: node.width,
          height: node.height,
          color: node.color,
        });
      }

      queryClient.invalidateQueries({ queryKey: qk('research-boards') });
      success('Board created from template');
      router.push(`/research/${result.board.id}`);
    } catch {
      showError('Failed to create from template', 'Please try again');
    }
  };

  const cardHandlers = (board: ResearchBoard) => ({
    onOpen: () => router.push(`/research/${board.id}`),
    onTogglePin: () => handleTogglePin(board),
    onArchive: () => handleArchive(board),
    onRestore: () => handleRestore(board),
    onDuplicate: () => handleDuplicate(board),
    onDelete: () => handleDelete(board),
  });

  const filters: { id: BoardFilter; labelEn: string; labelEl: string }[] = [
    { id: 'all', labelEn: researchEn('filter_all'), labelEl: researchEl('filter_all') },
    { id: 'pinned', labelEn: researchEn('pinned'), labelEl: researchEl('pinned') },
    { id: 'empty', labelEn: researchEn('filter_empty'), labelEl: researchEl('filter_empty') },
    { id: 'archived', labelEn: researchEn('filter_archived'), labelEl: researchEl('filter_archived') },
  ];

  const sorts: { id: BoardSort; labelEn: string; labelEl: string }[] = [
    { id: 'updated', labelEn: researchEn('sort_updated'), labelEl: researchEl('sort_updated') },
    { id: 'title', labelEn: researchEn('sort_title'), labelEl: researchEl('sort_title') },
    { id: 'nodes', labelEn: researchEn('sort_nodes'), labelEl: researchEl('sort_nodes') },
  ];

  /*
   * What counts the list, and what narrows it.
   *
   * The boards are the page, and so are the two ways to start one - the
   * header buttons and the template cards, which for a founder with no
   * boards are the way in. These two are not: three tiles counting what the
   * list already shows, and twelve controls in a row above it.
   */
  // Offered to the assistant: the rail's filter and sort and the layout
  // switch, through the same setters. Board-level work is canvas_command.
  usePageControls([
    choiceControl('board_filter', 'Board filter', 'Φίλτρο πινάκων', filters.map((f) => ({ key: f.id, labelEn: f.labelEn, labelEl: f.labelEl })), filter, (v) => setFilter(v as BoardFilter)),
    choiceControl('sort', 'Sort boards', 'Ταξινόμηση πινάκων', sorts.map((o) => ({ key: o.id, labelEn: o.labelEn, labelEl: o.labelEl })), sort, (v) => setSort(v as BoardSort)),
    choiceControl('view', 'Board layout', 'Διάταξη πινάκων', [
      { value: 'grid', en: 'Grid', el: 'Πλέγμα' },
      { value: 'list', en: 'List', el: 'Λίστα' },
    ], viewMode, (v) => setViewMode(v as 'grid' | 'list')),
    // The board menu's own actions over the boards on screen - the same
    // handlers, so Archive, Restore and Delete still ask first.
    ...(() => {
      const byTitle = (list: ResearchBoard[]) => rowOptions(list, (b) => b.id, (b) => b.title);
      const board = (id?: string) => filteredBoards.find((b) => b.id === id);
      const active = filteredBoards.filter((b) => !b.isArchived);
      return [
        // updateBoard writes only the fields it is sent (research.service), so
        // pin / unpin and archive / restore are each other's exact opposite.
        { id: 'pin_board', labelEn: 'Pin board', labelEl: 'Καρφίτσωμα πίνακα', writes: true, options: byTitle(active.filter((b) => !b.isPinned)), undo: (v?: string) => ({ control: 'unpin_board', value: v }), run: (v?: string) => { const b = board(v); return b ? handleTogglePin(b) : ROW_GONE; } },
        { id: 'unpin_board', labelEn: 'Unpin board', labelEl: 'Ξεκαρφίτσωμα πίνακα', writes: true, options: byTitle(filteredBoards.filter((b) => b.isPinned)), undo: (v?: string) => ({ control: 'pin_board', value: v }), run: (v?: string) => { const b = board(v); return b ? handleTogglePin(b) : ROW_GONE; } },
        { id: 'duplicate_board', labelEn: 'Duplicate board', labelEl: 'Δημιουργία αντιγράφου πίνακα', writes: true, options: byTitle(filteredBoards), run: (v?: string) => { const b = board(v); return b ? handleDuplicate(b) : ROW_GONE; } },
        { id: 'archive_board', labelEn: 'Archive board', labelEl: 'Αρχειοθέτηση πίνακα', writes: true, options: byTitle(active), undo: (v?: string) => ({ control: 'restore_board', value: v }), run: (v?: string) => { const b = board(v); return b ? handleArchive(b) : ROW_GONE; } },
        { id: 'restore_board', labelEn: 'Restore archived board', labelEl: 'Επαναφορά αρχειοθετημένου πίνακα', writes: true, options: byTitle(filteredBoards.filter((b) => b.isArchived)), undo: (v?: string) => ({ control: 'archive_board', value: v }), run: (v?: string) => { const b = board(v); return b ? handleRestore(b) : ROW_GONE; } },
        { id: 'delete_board', labelEn: 'Delete board', labelEl: 'Διαγραφή πίνακα', writes: true, options: byTitle(filteredBoards), run: (v?: string) => { const b = board(v); return b ? handleDelete(b) : ROW_GONE; } },
      ];
    })(),
  ]);
  usePageList([
    {
      id: 'boards',
      labelEn: 'Research boards',
      labelEl: 'Πίνακες έρευνας',
      rows: isLoading ? undefined : filteredBoards.map((b) =>
        `${b.title} · ${b.nodeCount} nodes${b.isPinned ? ' · pinned' : ''}${b.isArchived ? ' · archived' : ''} · updated ${b.updatedAt.slice(0, 10)}`,
      ),
      total: boards.length,
    },
  ]);

  const rail: PageRailSection[] = [
    {
      id: 'summary',
      glyph: 'chart',
      labelEn: 'Summary',
      labelEl: 'Σύνοψη',
      content: (
        // Same tile as the Builder rail: figure first, name under it, glyph aside.
        <div className="grid grid-cols-1 gap-2">
          <div className="rounded-xl border border-border bg-card/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="page-stat font-semibold tabular-nums">{boards.length}</span>
                  <span className="page-stat-label text-muted-foreground">
                    {pinnedCount}{' '}
                    <BilingualText
                      en={researchEn('stat_pinned_n')}
                      el={researchEl(pinnedCount === 1 ? 'stat_pinned_n_one' : 'stat_pinned_n')}
                      compact
                    />
                  </span>
                </div>
                <p className="page-stat-label mt-0.5 font-medium text-foreground">
                  <BilingualText en={researchEn('stat_boards')} el={researchEl('stat_boards')} compact wrap />
                </p>
                <p className="page-stat-label mt-0.5 leading-snug text-muted-foreground">
                  <BilingualText en={researchEn('stat_boards_hint')} el={researchEl('stat_boards_hint')} wrap />
                </p>
              </div>
              <CfbGlyph name="research" className="icon-sm shrink-0 text-muted-foreground/70" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="page-stat font-semibold tabular-nums">{totalNodes}</span>
                  <span className="page-stat-label text-muted-foreground">
                    <BilingualText en={researchEn('items')} el={researchEl('items')} compact />
                  </span>
                </div>
                <p className="page-stat-label mt-0.5 font-medium text-foreground">
                  <BilingualText en={researchEn('stat_notes')} el={researchEl('stat_notes')} compact wrap />
                </p>
                <p className="page-stat-label mt-0.5 leading-snug text-muted-foreground">
                  <BilingualText en={researchEn('stat_notes_hint')} el={researchEl('stat_notes_hint')} wrap />
                </p>
              </div>
              <CfbGlyph name="bookmark" className="icon-sm shrink-0 text-muted-foreground/70" />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="page-stat-label font-medium text-foreground">
                  <BilingualText en={researchEn('stat_next')} el={researchEl('stat_next')} compact />
                </p>
                <p className="page-stat-label mt-0.5 leading-snug text-muted-foreground">
                  {latest ? (
                    PREVIEW_BOARD_TITLE_EL[latest.title]
                      ? <BilingualText en={latest.title} el={PREVIEW_BOARD_TITLE_EL[latest.title]} wrap />
                      : latest.title
                  ) : (
                    <BilingualText en={researchEn('stat_next_empty')} el={researchEl('stat_next_empty')} wrap />
                  )}
                </p>
              </div>
              <CfbGlyph name="flag" className="icon-sm shrink-0 text-muted-foreground/70" />
            </div>
            {/* The rail column is narrow: the label wraps inside the button rather than clipping both languages. */}
            {latest ? (
              <Button size="sm" variant="outline" className={`mt-3 h-auto min-h-8 w-full whitespace-normal py-1.5 ${BUILDER_BTN}`} asChild>
                <Link href={`/research/${latest.id}`}>
                  <BilingualText en={researchEn('open_board')} el={researchEl('open_board')} compact wrap className="justify-center" />
                </Link>
              </Button>
            ) : (
              <Button type="button" size="sm" variant="outline" className={`mt-3 h-auto min-h-8 w-full whitespace-normal py-1.5 ${BUILDER_BTN}`} onClick={() => setTemplatesDialogOpen(true)}>
                <CfbGlyph name="spark" className="icon-sm mr-1.5 shrink-0" />
                <BilingualText en={researchEn('use_template')} el={researchEl('use_template')} compact wrap className="justify-center" />
              </Button>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'filters',
      glyph: 'target',
      labelEn: 'Find a board',
      labelEl: 'Εύρεση πίνακα',
      // A narrowed list with no visible reason reads as a broken list.
      badge: (filter !== 'all' ? 1 : 0) + (searchQuery.trim() ? 1 : 0) || null,
      content: (
        <div className="space-y-4">
          <div className="relative w-full min-w-0">
            <Search className="icon-sm absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t(researchEn('search_ph'), researchEl('search_ph'))}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl pl-10"
              aria-label={bilingualAria(researchEn('search_ph'), researchEl('search_ph'))}
            />
          </div>
          {/* Each group names itself and wraps: a single nowrap row clipped "Κενοί" and "Στοιχεία" in the rail. */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="type-caption font-medium text-muted-foreground">
                <BilingualText en={researchEn('filter_group_show')} el={researchEl('filter_group_show')} compact />
              </p>
              <div className="flex flex-wrap gap-1 rounded-xl bg-secondary/50 p-1">
                {filters.map((f) => (
                  <Button
                    key={f.id}
                    type="button"
                    variant={filter === f.id ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter(f.id)}
                    className={`gap-1.5 ${BUILDER_BTN}`}
                    aria-pressed={filter === f.id}
                  >
                    <BilingualText en={f.labelEn} el={f.labelEl} compact />
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="type-caption font-medium text-muted-foreground">
                <BilingualText en={researchEn('filter_group_sort')} el={researchEl('filter_group_sort')} compact />
              </p>
              <div className="flex flex-wrap gap-1 rounded-xl bg-secondary/50 p-1">
                {sorts.map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    variant={sort === s.id ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setSort(s.id)}
                    className={`gap-1.5 ${BUILDER_BTN}`}
                    aria-pressed={sort === s.id}
                  >
                    <BilingualText en={s.labelEn} el={s.labelEl} compact />
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="type-caption font-medium text-muted-foreground">
                <BilingualText en={researchEn('filter_group_layout')} el={researchEl('filter_group_layout')} compact />
              </p>
              <div className="flex flex-wrap gap-1 rounded-xl bg-secondary/50 p-1">
                <Button
                  type="button"
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={`gap-1.5 ${BUILDER_BTN}`}
                  aria-pressed={viewMode === 'grid'}
                >
                  <Grid3X3 className="icon-sm" />
                  <BilingualText en={researchEn('grid')} el={researchEl('grid')} compact />
                </Button>
                <Button
                  type="button"
                  variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={`gap-1.5 ${BUILDER_BTN}`}
                  aria-pressed={viewMode === 'list'}
                >
                  <List className="icon-sm" />
                  <BilingualText en={researchEn('list')} el={researchEl('list')} compact />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'related',
      glyph: 'flag',
      labelEn: 'Linked pages',
      labelEl: 'Συνδεδεμένες σελίδες',
      content: (
        <div className="grid grid-cols-1 min-w-0 gap-2">
          {([
            { href: '/builder', en: 'Startup Builder', el: 'Κατασκευαστής startup' },
            { href: '/builder?tab=idea-core', en: researchEn('link_idea'), el: researchEl('link_idea') },
            { href: '/builder?tab=market', en: researchEn('link_market'), el: researchEl('link_market') },
            { href: '/builder/pitch-deck', en: researchEn('link_pitch'), el: researchEl('link_pitch') },
            { href: '/milestones', en: 'Milestones', el: 'Ορόσημα' },
            { href: '/fundraising', en: builderEn('app_link_fundraising'), el: builderEl('app_link_fundraising') },
          ] as const).map((step) => (
            <Button key={step.href} asChild variant="outline" className={`h-auto min-h-11 justify-start gap-3 whitespace-normal px-3 py-2.5 text-left ${BUILDER_BTN}`}>
              <Link href={step.href}>
                <span className="min-w-0 flex-1 text-sm font-medium leading-snug">
                  <BilingualText en={step.en} el={step.el} wrap />
                </span>
                <ArrowRight className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </Button>
          ))}
        </div>
      ),
    },
  ];
  const harborLive = boards.some((b) => b.id === 'board-gtm' && !b.isArchived);
  const askAi = harborLive
    ? 'Open the Harbor go-to-market board and tell me what to capture next — problem, customer, channels, offer, competition, and the $750K seed metrics — then how to carry findings into Idea Core or Market analysis.'
    : 'Help me open a market, product, or competitive research board and tell me what to capture first.';

  return (
    <AppShell
      rail={rail}
      showHelp
      askAi={askAi}
      contentClassName="builder-copy overflow-x-clip"
      actions={
        <div className="flex flex-wrap gap-2" data-tour="research-actions">
          <Button type="button" variant="outline" size="sm" onClick={() => setTemplatesDialogOpen(true)} className={`gap-1.5 ${BUILDER_BTN}`} disabled={bootLoad}>
            <CfbGlyph name="spark" className="icon-sm" />
            <BilingualText en={researchEn('use_template')} el={researchEl('use_template')} compact />
          </Button>
          <Button type="button" size="sm" onClick={() => setCreateDialogOpen(true)} className={`gap-1.5 ${BUILDER_BTN}`} disabled={bootLoad}>
            <Plus className="icon-sm" />
            <BilingualText en={researchEn('new_board')} el={researchEl('new_board')} compact />
          </Button>
        </div>
      }
    >
      {bootLoad && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
          <Loader2 className="icon-xl animate-spin text-primary-accessible" />
          <p className="text-sm text-muted-foreground">
            <BilingualText en={researchEn('loading')} el={researchEl('loading')} compact />
          </p>
        </div>
      )}
      {!bootLoad && error && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <AlertCircle className="icon-lg mb-3 text-destructive-accessible" />
          <p className="mb-4 text-destructive-accessible">
            <BilingualText en={researchEn('load_fail')} el={researchEl('load_fail')} />
          </p>
          <Button type="button" size="sm" className={BUILDER_BTN} onClick={() => queryClient.invalidateQueries({ queryKey: qk('research-boards') })}>
            <BilingualText en={researchEn('retry')} el={researchEl('retry')} compact />
          </Button>
        </div>
      )}
      {!bootLoad && !error && (
        <>
          <FirstRunTour tourId="research" steps={RESEARCH_TOUR} ready />
          <BehavioralNudge surface="canvas" compact className="mb-5" />

          {/* The founder's own boards come first; templates are for starting something new. */}
          {boards.length === 0 && filter === 'all' && (
            <div className="rounded-2xl border border-border bg-card/60 px-5 py-10 text-center">
              <CfbGlyph name="research" className="mx-auto mb-4 icon-lg text-muted-foreground/50" />
              <h2 className="page-section mb-2 font-semibold">
                <BilingualText en={researchEn('empty_title')} el={researchEl('empty_title')} />
              </h2>
              <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">
                <BilingualText en={researchEn('empty_hint')} el={researchEl('empty_hint')} />
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="outline" size="sm" className={`gap-1.5 ${BUILDER_BTN}`} onClick={() => setTemplatesDialogOpen(true)}>
                  <CfbGlyph name="spark" className="icon-sm" />
                  <BilingualText en={researchEn('use_template')} el={researchEl('use_template')} compact />
                </Button>
                <Button type="button" size="sm" className={`gap-1.5 ${BUILDER_BTN}`} onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="icon-sm" />
                  <BilingualText en={researchEn('empty_cta')} el={researchEl('empty_cta')} compact />
                </Button>
              </div>
            </div>
          )}

          {useSplit && pinnedBoards.length > 0 && (
            <div className="mb-8">
              <h2 className="page-section mb-4 flex items-center gap-2 font-medium text-muted-foreground">
                <Pin className="icon-sm" />
                <BilingualText en={researchEn('pinned')} el={researchEl('pinned')} compact />
              </h2>
              <div className={cn(
                viewMode === 'grid'
                  ? BOARD_GRID
                  : 'flex flex-col gap-3',
              )} data-tour="research-boards">
                {pinnedBoards.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    viewMode={viewMode}
                    dateLocale={dateLocale}
                    archived={showArchived}
                    {...cardHandlers(board)}
                  />
                ))}
              </div>
            </div>
          )}

          {useSplit && regularBoards.length > 0 && (
            <div>
              <h2 className="page-section mb-4 font-medium text-muted-foreground">
                {pinnedBoards.length > 0 ? (
                  <BilingualText en={researchEn('all_boards')} el={researchEl('all_boards')} compact />
                ) : (
                  <BilingualText en={researchEn('your_boards')} el={researchEl('your_boards')} compact />
                )}
              </h2>
              <div className={cn(
                viewMode === 'grid'
                  ? BOARD_GRID
                  : 'flex flex-col gap-3',
              )} data-tour="research-boards">
                {regularBoards.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    viewMode={viewMode}
                    dateLocale={dateLocale}
                    archived={showArchived}
                    {...cardHandlers(board)}
                  />
                ))}
              </div>
            </div>
          )}

          {!useSplit && filteredBoards.length > 0 && (
            <div className={cn(
              viewMode === 'grid'
                ? BOARD_GRID
                : 'flex flex-col gap-3',
            )} data-tour="research-boards">
              {filteredBoards.map((board) => (
                <BoardCard
                  key={board.id}
                  board={board}
                  viewMode={viewMode}
                  dateLocale={dateLocale}
                  archived={showArchived}
                  {...cardHandlers(board)}
                />
              ))}
            </div>
          )}

          {isLoading && !bootLoad && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="icon-sm animate-spin" />
              <BilingualText en={researchEn('loading')} el={researchEl('loading')} compact />
            </div>
          )}

          {filteredBoards.length === 0 && boards.length > 0 && !isLoading && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <BilingualText
                en={searchQuery ? researchEn('no_match') : filter === 'archived' ? researchEn('archived_empty') : filter === 'empty' ? researchEn('empty_filter') : researchEn('pinned_empty')}
                el={searchQuery ? researchEl('no_match') : filter === 'archived' ? researchEl('archived_empty') : filter === 'empty' ? researchEl('empty_filter') : researchEl('pinned_empty')}
              />
            </div>
          )}

          {boards.length === 0 && filter === 'archived' && !isLoading && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <BilingualText en={researchEn('archived_empty')} el={researchEl('archived_empty')} />
            </div>
          )}

          <section className="mt-10 border-t border-border pt-8" data-tour="research-templates">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0 flex-[1_1_20rem]">
                <h2 className="page-section font-semibold">
                  <BilingualText en={researchEn('templates_heading')} el={researchEl('templates_heading')} compact />
                </h2>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  <BilingualText en={researchEn('templates_hint')} el={researchEl('templates_hint')} wrap />
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" className={BUILDER_BTN} onClick={() => setTemplatesDialogOpen(true)}>
                <BilingualText en={researchEn('templates_see_all')} el={researchEl('templates_see_all')} compact />
              </Button>
            </div>
            <div className={cn(BOARD_GRID, 'gap-3')}>
              {BOARD_TEMPLATES.slice(0, 3).map((template) => (
                <ResearchTemplateTile key={template.id} template={template} onSelect={handleSelectTemplate} />
              ))}
            </div>
          </section>

          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent className="rounded-2xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  <BilingualText en={researchEn('create_title')} el={researchEl('create_title')} />
                </DialogTitle>
                <DialogDescription>
                  <BilingualText en={researchEn('create_desc')} el={researchEl('create_desc')} />
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label htmlFor="rb-f1" className="text-sm font-medium">
                    <BilingualText en={researchEn('field_title')} el={researchEl('field_title')} compact />
                  </label>
                  <Input id="rb-f1"
                    className="rounded-xl"
                    placeholder={t(researchEn('title_ph'), researchEl('title_ph'))}
                    value={newBoardTitle}
                    onChange={(e) => setNewBoardTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateBoard()}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="rb-f2" className="text-sm font-medium">
                    <BilingualText en={researchEn('field_desc')} el={researchEl('field_desc')} compact />
                  </label>
                  <Input id="rb-f2"
                    className="rounded-xl"
                    placeholder={t(researchEn('desc_ph'), researchEl('desc_ph'))}
                    value={newBoardDescription}
                    onChange={(e) => setNewBoardDescription(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <p id="rb-color" className="text-sm font-medium">
                    <BilingualText en={researchEn('field_color')} el={researchEl('field_color')} compact />
                  </p>
                  <div className="flex flex-wrap gap-2" role="group" aria-labelledby="rb-color">
                    {BOARD_COLORS.map((color) => (
                      <button
                        key={color.nameKey}
                        type="button"
                        aria-pressed={newBoardColor === color.value}
                        onClick={() => setNewBoardColor(color.value)}
                        className={cn(
                          'h-8 w-8 rounded-xl border-2 transition-all',
                          newBoardColor === color.value
                            ? 'scale-110 border-primary'
                            : 'border-transparent hover:scale-105',
                          !color.value && 'bg-secondary',
                        )}
                        style={color.value ? { backgroundColor: color.value } : undefined}
                        title={t(researchEn(color.nameKey), researchEl(color.nameKey))}
                        aria-label={bilingualAria(researchEn(color.nameKey), researchEl(color.nameKey))}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p id="rb-icon" className="text-sm font-medium">
                    <BilingualText en={researchEn('field_icon')} el={researchEl('field_icon')} compact />
                  </p>
                  <div className="flex flex-wrap gap-2" role="group" aria-labelledby="rb-icon">
                    {BOARD_ICONS.map((icon) => (
                      <button
                        key={icon.value}
                        type="button"
                        aria-pressed={newBoardIcon === icon.value}
                        onClick={() => setNewBoardIcon(icon.value)}
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-xl border transition-all',
                          newBoardIcon === icon.value
                            ? 'border-primary bg-primary/10 text-primary-accessible'
                            : 'border-border hover:border-primary/50',
                        )}
                        title={t(researchEn(icon.nameKey), researchEl(icon.nameKey))}
                        aria-label={bilingualAria(researchEn(icon.nameKey), researchEl(icon.nameKey))}
                      >
                        <CfbGlyph name={icon.glyph} className="icon-md" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" size="sm" className={BUILDER_BTN} onClick={() => setCreateDialogOpen(false)}>
                  <BilingualText en={commonEn('cancel')} el={commonEl('cancel')} compact />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className={BUILDER_BTN}
                  onClick={handleCreateBoard}
                  disabled={!newBoardTitle.trim() || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="icon-sm mr-2 animate-spin" />
                  ) : null}
                  <BilingualText en={researchEn('create_board')} el={researchEl('create_board')} compact />
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <BoardTemplatesDialog
            open={templatesDialogOpen}
            onClose={() => setTemplatesDialogOpen(false)}
            onSelectTemplate={handleSelectTemplate}
            onStartBlank={() => setCreateDialogOpen(true)}
          />
        </>
      )}
    </AppShell>
  );
}

function BoardCard({
  board,
  viewMode,
  dateLocale,
  archived,
  onOpen,
  onTogglePin,
  onArchive,
  onRestore,
  onDuplicate,
  onDelete,
}: {
  board: ResearchBoard;
  viewMode: 'grid' | 'list';
  dateLocale: Locale;
  archived: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const glyph = getBoardGlyph(board.icon);
  const titleEl = PREVIEW_BOARD_TITLE_EL[board.title];
  const title = (wrap: boolean) =>
    titleEl ? <BilingualText en={board.title} el={titleEl} compact wrap={wrap} /> : board.title;
  const pinnedMark = board.isPinned ? (
    <>
      <Pin className="icon-sm shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">
        <BilingualText en={researchEn('pinned')} el={researchEl('pinned')} compact />
      </span>
    </>
  ) : null;
  const description = board.description
    ? PREVIEW_BOARD_DESC_EL[board.description]
      ? <BilingualText en={board.description} el={PREVIEW_BOARD_DESC_EL[board.description]} wrap />
      : board.description
    : null;
  const updated = (
    <RelativeTime date={board.updatedAt} />
  );

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant={viewMode === 'list' ? 'ghost' : 'secondary'}
          size="sm"
          className="h-8 w-8 rounded-xl p-0"
          type="button"
          aria-label={bilingualAria(researchEn('more'), researchEl('more'))}
        >
          <MoreVertical className="icon-sm" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onTogglePin}>
          <Pin className="icon-sm mr-2" />
          <BilingualText
            en={board.isPinned ? researchEn('unpin') : researchEn('pin')}
            el={board.isPinned ? researchEl('unpin') : researchEl('pin')}
            compact
          />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDuplicate}>
          <Copy className="icon-sm mr-2" />
          <BilingualText en={researchEn('duplicate')} el={researchEl('duplicate')} compact />
        </DropdownMenuItem>
        {archived ? (
          <DropdownMenuItem onClick={onRestore}>
            <ArchiveRestore className="icon-sm mr-2" />
            <BilingualText en={researchEn('restore')} el={researchEl('restore')} compact />
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onArchive}>
            <Archive className="icon-sm mr-2" />
            <BilingualText en={researchEn('archive')} el={researchEl('archive')} compact />
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive-accessible">
          <Trash2 className="icon-sm mr-2" />
          <BilingualText en={commonEn('delete')} el={commonEl('delete')} compact />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (viewMode === 'list') {
    return (
      <Card className="cursor-pointer transition-colors hover:border-border hover:bg-muted/20" onClick={onOpen} {...pressableProps({ role: 'link', label: board.title })}>
        <CardContent className="flex items-center gap-4">
          <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary-accessible">
            <CfbGlyph name={glyph} className="icon-sm" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="page-section min-w-0 truncate font-semibold">{title(false)}</h3>
              {pinnedMark}
            </div>
            {description && (
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="hidden shrink-0 text-xs text-muted-foreground sm:block">
            {board.nodeCount} <BilingualText en={researchEn('items')} el={researchEl('items')} compact />
          </div>
          <div className="hidden shrink-0 text-xs text-muted-foreground md:block">{updated}</div>
          {menu}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="cursor-pointer transition-colors hover:border-border hover:bg-muted/20" onClick={onOpen} {...pressableProps({ role: 'link', label: board.title })}>
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-xl bg-primary/10 p-2.5 text-primary-accessible">
            <CfbGlyph name={glyph} className="icon-sm" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="page-section min-w-0 flex-1 font-semibold leading-snug">{title(true)}</h3>
              <div className="flex shrink-0 items-center gap-1.5">
                {pinnedMark}
                {menu}
              </div>
            </div>
            {description && (
              <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {board.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-2xs text-muted-foreground">
            {board.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-muted/70 px-1.5 py-0.5">
                <BilingualText en={tag} el={RESEARCH_TAG_EL[tag] ?? tag} compact />
              </span>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {board.nodeCount} <BilingualText en={researchEn('items')} el={researchEl('items')} compact />
          </span>
          <span>{updated}</span>
        </div>
      </CardContent>
    </Card>
  );
}
