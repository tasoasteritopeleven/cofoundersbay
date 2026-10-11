'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  List,
  Maximize2,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Link from 'next/link';
import { CfbGlyph, glyphForHref } from '@/components/icons/CfbGlyph';
import { cn } from '@/lib/utils';
import { getAgentGlyph } from '@/lib/ai-api';
import { useAIChat, type AIMessage } from '@/hooks/useAIChat';
import { usePageContext } from '@/hooks/usePageContext';
import { ActionCard } from '@/components/ai/ActionCard';
import { CopilotEmptyState } from '@/components/ai/CopilotEmptyState';
import { CitationChip } from '@/components/ai/CitationChip';
import { PageContextualHelp } from '@/components/common/PageContextualHelp';
import type { CopilotAction } from '@/lib/copilot-types';
import { getActionSpec } from '@/lib/action-registry';
import { SanitizedHtml } from '@/components/common/SanitizedHtml';
import { BilingualText } from '@/components/common/BilingualText';
import { useBilingualString } from '@/lib/i18n/LanguagePreferenceContext';
import { bilingualAria } from '@/lib/i18n/format';
import { COPILOT_PRODUCT_LINKS } from '@/lib/copilot-starters';

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function AssistantBody({
  message,
  pendingActionId,
  onConfirm,
  onDismiss,
  onUndo,
}: {
  message: AIMessage;
  pendingActionId: string | null;
  onConfirm: (action: CopilotAction) => void;
  onDismiss: (action: CopilotAction) => void;
  onUndo: (action: CopilotAction) => void;
}) {
  const html = useMemo(() => {
    const escaped = message.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br />');
  }, [message.content]);

  return (
    <div className="space-y-2">
      {message.isStreaming && !message.content ? (
        <div className="type-ui flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <BilingualText en="Working across your graph…" el="Εργασία στο γράφο σας…" compact />
        </div>
      ) : (
        <SanitizedHtml
          className="type-identity leading-relaxed text-foreground"
          html={html}
        />
      )}
      {message.citations && message.citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {message.citations.map((c) => (
            <CitationChip key={`${c.type}-${c.id}`} citation={c} />
          ))}
        </div>
      )}
      {message.actions && message.actions.length > 0 && (
        <div className="grid grid-cols-1 gap-2 pt-1">
          {message.actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              busyId={pendingActionId}
              onConfirm={onConfirm}
              onDismiss={onDismiss}
              onUndo={onUndo}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type CopilotWorkspaceProps = {
  variant?: 'page' | 'popup';
  initialPrompt?: string;
  onExpand?: () => void;
  /**
   * A question to send as soon as the assistant is ready - the header's Ask
   * AI bar hands its question here, so it is asked on the page it came from.
   * Sent once; `onAutoPromptSent` clears it at the source.
   */
  autoPrompt?: string | null;
  onAutoPromptSent?: () => void;
};

export function CopilotWorkspace({
  variant = 'page',
  initialPrompt,
  onExpand,
  autoPrompt,
  onAutoPromptSent,
}: CopilotWorkspaceProps) {
  const router = useRouter();
  const sayOne = useBilingualString();
  const isPage = variant === 'page';
  const pageContext = usePageContext();
  const [input, setInput] = useState(initialPrompt ?? '');
  const [threadsOpen, setThreadsOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chat = useAIChat({
    agentId: 'general',
    autoCreateConversation: true,
    enableCopilot: true,
    pageContext,
  });
  const agentList = chat.agents ?? [];
  const currentAgentConfig = agentList.find((a) => a.id === chat.currentAgent);

  useEffect(() => {
    if (chat.messages.length === 0) return;
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages, chat.isStreaming]);

  // Send a handed-over question once. Waits out a reply still streaming
  // rather than dropping the question.
  // `sentPrompt` makes it once even where effects run twice (development);
  // it resets when the prompt clears, so the same question can be asked again.
  const sentPrompt = useRef<string | null>(null);
  useEffect(() => {
    if (!autoPrompt) {
      sentPrompt.current = null;
      return;
    }
    if (chat.isStreaming || sentPrompt.current === autoPrompt) return;
    sentPrompt.current = autoPrompt;
    onAutoPromptSent?.();
    void chat.sendMessage(autoPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chat.sendMessage identity is not stable; the prompt is the trigger
  }, [autoPrompt, chat.isStreaming]);

  const handleConfirm = async (action: CopilotAction) => {
    const result = await chat.confirmAction(action);
    // Whether confirming takes you somewhere is declared with the action, not
    // listed here. This read the two tool ids that existed when it was written,
    // so any capability added afterwards returned an href this component threw
    // away. `shortlist_add` still returns `/shortlist` and still leaves you
    // where you are, because it declares `navigatesOnSuccess` false.
    if (result?.href && getActionSpec(action.tool)?.navigatesOnSuccess) {
      router.push(result.href);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chat.isStreaming) return;
    const value = input;
    setInput('');
    void chat.sendMessage(value);
  };

  return (
    <div className={cn('flex min-h-0 flex-1 overflow-hidden', isPage ? 'flex-col lg:flex-row' : 'flex-col')}>
      {isPage && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-1.5 lg:hidden">
          <button
            type="button"
            className="type-ui min-h-11 rounded-md px-2 text-left font-medium"
            aria-expanded={threadsOpen}
            onClick={() => setThreadsOpen((open) => !open)}
          >
            <BilingualText
              en={threadsOpen ? 'Hide threads' : 'Your threads'}
              el={threadsOpen ? 'Απόκρυψη νημάτων' : 'Τα νήματά σας'}
              compact
            />
          </button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="type-ui min-h-11 gap-1.5"
            onClick={() => {
              chat.clearMessages();
              setThreadsOpen(false);
              inputRef.current?.focus();
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            <BilingualText en="New question" el="Νέα ερώτηση" compact />
          </Button>
        </div>
      )}
      {isPage && (
        <aside className={cn(
          'w-full shrink-0 flex-col overflow-hidden border-b border-border bg-card/80 lg:flex lg:w-72 lg:max-h-none lg:border-b-0 lg:border-r',
          threadsOpen ? 'flex max-h-[38vh]' : 'hidden',
        )}>
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <p className="type-identity font-semibold">
              <BilingualText en="Threads" el="Νήματα" compact />
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="type-ui min-h-11 gap-1.5"
              onClick={() => {
                chat.clearMessages();
                inputRef.current?.focus();
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              <BilingualText en="New" el="Νέα" compact />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {chat.conversations.length === 0 ? (
              <div className="space-y-4 px-1 py-2">
                <p className="type-caption text-muted-foreground">
                  {sayOne(
                    'Send a question — it becomes a thread here.',
                    'Στείλτε μια ερώτηση — γίνεται νήμα εδώ.',
                  )}
                </p>
                <div>
                  <p className="type-caption mb-1.5 font-medium uppercase tracking-wide text-muted-foreground">
                    {sayOne('I can read', 'Μπορώ να διαβάσω')}
                  </p>
                  <ul className="flex flex-col">
                    {COPILOT_PRODUCT_LINKS.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="type-ui flex min-h-11 items-center gap-2 rounded-lg px-1.5 hover:bg-muted/70"
                        >
                          <CfbGlyph name={glyphForHref(link.href)} className="icon-sm shrink-0 text-muted-foreground" />
                          <BilingualText en={link.en} el={link.el} compact />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <ul className="space-y-1">
                {chat.conversations.map((conv) => (
                  <li key={conv.id}>
                    <button
                      type="button"
                      onClick={() => void chat.loadConversation(conv.id)}
                      className={cn(
                        'tap-target type-ui min-h-11 w-full rounded-lg px-2.5 py-2 text-left hover:bg-muted/70',
                        chat.conversationId === conv.id && 'bg-primary/10 text-primary-accessible',
                      )}
                    >
                      <span className="line-clamp-2">
                        {conv.title && conv.title !== 'New Conversation' && conv.title !== 'New conversation'
                          ? conv.title
                          : sayOne('New conversation', 'Νέα συνομιλία')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="border-t border-border p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="type-ui h-auto min-h-11 w-full justify-start gap-2 py-1.5 md:min-h-9"
              onClick={() => router.push('/ai/capabilities')}
            >
              <List className="h-4 w-4 shrink-0" />
              <BilingualText en="What I can do" el="Τι μπορώ να κάνω" stacked className="min-w-0 text-left" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              // h-auto + stacked: the inline "AI preferences · Προτιμήσεις AI"
              // did not fit the 288px rail and clipped to "AI preferen…".
              className="type-ui h-auto min-h-11 w-full justify-start gap-2 py-1.5 md:min-h-9"
              onClick={() => router.push('/settings/ai')}
            >
              <Settings className="h-4 w-4 shrink-0" />
              <BilingualText en="AI preferences" el="Προτιμήσεις AI" stacked className="min-w-0 text-left" />
            </Button>
          </div>
        </aside>
      )}

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className={cn(
          'flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2',
          !isPage && 'max-sm:flex-wrap',
        )}>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CfbGlyph name={getAgentGlyph(chat.currentAgent)} className="icon-sm" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              {isPage ? (
                <h1 className="type-identity truncate font-medium">
                  {currentAgentConfig?.name || 'CoFounderBay Assistant'}
                </h1>
              ) : (
                <p className="type-identity font-medium leading-snug sm:max-w-[9.5rem] sm:truncate">
                  {currentAgentConfig?.name || 'CoFounderBay Assistant'}
                </p>
              )}
              {isPage && (
              <p className="type-support truncate text-muted-foreground">
                {chat.isAIAvailable
                  ? sayOne('Live model · workspace tools', 'Ζωντανό μοντέλο · εργαλεία χώρου')
                  : sayOne('Built-in assistant · tools ready', 'Ενσωματωμένος βοηθός · εργαλεία έτοιμα')}
              </p>
              )}
            </div>
          </div>
          <div className={cn('flex items-center gap-1', !isPage && 'max-sm:basis-full')}>
            {isPage && <PageContextualHelp defaultOpen={false} compact />}
            {agentList.length > 1 && (
              <Select value={chat.currentAgent} onValueChange={(v) => chat.setAgent(v)}>
                <SelectTrigger
                  className="h-8 min-h-8 w-auto gap-1 px-2 type-ui"
                  aria-label={bilingualAria('AI agent', 'Πράκτορας AI')}
                >
                  {/* The heading beside this already names the current agent
                      in full; the trigger is the switch, so it says what it
                      does. Showing the name here cut "Βοηθός CoFounderBay" to
                      "Βοηθός…" in 144px, and the API's names run longer
                      ("Technical Strategy Advisor"). The list keeps them whole. */}
                  <SelectValue>{sayOne('Switch assistant', 'Αλλαγή βοηθού')}</SelectValue>
                </SelectTrigger>
                <SelectContent align="end">
                  {agentList.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id} className="type-ui">
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {chat.messages.length > 0 && (
              <>
                <button type="button" onClick={chat.retryLastMessage} className={cn('tap-target flex items-center justify-center rounded-xl hover:bg-muted', isPage ? 'h-11 w-11' : 'h-8 w-8')} title={bilingualAria('Retry', 'Επανάληψη')} aria-label={bilingualAria('Retry', 'Επανάληψη')}>
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button type="button" onClick={chat.clearMessages} className={cn('tap-target flex items-center justify-center rounded-xl hover:bg-muted', isPage ? 'h-11 w-11' : 'h-8 w-8')} title={bilingualAria('Clear', 'Καθαρισμός')} aria-label={bilingualAria('Clear', 'Καθαρισμός')}>
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </>
            )}
            {onExpand && (
                <button type="button" onClick={onExpand} className={cn('tap-target inline-flex items-center justify-center gap-1 rounded-xl px-2 hover:bg-muted', isPage ? 'h-11 w-11' : 'h-11 sm:h-8 sm:w-8 sm:px-0')} title={bilingualAria('Open full page', 'Άνοιγμα πλήρους σελίδας')} aria-label={bilingualAria('Open full page', 'Άνοιγμα πλήρους σελίδας')}>
                <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground sm:sr-only">
                  <BilingualText en="Full page" el="Πλήρης σελίδα" compact />
                </span>
              </button>
            )}
          </div>
        </div>

        <div
          className={cn(
            'flex-1 overflow-y-auto',
            chat.messages.length === 0
              ? 'flex flex-col p-3 sm:p-4 lg:px-6 lg:py-5'
              : 'space-y-3 p-3 sm:p-4 lg:px-6',
          )}
        >
          {chat.messages.length === 0 ? (
            <CopilotEmptyState
              surface={isPage ? 'page' : 'popup'}
              onAsk={(en) => void chat.sendMessage(en)}
              onOpenCapabilities={() => router.push('/ai/capabilities')}
            />
          ) : (
            chat.messages.map((msg) => (
              <div key={msg.id} className={cn('flex gap-2', msg.role === 'user' && 'justify-end')}>
                {msg.role === 'assistant' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <CfbGlyph name={getAgentGlyph(chat.currentAgent)} className="icon-sm" aria-hidden="true" />
                  </div>
                )}
                <div
                  className={cn(
                    'rounded-2xl px-3 py-2',
                    isPage ? 'max-w-[min(100%,48rem)]' : 'max-w-[min(100%,36rem)]',
                    msg.role === 'user'
                      ? 'rounded-tr-sm bg-primary text-primary-foreground'
                      : 'rounded-tl-sm bg-muted/70',
                  )}
                >
                  {msg.role === 'user' ? (
                    <p className="type-identity">{msg.content}</p>
                  ) : (
                    <AssistantBody
                      message={msg}
                      pendingActionId={chat.pendingActionId}
                      onConfirm={(a) => void handleConfirm(a)}
                      onDismiss={chat.dismissAction}
                      onUndo={(a) => void chat.undoAction(a)}
                    />
                  )}
                  <p className={cn('type-caption mt-1', msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        {chat.error && (
          <p className="type-caption px-3 text-destructive">{chat.error}</p>
        )}

        <form onSubmit={onSubmit} className="shrink-0 border-t border-border p-3">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              aria-label={sayOne('Ask AI', 'Ρωτήστε το AI')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={sayOne(
                isPage
                  ? 'Search, intro, message, or go…'
                  : 'Search, intro, or go…',
                isPage
                  ? 'Αναζήτηση, γνωριμία, μήνυμα ή μετάβαση…'
                  : 'Αναζήτηση, γνωριμία ή μετάβαση…',
              )}
              className="type-ui h-11 min-h-11 flex-1 rounded-full border-0 bg-muted/50 px-4 focus-visible:outline-none focus-visible:ring-0"
              disabled={chat.isStreaming}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || chat.isStreaming}
              className="h-11 w-11 rounded-full"
              aria-label={bilingualAria('Send', 'Αποστολή')}
            >
              {chat.isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          {!isPage && chat.messages.length > 0 ? (
            <p className="type-support mt-1.5 text-center text-muted-foreground">
              <button
                type="button"
                className="tap-target-y inline-flex items-center underline-offset-2 hover:underline"
                onClick={() => router.push('/ai/capabilities')}
              >
                <BilingualText
                  en="See everything I can read and change"
                  el="Δείτε όλα όσα μπορώ να διαβάσω και να αλλάξω"
                  compact
                  wrap
                />
              </button>
            </p>
          ) : isPage ? (
          <p className="type-support mt-1.5 text-muted-foreground">
            <BilingualText
              en="Changes wait for your confirmation."
              el="Οι αλλαγές γίνονται μόνο με την επιβεβαίωσή σας."
              compact wrap
            />
          </p>
          ) : null}
        </form>
      </section>
    </div>
  );
}
