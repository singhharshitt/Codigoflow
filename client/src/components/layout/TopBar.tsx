import { useLocation } from 'react-router-dom';
import { Search, Bell } from 'lucide-react';
import { useRepoStore } from '../../stores/repoStore';
import { useAppStore } from '../../stores/appStore';

const PAGE_TITLES: Record<string, string> = {
  '/':             'Overview',
  '/repositories': 'Repositories',
  '/git':          'Git Studio',
  '/docker':       'Docker Manager',
  '/ai':           'AI Copilot',
  '/contributions':'Contribution Explorer',
  '/workflow':     'Workflow Builder',
  '/history':      'Execution History',
  '/settings':     'Settings',
};

export function TopBar() {
  const location = useLocation();
  const { repositories, selectedId } = useRepoStore();
  const { health } = useAppStore();

  const selectedRepo = repositories.find((r) => r.id === selectedId);
  const title = PAGE_TITLES[location.pathname] ?? 'CódigoFlow';

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-surface-1 border-b border-surface-4 flex-shrink-0">
      {/* Page title + breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">CódigoFlow</span>
        <span className="text-gray-600">/</span>
        <span className="text-gray-100 font-medium">{title}</span>
        {selectedRepo && (
          <>
            <span className="text-gray-600">/</span>
            <span className="text-brand-400 font-mono text-xs">{selectedRepo.name}</span>
          </>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Search placeholder */}
        <div className="hidden md:flex items-center gap-2 bg-surface-2 border border-surface-4 rounded-lg px-3 py-1.5 text-sm text-gray-500 cursor-pointer hover:border-surface-5 transition-colors w-52">
          <Search className="w-3.5 h-3.5" />
          <span>Search repositories…</span>
          <kbd className="ml-auto text-xs bg-surface-4 px-1.5 py-0.5 rounded">⌘K</kbd>
        </div>

        {/* Server status */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className={health ? 'status-dot-online' : 'status-dot-offline'} />
          <span className={health ? 'text-green-400' : 'text-red-400'}>
            {health ? 'Server Online' : 'Server Offline'}
          </span>
        </div>

        {/* Notifications placeholder */}
        <button
          className="p-1.5 rounded-lg hover:bg-surface-3 text-gray-400 hover:text-gray-200 transition-colors relative"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* User avatar placeholder */}
        <div className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-bold text-white select-none">
          CF
        </div>
      </div>
    </header>
  );
}
