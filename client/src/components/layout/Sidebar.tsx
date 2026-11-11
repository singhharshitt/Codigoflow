import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  GitBranch,
  Container,
  Bot,
  BarChart3,
  Workflow,
  Clock,
  Settings,
  ChevronLeft,
  ChevronRight,
  Plug,
  HelpCircle,
  CloudCog,
  Cloud,
  Server,
  Shield,
  Activity,
  FlaskConical,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useRepoStore } from '../../stores/repoStore';
import { BrandMark } from '../shared';
import { WebPattern } from '../shared';
import clsx from 'clsx';

const MAIN_NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/repositories', label: 'Repositories', icon: FolderGit2 },
  { to: '/git', label: 'Git Studio', icon: GitBranch },
  { to: '/docker', label: 'Docker Manager', icon: Container },
  { to: '/ai', label: 'AI Copilot', icon: Bot },
  { to: '/contributions', label: 'Contribution Explorer', icon: BarChart3 },
  { to: '/workflow', label: 'Workflow Builder', icon: Workflow },
  { to: '/history', label: 'Execution History', icon: Clock },
];

const DEVOPS_NAV = [
  { to: '/devops', label: 'Overview', icon: CloudCog },
  { to: '/devops/terraform', label: 'Terraform', icon: Cloud },
  { to: '/devops/ansible', label: 'Ansible', icon: Server },
  { to: '/devops/puppet', label: 'Puppet', icon: Shield },
  { to: '/devops/nagios', label: 'Nagios', icon: Activity },
  { to: '/devops/lab', label: 'Lab Environment', icon: FlaskConical },
];

const BOTTOM_NAV = [
  { to: '/settings#integrations', label: 'Integration Status', icon: Plug },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/help', label: 'Help & Docs', icon: HelpCircle },
];

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, health } = useAppStore();
  const { repositories, selectedId, selectRepository } = useRepoStore();
  const location = useLocation();

  return (
    <aside
      className={clsx(
        'relative flex flex-col h-screen bg-cf-sidebar border-r border-cf-border transition-all duration-300 flex-shrink-0 overflow-hidden',
        sidebarCollapsed ? 'w-16' : 'w-64',
      )}
    >
      <WebPattern className="w-28 h-28 -top-2 -right-2" opacity={0.1} />

      <div className="relative z-10 flex items-center justify-between px-3 py-4 border-b border-cf-border">
        <BrandMark collapsed={sidebarCollapsed} />
        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-cf-elevated text-cf-faint hover:text-cf-text transition-colors"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {sidebarCollapsed && (
        <button
          onClick={toggleSidebar}
          className="relative z-10 mx-auto mt-2 p-1.5 rounded-md hover:bg-cf-elevated text-cf-faint hover:text-cf-text"
          aria-label="Expand sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {!sidebarCollapsed && repositories.length > 0 && (
        <div className="relative z-10 px-3 pt-4 pb-2">
          <div className="section-title">Active Repository</div>
          <select
            value={selectedId ?? ''}
            onChange={(e) => selectRepository(e.target.value || null)}
            className="input text-xs py-1.5"
            aria-label="Select active repository"
          >
            {repositories.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav className="relative z-10 flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
        {!sidebarCollapsed && <div className="section-title px-1 pt-2">Navigation</div>}
        {MAIN_NAV.map(({ to, label, icon: Icon }) => {
          const isActive =
            to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
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

        {!sidebarCollapsed && (
          <div className="section-title px-1 pt-4">DevOps Control Center</div>
        )}
        {DEVOPS_NAV.map(({ to, label, icon: Icon }) => {
          const isActive =
            to === '/devops'
              ? location.pathname === '/devops'
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

      <div className="relative z-10 px-2 py-2 border-t border-cf-border space-y-0.5">
        {!sidebarCollapsed && <div className="section-title px-1">System</div>}
        {BOTTOM_NAV.map(({ to, label, icon: Icon }) => {
          const isActive = location.pathname + location.hash === to || location.pathname === to;
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
      </div>

      {!sidebarCollapsed && health && (
        <div className="relative z-10 px-4 py-3 border-t border-cf-border space-y-1.5">
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
      <span className="text-cf-faint">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={active ? 'status-dot-online' : 'status-dot-offline'} />
        <span className={active ? 'text-cf-success' : 'text-cf-error'}>{active ? 'Ready' : 'Off'}</span>
      </div>
    </div>
  );
}
