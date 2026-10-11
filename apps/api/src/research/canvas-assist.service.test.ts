import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { classifySentence, heuristicConnections, heuristicExtract, parseJsonReply } from '@cofounderbay/shared';
import { CanvasAssistService } from './canvas-assist.service';

describe('reading a model’s reply', () => {
  it('takes the JSON out of prose or a fenced block, or gives null', () => {
    expect(parseJsonReply('Sure! ```json\n[{"title":"a"}]\n```')).toEqual([{ title: 'a' }]);
    expect(parseJsonReply('Here: {"title":"x","content":"y"} done')).toEqual({ title: 'x', content: 'y' });
    expect(parseJsonReply('no json here')).toBeNull();
  });
});

describe('the no-model path', () => {
  it('classifies sentences in English and Greek', () => {
    expect(classifySentence('Why do clinics churn?')).toBe('question');
    expect(classifySentence('We assume owners will pay monthly')).toBe('hypothesis');
    expect(classifySentence('12 of 15 interviews mentioned no-shows')).toBe('insight');
    expect(classifySentence('Πρέπει να μιλήσουμε με 5 κλινικές')).toBe('task');
  });

  it('extracts only note types the canvas can create', () => {
    const nodes = heuristicExtract('Clinics lose 20% of bookings to no-shows. Why do owners still use paper? We assume they will pay monthly.');
    expect(nodes.map((n) => n.type)).toEqual(['insight', 'question', 'hypothesis']);
    expect(nodes.every((n) => ['insight', 'question', 'hypothesis', 'task', 'note'].includes(n.type))).toBe(true);
  });

  it('links notes that share vocabulary, and only those', () => {
    const links = heuristicConnections([
      { id: 'a', title: 'Clinic no-shows', content: 'Dental clinics lose bookings to no-shows' },
      { id: 'b', title: 'Reminder pilot', content: 'SMS reminders cut no-shows at dental clinics' },
      { id: 'c', title: 'Pricing', content: 'Monthly subscription for owners' },
    ]);
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ fromId: 'a', toId: 'b', connType: 'relates_to' });
    expect(links[0].rationale).toMatch(/clinics|dental|no-shows/);
  });
});

function setup(chatReply: string | Error) {
  const prisma = {
    researchBoard: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'b-1' ? { id: 'b-1', title: 'Harbor research', ownerId: 'u-me', visibility: 'private', collaborators: [] } : { id: 'b-2', title: 'Other', ownerId: 'u-x', visibility: 'private', collaborators: [] },
      ),
    },
    researchNode: {
      findMany: vi.fn(async () => [
        { id: 'n1', title: 'Clinic no-shows', content: 'Dental clinics lose bookings to no-shows' },
        { id: 'n2', title: 'We assume owners pay monthly', content: 'Hypothesis about pricing' },
      ]),
    },
  };
  const ollama = { chat: vi.fn(async () => { if (chatReply instanceof Error) throw chatReply; return chatReply; }) };
  const synthesis = { copilotChat: vi.fn(async () => ({ message: 'Your board points at no-shows.', fallback: false })) };
  return { service: new CanvasAssistService(prisma as never, ollama as never, synthesis as never), ollama, synthesis };
}

describe('CanvasAssistService', () => {
  it('uses the model’s notes when they are usable, coercing unknown types to note', async () => {
    const { service } = setup('[{"type":"citation","title":"Paper calendars","content":"Owners use paper","confidence":0.8},{"type":"question","title":"Who pays?"}]');
    const { nodes, fallback } = await service.extract('u-me', 'b-1', { text: 'Owners use paper calendars. Who pays?' });
    expect(fallback).toBe(false);
    expect(nodes.map((n) => [n.type, n.title])).toEqual([['note', 'Paper calendars'], ['question', 'Who pays?']]);
  });

  it('falls back to a plain reading, flagged, when the model is down', async () => {
    const { service } = setup(new Error('Ollama service is not available'));
    const result = await service.extract('u-me', 'b-1', { text: 'Clinics lose 20% of bookings to no-shows.' });
    expect(result.fallback).toBe(true);
    expect(result.nodes[0]).toMatchObject({ type: 'insight', confidence: 0.4 });
    const synth = await service.synthesize('u-me', 'b-1', { nodeIds: ['n1', 'n2'] });
    expect(synth).toMatchObject({ fallback: true, synthesis: { title: 'What 2 notes say together' } });
    const q = await service.questions('u-me', 'b-1', { focus: 'pricing' });
    expect(q.fallback).toBe(true);
    expect(q.questions.map((x) => x.title).join(' ')).toMatch(/pricing/);
  });

  it('drops model links that name notes outside the selection', async () => {
    const { service } = setup('[{"fromId":"n1","toId":"n2","connType":"supports"},{"fromId":"n1","toId":"zz"}]');
    const { connections, fallback } = await service.connections('u-me', 'b-1', { nodeIds: ['n1', 'n2'] });
    expect(fallback).toBe(false);
    expect(connections).toEqual([expect.objectContaining({ fromId: 'n1', toId: 'n2', connType: 'supports' })]);
  });

  it('chats through the canvas copilot over the whole board', async () => {
    const { service, synthesis } = setup('');
    expect(await service.chat('u-me', 'b-1', { message: 'What stands out?', history: [{ role: 'user', content: 'hi' }, { role: 'system', content: 'x' }] })).toEqual({ reply: 'Your board points at no-shows.', fallback: false });
    expect(synthesis.copilotChat).toHaveBeenCalledWith('u-me', 'b-1', { agentId: 'canvas-strategy', message: 'What stands out?', includeAllNodes: true, history: [{ role: 'user', content: 'hi' }] });
  });

  it('refuses boards the reader cannot see, and empty requests', async () => {
    const { service } = setup('[]');
    await expect(service.extract('u-me', 'b-2', { text: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.extract('u-me', 'b-1', { text: '  ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.chat('u-me', 'b-1', { message: '' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
