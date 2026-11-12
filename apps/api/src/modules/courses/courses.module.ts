import { Module } from '@nestjs/common';
import { LessonsModule } from '../lessons/lessons.module';
import { CoursesController, GroupsController } from './courses.controller';
import { CoursesService } from './courses.service';
import { GroupsService } from './groups.service';

@Module({
  imports: [LessonsModule],
  controllers: [CoursesController, GroupsController],
  providers: [CoursesService, GroupsService],
  exports: [GroupsService],
})
export class CoursesModule {}
