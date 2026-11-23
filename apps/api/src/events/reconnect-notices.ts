import type { Prisma } from '@prisma/client';

export function reconnectPairKey(a: string, b: string) {
  return [a, b].sort().join(':');
}

export function matchNotice(a: string, b: string, eventId?: string): Prisma.NotificationWhereInput {
  return {
    type: 'system',
    ...(eventId === undefined ? {} : { link: `/events/${eventId}#reconnect` }),
    meta: { path: ['reconnectPair'], equals: reconnectPairKey(a, b) },
  };
}
