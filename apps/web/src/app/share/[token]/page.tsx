'use client';

import { StatusText } from '@/components/common/StatusText';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText, Lock, AlertCircle, Eye, MessageSquare, Edit3,
  Loader2, ExternalLink, Calendar, User, Rocket, CheckCircle2,
} from 'lucide-react';
import { cn, errorStatus } from '@/lib/utils';
import { apiRequest } from '@/lib/api';
import { BilingualText } from '@/components/common/BilingualText';
import { bilingualInline } from '@/lib/i18n/format';
import { MainLandmark } from '@/components/layout/AppShell';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShareLinkValidation {
  requiresPassword: boolean;
  permissions: 'view' | 'comment' | 'suggest' | 'edit';
  label?: string;
  expiresAt?: string;
  documentId?: string;
  workspaceId?: string;
}

interface SharedDocument {
  id: string;
  title: string;
  type: string;
  description?: string;
  content: Record<string, unknown>;
  status: string;
  completionPercent: number;
  version: number;
  updatedAt: string;
  workspace?: {
    name: string;
    startupName?: string;
    stage?: string;
    industry?: string;
  };
  owner?: {
    displayName: string;
    avatarUrl?: string;
  };
}

// ── Permission badge ──────────────────────────────────────────────────────────

function PermissionBadge({ permission }: { permission: string }) {
  const meta = {
    view:    { label: 'View Only',  color: 'text-muted-foreground bg-muted border-border',    icon: Eye },
    comment: { label: 'Can Comment',color: 'text-status-info bg-status-info-bg border-status-info-border',   icon: MessageSquare },
    suggest: { label: 'Can Suggest',color: 'text-status-accent bg-status-accent-bg border-status-accent-border', icon: Edit3 },
    edit:    { label: 'Can Edit',   color: 'text-status-success bg-status-success-bg border-status-success-border', icon: Edit3 },
  }[permission] ?? { label: permission, color: 'bg-muted', icon: Eye };

  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn('text-xs flex items-center gap-1', meta.color)}>
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </Badge>
  );
}

// ── Document type label ───────────────────────────────────────────────────────

function docTypeLabel(type: string): string {
  const map: Record<string, string> = {
    idea_core: 'Idea Core', business_model_canvas: 'Business Model Canvas',
    market_analysis: 'Market Analysis', pitch_deck: 'Pitch Deck',
    mvp_plan: 'MVP Plan', financial_plan: 'Financial Plan',
    technical_architecture: 'Technical Architecture', prd: 'PRD & User Stories',
    swot_analysis: 'SWOT Analysis', lean_canvas: 'Lean Canvas',
    competitive_analysis: 'Competitive Analysis', go_to_market: 'Go-to-Market',
    fundraising_memo: 'Fundraising Memo', product_roadmap: 'Product Roadmap',
  };
  return map[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Content renderer ──────────────────────────────────────────────────────────

function DocumentContentView({ content, type }: { content: Record<string, unknown>; type: string }) {
  if (!content || Object.keys(content).length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="icon-xl mx-auto mb-2 opacity-30" />
        <p className="text-sm"><BilingualText en="No content available in this version." el="Δεν υπάρχει περιεχόμενο σε αυτή την έκδοση." wrap /></p>
      </div>
    );
  }

  const renderValue = (key: string, val: unknown): React.ReactNode => {
    if (val === null || val === undefined) return null;

    const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')
      .replace(/^\w/, c => c.toUpperCase());

    if (typeof val === 'string' && val.trim()) {
      return (
        <div key={key} className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-sm whitespace-pre-wrap">{val}</p>
        </div>
      );
    }
    if (typeof val === 'number') {
      return (
        <div key={key} className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-sm font-medium">{val.toLocaleString('en-GB')}</p>
        </div>
      );
    }
    if (Array.isArray(val) && val.length > 0) {
      return (
        <div key={key} className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
          <ul className="space-y-1">
            {val.slice(0, 10).map((item, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm">
                <span className="text-primary-accessible mt-1 shrink-0">•</span>
                {typeof item === 'string' ? item : JSON.stringify(item)}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    return null;
  };

  const entries = Object.entries(content).filter(([, v]) => v !== null && v !== undefined && v !== '');

  return (
    <div className="space-y-5">
      {entries.map(([k, v]) => renderValue(k, v))}
    </div>
  );
}

// ── Main Share Page ───────────────────────────────────────────────────────────

export default function SharePage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';

  const [step, setStep] = useState<'loading' | 'password' | 'loaded' | 'error'>('loading');
  const [linkInfo, setLinkInfo] = useState<ShareLinkValidation | null>(null);
  const [document, setDocument] = useState<SharedDocument | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);

  // Initial load — check the share token
  useEffect(() => {
    if (!token) return;
    validateToken();
  }, [token]);

  const validateToken = async (pwd?: string) => {
    try {
      const result = await apiRequest<{
        requiresPassword?: boolean;
        permissions: string;
        label?: string;
        expiresAt?: string;
        document?: SharedDocument;
        documentId?: string;
        workspaceId?: string;
      }>(`/api/collab/share/${token}${pwd ? `?password=${encodeURIComponent(pwd)}` : ''}`, {
        method: 'GET',
      });

      if (result.requiresPassword && !pwd) {
        setLinkInfo(result as any);
        setStep('password');
        return;
      }

      setLinkInfo(result as any);
      if (result.document) {
        setDocument(result.document);
        setStep('loaded');
      } else {
        setStep('error');
        setErrorMessage('Document content could not be loaded.');
      }
    } catch (err: unknown) {
      const status = errorStatus(err);
      if (status === 401 || status === 403) {
        setPasswordError('Incorrect password. Please try again.');
        setStep('password');
      } else if (status === 404) {
        setStep('error');
        setErrorMessage('This share link does not exist or has been revoked.');
      } else if (status === 410) {
        setStep('error');
        setErrorMessage('This share link has expired.');
      } else {
        setStep('error');
        setErrorMessage('Unable to load this shared document. The link may be invalid or expired.');
      }
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password.trim()) return;
    setSubmittingPassword(true);
    setPasswordError('');
    try {
      await validateToken(password.trim());
    } finally {
      setSubmittingPassword(false);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (step === 'loading') {
    return (
      <MainLandmark className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="icon-xl animate-spin mx-auto mb-3 text-primary-accessible" />
          <p className="text-sm text-muted-foreground"><BilingualText en="Loading shared document…" el="Φόρτωση κοινόχρηστου εγγράφου…" compact /></p>
        </div>
      </MainLandmark>
    );
  }

  // ── Password gate ────────────────────────────────────────────────────────────

  if (step === 'password') {
    return (
      <MainLandmark className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center pb-3">
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-primary/10 rounded-full">
                <Lock className="icon-lg text-muted-foreground" />
              </div>
            </div>
            <CardTitle><BilingualText en="Password Protected" el="Προστατεύεται με κωδικό" compact /></CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {linkInfo?.label
                ? `"${linkInfo.label}" is password protected.`
                : 'This document requires a password to view.'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="share-password"><BilingualText en="Password" el="Κωδικός" compact /></Label>
              <Input
                id="share-password"
                type="password"
                placeholder={bilingualInline("Enter password…", "Συμπληρώστε κωδικό…")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                className={cn(passwordError && 'border-destructive')}
              />
              {passwordError && (
                <p className="text-xs text-destructive-accessible">{passwordError}</p>
              )}
            </div>
            <Button
              className="w-full"
              onClick={handlePasswordSubmit}
              disabled={submittingPassword || !password.trim()}
            >
              {submittingPassword && <Loader2 className="icon-sm mr-2 animate-spin" />}
              View Document
            </Button>
          </CardContent>
        </Card>
      </MainLandmark>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────

  if (step === 'error') {
    return (
      <MainLandmark className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardContent className="py-8">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive-accessible" />
            <h1 className="font-semibold mb-2"><BilingualText en="Link Unavailable" el="Ο σύνδεσμος δεν είναι διαθέσιμος" compact /></h1>
            <p className="text-sm text-muted-foreground mb-4">{errorMessage}</p>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              <BilingualText en="Go to CoFounderBay" el="Μετάβαση στο CoFounderBay" compact />
            </Button>
          </CardContent>
        </Card>
      </MainLandmark>
    );
  }

  // ── Document view ────────────────────────────────────────────────────────────

  return (
    <MainLandmark className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <div className="bg-background border-b sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <Rocket className="icon-md text-muted-foreground shrink-0" />
              <span className="font-semibold text-sm hidden sm:block">CoFounderBay</span>
            </div>
            {document && (
              <>
                <span className="text-muted-foreground/40">/</span>
                <span className="text-sm truncate">{document.title}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {linkInfo && <PermissionBadge permission={linkInfo.permissions} />}
            {linkInfo?.expiresAt && (
              <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                <Calendar className="icon-sm" />
                Expires {new Date(linkInfo.expiresAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.href = '/'}
              className="text-xs"
            >
              <ExternalLink className="icon-sm mr-1.5" />
              <BilingualText en="Sign In" el="Σύνδεση" compact />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {document ? (
          <>
            {/* Document header */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">
                      {docTypeLabel(document.type)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn('text-xs capitalize', {
                        'text-status-success': document.status === 'approved',
                        'text-status-info': document.status === 'review',
                        'text-status-warning': document.status === 'in_progress',
                      })}
                    >
                      <StatusText value={document.status} />
                    </Badge>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-semibold">{document.title}</h1>
                  {document.description && (
                    <p className="text-muted-foreground mt-1">{document.description}</p>
                  )}
                </div>
              </div>

              {/* Workspace info */}
              {document.workspace && (
                <Card className="border-border">
                  <CardContent>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Rocket className="icon-sm text-muted-foreground" />
                        <span className="font-medium text-sm">
                          {document.workspace.startupName ?? document.workspace.name}
                        </span>
                      </div>
                      {document.workspace.stage && (
                        <Badge variant="secondary" className="text-xs capitalize">
                          {document.workspace.stage}
                        </Badge>
                      )}
                      {document.workspace.industry && (
                        <span className="text-xs text-muted-foreground capitalize">
                          {document.workspace.industry}
                        </span>
                      )}
                      {document.owner && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                          <User className="icon-sm" />
                          {document.owner.displayName}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Completion bar */}
              {document.completionPercent > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span><BilingualText en="Completion" el="Ολοκλήρωση" compact /></span>
                    <span>{document.completionPercent}%</span>
                  </div>
                  <Progress value={document.completionPercent} className="h-1.5" />
                </div>
              )}
            </div>

            {/* Document content */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="icon-sm" />
                    <BilingualText en="Document Content" el="Περιεχόμενο εγγράφου" compact />
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    v{document.version} · Updated {new Date(document.updatedAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <DocumentContentView content={document.content} type={document.type} />
              </CardContent>
            </Card>

            {/* View-only notice */}
            {linkInfo?.permissions === 'view' && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg p-3">
                <Eye className="icon-sm shrink-0" />
                <BilingualText en="You are viewing this document in read-only mode. To collaborate, request full access from the owner." el="Βλέπετε το έγγραφο μόνο για ανάγνωση. Για συνεργασία, ζητήστε πλήρη πρόσβαση από τον κάτοχο." wrap />
              </div>
            )}

            {/* CTA for authenticated actions */}
            {(linkInfo?.permissions === 'comment' || linkInfo?.permissions === 'suggest') && (
              <Card className="border-primary/15 bg-primary/5">
                <CardContent className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium"><BilingualText en="Want to leave feedback?" el="Θέλετε να αφήσετε σχόλιο;" compact wrap /></p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <BilingualText en="Sign in or create a free account to comment on this document." el="Συνδεθείτε ή δημιουργήστε δωρεάν λογαριασμό για να σχολιάσετε αυτό το έγγραφο." wrap />
                    </p>
                  </div>
                  <Button size="sm" onClick={() => window.location.href = '/login'}>
                    <BilingualText en="Sign In" el="Σύνδεση" compact />
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t mt-12 py-6 text-center text-xs text-muted-foreground">
        Shared via{' '}
        <a href="/" className="text-primary-accessible hover:underline font-medium">
          CoFounderBay
        </a>{' '}
        — Startup Builder Platform
      </footer>
    </MainLandmark>
  );
}
