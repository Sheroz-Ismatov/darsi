import type { CourseColor, CourseIcon as CourseIconKey } from '@darsi/shared';
import { cn, PASTEL_BG } from '@darsi/ui';
import {
  BookOpen,
  Bot,
  Brush,
  Calculator,
  Code,
  Dumbbell,
  FlaskConical,
  GraduationCap,
  Languages,
  Music,
  Palette,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

/** Course icon keys (COURSE_ICONS) to lucide icons, DESIGN_SYSTEM.md §7. */
export const COURSE_ICON: Record<CourseIconKey, LucideIcon> = {
  'book-open': BookOpen,
  palette: Palette,
  music: Music,
  dumbbell: Dumbbell,
  languages: Languages,
  code: Code,
  calculator: Calculator,
  'flask-conical': FlaskConical,
  bot: Bot,
  brush: Brush,
  trophy: Trophy,
  'graduation-cap': GraduationCap,
};

interface CourseIconProps {
  icon: CourseIconKey;
  color: CourseColor;
  /** Side of the square in px. */
  size?: number;
  /** On a surface square, for headers that are already painted in the course pastel. */
  plain?: boolean;
  className?: string;
}

/** The course icon on its pastel square (prototype TCourses). */
export function CourseIcon({ icon, color, size = 48, plain = false, className }: CourseIconProps) {
  const Icon = COURSE_ICON[icon];
  return (
    <div
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-sm text-ink',
        plain ? 'bg-surface' : PASTEL_BG[color],
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.45)} strokeWidth={1.8} />
    </div>
  );
}
