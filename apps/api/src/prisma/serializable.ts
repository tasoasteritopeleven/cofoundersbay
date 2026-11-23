import { Prisma } from '@prisma/client';
import type { PrismaService } from './prisma.service';

export async function serializable<T>(prisma: PrismaService, write: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(write, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !['P2034', 'P2002'].includes(error.code) || attempt >= 2) throw error;
    }
  }
}
