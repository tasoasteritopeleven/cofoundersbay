'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { STATUS } from '@/lib/semantic-colors';

type ProfileField = {
  id: string;
  label: string;
  completed: boolean;
  weight: number; // contribution to overall score
  href?: string;
};

type ProfileCompletionProps = {
  fields: ProfileField[];
  className?: string;
  compact?: boolean;
};

export function ProfileCompletionRing({ 
  percentage, 
  size = 'md',
  showLabel = true,
}: { 
  percentage: number; 
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}) {
  const sizeConfig = {
    sm: { container: 'h-16 w-16', radius: 28, stroke: 2, text: 'text-sm' },
    md: { container: 'h-24 w-24', radius: 42, stroke: 6, text: 'text-lg' },
    lg: { container: 'h-32 w-32', radius: 56, stroke: 8, text: 'text-2xl' },
  };

  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const textColorClass =
    percentage >= 80 ? STATUS.success.text :
    percentage >= 50 ? STATUS.warning.text :
    STATUS.danger.text;

  return (
    <div className={cn('relative flex items-center justify-center', config.container)}>
      <svg className="absolute transform -rotate-90" width="100%" height="100%" viewBox="0 0 128 128">
        {/* Background circle */}
        <circle
          cx="64"
          cy="64"
          r={config.radius}
          fill="none"
          strokeWidth={config.stroke}
          stroke="hsl(var(--ring-gold-track))"
        />
        {/* Progress circle */}
        <circle
          cx="64"
          cy="64"
          r={config.radius}
          fill="none"
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          stroke="hsl(var(--ring-gold))"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {showLabel && (
        <div className="relative text-center">
          <span className={cn('font-bold', config.text, textColorClass)}>
            {percentage}%
          </span>
        </div>
      )}
    </div>
  );
}

export function ProfileCompletionCard({ fields, className, compact = false }: ProfileCompletionProps) {
  const { completedCount, totalWeight, completedWeight, percentage, incompleteFields } = useMemo(() => {
    const completed = fields.filter((f) => f.completed);
    const totalW = fields.reduce((sum, f) => sum + f.weight, 0);
    const completedW = completed.reduce((sum, f) => sum + f.weight, 0);
    const pct = Math.round((completedW / totalW) * 100);
    const incomplete = fields.filter((f) => !f.completed);
    return {
      completedCount: completed.length,
      totalWeight: totalW,
      completedWeight: completedW,
      percentage: pct,
      incompleteFields: incomplete,
    };
  }, [fields]);

  const nextStep = incompleteFields[0];

  if (compact) {
    return (
      <div className={cn('flex items-center gap-4', className)}>
        <ProfileCompletionRing percentage={percentage} size="sm" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Profile {percentage}% complete</p>
          {nextStep && (
            <p className="text-xs text-muted-foreground">
              Next: {nextStep.label}
            </p>
          )}
        </div>
        {nextStep?.href && (
          <Button size="sm" variant="secondary" asChild>
            <Link href={nextStep.href}>
              Complete
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="icon-sm text-muted-foreground" />
            Profile Strength
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{fields.length} completed
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress ring */}
        <div className="flex justify-center">
          <ProfileCompletionRing percentage={percentage} size="lg" />
        </div>

        {/* Status message */}
        <div className="text-center">
          {percentage >= 80 ? (
            <p className={cn('text-sm font-medium', STATUS.success.text)}>
              Great job! Your profile is looking strong.
            </p>
          ) : percentage >= 50 ? (
            <p className={cn('text-sm font-medium', STATUS.warning.text)}>
              Good progress! Complete a few more fields to stand out.
            </p>
          ) : (
            <p className={cn('text-sm font-medium', STATUS.danger.text)}>
              Complete your profile to get better matches.
            </p>
          )}
        </div>

        {/* Checklist */}
        <div className="space-y-2">
          {fields.map((field) => (
            <div
              key={field.id}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                field.completed ? STATUS.success.bg : 'bg-secondary/40'
              )}
            >
              {field.completed ? (
                <CheckCircle2 className={cn('icon-md flex-shrink-0', STATUS.success.icon)} />
              ) : (
                <Circle className="icon-md text-muted-foreground flex-shrink-0" />
              )}
              <span
                className={cn(
                  'flex-1 text-sm',
                  field.completed ? 'text-muted-foreground' : 'text-foreground'
                )}
              >
                {field.label}
              </span>
              {!field.completed && field.href && (
                <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
                  <Link href={field.href}>
                    <ArrowRight className="icon-sm" />
                  </Link>
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* CTA for next step */}
        {nextStep?.href && (
          <Button className="w-full gap-2" asChild>
            <Link href={nextStep.href} className="block">
              Complete "{nextStep.label}"
              <ArrowRight className="icon-sm" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// Helper to calculate profile fields from profile data
export function calculateProfileCompletion(profile: Record<string, unknown> | null): ProfileField[] {
  if (!profile) {
    return [
      { id: 'basic', label: 'Basic info', completed: false, weight: 20, href: '/onboarding' },
      { id: 'skills', label: 'Skills', completed: false, weight: 20, href: '/profile/edit' },
      { id: 'bio', label: 'Bio', completed: false, weight: 15, href: '/profile/edit' },
      { id: 'headline', label: 'Headline', completed: false, weight: 15, href: '/profile/edit' },
      { id: 'location', label: 'Location', completed: false, weight: 10, href: '/profile/edit' },
      { id: 'avatar', label: 'Profile photo', completed: false, weight: 10, href: '/profile/edit' },
      { id: 'links', label: 'Social links', completed: false, weight: 10, href: '/profile/edit' },
    ];
  }

  return [
    { id: 'basic', label: 'Basic info', completed: !!profile.displayName, weight: 20, href: '/profile/edit' },
    { id: 'skills', label: 'Skills', completed: Array.isArray(profile.skills) && (profile.skills as unknown[]).length > 0, weight: 20, href: '/profile/edit' },
    { id: 'bio', label: 'Bio', completed: !!profile.bio, weight: 15, href: '/profile/edit' },
    { id: 'headline', label: 'Headline', completed: !!profile.headline, weight: 15, href: '/profile/edit' },
    { id: 'location', label: 'Location', completed: !!profile.location, weight: 10, href: '/profile/edit' },
    { id: 'avatar', label: 'Profile photo', completed: !!profile.avatarUrl, weight: 10, href: '/profile/edit' },
    { id: 'links', label: 'Social links', completed: !!profile.linkedinUrl || !!profile.websiteUrl, weight: 10, href: '/profile/edit' },
  ];
}
