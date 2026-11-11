import type { ReactNode } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { CoursesPage } from '../pages/courses/CoursesPage';
import { GroupPage } from '../pages/courses/GroupPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { UiShowcasePage } from '../pages/dev/UiShowcasePage';
import { PlatformPage } from '../pages/platform/PlatformPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { StaffPage } from '../pages/staff/StaffPage';
import { SCHOOL_SECTIONS, SECTION_PATH, type Section } from './auth/access';
import { RequireSession, SectionRoute } from './auth/guards';
import { LoginPage } from './auth/LoginPage';

const PAGES: Partial<Record<Section, ReactNode>> = {
  courses: <CoursesPage />,
  staff: <StaffPage />,
  settings: <SettingsPage />,
};

// TODO(T-16…T-29): replace placeholders with real pages as their tasks land.
const sections: RouteObject[] = SCHOOL_SECTIONS.map((section) => ({
  ...(section === 'dashboard' ? { index: true } : { path: SECTION_PATH[section].slice(1) }),
  element: (
    <SectionRoute section={section}>
      {PAGES[section] ?? <PlaceholderPage title={section} />}
    </SectionRoute>
  ),
}));

sections.push({
  path: 'groups/:id',
  element: (
    <SectionRoute section="courses">
      <GroupPage />
    </SectionRoute>
  ),
});

sections.push({
  path: 'platform',
  element: (
    <SectionRoute section="platform">
      <PlatformPage />
    </SectionRoute>
  ),
});

if (import.meta.env.DEV) {
  sections.push({ path: 'ui', element: <UiShowcasePage /> });
}

sections.push({ path: '*', element: <Navigate to="/" replace /> });

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/', element: <RequireSession />, children: sections },
]);
