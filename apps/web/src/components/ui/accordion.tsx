'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type AccordionContextValue = {
  value: string[];
  onValueChange: (value: string[]) => void;
  type: 'single' | 'multiple';
};

const AccordionContext = React.createContext<AccordionContextValue | undefined>(undefined);

function useAccordion() {
  const context = React.useContext(AccordionContext);
  if (!context) {
    throw new Error('useAccordion must be used within an Accordion');
  }
  return context;
}

type AccordionProps = {
  type?: 'single' | 'multiple';
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  children: React.ReactNode;
  className?: string;
};

export function Accordion({
  type = 'single',
  value,
  defaultValue = [],
  onValueChange,
  children,
  className,
}: AccordionProps) {
  const [internalValue, setInternalValue] = React.useState<string[]>(defaultValue);

  const currentValue = value ?? internalValue;

  const handleValueChange = React.useCallback(
    (newValue: string[]) => {
      if (value === undefined) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [value, onValueChange]
  );

  return (
    <AccordionContext.Provider
      value={{
        value: currentValue,
        onValueChange: handleValueChange,
        type,
      }}
    >
      <div className={cn('divide-y divide-border/60', className)}>{children}</div>
    </AccordionContext.Provider>
  );
}

type AccordionItemContextValue = {
  value: string;
  isOpen: boolean;
  triggerId: string;
  panelId: string;
};

const AccordionItemContext = React.createContext<AccordionItemContextValue | undefined>(undefined);

function useAccordionItem() {
  const context = React.useContext(AccordionItemContext);
  if (!context) {
    throw new Error('useAccordionItem must be used within an AccordionItem');
  }
  return context;
}

type AccordionItemProps = {
  value: string;
  children: React.ReactNode;
  className?: string;
};

export function AccordionItem({ value, children, className }: AccordionItemProps) {
  const { value: openValues } = useAccordion();
  const isOpen = openValues.includes(value);
  const id = React.useId();

  return (
    <AccordionItemContext.Provider value={{ value, isOpen, triggerId: `${id}-trigger`, panelId: `${id}-panel` }}>
      <div className={cn('py-2', className)}>{children}</div>
    </AccordionItemContext.Provider>
  );
}

type AccordionTriggerProps = {
  children: React.ReactNode;
  className?: string;
};

export function AccordionTrigger({ children, className }: AccordionTriggerProps) {
  const { value: openValues, onValueChange, type } = useAccordion();
  const { value, isOpen, triggerId, panelId } = useAccordionItem();

  const handleClick = () => {
    if (type === 'single') {
      onValueChange(isOpen ? [] : [value]);
    } else {
      if (isOpen) {
        onValueChange(openValues.filter((v) => v !== value));
      } else {
        onValueChange([...openValues, value]);
      }
    }
  };

  return (
    <button
      type="button"
      id={triggerId}
      aria-expanded={isOpen}
      aria-controls={panelId}
      onClick={handleClick}
      className={cn(
        'flex min-h-11 w-full items-center justify-between gap-2 rounded-md py-2 text-left font-medium text-foreground transition-colors hover:text-primary-accessible focus-ring [&[data-state=open]>svg]:rotate-180',
        className
      )}
      data-state={isOpen ? 'open' : 'closed'}
    >
      {children}
      <ChevronDown className="icon-sm shrink-0 text-muted-foreground transition-transform duration-200" />
    </button>
  );
}

type AccordionContentProps = {
  children: React.ReactNode;
  className?: string;
};

export function AccordionContent({ children, className }: AccordionContentProps) {
  const { isOpen, triggerId, panelId } = useAccordionItem();

  return (
    <div
      id={panelId}
      role="region"
      aria-labelledby={triggerId}
      hidden={!isOpen}
      className={cn(
        'overflow-hidden',
        isOpen ? 'animate-accordion-down motion-reduce:animate-none' : 'hidden'
      )}
    >
      <div className={cn('pb-4 pt-2', className)}>{children}</div>
    </div>
  );
}
