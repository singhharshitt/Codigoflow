import { useEffect, useState, useCallback } from 'react';
import {
  GitBranch, GitCommit, CheckSquare, Square, RefreshCw,
  ArrowUpRight, FileCode, AlertCircle, Send
} from 'lucide-react';
import { useRepoStore } from '../stores/repoStore';
import { repositoriesApi, aiApi } from '../services/api';
import { LoadingSpinner, EmptyState, Alert, PageHeader } from '../components/ui';
import type { RepoStatus, CommitEntry, BranchInfo } from '../types';

export function GitStudioPage() {
  const { selectedId, repositories } = useRepoStore();
  const selectedRepo = repositories.find((r) => r.id === selectedId);

  const [status, setStatus] = useState<RepoStatus | null>(null);
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [diff, setDiff] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [commitMsg, setCommitMsg] = useState('');
  const [aiMessages, setAiMessages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [staging, setStaging] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [opError, setOpError] = useState('');
  const [opSuccess, setOpSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'changes' | 'commits' | 'branches'>('changes');

  const loadAll = useCallback(async () => {
    if (!selectedId) { setLoading(false); return; }
    setLoading(true);
    const [s, c, b] = await Promise.allSettled([
      repositoriesApi.status(selectedId),
      repositoriesApi.commits(selectedId, 30),
      repositoriesApi.branches(selectedId),
    ]);
    if (s.status === 'fulfilled' && s.value.success) setStatus(s.value.data as RepoStatus);
    if (c.status === 'fulfilled' && c.value.success) setCommits(c.value.data as CommitEntry[]);
    if (b.status === 'fulfilled' && b.value.success) setBranches(b.value.data as BranchInfo[]);
    setLoading(false);
  }, [selectedId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function loadDiff(file?: string) {
    if (!selectedId) return;
    const res = await repositoriesApi.diff(selectedId, file);
    if (res.success && res.data) setDiff((res.data as { diff: string }).diff);
  }

  function toggleFile(file: string) {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file); else next.add(file);
      return next;
    });
  }

  async function handleStage() {
    if (!selectedId || selectedFiles.size === 0) return;
    setStaging(true); setOpError(''); setOpSuccess('');
    const res = await repositoriesApi.stage(selectedId, Array.from(selectedFiles));
    setStaging(false);
    if (res.success) {
      setOpSuccess('Files staged successfully');
      setSelectedFiles(new Set());
      loadAll();
    } else {
      setOpError(res.error?.message ?? 'Stage failed');
    }
  }

  async function handleCommit() {
    if (!selectedId || !commitMsg.trim()) return;
    setCommitting(true); setOpError(''); setOpSuccess('');
    const res = await repositoriesApi.commit(selectedId, commitMsg);
    setCommitting(false);
    if (res.success) {
      setOpSuccess('Committed successfully');
      setCommitMsg('');
      loadAll();
    } else {
      setOpError(res.error?.message ?? 'Commit failed');
    }
  }

  async function handleAIMessages() {
    if (!selectedId) return;
    setAiLoading(true); setAiMessages([]);
    const diffRes = await repositoriesApi.diff(selectedId);
    if (!diffRes.success || !(diffRes.data as { diff: string }).diff) {
      setAiMessages([]);
      setAiLoading(false);
      return;
    }
    const aiRes = await aiApi.commitMessages((diffRes.data as { diff: string }).diff);
    setAiLoading(false);
    if (aiRes.success && aiRes.data) {
      setAiMessages((aiRes.data as { messages: string[] }).messages);
    }
  }

  if (!selectedId) {
    return (
      <div className="card mt-4">
        <EmptyState icon={GitBranch} title="No repository selected" description="Select a repository from the sidebar to use Git Studio." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Git Studio"
        description={selectedRepo ? `Working on: ${selectedRepo.name}` : 'Git operations'}
        action={
          <button onClick={() => loadAll()} className="btn-secondary">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      {opError && <Alert variant="error">{opError}</Alert>}
      {opSuccess && <Alert variant="success">{opSuccess}</Alert>}

      {loading ? (
        <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel — file changes */}
          <div className="lg:col-span-1 space-y-4">
            {/* Tab bar */}
            <div className="flex gap-1 bg-surface-2 p-1 rounded-lg">
              {(['changes', 'commits', 'branches'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-xs py-1.5 rounded-md capitalize transition-colors ${
                    activeTab === tab
                      ? 'bg-surface-4 text-gray-100 font-medium'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'changes' && status && (
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-200">
                    Branch: <span className="text-brand-400 font-mono">{status.branch}</span>
                  </div>
                  {status.ahead > 0 && (
                    <span className="badge-info">{status.ahead} ahead</span>
                  )}
                </div>

                {[
                  { label: 'Staged', files: status.staged, color: 'text-green-400' },
                  { label: 'Modified', files: status.unstaged, color: 'text-yellow-400' },
                  { label: 'Untracked', files: status.untracked, color: 'text-gray-500' },
                ].map(({ label, files, color }) =>
                  files.length > 0 && (
                    <div key={label}>
                      <div className={`text-[10px] font-semibold uppercase tracking-wider ${color} mb-1`}>
                        {label} ({files.length})
                      </div>
                      {files.map((f) => (
                        <div
                          key={f}
                          className="flex items-center gap-2 py-1 px-2 rounded hover:bg-surface-2 cursor-pointer group"
                          onClick={() => { toggleFile(f); loadDiff(f); }}
                        >
                          {selectedFiles.has(f) ? (
                            <CheckSquare className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 flex-shrink-0" />
                          )}
                          <span className="font-mono text-[11px] text-gray-300 truncate">{f}</span>
                        </div>
                      ))}
                    </div>
                  )
                )}

                {status.staged.length + status.unstaged.length + status.untracked.length === 0 && (
                  <div className="text-xs text-gray-500 text-center py-4">
                    Working tree clean
                  </div>
                )}
              </div>
            )}

            {activeTab === 'commits' && (
              <div className="card space-y-2 max-h-96 overflow-y-auto">
                {commits.map((c) => (
                  <div key={c.hash} className="p-2 hover:bg-surface-2 rounded-lg transition-colors">
                    <div className="text-xs text-gray-200 mb-0.5 line-clamp-2">{c.message}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{c.shortHash} · {c.author}</div>
                    <div className="flex gap-2 mt-0.5">
                      {c.insertions > 0 && <span className="text-[10px] text-green-400">+{c.insertions}</span>}
                      {c.deletions > 0 && <span className="text-[10px] text-red-400">-{c.deletions}</span>}
                    </div>
                  </div>
                ))}
                {commits.length === 0 && <EmptyState icon={GitCommit} title="No commits" />}
              </div>
            )}

            {activeTab === 'branches' && (
              <div className="card space-y-1">
                {branches.map((b) => (
                  <div key={b.name} className={`flex items-center justify-between p-2 rounded-lg ${b.current ? 'bg-surface-3' : 'hover:bg-surface-2'}`}>
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-3.5 h-3.5 text-gray-400" />
                      <span className="font-mono text-xs text-gray-200">{b.name}</span>
                    </div>
                    {b.current && <span className="badge-success">current</span>}
                  </div>
                ))}
                {branches.length === 0 && <EmptyState icon={GitBranch} title="No branches" />}
              </div>
            )}
          </div>

          {/* Right panel — diff + commit */}
          <div className="lg:col-span-2 space-y-4">
            {/* Diff viewer */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-200 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-gray-400" />
                  Diff Viewer
                </div>
                <button
                  onClick={() => loadDiff()}
                  className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
                >
                  <ArrowUpRight className="w-3 h-3" /> Full diff
                </button>
              </div>
              {diff ? (
                <pre className="code-block text-[11px] max-h-72 overflow-auto">
                  {diff.split('\n').map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.startsWith('+') && !line.startsWith('+++') ? 'text-green-400' :
                        line.startsWith('-') && !line.startsWith('---') ? 'text-red-400' :
                        line.startsWith('@@') ? 'text-cyan-400' : ''
                      }
                    >
                      {line}
                    </div>
                  ))}
                </pre>
              ) : (
                <div className="text-xs text-gray-500 text-center py-8">
                  Click a file to view its diff
                </div>
              )}
            </div>

            {/* Stage & Commit */}
            <div className="card space-y-4">
              <div className="text-sm font-semibold text-gray-200">Stage & Commit</div>

              <div className="flex gap-3">
                <button
                  onClick={handleStage}
                  disabled={selectedFiles.size === 0 || staging}
                  className="btn-secondary"
                >
                  {staging ? <LoadingSpinner size="sm" /> : <CheckSquare className="w-4 h-4" />}
                  Stage ({selectedFiles.size}) files
                </button>
              </div>

              {/* AI commit messages */}
              <div>
                <button
                  onClick={handleAIMessages}
                  disabled={aiLoading}
                  className="btn-ghost text-xs text-violet-400 hover:text-violet-300"
                >
                  {aiLoading ? <LoadingSpinner size="sm" /> : '✨'}
                  Generate commit messages with AI
                </button>

                {aiMessages.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {aiMessages.map((msg, i) => (
                      <button
                        key={i}
                        onClick={() => setCommitMsg(msg)}
                        className="w-full text-left text-xs p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 hover:bg-violet-500/20 text-gray-200 transition-colors"
                      >
                        {msg}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Commit Message</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Enter a descriptive commit message…"
                  value={commitMsg}
                  onChange={(e) => setCommitMsg(e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCommit}
                  disabled={!commitMsg.trim() || committing}
                  className="btn-primary"
                >
                  {committing ? <LoadingSpinner size="sm" /> : <Send className="w-4 h-4" />}
                  Commit Changes
                </button>
              </div>

              <div className="text-[10px] text-gray-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Push must be triggered separately from the push button after reviewing your commit.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
