import { useState } from 'react';
import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';

const COLLAPSED_KEY = 'darsi.sidebar.collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, value ? '0' : '1');
      } catch {
        // Storage may be unavailable (private mode); the preference just won't persist.
      }
      return !value;
    });
  };

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main className="min-w-0 flex-1 px-9 pt-7 pb-9">
        <Outlet />
      </main>
    </div>
  );
}
