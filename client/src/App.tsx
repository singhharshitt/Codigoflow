import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { OverviewPage } from './pages/OverviewPage';
import { RepositoriesPage } from './pages/RepositoriesPage';
import { GitStudioPage } from './pages/GitStudioPage';
import { DockerManagerPage } from './pages/DockerManagerPage';
import { AICopilotPage } from './pages/AICopilotPage';
import { ContributionExplorerPage } from './pages/ContributionExplorerPage';
import { ExecutionHistoryPage } from './pages/ExecutionHistoryPage';
import { WorkflowBuilderPage } from './pages/WorkflowBuilderPage';
import { SettingsPage } from './pages/SettingsPage';
import { HelpPage } from './pages/HelpPage';
import { useAppStore } from './stores/appStore';
import { useRepoStore } from './stores/repoStore';

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
          <Route index element={<OverviewPage />} />
          <Route path="repositories" element={<RepositoriesPage />} />
          <Route path="git" element={<GitStudioPage />} />
          <Route path="docker" element={<DockerManagerPage />} />
          <Route path="ai" element={<AICopilotPage />} />
          <Route path="contributions" element={<ContributionExplorerPage />} />
          <Route path="workflow" element={<WorkflowBuilderPage />} />
          <Route path="history" element={<ExecutionHistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="help" element={<HelpPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
