import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PitchService, publicSlides, readContact } from './pitch.service';

describe('publicSlides', () => {
  it('keeps free text as text slides, maps problem/solution onto headline and points, and never publishes notes', () => {
    const slides = publicSlides([
      { id: 's2', type: 'problem', title: 'Problem', content: 'Clinics lose 20% of bookings\n- No-shows\n- Paper calendars', notes: 'say the 20% slowly', order: 1 },
      { id: 's1', type: 'cover', title: 'Harbor', content: 'Bookings that keep', notes: 'secret', order: 0 },
      { id: 's3', type: 'team', title: 'Team', content: '', order: 2 },
      { id: 's4', type: 'solution', title: 'Solution', content: 'One line only', order: 3 },
    ]);
    expect(slides).toEqual([
      { id: 's1', type: 'text', title: 'Harbor', order: 0, content: { body: 'Bookings that keep' } },
      { id: 's2', type: 'problem', title: 'Problem', order: 1, content: { headline: 'Clinics lose 20% of bookings', points: ['No-shows', 'Paper calendars'] } },
      { id: 's4', type: 'text', title: 'Solution', order: 3, content: { body: 'One line only' } },
    ]);
    expect(JSON.stringify(slides)).not.toContain('secret');
    expect(publicSlides(undefined)).toEqual([]);
  });
});

describe('readContact', () => {
  it('takes a name, an answerable address and an optional message', () => {
    expect(readContact({ name: ' Maria ', email: 'Maria@Fund.example ', message: '' })).toEqual({ name: 'Maria', email: 'maria@fund.example', message: null });
    expect(() => readContact({ name: '', email: 'a@b.co' })).toThrow(BadRequestException);
    expect(() => readContact({ name: 'x', email: 'not-an-email' })).toThrow(/email address/);
    expect(() => readContact({ name: 'x', email: 'a@b.co', message: 'y'.repeat(1001) })).toThrow(/at most 1000/);
  });
});

function setup() {
  const pitches: Record<string, any>[] = [];
  const prisma = {
    builderDocument: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id === 'doc-1') {
          return {
            id: 'doc-1',
            type: 'pitch_deck',
            title: 'Seed deck',
            content: { companyName: 'Harbor', tagline: 'Bookings that keep', slides: [{ id: 's', type: 'ask', title: 'Ask', content: '€500k', notes: 'n', order: 0 }] },
            createdAt: new Date('2026-09-01'),
            updatedAt: new Date('2026-10-01'),
            workspace: { ownerId: 'u-elena', name: 'WS', startupName: 'Harbor', owner: { id: 'u-elena', profile: { displayName: 'Elena', avatarUrl: null, headline: 'Founder' } } },
          };
        }
        if (where.id === 'doc-bmc') return { id: 'doc-bmc', type: 'business_model_canvas', workspace: { ownerId: 'u-elena' } };
        return null;
      }),
    },
    publicPitch: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; documentId?: string } }) => pitches.find((p) => (where.id ? p.id === where.id : p.documentId === where.documentId)) ?? null),
      upsert: vi.fn(async ({ where, create, update }: { where: { documentId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const existing = pitches.find((p) => p.documentId === where.documentId);
        if (existing) return Object.assign(existing, update);
        const row = { id: 'pub-1', isPublic: true, allowContact: true, views: 0, shares: 0, contactRequests: 0, createdAt: new Date('2026-10-02'), ...create };
        pitches.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
        const row = pitches.find((p) => p.id === where.id)!;
        for (const [k, v] of Object.entries(data)) row[k] = v && typeof v === 'object' && 'increment' in v ? row[k] + v.increment : v;
        return row;
      }),
    },
    pitchContactRequest: { create: vi.fn(async () => ({})) },
  };
  const notifications = { createNotification: vi.fn(async () => ({})) };
  return { service: new PitchService(prisma as never, notifications as never), prisma, notifications, pitches };
}

describe('PitchService', () => {
  it('publishes only the owner’s pitch deck', async () => {
    const { service } = setup();
    await expect(service.publish('u-marcus', { documentId: 'doc-1' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.publish('u-elena', { documentId: 'doc-bmc' })).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.publish('u-elena', { documentId: 'doc-1' })).toEqual({ pitch: { id: 'pub-1', isPublic: true, allowContact: true, views: 0, contactRequests: 0 } });
  });

  it('serves the public shape under the public id, without the owner’s notes, and counts views', async () => {
    const { service } = setup();
    await service.publish('u-elena', { documentId: 'doc-1' });
    const { deck } = await service.getPublic('pub-1');
    expect(deck).toMatchObject({ id: 'pub-1', companyName: 'Harbor', tagline: 'Bookings that keep', author: { name: 'Elena' }, allowContact: true });
    expect(deck.slides).toEqual([{ id: 's', type: 'text', title: 'Ask', order: 0, content: { body: '€500k' } }]);
    await expect(service.getPublic('doc-1')).rejects.toBeInstanceOf(NotFoundException);
    await service.recordView('pub-1');
    expect((await service.getPublic('pub-1')).deck.stats.views).toBe(1);
  });

  it('hides an unpublished deck like a missing one, and keeps its counts for republishing', async () => {
    const { service } = setup();
    await service.publish('u-elena', { documentId: 'doc-1' });
    await service.recordView('pub-1');
    await service.unpublish('u-elena', 'doc-1');
    await expect(service.getPublic('pub-1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.recordView('pub-1')).rejects.toBeInstanceOf(NotFoundException);
    await service.publish('u-elena', { documentId: 'doc-1' });
    expect((await service.getPublic('pub-1')).deck.stats.views).toBe(1);
  });

  it('stores a contact request, notifies the owner, and refuses when contact is off', async () => {
    const { service, prisma, notifications } = setup();
    await service.publish('u-elena', { documentId: 'doc-1' });
    expect(await service.contact('pub-1', { name: 'Maria', email: 'maria@fund.example', message: 'Can we talk?' })).toEqual({ ok: true });
    expect(prisma.pitchContactRequest.create).toHaveBeenCalledWith({ data: { pitchId: 'pub-1', name: 'Maria', email: 'maria@fund.example', message: 'Can we talk?' } });
    expect(notifications.createNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u-elena', title: 'Maria wrote about your pitch' }));
    await service.publish('u-elena', { documentId: 'doc-1', allowContact: false });
    await expect(service.contact('pub-1', { name: 'Spam', email: 's@x.co' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
