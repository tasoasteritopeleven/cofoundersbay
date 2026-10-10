'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield, ShieldCheck, ShieldAlert, Download, FileText, Copy, Check,
  AlertTriangle, Info, Unlock, Hash,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import {
  updateConversationValidationMode,
  acceptConversationValidation,
  declineConversationValidation,
  exportConversationTranscript,
  type ConversationValidationMode as ApiValidationMode,
} from '@/lib/api';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualAria } from '@/lib/i18n/format';
import { messagesEn, messagesEl } from '@/lib/i18n/strings-messages';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';

export type ValidationMode = 'casual' | 'one_party' | 'two_party';

export type ConversationValidationState = {
  mode: ValidationMode;
  initiatedBy: string | null;
  initiatedAt: string | null;
  acceptedBy: string | null;
  acceptedAt: string | null;
  lastValidatedAt: string | null;
  validationHash: string | null;
  transcriptAvailable: boolean;
};

type ConversationValidationProps = {
  conversationId: string;
  currentUserId: string;
  otherUserId: string;
  otherUserName: string;
  validationState: ConversationValidationState;
  onModeChange?: (mode: ValidationMode) => void;
};

const MODE_CONFIG: Record<ValidationMode, {
  labelKey: 'val_casual' | 'val_one' | 'val_two';
  descKey: 'val_casual_desc' | 'val_one_desc' | 'val_two_desc';
  icon: React.ElementType;
  color: string;
  bgColor: string;
}> = {
  casual: {
    labelKey: 'val_casual',
    descKey: 'val_casual_desc',
    icon: Unlock,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  one_party: {
    labelKey: 'val_one',
    descKey: 'val_one_desc',
    icon: Shield,
    color: 'text-status-warning',
    bgColor: 'bg-status-warning-bg',
  },
  two_party: {
    labelKey: 'val_two',
    descKey: 'val_two_desc',
    icon: ShieldCheck,
    color: 'text-status-success',
    bgColor: 'bg-status-success-bg',
  },
};


function ValidationModeIndicator({ state }: { state: ConversationValidationState }) {
  const config = MODE_CONFIG[state.mode];
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-1.5 rounded-full px-2 py-0.5', config.bgColor)}>
      <Icon className={cn('icon-sm', config.color)} />
      <span className={cn('text-xs font-medium', config.color)}>
        <BilingualText en={messagesEn(config.labelKey)} el={messagesEl(config.labelKey)} compact />
      </span>
    </div>
  );
}

export function ConversationValidationBadge({
  state,
  compact = false,
}: {
  state: ConversationValidationState;
  compact?: boolean;
}) {
  const config = MODE_CONFIG[state.mode];
  const Icon = config.icon;

  if (compact) {
    return (
      <div
        className={cn('flex h-6 w-6 items-center justify-center rounded-full', config.bgColor)}
        title={messagesEn(config.labelKey)}
      >
        <Icon className={cn('icon-sm', config.color)} />
      </div>
    );
  }

  return <ValidationModeIndicator state={state} />;
}

export function ConversationValidationMenu({
  conversationId,
  currentUserId,
  otherUserId,
  otherUserName,
  validationState,
  onModeChange,
}: ConversationValidationProps) {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  const [showModeDialog, setShowModeDialog] = useState(false);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  const updateModeMutation = useMutation({
    mutationFn: (mode: ValidationMode) => updateConversationValidationMode(conversationId, mode as ApiValidationMode),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: qk('conversations') });
      onModeChange?.(data.validationState.mode);
      success('Validation mode updated', messagesEn(MODE_CONFIG[data.validationState.mode].labelKey));
      setShowModeDialog(false);
    },
    onError: () => {
      showError('Failed to update', 'Could not change validation mode');
    },
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptConversationValidation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('conversations') });
      success('Validation accepted', 'Two-party validation is now active');
      setShowAcceptDialog(false);
    },
    onError: () => {
      showError('Failed to accept', 'Could not accept validation request');
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => declineConversationValidation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk('conversations') });
      success('Validation declined', 'Conversation remains in casual mode');
      setShowAcceptDialog(false);
    },
    onError: () => {
      showError('Failed to decline', 'Could not decline validation request');
    },
  });

  const handleExport = async (format: 'json' | 'txt') => {
    try {
      const blob = await exportConversationTranscript(conversationId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${conversationId.slice(0, 8)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success('Transcript exported', `Downloaded as ${format.toUpperCase()}`);
    } catch {
      showError('Export failed', 'Could not download transcript');
    }
  };

  const copyHash = () => {
    if (validationState.validationHash) {
      navigator.clipboard.writeText(validationState.validationHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const config = MODE_CONFIG[validationState.mode];
  const Icon = config.icon;
  const isPendingAcceptance = 
    validationState.mode === 'two_party' && 
    validationState.initiatedBy && 
    validationState.initiatedBy !== currentUserId &&
    !validationState.acceptedBy;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl"
            title={bilingualAria(messagesEn(config.labelKey), messagesEl(config.labelKey))}
            aria-label={bilingualAria(messagesEn(config.labelKey), messagesEl(config.labelKey))}
          >
            <Icon className={cn('icon-sm', config.color)} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5">
            <p className="text-xs font-medium text-foreground"><BilingualText en="Conversation Validation" el="Επικύρωση συνομιλίας" compact /></p>
            <p className="text-xs text-muted-foreground">
              <BilingualText en={messagesEn(config.descKey)} el={messagesEl(config.descKey)} compact />
            </p>
          </div>
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={() => setShowModeDialog(true)}>
            <Shield className="mr-2 icon-sm" />
            <BilingualText en="Change validation mode" el="Αλλαγή λειτουργίας επικύρωσης" compact />
          </DropdownMenuItem>
          
          {validationState.transcriptAvailable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport('txt')}>
                <FileText className="mr-2 icon-sm" />
                <BilingualText en="Export as Text (.txt)" el="Εξαγωγή ως κείμενο (.txt)" compact />
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                <Download className="mr-2 icon-sm" />
                <BilingualText en="Export as JSON (.json)" el="Εξαγωγή ως JSON (.json)" compact />
              </DropdownMenuItem>
            </>
          )}
          
          {validationState.validationHash && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={copyHash}>
                {copied ? (
                  <Check className="mr-2 icon-sm text-status-success" />
                ) : (
                  <Hash className="mr-2 icon-sm" />
                )}
                {copied
                  ? <BilingualText en="Hash copied!" el="Το hash αντιγράφηκε!" compact />
                  : <BilingualText en="Copy validation hash" el="Αντιγραφή hash επικύρωσης" compact />}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Pending acceptance banner */}
      {isPendingAcceptance && (
        <div className="mx-4 mb-2 rounded-lg border border-status-warning-border bg-status-warning-bg p-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="icon-md shrink-0 text-status-warning mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                <BilingualText
                  en={`${otherUserName} requested two-party validation`}
                  el={`${otherUserName}: αίτημα για επικύρωση δύο μερών`}
                  wrap
                />
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                <BilingualText en="Both parties will be able to save and verify the conversation transcript" el="Και τα δύο μέρη θα μπορούν να αποθηκεύσουν και να επαληθεύσουν το αντίγραφο της συνομιλίας" wrap />
              </p>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => acceptMutation.mutate()}
                  disabled={acceptMutation.isPending}
                >
                  {acceptMutation.isPending ? (
                    <Loader2 className="icon-sm animate-spin mr-1" />
                  ) : (
                    <Check className="icon-sm mr-1" />
                  )}
                  <BilingualText en="Accept" el="Αποδοχή" compact />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => declineMutation.mutate()}
                  disabled={declineMutation.isPending}
                >
                  <BilingualText en="Decline" el="Απόρριψη" compact />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode selection dialog */}
      <Dialog open={showModeDialog} onOpenChange={setShowModeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="icon-md text-muted-foreground" />
              <BilingualText en="Conversation Validation Mode" el="Λειτουργία επικύρωσης συνομιλίας" compact />
            </DialogTitle>
            <DialogDescription>
              <BilingualText en="Choose how this conversation should be validated" el="Επιλέξτε πώς θα επικυρώνεται η συνομιλία" wrap />
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {(Object.entries(MODE_CONFIG) as [ValidationMode, typeof MODE_CONFIG[ValidationMode]][]).map(
              ([mode, modeConfig]) => {
                const ModeIcon = modeConfig.icon;
                const isActive = validationState.mode === mode;

                return (
                  <button
                    key={mode}
                    onClick={() => updateModeMutation.mutate(mode)}
                    disabled={updateModeMutation.isPending}
                    className={cn(
                      'w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
                      isActive
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', modeConfig.bgColor)}>
                      <ModeIcon className={cn('icon-md', modeConfig.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">
                          <BilingualText en={messagesEn(modeConfig.labelKey)} el={messagesEl(modeConfig.labelKey)} compact />
                        </p>
                        {isActive && (
                          <Badge variant="secondary" className="text-xs"><BilingualText en="Current" el="Τρέχουσα" compact /></Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        <BilingualText en={messagesEn(modeConfig.descKey)} el={messagesEl(modeConfig.descKey)} />
                      </p>
                      {mode === 'two_party' && (
                        <p className="text-xs text-status-warning mt-1 flex items-center gap-1">
                          <AlertTriangle className="icon-sm" />
                          <BilingualText
                            en={`Requires acceptance from ${otherUserName}`}
                            el={`Χρειάζεται την αποδοχή του χρήστη ${otherUserName}`}
                            compact
                            wrap
                          />
                        </p>
                      )}
                    </div>
                  </button>
                );
              }
            )}
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <Info className="icon-sm shrink-0 text-muted-foreground mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <p className="font-medium text-foreground mb-1"><BilingualText en="About validation modes" el="Σχετικά με τις λειτουργίες επικύρωσης" compact /></p>
                <ul className="space-y-1">
                  <li><strong>Casual:</strong> <BilingualText en="Standard messaging, no records saved" el="Απλά μηνύματα, χωρίς αποθήκευση αρχείου" wrap /></li>
                  <li><strong>One-Party:</strong> <BilingualText en="You can save transcripts; other party is notified" el="Μπορείτε να αποθηκεύετε αντίγραφα· ο άλλος ειδοποιείται" wrap /></li>
                  <li><strong>Two-Party:</strong> <BilingualText en="Both agree to validated, verifiable transcript" el="Και οι δύο συμφωνούν σε επικυρωμένο, επαληθεύσιμο αντίγραφο" wrap /></li>
                </ul>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function TranscriptExportButton({
  conversationId,
  validationState,
}: {
  conversationId: string;
  validationState: ConversationValidationState;
}) {
  const { success, error: showError } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (format: 'json' | 'txt') => {
    setIsExporting(true);
    try {
      const blob = await exportConversationTranscript(conversationId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcript-${conversationId.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      success('Transcript exported', `Downloaded as ${format.toUpperCase()}`);
    } catch {
      showError('Export failed', 'Could not download transcript');
    } finally {
      setIsExporting(false);
    }
  };

  if (validationState.mode === 'casual') {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="icon-sm animate-spin" />
          ) : (
            <Download className="icon-sm" />
          )}
          Save Transcript
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('txt')}>
          <FileText className="mr-2 icon-sm" />
          <BilingualText en="Plain Text (.txt)" el="Απλό κείμενο (.txt)" compact />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('json')}>
          <Download className="mr-2 icon-sm" />
          <BilingualText en="JSON (.json)" el="JSON (.json)" compact />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ValidationHashDisplay({ hash }: { hash: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!hash) return null;

  const copyHash = () => {
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <Hash className="icon-sm text-muted-foreground shrink-0" />
      <code className="flex-1 text-xs font-mono text-muted-foreground truncate">
        {hash}
      </code>
      <Button aria-label="Confirm"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={copyHash}
      >
        {copied ? (
          <Check className="icon-sm text-status-success" />
        ) : (
          <Copy className="icon-sm" />
        )}
      </Button>
    </div>
  );
}
