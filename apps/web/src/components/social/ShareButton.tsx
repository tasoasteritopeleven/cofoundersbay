'use client';

import { useState } from 'react';
import {
  Share2,
  Facebook,
  Twitter,
  Linkedin,
  Mail,
  Link as LinkIcon,
  Check,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ShareButtonProps {
  url: string;
  title: string;
  description?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'lg' | 'icon' | 'md';
  className?: string;
}

export function ShareButton({
  url,
  title,
  description,
  variant = 'outline',
  size = 'sm',
  className,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description || '');

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`,
  };

  const handleShare = (platform: keyof typeof shareLinks) => {
    window.open(shareLinks[platform], '_blank', 'width=600,height=400');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: shareUrl,
        });
      } catch (error) {
        console.error('Share failed:', error);
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className} aria-label="Share">
          <Share2 className="icon-sm mr-2" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
          <>
            <DropdownMenuItem onClick={handleNativeShare}>
              <Share2 className="icon-sm mr-2" />
              Share via...
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onClick={() => handleShare('facebook')}>
          <Facebook className="icon-sm mr-2" />
          Share on Facebook
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleShare('twitter')}>
          <Twitter className="icon-sm mr-2" />
          Share on Twitter
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleShare('linkedin')}>
          <Linkedin className="icon-sm mr-2" />
          Share on LinkedIn
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleShare('email')}>
          <Mail className="icon-sm mr-2" />
          Share via Email
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={handleCopyLink}>
          {copied ? (
            <>
              <Check className="icon-sm mr-2 text-status-success" />
              Link Copied!
            </>
          ) : (
            <>
              <Copy className="icon-sm mr-2" />
              Copy Link
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
