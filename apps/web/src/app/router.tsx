import { createBrowserRouter, type RouteObject } from 'react-router';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { UiShowcasePage } from '../pages/dev/UiShowcasePage';
import { AppLayout } from './layout/AppLayout';

// TODO(T-11…T-29): replace placeholders with real pages as their tasks land.
const sections: RouteObject[] = [
  { index: true, element: <PlaceholderPage title="dashboard" /> },
  { path: 'schedule', element: <PlaceholderPage title="schedule" /> },
  { path: 'courses', element: <PlaceholderPage title="courses" /> },
  { path: 'students', element: <PlaceholderPage title="students" /> },
  { path: 'requests', element: <PlaceholderPage title="requests" /> },
  { path: 'subscriptions', element: <PlaceholderPage title="subscriptions" /> },
  { path: 'payments', element: <PlaceholderPage title="payments" /> },
  { path: 'reports', element: <PlaceholderPage title="reports" /> },
  { path: 'staff', element: <PlaceholderPage title="staff" /> },
  { path: 'settings', element: <PlaceholderPage title="settings" /> },
];

if (import.meta.env.DEV) {
  sections.push({ path: 'ui', element: <UiShowcasePage /> });
}

export const router = createBrowserRouter([
  { path: '/', element: <AppLayout />, children: sections },
]);
