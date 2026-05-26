import { Outlet, useLocation } from 'react-router-dom';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { InspectorPanel } from '@/components/layout/inspector-panel';
import { getWorkspaceFromPath } from '@/lib/routes/workspace';

export function AppLayout() {
  const location = useLocation();
  const workspace = getWorkspaceFromPath(location.pathname);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-fg)]">
      <TopBar workspace={workspace} />
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[112rem] grid-cols-[17rem_minmax(0,1fr)_20rem] gap-6 px-6 py-6">
        <AppSidebar workspace={workspace} pathname={location.pathname} />
        <main className="min-w-0">
          <Outlet />
        </main>
        <InspectorPanel workspace={workspace} />
      </div>
    </div>
  );
}
