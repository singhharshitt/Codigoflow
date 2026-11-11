import { useState, useEffect } from 'react';
import { Bot, Sparkles, AlertCircle, Send, Loader2, CheckCircle } from 'lucide-react';
import { aiApi } from '../services/api';
import { useAppStore } from '../stores/appStore';
import { Alert, PageHeader } from '../components/ui';
import type { AIStatus } from '../types';

type AITool = 'commit' | 'error' | 'docker' | 'ask';

const TOOLS: { id: AITool; label: string; icon: string; desc: string; placeholder: string }[] = [
  { id: 'commit', label: 'Commit Messages', icon: '✨', desc: 'Paste a diff to generate 3 commit messages', placeholder: 'Paste your git diff here…' },
  { id: 'error',  label: 'Error Explainer', icon: '🔍', desc: 'Explain a build error or stack trace', placeholder: 'Paste the error message or stack trace here…' },
  { id: 'docker', label: 'Docker Log Analyzer', icon: '🐳', desc: 'Analyze container logs for failures', placeholder: 'Paste container logs here…' },
  { id: 'ask',    label: 'Code Assistant', icon: '💬', desc: 'Ask any development question', placeholder: 'What would you like help with?' },
];

export function AICopilotPage() {
  const { health } = useAppStore();
  const [aiStatus, setAiStatus] = useState<AIStatus | null>(null);
  const [activeTool, setActiveTool] = useState<AITool>('ask');
  const [input, setInput] = useState('');
  const [codeContext, setCodeContext] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    aiApi.status().then((res) => {
      if (res.success && res.data) setAiStatus(res.data as AIStatus);
    });
  }, []);

  async function handleSubmit() {
    if (!input.trim()) return;
    setLoading(true); setError(''); setResult(null);

    try {
      let res;
      switch (activeTool) {
        case 'commit': res = await aiApi.commitMessages(input); break;
        case 'error':  res = await aiApi.explainError(input); break;
        case 'docker': res = await aiApi.analyzeDockerLogs(input); break;
        case 'ask':    res = await aiApi.ask(input, codeContext || undefined); break;
      }
      if (res?.success) setResult(res.data);
      else setError(res?.error?.message ?? 'AI request failed');
    } catch (e) {
      setError(String(e));
    }

    setLoading(false);
  }

  const currentTool = TOOLS.find((t) => t.id === activeTool)!;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="AI Copilot"
        description="AI-powered development assistance"
      />

      {aiStatus && !aiStatus.configured && (
        <Alert variant="warning" title="AI not configured">
          Set <code className="font-mono bg-surface-3 px-1 rounded">AI_API_KEY</code> in your server environment to enable AI features.
          The current model is <code className="font-mono bg-surface-3 px-1 rounded">{aiStatus.model}</code>.
        </Alert>
      )}

      {aiStatus?.configured && (
        <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 w-fit">
          <CheckCircle className="w-3.5 h-3.5" />
          AI ready · Model: <span className="font-mono">{aiStatus.model}</span>
        </div>
      )}

      {/* Tool selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => { setActiveTool(tool.id); setResult(null); setError(''); }}
            className={`card-sm text-left transition-all ${
              activeTool === tool.id
                ? 'border-violet-500 bg-violet-500/10'
                : 'hover:border-surface-5 hover:bg-surface-2'
            }`}
          >
            <div className="text-lg mb-1">{tool.icon}</div>
            <div className="text-xs font-medium text-gray-200">{tool.label}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{tool.desc}</div>
          </button>
        ))}
      </div>

      {/* Input area */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-gray-200">{currentTool.label}</span>
        </div>

        <textarea
          className="input resize-none font-mono text-xs"
          rows={8}
          placeholder={currentTool.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading || !aiStatus?.configured}
        />

        {activeTool === 'ask' && (
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Code Context (optional)</label>
            <textarea
              className="input resize-none font-mono text-xs"
              rows={4}
              placeholder="Paste relevant code here for more accurate answers…"
              value={codeContext}
              onChange={(e) => setCodeContext(e.target.value)}
              disabled={loading || !aiStatus?.configured}
            />
          </div>
        )}

        {error && <Alert variant="error">{error}</Alert>}

        <button
          onClick={handleSubmit}
          disabled={loading || !aiStatus?.configured || !input.trim()}
          className="btn-primary"
          id="ai-submit-btn"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
          ) : (
            <><Send className="w-4 h-4" /> Submit</>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="card animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-gray-200">AI Response</span>
          </div>
          <AIResult tool={activeTool} data={result} />
        </div>
      )}
    </div>
  );
}

function AIResult({ tool, data }: { tool: AITool; data: unknown }) {
  if (tool === 'commit') {
    const msgs = (data as { messages: string[] }).messages ?? [];
    return (
      <div className="space-y-2">
        {msgs.map((m, i) => (
          <div key={i} className="p-3 bg-surface-2 rounded-lg border border-surface-4 font-mono text-sm text-gray-200">
            {m}
          </div>
        ))}
      </div>
    );
  }

  if (tool === 'error') {
    const d = data as { explanation: string; suggestions: string[] };
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-200">{d.explanation}</div>
        {d.suggestions.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 mb-2">Suggestions:</div>
            <ul className="space-y-1">
              {d.suggestions.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-300">
                  <span className="text-brand-400">→</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (tool === 'docker') {
    const d = data as { summary: string; likelyCauses: string[]; recommendations: string[] };
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-200">{d.summary}</div>
        {d.likelyCauses.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-yellow-400 mb-1">Likely Causes:</div>
            {d.likelyCauses.map((c, i) => <div key={i} className="text-sm text-gray-300">• {c}</div>)}
          </div>
        )}
        {d.recommendations.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-cyan-400 mb-1">Recommendations:</div>
            {d.recommendations.map((r, i) => <div key={i} className="text-sm text-gray-300">→ {r}</div>)}
          </div>
        )}
      </div>
    );
  }

  // ask
  return <div className="text-sm text-gray-200 whitespace-pre-wrap">{(data as { answer: string }).answer}</div>;
}
