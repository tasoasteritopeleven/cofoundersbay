import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Label + helper on the left, control on the right. Full column width. */
export function SettingsRow({
  label,
  helper,
  children,
  className,
}: {
  label: ReactNode;
  helper?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 border-b border-border py-3.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6',
        className,
      )}
    >
      <div className="min-w-0 sm:max-w-[60%]">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {helper && <p className="mt-0.5 text-xs text-muted-foreground">{helper}</p>}
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">{children}</div>
    </div>
  );
}
