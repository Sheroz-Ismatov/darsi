import { Module } from '@nestjs/common';
import { InvitesModule } from '../invites/invites.module';
import { PlatformModule } from '../platform/platform.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [PlatformModule, InvitesModule],
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
