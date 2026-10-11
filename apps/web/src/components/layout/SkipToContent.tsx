/**
 * Bypass-blocks link (WCAG 2.4.1).
 *
 * Every authenticated page renders a persistent sidebar + top bar before the
 * page body, so keyboard and screen-reader users would otherwise tab through
 * ~30 navigation controls on every single navigation. This link is the first
 * focusable node in the document and jumps straight to `<main id="main-content">`,
 * which `AppShellFrame` (and the public shells) already expose.
 *
 * It is visually hidden until focused — see `.skip-to-content` in globals.css.
 * The label stays bilingual like every other chrome surface in the app.
 */
export function SkipToContent() {
  return (
    <a href="#main-content" className="skip-to-content">
      <span lang="en">Skip to main content</span>
      <span aria-hidden="true"> · </span>
      <span lang="el">Μετάβαση στο κύριο περιεχόμενο</span>
    </a>
  );
}
