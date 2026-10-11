'use client';

import { createContext } from 'react';

/**
 * The page header's meta row, for things that describe the page rather than
 * belong to its content - today the collapsed "Sample data" note.
 *
 * That note rendered as a lone pill on its own row between the header and the
 * first card on nineteen pages, pushing the content down and reading like a
 * debug label. Pages still place it where they always did; inside a page
 * header it portals into this row, beside the page's own header actions, and
 * only its expanded form opens in the flow. `inHeader` false means there is
 * no header to join (a page without a title), so it stays where it was put.
 */
export const PageHeaderSlot = createContext<{ inHeader: boolean; slot: HTMLElement | null }>({ inHeader: false, slot: null });
