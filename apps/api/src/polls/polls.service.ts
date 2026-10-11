import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PollOptionView = { id: string; label: string; votes: number };
export type PollView = {
  id: string;
  question: string;
  options: PollOptionView[];
  totalVotes: number;
  userVoted: string | null;
  isActive: boolean;
};

@Injectable()
export class PollsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivePoll(viewerUserId?: string | null): Promise<PollView | null> {
    const now = new Date();
    const poll = await this.prisma.poll.findFirst({
      where: {
        isActive: true,
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
        votes: viewerUserId
          ? { where: { userId: viewerUserId }, select: { optionId: true } }
          : false,
      },
    });

    if (!poll) return null;

    const voteCounts = await this.prisma.pollVote.groupBy({
      by: ['optionId'],
      where: { pollId: poll.id },
      _count: { _all: true },
    });
    const voteCountMap = new Map(voteCounts.map((item) => [item.optionId, item._count._all]));

    const options = poll.options.map((opt) => ({
      id: opt.id,
      label: opt.label,
      votes: voteCountMap.get(opt.id) ?? 0,
    }));

    const totalVotes = options.reduce((s, o) => s + o.votes, 0);

    return {
      id: poll.id,
      question: poll.question,
      options,
      totalVotes,
      userVoted: viewerUserId ? poll.votes[0]?.optionId ?? null : null,
      isActive: poll.isActive,
    };
  }

  async vote(pollId: string, optionId: string, userId: string): Promise<{ ok: true }> {
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: true },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    if (!poll.isActive) throw new ConflictException('Poll is closed');
    if (poll.endsAt && poll.endsAt < new Date())
      throw new ConflictException('Poll has ended');

    const option = poll.options.find((o) => o.id === optionId);
    if (!option) throw new NotFoundException('Option not found');

    await this.prisma.pollVote.upsert({
      where: { pollId_userId: { pollId, userId } },
      create: { pollId, optionId, userId },
      update: { optionId },
    });

    return { ok: true };
  }
}
