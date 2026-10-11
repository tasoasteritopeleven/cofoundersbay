'use client';

import { useState, useRef } from 'react';
import { Camera, Upload, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { BilingualText } from '@/components/common/BilingualText';

interface CoverPhotoUploadProps {
  currentCover?: string;
  onUpload: (file: File) => Promise<void>;
  onRemove?: () => Promise<void>;
}

export function CoverPhotoUpload({ currentCover, onUpload, onRemove }: CoverPhotoUploadProps) {
  const { error: toastError } = useToast();
  const [preview, setPreview] = useState<string | null>(currentCover || null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toastError('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toastError('File size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      await onUpload(file);
    } catch (error) {
      console.error('Upload failed:', error);
      toastError('Upload failed. Please try again.');
      setPreview(currentCover || null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    
    setUploading(true);
    try {
      await onRemove();
      setPreview(null);
    } catch (error) {
      console.error('Remove failed:', error);
      toastError('Remove failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'relative h-64 rounded-xl overflow-hidden border-2 border-dashed transition-all',
          dragActive ? 'border-primary bg-primary/5' : 'border-border',
          preview ? 'border-solid' : ''
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Cover"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="icon-sm mr-2" />
                <BilingualText en="Change" el="Αλλαγή" compact />
              </Button>
              {onRemove && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRemove}
                  disabled={uploading}
                >
                  <X className="icon-sm mr-2" />
                  <BilingualText en="Remove" el="Αφαίρεση" compact />
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2"><BilingualText en="Upload Cover Photo" el="Μεταφόρτωση εξωφύλλου" compact /></h3>
            <p className="text-sm text-muted-foreground mb-4">
              <BilingualText en="Drag and drop or click to browse" el="Σύρετε ή πατήστε για αναζήτηση" compact wrap />
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Camera className="icon-sm mr-2" />
              <BilingualText en="Choose File" el="Επιλογή αρχείου" compact />
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              <BilingualText en="Recommended: 1920x480px, Max 5MB" el="Προτείνεται: 1920x480px, έως 5MB" compact />
            </p>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
              <p className="text-sm"><BilingualText en="Uploading..." el="Μεταφόρτωση…" compact /></p>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />

      <div className="text-xs text-muted-foreground">
        <p>• Recommended size: 1920x480 pixels</p>
        <p>• Supported formats: JPG, PNG, WebP</p>
        <p>• Maximum file size: 5MB</p>
      </div>
    </div>
  );
}
