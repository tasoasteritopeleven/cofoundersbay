'use client';

import { Moon, Sun, Monitor, Minus, Palette, Sunrise } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/components/layout/RoleTheme';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const icons: Partial<Record<typeof theme, typeof Sun>> = {
    light: Sun,
    dark: Moon,
    system: Monitor,
    alliance: Palette,
    minimal: Minus,
    apricot: Sunrise,
  };

  const CurrentIcon = icons[theme] || Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Toggle theme">
          <CurrentIcon className="icon-sm transition-transform hover:rotate-12" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')} className="gap-2">
          <Sun className="icon-sm" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')} className="gap-2">
          <Moon className="icon-sm" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')} className="gap-2">
          <Monitor className="icon-sm" />
          System
        </DropdownMenuItem>
        {/* The four light accents: one tone, four hues. */}
        <DropdownMenuItem onClick={() => setTheme('alliance')} className="gap-2">
          <Palette className="icon-sm" />
          Cyan
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('minimal')} className="gap-2">
          <Minus className="icon-sm" />
          Mint
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('apricot')} className="gap-2">
          <Sunrise className="icon-sm" />
          Apricot
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
