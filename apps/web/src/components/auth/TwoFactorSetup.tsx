'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { setupTwoFactor, verifyTwoFactor, regenerateBackupCodes as apiRegenerateBackupCodes, TwoFactorSetupResponse } from '@/lib/api';
import { Shield, Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { BilingualText } from '@/components/common/BilingualText';

interface TwoFactorSetupProps {
  onEnabled?: () => void;
  onCancel?: () => void;
}

export function TwoFactorSetup({ onEnabled, onCancel }: TwoFactorSetupProps) {
  const { success, error: showError } = useToast();
  const [step, setStep] = useState<'initial' | 'qr' | 'verify' | 'backup'>('initial');
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function initiateSetup() {
    setIsLoading(true);
    try {
      const response = await setupTwoFactor();
      setSetupData(response);
      setStep('qr');
    } catch (err) {
      showError('Setup Failed', err instanceof Error ? err.message : 'Could not start 2FA setup');
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyAndEnable() {
    if (verificationCode.length !== 6) {
      showError('Invalid Code', 'Please enter a 6-digit verification code');
      return;
    }

    setIsLoading(true);
    try {
      await verifyTwoFactor(verificationCode);
      setStep('backup');
      success('2FA Enabled', 'Two-factor authentication has been enabled successfully');
      onEnabled?.();
    } catch (err) {
      showError('Verification Failed', err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  }

  async function copySecret() {
    if (setupData?.secret) {
      await navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      success('Copied', 'Secret key copied to clipboard');
    }
  }

  async function regenerateBackupCodes() {
    setIsLoading(true);
    try {
      const response = await apiRegenerateBackupCodes();
      setSetupData(prev => prev ? { ...prev, backupCodes: response.backupCodes } : null);
      success('Codes Regenerated', 'New backup codes have been generated');
    } catch (err) {
      showError('Failed', err instanceof Error ? err.message : 'Could not regenerate codes');
    } finally {
      setIsLoading(false);
    }
  }

  if (step === 'initial') {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg bg-status-warning-bg p-4 text-sm text-status-warning ">
          <AlertTriangle className="icon-md shrink-0" />
          <div>
            <p className="font-medium"><BilingualText en="Secure your account" el="Ασφαλίστε τον λογαριασμό σας" compact /></p>
            <p className="mt-1">
              Two-factor authentication adds an extra layer of security by requiring a code from your authenticator app
              in addition to your password.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              <BilingualText en="Cancel" el="Ακύρωση" compact />
            </Button>
          )}
          <Button onClick={initiateSetup} disabled={isLoading}>
            {isLoading ? 'Setting up...' : 'Set up 2FA'}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'qr') {
    return (
      <div className="space-y-6">
        <div className="flex justify-center">
          {setupData?.qrCodeUrl && (
            <div className="rounded-xl bg-white p-4 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupData.qrCodeUrl)}`}
                alt="2FA QR Code"
                width={200}
                height={200}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium"><BilingualText en="Can&apos;t scan the QR code?" el="Δεν σαρώνεται ο κωδικός QR;" compact wrap /></p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-secondary px-3 py-2 text-sm font-mono">
              {setupData?.secret}
            </code>
            <Button variant="outline" size="icon" onClick={copySecret} aria-label={copied ? 'Secret copied' : 'Copy secret to clipboard'}>
              {copied ? <Check className="icon-sm" /> : <Copy className="icon-sm" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <BilingualText en="Enter this secret manually in your authenticator app" el="Εισάγετε αυτό το μυστικό χειροκίνητα στην εφαρμογή ελέγχου ταυτότητας" wrap />
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="setup-verification-code" className="text-sm font-medium"><BilingualText en="Enter verification code" el="Εισάγετε κωδικό επαλήθευσης" compact /></label>
          <Input
            id="setup-verification-code"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
            className="text-center text-lg tracking-widest"
          />
          <p className="text-xs text-muted-foreground">
            <BilingualText en="Enter the 6-digit code from your authenticator app to verify setup" el="Εισάγετε τον 6ψήφιο κωδικό από την εφαρμογή για να επιβεβαιώσετε τη ρύθμιση" wrap />
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setStep('initial')} disabled={isLoading}>
            <BilingualText en="Back" el="Πίσω" compact />
          </Button>
          <Button onClick={verifyAndEnable} disabled={isLoading || verificationCode.length !== 6}>
            {isLoading ? 'Verifying...' : 'Verify & Enable'}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'backup') {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-lg bg-status-success-bg p-4 text-sm text-status-success ">
          <Shield className="icon-md shrink-0" />
          <div>
            <p className="font-medium">2FA Enabled Successfully</p>
            <p className="mt-1">
              <BilingualText en="Your account is now protected with two-factor authentication." el="Ο λογαριασμός σας προστατεύεται πλέον με έλεγχο δύο παραγόντων." wrap />
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium"><BilingualText en="Backup Codes" el="Εφεδρικοί κωδικοί" compact /></p>
            <Button
              variant="ghost"
              size="sm"
              onClick={regenerateBackupCodes}
              disabled={isLoading}
              className="gap-1"
            >
              <RefreshCw className="icon-sm" />
              <BilingualText en="Regenerate" el="Επαναδημιουργία" compact />
            </Button>
          </div>

          <div className="rounded-lg bg-secondary/50 p-4">
            <div className="grid grid-cols-2 gap-2">
              {setupData?.backupCodes?.map((code, i) => (
                <code
                  key={i}
                  className="rounded bg-background px-2 py-1.5 text-center text-sm font-mono"
                >
                  {code}
                </code>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-status-warning-bg p-3 text-xs text-status-warning ">
            <AlertTriangle className="icon-sm shrink-0" />
            <p>
              Save these backup codes in a secure location. They can be used to access your account
              if you lose access to your authenticator app. Each code can only be used once.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onCancel}><BilingualText en="Done" el="Τέλος" compact /></Button>
        </div>
      </div>
    );
  }

  return null;
}
