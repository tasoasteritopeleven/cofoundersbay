'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCheck, MoreVertical, Reply, Trash2, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { MessageComposer } from './MessageComposer';
import { qk } from '@/lib/query-keys';
import { useLanguagePreference } from '@/lib/i18n/LanguagePreferenceContext';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  createdAt: string;
  readAt?: string;
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
}

interface MessageThreadProps {
  conversationId: string;
  currentUserId: string;
}

export function MessageThread({ conversationId, currentUserId }: MessageThreadProps) {
  const { primary } = useLanguagePreference();
  // Message times in the reader's language and zone (fetched after mount, never server-rendered).
  const timeLocale = primary === 'el' ? 'el-GR' : 'en-GB';
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: qk('messages', conversationId),
    queryFn: async () => {
      const response = await fetch(`/api/v1/messages/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      const data = await response.json();
      return data.messages || [];
    },
    refetchInterval: 3000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, attachments }: { content: string; attachments?: File[] }) => {
      const formData = new FormData();
      formData.append('content', content);
      if (replyingTo) {
        formData.append('replyToId', replyingTo.id);
      }
      
      if (attachments) {
        attachments.forEach((file) => {
          formData.append('attachments', file);
        });
      }

      const response = await fetch(`/api/v1/messages/${conversationId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('messages', conversationId) });
      queryClient.invalidateQueries({ queryKey: qk('conversations') });
      setReplyingTo(null);
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const response = await fetch(`/api/v1/messages/${conversationId}/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to delete message');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('messages', conversationId) });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (content: string, attachments?: File[]) => {
    await sendMessageMutation.mutateAsync({ content, attachments });
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString(timeLocale, { hour: 'numeric', minute: '2-digit' });
    } else if (diffInHours < 168) {
      return date.toLocaleDateString(timeLocale, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    } else {
      return date.toLocaleDateString(timeLocale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn('flex gap-3', i % 2 === 0 ? 'justify-end' : '')}>
              <div className={cn('max-w-[70%] space-y-2', i % 2 === 0 ? 'items-end' : '')}>
                <div className="h-16 bg-secondary/40 rounded-2xl animate-pulse w-64"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message: Message, index: number) => {
          const isOwn = message.senderId === currentUserId;
          const showAvatar = index === 0 || messages[index - 1].senderId !== message.senderId;

          return (
            <div
              key={message.id}
              className={cn('flex gap-3 group', isOwn && 'justify-end')}
            >
              {!isOwn && (
                <div className="flex-shrink-0">
                  {showAvatar ? (
                    <img
                      src={message.senderAvatar || '/default-avatar.png'}
                      alt={message.senderName}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8"></div>
                  )}
                </div>
              )}

              <div className={cn('max-w-[70%] space-y-1', isOwn && 'items-end')}>
                {showAvatar && !isOwn && (
                  <div className="text-xs font-medium text-muted-foreground px-3">
                    {message.senderName}
                  </div>
                )}

                <div className="relative group/message">
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2 break-words',
                      isOwn
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {message.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 rounded-lg bg-black/10 hover:bg-black/20 transition-colors"
                          >
                            <div className="text-xs truncate">{attachment.name}</div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/message:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-label="Message actions" variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreVertical className="icon-sm" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setReplyingTo(message)}>
                          <Reply className="icon-sm mr-2" />
                          Reply
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyMessage(message.content)}>
                          <Copy className="icon-sm mr-2" />
                          Copy
                        </DropdownMenuItem>
                        {isOwn && (
                          <DropdownMenuItem
                            onClick={() => deleteMessageMutation.mutate(message.id)}
                            className="text-destructive-accessible"
                          >
                            <Trash2 className="icon-sm mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className={cn('flex items-center gap-1 px-3 text-xs text-muted-foreground', isOwn && 'justify-end')}>
                  <span>{formatTime(message.createdAt)}</span>
                  {isOwn && (
                    <>
                      {message.readAt ? (
                        <CheckCheck className="icon-sm text-status-info" />
                      ) : (
                        <Check className="icon-sm" />
                      )}
                    </>
                  )}
                </div>
              </div>

              {isOwn && <div className="flex-shrink-0 h-8 w-8"></div>}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {replyingTo && (
        <div className="px-4 py-2 bg-secondary/40 border-t flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Reply className="icon-sm text-muted-foreground" />
            <div className="text-sm">
              <span className="text-muted-foreground">Replying to </span>
              <span className="font-medium">{replyingTo.senderName}</span>
            </div>
          </div>
          <Button aria-label="Cancel reply"
            variant="ghost"
            size="sm"
            onClick={() => setReplyingTo(null)}
            className="h-6 w-6 p-0"
          >
            <X className="icon-sm" />
          </Button>
        </div>
      )}

      <MessageComposer onSend={handleSend} />
    </div>
  );
}
