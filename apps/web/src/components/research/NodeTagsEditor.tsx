'use client';

import { useState, useCallback, KeyboardEvent } from 'react';
import { X, Plus, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';
import { researchEn, researchEl, useResearchPrimaryText } from '@/lib/i18n/strings-research';
import { bilingualInline } from '@/lib/i18n/format';

const SUGGESTED_TAGS = [
  'research', 'market-analysis', 'competitor', 'funding', 'team',
  'product', 'strategy', 'validation', 'customer', 'technology',
  'legal', 'finance', 'marketing', 'operations', 'growth',
  'mentor-notes', 'due-diligence', 'pitch-deck', 'investor',
];

interface NodeTagsEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  compact?: boolean;
}

export function NodeTagsEditor({ tags, onChange, compact = false }: NodeTagsEditorProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const addTag = useCallback((tag: string) => {
    const normalizedTag = tag.toLowerCase().trim().replace(/\s+/g, '-');
    if (normalizedTag && !tags.includes(normalizedTag)) {
      onChange([...tags, normalizedTag]);
    }
    setInputValue('');
  }, [tags, onChange]);

  const removeTag = useCallback((tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove));
  }, [tags, onChange]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }, [inputValue, tags, addTag, removeTag]);

  const filteredSuggestions = SUGGESTED_TAGS.filter(
    (tag) => !tags.includes(tag) && tag.includes(inputValue.toLowerCase())
  );

  if (compact) {
    return (
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1">
            <Tag className="icon-sm" />
            {tags.length > 0 && <span className="text-xs">{tags.length}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 p-3" align="start">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {tag}
                  <button aria-label={`Remove ${tag}`}
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                  >
                    <X className="icon-sm" />
                  </button>
                </Badge>
              ))}
            </div>

            <Input
              placeholder={bilingualInline("Add tag…", "Προσθήκη ετικέτας…")}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8"
            />

            {filteredSuggestions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {filteredSuggestions.slice(0, 8).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => addTag(tag)}
                    className={cn(
                      'text-xs px-2 py-1 rounded-full border',
                      'hover:bg-accent transition-colors'
                    )}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge
            key={tag}
            variant="secondary"
            className="gap-1 pr-1"
          >
            {tag}
            <button aria-label={`Remove ${tag}`}
              onClick={() => removeTag(tag)}
              className="ml-1 hover:bg-black/10 rounded-full p-0.5"
            >
              <X className="icon-sm" />
            </button>
          </Badge>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          placeholder={bilingualInline("Add a tag…", "Προσθήκη ετικέτας…")}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button aria-label="Add tag"
          variant="outline"
          size="sm"
          onClick={() => inputValue.trim() && addTag(inputValue)}
          disabled={!inputValue.trim()}
        >
          <Plus className="icon-sm" />
        </Button>
      </div>

      {filteredSuggestions.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Suggestions:</p>
          <div className="flex flex-wrap gap-1">
            {filteredSuggestions.slice(0, 10).map((tag) => (
              <button
                key={tag}
                onClick={() => addTag(tag)}
                className={cn(
                  'text-xs px-2 py-1 rounded-full border',
                  'hover:bg-accent transition-colors'
                )}
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface NodeFilterBarProps {
  availableTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function NodeFilterBar({
  availableTags,
  selectedTags,
  onTagsChange,
  searchQuery,
  onSearchChange,
}: NodeFilterBarProps) {
  const t = useResearchPrimaryText();
  const toggleTag = useCallback((tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  }, [selectedTags, onTagsChange]);

  return (
    <div className="flex items-center gap-3 px-1 py-1">
      <Input
        placeholder={t(researchEn('search_nodes'), researchEl('search_nodes'))}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 w-full max-w-xs rounded-xl"
        autoFocus
        aria-label={t(researchEn('search_nodes'), researchEl('search_nodes'))}
      />

      {availableTags.length > 0 && (
        <div className="flex items-center gap-2 flex-1 overflow-x-auto">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            <BilingualText en={researchEn('filter_tags')} el={researchEl('filter_tags')} compact />
          </span>
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={cn(
                'text-xs px-2 py-1 rounded-full border whitespace-nowrap transition-all',
                selectedTags.includes(tag)
                  ? 'border-foreground/30 font-medium text-foreground'
                  : 'border-transparent hover:text-foreground'
              )}
            >
              {tag}
            </button>
          ))}
          {selectedTags.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onTagsChange([])}
              className="text-xs h-7 rounded-xl"
            >
              <BilingualText en={researchEn('clear_filters')} el={researchEl('clear_filters')} compact />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
