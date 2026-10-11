'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useRoleOptional } from '@/contexts/RoleContext';
import { useI18n } from '@/components/common/I18nProvider';
import type { PageContextPacket } from '@/lib/copilot-engine';
import { usePageSnapshot, type PageSnapshot } from '@/contexts/PageSnapshotContext';
import { getPageMeta } from '@/lib/page-registry';
import { usePageRail } from '@/components/layout/PageRailContext';
import { usePageControlList, usePageListSummaries } from '@/lib/page-controls';

/**
 * The floor every page stands on when it publishes nothing itself.
 *
 * Snapshot publishing is opt-in per page and three pages had opted in, so on
 * the other 152 the assistant was back to a bare path string. The registry
 * already knows every route's title and one-line description in both
 * languages — that is a description of the screen too, just a static one.
 * A page that publishes its own snapshot still wins below; this only fills
 * the silence.
 *
 * `state` is deliberately absent: the registry cannot know whether the page
 * is loaded, empty or erroring, and a floor that said `ready` would be lying
 * exactly when it matters most.
 */
function registryFloor(
  pathname: string | null,
  locale: string,
): (PageSnapshot & { route: string }) | null {
  if (!pathname) return null;
  const meta = getPageMeta(pathname);
  if (!meta) return null;
  const el = locale === 'el';
  return {
    route: pathname,
    title: el ? (meta.titleEl ?? meta.title) : meta.title,
    summary: el ? (meta.descriptionEl ?? meta.description) : meta.description,
  };
}

function entityFromPath(pathname: string | null): PageContextPacket['entity'] {
  if (!pathname) return undefined;
  const match = pathname.match(/^\/(profiles|matches|messages|research|p)\/([^/]+)/);
  if (!match) return undefined;
  const typeMap: Record<string, string> = {
    profiles: 'profile',
    matches: 'match',
    messages: 'conversation',
    research: 'board',
    p: 'profile',
  };
  return { type: typeMap[match[1]] ?? match[1], id: match[2] };
}

export function usePageContext(): PageContextPacket {
  const pathname = usePathname();
  const role = useRoleOptional();
  // What the page currently shows, when it says. Absent on pages that publish
  // nothing, which is every page this hook served before — those still hand
  // the assistant a route and nothing more.
  const snapshot = usePageSnapshot();
  // Was hardcoded to 'en', so the assistant was told every reader was English
  // no matter what they had chosen — which made translating its replies
  // pointless until this line changed. `useI18n` carries a working default, so
  // this is safe outside the provider too.
  const { locale } = useI18n();
  // The page's own controls, in the reader's language, handlers left behind.
  const pageControls = usePageControlList();
  const el = locale === 'el';
  const controlsKey = JSON.stringify(
    pageControls.map((c) => ({
      id: c.id,
      label: el ? c.labelEl : c.labelEn,
      writes: c.writes,
      ...(c.options?.length ? { options: c.options.map((o) => ({ value: o.value, label: el ? o.labelEl : o.labelEn })) } : {}),
      ...(c.current !== undefined ? { current: c.current } : {}),
      ...(c.unavailableEn ? { unavailable: el ? (c.unavailableEl ?? c.unavailableEn) : c.unavailableEn } : {}),
      ...(c.undoable ? { undoable: true } : {}),
    })),
  );
  // What the page's lists show, in the reader's language: a label, the
  // counts, and the first rows as the page describes them.
  const pageLists = usePageListSummaries();
  const listsKey = JSON.stringify(
    pageLists.map((l) => ({
      id: l.id,
      label: el ? l.labelEl : l.labelEn,
      shown: l.shown,
      ...(l.total !== undefined ? { total: l.total } : {}),
      rows: l.rows,
      ...(l.sample ? { sample: true } : {}),
    })),
  );
  // The rail's table of contents, in the reader's language. Without it the
  // assistant could describe the column and nothing to its right - a user
  // asking "where are the filters?" on /admin/users was told nothing.
  const { sections: railSections } = usePageRail();
  const railKey = JSON.stringify(
    railSections.map((s) => ({
      id: s.id,
      label: locale === 'el' ? s.labelEl : s.labelEn,
      ...(s.badge != null && s.badge !== 0 ? { badge: s.badge } : {}),
    })),
  );

  // Serialised for the dependency list: the snapshot is rebuilt by its page on
  // every render, so comparing by identity would make this memo useless and
  // hand a new packet to every consumer each time.
  const snapshotKey = snapshot ? JSON.stringify(snapshot) : '';

  return useMemo(
    () => {
      const published =
        snapshotKey && snapshot?.route === (pathname ?? '/') ? snapshot : null;
      const screen = published ?? registryFloor(pathname, locale);
      return {
        route: pathname ?? '/',
        entity: entityFromPath(pathname),
        role: role?.primaryRole ?? null,
        locale,
        ...(screen ? { screen } : {}),
        ...(railKey !== '[]' ? { rail: { sections: JSON.parse(railKey) as NonNullable<PageContextPacket['rail']>['sections'] } } : {}),
        ...(controlsKey !== '[]' ? { controls: JSON.parse(controlsKey) as NonNullable<PageContextPacket['controls']> } : {}),
        ...(listsKey !== '[]' ? { lists: JSON.parse(listsKey) as NonNullable<PageContextPacket['lists']> } : {}),
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshotKey stands in for snapshot by value
    [pathname, role?.primaryRole, locale, snapshotKey, railKey, controlsKey, listsKey],
  );
}
