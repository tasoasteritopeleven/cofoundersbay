import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  isSavedItemKind,
  readSaveRequest,
  SAVED_ITEMS_LIMIT,
  type SavedItemKind,
  type SavedItemView,
} from '@cofounderbay/shared';
import { PrismaService } from '../prisma/prisma.service';

type Row = { kind: string; itemId: string; title: string; createdAt: Date };

/**
 * A member's saved listings and jobs. Private: nothing here notifies the
 * poster or anyone else, and only the member reads their own rows.
 *
 * Only an item that exists can be saved, and its title is copied from the
 * source here, never taken from the request - the "Save" buttons it replaces
 * showed "Saved on this device" and stored nothing.
 */
@Injectable()
export class SavedItemsService {
  constructor(private readonly prisma: PrismaService) {}

  private view(row: Row): SavedItemView {
    return { kind: row.kind as SavedItemKind, itemId: row.itemId, title: row.title, savedAt: row.createdAt.toISOString() };
  }

  async list(userId: string, kind?: string): Promise<{ items: SavedItemView[] }> {
    if (kind !== undefined && kind !== '' && !isSavedItemKind(kind)) throw new BadRequestException('Unknown kind');
    const rows: Row[] = await this.prisma.savedItem.findMany({
      where: { userId, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
      take: SAVED_ITEMS_LIMIT,
      select: { kind: true, itemId: true, title: true, createdAt: true },
    });
    return { items: rows.map((r) => this.view(r)) };
  }

  /** The source's title, or null when the item does not exist. */
  private async titleOf(kind: SavedItemKind, itemId: string): Promise<string | null> {
    if (kind === 'opportunity') {
      const row = await this.prisma.opportunity.findUnique({ where: { id: itemId }, select: { title: true } });
      return row?.title ?? null;
    }
    const row = await this.prisma.jobPosting.findUnique({ where: { id: itemId }, select: { title: true } });
    return row?.title ?? null;
  }

  async save(userId: string, body: unknown): Promise<{ item: SavedItemView; saved: true }> {
    const req = readSaveRequest(body);
    if (!req) throw new BadRequestException('kind and itemId are required');
    const title = await this.titleOf(req.kind, req.itemId);
    if (title === null) throw new NotFoundException('That item does not exist');
    const existing: Row | null = await this.prisma.savedItem.findUnique({
      where: { userId_kind_itemId: { userId, kind: req.kind, itemId: req.itemId } },
      select: { kind: true, itemId: true, title: true, createdAt: true },
    });
    if (existing) return { item: this.view(existing), saved: true };
    const count = await this.prisma.savedItem.count({ where: { userId } });
    if (count >= SAVED_ITEMS_LIMIT) {
      throw new BadRequestException(`You can keep up to ${SAVED_ITEMS_LIMIT} saved items; remove one first`);
    }
    const row: Row = await this.prisma.savedItem.create({
      data: { userId, kind: req.kind, itemId: req.itemId, title },
      select: { kind: true, itemId: true, title: true, createdAt: true },
    });
    return { item: this.view(row), saved: true };
  }

  /** Removing what was not saved is not an error: the result is the same. */
  async remove(userId: string, kind: string, itemId: string): Promise<{ saved: false }> {
    if (!isSavedItemKind(kind)) throw new BadRequestException('Unknown kind');
    await this.prisma.savedItem.deleteMany({ where: { userId, kind, itemId } });
    return { saved: false };
  }
}
