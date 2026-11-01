import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { setBackButton } from '../telegram';
import { TabBar, type TabItem } from './TabBar';

/**
 * Screen frame: content with room for the floating tab bar.
 * Telegram's native back button appears on any screen that is not a tab root.
 */
export function TmaLayout({ tabs }: { tabs: TabItem[] }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isTabRoot = tabs.some((tab) => tab.to === pathname);

  useEffect(() => setBackButton(isTabRoot ? null : () => navigate(-1)), [isTabRoot, navigate]);

  return (
    <div className="min-h-screen bg-bg">
      <main className="px-[18px] pt-4 pb-[120px]">
        <Outlet />
      </main>
      <TabBar items={tabs} />
    </div>
  );
}
