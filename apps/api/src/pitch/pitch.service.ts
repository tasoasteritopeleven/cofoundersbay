import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Public pitch decks at `/pitch/[id]`.
 *
 * The page called `/api/pitch/:id/public`, `/view` and `/contact`, none of
 * which existed, and fell back to a sample deck for any id at all. A deck is
 * public now only when its owner publishes it from the builder; the public id
 * is not the document id, and unpublishing hides it without losing its counts.
 *
 * The builder keeps each slide as free text (`content`, `notes`). The public
 * page has richer renderers for some slide types; free text is mapped onto
 * them only where it fits honestly (problem and solution read as a headline
 * and points) and is otherwise served as a `text` slide. Speaker notes are
 * never published.
 */

export const PITCH_LIMITS = { name: 80, email: 254, message: 1000, slides: 40, slideText: 4000 } as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface BuilderSlide {
  id?: unknown;
  type?: unknown;
  title?: unknown;
  content?: unknown;
  order?: unknown;
}

export interface PublicSlide {
  id: string;
  type: string;
  title: string;
  content: Record<string, unknown>;
  order: number;
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim())
    .filter(Boolean);
}

/** Maps the builder's free-text slides onto the public renderers; notes stay private. */
export function publicSlides(raw: unknown): PublicSlide[] {
  const slides = Array.isArray(raw) ? (raw as BuilderSlide[]) : [];
  return slides
    .filter((s) => s && typeof s === 'object')
    .slice(0, PITCH_LIMITS.slides)
    .map((s, index) => {
      const text = typeof s.content === 'string' ? s.content.slice(0, PITCH_LIMITS.slideText) : '';
      const title = typeof s.title === 'string' && s.title.trim() ? s.title.trim() : `Slide ${index + 1}`;
      const type = typeof s.type === 'string' ? s.type : 'text';
      const order = typeof s.order === 'number' ? s.order : index;
      const id = typeof s.id === 'string' && s.id ? s.id : `slide-${index + 1}`;
      const parts = lines(text);
      if ((type === 'problem' || type === 'solution') && parts.length >= 2) {
        return { id, type, title, order, content: { headline: parts[0], points: parts.slice(1) } };
      }
      return { id, type: 'text', title, order, content: { body: text.trim() } };
    })
    .filter((s) => s.type !== 'text' || (s.content.body as string).length > 0)
    .sort((a, b) => a.order - b.order);
}

export function readContact(body: unknown): { name: string; email: string; message: string | null } {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const message = typeof b.message === 'string' ? b.message.trim() : '';
  if (!name || name.length > PITCH_LIMITS.name) throw new BadRequestException(`Give a name of at most ${PITCH_LIMITS.name} characters`);
  if (!EMAIL.test(email) || email.length > PITCH_LIMITS.email) throw new BadRequestException('Give an email address the founder can answer');
  if (message.length > PITCH_LIMITS.message) throw new BadRequestException(`The message is at most ${PITCH_LIMITS.message} characters`);
  return { name, email, message: message || null };
}

@Injectable()
export class PitchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The owner's deck and its publication, if any. */
  private async ownedDeck(userId: string, documentId: string) {
    const doc = await this.prisma.builderDocument.findUnique({
      where: { id: documentId },
      select: { id: true, type: true, workspace: { select: { ownerId: true } } },
    });
    if (!doc || doc.type !== 'pitch_deck') throw new NotFoundException('Pitch deck not found');
    if (doc.workspace.ownerId !== userId) throw new ForbiddenException('Only the deck’s owner can publish it');
    return doc;
  }

  async status(userId: string, documentId: string) {
    await this.ownedDeck(userId, documentId);
    const pitch = await this.prisma.publicPitch.findUnique({ where: { documentId } });
    return { pitch: pitch ? { id: pitch.id, isPublic: pitch.isPublic, allowContact: pitch.allowContact, views: pitch.views, contactRequests: pitch.contactRequests } : null };
  }

  async publish(userId: string, body: unknown) {
    const b = (body ?? {}) as Record<string, unknown>;
    const documentId = typeof b.documentId === 'string' ? b.documentId : '';
    if (!documentId) throw new BadRequestException('documentId is required');
    await this.ownedDeck(userId, documentId);
    const allowContact = b.allowContact !== false;
    const pitch = await this.prisma.publicPitch.upsert({
      where: { documentId },
      create: { documentId, ownerId: userId, allowContact },
      update: { isPublic: true, allowContact },
    });
    return { pitch: { id: pitch.id, isPublic: true, allowContact: pitch.allowContact, views: pitch.views, contactRequests: pitch.contactRequests } };
  }

  async unpublish(userId: string, documentId: string) {
    await this.ownedDeck(userId, documentId);
    const pitch = await this.prisma.publicPitch.findUnique({ where: { documentId } });
    if (!pitch) return { ok: true };
    await this.prisma.publicPitch.update({ where: { id: pitch.id }, data: { isPublic: false } });
    return { ok: true };
  }

  private async publicRow(id: string) {
    const pitch = await this.prisma.publicPitch.findUnique({ where: { id } });
    // A withdrawn deck reads exactly like one that never existed.
    if (!pitch || !pitch.isPublic) throw new NotFoundException('This pitch is not public');
    return pitch;
  }

  async getPublic(id: string) {
    const pitch = await this.publicRow(id);
    const doc = await this.prisma.builderDocument.findUnique({
      where: { id: pitch.documentId },
      select: {
        id: true,
        title: true,
        content: true,
        createdAt: true,
        updatedAt: true,
        workspace: {
          select: {
            name: true,
            startupName: true,
            owner: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true, headline: true } } } },
          },
        },
      },
    });
    if (!doc) throw new NotFoundException('This pitch is not public');
    const content = (doc.content && typeof doc.content === 'object' ? doc.content : {}) as Record<string, unknown>;
    const companyName = (typeof content.companyName === 'string' && content.companyName.trim()) || doc.workspace.startupName || doc.workspace.name;
    const tagline = typeof content.tagline === 'string' && content.tagline.trim() ? content.tagline.trim() : undefined;
    return {
      deck: {
        id: pitch.id,
        title: doc.title,
        companyName,
        tagline,
        slides: publicSlides(content.slides),
        author: {
          id: doc.workspace.owner.id,
          name: doc.workspace.owner.profile?.displayName ?? companyName,
          avatarUrl: doc.workspace.owner.profile?.avatarUrl ?? undefined,
          headline: doc.workspace.owner.profile?.headline ?? undefined,
        },
        stats: { views: pitch.views, shares: pitch.shares, contactRequests: pitch.contactRequests },
        isPublic: true,
        allowContact: pitch.allowContact,
        createdAt: pitch.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      },
    };
  }

  async recordView(id: string) {
    const pitch = await this.publicRow(id);
    await this.prisma.publicPitch.update({ where: { id: pitch.id }, data: { views: { increment: 1 } } });
    return { ok: true };
  }

  async contact(id: string, body: unknown) {
    const pitch = await this.publicRow(id);
    if (!pitch.allowContact) throw new ForbiddenException('The founder is not taking messages on this pitch');
    const input = readContact(body);
    await this.prisma.pitchContactRequest.create({ data: { pitchId: pitch.id, ...input } });
    await this.prisma.publicPitch.update({ where: { id: pitch.id }, data: { contactRequests: { increment: 1 } } });
    await this.notifications.createNotification({
      userId: pitch.ownerId,
      type: 'fundraising_update',
      title: `${input.name} wrote about your pitch`,
      body: input.message ? input.message.slice(0, 280) : `Reply to ${input.email}`,
      link: '/builder/pitch-deck',
      meta: { pitchId: pitch.id, email: input.email },
    });
    return { ok: true };
  }
}
