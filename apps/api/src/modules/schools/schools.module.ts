import { Module } from '@nestjs/common';
import { LessonsModule } from '../lessons/lessons.module';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';

@Module({
  imports: [LessonsModule],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {}
