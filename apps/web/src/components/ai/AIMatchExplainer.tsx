'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Loader2, X, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { sendAIChat } from '@/lib/ai-api';
import { errorMessage } from '@/lib/utils';

interface MatchUser {
  id: string;
  displayName: string;
  skills?: string[];
  role?: string;
  headline?: string;
  lookingFor?: string;
}

interface AIMatchExplainerProps {
  currentUser: MatchUser;
  matchUser: MatchUser;
  matchScore?: number;
  className?: string;
}

export function AIMatchExplainer({
  currentUser,
  matchUser,
  matchScore,
  className,
}: AIMatchExplainerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchExplanation = useCallback(async () => {
    if (explanation) {
      setExplanation(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const prompt = `Explain why ${matchUser.displayName} would be a good co-founder match for me. Be specific about complementary skills and potential synergies. Keep it concise (3-4 sentences).`;

    const context = {
      currentUser: {
        name: currentUser.displayName,
        skills: currentUser.skills,
        role: currentUser.role,
        headline: currentUser.headline,
        lookingFor: currentUser.lookingFor,
      },
      matchUser: {
        name: matchUser.displayName,
        skills: matchUser.skills,
        role: matchUser.role,
        headline: matchUser.headline,
      },
      matchScore,
    };

    try {
      const result = await sendAIChat({
        message: prompt,
        agentId: 'matching',
        context,
      });
      setExplanation(result.message);
    } catch (err: unknown) {
      setError(errorMessage(err) || 'Failed to analyze match');
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, matchUser, matchScore, explanation]);

  return (
    <div className={cn('space-y-2', className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={fetchExplanation}
        disabled={isLoading}
        className="gap-1.5 text-status-accent hover:text-status-accent hover:bg-status-accent-bg "
      >
        {isLoading ? (
          <Loader2 className="icon-sm animate-spin" />
        ) : (
          <Sparkles className="icon-sm" />
        )}
        {explanation ? 'Hide Analysis' : 'Why this match?'}
      </Button>

      {error && (
        <div className="text-xs text-destructive-accessible bg-destructive/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {explanation && (
        <div className="relative rounded-xl border border-status-accent-border bg-status-accent-bg p-4 animate-in fade-in slide-in-from-top-2">
          <button aria-label="Dismiss explanation"
            onClick={() => setExplanation(null)}
            className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
          >
            <X className="icon-sm" />
          </button>
          
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Users className="icon-sm" />
            </div>
            <div className="flex-1 pr-4">
              <div className="text-xs font-medium text-status-accent mb-1">
                Match Analysis
              </div>
              <div className="text-sm leading-relaxed">
                {explanation.split('**').map((part, i) =>
                  i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
