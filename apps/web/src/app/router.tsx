import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { UiShowcasePage } from '../pages/dev/UiShowcasePage';
import { PlatformPage } from '../pages/platform/PlatformPage';
import { SCHOOL_SECTIONS, SECTION_PATH } from './auth/access';
import { RequireSession, SectionRoute } from './auth/guards';
import { LoginPage } from './auth/LoginPage';

// TODO(T-13…T-29): replace placeholders with real pages as their tasks land.
const sections: RouteObject[] = SCHOOL_SECTIONS.map((section) => ({
  ...(section === 'dashboard' ? { index: true } : { path: SECTION_PATH[section].slice(1) }),
  element: (
    <SectionRoute section={section}>
      <PlaceholderPage title={section} />
    </SectionRoute>
  ),
}));

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
