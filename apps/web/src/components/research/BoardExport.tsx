'use client';

import { useState, useCallback } from 'react';
import { Download, FileImage, FileText, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toPng } from 'html-to-image';
import { useToast } from '@/components/ui/toast';
import type { ResearchBoardFull } from '@/lib/api';

interface BoardExportProps {
  board: ResearchBoardFull;
  canvasRef: React.RefObject<HTMLDivElement>;
}

export function BoardExport({ board, canvasRef }: BoardExportProps) {
  const { success, error: showError } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'json' | 'markdown' | null>(null);
  const [copied, setCopied] = useState(false);

  const exportAsImage = useCallback(async () => {
    if (!canvasRef.current) {
      showError('PNG Export', 'Canvas is not ready.');
      return;
    }
    setIsExporting(true);
    setExportFormat('png');
    try {
      const dataUrl = await toPng(canvasRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `${board.title || 'research-board'}.png`;
      link.href = dataUrl;
      link.click();
      success('Export complete', 'Board exported as PNG');
    } catch {
      showError('PNG Export', 'Could not export. Try fitting the view first.');
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  }, [board.title, canvasRef, success, showError]);

  const exportAsJSON = useCallback(() => {
    setIsExporting(true);
    setExportFormat('json');

    try {
      const exportData = {
        title: board.title,
        description: board.description,
        exportedAt: new Date().toISOString(),
        nodes: board.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          title: node.title,
          content: node.content,
          url: node.url,
          posX: node.posX,
          posY: node.posY,
          width: node.width,
          height: node.height,
          color: node.color,
          tags: node.tags,
        })),
        connectors: board.connectors.map((conn) => ({
          id: conn.id,
          fromNodeId: conn.fromNodeId,
          toNodeId: conn.toNodeId,
          label: conn.label,
          color: conn.color,
          style: conn.style,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${board.title || 'research-board'}-${Date.now()}.json`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      success('Export complete', 'Board exported as JSON');
    } catch (err) {
      console.error('Export failed:', err);
      showError('Export failed', 'Could not export board as JSON');
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  }, [board, success, showError]);

  const exportAsMarkdown = useCallback(() => {
    setIsExporting(true);
    setExportFormat('markdown');

    try {
      let markdown = `# ${board.title || 'Research Board'}\n\n`;
      
      if (board.description) {
        markdown += `${board.description}\n\n`;
      }

      markdown += `---\n\n`;
      markdown += `*Exported on ${new Date().toLocaleDateString('en-GB', { timeZone: 'UTC' })}*\n\n`;

      // Group nodes by type
      const nodesByType: Record<string, typeof board.nodes> = {};
      board.nodes.forEach((node) => {
        if (!nodesByType[node.type]) {
          nodesByType[node.type] = [];
        }
        nodesByType[node.type].push(node);
      });

      // Export each type
      const typeLabels: Record<string, string> = {
        note: 'Notes',
        document: 'Documents',
        image: 'Images',
        pdf: 'PDFs',
        link: 'Links',
        reference: 'References',
      };

      Object.entries(nodesByType).forEach(([type, nodes]) => {
        markdown += `## ${typeLabels[type] || type}\n\n`;
        
        nodes.forEach((node) => {
          markdown += `### ${node.title || 'Untitled'}\n\n`;
          
          if (node.tags && node.tags.length > 0) {
            markdown += `**Tags:** ${node.tags.join(', ')}\n\n`;
          }

          if (node.content) {
            // Strip HTML tags for plain text
            const plainText = node.content.replace(/<[^>]*>/g, '');
            markdown += `${plainText}\n\n`;
          }

          if (node.url) {
            markdown += `**URL:** ${node.url}\n\n`;
          }

          markdown += `---\n\n`;
        });
      });

      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${board.title || 'research-board'}-${Date.now()}.md`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      success('Export complete', 'Board exported as Markdown');
    } catch (err) {
      console.error('Export failed:', err);
      showError('Export failed', 'Could not export board as Markdown');
    } finally {
      setIsExporting(false);
      setExportFormat(null);
    }
  }, [board, success, showError]);

  const copyShareLink = useCallback(async () => {
    try {
      const url = `${window.location.origin}/research/${board.id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      success('Link copied', 'Board link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showError('Copy failed', 'Could not copy link to clipboard');
    }
  }, [board.id, success, showError]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="icon-sm animate-spin mr-2" />
          ) : (
            <Download className="icon-sm mr-2" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={exportAsImage} disabled={isExporting}>
          <FileImage className="icon-sm mr-2" />
          Export as PNG
          {exportFormat === 'png' && <Loader2 className="icon-sm ml-auto animate-spin" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsJSON} disabled={isExporting}>
          <FileText className="icon-sm mr-2" />
          Export as JSON
          {exportFormat === 'json' && <Loader2 className="icon-sm ml-auto animate-spin" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportAsMarkdown} disabled={isExporting}>
          <FileText className="icon-sm mr-2" />
          Export as Markdown
          {exportFormat === 'markdown' && <Loader2 className="icon-sm ml-auto animate-spin" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyShareLink}>
          {copied ? (
            <Check className="icon-sm mr-2 text-status-success" />
          ) : (
            <Copy className="icon-sm mr-2" />
          )}
          Copy Share Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
