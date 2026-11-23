export function pendingConversation<T extends { id: string }>(
  requested: string | null | undefined,
  opened: string | null,
  conversations: readonly T[],
): T | undefined {
  if (!requested || requested === opened) return undefined;
  return conversations.find((conversation) => conversation.id === requested);
}
