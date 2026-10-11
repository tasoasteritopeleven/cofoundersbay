'use client';

import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';
import { useDemoData } from '@/contexts/DemoDataContext';
import { cn } from '@/lib/utils';

/**
 * Global toggle for showing/hiding sample data across all pages.
 *
 * Labelled "Sample data", not "Demo": the top bar also shows a "Demo account"
 * badge for the shared preview login, and two controls both reading "Demo"
 * were indistinguishable. The ON state is the visually "filled" one — the old
 * styling used ghost+muted for ON and a dashed outline for OFF, which inverted
 * the affordance.
 */
export function DemoDataToggle({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const { showDemoData, toggleDemoData } = useDemoData();
  const label = showDemoData
    ? bilingualAria('Sample data is on — click to hide it', 'Τα δείγματα δεδομένων είναι ενεργά — κλικ για απόκρυψη')
    : bilingualAria('Sample data is off — click to show it', 'Τα δείγματα δεδομένων είναι ανενεργά — κλικ για εμφάνιση');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size={iconOnly ? 'icon' : 'sm'}
            onClick={toggleDemoData}
            aria-pressed={showDemoData}
            aria-label={label}
            className={cn(
              iconOnly ? 'px-0' : 'gap-1.5 px-2 font-medium',
              showDemoData
                ? 'bg-secondary text-foreground hover:bg-secondary/80'
                : 'text-muted-foreground hover:text-foreground',
              className,
            )}
          >
            {showDemoData
              ? <Eye className="icon-sm" aria-hidden="true" />
              : <EyeOff className="icon-sm" aria-hidden="true" />}
            <span className={cn(!iconOnly && 'hidden sm:inline', iconOnly && 'sr-only')}>
              <BilingualText en="Sample data" el="Δείγμα" compact secondaryFrom="lg" />
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="center" className="max-w-[240px]">
          <p className="mb-1 text-xs font-medium">
            <BilingualText
              en={showDemoData ? 'Sample data: on' : 'Sample data: off'}
              el={showDemoData ? 'Δείγμα δεδομένων: ενεργό' : 'Δείγμα δεδομένων: ανενεργό'}
            />
          </p>
          <p className="text-2xs text-muted-foreground">
            <BilingualText
              en={showDemoData
                ? 'Shows examples where supported. This display setting does not disable saving or account actions.'
                : 'Hides examples where supported. Your account actions remain available.'}
              el={showDemoData
                ? 'Εμφανίζει παραδείγματα όπου υποστηρίζεται. Η ρύθμιση προβολής δεν απενεργοποιεί την αποθήκευση ή τις ενέργειες λογαριασμού.'
                : 'Κρύβει παραδείγματα όπου υποστηρίζεται. Οι ενέργειες λογαριασμού παραμένουν διαθέσιμες.'}
            />
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
