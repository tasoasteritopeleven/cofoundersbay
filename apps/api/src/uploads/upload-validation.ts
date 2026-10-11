import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';

export type UploadPolicy = 'avatar' | 'attachment';

export type ValidatedUpload = {
  extension: string;
  mimeType: string;
};

type DetectedType = ValidatedUpload & {
  acceptedExtensions: readonly string[];
  acceptedMimeTypes: readonly string[];
  image: boolean;
};

function startsWith(buffer: Buffer, bytes: readonly number[]): boolean {
  return bytes.every((byte, index) => buffer[index] === byte);
}

function ascii(buffer: Buffer, start: number, length: number): string {
  return buffer.subarray(start, start + length).toString('ascii');
}

function detectedBinaryType(buffer: Buffer, originalExtension: string): DetectedType | null {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { extension: '.png', mimeType: 'image/png', acceptedExtensions: ['.png'], acceptedMimeTypes: ['image/png'], image: true };
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { extension: '.jpg', mimeType: 'image/jpeg', acceptedExtensions: ['.jpg', '.jpeg'], acceptedMimeTypes: ['image/jpeg', 'image/jpg'], image: true };
  }
  if (ascii(buffer, 0, 6) === 'GIF87a' || ascii(buffer, 0, 6) === 'GIF89a') {
    return { extension: '.gif', mimeType: 'image/gif', acceptedExtensions: ['.gif'], acceptedMimeTypes: ['image/gif'], image: true };
  }
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WEBP') {
    return { extension: '.webp', mimeType: 'image/webp', acceptedExtensions: ['.webp'], acceptedMimeTypes: ['image/webp'], image: true };
  }
  if (ascii(buffer, 4, 4) === 'ftyp' && ['avif', 'avis'].includes(ascii(buffer, 8, 4))) {
    return { extension: '.avif', mimeType: 'image/avif', acceptedExtensions: ['.avif'], acceptedMimeTypes: ['image/avif'], image: true };
  }
  if (ascii(buffer, 0, 2) === 'BM') {
    return { extension: '.bmp', mimeType: 'image/bmp', acceptedExtensions: ['.bmp'], acceptedMimeTypes: ['image/bmp', 'image/x-ms-bmp'], image: true };
  }
  if (startsWith(buffer, [0x00, 0x00, 0x01, 0x00])) {
    return { extension: '.ico', mimeType: 'image/x-icon', acceptedExtensions: ['.ico'], acceptedMimeTypes: ['image/x-icon', 'image/vnd.microsoft.icon'], image: true };
  }
  if (ascii(buffer, 0, 5) === '%PDF-') {
    return { extension: '.pdf', mimeType: 'application/pdf', acceptedExtensions: ['.pdf'], acceptedMimeTypes: ['application/pdf'], image: false };
  }
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    if (originalExtension === '.xls') {
      return { extension: '.xls', mimeType: 'application/vnd.ms-excel', acceptedExtensions: ['.xls'], acceptedMimeTypes: ['application/vnd.ms-excel', 'application/octet-stream'], image: false };
    }
    if (originalExtension === '.ppt') {
      return { extension: '.ppt', mimeType: 'application/vnd.ms-powerpoint', acceptedExtensions: ['.ppt'], acceptedMimeTypes: ['application/vnd.ms-powerpoint', 'application/octet-stream'], image: false };
    }
    return { extension: '.doc', mimeType: 'application/msword', acceptedExtensions: ['.doc'], acceptedMimeTypes: ['application/msword', 'application/octet-stream'], image: false };
  }
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04])) {
    // OOXML containers expose their entry names in the ZIP directory. Checking
    // the package root prevents an arbitrary ZIP renamed to .docx from being
    // reported as a Word document.
    const packageText = buffer.toString('latin1');
    const officeType = packageText.includes('word/') ? 'word'
      : packageText.includes('xl/') ? 'excel'
      : packageText.includes('ppt/') ? 'powerpoint'
      : null;
    if (officeType === 'word') return {
      extension: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      acceptedExtensions: ['.docx'], acceptedMimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/octet-stream'], image: false,
    };
    if (officeType === 'excel') return {
      extension: '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      acceptedExtensions: ['.xlsx'], acceptedMimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/octet-stream'], image: false,
    };
    if (officeType === 'powerpoint') return {
      extension: '.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      acceptedExtensions: ['.pptx'], acceptedMimeTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/octet-stream'], image: false,
    };
    return {
      extension: '.zip', mimeType: 'application/zip', acceptedExtensions: ['.zip'],
      acceptedMimeTypes: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'], image: false,
    };
  }
  return null;
}

function detectedTextType(buffer: Buffer, extension: string): DetectedType | null {
  if (!['.txt', '.md', '.markdown', '.csv'].includes(extension)) return null;
  if (buffer.includes(0)) return null;
  const decoded = buffer.toString('utf8');
  if (decoded.includes('\uFFFD')) return null;
  if (extension === '.csv') return {
    extension: '.csv', mimeType: 'text/csv; charset=utf-8', acceptedExtensions: ['.csv'],
    acceptedMimeTypes: ['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/octet-stream'], image: false,
  };
  return extension === '.txt'
    ? {
        extension: '.txt',
        mimeType: 'text/plain; charset=utf-8',
        acceptedExtensions: ['.txt'],
        acceptedMimeTypes: ['text/plain', 'application/octet-stream'],
        image: false,
      }
    : {
        extension: '.md',
        mimeType: 'text/markdown; charset=utf-8',
        acceptedExtensions: ['.md', '.markdown'],
        acceptedMimeTypes: ['text/markdown', 'text/plain', 'application/octet-stream'],
        image: false,
      };
}

/**
 * Multer's mimetype and filename are both supplied by the client. A file is
 * accepted only when its bytes, extension and claimed MIME agree with a type
 * that the destination supports. SVG/HTML/XML are deliberately excluded:
 * unlike raster images they can execute active content when served back.
 */
export function validateUpload(file: Express.Multer.File, policy: UploadPolicy): ValidatedUpload {
  const originalExtension = extname(file.originalname || '').toLowerCase();
  const claimedMime = (file.mimetype || 'application/octet-stream').split(';', 1)[0].trim().toLowerCase();
  const detected = detectedBinaryType(file.buffer, originalExtension) ?? detectedTextType(file.buffer, originalExtension);

  if (!detected || !detected.acceptedExtensions.includes(originalExtension)) {
    throw new BadRequestException('The file content does not match a supported file type');
  }
  if (!detected.acceptedMimeTypes.includes(claimedMime)) {
    throw new BadRequestException('The file MIME type does not match its content');
  }
  if (policy === 'avatar' && !detected.image) {
    throw new BadRequestException('Avatars must be PNG, JPEG, GIF, WebP, AVIF, BMP, or ICO images');
  }

  return { extension: detected.extension, mimeType: detected.mimeType };
}
