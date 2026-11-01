import { cn } from '@darsi/ui';
import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';

export interface TabItem {
  to: string;
  icon: LucideIcon;
  label: string;
}

/** Floating dark tab bar with a lime active tab (DESIGN_SYSTEM.md §5). */
export function TabBar({ items }: { items: TabItem[] }) {
  return (
    <nav
      className="fixed inset-x-3.5 z-20 flex justify-around rounded-[26px] bg-ink px-3.5 py-2.5 shadow-md"
      style={{
        bottom: 'calc(14px + var(--tg-safe-area-inset-bottom, env(safe-area-inset-bottom, 0px)))',
      }}
    >
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end
          aria-label={label}
          className={({ isActive }) =>
            cn(
              'grid size-12 place-items-center rounded-[18px] transition',
              isActive ? 'bg-lime text-on-accent' : 'text-on-ink/50',
            )
          }
        >
          <Icon size={22} strokeWidth={1.8} aria-hidden />
        </NavLink>
      ))}
    </nav>
  );
}
