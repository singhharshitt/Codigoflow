import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { LoadingSpinner } from './components/ui';
import { useAppStore } from './stores/appStore';
import { useRepoStore } from './stores/repoStore';

const OverviewPage = lazy(() =>
  import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })),
);
const RepositoriesPage = lazy(() =>
  import('./pages/RepositoriesPage').then((m) => ({ default: m.RepositoriesPage })),
);
const GitStudioPage = lazy(() =>
  import('./pages/GitStudioPage').then((m) => ({ default: m.GitStudioPage })),
);
const DockerManagerPage = lazy(() =>
  import('./pages/DockerManagerPage').then((m) => ({ default: m.DockerManagerPage })),
);
const AICopilotPage = lazy(() =>
  import('./pages/AICopilotPage').then((m) => ({ default: m.AICopilotPage })),
);
const ContributionExplorerPage = lazy(() =>
  import('./pages/ContributionExplorerPage').then((m) => ({
    default: m.ContributionExplorerPage,
  })),
);
const WorkflowBuilderPage = lazy(() =>
  import('./pages/WorkflowBuilderPage').then((m) => ({ default: m.WorkflowBuilderPage })),
);
const ExecutionHistoryPage = lazy(() =>
  import('./pages/ExecutionHistoryPage').then((m) => ({ default: m.ExecutionHistoryPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const HelpPage = lazy(() => import('./pages/HelpPage').then((m) => ({ default: m.HelpPage })));
const DevOpsOverviewPage = lazy(() =>
  import('./pages/devops/DevOpsOverviewPage').then((m) => ({ default: m.DevOpsOverviewPage })),
);
const TerraformPage = lazy(() =>
  import('./pages/devops/TerraformPage').then((m) => ({ default: m.TerraformPage })),
);
const AnsiblePage = lazy(() =>
  import('./pages/devops/AnsiblePage').then((m) => ({ default: m.AnsiblePage })),
);
const PuppetPage = lazy(() =>
  import('./pages/devops/PuppetPage').then((m) => ({ default: m.PuppetPage })),
);
const NagiosPage = lazy(() =>
  import('./pages/devops/NagiosPage').then((m) => ({ default: m.NagiosPage })),
);
const LabEnvironmentPage = lazy(() =>
  import('./pages/devops/LabEnvironmentPage').then((m) => ({ default: m.LabEnvironmentPage })),
);

function PageFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" />
    </div>
  );
}

export default function App() {
  const { fetchHealth } = useAppStore();
  const { fetchRepositories } = useRepoStore();

  useEffect(() => {
    fetchHealth();
    fetchRepositories();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth, fetchRepositories]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route
            index
            element={
              <Suspense fallback={<PageFallback />}>
                <OverviewPage />
              </Suspense>
            }
          />
          <Route
            path="repositories"
            element={
              <Suspense fallback={<PageFallback />}>
                <RepositoriesPage />
              </Suspense>
            }
          />
          <Route
            path="git"
            element={
              <Suspense fallback={<PageFallback />}>
                <GitStudioPage />
              </Suspense>
            }
          />
          <Route
            path="docker"
            element={
              <Suspense fallback={<PageFallback />}>
                <DockerManagerPage />
              </Suspense>
            }
          />
          <Route
            path="ai"
            element={
              <Suspense fallback={<PageFallback />}>
                <AICopilotPage />
              </Suspense>
            }
          />
          <Route
            path="contributions"
            element={
              <Suspense fallback={<PageFallback />}>
                <ContributionExplorerPage />
              </Suspense>
            }
          />
          <Route
            path="workflow"
            element={
              <Suspense fallback={<PageFallback />}>
                <WorkflowBuilderPage />
              </Suspense>
            }
          />
          <Route
            path="history"
            element={
              <Suspense fallback={<PageFallback />}>
                <ExecutionHistoryPage />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<PageFallback />}>
                <SettingsPage />
              </Suspense>
            }
          />
          <Route
            path="help"
            element={
              <Suspense fallback={<PageFallback />}>
                <HelpPage />
              </Suspense>
            }
          />
          <Route
            path="devops"
            element={
              <Suspense fallback={<PageFallback />}>
                <DevOpsOverviewPage />
              </Suspense>
            }
          />
          <Route
            path="devops/terraform"
            element={
              <Suspense fallback={<PageFallback />}>
                <TerraformPage />
              </Suspense>
            }
          />
          <Route
            path="devops/ansible"
            element={
              <Suspense fallback={<PageFallback />}>
                <AnsiblePage />
              </Suspense>
            }
          />
          <Route
            path="devops/puppet"
            element={
              <Suspense fallback={<PageFallback />}>
                <PuppetPage />
              </Suspense>
            }
          />
          <Route
            path="devops/nagios"
            element={
              <Suspense fallback={<PageFallback />}>
                <NagiosPage />
              </Suspense>
            }
          />
          <Route
            path="devops/lab"
            element={
              <Suspense fallback={<PageFallback />}>
                <LabEnvironmentPage />
              </Suspense>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
