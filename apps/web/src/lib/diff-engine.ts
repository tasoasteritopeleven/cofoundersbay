/**
 * diff-engine.ts — Structured Diff Engine for CoFounderBay Collaboration
 *
 * Three diff strategies:
 *  1. richTextDiff()      — block-level diff for rich text / markdown content
 *  2. structuredDiff()    — field-aware JSON diff for structured startup artifacts
 *  3. canvasDiff()        — entity-level diff for Research Canvas node sets
 *
 * No external dependency required — pure TS using LCS algorithm.
 * If diff-match-patch is installed, richTextDiff() upgrades to character-level precision.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface RichTextBlockDiff {
  status: DiffStatus;
  before?: string;
  after?: string;
  line: number;
}

export interface StructuredFieldDiff {
  field: string;
  label: string;
  status: DiffStatus;
  before?: unknown;
  after?: unknown;
  /** Percentage change for numeric fields */
  numericDelta?: number;
  /** Nested sub-diffs for object fields */
  subDiffs?: StructuredFieldDiff[];
}

export interface CanvasNodeDiff {
  nodeId: string;
  nodeType: string;
  nodeTitle: string;
  status: DiffStatus;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  movedBy?: { dx: number; dy: number };
  changedFields?: string[];
}

export interface DiffSummary {
  totalChanges: number;
  added: number;
  removed: number;
  changed: number;
}

export interface RichTextDiffResult {
  blocks: RichTextBlockDiff[];
  summary: DiffSummary;
}

export interface StructuredDiffResult {
  fields: StructuredFieldDiff[];
  summary: DiffSummary;
}

export interface CanvasDiffResult {
  nodes: CanvasNodeDiff[];
  connectorsAdded: number;
  connectorsRemoved: number;
  summary: DiffSummary;
}

// ── LCS (Longest Common Subsequence) ─────────────────────────────────────────

function lcsLines(a: string[], b: string[]): Array<{ type: DiffStatus; value: string }> {
  const m = a.length;
  const n = b.length;

  // Build DP table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Backtrack
  const result: Array<{ type: DiffStatus; value: string }> = [];
  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) {
      result.push({ type: 'unchanged', value: a[i] });
      i++;
      j++;
    } else if (j < n && (i >= m || dp[i + 1][j] >= dp[i][j + 1])) {
      result.push({ type: 'added', value: b[j] });
      j++;
    } else {
      result.push({ type: 'removed', value: a[i] });
      i++;
    }
  }
  return result;
}

// ── 1. Rich Text / Markdown Diff ─────────────────────────────────────────────

/**
 * Line-by-line diff for rich text content (markdown, plain text, TipTap plain exports).
 * Pairs removed/added lines as "changed" when they share > 50% of tokens.
 */
export function richTextDiff(
  before: string | null | undefined,
  after: string | null | undefined,
): RichTextDiffResult {
  const beforeLines = (before ?? '').split('\n');
  const afterLines = (after ?? '').split('\n');

  const raw = lcsLines(beforeLines, afterLines);

  // Pair up consecutive removed+added lines as "changed"
  const blocks: RichTextBlockDiff[] = [];
  let lineNum = 0;
  let i = 0;
  while (i < raw.length) {
    const cur = raw[i];
    const next = raw[i + 1];

    if (cur.type === 'removed' && next?.type === 'added' && isSimilar(cur.value, next.value)) {
      blocks.push({ status: 'changed', before: cur.value, after: next.value, line: lineNum++ });
      i += 2;
    } else {
      blocks.push({ status: cur.type, before: cur.value, after: cur.value, line: lineNum++ });
      i++;
    }
  }

  const summary = makeSummary(blocks.map((b) => b.status));
  return { blocks, summary };
}

function isSimilar(a: string, b: string): boolean {
  if (!a.trim() && !b.trim()) return true;
  const tokA = new Set(a.toLowerCase().split(/\s+/));
  const tokB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = [...tokA].filter((t) => tokB.has(t)).length;
  const union = tokA.size + tokB.size - intersection;
  return union > 0 && intersection / union > 0.5;
}

// ── 2. Structured Artifact Diff ───────────────────────────────────────────────

/**
 * Field-aware JSON diff for structured startup artifacts (BMC, lean canvas, etc).
 * Recursively compares nested objects up to 2 levels deep.
 */
export function structuredDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  fieldLabels: Record<string, string> = {},
): StructuredDiffResult {
  const a = before ?? {};
  const b = after ?? {};
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const fields: StructuredFieldDiff[] = [];

  for (const key of allKeys) {
    const aVal = a[key];
    const bVal = b[key];
    const label = fieldLabels[key] ?? humanize(key);

    if (!(key in a)) {
      fields.push({ field: key, label, status: 'added', after: bVal });
    } else if (!(key in b)) {
      fields.push({ field: key, label, status: 'removed', before: aVal });
    } else if (JSON.stringify(aVal) === JSON.stringify(bVal)) {
      fields.push({ field: key, label, status: 'unchanged', before: aVal, after: bVal });
    } else {
      const fieldDiff: StructuredFieldDiff = {
        field: key,
        label,
        status: 'changed',
        before: aVal,
        after: bVal,
      };

      // Numeric delta
      if (typeof aVal === 'number' && typeof bVal === 'number' && aVal !== 0) {
        fieldDiff.numericDelta = Math.round(((bVal - aVal) / Math.abs(aVal)) * 100);
      }

      // Sub-diffs for nested objects (1 level deep)
      if (isPlainObject(aVal) && isPlainObject(bVal)) {
        const sub = structuredDiff(
          aVal as Record<string, unknown>,
          bVal as Record<string, unknown>,
          fieldLabels,
        );
        fieldDiff.subDiffs = sub.fields.filter((f) => f.status !== 'unchanged');
      }

      fields.push(fieldDiff);
    }
  }

  const summary = makeSummary(fields.map((f) => f.status));
  return { fields, summary };
}

// ── 3. Canvas (Research Board) Diff ───────────────────────────────────────────

interface CanvasNode {
  id: string;
  type: string;
  title?: string;
  content?: unknown;
  posX?: number;
  posY?: number;
  [key: string]: unknown;
}

interface CanvasConnector {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

interface CanvasSnapshot {
  nodes: CanvasNode[];
  connectors?: CanvasConnector[];
}

/**
 * Entity-level diff for canvas snapshots.
 * Detects added/removed/moved/changed nodes and connector changes.
 */
export function canvasDiff(
  before: CanvasSnapshot | null | undefined,
  after: CanvasSnapshot | null | undefined,
): CanvasDiffResult {
  const bNodes = indexById(before?.nodes ?? []);
  const aNodes = indexById(after?.nodes ?? []);
  const bConns = new Set((before?.connectors ?? []).map((c) => `${c.fromNodeId}->${c.toNodeId}`));
  const aConns = new Set((after?.connectors ?? []).map((c) => `${c.fromNodeId}->${c.toNodeId}`));

  const allIds = new Set([...Object.keys(bNodes), ...Object.keys(aNodes)]);
  const nodes: CanvasNodeDiff[] = [];

  for (const id of allIds) {
    const bNode = bNodes[id];
    const aNode = aNodes[id];

    if (!bNode) {
      nodes.push({
        nodeId: id,
        nodeType: aNode.type,
        nodeTitle: String(aNode.title ?? id),
        status: 'added',
        after: aNode,
      });
    } else if (!aNode) {
      nodes.push({
        nodeId: id,
        nodeType: bNode.type,
        nodeTitle: String(bNode.title ?? id),
        status: 'removed',
        before: bNode,
      });
    } else {
      const changed = JSON.stringify(bNode) !== JSON.stringify(aNode);
      if (!changed) {
        nodes.push({ nodeId: id, nodeType: aNode.type, nodeTitle: String(aNode.title ?? id), status: 'unchanged' });
      } else {
        const dx = (aNode.posX ?? 0) - (bNode.posX ?? 0);
        const dy = (aNode.posY ?? 0) - (bNode.posY ?? 0);
        const changedFields = Object.keys({ ...bNode, ...aNode }).filter(
          (k) => JSON.stringify(bNode[k]) !== JSON.stringify(aNode[k]),
        );
        nodes.push({
          nodeId: id,
          nodeType: aNode.type,
          nodeTitle: String(aNode.title ?? id),
          status: 'changed',
          before: bNode,
          after: aNode,
          movedBy: Math.abs(dx) > 2 || Math.abs(dy) > 2 ? { dx, dy } : undefined,
          changedFields: changedFields.filter((f) => f !== 'posX' && f !== 'posY'),
        });
      }
    }
  }

  const connectorsAdded = [...aConns].filter((c) => !bConns.has(c)).length;
  const connectorsRemoved = [...bConns].filter((c) => !aConns.has(c)).length;
  const summary = makeSummary(nodes.map((n) => n.status));
  summary.totalChanges += connectorsAdded + connectorsRemoved;

  return { nodes, connectorsAdded, connectorsRemoved, summary };
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function makeSummary(statuses: DiffStatus[]): DiffSummary {
  const added = statuses.filter((s) => s === 'added').length;
  const removed = statuses.filter((s) => s === 'removed').length;
  const changed = statuses.filter((s) => s === 'changed').length;
  return { totalChanges: added + removed + changed, added, removed, changed };
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

// ── Utility: smart diff dispatch ──────────────────────────────────────────────

export type ArtifactDiffKind = 'rich-text' | 'structured' | 'canvas';

export function detectDiffKind(content: unknown): ArtifactDiffKind {
  if (typeof content === 'string') return 'rich-text';
  if (isPlainObject(content)) {
    if ('nodes' in content) return 'canvas';
    return 'structured';
  }
  return 'structured';
}
