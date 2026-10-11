'use client';

import * as React from 'react';
import { sanitizeHtml } from '@/lib/sanitize';

type SanitizedHtmlProps = Omit<
  React.HTMLAttributes<HTMLElement>,
  'dangerouslySetInnerHTML' | 'children'
> & {
  html: string | null | undefined;
  /** `highlight` allows only <mark>/<em>/<strong>. */
  profile?: 'rich-text' | 'highlight';
  /** Element to render. Defaults to a div; use `span` inside a paragraph. */
  as?: 'div' | 'span' | 'p';
};

/**
 * The only sanctioned way to render server- or user-supplied HTML.
 *
 * `suppressHydrationWarning` is deliberate: the server emits escaped text
 * (there is no DOM to sanitise against) and the client swaps in the sanitised
 * markup, so the two renders differ by design.
 */
export function SanitizedHtml({
  html,
  profile = 'rich-text',
  as: Tag = 'div',
  ...rest
}: SanitizedHtmlProps) {
  const clean = React.useMemo(() => sanitizeHtml(html ?? '', profile), [html, profile]);
  return (
    <Tag
      {...rest}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
