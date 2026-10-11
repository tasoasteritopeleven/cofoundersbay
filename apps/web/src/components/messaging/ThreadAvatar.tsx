'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, initialsOf } from '@/lib/utils';

function hashHue(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  // A one-word thread name ("Harbor") keeps two letters; a person's name
  // goes through the shared helper so "Dr. Sarah Kim" is SK, not DK.
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return initialsOf(name);
}

export function ThreadAvatar({
  name,
  src,
  seed,
  size = 'md',
  online,
  className,
}: {
  name: string;
  src?: string | null;
  seed?: string;
  size?: 'sm' | 'md' | 'lg';
  online?: boolean;
  className?: string;
}) {
  const hue = hashHue(seed || name);
  const dim = size === 'sm' ? 'h-8 w-8 text-2xs' : size === 'lg' ? 'h-12 w-12 text-sm' : 'h-10 w-10 text-xs';
  const ring = size === 'sm' ? 'h-2 w-2' : 'h-3 w-3';

  return (
    <div className={cn('relative shrink-0', className)}>
      <Avatar className={cn(dim, 'shadow-sm ring-2 ring-background')}>
        <AvatarImage src={src || undefined} alt="" />
        <AvatarFallback
          className="font-semibold tracking-wide text-white"
          style={{
            background: `linear-gradient(145deg, hsl(${hue} 52% 46%), hsl(${(hue + 28) % 360} 58% 34%))`,
          }}
        >
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      {online && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full bg-status-success-mark ring-2 ring-background',
            ring,
          )}
        />
      )}
    </div>
  );
}
