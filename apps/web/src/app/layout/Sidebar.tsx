import { cn, Select } from '@darsi/ui';
import {
  BookOpen,
  Building2,
  CalendarDays,
  ChartNoAxesColumn,
  CreditCard,
  House,
  Inbox,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Ticket,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { SECTION_PATH, type Section } from '../auth/access';
import { useAuth, useSession } from '../auth/session';

const ICONS: Record<Section, LucideIcon> = {
  dashboard: House,
  schedule: CalendarDays,
  courses: BookOpen,
  students: Users,
  requests: Inbox,
  subscriptions: Ticket,
  payments: CreditCard,
  reports: ChartNoAxesColumn,
  staff: UserCog,
  settings: Settings,
  platform: Building2,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Current school; a switcher appears when the user works in two or more (TZ FR-4). */
function SchoolSwitcher() {
  const { t } = useTranslation();
  const { me, schools, school, selectSchool } = useSession();

  if (!school) {
    return (
      <div className="mb-4 px-2 text-xs font-semibold text-muted">{t('shell.superadmin')}</div>
    );
  }
  const role = t(`shell.roles.${school.roles.includes('owner') ? 'owner' : 'admin'}`);
  return (
    <div className="mb-4 px-2">
      {schools.length > 1 ? (
        <Select
          aria-label={t('shell.school')}
          value={school.id}
          onChange={(event) => selectSchool(event.target.value)}
          className="px-3 py-2.5 text-sm font-semibold"
        >
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      ) : (
        <div className="truncate text-sm font-bold" title={school.name}>
          {school.name}
        </div>
      )}
      <div className="mt-1 truncate text-xs text-muted">
        {me.user.firstName} · {role}
      </div>
    </div>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { sections } = useSession();
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen shrink-0 flex-col gap-1 overflow-y-auto border-r border-hairline py-6 transition-[width]',
        collapsed ? 'w-[76px] items-center px-0' : 'w-60 px-4',
      )}
    >
      <div className={cn('mb-5 flex items-center gap-3', !collapsed && 'px-2')}>
        <div className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-ink font-mono font-bold text-lime">
          D
        </div>
        {!collapsed && (
          <span className="text-lg font-bold tracking-[-0.02em]">{t('common.appName')}</span>
        )}
      </div>

      {!collapsed && <SchoolSwitcher />}

      <nav className="flex flex-col gap-1">
        {sections.map((section) => {
          const Icon = ICONS[section];
          const to = SECTION_PATH[section];
          return (
            <NavLink
              key={section}
              to={to}
              end={to === '/'}
              title={collapsed ? t(`nav.${section}`) : undefined}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-[16px] text-sm font-semibold transition',
                  collapsed ? 'size-12 justify-center' : 'h-11 px-3.5',
                  isActive ? 'bg-ink text-on-ink' : 'text-ink-2 hover:bg-surface',
                )
              }
            >
              <Icon size={20} strokeWidth={1.8} aria-hidden />
              {collapsed ? (
                <span className="sr-only">{t(`nav.${section}`)}</span>
              ) : (
                t(`nav.${section}`)
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onToggle}
        title={t(collapsed ? 'common.expandMenu' : 'common.collapseMenu')}
        className={cn(
          'flex shrink-0 cursor-pointer items-center gap-3 rounded-[16px] text-sm font-semibold text-ink-2 transition hover:bg-surface',
          collapsed ? 'size-12 justify-center' : 'h-11 px-3.5',
        )}
      >
        <ToggleIcon size={20} strokeWidth={1.8} aria-hidden />
        {!collapsed && t('common.collapseMenu')}
      </button>
      <button
        type="button"
        onClick={() => void signOut()}
        title={collapsed ? t('common.logout') : undefined}
        className={cn(
          'flex shrink-0 cursor-pointer items-center gap-3 rounded-[16px] text-sm font-semibold text-ink-2 transition hover:bg-surface',
          collapsed ? 'size-12 justify-center' : 'h-11 px-3.5',
        )}
      >
        <LogOut size={20} strokeWidth={1.8} aria-hidden />
        {collapsed ? <span className="sr-only">{t('common.logout')}</span> : t('common.logout')}
      </button>
    </aside>
  );
}
