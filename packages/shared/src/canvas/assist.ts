/**
 * The research canvas AI panel's deterministic rules, shared by the API
 * (`apps/api/src/research/canvas-assist.service.ts`, used when the model is
 * unavailable or unusable) and the preview demo, so both read pasted text
 * and link notes the same way. Nothing here calls a model or writes a board.
 */

export const SUGGESTION_TYPES = ['insight', 'question', 'hypothesis', 'task', 'note'] as const;
export type SuggestionType = (typeof SUGGESTION_TYPES)[number];
export const COLOR_FOR: Record<SuggestionType, string> = { insight: 'yellow', question: 'blue', hypothesis: 'purple', task: 'green', note: 'gray' };
export const ASSIST_LIMITS = { text: 12_000, nodes: 40, suggestions: 8, questions: 6, focus: 300, message: 4000 } as const;

export interface NodeSuggestion {
  id: string;
  type: SuggestionType;
  title: string;
  content: string;
  colorKey: string;
  rationale: string;
  confidence: number;
  sourceText?: string;
}

export interface ConnectionSuggestion {
  id: string;
  fromId: string;
  toId: string;
  connType: string;
  label: string;
  rationale: string;
  confidence: number;
}

export interface NodeText {
  id: string;
  title: string;
  content: string;
}

/** The first JSON array or object in a model's reply, or null. */
export function parseJsonReply(reply: string): unknown {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? reply;
  for (const [open, close] of [['[', ']'], ['{', '}']] as const) {
    const start = fenced.indexOf(open);
    const end = fenced.lastIndexOf(close);
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(fenced.slice(start, end + 1));
      } catch {
        // try the other bracket kind
      }
    }
  }
  return null;
}

export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
export const confidenceOf = (v: unknown, fallback: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : fallback);

/** Classifies one sentence the way a reader would, for the no-model path. */
export function classifySentence(sentence: string): SuggestionType {
  const s = sentence.toLowerCase();
  // `\b` is ASCII-only in JavaScript, so Greek words take a letter lookbehind.
  const word = (alternatives: string) => new RegExp(`(?<![\\p{L}])(?:${alternatives})`, 'u');
  if (/\?\s*$/u.test(s) || word('how|why|what|which|who|when|πώς|γιατί|τι |ποι').test(s.slice(0, 12))) return 'question';
  if (word('we (?:assume|believe|think|expect)|hypothes|if .* then|υποθέτ|πιστεύουμε').test(s)) return 'hypothesis';
  if (word('need to|should|must|todo|next step|πρέπει|να κάνουμε').test(s)) return 'task';
  if (/\d|%|€|\$/u.test(s) || word('found|shows?|data|survey|interviews?|βρήκαμε|έρευνα|συνεντεύξ').test(s)) return 'insight';
  return 'note';
}

/** Splits pasted text into candidate notes when no model is available. */
export function heuristicExtract(text: string): NodeSuggestion[] {
  const sentences = text
    .split(/(?<=[.!?;])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
  return sentences.slice(0, ASSIST_LIMITS.suggestions).map((sentence, i) => {
    const type = classifySentence(sentence);
    return {
      id: `extract-${i + 1}`,
      type,
      title: clip(sentence.replace(/[.!;]+$/, ''), 70),
      content: sentence,
      colorKey: COLOR_FOR[type],
      rationale: 'Taken from the text as written; the AI service did not answer.',
      confidence: 0.4,
      sourceText: sentence,
    };
  });
}

const STOP = new Set('the a an and or of to in on for with is are was were be by as at it this that we our you your from not but into than then have has had will can could should would their they them its also more most very και το τα η οι ο της του των σε με για από που να δεν ένα μια είναι'.split(' '));
function terms(n: NodeText): Set<string> {
  return new Set(
    `${n.title} ${n.content}`
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );
}

/** Pairs of notes that share vocabulary, strongest first, when no model is available. */
export function heuristicConnections(nodes: NodeText[]): ConnectionSuggestion[] {
  const bags = nodes.map((n) => ({ n, t: terms(n) }));
  const pairs: ConnectionSuggestion[] = [];
  for (let i = 0; i < bags.length; i++) {
    for (let j = i + 1; j < bags.length; j++) {
      const shared = [...bags[i].t].filter((w) => bags[j].t.has(w));
      const union = new Set([...bags[i].t, ...bags[j].t]).size || 1;
      const score = shared.length / union;
      if (shared.length >= 2 || score >= 0.2) {
        pairs.push({
          id: `conn-${bags[i].n.id}-${bags[j].n.id}`,
          fromId: bags[i].n.id,
          toId: bags[j].n.id,
          connType: 'relates_to',
          label: 'related',
          rationale: `Both mention ${shared.slice(0, 3).join(', ')}.`,
          confidence: Math.min(0.9, Math.round((0.3 + score) * 100) / 100),
        });
      }
    }
  }
  return pairs.sort((a, b) => b.confidence - a.confidence).slice(0, ASSIST_LIMITS.suggestions);
}


/** One insight listing the selected notes, without inferring anything. */
export function heuristicSynthesis(nodes: Array<{ title: string; content: string }>) {
  return {
    title: `What ${nodes.length} notes say together`,
    content: nodes.map((n) => `• ${n.title || clip(n.content, 80)}`).join('\n'),
    rationale: 'Listed from the selected notes; the AI service did not answer, so nothing was inferred.',
  };
}

/** Questions from the board's own assumptions and the reader's focus. */
export function heuristicQuestions(nodes: Array<{ title: string; content: string }>, focus: string) {
  const hypotheses = nodes.filter((n) => classifySentence(`${n.title} ${n.content}`) === 'hypothesis').slice(0, 3);
  return [
    ...hypotheses.map((n, i) => ({ id: `q-h${i + 1}`, title: `What evidence would confirm or refute: “${clip(n.title || n.content, 80)}”?`, rationale: 'An assumption on the board without evidence beside it.', confidence: 0.4 })),
    ...(focus ? [{ id: 'q-focus', title: `What do we still not know about ${focus}?`, rationale: 'The focus you gave.', confidence: 0.4 }] : []),
    { id: 'q-customer', title: 'Who has this problem most acutely, and how do they solve it today?', rationale: 'A standard first question when the board has no customer evidence yet.', confidence: 0.3 },
  ].slice(0, ASSIST_LIMITS.questions);
}
