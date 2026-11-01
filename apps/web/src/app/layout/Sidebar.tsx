import { cn } from '@darsi/ui';
import {
  BookOpen,
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

interface NavItem {
  to: string;
  icon: LucideIcon;
  label:
    | 'dashboard'
    | 'schedule'
    | 'courses'
    | 'students'
    | 'requests'
    | 'subscriptions'
    | 'payments'
    | 'reports'
    | 'staff'
    | 'settings';
}

// TODO(T-11): filter items by role from /me (owner-only: staff, settings; superadmin: platform).
const ITEMS: NavItem[] = [
  { to: '/', icon: House, label: 'dashboard' },
  { to: '/schedule', icon: CalendarDays, label: 'schedule' },
  { to: '/courses', icon: BookOpen, label: 'courses' },
  { to: '/students', icon: Users, label: 'students' },
  { to: '/requests', icon: Inbox, label: 'requests' },
  { to: '/subscriptions', icon: Ticket, label: 'subscriptions' },
  { to: '/payments', icon: CreditCard, label: 'payments' },
  { to: '/reports', icon: ChartNoAxesColumn, label: 'reports' },
  { to: '/staff', icon: UserCog, label: 'staff' },
  { to: '/settings', icon: Settings, label: 'settings' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { t } = useTranslation();
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={cn(
        'sticky top-0 flex h-screen shrink-0 flex-col gap-1 border-r border-hairline py-6 transition-[width]',
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

      <nav className="flex flex-col gap-1">
        {ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? t(`nav.${label}`) : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-[16px] text-sm font-semibold transition',
                collapsed ? 'size-12 justify-center' : 'h-11 px-3.5',
                isActive ? 'bg-ink text-on-ink' : 'text-ink-2 hover:bg-surface',
              )
            }
          >
            <Icon size={20} strokeWidth={1.8} aria-hidden />
            {collapsed ? <span className="sr-only">{t(`nav.${label}`)}</span> : t(`nav.${label}`)}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onToggle}
        title={t(collapsed ? 'common.expandMenu' : 'common.collapseMenu')}
        className={cn(
          'flex cursor-pointer items-center gap-3 rounded-[16px] text-sm font-semibold text-ink-2 transition hover:bg-surface',
          collapsed ? 'size-12 justify-center' : 'h-11 px-3.5',
        )}
      >
        <ToggleIcon size={20} strokeWidth={1.8} aria-hidden />
        {!collapsed && t('common.collapseMenu')}
      </button>
      {/* TODO(T-07): wire logout to POST /auth/logout. */}
      <button
        type="button"
        title={collapsed ? t('common.logout') : undefined}
        className={cn(
          'flex cursor-pointer items-center gap-3 rounded-[16px] text-sm font-semibold text-ink-2 transition hover:bg-surface',
          collapsed ? 'size-12 justify-center' : 'h-11 px-3.5',
        )}
      >
        <LogOut size={20} strokeWidth={1.8} aria-hidden />
        {collapsed ? <span className="sr-only">{t('common.logout')}</span> : t('common.logout')}
      </button>
    </aside>
  );
}
