import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CfbGlyphWell, type CfbGlyphName } from '@/components/icons/CfbGlyph';

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  glyph?: CfbGlyphName;
  href?: string;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  icon,
  glyph,
  href,
  className,
}: PageHeaderProps) {
  const mark = icon ?? ((glyph || href) ? <CfbGlyphWell name={glyph} href={href} size="md" /> : null);

  return (
    <div className={cn(
      'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between',
      className
    )}>
      <div className="flex min-w-0 items-start gap-3">
        {mark && (
          <div className="flex-shrink-0">
            {mark}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="page-title text-balance text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-prose text-base leading-normal text-muted-foreground sm:text-sm">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
