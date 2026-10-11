import { redirect } from 'next/navigation';

/**
 * @deprecated The standalone localStorage canvas has been superseded by the
 * API-backed primary canvas at /research/[boardId]. All features (undo/redo,
 * multi-select, box selection, connection drawing, 60+ node types, context menu,
 * keyboard shortcuts, collaboration, AI analysis) now live in the primary canvas.
 *
 * This route redirects to the boards list so users can pick or create a board.
 */
export default function ResearchCanvasPage() {
  redirect('/research');
}
