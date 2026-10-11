'use client';

import { useState } from 'react';
import { Plus, X, GripVertical, Link as LinkIcon, Calendar, MapPin, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';

interface CustomField {
  id: string;
  type: 'text' | 'url' | 'date' | 'location' | 'select';
  label: string;
  value: string;
  options?: string[];
  icon?: string;
}

interface CustomFieldsEditorProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: Briefcase },
  { value: 'url', label: 'URL', icon: LinkIcon },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'location', label: 'Location', icon: MapPin },
];

export function CustomFieldsEditor({ fields, onChange }: CustomFieldsEditorProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const addField = () => {
    const newField: CustomField = {
      id: `field-${Date.now()}`,
      type: 'text',
      label: '',
      value: '',
    };
    onChange([...fields, newField]);
  };

  const removeField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
  };

  const updateField = (id: string, updates: Partial<CustomField>) => {
    onChange(
      fields.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newFields = [...fields];
    const draggedField = newFields[draggedIndex];
    newFields.splice(draggedIndex, 1);
    newFields.splice(index, 0, draggedField);
    
    onChange(newFields);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold"><BilingualText en="Custom Fields" el="Προσαρμοσμένα πεδία" compact /></h3>
          <p className="text-sm text-muted-foreground">
            <BilingualText en="Add custom information to your profile" el="Προσθέστε δικές σας πληροφορίες στο προφίλ" wrap />
          </p>
        </div>
        <Button onClick={addField} size="sm">
          <Plus className="icon-sm mr-2" />
          <BilingualText en="Add Field" el="Προσθήκη πεδίου" compact />
        </Button>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => {
          const Icon = FIELD_TYPES.find((t) => t.value === field.type)?.icon || Briefcase;
          
          return (
            <Card
              key={field.id}
              className={cn(
                'transition-all',
                draggedIndex === index && 'opacity-50'
              )}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <CardContent>
                <div className="flex items-start gap-3">
                  <div className="cursor-move mt-2">
                    <GripVertical className="icon-md text-muted-foreground" />
                  </div>

                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`cf-type-${field.id}`}><BilingualText en="Field Type" el="Τύπος πεδίου" compact /></Label>
                        <Select
                          value={field.type}
                          onValueChange={(value) =>
                            updateField(field.id, { type: value as CustomField['type'] })
                          }
                        >
                          <SelectTrigger id={`cf-type-${field.id}`} aria-label="Field Type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div className="flex items-center gap-2">
                                  <type.icon className="h-4 w-4" />
                                  {type.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`cf-label-${field.id}`}><BilingualText en="Field Label" el="Ετικέτα πεδίου" compact /></Label>
                        <Input
                          id={`cf-label-${field.id}`}
                          placeholder="e.g., Company, Portfolio, etc."
                          value={field.label}
                          onChange={(e) =>
                            updateField(field.id, { label: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`cf-value-${field.id}`}><BilingualText en="Value" el="Τιμή" compact /></Label>
                      <div className="flex items-center gap-2">
                        <Icon className="icon-sm text-muted-foreground" />
                        <Input
                          id={`cf-value-${field.id}`}
                          type={field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'}
                          placeholder={
                            field.type === 'url'
                              ? 'https://example.com'
                              : field.type === 'date'
                              ? 'Select date'
                              : 'Enter value'
                          }
                          value={field.value}
                          onChange={(e) =>
                            updateField(field.id, { value: e.target.value })
                          }
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>

                  <Button aria-label="Remove field"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeField(field.id)}
                    className="text-destructive-accessible hover:text-destructive-accessible"
                  >
                    <X className="icon-sm" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {fields.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" aria-hidden="true" />
              <h3 className="text-lg font-semibold mb-2"><BilingualText en="No custom fields yet" el="Δεν υπάρχουν προσαρμοσμένα πεδία ακόμα" compact /></h3>
              <p className="text-sm text-muted-foreground mb-4">
                <BilingualText en="Add custom fields to showcase additional information" el="Προσθέστε πεδία για επιπλέον πληροφορίες" wrap />
              </p>
              <Button onClick={addField} variant="outline">
                <Plus className="icon-sm mr-2" />
                <BilingualText en="Add Your First Field" el="Προσθέστε το πρώτο πεδίο" compact />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
