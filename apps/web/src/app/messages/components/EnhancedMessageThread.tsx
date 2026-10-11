'use client';

import { UnavailableMenuItem } from '@/components/common/UnavailableMenuItem';
import { ReportBlockModal } from '@/components/common/ReportBlockModal';
import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  Send, 
  Paperclip, 
  Image as ImageIcon, 
  Smile, 
  MoreVertical,
  Search,
  Phone,
  Video,
  Info,
  Archive,
  Trash2,
  Flag,
  Download,
  Reply,
  Forward,
  Copy,
  Check,
  CheckCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { bilingualInline } from '@/lib/i18n/format';

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt?: string;
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  replyTo?: {
    id: string;
    content: string;
    senderName: string;
  };
}

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  online?: boolean;
  lastSeen?: string;
}

interface EnhancedMessageThreadProps {
  conversationId: string;
  messages: Message[];
  participants: Participant[];
  currentUserId: string;
  onSendMessage: (content: string, attachments?: File[], replyToId?: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  onArchiveConversation?: () => void;
  onStartCall?: (type: 'audio' | 'video') => void;
}

export function EnhancedMessageThread({
  conversationId,
  messages,
  participants,
  currentUserId,
  onSendMessage,
  onDeleteMessage,
  onArchiveConversation,
  onStartCall,
}: EnhancedMessageThreadProps) {
  const [messageText, setMessageText] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const otherParticipant = participants.find(p => p.id !== currentUserId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!messageText.trim() && attachments.length === 0) return;
    
    onSendMessage(messageText, attachments, replyingTo?.id);
    setMessageText('');
    setAttachments([]);
    setReplyingTo(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredMessages = searchQuery
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={otherParticipant?.avatar} />
            <AvatarFallback>{otherParticipant?.name?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{otherParticipant?.name}</h3>
            <p className="text-sm text-muted-foreground">
              {otherParticipant?.online ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-status-success-mark rounded-full" />
                  Active now
                </span>
              ) : (
                `Last seen ${otherParticipant?.lastSeen || 'recently'}`
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button aria-label="Search"
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="icon-md" aria-hidden="true" />
          </Button>
          <Button aria-label="Call"
            variant="ghost"
            size="icon"
            onClick={() => onStartCall?.('audio')}
          >
            <Phone className="icon-md" aria-hidden="true" />
          </Button>
          <Button aria-label="Start video call"
            variant="ghost"
            size="icon"
            onClick={() => onStartCall?.('video')}
          >
            <Video className="icon-md" aria-hidden="true" />
          </Button>
          <Button aria-label="More information"
            variant="ghost"
            size="icon"
            onClick={() => setShowInfo(!showInfo)}
          >
            <Info className="icon-md" aria-hidden="true" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="More options" variant="ghost" size="icon">
                <MoreVertical className="icon-md" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onArchiveConversation}>
                <Archive className="icon-sm mr-2" aria-hidden="true" />
                Archive conversation
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!otherParticipant} onSelect={() => setReporting(true)}>
                <Flag className="icon-sm mr-2" aria-hidden="true" />
                Report
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <UnavailableMenuItem
                className="text-destructive-accessible"
                icon={<Trash2 className="icon-sm mr-2 mt-0.5" aria-hidden="true" />}
                en="Delete conversation"
                el="Διαγραφή συνομιλίας"
                reasonEn="Conversations can be archived, not deleted."
                reasonEl="Οι συνομιλίες αρχειοθετούνται, δεν διαγράφονται."
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="px-6 py-3 border-b bg-muted/50">
          <Input
            placeholder={bilingualInline("Search in conversation…", "Αναζήτηση στη συνομιλία…")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-background"
          />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {filteredMessages.map((message, index) => {
          const isOwn = message.senderId === currentUserId;
          const showAvatar = index === 0 || 
            filteredMessages[index - 1].senderId !== message.senderId;
          const showTimestamp = index === filteredMessages.length - 1 ||
            filteredMessages[index + 1].senderId !== message.senderId;

          return (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                isOwn ? "flex-row-reverse" : "flex-row"
              )}
            >
              {showAvatar ? (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={participants.find(p => p.id === message.senderId)?.avatar} />
                  <AvatarFallback>
                    {participants.find(p => p.id === message.senderId)?.name?.[0]}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="w-8" />
              )}

              <div className={cn("flex flex-col gap-1 max-w-[70%]", isOwn && "items-end")}>
                {message.replyTo && (
                  <div className={cn(
                    "text-xs px-3 py-2 rounded-lg bg-muted/50 border-l-2",
                    isOwn ? "border-primary" : "border-accent"
                  )}>
                    <p className="font-medium">{message.replyTo.senderName}</p>
                    <p className="text-muted-foreground truncate">
                      {message.replyTo.content}
                    </p>
                  </div>
                )}

                <div
                  className={cn(
                    "group relative px-4 py-2 rounded-2xl",
                    isOwn
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted",
                    selectedMessage === message.id && "ring-2 ring-primary"
                  )}
                  onClick={() => setSelectedMessage(message.id)}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {message.content}
                  </p>

                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {message.attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg",
                            isOwn ? "bg-primary-foreground/10" : "bg-background"
                          )}
                        >
                          {attachment.type.startsWith('image/') ? (
                            <img
                              src={attachment.url}
                              alt={attachment.name}
                              className="max-w-full rounded-lg"
                            />
                          ) : (
                            <>
                              <Paperclip className="icon-sm" aria-hidden="true" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {attachment.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatFileSize(attachment.size)}
                                </p>
                              </div>
                              <Button aria-label={`Download ${attachment.name}`} size="icon" variant="ghost" className="h-8 w-8" asChild>
                                <a href={attachment.url} download={attachment.name}>
                                  <Download className="icon-sm" aria-hidden="true" />
                                </a>
                              </Button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message actions */}
                  <div className={cn(
                    "absolute top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex gap-1",
                    isOwn ? "left-0 -translate-x-full" : "right-0 translate-x-full"
                  )}>
                    <Button aria-label="Reply"
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      onClick={() => setReplyingTo(message)}
                    >
                      <Reply className="icon-sm" aria-hidden="true" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button aria-label="More options" size="icon" variant="secondary" className="h-7 w-7">
                          <MoreVertical className="icon-sm" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(message.content)}>
                          <Copy className="icon-sm mr-2" aria-hidden="true" />
                          Copy
                        </DropdownMenuItem>
                        <UnavailableMenuItem
                          icon={<Forward className="icon-sm mr-2 mt-0.5" aria-hidden="true" />}
                          en="Forward"
                          el="Προώθηση"
                          reasonEn="Forwarding messages is not supported yet."
                          reasonEl="Η προώθηση μηνυμάτων δεν υποστηρίζεται ακόμη."
                        />
                        {isOwn && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive-accessible"
                              onClick={() => onDeleteMessage?.(message.id)}
                            >
                              <Trash2 className="icon-sm mr-2" aria-hidden="true" />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {showTimestamp && (
                  <div className={cn(
                    "flex items-center gap-1 text-xs text-muted-foreground px-1",
                    isOwn && "flex-row-reverse"
                  )}>
                    <span>{format(new Date(message.createdAt), 'HH:mm')}</span>
                    {isOwn && (
                      message.readAt ? (
                        <CheckCheck className="icon-sm text-primary-accessible" />
                      ) : (
                        <Check className="icon-sm" aria-hidden="true" />
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply Preview */}
      {replyingTo && (
        <div className="px-6 py-2 border-t bg-muted/50 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">
              Replying to {participants.find(p => p.id === replyingTo.senderId)?.name}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {replyingTo.content}
            </p>
          </div>
          <Button aria-label="More options"
            variant="ghost"
            size="icon"
            onClick={() => setReplyingTo(null)}
          >
            <MoreVertical className="icon-sm rotate-45" />
          </Button>
        </div>
      )}

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="px-6 py-2 border-t bg-muted/50">
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-2 bg-background rounded-lg"
              >
                {file.type.startsWith('image/') ? (
                  <ImageIcon className="icon-sm" />
                ) : (
                  <Paperclip className="icon-sm" />
                )}
                <span className="text-sm truncate max-w-[150px]">
                  {file.name}
                </span>
                <Button aria-label="More options"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeAttachment(index)}
                >
                  <MoreVertical className="icon-sm rotate-45" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 border-t bg-card">
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button aria-label="Attach file"
            title="Attach file"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="icon-md" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Attach image" title="Attach image" onClick={() => fileInputRef.current?.click()}>
            <ImageIcon className="icon-md" />
          </Button>
          
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={bilingualInline("Type a message…", "Γράψτε ένα μήνυμα…")}
              className="w-full px-4 py-3 pr-12 rounded-2xl bg-muted resize-none focus:outline-none min-h-[48px] max-h-[200px]"
              rows={1}
            />
            <Button aria-label="Add emoji"
              disabled
              title="Emoji picker is not available here yet"
              variant="ghost"
              size="icon"
              className="absolute right-2 bottom-2"
            >
              <Smile className="icon-md" />
            </Button>
          </div>

          <Button aria-label="Send message"
            title="Send"
            onClick={handleSend}
            disabled={!messageText.trim() && attachments.length === 0}
            className="rounded-full h-12 w-12"
          >
            <Send className="icon-md" />
          </Button>
        </div>
      </div>
      {reporting && otherParticipant && (
        <ReportBlockModal
          open
          onOpenChange={setReporting}
          userId={otherParticipant.id}
          userName={otherParticipant.name}
          mode="report"
        />
      )}
    </div>
  );
}
