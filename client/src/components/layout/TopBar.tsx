import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, User } from 'lucide-react';
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
  '/devops': 'DevOps overview',
  '/devops/terraform': 'Terraform',
  '/devops/ansible': 'Ansible',
  '/devops/puppet': 'Puppet',
  '/devops/nagios': 'Nagios',
  '/devops/lab': 'Lab environment',
};

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { repositories, selectedId } = useRepoStore();
  const { health, healthChecked } = useAppStore();

  // Ctrl/⌘+K jumps to repository search (the shortcut shown on the button).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navigate('/repositories?focus=search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const status = !healthChecked
    ? { dot: 'status-dot bg-cf-faint', text: 'text-cf-faint', label: 'Checking' }
    : health
      ? { dot: 'status-dot-online', text: 'text-cf-muted', label: 'API online' }
      : { dot: 'status-dot-offline', text: 'text-cf-error', label: 'API offline' };

  const selectedRepo = repositories.find((r) => r.id === selectedId);
  const title = PAGE_TITLES[location.pathname] ?? 'CódigoFlow';

  return (
    <header className="h-16 flex items-center justify-between gap-4 px-4 md:px-8 bg-cf-bg border-b border-cf-border flex-shrink-0">
      <div className="flex items-center gap-2 text-sm min-w-0">
        <span className="text-cf-faint hidden sm:inline">CódigoFlow</span>
        <span className="text-cf-border hidden sm:inline">/</span>
        <span className="text-cf-text font-medium truncate">{title}</span>
        {selectedRepo && (
          <>
            <span className="text-cf-border">/</span>
            <span className="text-cf-muted font-mono text-xs truncate">{selectedRepo.name}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        <button
          type="button"
          onClick={() => navigate('/repositories?focus=search')}
          className="hidden md:flex h-9 items-center gap-2 bg-cf-navy border border-cf-border rounded-lg px-3 text-sm text-cf-faint hover:text-cf-muted hover:border-white/10 transition-colors w-56"
          aria-label="Search repositories"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="truncate">Search</span>
          <kbd className="ml-auto rounded border border-cf-border bg-cf-elevated px-1.5 font-mono text-[11px] leading-5 text-cf-faint">
            {IS_MAC ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>

        <div className="flex items-center gap-2 px-2 text-xs" role="status" aria-live="polite">
          <span className={status.dot} />
          <span className={status.text}>{status.label}</span>
        </div>

        <Dropdown
          trigger={
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-cf-border bg-cf-elevated text-cf-muted transition-colors hover:text-cf-text"
              aria-label="Account menu"
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
