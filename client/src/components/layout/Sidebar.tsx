import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FolderGit2, GitBranch, Container,
  Bot, BarChart3, Workflow, Clock, Settings, ChevronLeft, ChevronRight, Zap
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useRepoStore } from '../../stores/repoStore';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/',                  label: 'Overview',              icon: LayoutDashboard },
  { to: '/repositories',      label: 'Repositories',          icon: FolderGit2 },
  { to: '/git',               label: 'Git Studio',            icon: GitBranch },
  { to: '/docker',            label: 'Docker Manager',        icon: Container },
  { to: '/ai',                label: 'AI Copilot',            icon: Bot },
  { to: '/contributions',     label: 'Contribution Explorer', icon: BarChart3 },
  { to: '/workflow',          label: 'Workflow Builder',      icon: Workflow },
  { to: '/history',           label: 'Execution History',     icon: Clock },
  { to: '/settings',          label: 'Settings',              icon: Settings },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, health } = useAppStore();
  const { repositories, selectedId, selectRepository } = useRepoStore();
  const location = useLocation();

  return (
    <aside
      className={clsx(
        'flex flex-col h-screen bg-surface-1 border-r border-surface-4 transition-all duration-300 flex-shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-surface-4">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white leading-tight">CódigoFlow</div>
              <div className="text-[10px] text-gray-500 leading-tight">Code to Cloud</div>
            </div>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="mx-auto w-8 h-8 rounded-lg bg-gradient-brand flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
        )}
        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="p-1 rounded-md hover:bg-surface-3 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed */}
      {sidebarCollapsed && (
        <button
          onClick={toggleSidebar}
          className="mx-auto mt-2 p-1 rounded-md hover:bg-surface-3 text-gray-500 hover:text-gray-300 transition-colors"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Repository selector */}
      {!sidebarCollapsed && repositories.length > 0 && (
        <div className="px-3 pt-4 pb-2">
          <div className="section-title">Active Repository</div>
          <select
            value={selectedId ?? ''}
            onChange={(e) => selectRepository(e.target.value || null)}
            className="input text-xs py-1.5"
            aria-label="Select active repository"
          >
            {repositories.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {!sidebarCollapsed && (
          <div className="section-title px-1 pt-2">Navigation</div>
        )}
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
          const isActive = to === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(to);

          return (
            <NavLink
              key={to}
              to={to}
              className={clsx(
                isActive ? 'nav-link-active' : 'nav-link',
                sidebarCollapsed && 'justify-center px-2',
              )}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Integration status footer */}
      {!sidebarCollapsed && health && (
        <div className="px-4 py-3 border-t border-surface-4 space-y-1.5">
          <div className="section-title mb-2">Integrations</div>
          <StatusRow label="AI Copilot" active={health.integrations.ai.configured} />
          <StatusRow label="GitHub" active={health.integrations.github.configured} />
          <StatusRow label="Docker" active={health.integrations.docker.available} />
        </div>
      )}
    </aside>
  );
}

function StatusRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={active ? 'status-dot-online' : 'status-dot-offline'} />
        <span className={active ? 'text-green-400' : 'text-red-400'}>
          {active ? 'Ready' : 'Off'}
        </span>
      </div>
    </div>
  );
}
