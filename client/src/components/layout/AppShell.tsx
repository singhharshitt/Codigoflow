import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useAppStore } from '../../stores/appStore';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import clsx from 'clsx';

export function AppShell() {
  const { sidebarCollapsed } = useAppStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [sidebarCollapsed]);

  return (
    <div className="flex h-screen overflow-hidden bg-cf-bg">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      <div
        className={clsx(
          'md:hidden fixed inset-0 z-50 transition',
          mobileOpen ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <button
          type="button"
          className={clsx(
            'absolute inset-0 bg-cf-navy/70 backdrop-blur-sm transition-opacity',
            mobileOpen ? 'opacity-100' : 'opacity-0',
          )}
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={clsx(
            'absolute inset-y-0 left-0 transition-transform',
            mobileOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <Sidebar />
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <div className="md:hidden flex items-center gap-2 px-3 h-12 border-b border-cf-border bg-cf-sidebar">
          <button
            type="button"
            className="p-2 rounded-lg text-cf-muted hover:bg-cf-elevated"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="text-sm font-semibold text-cf-text">
            Código<span className="text-cf-red">Flow</span>
          </span>
        </div>
        <TopBar />
        <main className="relative flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
