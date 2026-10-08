'use client';

import { useState, ReactNode, createContext, useContext } from 'react';
import { Check, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { MainLandmark } from '@/components/layout/AppShell';

type Step = {
  id: string;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
};

type OnboardingContextType = {
  currentStep: number;
  totalSteps: number;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  canGoNext: boolean;
  canGoPrev: boolean;
  setCanGoNext: (can: boolean) => void;
  isSubmitting: boolean;
  setIsSubmitting: (is: boolean) => void;
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}

type OnboardingProviderProps = {
  steps: Step[];
  children: ReactNode;
  onComplete?: () => void;
  onStepChange?: (step: number) => void;
};

export function OnboardingProvider({
  steps,
  children,
  onComplete,
  onStepChange,
}: OnboardingProviderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [canGoNext, setCanGoNext] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSteps = steps.length;

  const goToStep = (step: number) => {
    if (step >= 0 && step < totalSteps) {
      setCurrentStep(step);
      setCanGoNext(false);
      onStepChange?.(step);
    }
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      goToStep(currentStep + 1);
    } else {
      onComplete?.();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        currentStep,
        totalSteps,
        goToStep,
        nextStep,
        prevStep,
        canGoNext,
        canGoPrev: currentStep > 0,
        setCanGoNext,
        isSubmitting,
        setIsSubmitting,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

// Progress indicator
export function OnboardingProgress({ steps }: { steps: Step[] }) {
  const { currentStep, goToStep } = useOnboarding();

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;
        const Icon = step.icon;

        return (
          <button
            key={step.id}
            onClick={() => index < currentStep && goToStep(index)}
            disabled={index > currentStep}
            className={cn(
              'group flex items-center',
              index < currentStep ? 'cursor-pointer' : index === currentStep ? 'cursor-default' : 'cursor-not-allowed'
            )}
          >
            {/* Step circle */}
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                isCompleted
                  ? 'border-primary bg-primary text-primary-foreground'
                  : isCurrent
                    ? 'border-primary bg-primary/10 text-primary-accessible'
                    : 'border-border bg-background text-muted-foreground'
              )}
            >
              {isCompleted ? (
                <Check className="icon-md" />
              ) : Icon ? (
                <Icon className="icon-md" />
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-0.5 w-8 transition-colors',
                  index < currentStep ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Step header with title and description
export function OnboardingStepHeader({ steps }: { steps: Step[] }) {
  const { currentStep } = useOnboarding();
  const step = steps[currentStep];

  if (!step) return null;

  return (
    <div className="text-center mb-8 animate-fade-in">
      <h2 className="text-2xl font-semibold text-foreground mb-2">{step.title}</h2>
      {step.description && (
        <p className="text-muted-foreground max-w-md mx-auto">{step.description}</p>
      )}
    </div>
  );
}

// Navigation buttons
export function OnboardingNavigation({
  onComplete,
  completeLabel = 'Complete Setup',
}: {
  onComplete?: () => void;
  completeLabel?: string;
}) {
  const { currentStep, totalSteps, nextStep, prevStep, canGoNext, canGoPrev, isSubmitting } =
    useOnboarding();

  const isLastStep = currentStep === totalSteps - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete?.();
    } else {
      nextStep();
    }
  };

  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
      <Button
        variant="ghost"
        onClick={prevStep}
        disabled={!canGoPrev || isSubmitting}
        className={cn(!canGoPrev && 'invisible')}
      >
        <ChevronLeft className="icon-sm mr-1" />
        Back
      </Button>

      <div className="text-sm text-muted-foreground">
        Step {currentStep + 1} of {totalSteps}
      </div>

      <Button onClick={handleNext} disabled={!canGoNext || isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="icon-sm mr-2 animate-spin" />
            Processing...
          </>
        ) : isLastStep ? (
          completeLabel
        ) : (
          <>
            Next
            <ChevronRight className="icon-sm ml-1" />
          </>
        )}
      </Button>
    </div>
  );
}

// Step content wrapper with animation
export function OnboardingStepContent({
  stepIndex,
  children,
}: {
  stepIndex: number;
  children: ReactNode;
}) {
  const { currentStep } = useOnboarding();

  if (stepIndex !== currentStep) return null;

  return <div className="animate-fade-in-up">{children}</div>;
}

// Complete onboarding layout
export function OnboardingLayout({
  steps,
  children,
  logo,
  onComplete,
  onStepChange,
}: {
  steps: Step[];
  children: ReactNode;
  logo?: ReactNode;
  onComplete?: () => void;
  onStepChange?: (step: number) => void;
}) {
  return (
    <OnboardingProvider steps={steps} onComplete={onComplete} onStepChange={onStepChange}>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="p-6 flex items-center justify-center">
          {logo}
        </header>

        {/* Progress */}
        <div className="px-6 py-4">
          <OnboardingProgress steps={steps} />
        </div>

        {/* Content */}
        <MainLandmark className="flex-1 flex items-start justify-center px-6 py-8">
          <Card className="w-full max-w-2xl">
            <CardContent className="pt-8 pb-6 px-8">
              <OnboardingStepHeader steps={steps} />
              {children}
              <OnboardingNavigation onComplete={onComplete} />
            </CardContent>
          </Card>
        </MainLandmark>
      </div>
    </OnboardingProvider>
  );
}
