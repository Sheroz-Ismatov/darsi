import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { AppLayout } from '../layout/AppLayout';
import { SECTION_PATH, type Section } from './access';
import { useAuth, useSession } from './session';

/** Shell for signed-in users with panel access; everyone else goes to the login page. */
export function RequireSession() {
  const { session } = useAuth();
  if (!session || session.sections.length === 0) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

/** Hides a section from roles that have no menu item for it (the API checks the role as well). */
export function SectionRoute({ section, children }: { section: Section; children: ReactNode }) {
  const { sections } = useSession();
  if (!sections.includes(section)) {
    return <Navigate to={SECTION_PATH[sections[0] ?? 'dashboard']} replace />;
  }
  return children;
}
