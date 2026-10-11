import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ASSIST_LIMITS,
  COLOR_FOR,
  SUGGESTION_TYPES,
  clip,
  confidenceOf,
  heuristicConnections,
  heuristicExtract,
  heuristicQuestions,
  heuristicSynthesis,
  parseJsonReply,
  type ConnectionSuggestion,
  type NodeSuggestion,
  type NodeText,
  type SuggestionType,
} from '@cofounderbay/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OllamaService, type ChatMessage } from '../ai/ollama.service';
import { CanvasSynthesisService } from './canvas-synthesis.service';

/**
 * The research canvas's AI panel: extract notes from pasted text, suggest
 * links between notes, synthesise a cluster, propose questions, and chat.
 *
 * `AIAnalysisPanel` called five `/research/boards/:id/ai/*` routes that did
 * not exist. Every answer here is a proposal — nothing is written to the
 * board; the panel adds what the person accepts. When the model is
 * unavailable or answers with something unusable, a deterministic reading of
 * the same material is returned with `fallback: true`, so the panel still
 * says something true rather than failing.
 */

@Injectable()
export class CanvasAssistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ollama: OllamaService,
    private readonly synthesis: CanvasSynthesisService,
  ) {}

  private async assertAccess(userId: string, boardId: string) {
    const board = await this.prisma.researchBoard.findUnique({
      where: { id: boardId },
      select: { id: true, title: true, ownerId: true, visibility: true, collaborators: { where: { userId }, select: { role: true } } },
    });
    if (!board) throw new NotFoundException('Board not found');
    if (board.ownerId !== userId && !board.collaborators[0] && board.visibility !== 'public') throw new ForbiddenException('Access denied');
    return board;
  }

  private async nodes(boardId: string, ids?: string[]): Promise<NodeText[]> {
    const rows = await this.prisma.researchNode.findMany({
      where: { boardId, ...(ids?.length ? { id: { in: ids.slice(0, ASSIST_LIMITS.nodes) } } : {}) },
      select: { id: true, title: true, content: true },
      orderBy: { createdAt: 'asc' },
      take: ASSIST_LIMITS.nodes,
    });
    return rows.map((r) => ({ id: r.id, title: r.title ?? '', content: typeof r.content === 'string' ? r.content : JSON.stringify(r.content ?? '') }));
  }

  /** Asks the model; null when it is unavailable or answers with nothing usable. */
  private async ask(system: string, user: string): Promise<unknown> {
    const messages: ChatMessage[] = [
      { role: 'system', content: `${system}\nAnswer with JSON only, no prose.` },
      { role: 'user', content: user },
    ];
    try {
      return parseJsonReply(await this.ollama.chat(messages, { temperature: 0.2, maxTokens: 1200 }));
    } catch {
      return null;
    }
  }

  async extract(userId: string, boardId: string, body: unknown) {
    await this.assertAccess(userId, boardId);
    const text = typeof (body as { text?: unknown })?.text === 'string' ? (body as { text: string }).text.trim().slice(0, ASSIST_LIMITS.text) : '';
    if (!text) throw new BadRequestException('Paste some text to extract notes from');
    const reply = await this.ask(
      `You turn research text into canvas notes. Return an array of at most ${ASSIST_LIMITS.suggestions} objects {"type": one of ${SUGGESTION_TYPES.join('|')}, "title": ≤70 chars, "content", "rationale", "confidence": 0..1, "sourceText": the sentence it came from}. Keep the source language.`,
      text,
    );
    const items = Array.isArray(reply) ? reply : [];
    const nodes = items
      .map((raw, i): NodeSuggestion | null => {
        const r = (raw ?? {}) as Record<string, unknown>;
        const title = typeof r.title === 'string' ? r.title.trim() : '';
        if (!title) return null;
        const type = (SUGGESTION_TYPES as readonly unknown[]).includes(r.type) ? (r.type as SuggestionType) : 'note';
        return {
          id: `extract-${i + 1}`,
          type,
          title: clip(title, 70),
          content: typeof r.content === 'string' ? r.content.trim() : title,
          colorKey: COLOR_FOR[type],
          rationale: typeof r.rationale === 'string' ? r.rationale : '',
          confidence: confidenceOf(r.confidence, 0.6),
          sourceText: typeof r.sourceText === 'string' ? r.sourceText : undefined,
        };
      })
      .filter((n): n is NodeSuggestion => n !== null)
      .slice(0, ASSIST_LIMITS.suggestions);
    return nodes.length ? { nodes, fallback: false } : { nodes: heuristicExtract(text), fallback: true };
  }

  async connections(userId: string, boardId: string, body: unknown) {
    await this.assertAccess(userId, boardId);
    const ids = Array.isArray((body as { nodeIds?: unknown })?.nodeIds) ? ((body as { nodeIds: unknown[] }).nodeIds.filter((v) => typeof v === 'string') as string[]) : [];
    const nodes = await this.nodes(boardId, ids);
    if (nodes.length < 2) throw new BadRequestException('Select at least two notes');
    const known = new Set(nodes.map((n) => n.id));
    const reply = await this.ask(
      'You suggest links between research notes. Return an array of {"fromId","toId","connType": supports|contradicts|relates_to|causes|answers,"label","rationale","confidence": 0..1}, using only the ids given.',
      JSON.stringify(nodes.map((n) => ({ id: n.id, title: n.title, content: clip(n.content, 400) }))),
    );
    const connections = (Array.isArray(reply) ? reply : [])
      .map((raw, i): ConnectionSuggestion | null => {
        const r = (raw ?? {}) as Record<string, unknown>;
        if (typeof r.fromId !== 'string' || typeof r.toId !== 'string' || r.fromId === r.toId || !known.has(r.fromId) || !known.has(r.toId)) return null;
        return {
          id: `conn-${i + 1}`,
          fromId: r.fromId,
          toId: r.toId,
          connType: typeof r.connType === 'string' ? r.connType : 'relates_to',
          label: typeof r.label === 'string' ? r.label : 'related',
          rationale: typeof r.rationale === 'string' ? r.rationale : '',
          confidence: confidenceOf(r.confidence, 0.6),
        };
      })
      .filter((c): c is ConnectionSuggestion => c !== null)
      .slice(0, ASSIST_LIMITS.suggestions);
    return connections.length ? { connections, fallback: false } : { connections: heuristicConnections(nodes), fallback: true };
  }

  async synthesize(userId: string, boardId: string, body: unknown) {
    await this.assertAccess(userId, boardId);
    const ids = Array.isArray((body as { nodeIds?: unknown })?.nodeIds) ? ((body as { nodeIds: unknown[] }).nodeIds.filter((v) => typeof v === 'string') as string[]) : [];
    const nodes = await this.nodes(boardId, ids);
    if (nodes.length < 2) throw new BadRequestException('Select at least two notes');
    const reply = (await this.ask(
      'You synthesise research notes into one insight. Return {"title": ≤80 chars, "content": 2-4 sentences, "rationale": which notes support it}. Keep the notes’ language.',
      JSON.stringify(nodes.map((n) => ({ title: n.title, content: clip(n.content, 600) }))),
    )) as Record<string, unknown> | null;
    if (reply && typeof reply.title === 'string' && typeof reply.content === 'string') {
      return { synthesis: { title: clip(reply.title, 80), content: reply.content, rationale: typeof reply.rationale === 'string' ? reply.rationale : '' }, fallback: false };
    }
    return { synthesis: heuristicSynthesis(nodes), fallback: true };
  }

  async questions(userId: string, boardId: string, body: unknown) {
    const board = await this.assertAccess(userId, boardId);
    const focus = typeof (body as { focus?: unknown })?.focus === 'string' ? (body as { focus: string }).focus.trim().slice(0, ASSIST_LIMITS.focus) : '';
    const nodes = await this.nodes(boardId);
    const reply = await this.ask(
      `You propose the research questions a founder should answer next. Return an array of at most ${ASSIST_LIMITS.questions} {"title": a question, "rationale", "confidence": 0..1}.`,
      JSON.stringify({ board: board.title, focus: focus || undefined, notes: nodes.slice(0, 30).map((n) => clip(`${n.title}: ${n.content}`, 200)) }),
    );
    const questions = (Array.isArray(reply) ? reply : [])
      .map((raw, i) => {
        const r = (raw ?? {}) as Record<string, unknown>;
        return typeof r.title === 'string' && r.title.trim()
          ? { id: `q-${i + 1}`, title: r.title.trim(), rationale: typeof r.rationale === 'string' ? r.rationale : '', confidence: confidenceOf(r.confidence, 0.6) }
          : null;
      })
      .filter((q): q is { id: string; title: string; rationale: string; confidence: number } => q !== null)
      .slice(0, ASSIST_LIMITS.questions);
    if (questions.length) return { questions, fallback: false };
    return { questions: heuristicQuestions(nodes, focus), fallback: true };
  }

  /** The panel's chat is the canvas copilot over the whole board. */
  async chat(userId: string, boardId: string, body: unknown) {
    const b = (body ?? {}) as { message?: unknown; history?: unknown };
    const message = typeof b.message === 'string' ? b.message.trim().slice(0, ASSIST_LIMITS.message) : '';
    if (!message) throw new BadRequestException('Write a message');
    const history = (Array.isArray(b.history) ? b.history : [])
      .filter((m): m is { role: 'user' | 'assistant'; content: string } => !!m && typeof m === 'object' && ((m as { role?: unknown }).role === 'user' || (m as { role?: unknown }).role === 'assistant') && typeof (m as { content?: unknown }).content === 'string')
      .slice(-12);
    const result = await this.synthesis.copilotChat(userId, boardId, { agentId: 'canvas-strategy', message, includeAllNodes: true, history });
    return { reply: result.message, fallback: result.fallback };
  }
}
