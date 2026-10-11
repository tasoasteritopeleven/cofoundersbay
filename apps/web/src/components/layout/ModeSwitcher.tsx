'use client';

import { cn } from '@/lib/utils';
import { sidebarModes, type SidebarMode } from './nav-modes';
import { SIDEBAR_MODE_EL, SIDEBAR_MODE_HINT } from '@/lib/i18n/strings-nav';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { NavIcon, glyphForMode } from '@/components/icons/CfbGlyph';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';

/*
 * One switch, three shapes.
 *
 * - `rail`: the collapsed sidebar. Glyphs stacked, names in the tooltip.
 * - `list`: the open drawer. The same glyphs in the same column, each with
 *   its name beside it, on a track that reads as a switch rather than as
 *   three more links. The drawer is 196.8px on desktop, and "Λογαριασμός"
 *   alone is 81px at the caption step: three across, each cell had 55px, so
 *   the Greek names could only be shown hyphenated («Εξερεύ-νηση»,
 *   «Λογαρια-σμός»). A column fits any language, and opening or collapsing
 *   the drawer no longer moves the glyphs from a column into a row.
 * - `row`: the phone sheet (331-352px), where three across fits at the
 *   phone scale's caption step. Text only,
 *   no tooltip: the sheet focuses its first control on open, and a tooltip
 *   opened by that focus covered the next label.
 *
 * Icons sit 16px from the drawer's edge in `list`, the same as every nav
 * link's, so the glyphs line up in one column down the sidebar.
 */

/** Soft hyphens: the row's fallback on the narrowest phones only. */
const MODE_LABEL_EL_ROW: Record<SidebarMode, string> = {
  work: 'Εργα­σία',
  explore: 'Εξερεύ­νηση',
  account: 'Λογαρια­σμός',
};

export type ModeSwitcherVariant = 'rail' | 'list' | 'row';

interface ModeSwitcherProps {
  currentMode: SidebarMode;
  onModeChange: (mode: SidebarMode) => void;
  variant: ModeSwitcherVariant;
}

export function ModeSwitcher({ currentMode, onModeChange, variant }: ModeSwitcherProps) {
  const { primary } = useLanguagePreference();
  const greek = primary === 'el';

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'min-w-0 shrink-0',
          variant === 'rail' && 'border-b border-border px-0 py-1.5',
          variant === 'list' && 'px-[8px] pb-[4px] pt-[8px]',
          variant === 'row' && 'border-b border-border px-3 py-2.5',
        )}
      >
        <div
          role="group"
          aria-label={bilingualAria('Sidebar section', 'Ενότητα πλαϊνής στήλης')}
          className={cn(
            variant === 'rail' && 'flex flex-col items-center gap-0.5',
            variant === 'list' && 'flex flex-col gap-[2px] rounded-xl bg-muted/55 p-[2px]',
            variant === 'row' && 'grid grid-cols-3 gap-[2px] rounded-xl bg-muted/55 p-[2px]',
          )}
        >
          {sidebarModes.map((mode) => {
            const Icon = mode.icon;
            const isActive = currentMode === mode.id;
            const labelEl = SIDEBAR_MODE_EL[mode.id];
            const hint = SIDEBAR_MODE_HINT[mode.id];

            const button = (
              <button
                key={mode.id}
                type="button"
                onClick={() => onModeChange(mode.id)}
                data-keep-icon={variant === 'list' ? '' : undefined}
                className={cn(
                  'flex min-w-0 items-center transition-colors duration-150',
                  variant === 'rail' && 'h-9 w-9 justify-center rounded-lg lg:h-[36px] lg:w-[36px]',
                  variant === 'list' && 'min-h-[28px] w-full gap-2 rounded-[10px] px-[6px] text-left text-sm',
                  variant === 'row' && 'min-h-11 w-full justify-center rounded-[10px] px-1 text-center',
                  variant === 'rail'
                    ? isActive
                      ? 'bg-primary/8 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    : isActive
                      ? 'bg-card font-medium text-foreground shadow-[0_1px_2px_hsl(var(--foreground)/0.08),0_0_0_1px_hsl(var(--border)/0.7)]'
                      : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
                )}
                aria-pressed={isActive}
                aria-label={bilingualAria(mode.shortLabel, labelEl)}
              >
                {variant !== 'row' && (
                  <NavIcon
                    name={glyphForMode(mode.id)}
                    fallback={Icon}
                    className={cn(
                      variant === 'rail' ? 'icon-md' : 'icon-sm',
                      'shrink-0',
                      variant === 'list' && !isActive && 'text-muted-foreground/70',
                    )}
                  />
                )}
                {variant === 'list' && (
                  <span lang={greek ? 'el' : 'en'} className="min-w-0 truncate">
                    {greek ? labelEl : mode.shortLabel}
                  </span>
                )}
                {variant === 'row' && (
                  // The phone reading scale puts text-sm at 15.68px, where
                  // «Λογαριασμός» needs 103px of a 91-99px cell; its caption
                  // step (13.044px) fits from 360px. A tablet keeps text-sm.
                  <span lang={greek ? 'el' : 'en'} className="min-w-0 text-2xs leading-tight sm:text-sm [hyphens:manual]">
                    {greek ? MODE_LABEL_EL_ROW[mode.id] : mode.shortLabel}
                  </span>
                )}
              </button>
            );

            if (variant === 'row') return button;

            return (
              <Tooltip key={mode.id}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right" className="max-w-[240px] text-xs">
                  <p className="font-medium text-foreground">
                    <BilingualText en={mode.shortLabel} el={labelEl} />
                  </p>
                  <p className="text-muted-foreground">
                    <BilingualText en={hint.en} el={hint.el} />
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
