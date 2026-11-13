import { Module } from '@nestjs/common';
import { InvitesModule } from '../invites/invites.module';
import { PlatformModule } from '../platform/platform.module';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentsController, StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [PlatformModule, InvitesModule],
  controllers: [StudentsController, EnrollmentsController],
  providers: [StudentsService, EnrollmentsService],
})
export class StudentsModule {}
