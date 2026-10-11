import { Module } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { ProfileController } from './profile.controller';
import { AuthModule } from '../auth/auth.module';
import { SearchModule } from '../search/search.module';
import { ProfileIndexService } from '../jobs/profile-index.service';

@Module({
  imports: [AuthModule, SearchModule],
  controllers: [ProfileController],
  providers: [ProfileService, ProfileIndexService],
  exports: [ProfileService],
})
export class ProfileModule {}
