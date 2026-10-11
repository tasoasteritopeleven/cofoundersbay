'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, X, Image as ImageIcon, File } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface MessageComposerProps {
  onSend: (content: string, attachments?: File[]) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MessageComposer({
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
  className,
}: MessageComposerProps) {
  const { error: toastError } = useToast();
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);

  const handleSend = async () => {
    if (!content.trim() && attachments.length === 0) return;
    if (sending || disabled) return;

    setSending(true);
    try {
      await onSend(content, attachments.length > 0 ? attachments : undefined);
      setContent('');
      setAttachments([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toastError(`${file.name} is too large. Max size is 10MB.`);
        return false;
      }
      return true;
    });
    
    setAttachments((prev) => [...prev, ...validFiles].slice(0, 5));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const insertEmoji = (emoji: string) => {
    setContent((prev) => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const commonEmojis = ['👍', '❤️', '😊', '🎉', '🚀', '💡', '🔥', '✨', '👏', '🙌'];

  return (
    <div className={cn('border-t bg-background', className)}>
      {attachments.length > 0 && (
        <div className="p-3 border-b">
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg text-sm"
              >
                {file.type.startsWith('image/') ? (
                  <ImageIcon className="icon-sm text-muted-foreground" />
                ) : (
                  <File className="icon-sm text-muted-foreground" />
                )}
                <span className="max-w-[150px] truncate">{file.name}</span>
                <button aria-label="Remove attachment"
                  onClick={() => removeAttachment(index)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="icon-sm" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showEmojiPicker && (
        <div className="p-3 border-b">
          <div className="flex flex-wrap gap-2">
            {commonEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => insertEmoji(emoji)}
                className="text-2xl hover:bg-secondary rounded-md p-1 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || sending}
              className="min-h-[44px] max-h-[200px] resize-none pr-20"
              rows={1}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <Button aria-label="Attach file"
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || sending || attachments.length >= 5}
              >
                <Paperclip className="icon-sm" />
              </Button>
              <Button aria-label="Insert emoji"
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={disabled || sending}
              >
                <Smile className="icon-sm" />
              </Button>
            </div>
          </div>

          <Button
            onClick={handleSend}
            disabled={(!content.trim() && attachments.length === 0) || disabled || sending}
            className="h-11 px-4"
          >
            {sending ? (
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Send className="icon-sm mr-2" />
                Send
              </>
            )}
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />

        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line • Max 5 files, 10MB each
        </p>
      </div>
    </div>
  );
}
