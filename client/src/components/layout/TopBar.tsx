import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, User } from 'lucide-react';
import { useRepoStore } from '../../stores/repoStore';
import { useAppStore } from '../../stores/appStore';
import { Dropdown } from '../ui';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/repositories': 'Repositories',
  '/git': 'Git Studio',
  '/docker': 'Docker Manager',
  '/ai': 'AI Copilot',
  '/contributions': 'Contribution Explorer',
  '/workflow': 'Workflow Builder',
  '/history': 'Execution History',
  '/settings': 'Settings',
  '/help': 'Help & Documentation',
};

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { repositories, selectedId, selectRepository } = useRepoStore();
  const { health } = useAppStore();

  const selectedRepo = repositories.find((r) => r.id === selectedId);
  const title = PAGE_TITLES[location.pathname] ?? 'CódigoFlow';

  return (
    <header className="h-14 flex items-center justify-between gap-4 px-4 md:px-6 bg-cf-sidebar/90 border-b border-cf-border flex-shrink-0 backdrop-blur-md">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className="text-cf-faint hidden sm:inline">CódigoFlow</span>
        <span className="text-cf-border hidden sm:inline">/</span>
        <span className="text-cf-text font-medium truncate">{title}</span>
        {selectedRepo && (
          <>
            <span className="text-cf-border">/</span>
            <span className="text-cf-cyan font-mono text-xs truncate">{selectedRepo.name}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {repositories.length > 0 && (
          <select
            value={selectedId ?? ''}
            onChange={(e) => selectRepository(e.target.value || null)}
            className="input hidden lg:block w-44 text-xs py-1.5"
            aria-label="Repository selector"
          >
            {repositories.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          onClick={() => navigate('/repositories')}
          className="hidden md:flex items-center gap-2 bg-cf-navy border border-cf-border rounded-lg px-3 py-1.5 text-sm text-cf-faint hover:border-cf-cyan/40 hover:text-cf-muted transition-colors w-48"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="truncate">Search repositories…</span>
          <kbd className="ml-auto text-[10px] bg-cf-elevated px-1.5 py-0.5 rounded text-cf-faint">⌘K</kbd>
        </button>

        <div className="flex items-center gap-1.5 text-xs px-2">
          <span className={health ? 'status-dot-online' : 'status-dot-offline'} />
          <span className={health ? 'text-cf-success' : 'text-cf-error'}>
            {health ? 'Online' : 'Offline'}
          </span>
        </div>

        <button
          className="p-1.5 rounded-lg hover:bg-cf-elevated text-cf-faint hover:text-cf-text transition-colors"
          aria-label="Notifications"
          type="button"
        >
          <Bell className="w-4 h-4" />
        </button>

        <Dropdown
          trigger={
            <button
              type="button"
              className="w-8 h-8 rounded-full bg-gradient-brand flex items-center justify-center text-xs font-bold text-white"
              aria-label="Profile"
            >
              <User className="w-4 h-4" />
            </button>
          }
        >
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-xs text-cf-muted hover:bg-cf-elevated rounded-md"
            onClick={() => navigate('/settings')}
          >
            Open Settings
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-xs text-cf-muted hover:bg-cf-elevated rounded-md"
            onClick={() => navigate('/help')}
          >
            Help & Docs
          </button>
        </Dropdown>
      </div>
    </header>
  );
}
