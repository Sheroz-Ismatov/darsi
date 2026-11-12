import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { HorizonJob } from './horizon.job';
import { GroupScheduleController, LessonsController } from './lessons.controller';
import { LessonsService } from './lessons.service';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [GroupScheduleController, LessonsController],
  providers: [HorizonJob, LessonsService, ScheduleService],
  exports: [ScheduleService],
})
export class LessonsModule {}
