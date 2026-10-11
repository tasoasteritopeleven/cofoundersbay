'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Home,
  Compass,
  User,
  Settings,
  LogOut,
  MessageCircle,
  Sun,
  Moon,
  Users,
  Sparkles,
  HelpCircle,
  Keyboard,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTheme } from '@/components/layout/RoleTheme';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { clearPreviewDemoSession } from '@/lib/preview-demo';
import { bilingualInline } from '@/lib/i18n/format';

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string[];
  action: () => void;
  category: 'navigation' | 'actions' | 'settings' | 'help';
};

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the `?` shortcut reference — supplied by the host so `?` works globally too. */
  onOpenShortcuts?: () => void;
};

export function CommandPalette({ open, onOpenChange, onOpenShortcuts }: CommandPaletteProps) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: CommandItem[] = useMemo(() => [
    // Navigation
    {
      id: 'home',
      label: 'Go to Home',
      description: 'Return to homepage',
      icon: Home,
      shortcut: ['G', 'H'],
      action: () => router.push('/'),
      category: 'navigation',
    },
    {
      id: 'discover',
      label: 'Go to Discover',
      description: 'Find founders, mentors, investors',
      icon: Compass,
      shortcut: ['G', 'D'],
      action: () => router.push('/discover'),
      category: 'navigation',
    },
    {
      id: 'profile',
      label: 'Go to Profile',
      description: 'View your profile',
      icon: User,
      shortcut: ['G', 'P'],
      action: () => router.push('/profile'),
      category: 'navigation',
    },
    {
      id: 'ai-assistant',
      label: 'Go to AI Assistant',
      description: 'Full-page copilot workspace',
      icon: Sparkles,
      shortcut: ['G', 'A'],
      action: () => router.push('/ai'),
      category: 'navigation',
    },
    {
      id: 'messages',
      label: 'Go to Messages',
      description: 'View your conversations',
      icon: MessageCircle,
      shortcut: ['G', 'M'],
      action: () => router.push('/messages'),
      category: 'navigation',
    },
    {
      id: 'settings',
      label: 'Go to Settings',
      description: 'Manage your account',
      icon: Settings,
      shortcut: ['G', 'S'],
      action: () => router.push('/settings'),
      category: 'navigation',
    },

    // Actions
    {
      id: 'ask-ai',
      label: 'Ask AI…',
      description: 'Start a new assistant conversation',
      icon: Sparkles,
      action: () => router.push('/ai'),
      category: 'actions',
    },
    {
      id: 'search',
      label: 'Search profiles',
      description: 'Find people by name or skills',
      icon: Search,
      shortcut: ['/'],
      action: () => router.push('/discover'),
      category: 'actions',
    },
    {
      id: 'matches',
      label: 'View matches',
      description: 'See your compatibility matches',
      icon: Users,
      action: () => router.push('/matches'),
      category: 'actions',
    },
    {
      id: 'recommendations',
      label: 'Get recommendations',
      description: 'AI-powered suggestions',
      icon: Sparkles,
      action: () => router.push('/recommendations'),
      category: 'actions',
    },
    {
      id: 'shortlist',
      label: 'Open saved profiles',
      description: 'People you shortlisted',
      icon: Users,
      action: () => router.push('/shortlist'),
      category: 'actions',
    },

    // Settings
    {
      id: 'theme-light',
      label: 'Switch to Light mode',
      icon: Sun,
      action: () => setTheme('light'),
      category: 'settings',
    },
    {
      id: 'theme-dark',
      label: 'Switch to Dark mode',
      icon: Moon,
      action: () => setTheme('dark'),
      category: 'settings',
    },
    {
      id: 'logout',
      label: 'Sign out',
      description: 'Log out of your account',
      icon: LogOut,
      action: () => {
        clearPreviewDemoSession();
        router.push('/login');
      },
      category: 'settings',
    },

    // Help
    {
      id: 'shortcuts',
      label: 'Keyboard shortcuts',
      description: 'View all shortcuts',
      icon: Keyboard,
      shortcut: ['?'],
      action: () => onOpenShortcuts?.(),
      category: 'help',
    },
    {
      id: 'help',
      label: 'Help & Support',
      description: 'Get help with CoFounderBay',
      icon: HelpCircle,
      action: () => router.push('/help'),
      category: 'help',
    },
  ], [router, setTheme, onOpenShortcuts]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) return commands;
    const lower = search.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lower) ||
        cmd.description?.toLowerCase().includes(lower)
    );
  }, [commands, search]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      navigation: [],
      actions: [],
      settings: [],
      help: [],
    };
    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onOpenChange(false);
          }
          break;
        case 'Escape':
          onOpenChange(false);
          break;
      }
    },
    [filteredCommands, selectedIndex, onOpenChange]
  );

  // Reset state when closed
  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Keep selected index in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    actions: 'Actions',
    settings: 'Settings',
    help: 'Help',
  };

  let flatIndex = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[min(70dvh,calc(100svh_-_5.5rem))] flex-col gap-0 overflow-hidden p-0 max-md:top-[max(0.5rem,env(safe-area-inset-top))] max-md:translate-y-0 md:max-h-[min(92dvh,720px)] md:max-w-lg"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        {/* Search input */}
        <div className="shrink-0 border-b border-border p-4 pr-12">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
            <Input
              placeholder={bilingualInline("Type a command or search…", "Πληκτρολογήστε εντολή ή αναζήτηση…")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="border-0 bg-transparent pl-9 focus-visible:ring-0"
              autoFocus
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-2xs font-medium text-muted-foreground">
              ESC
            </kbd>
          </div>
        </div>

        {/* Command list */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No commands found
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, items]) => {
              if (items.length === 0) return null;
              return (
                <div key={category} className="mb-4 last:mb-0">
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {categoryLabels[category]}
                  </div>
                  {items.map((cmd) => {
                    const currentFlatIndex = flatIndex++;
                    const isSelected = currentFlatIndex === selectedIndex;
                    return (
                      <button
                        key={cmd.id}
                        onClick={() => {
                          cmd.action();
                          onOpenChange(false);
                        }}
                        onMouseEnter={() => setSelectedIndex(currentFlatIndex)}
                        className={cn(
                          'flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors md:min-h-0 md:py-2',
                          isSelected
                            ? 'bg-primary/10 text-foreground'
                            : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                        )}
                      >
                        <cmd.icon className="icon-sm flex-shrink-0" />
                        <div className="min-w-0 flex-1 text-left">
                          <p className="font-medium">{cmd.label}</p>
                          {cmd.description && (
                            <p className="text-xs text-muted-foreground">{cmd.description}</p>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <div className="hidden items-center gap-1 md:flex">
                            {cmd.shortcut.map((key, i) => (
                              <kbd
                                key={i}
                                className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border bg-muted px-1 font-mono text-2xs text-muted-foreground"
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="hidden shrink-0 items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground md:flex">
          <span>Navigate with ↑↓ keys</span>
          <span>Press Enter to select</span>
        </div>
        <div className="shrink-0 border-t border-border px-4 py-2 text-center text-xs text-muted-foreground md:hidden">
          Tap a result to go
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to enable global keyboard shortcuts
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
}
