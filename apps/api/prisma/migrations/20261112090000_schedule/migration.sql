-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('planned', 'done', 'cancelled');

-- CreateTable
CREATE TABLE "schedule_rules" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" UUID NOT NULL,
    "school_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "teacher_membership_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "duration_min" INTEGER NOT NULL,
    "status" "LessonStatus" NOT NULL DEFAULT 'planned',
    "original_starts_at" TIMESTAMPTZ(3),
    "cancel_reason" TEXT,
    "meeting_url" TEXT,
    "schedule_rule_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_rules_group_id_idx" ON "schedule_rules"("group_id");

-- CreateIndex
CREATE INDEX "lessons_school_id_starts_at_idx" ON "lessons"("school_id", "starts_at");

-- CreateIndex
CREATE INDEX "lessons_teacher_membership_id_starts_at_idx" ON "lessons"("teacher_membership_id", "starts_at");

-- CreateIndex
CREATE INDEX "lessons_schedule_rule_id_idx" ON "lessons"("schedule_rule_id");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_group_id_starts_at_key" ON "lessons"("group_id", "starts_at");

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_teacher_membership_id_fkey" FOREIGN KEY ("teacher_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_schedule_rule_id_fkey" FOREIGN KEY ("schedule_rule_id") REFERENCES "schedule_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Written by hand: Prisma has no CHECK constraints.
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7);
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_start_time_check" CHECK ("start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "schedule_rules" ADD CONSTRAINT "schedule_rules_valid_check" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from" - 1);
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_duration_check" CHECK ("duration_min" BETWEEN 15 AND 480);
