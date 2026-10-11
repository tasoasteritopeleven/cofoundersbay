'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Forms as proposals.
 *
 * The assistant can write some things outright (a milestone, an event) and it
 * says so on a confirm card. For a form the person should read before it
 * exists - a new project, their own profile, a long event description - the
 * better shape is a draft: the assistant fills the fields, the page opens with
 * them filled, and nothing is saved until the person presses the form's own
 * submit button.
 *
 * The draft travels in sessionStorage because it only has to survive one
 * navigation, inside one tab, for one person. It is read after mount (never
 * during render, so the server and first client render agree), taken once,
 * and ignored when stale. A page that is already open hears the same draft
 * through a window event and fills itself in place.
 */

export type FormDraftId = 'milestone' | 'event' | 'project' | 'profile' | 'need_card' | 'founder_update' | 'scout_brief';
export type FormDraftFields = Record<string, string | boolean>;

/** Where each draft is filled in. */
export const FORM_DRAFT_ROUTES: Record<FormDraftId, string> = {
  milestone: '/milestones/new',
  event: '/events/create',
  project: '/projects/create',
  profile: '/profile/edit',
  need_card: '/commitments/new',
  founder_update: '/updates',
  scout_brief: '/scout',
};

const KEY = (id: FormDraftId) => `cfb_form_draft:${id}`;
const EVENT = 'cfb:form-draft';
/** A draft older than this was abandoned; opening the form later starts clean. */
const MAX_AGE_MS = 10 * 60_000;

export function stashFormDraft(id: FormDraftId, fields: FormDraftFields): void {
  const clean = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => (typeof v === 'string' ? v.trim() !== '' : typeof v === 'boolean')),
  );
  try {
    window.sessionStorage.setItem(KEY(id), JSON.stringify({ fields: clean, at: Date.now() }));
  } catch {
    // Private mode or storage blocked: the open-page event below still works.
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { id, fields: clean } }));
  } catch {
    // No window (tests without jsdom).
  }
}

export function takeFormDraft(id: FormDraftId, now = Date.now()): FormDraftFields | null {
  try {
    const raw = window.sessionStorage.getItem(KEY(id));
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY(id));
    const parsed = JSON.parse(raw) as { fields?: FormDraftFields; at?: number };
    if (!parsed?.fields || typeof parsed.at !== 'number' || now - parsed.at > MAX_AGE_MS) return null;
    return parsed.fields;
  } catch {
    return null;
  }
}

/**
 * Applies a waiting draft to a form, once the form is ready for it.
 *
 * `ready` exists for forms that load their own values first (the profile
 * reads the saved profile): a draft applied before that load would be
 * overwritten by it. Returns the names of the fields the assistant filled,
 * for the notice, and a way to dismiss that notice.
 */
export function useFormDraft(
  id: FormDraftId,
  apply: (fields: FormDraftFields) => void,
  ready = true,
): { filled: string[]; dismiss: () => void } {
  const [filled, setFilled] = useState<string[]>([]);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const use = useCallback((fields: FormDraftFields | null) => {
    if (!fields || Object.keys(fields).length === 0) return;
    applyRef.current(fields);
    setFilled(Object.keys(fields));
  }, []);

  useEffect(() => {
    if (!ready) return;
    use(takeFormDraft(id));
    const onDraft = (event: Event) => {
      const detail = (event as CustomEvent<{ id: FormDraftId }>).detail;
      if (detail?.id === id) use(takeFormDraft(id));
    };
    window.addEventListener(EVENT, onDraft);
    return () => window.removeEventListener(EVENT, onDraft);
  }, [id, ready, use]);

  return { filled, dismiss: () => setFilled([]) };
}
