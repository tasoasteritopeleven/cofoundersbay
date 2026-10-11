'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Flag, Ban, AlertTriangle, Shield, X, Check, Loader2,
  UserX, Mail, CreditCard, Eye, HelpCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { blockUser, createUserReport } from '@/lib/api';
import { cn } from '@/lib/utils';
import { qk } from '@/lib/query-keys';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';

type ReportReason = 
  | 'harassment'
  | 'spam'
  | 'fake_profile'
  | 'inappropriate_content'
  | 'scam'
  | 'privacy_violation'
  | 'other';

type ReportBlockModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  mode: 'report' | 'block' | 'both';
  onBlocked?: (userId: string) => void;
  /** Extra fields merged into the report's context (e.g. the surface it came from). */
  context?: Record<string, unknown>;
};

const REPORT_REASONS: { value: ReportReason; label: string; icon: React.ElementType; description: string }[] = [
  {
    value: 'harassment',
    label: 'Harassment or bullying',
    icon: UserX,
    description: 'Threatening, abusive, or intimidating behavior',
  },
  {
    value: 'spam',
    label: 'Spam or promotional content',
    icon: Mail,
    description: 'Unsolicited messages or advertisements',
  },
  {
    value: 'fake_profile',
    label: 'Fake or misleading profile',
    icon: Eye,
    description: 'Impersonation or false information',
  },
  {
    value: 'inappropriate_content',
    label: 'Inappropriate content',
    icon: AlertTriangle,
    description: 'Offensive, explicit, or harmful content',
  },
  {
    value: 'scam',
    label: 'Scam or fraud',
    icon: CreditCard,
    description: 'Attempting to deceive or defraud users',
  },
  {
    value: 'privacy_violation',
    label: 'Privacy violation',
    icon: Shield,
    description: 'Sharing private information without consent',
  },
  {
    value: 'other',
    label: 'Other',
    icon: HelpCircle,
    description: 'Something else not listed above',
  },
];

function mapReportReason(reason: ReportReason): 'spam' | 'harassment' | 'fake' | 'inappropriate' | 'other' {
  switch (reason) {
    case 'harassment':
      return 'harassment';
    case 'spam':
      return 'spam';
    case 'fake_profile':
      return 'fake';
    case 'inappropriate_content':
      return 'inappropriate';
    default:
      return 'other';
  }
}

async function submitReport(data: {
  userId: string;
  reason: ReportReason;
  details: string;
  blockUser: boolean;
  context?: Record<string, unknown>;
}): Promise<{ reportId: string }> {
  const reasonMeta = REPORT_REASONS.find((entry) => entry.value === data.reason);
  const report = await createUserReport({
    reportedId: data.userId,
    type: mapReportReason(data.reason),
    reason: data.details.trim()
      ? `${reasonMeta?.label ?? 'User report'}: ${data.details.trim()}`
      : reasonMeta?.description ?? 'User report submitted from conversation flow.',
    context: {
      source: 'messages',
      category: data.reason,
      details: data.details.trim() || null,
      alsoBlocked: data.blockUser,
      ...data.context,
    },
  });
  if (data.blockUser) {
    await blockUser(data.userId);
  }
  return { reportId: report.report.id };
}

export function ReportBlockModal({
  open,
  onOpenChange,
  userId,
  userName,
  mode,
  onBlocked,
  context,
}: ReportBlockModalProps) {
  const { success, error: showError } = useToast();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<'select' | 'report' | 'block' | 'confirm'>('select');
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);

  const reportMutation = useMutation({
    mutationFn: submitReport,
    onSuccess: () => {
      if (alsoBlock) {
        onBlocked?.(userId);
      }
      success(
        alsoBlock ? 'Report submitted and user blocked' : 'Report submitted',
        alsoBlock
          ? 'Our team will review the report, and this user can no longer contact you.'
          : 'Our team will review this report within 24 hours.',
      );
      // Every public profile view: /profiles/[id] keys by id, /p/[username] by handle.
      queryClient.invalidateQueries({ queryKey: qk('public-profile') });
      handleClose();
    },
    onError: (error) => {
      showError('Failed to submit report', error instanceof Error ? error.message : 'Please try again later.');
    },
  });

  const blockMutation = useMutation({
    mutationFn: blockUser,
    onSuccess: () => {
      onBlocked?.(userId);
      success('User blocked', `${userName} has been blocked. They can no longer contact you.`);
      // Every public profile view: /profiles/[id] keys by id, /p/[username] by handle.
      queryClient.invalidateQueries({ queryKey: qk('public-profile') });
      queryClient.invalidateQueries({ queryKey: qk('conversations') });
      handleClose();
    },
    onError: (error) => {
      showError('Failed to block user', error instanceof Error ? error.message : 'Please try again later.');
    },
  });

  const handleClose = () => {
    setStep('select');
    setSelectedReason(null);
    setDetails('');
    setAlsoBlock(false);
    onOpenChange(false);
  };

  const handleSubmitReport = () => {
    if (!selectedReason) return;
    
    reportMutation.mutate({
      userId,
      reason: selectedReason,
      details,
      blockUser: alsoBlock,
      context,
    });
  };

  const handleBlockUser = () => {
    blockMutation.mutate(userId);
  };

  const isLoading = reportMutation.isPending || blockMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'select' && mode === 'both' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="icon-md text-muted-foreground" />
                <BilingualText en="What would you like to do?" el="Τι θέλετε να κάνετε;" compact wrap />
              </DialogTitle>
              <DialogDescription>
                Choose an action for {userName}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3 py-4">
              <button
                onClick={() => setStep('report')}
                className="w-full flex items-start gap-3 rounded-lg border border-border p-4 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-status-warning-bg">
                  <Flag className="icon-md text-status-warning" />
                </div>
                <div>
                  <p className="font-medium text-foreground"><BilingualText en="Report user" el="Αναφορά χρήστη" compact /></p>
                  <p className="text-sm text-muted-foreground">
                    <BilingualText en="Report inappropriate behavior to our moderation team" el="Αναφέρετε ακατάλληλη συμπεριφορά στην ομάδα εποπτείας" wrap />
                  </p>
                </div>
              </button>
              
              <button
                onClick={() => setStep('block')}
                className="w-full flex items-start gap-3 rounded-lg border border-border p-4 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                  <Ban className="icon-md text-destructive-accessible" />
                </div>
                <div>
                  <p className="font-medium text-foreground"><BilingualText en="Block user" el="Αποκλεισμός χρήστη" compact /></p>
                  <p className="text-sm text-muted-foreground">
                    <BilingualText en="Prevent this user from contacting you" el="Να μη μπορεί να επικοινωνήσει μαζί σας" wrap />
                  </p>
                </div>
              </button>
            </div>
          </>
        )}

        {(step === 'report' || (step === 'select' && mode === 'report')) && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Flag className="icon-md text-status-warning" />
                Report {userName}
              </DialogTitle>
              <DialogDescription>
                <BilingualText en="Help us understand what happened" el="Βοηθήστε μας να καταλάβουμε τι συνέβη" compact wrap />
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <p id="ReportBlockModal-cap1-cap" className="text-sm font-medium mb-3 block">
                  <BilingualText en="Why are you reporting this user?" el="Γιατί αναφέρετε αυτόν τον χρήστη;" compact wrap />
                </p>
                <div role="group" aria-labelledby="ReportBlockModal-cap1-cap" className="space-y-2">
                  {REPORT_REASONS.map((reason) => (
                    <label
                      key={reason.value}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                        selectedReason === reason.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/30'
                      )}
                    >
                      <input
                        type="radio"
                        name="report-reason"
                        value={reason.value}
                        checked={selectedReason === reason.value}
                        onChange={() => setSelectedReason(reason.value)}
                        className="mt-1 h-4 w-4 text-primary-accessible border-border"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{reason.label}</p>
                        <p className="text-xs text-muted-foreground">{reason.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {selectedReason && (
                <div>
                  <Label htmlFor="details" className="text-sm font-medium mb-2 block">
                    <BilingualText en="Additional details (optional)" el="Επιπλέον λεπτομέρειες (προαιρετικά)" compact />
                  </Label>
                  <Textarea
                    id="details"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder={bilingualInline("Provide any additional context that might help us investigate…", "Δώστε ό,τι επιπλέον στοιχείο μπορεί να βοηθήσει τον έλεγχο…")}
                    rows={3}
                    maxLength={1000}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground mt-1 text-right">
                    {details.length}/1000
                  </p>
                </div>
              )}

              {selectedReason && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alsoBlock}
                    onChange={(e) => setAlsoBlock(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground"><BilingualText en="Also block this user" el="Αποκλεισμός και αυτού του χρήστη" compact /></span>
                </label>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {mode === 'both' && (
                <Button variant="ghost" onClick={() => setStep('select')} disabled={isLoading}>
                  <BilingualText en="Back" el="Πίσω" compact />
                </Button>
              )}
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                <BilingualText en="Cancel" el="Ακύρωση" compact />
              </Button>
              <Button
                onClick={handleSubmitReport}
                disabled={!selectedReason || isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <Loader2 className="icon-sm animate-spin" />
                ) : (
                  <Flag className="icon-sm" />
                )}
                Submit Report
              </Button>
            </div>
          </>
        )}

        {(step === 'block' || (step === 'select' && mode === 'block')) && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ban className="icon-md text-destructive-accessible" />
                Block {userName}?
              </DialogTitle>
              <DialogDescription>
                <BilingualText en="This action can be undone from your settings" el="Αυτή η ενέργεια αναιρείται από τις ρυθμίσεις σας" wrap />
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-sm text-foreground">When you block someone:</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <X className="icon-sm shrink-0 mt-0.5 text-destructive-accessible" />
                    <BilingualText en="They won't be able to message you" el="Δεν θα μπορεί να σας στείλει μήνυμα" wrap />
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="icon-sm shrink-0 mt-0.5 text-destructive-accessible" />
                    <BilingualText en="They won't see your profile" el="Δεν θα βλέπει το προφίλ σας" compact />
                  </li>
                  <li className="flex items-start gap-2">
                    <X className="icon-sm shrink-0 mt-0.5 text-destructive-accessible" />
                    <BilingualText en="They won't appear in your matches" el="Δεν θα εμφανίζεται στις αντιστοιχίσεις σας" wrap />
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="icon-sm shrink-0 mt-0.5 text-muted-foreground" />
                    <BilingualText en="They won't be notified that you blocked them" el="Δεν θα ειδοποιηθεί ότι τον αποκλείσατε" wrap />
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {mode === 'both' && (
                <Button variant="ghost" onClick={() => setStep('select')} disabled={isLoading}>
                  <BilingualText en="Back" el="Πίσω" compact />
                </Button>
              )}
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                <BilingualText en="Cancel" el="Ακύρωση" compact />
              </Button>
              <Button
                variant="destructive"
                onClick={handleBlockUser}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <Loader2 className="icon-sm animate-spin" />
                ) : (
                  <Ban className="icon-sm" />
                )}
                Block User
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
