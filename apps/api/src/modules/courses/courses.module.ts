import { Module } from '@nestjs/common';
import { CoursesController, GroupsController } from './courses.controller';
import { CoursesService } from './courses.service';
import { GroupsService } from './groups.service';

@Module({
  controllers: [CoursesController, GroupsController],
  providers: [CoursesService, GroupsService],
  exports: [GroupsService],
})
export class CoursesModule {}
