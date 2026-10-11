'use client';

import { ReactNode, Children, cloneElement, isValidElement } from 'react';
import { cn } from '@/lib/utils';

type AnimatedListProps = {
  children: ReactNode;
  className?: string;
  animation?: 'fade-in' | 'fade-in-up' | 'scale-in' | 'fade-in-left' | 'fade-in-right';
  staggerDelay?: number; // milliseconds between each item
  initialDelay?: number; // initial delay before first item animates
};

export function AnimatedList({
  children,
  className,
  animation = 'fade-in-up',
  staggerDelay = 50,
  initialDelay = 0,
}: AnimatedListProps) {
  const items = Children.toArray(children);

  return (
    <div className={cn('contents', className)}>
      {items.map((child, index) => {
        if (!isValidElement(child)) return child;

        const delay = initialDelay + index * staggerDelay;

        return cloneElement(child as React.ReactElement<{ className?: string; style?: React.CSSProperties }>, {
          className: cn(
            (child.props as { className?: string }).className,
            `animate-${animation}`,
            'opacity-0 [animation-fill-mode:forwards]'
          ),
          style: {
            ...((child.props as { style?: React.CSSProperties }).style || {}),
            animationDelay: `${delay}ms`,
          },
        });
      })}
    </div>
  );
}
