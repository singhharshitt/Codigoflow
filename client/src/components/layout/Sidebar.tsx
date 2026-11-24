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
import clsx from 'clsx';

const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/repositories', label: 'Repositories', icon: FolderGit2 },
  { to: '/git', label: 'Git Studio', icon: GitBranch },
  { to: '/docker', label: 'Docker Manager', icon: Container },
  { to: '/ai', label: 'AI Copilot', icon: Bot },
  { to: '/contributions', label: 'Contribution Explorer', icon: BarChart3 },
  { to: '/workflow', label: 'Workflow Builder', icon: Workflow },
  { to: '/history', label: 'Execution History', icon: Clock },
];

const DEVOPS_NAV: NavItem[] = [
  { to: '/devops', label: 'Overview', icon: CloudCog },
  { to: '/devops/terraform', label: 'Terraform', icon: Cloud },
  { to: '/devops/ansible', label: 'Ansible', icon: Server },
  { to: '/devops/puppet', label: 'Puppet', icon: Shield },
  { to: '/devops/nagios', label: 'Nagios', icon: Activity },
  { to: '/devops/lab', label: 'Lab Environment', icon: FlaskConical },
];

const BOTTOM_NAV: NavItem[] = [
  { to: '/settings#integrations', label: 'Integration Status', icon: Plug },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/help', label: 'Help & Docs', icon: HelpCircle },
];

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard };

function isNavActive(to: string, pathname: string, hash: string) {
  const [path, anchor] = to.split('#');
  if (anchor) return pathname === path && hash === `#${anchor}`;
  if (path === '/' || path === '/devops' || path === '/settings') {
    return pathname === path && (path !== '/settings' || hash !== '#integrations');
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, health } = useAppStore();
  const { repositories, selectedId, selectRepository } = useRepoStore();
  const location = useLocation();

  const renderGroup = (title: string, items: NavItem[]) => (
    <div className="space-y-0.5">
      {!sidebarCollapsed && <div className="section-title px-2.5 pt-5">{title}</div>}
      {sidebarCollapsed && <div className="mx-3 my-3 h-px bg-cf-border first:hidden" />}
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={clsx(
            isNavActive(to, location.pathname, location.hash) ? 'nav-link-active' : 'nav-link',
            sidebarCollapsed && 'justify-center px-0',
          )}
          title={sidebarCollapsed ? label : undefined}
          aria-label={sidebarCollapsed ? label : undefined}
        >
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {!sidebarCollapsed && <span className="truncate">{label}</span>}
        </NavLink>
      ))}
    </div>
  );

  return (
    <aside
      className={clsx(
        'flex h-screen shrink-0 flex-col border-r border-cf-border bg-cf-sidebar',
        sidebarCollapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-cf-border px-4">
        <BrandMark collapsed={sidebarCollapsed} className={sidebarCollapsed ? 'w-full' : undefined} />
        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="rounded-md p-1.5 text-cf-faint transition-colors hover:bg-cf-elevated hover:text-cf-text"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="mx-auto mt-3 flex h-8 w-8 items-center justify-center rounded-md text-cf-faint transition-colors hover:bg-cf-elevated hover:text-cf-text"
            aria-label="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {!sidebarCollapsed && repositories.length > 0 && (
          <div className="pt-4">
            <label htmlFor="cf-active-repo" className="section-title block px-2.5">
              Active repository
            </label>
            <select
              id="cf-active-repo"
              value={selectedId ?? ''}
              onChange={(e) => selectRepository(e.target.value || null)}
              className="input py-1.5 text-xs"
            >
              {repositories.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav aria-label="Primary">
          {renderGroup('Workspace', MAIN_NAV)}
          {renderGroup('DevOps control', DEVOPS_NAV)}
          {renderGroup('System', BOTTOM_NAV)}
        </nav>
      </div>

      {!sidebarCollapsed && health && (
        <div className="shrink-0 space-y-2 border-t border-cf-border px-5 py-4">
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
      <span className="flex items-center gap-2 text-cf-muted">
        <span className={active ? 'status-dot-online' : 'status-dot bg-cf-faint/60'} />
        {active ? 'Connected' : 'Not configured'}
      </span>
    </div>
  );
}
