import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UploadKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

export type StoredFile = {
  key: string;
  url: string;
  provider: 's3' | 'local';
};

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  private readonly useS3: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.useS3 = !!(config.get('AWS_S3_BUCKET') && config.get('AWS_ACCESS_KEY_ID') && config.get('AWS_SECRET_ACCESS_KEY'));
    if (this.useS3) {
      this.logger.log('Storage provider: AWS S3');
    } else {
      this.logger.log('Storage provider: local disk (set AWS_S3_BUCKET + AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY to use S3)');
    }
  }

  private apiBaseUrl(): string {
    return (
      this.config.get<string>('API_URL') ||
      `http://localhost:${this.config.get<string>('API_PORT') ?? 3001}`
    );
  }

  private getUploadsDir(): string {
    const dir = resolve(__dirname, '..', '..', 'uploads');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  async storeFile(params: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }): Promise<StoredFile> {
    if (this.useS3) {
      return this.storeToS3(params);
    }
    return this.storeToDisk(params);
  }

  private async storeToS3(params: { buffer: Buffer; filename: string; mimeType: string }): Promise<StoredFile> {
    const bucket = this.config.get<string>('AWS_S3_BUCKET')!;
    const region = this.config.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID')!;
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY')!;
    const customEndpoint = this.config.get<string>('AWS_S3_ENDPOINT');

    // Dynamic import — @aws-sdk/client-s3 is optional; only required when AWS env vars are set
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3') as any;

    const s3 = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      ...(customEndpoint ? { endpoint: customEndpoint, forcePathStyle: true } : {}),
    });

    const key = `uploads/${params.filename}`;
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: params.buffer,
      ContentType: params.mimeType,
      ContentDisposition: params.mimeType.startsWith('image/') ? 'inline' : 'attachment',
    }));

    const cdnBase = this.config.get<string>('AWS_CDN_URL') || `https://${bucket}.s3.${region}.amazonaws.com`;
    const url = `${cdnBase}/${key}`;
    this.logger.log(`Stored to S3: ${url}`);
    return { key, url, provider: 's3' };
  }

  private storeToDisk(params: { buffer: Buffer; filename: string; mimeType: string }): StoredFile {
    const dir = this.getUploadsDir();
    const filePath = `${dir}/${params.filename}`;
    writeFileSync(filePath, params.buffer);
    const urlPath = `/uploads/${params.filename}`;
    const url = `${this.apiBaseUrl()}${urlPath}`;
    return { key: params.filename, url, provider: 'local' };
  }

  async createUploadRecord(params: {
    userId: string;
    kind: UploadKind;
    key: string;
    url: string;
    mimeType?: string | null;
    originalName?: string | null;
    sizeBytes?: number | null;
  }) {
    const upload = await this.prisma.upload.create({
      data: {
        userId: params.userId,
        kind: params.kind,
        key: params.key,
        url: params.url,
        mimeType: params.mimeType ?? null,
        originalName: params.originalName ?? null,
        sizeBytes: params.sizeBytes ?? null,
      },
      select: {
        id: true,
        userId: true,
        kind: true,
        key: true,
        url: true,
        mimeType: true,
        originalName: true,
        sizeBytes: true,
        createdAt: true,
      },
    });
    return upload;
  }
}

