import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { validateUpload, type UploadPolicy } from './upload-validation';

function file(name: string, mimetype: string, bytes: number[] | string): Express.Multer.File {
  const buffer = typeof bytes === 'string' ? Buffer.from(bytes) : Buffer.from(bytes);
  return { originalname: name, mimetype, buffer, size: buffer.length } as Express.Multer.File;
}

function validate(name: string, mimetype: string, bytes: number[] | string, policy: UploadPolicy = 'attachment') {
  return validateUpload(file(name, mimetype, bytes), policy);
}

describe('upload content validation', () => {
  it('accepts supported content only when bytes, extension and MIME agree', () => {
    expect(validate('photo.jpeg', 'image/jpeg', [0xff, 0xd8, 0xff, 0xdb], 'avatar')).toEqual({
      extension: '.jpg', mimeType: 'image/jpeg',
    });
    expect(validate('paper.pdf', 'application/pdf', '%PDF-1.7\n')).toEqual({
      extension: '.pdf', mimeType: 'application/pdf',
    });
    expect(validate('notes.md', 'text/plain', '# Evidence\n')).toEqual({
      extension: '.md', mimeType: 'text/markdown; charset=utf-8',
    });
  });

  it('rejects active web documents even when the client calls them images', () => {
    for (const candidate of [
      file('avatar.svg', 'image/svg+xml', '<svg onload="alert(1)"></svg>'),
      file('avatar.png', 'image/png', '<html><script>alert(1)</script></html>'),
      file('avatar.jpg', 'image/jpeg', '<svg><script>alert(1)</script></svg>'),
    ]) {
      expect(() => validateUpload(candidate, 'avatar')).toThrow(BadRequestException);
    }
  });

  it('rejects extension and MIME mismatches instead of trusting request metadata', () => {
    expect(() => validate('renamed.jpg', 'image/jpeg', '%PDF-1.7\n', 'avatar')).toThrow(BadRequestException);
    expect(() => validate('photo.png', 'text/html', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).toThrow(BadRequestException);
  });

  it('allows documents for attachments but not avatars', () => {
    expect(validate('paper.pdf', 'application/pdf', '%PDF-1.7\n', 'attachment')).toEqual({
      extension: '.pdf', mimeType: 'application/pdf',
    });
    expect(() => validate('paper.pdf', 'application/pdf', '%PDF-1.7\n', 'avatar')).toThrow(BadRequestException);
  });

  it('distinguishes ZIP and OOXML packages instead of calling every ZIP a DOCX', () => {
    const genericZip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('archive/readme.txt')]);
    const spreadsheet = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('[Content_Types].xml xl/workbook.xml')]);
    expect(validateUpload(file('bundle.zip', 'application/zip', [...genericZip]), 'attachment')).toEqual({
      extension: '.zip', mimeType: 'application/zip',
    });
    expect(validateUpload(file('forecast.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', [...spreadsheet]), 'attachment')).toEqual({
      extension: '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(() => validateUpload(file('renamed.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', [...genericZip]), 'attachment')).toThrow(BadRequestException);
  });

  it('keeps CSV attachments as inert server-labelled text', () => {
    expect(validate('data.csv', 'text/csv', 'name,value\nalpha,1\n')).toEqual({
      extension: '.csv', mimeType: 'text/csv; charset=utf-8',
    });
  });
});
