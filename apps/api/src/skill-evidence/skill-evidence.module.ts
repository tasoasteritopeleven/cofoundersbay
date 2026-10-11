import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SkillEvidenceController } from './skill-evidence.controller';
import { SkillEvidenceService } from './skill-evidence.service';

@Module({
  imports: [PrismaModule],
  controllers: [SkillEvidenceController],
  providers: [SkillEvidenceService],
  exports: [SkillEvidenceService],
})
export class SkillEvidenceModule {}
