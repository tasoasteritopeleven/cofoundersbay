import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { randomBytes } from 'crypto';
import type { UploadKind } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UploadsService } from './uploads.service';
import { validateUpload, type UploadPolicy } from './upload-validation';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  private async persistUpload(params: {
    userId: string;
    file?: Express.Multer.File;
    kind: UploadKind;
    prefix: string;
    policy: UploadPolicy;
  }) {
    const { file } = params;
    if (!file?.buffer?.length) throw new BadRequestException('A non-empty file is required');

    const validated = validateUpload(file, params.policy);
    const filename = `${params.prefix}_${Date.now()}_${randomBytes(16).toString('hex')}${validated.extension}`;
    const stored = await this.uploads.storeFile({
      buffer: file.buffer,
      filename,
      mimeType: validated.mimeType,
    });
    const upload = await this.uploads.createUploadRecord({
      userId: params.userId,
      kind: params.kind,
      key: stored.key,
      url: stored.url,
      mimeType: validated.mimeType,
      originalName: file.originalname ?? null,
      sizeBytes: file.size ?? file.buffer.length,
    });
    return { upload };
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: { id: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.persistUpload({ userId: user.id, file, kind: 'avatar', prefix: 'avatar', policy: 'avatar' });
  }

  @Post('message-attachment')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    }),
  )
  async uploadMessageAttachment(
    @CurrentUser() user: { id: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.persistUpload({ userId: user.id, file, kind: 'message_attachment', prefix: 'msg', policy: 'attachment' });
  }

  @Post('research-asset')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for research documents
    }),
  )
  async uploadResearchAsset(
    @CurrentUser() user: { id: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.persistUpload({ userId: user.id, file, kind: 'research_asset', prefix: 'research', policy: 'attachment' });
  }
}

