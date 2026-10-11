import { CANVAS_DOC_FORMATS, type CanvasDocFormat } from '@cofounderbay/shared';

export { CANVAS_DOC_FORMATS, type CanvasDocFormat };

/**
 * Word-class transforms on a research note's HTML.
 *
 * Chat and the inspector cannot hold a caret, so they rewrite the stored
 * fragment. The live RichTextEditor still uses the caret for the same verbs.
 */

export function isCanvasDocFormat(value: string): value is CanvasDocFormat {
  return (CANVAS_DOC_FORMATS as readonly string[]).includes(value);
}

export function stripDocTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function countDocWords(html: string): { words: number; chars: number } {
  const text = stripDocTags(html);
  return {
    words: text ? text.split(/\s+/).filter(Boolean).length : 0,
    chars: text.length,
  };
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function wrapInner(html: string, open: string, close: string): string {
  const inner = html.trim() || '<br>';
  if (html.trim().startsWith(open) && html.trim().endsWith(close)) {
    return html.trim().slice(open.length, html.trim().length - close.length);
  }
  return `${open}${inner}${close}`;
}

function toList(html: string, tag: 'ul' | 'ol'): string {
  const lines = stripDocTags(html).split(/\n+/).filter(Boolean);
  const items = (lines.length ? lines : ['']).map((line) => `<li>${escapeText(line)}</li>`).join('');
  return `<${tag}>${items}</${tag}>`;
}

const ALIGN_CLASS: Record<'left' | 'center' | 'right' | 'justify', string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
  justify: 'text-justify',
};

function wrapAlign(html: string, align: 'left' | 'center' | 'right' | 'justify'): string {
  return `<div class="${ALIGN_CLASS[align]}">${html.trim() || '<br>'}</div>`;
}

export function applyDocFormat(html: string, format: CanvasDocFormat): string {
  const source = html ?? '';
  switch (format) {
    case 'bold':
      return wrapInner(source, '<strong>', '</strong>');
    case 'italic':
      return wrapInner(source, '<em>', '</em>');
    case 'underline':
      return wrapInner(source, '<u>', '</u>');
    case 'strike':
      return wrapInner(source, '<s>', '</s>');
    case 'h1':
      return `<h2>${escapeText(stripDocTags(source) || 'Heading')}</h2>`;
    case 'h2':
      return `<h3>${escapeText(stripDocTags(source) || 'Heading')}</h3>`;
    case 'h3':
      return `<h4>${escapeText(stripDocTags(source) || 'Heading')}</h4>`;
    case 'p':
      return `<p>${escapeText(stripDocTags(source))}</p>`;
    case 'quote':
      return wrapInner(source, '<blockquote>', '</blockquote>');
    case 'bullet':
      return toList(source, 'ul');
    case 'number':
      return toList(source, 'ol');
    case 'check': {
      const lines = stripDocTags(source).split(/\n+/).filter(Boolean);
      const items = (lines.length ? lines : ['']).map((line) => `<li>☐ ${escapeText(line)}</li>`).join('');
      return `<ul>${items}</ul>`;
    }
    case 'align_left':
      return wrapAlign(source, 'left');
    case 'align_center':
      return wrapAlign(source, 'center');
    case 'align_right':
      return wrapAlign(source, 'right');
    case 'justify':
      return wrapAlign(source, 'justify');
    case 'indent':
      return `<div class="pl-6">${source.trim() || '<br>'}</div>`;
    case 'outdent':
      return source.replace(/^<div class="pl-6">([\s\S]*)<\/div>$/i, '$1');
    case 'highlight':
      return wrapInner(source, '<mark>', '</mark>');
    case 'clear':
      return escapeText(stripDocTags(source));
    case 'hr':
      return `${source}<hr/>`;
    case 'superscript':
      return wrapInner(source, '<sup>', '</sup>');
    case 'subscript':
      return wrapInner(source, '<sub>', '</sub>');
    case 'uppercase':
      if (!source.includes('<')) return source.toUpperCase();
      return source.replace(/>([^<]+)</g, (_, text: string) => `>${text.toUpperCase()}<`);
    case 'lowercase':
      if (!source.includes('<')) return source.toLowerCase();
      return source.replace(/>([^<]+)</g, (_, text: string) => `>${text.toLowerCase()}<`);
    case 'code':
      return wrapInner(source, '<pre>', '</pre>');
    default:
      return source;
  }
}

export function findReplaceDoc(html: string, find: string, replace: string): string {
  if (!find) return html;
  if (/[<>]/.test(find)) return html.split(find).join(replace);
  return html
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith('<') ? part : part.split(find).join(replace)))
    .join('');
}

export function mergeDocHtml(parts: string[]): string {
  return parts.map((part) => part.trim()).filter(Boolean).join('');
}

export function splitDocBlocks(html: string): string[] {
  const lines = stripDocTags(html).split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  return lines.map((line) => `<p>${escapeText(line)}</p>`);
}

export function appendDocDate(html: string, iso?: string): string {
  const stamp = iso || new Date().toISOString().slice(0, 10);
  return `${html}<p><time datetime="${escapeAttr(stamp)}">${escapeText(stamp)}</time></p>`;
}

export function appendPlainText(html: string, text: string): string {
  if (!text.trim()) return html;
  return `${html}<p>${escapeText(text.trim())}</p>`;
}

export function appendDocLink(html: string, href: string, label?: string): string {
  if (!href) return html;
  const text = label || href;
  return `${html}<p><a href="${escapeAttr(href)}">${escapeText(text)}</a></p>`;
}

/** Research citation — Word footnote, mapped to a cite line a founder can link later. */
export function appendDocCitation(html: string, citation: string): string {
  if (!citation.trim()) return html;
  return `${html}<p><cite>${escapeText(citation.trim())}</cite></p>`;
}
