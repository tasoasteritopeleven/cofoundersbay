'use client';

import { cn } from '@/lib/utils';
import type { CollaboratorPresence } from '@/hooks/useResearchCollaboration';

interface CollaboratorsBarProps {
  collaborators: CollaboratorPresence[];
  isConnected: boolean;
  className?: string;
}

export function CollaboratorsBar({ collaborators, isConnected, className }: CollaboratorsBarProps) {
  if (!isConnected && collaborators.length === 0) return null;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {/* Connection indicator */}
      <div className={cn(
        'w-2 h-2 rounded-full transition-colors',
        isConnected ? 'bg-status-success-mark' : 'bg-muted-foreground/40',
      )} title={isConnected ? 'Live collaboration active' : 'Connecting…'} />

      {/* Online collaborators */}
      <div className="flex -space-x-2">
        {collaborators.slice(0, 5).map((collab) => (
          <div
            key={collab.userId}
            className="w-7 h-7 rounded-full border-2 border-background flex items-center justify-center overflow-hidden relative"
            style={{ backgroundColor: `${collab.color}30`, borderColor: collab.color }}
            title={collab.displayName ?? 'Collaborator'}
          >
            {collab.avatarUrl ? (
              <img src={collab.avatarUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-2xs font-bold" style={{ color: collab.color }}>
                {(collab.displayName ?? '?')[0].toUpperCase()}
              </span>
            )}
          </div>
        ))}
        {collaborators.length > 5 && (
          <div className="w-7 h-7 rounded-full border-2 border-background bg-secondary flex items-center justify-center">
            <span className="text-2xs font-semibold text-muted-foreground">+{collaborators.length - 5}</span>
          </div>
        )}
      </div>

      {collaborators.length > 0 && (
        <span className="text-xs text-muted-foreground">
          {collaborators.length === 1 ? '1 other online' : `${collaborators.length} others online`}
        </span>
      )}
    </div>
  );
}

// Live cursor overlay for canvas
interface LiveCursorsProps {
  collaborators: CollaboratorPresence[];
  pan: { x: number; y: number };
  zoom: number;
}

export function LiveCursors({ collaborators, pan, zoom }: LiveCursorsProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1000 }}>
      {collaborators
        .filter((c) => c.cursor)
        .map((collab) => {
          if (!collab.cursor) return null;
          // Convert world coords to screen coords
          const screenX = collab.cursor.x * zoom + pan.x;
          const screenY = collab.cursor.y * zoom + pan.y;
          return (
            <div
              key={collab.userId}
              className="absolute transition-all duration-75 ease-linear"
              style={{ left: screenX, top: screenY, transform: 'translate(-2px, -2px)' }}
            >
              {/* Cursor arrow */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M3 2L17 10L10 11L8 18L3 2Z"
                  fill={collab.color}
                  stroke="white"
                  strokeWidth={1}
                />
              </svg>
              {/* Name label */}
              <div
                className="absolute top-4 left-2 whitespace-nowrap text-2xs font-semibold text-white px-1.5 py-0.5 rounded"
                style={{ backgroundColor: collab.color }}
              >
                {collab.displayName ?? 'Collaborator'}
              </div>
            </div>
          );
        })}
    </div>
  );
}
