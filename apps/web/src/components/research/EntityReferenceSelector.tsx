'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  User, Users, Briefcase, Target, Building2, GraduationCap,
  Search, Loader2, Check, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { searchProfiles } from '@/lib/api';
import { qk } from '@/lib/query-keys';

export type EntityType = 'user' | 'opportunity' | 'group' | 'project' | 'mentor';

interface EntityReference {
  type: EntityType;
  id: string;
  title: string;
  subtitle?: string;
  avatarUrl?: string;
}

interface EntityReferenceSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (entity: EntityReference) => void;
}

const ENTITY_TYPES = [
  { type: 'user' as EntityType, label: 'People', icon: User, description: 'Founders, co-founders, mentors' },
  { type: 'opportunity' as EntityType, label: 'Opportunities', icon: Target, description: 'Jobs, partnerships, funding' },
  { type: 'group' as EntityType, label: 'Groups', icon: Users, description: 'Communities and teams' },
  { type: 'project' as EntityType, label: 'Projects', icon: Briefcase, description: 'Startups and ventures' },
  { type: 'mentor' as EntityType, label: 'Mentors', icon: GraduationCap, description: 'Advisors and coaches' },
];

export function EntityReferenceSelector({
  open,
  onClose,
  onSelect,
}: EntityReferenceSelectorProps) {
  const [selectedType, setSelectedType] = useState<EntityType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: searchResults, isLoading } = useQuery({
    queryKey: qk('entity-search', selectedType, searchQuery),
    queryFn: async () => {
      if (!selectedType || !searchQuery.trim()) return [];
      
      switch (selectedType) {
        case 'user':
        case 'mentor': {
          const result = await searchProfiles({ q: searchQuery, limit: 10 });
          return result.hits.map((u) => ({
            type: selectedType,
            id: u.id,
            title: u.displayName || 'Unknown',
            subtitle: u.headline || undefined,
            avatarUrl: u.avatarUrl || undefined,
          }));
        }
        case 'opportunity':
        case 'group':
        case 'project':
        default:
          // These entity types would need dedicated search endpoints
          // For now, return empty array - can be implemented when endpoints are available
          return [];
      }
    },
    enabled: !!selectedType && searchQuery.length >= 2,
  });

  const handleSelect = useCallback((entity: EntityReference) => {
    onSelect(entity);
    onClose();
    setSelectedType(null);
    setSearchQuery('');
  }, [onSelect, onClose]);

  const handleBack = useCallback(() => {
    setSelectedType(null);
    setSearchQuery('');
  }, []);

  const getEntityIcon = (type: EntityType) => {
    const found = ENTITY_TYPES.find((t) => t.type === type);
    return found?.icon || User;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {selectedType ? (
              <div className="flex items-center gap-2">
                <Button aria-label="Back" variant="ghost" size="sm" onClick={handleBack} className="h-8 w-8 p-0">
                  <X className="icon-sm" />
                </Button>
                Add {ENTITY_TYPES.find((t) => t.type === selectedType)?.label} Reference
              </div>
            ) : (
              'Add Entity Reference'
            )}
          </DialogTitle>
          <DialogDescription>
            {selectedType
              ? 'Search and select an entity to reference on your board'
              : 'Choose what type of CoFounderBay entity to reference'}
          </DialogDescription>
        </DialogHeader>

        {!selectedType ? (
          <div className="grid grid-cols-1 gap-2 py-4">
            {ENTITY_TYPES.map((entityType) => {
              const Icon = entityType.icon;
              return (
                <button
                  key={entityType.type}
                  onClick={() => setSelectedType(entityType.type)}
                  className={cn(
                    'flex items-center gap-4 p-4 rounded-lg border',
                    'hover:bg-accent hover:border-primary/40 transition-colors',
                    'text-left'
                  )}
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className="icon-md text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-medium">{entityType.label}</div>
                    <div className="text-sm text-muted-foreground">{entityType.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 icon-sm text-muted-foreground" />
              <Input
                placeholder={`Search ${ENTITY_TYPES.find((t) => t.type === selectedType)?.label?.toLowerCase()}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="icon-lg animate-spin text-muted-foreground" />
                </div>
              )}

              {!isLoading && searchQuery.length >= 2 && searchResults?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No results found
                </div>
              )}

              {!isLoading && searchQuery.length < 2 && (
                <div className="text-center py-8 text-muted-foreground">
                  Type at least 2 characters to search
                </div>
              )}

              {searchResults?.map((entity: EntityReference) => {
                const Icon = getEntityIcon(entity.type);
                return (
                  <button
                    key={entity.id}
                    onClick={() => handleSelect(entity)}
                    className={cn(
                      'flex items-center gap-3 w-full p-3 rounded-lg border',
                      'hover:bg-accent hover:border-primary/40 transition-colors',
                      'text-left'
                    )}
                  >
                    {entity.avatarUrl ? (
                      <img
                        src={entity.avatarUrl}
                        alt={entity.title}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Icon className="icon-md text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{entity.title}</div>
                      {entity.subtitle && (
                        <div className="text-sm text-muted-foreground truncate">{entity.subtitle}</div>
                      )}
                    </div>
                    <Check className="icon-sm text-primary-accessible opacity-0 group-hover:opacity-100 focus-within:opacity-100" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
