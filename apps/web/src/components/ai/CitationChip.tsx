'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { CopilotCitation } from '@/lib/copilot-types';

export function CitationChip({ citation }: { citation: CopilotCitation }) {
  const className = cn(
    'inline-flex items-center rounded-full border-0 bg-status-accent-bg px-2 py-0.5 text-2xs font-medium text-status-accent',
    'dark:bg-status-accent-mark dark:text-status-accent',
  );

  if (citation.href) {
    return (
      <Link href={citation.href} className={cn(className, 'hover:bg-status-accent-bg dark:hover:bg-status-accent-mark')}>
        {citation.label}
      </Link>
    );
  }

  return <span className={className}>{citation.label}</span>;
}
