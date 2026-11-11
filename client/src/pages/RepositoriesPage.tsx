import { useEffect, useState } from 'react';
import { Plus, Trash2, FolderOpen, GitBranch, RefreshCw, ExternalLink } from 'lucide-react';
import { useRepoStore } from '../stores/repoStore';
import { LoadingSpinner, EmptyState, Alert, PageHeader } from '../components/ui';
import type { Repository } from '../types';

export function RepositoriesPage() {
  const { repositories, loading, error, fetchRepositories, addRepository, removeRepository, selectRepository, selectedId } = useRepoStore();

  const [showForm, setShowForm] = useState(false);
  const [formPath, setFormPath] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchRepositories(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formPath.trim()) { setFormError('Path is required'); return; }
    setFormError('');
    setSubmitting(true);
    try {
      await addRepository(formPath.trim(), formName.trim() || undefined, formDesc.trim() || undefined);
      setShowForm(false);
      setFormPath(''); setFormName(''); setFormDesc('');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to register repository');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string, name: string) {
    if (!window.confirm(`Remove "${name}" from CódigoFlow? (The files will not be deleted)`)) return;
    await removeRepository(id);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Repositories"
        description="Register and manage your Git repositories"
        action={
          <button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus className="w-4 h-4" />
            {showForm ? 'Cancel' : 'Register Repository'}
          </button>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      {/* Registration form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card space-y-4 animate-fade-in">
          <div className="text-sm font-semibold text-gray-200">Register Local Repository</div>
          {formError && <Alert variant="error">{formError}</Alert>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5" htmlFor="repo-path">
                Absolute Path *
              </label>
              <input
                id="repo-path"
                className="input"
                placeholder="e.g. D:\Projects\my-app"
                value={formPath}
                onChange={(e) => setFormPath(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5" htmlFor="repo-name">
                Display Name (optional)
              </label>
              <input
                id="repo-name"
                className="input"
                placeholder="Auto-detected from path"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1.5" htmlFor="repo-desc">
                Description (optional)
              </label>
              <input
                id="repo-desc"
                className="input"
                placeholder="Brief description of this repository"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? <><LoadingSpinner size="sm" /> Registering…</> : 'Register Repository'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Repository list */}
      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : repositories.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FolderOpen}
            title="No repositories registered"
            description="Register a local Git repository by providing its absolute path."
            action={
              <button onClick={() => setShowForm(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> Register Repository
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {repositories.map((repo) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              isSelected={repo.id === selectedId}
              onSelect={() => selectRepository(repo.id)}
              onRemove={() => handleRemove(repo.id, repo.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RepoCard({
  repo,
  isSelected,
  onSelect,
  onRemove,
}: {
  repo: Repository;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={`card cursor-pointer transition-all hover:border-brand-500/50 ${
        isSelected ? 'border-brand-500 bg-brand-500/5' : ''
      }`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      aria-label={`Select repository ${repo.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isSelected ? 'bg-brand-500' : 'bg-surface-3'
          }`}>
            <FolderOpen className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-100 truncate">{repo.name}</div>
            {repo.description && (
              <div className="text-xs text-gray-500 truncate">{repo.description}</div>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1.5 rounded hover:bg-red-500/10 hover:text-red-400 text-gray-500 transition-colors flex-shrink-0"
          title="Remove repository"
          aria-label={`Remove ${repo.name}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <GitBranch className="w-3 h-3" />
          <span className="font-mono truncate">{repo.path}</span>
        </div>
        {repo.remote_url && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <ExternalLink className="w-3 h-3" />
            <span className="truncate">{repo.remote_url}</span>
          </div>
        )}
        {repo.github_owner && (
          <div className="text-xs">
            <span className="badge-info">
              {repo.github_owner}/{repo.github_repo}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-surface-4 text-[10px] text-gray-600">
        Added {new Date(repo.created_at * 1000).toLocaleDateString()}
      </div>
    </div>
  );
}
