import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  Trash2,
  Copy,
  CheckCircle,
  AlertTriangle,
  Container,
  GitCommit,
  MessageSquare,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { aiApi, dockerApi, repositoriesApi } from '../services/api';
import { useRepoStore } from '../stores/repoStore';
import { useAIStore, type CopilotMode } from '../stores/aiStore';
import {
  Alert,
  PageHeader,
  Button,
  Tabs,
  EmptyState,
  LoadingSpinner,
  Badge,
  Select,
} from '../components/ui';
import { PageBackground, SpiderEmblem } from '../components/shared';
import type { AIStatus, ContainerInfo } from '../types';

const SUGGESTIONS = [
  'How do I resolve a merge conflict in Git?',
  'Explain a failing Docker health check',
  'Write a conventional commit message strategy',
  'What does npm ERR! ERESOLVE mean?',
];

export function AICopilotPage() {
  const { selectedId, repositories } = useRepoStore();
  const { messages, mode, setMode, addMessage, clear } = useAIStore();
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [selectedContainer, setSelectedContainer] = useState('');
  const [commitSuggestions, setCommitSuggestions] = useState<string[]>([]);

  useEffect(() => {
    aiApi.status().then((res) => {
      if (res.success && res.data) setAiStatus(res.data);
    });
  }, []);

  useEffect(() => {
    if (mode === 'docker') {
      dockerApi.containers(true).then((res) => {
        if (res.success && res.data) setContainers(res.data);
      });
    }
  }, [mode]);

  const configured = aiStatus?.configured === true;

  const tabs = useMemo(
    () =>
      [
        { id: 'chat' as const, label: 'Assistant' },
        { id: 'commit' as const, label: 'Commit Messages' },
        { id: 'error' as const, label: 'Error Explainer' },
        { id: 'docker' as const, label: 'Docker Logs' },
      ] satisfies { id: CopilotMode; label: string }[],
    [],
  );

  async function handleSend() {
    if (!input.trim() || !configured) return;
    const prompt = input.trim();
    setInput('');
    addMessage({ role: 'user', content: prompt, mode });
    setLoading(true);

    try {
      if (mode === 'commit') {
        let diff = prompt;
        if (selectedId && !prompt.includes('diff --git')) {
          const diffRes = await repositoriesApi.diff(selectedId);
          if (diffRes.success && diffRes.data?.diff) diff = diffRes.data.diff;
        }
        if (!diff.trim()) {
          toast.error('No diff available. Paste a diff or stage changes in Git Studio.');
          setLoading(false);
          return;
        }
        const res = await aiApi.commitMessages(diff);
        if (!res.success || !res.data) {
          toast.error(res.error?.message ?? 'Commit message generation failed');
          addMessage({
            role: 'assistant',
            content: res.error?.message ?? 'Request failed',
            mode,
          });
        } else {
          setCommitSuggestions(res.data.messages ?? []);
          addMessage({
            role: 'assistant',
            content: (res.data.messages ?? []).map((m, i) => `${i + 1}. ${m}`).join('\n'),
            mode,
          });
        }
      } else if (mode === 'error') {
        const res = await aiApi.explainError(prompt);
        if (!res.success || !res.data) {
          toast.error(res.error?.message ?? 'Error explanation failed');
          addMessage({ role: 'assistant', content: res.error?.message ?? 'Request failed', mode });
        } else {
          const body = [
            res.data.explanation,
            '',
            '### Suggestions',
            ...(res.data.suggestions ?? []).map((s) => `- ${s}`),
          ].join('\n');
          addMessage({ role: 'assistant', content: body, mode });
        }
      } else if (mode === 'docker') {
        let logs = prompt;
        if (selectedContainer) {
          const logRes = await dockerApi.logs(selectedContainer, 200);
          if (logRes.success && logRes.data?.logs) logs = logRes.data.logs;
        }
        const res = await aiApi.analyzeDockerLogs(logs);
        if (!res.success || !res.data) {
          toast.error(res.error?.message ?? 'Log analysis failed');
          addMessage({ role: 'assistant', content: res.error?.message ?? 'Request failed', mode });
        } else {
          const d = res.data as {
            summary?: string;
            cause?: string;
            suggestions?: string[];
            likelyCauses?: string[];
            recommendations?: string[];
          };
          const body = [
            d.summary ?? '',
            d.cause ? `\n**Likely cause:** ${d.cause}` : '',
            d.likelyCauses?.length ? `\n### Likely causes\n${d.likelyCauses.map((c) => `- ${c}`).join('\n')}` : '',
            d.suggestions?.length || d.recommendations?.length
              ? `\n### Suggestions\n${(d.suggestions ?? d.recommendations ?? []).map((s) => `- ${s}`).join('\n')}`
              : '',
          ].join('');
          addMessage({ role: 'assistant', content: body, mode });
        }
      } else {
        const res = await aiApi.ask(prompt);
        if (!res.success || !res.data) {
          toast.error(res.error?.message ?? 'Assistant request failed');
          addMessage({ role: 'assistant', content: res.error?.message ?? 'Request failed', mode });
        } else {
          const answer =
            (res.data as { answer?: string }).answer ??
            (typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2));
          addMessage({ role: 'assistant', content: answer, mode });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(msg);
      addMessage({ role: 'assistant', content: msg, mode });
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text);
    toast.success('Copied');
  }

  return (
    <div className="page-shell relative">
      <PageBackground showWeb={false} />
      <PageHeader
        title="AI Developer Copilot"
        description="Commit help, error explanation, Docker log analysis, and general assistance — keyed on the server only"
        action={
          <Button variant="ghost" onClick={() => clear()}>
            <Trash2 className="w-4 h-4" /> Clear
          </Button>
        }
      />

      {!configured && (
        <Alert variant="warning" title="AI provider not configured" className="relative z-10">
          Set <code className="font-mono">AI_API_KEY</code> in <code className="font-mono">server/.env</code>.
          Responses are never fabricated when the provider is unavailable.
          {aiStatus?.model ? (
            <>
              {' '}
              Expected model: <code className="font-mono">{aiStatus.model}</code>
            </>
          ) : null}
        </Alert>
      )}

      {configured && (
        <div className="relative z-10 flex items-center gap-2 text-xs">
          <Badge variant="success">
            <CheckCircle className="w-3 h-3" /> Ready
          </Badge>
          <span className="text-cf-faint font-mono">{aiStatus?.model}</span>
        </div>
      )}

      <div className="relative z-10">
        <Tabs tabs={tabs} value={mode} onChange={setMode} />
      </div>

      <div className="relative z-10 grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-4">
        <div className="card flex flex-col min-h-[520px]">
          <div className="flex items-center gap-2 mb-4 border-b border-cf-border pb-3">
            <SpiderEmblem size={22} />
            <div className="text-sm font-semibold text-cf-text">Conversation</div>
            <Badge variant="violet">{mode}</Badge>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[420px] pr-1">
            {messages.length === 0 ? (
              <EmptyState
                icon={Bot}
                title="Start a conversation"
                description="Ask about Git, Docker, builds, or paste errors and diffs for analysis."
                action={
                  <div className="grid gap-2 max-w-md">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="card-sm text-left text-xs text-cf-muted hover:border-cf-cyan/40"
                        onClick={() => setInput(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                }
              />
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    m.role === 'user'
                      ? 'ml-8 rounded-lg border border-cf-border bg-cf-elevated/60 p-3'
                      : 'mr-8 rounded-lg border border-cf-violet/30 bg-cf-navy/70 p-3'
                  }
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-cf-faint">
                      {m.role === 'user' ? 'You' : 'Copilot'}
                    </span>
                    <button
                      type="button"
                      className="text-cf-faint hover:text-cf-cyan"
                      onClick={() => copyText(m.content)}
                      aria-label="Copy message"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="prose-invert text-sm text-cf-muted [&_pre]:bg-cf-navy [&_pre]:p-3 [&_pre]:rounded-lg [&_code]:font-mono [&_code]:text-cf-cyan">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex items-center gap-2 text-cf-cyan text-sm">
                <LoadingSpinner size="sm" /> Thinking…
              </div>
            )}
          </div>

          {mode === 'docker' && (
            <div className="mt-3">
              <Select
                label="Container (optional — loads live logs)"
                value={selectedContainer}
                onChange={(e) => setSelectedContainer(e.target.value)}
              >
                <option value="">Paste logs manually</option>
                {containers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.state})
                  </option>
                ))}
              </Select>
            </div>
          )}

          {mode === 'commit' && (
            <p className="mt-3 text-xs text-cf-faint">
              Uses pasted diff, or working-tree diff from{' '}
              <span className="font-mono text-cf-cyan">
                {repositories.find((r) => r.id === selectedId)?.name ?? 'selected repository'}
              </span>
              .
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <textarea
              className="input min-h-[88px] resize-y font-mono text-xs"
              placeholder={
                mode === 'commit'
                  ? 'Paste unified diff (or leave a note and use repo diff)…'
                  : mode === 'error'
                    ? 'Paste build/runtime error or stack trace…'
                    : mode === 'docker'
                      ? 'Paste Docker logs or select a container…'
                      : 'Ask a development question…'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!configured || loading}
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={handleSend} loading={loading} disabled={!configured || !input.trim()}>
              <Send className="w-4 h-4" /> Send
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card space-y-3">
            <div className="text-sm font-semibold text-cf-text flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cf-violet" /> Modes
            </div>
            <ModeHint icon={MessageSquare} title="Assistant" text="Git, Docker, builds, config" />
            <ModeHint icon={GitCommit} title="Commit messages" text="Three suggestions from a diff" />
            <ModeHint icon={AlertTriangle} title="Error explainer" text="Summary, cause, fixes" />
            <ModeHint icon={Container} title="Docker logs" text="Failure analysis from logs" />
          </div>

          {commitSuggestions.length > 0 && (
            <div className="card space-y-2">
              <div className="text-sm font-semibold text-cf-text">Commit suggestions</div>
              {commitSuggestions.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="w-full text-left card-sm font-mono text-xs hover:border-cf-cyan/40"
                  onClick={() => copyText(m)}
                >
                  {m}
                </button>
              ))}
              <p className="text-[10px] text-cf-faint">Copy a message, then paste it in Git Studio.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeHint({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-2 text-xs">
      <Icon className="w-4 h-4 text-cf-cyan flex-shrink-0 mt-0.5" />
      <div>
        <div className="text-cf-text font-medium">{title}</div>
        <div className="text-cf-faint">{text}</div>
      </div>
    </div>
  );
}
