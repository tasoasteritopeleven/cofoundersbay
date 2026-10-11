import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, Users, MessageSquare, Zap } from 'lucide-react';
import { useWorkspaceScoring } from '@/hooks/useGamification';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';

interface WorkspaceScoringWidgetProps {
  workspaceId: string;
}

export function WorkspaceScoringWidget({ workspaceId }: WorkspaceScoringWidgetProps) {
  const { readiness, momentum, myContribution, mentorMetrics, isLoading } = useWorkspaceScoring(workspaceId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="icon-md" />
            <BilingualText en="Workspace Scoring" el="Βαθμολογία χώρου εργασίας" compact />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="icon-md text-status-info" />
          <BilingualText en="Workspace Scoring" el="Βαθμολογία χώρου εργασίας" compact />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Readiness Score */}
        {readiness && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="icon-sm text-status-info" />
                <span className="font-medium"><BilingualText en="Readiness Score" el="Βαθμός ετοιμότητας" compact /></span>
              </div>
              <Badge variant={getScoreBadgeVariant(readiness.score)}>
                {readiness.score}/100
              </Badge>
            </div>
            <Progress value={readiness.score} className="h-2" />
            
            {/* Dimension breakdown */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <ScoreDimension label="Problem" score={readiness.problemClarity} />
              <ScoreDimension label="Solution" score={readiness.solutionClarity} />
              <ScoreDimension label="Market" score={readiness.marketUnderstanding} />
              <ScoreDimension label="Product" score={readiness.productDefinition} />
              <ScoreDimension label="Team" score={readiness.teamCompleteness} />
              <ScoreDimension label="Execution" score={readiness.executionReadiness} />
              <ScoreDimension label="Validation" score={readiness.validationScore} />
              <ScoreDimension label="Artifacts" score={readiness.artifactCompleteness} />
            </div>
          </div>
        )}

        {/* Team Momentum */}
        {momentum && (
          <div className="space-y-3 p-3 rounded-lg bg-status-success-bg border border-status-success-border ">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="icon-sm text-status-success" />
                <span className="font-medium text-sm"><BilingualText en="Team Momentum" el="Ορμή ομάδας" compact /></span>
              </div>
              <Badge variant="outline" className="gap-1">
                <Zap className="icon-sm" />
                {momentum.classification}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground"><BilingualText en="Score" el="Βαθμός" compact /></div>
                <div className="font-semibold text-lg">{momentum.score}</div>
              </div>
              <div>
                <div className="text-muted-foreground"><BilingualText en="Velocity" el="Ταχύτητα" compact /></div>
                <div className="font-semibold text-lg">{momentum.velocity.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-muted-foreground"><BilingualText en="Collab" el="Συνεργασία" compact /></div>
                <div className="font-semibold text-lg">{(momentum.collaborationDensity * 100).toFixed(0)}%</div>
              </div>
            </div>
          </div>
        )}

        {/* My Contribution */}
        {myContribution && (
          <div className="space-y-3 p-3 rounded-lg bg-status-accent-bg border border-status-accent-border ">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="icon-sm text-status-accent" />
                <span className="font-medium text-sm"><BilingualText en="My Contribution" el="Η συνεισφορά μου" compact /></span>
              </div>
              <Badge variant="outline">
                {myContribution.score}/100
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground"><BilingualText en="Created" el="Δημιουργήθηκε" compact /></div>
                <div className="font-semibold">{myContribution.breakdown.artifactsCreated}</div>
              </div>
              <div>
                <div className="text-muted-foreground"><BilingualText en="Improved" el="Βελτιώθηκε" compact /></div>
                <div className="font-semibold">{myContribution.breakdown.artifactsImproved}</div>
              </div>
              <div>
                <div className="text-muted-foreground"><BilingualText en="Feedback" el="Σχόλια" compact /></div>
                <div className="font-semibold">{myContribution.breakdown.feedbackGiven}</div>
              </div>
            </div>
          </div>
        )}

        {/* Mentor Metrics */}
        {mentorMetrics && mentorMetrics.feedbackCount > 0 && (
          <div className="space-y-2 p-3 rounded-lg bg-status-warning-bg border border-status-warning-border ">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="icon-sm text-status-warning" />
                <span className="font-medium text-sm"><BilingualText en="Mentor Loop" el="Κύκλος μέντορα" compact /></span>
              </div>
              <Badge variant="outline">
                {(mentorMetrics.appliedFeedbackRate * 100).toFixed(0)}% applied
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <div className="text-muted-foreground"><BilingualText en="Received" el="Ελήφθη" compact /></div>
                <div className="font-semibold">{mentorMetrics.feedbackCount}</div>
              </div>
              <div>
                <div className="text-muted-foreground"><BilingualText en="Applied" el="Εφαρμόστηκε" compact /></div>
                <div className="font-semibold">{mentorMetrics.appliedFeedbackCount}</div>
              </div>
              <div>
                <div className="text-muted-foreground"><BilingualText en="Pending" el="Σε αναμονή" compact /></div>
                <div className="font-semibold">{mentorMetrics.unresolvedFeedback}</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreDimension({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn(
        'font-medium',
        score >= 70 ? 'text-status-success' : score >= 40 ? 'text-status-warning' : 'text-status-danger'
      )}>
        {score}
      </span>
    </div>
  );
}

function getScoreBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (score >= 70) return 'default';
  if (score >= 40) return 'secondary';
  return 'destructive';
}
