'use client';

import { useState } from 'react';
import { Download, FileJson, FileText, Table2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type ExportFormat = 'csv' | 'json' | 'tsv';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: ExportFormat, options: ExportOptions) => Promise<void> | void;
  title?: string;
  description?: string;
  rowCount?: number;
  columns?: { key: string; label: string; selected: boolean }[];
  onColumnToggle?: (key: string) => void;
  filename?: string;
}

interface ExportOptions {
  format: ExportFormat;
  includeHeaders: boolean;
  selectedColumns?: string[];
  filename: string;
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string; description: string; icon: React.ElementType; ext: string }[] = [
  { value: 'csv', label: 'CSV', description: 'Comma-separated values — opens in Excel, Google Sheets', icon: Table2, ext: '.csv' },
  { value: 'json', label: 'JSON', description: 'JavaScript Object Notation — for developers and APIs', icon: FileJson, ext: '.json' },
  { value: 'tsv', label: 'TSV', description: 'Tab-separated values — compatible with all spreadsheets', icon: FileText, ext: '.tsv' },
];

export function ExportDialog({
  open,
  onClose,
  onExport,
  title = 'Export Data',
  description,
  rowCount,
  columns,
  onColumnToggle,
  filename = 'export',
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [exporting, setExporting] = useState(false);

  const selectedColumns = columns?.filter((c) => c.selected).map((c) => c.key) ?? [];

  const handleExport = async () => {
    setExporting(true);
    try {
      const ext = FORMAT_OPTIONS.find((f) => f.value === format)?.ext ?? '.csv';
      await onExport(format, {
        format,
        includeHeaders,
        selectedColumns: columns ? selectedColumns : undefined,
        filename: `${filename}${ext}`,
      });
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="icon-sm" />
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-5">
          {/* Row count info */}
          {rowCount != null && (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              Exporting <span className="font-medium text-foreground">{rowCount.toLocaleString('en-GB')}</span> {rowCount === 1 ? 'row' : 'rows'}
              {columns && ` · ${selectedColumns.length} of ${columns.length} columns`}
            </div>
          )}

          {/* Format selection */}
          <div>
            <p className="text-sm font-medium mb-2">Format</p>
            <div className="space-y-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormat(opt.value)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors',
                    format === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-muted/50',
                  )}
                >
                  <opt.icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                  <div className={cn(
                    'h-4 w-4 rounded-full border-2 shrink-0',
                    format === opt.value ? 'border-primary bg-primary' : 'border-border',
                  )}>
                    {format === opt.value && <div className="h-1.5 w-1.5 rounded-full bg-white mx-auto mt-0.5" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Options</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHeaders}
                onChange={(e) => setIncludeHeaders(e.target.checked)}
                className="rounded accent-primary"
              />
              <span className="text-sm">Include column headers</span>
            </label>
          </div>

          {/* Column selection */}
          {columns && columns.length > 0 && onColumnToggle && (
            <div>
              <p className="text-sm font-medium mb-2">Columns</p>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
                {columns.map((col) => (
                  <label key={col.key} className="flex items-center gap-2 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={col.selected}
                      onChange={() => onColumnToggle(col.key)}
                      className="rounded accent-primary"
                    />
                    <span className="text-sm">{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1 gap-1.5"
              onClick={handleExport}
              disabled={exporting || (columns ? selectedColumns.length === 0 : false)}
            >
              {exporting ? <Loader2 className="icon-sm animate-spin" /> : <Download className="icon-sm" />}
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Utility: generate and download a CSV from data
export function downloadCsv(data: Record<string, unknown>[], filename: string, headers?: boolean) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const rows = data.map((row) =>
    keys.map((k) => {
      const v = String(row[k] ?? '');
      return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(','),
  );
  const csv = headers === false ? rows.join('\n') : [keys.join(','), ...rows].join('\n');
  triggerDownload(new Blob([csv], { type: 'text/csv' }), filename);
}

export function downloadJson(data: unknown, filename: string) {
  triggerDownload(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), filename);
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
