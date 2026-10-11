import { Fragment } from 'react';

/**
 * Renders the plain-text sections of /privacy and /terms.
 *
 * The sections are written with two conventions - a `**Heading:**` line
 * and `•` bullets - and were printed verbatim into a `whitespace-pre-line`
 * paragraph, so every heading showed its asterisks ("**Information You
 * Provide:**") and every list was a paragraph of bullet characters. Here a
 * heading line becomes a subheading, bullet runs become a real list (which a
 * screen reader announces with its length), and blank lines separate
 * paragraphs. Text is never interpreted as HTML.
 */
type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'para'; text: string };

function parse(content: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ kind: 'para', text: para.join(' ') });
    para = [];
  };
  for (const raw of content.split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = line.match(/^\*\*(.+?)\*\*:?$/);
    if (heading) {
      flush();
      blocks.push({ kind: 'heading', text: heading[1].replace(/:$/, '') });
      continue;
    }
    if (line.startsWith('•') || line.startsWith('- ')) {
      flush();
      const item = line.replace(/^(•|-)\s*/, '');
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'list') last.items.push(item);
      else blocks.push({ kind: 'list', items: [item] });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

/** `**term:** text` inside a line: the term bold, never interpreted as HTML. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-foreground">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function LegalText({ content }: { content: string }) {
  return (
    <div className="card-body space-y-3 text-muted-foreground">
      {parse(content).map((block, i) => (
        <Fragment key={i}>
          {block.kind === 'heading' && <h3 className="card-subtitle pt-1 font-semibold text-foreground">{block.text}</h3>}
          {block.kind === 'para' && <p><Inline text={block.text} /></p>}
          {block.kind === 'list' && (
            <ul className="list-disc space-y-1 pl-4 marker:text-muted-foreground/70">
              {block.items.map((item, j) => (
                <li key={j}><Inline text={item} /></li>
              ))}
            </ul>
          )}
        </Fragment>
      ))}
    </div>
  );
}
