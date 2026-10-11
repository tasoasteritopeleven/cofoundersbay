'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Check, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { pressableProps } from '@/lib/pressable';
import { bilingualInline } from '@/lib/i18n/format';
interface CropArea { x: number; y: number; size: number }

interface ImageCropperProps {
  open: boolean;
  onClose: () => void;
  onCrop: (blob: Blob, dataUrl: string) => void;
  aspectRatio?: number;
  cropShape?: 'circle' | 'rect';
  title?: string;
  outputSize?: number;
}

export function ImageCropper({
  open,
  onClose,
  onCrop,
  aspectRatio = 1,
  cropShape = 'circle',
  title = 'Crop Image',
  outputSize = 400,
}: ImageCropperProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, size: 200 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const CANVAS_SIZE = 320;
  const CROP_SIZE = Math.floor(CANVAS_SIZE * 0.75);

  useEffect(() => {
    setCropArea({ x: (CANVAS_SIZE - CROP_SIZE) / 2, y: (CANVAS_SIZE - CROP_SIZE) / 2, size: CROP_SIZE });
  }, []);

  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setOffset({ x: 0, y: 0 });
      setZoom(1);
      drawCanvas();
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.save();
    ctx.translate(CANVAS_SIZE / 2 + offset.x, CANVAS_SIZE / 2 + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);

    const scale = Math.max(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();

    // Overlay
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const cx = cropArea.x + cropArea.size / 2;
    const cy = cropArea.y + cropArea.size / 2;

    // Cut out crop region by drawing image again clipped
    ctx.save();
    ctx.beginPath();
    if (cropShape === 'circle') {
      ctx.arc(cx, cy, cropArea.size / 2, 0, Math.PI * 2);
    } else {
      const hw = (cropArea.size * aspectRatio) / 2;
      const hh = cropArea.size / 2;
      ctx.rect(cx - hw, cy - hh, hw * 2, hh * 2);
    }
    ctx.clip();

    ctx.translate(CANVAS_SIZE / 2 + offset.x, CANVAS_SIZE / 2 + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(zoom, zoom);
    const scale2 = Math.max(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
    const w2 = img.width * scale2;
    const h2 = img.height * scale2;
    ctx.drawImage(img, -w2 / 2, -h2 / 2, w2, h2);
    ctx.restore();

    // Crop border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    if (cropShape === 'circle') {
      ctx.arc(cx, cy, cropArea.size / 2, 0, Math.PI * 2);
    } else {
      const hw = (cropArea.size * aspectRatio) / 2;
      const hh = cropArea.size / 2;
      ctx.rect(cx - hw, cy - hh, hw * 2, hh * 2);
    }
    ctx.stroke();

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 3; i++) {
      const x = cropArea.x + (cropArea.size / 3) * i;
      const y = cropArea.y + (cropArea.size / 3) * i;
      ctx.beginPath(); ctx.moveTo(x, cropArea.y); ctx.lineTo(x, cropArea.y + cropArea.size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cropArea.x, y); ctx.lineTo(cropArea.x + cropArea.size, y); ctx.stroke();
    }
  }, [zoom, rotation, offset, cropArea, cropShape, aspectRatio]);

  useEffect(() => { drawCanvas(); }, [drawCanvas]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: t.clientX - offset.x, y: t.clientY - offset.y });
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const t = e.touches[0];
    setOffset({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImageSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImageSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleCrop = () => {
    const img = imageRef.current;
    if (!img) return;
    const out = document.createElement('canvas');
    out.width = outputSize;
    out.height = cropShape === 'circle' ? outputSize : Math.round(outputSize / aspectRatio);
    const ctx = out.getContext('2d');
    if (!ctx) return;

    if (cropShape === 'circle') {
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.clip();
    }

    const scale = Math.max(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
    const imgW = img.width * scale * zoom;
    const imgH = img.height * scale * zoom;
    const cx = CANVAS_SIZE / 2 + offset.x;
    const cy = CANVAS_SIZE / 2 + offset.y;
    const cropCX = cropArea.x + cropArea.size / 2;
    const cropCY = cropArea.y + cropArea.size / 2;
    const diffX = cropCX - cx;
    const diffY = cropCY - cy;
    const scaleOut = outputSize / cropArea.size;

    ctx.translate(outputSize / 2, outputSize / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, (-imgW / 2 - diffX) * scaleOut, (-imgH / 2 - diffY) * scaleOut, imgW * scaleOut, imgH * scaleOut);

    out.toBlob((blob) => {
      if (!blob) return;
      const url = out.toDataURL('image/jpeg', 0.92);
      onCrop(blob, url);
      handleClose();
    }, 'image/jpeg', 0.92);
  };

  const handleClose = () => {
    setImageSrc(null);
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{bilingualInline('Upload an image and adjust its crop.', 'Ανεβάστε εικόνα και προσαρμόστε την περικοπή της.')}</DialogDescription>
        </DialogHeader>

        {!imageSrc ? (
          <div
            className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            {...pressableProps({ label: 'Drop image here or press Enter to browse' })}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" aria-hidden="true" />
            <p className="text-sm font-medium">Drop image here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP up to 10MB</p>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
        ) : (
          <div className="space-y-4">
            <div
              ref={containerRef}
              className="relative mx-auto select-none"
              style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
            >
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className={cn('rounded-lg', isDragging ? 'cursor-grabbing' : 'cursor-grab')}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleMouseUp}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <ZoomOut className="icon-sm text-muted-foreground shrink-0" />
                <input
                  type="range" min="0.5" max="3" step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <ZoomIn className="icon-sm text-muted-foreground shrink-0" />
              </div>
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setRotation(r => r - 90)}>
                  <RotateCcw className="icon-sm mr-1" /> Rotate
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setZoom(1); setRotation(0); setOffset({ x: 0, y: 0 }); }}>
                  Reset
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setImageSrc(null); fileInputRef.current?.click(); }}>
                  Change
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                <X className="icon-sm mr-1.5" /> Cancel
              </Button>
              <Button className="flex-1" onClick={handleCrop}>
                <Check className="icon-sm mr-1.5" /> Apply Crop
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Inline trigger version — wraps an existing avatar/image trigger
interface ImageCropperTriggerProps {
  onCrop: (blob: Blob, dataUrl: string) => void;
  cropShape?: 'circle' | 'rect';
  aspectRatio?: number;
  outputSize?: number;
  title?: string;
  /** What the trigger does, for anyone who cannot see the image inside it. */
  label?: string;
  /**
   * Lets a second control open the same dialog.
   *
   * On the profile editor the photo and a button beside it both mean "crop and
   * upload"; without this the button had nothing to open and simply sat there
   * looking like the primary action.
   */
  openSignal?: number;
  children: React.ReactNode;
}

export function ImageCropperTrigger({
  onCrop, cropShape, aspectRatio, outputSize, title, label, openSignal, children,
}: ImageCropperTriggerProps) {
  const [open, setOpen] = useState(false);

  // A bump from outside opens it. The initial value is ignored so the dialog
  // does not appear on mount.
  const lastSignal = useRef(openSignal);
  useEffect(() => {
    if (openSignal !== undefined && openSignal !== lastSignal.current) {
      lastSignal.current = openSignal;
      setOpen(true);
    }
  }, [openSignal]);

  return (
    <>
      {/* A div with onClick was invisible to the keyboard: the only way to
          change your photo was a mouse. Given the role it already plays, it
          needs the name, the focus stop and the two keys that operate it. */}
      <div
        role="button"
        tabIndex={0}
        aria-label={label ?? title ?? 'Crop and upload an image'}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="cursor-pointer rounded-xl focus-ring"
      >
        {children}
      </div>
      <ImageCropper
        open={open}
        onClose={() => setOpen(false)}
        onCrop={onCrop}
        cropShape={cropShape}
        aspectRatio={aspectRatio}
        outputSize={outputSize}
        title={title}
      />
    </>
  );
}
