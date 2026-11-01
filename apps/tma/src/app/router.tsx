import { CalendarDays, CreditCard, House, BookOpen, UserRound, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { createBrowserRouter, Navigate } from 'react-router';
import { PlaceholderScreen } from '../pages/PlaceholderScreen';
import { TmaLayout } from './layout/TmaLayout';

function ParentLayout() {
  const { t } = useTranslation();
  return (
    <TmaLayout
      tabs={[
        { to: '/parent', icon: House, label: t('nav.home') },
        { to: '/parent/schedule', icon: CalendarDays, label: t('nav.schedule') },
        { to: '/parent/courses', icon: BookOpen, label: t('nav.courses') },
        { to: '/parent/payments', icon: CreditCard, label: t('nav.payments') },
        { to: '/parent/profile', icon: UserRound, label: t('nav.profile') },
      ]}
    />
  );
}

function TeacherLayout() {
  const { t } = useTranslation();
  return (
    <TmaLayout
      tabs={[
        { to: '/teacher', icon: House, label: t('nav.today') },
        { to: '/teacher/groups', icon: Users, label: t('nav.groups') },
        { to: '/teacher/profile', icon: UserRound, label: t('nav.profile') },
      ]}
    />
  );
}

// TODO(T-23, T-31…T-36): real screens; TODO(T-07): pick the start screen by the user's role.
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/parent" replace /> },
  {
    path: '/parent',
    element: <ParentLayout />,
    children: [
      { index: true, element: <PlaceholderScreen title="home" /> },
      { path: 'schedule', element: <PlaceholderScreen title="schedule" /> },
      { path: 'courses', element: <PlaceholderScreen title="courses" /> },
      { path: 'payments', element: <PlaceholderScreen title="payments" /> },
      { path: 'profile', element: <PlaceholderScreen title="profile" /> },
    ],
  },
  {
    path: '/teacher',
    element: <TeacherLayout />,
    children: [
      { index: true, element: <PlaceholderScreen title="today" /> },
      { path: 'groups', element: <PlaceholderScreen title="groups" /> },
      { path: 'profile', element: <PlaceholderScreen title="profile" /> },
    ],
  },
]);
