import { BookOpen, Github, Terminal, Shield } from 'lucide-react';
import { PageHeader, Card, Alert } from '../components/ui';
import { PageBackground, SpiderEmblem } from '../components/shared';

export function HelpPage() {
  return (
    <div className="page-shell relative">
      <PageBackground />
      <PageHeader
        title="Help & Documentation"
        description="Quick reference for running and extending CódigoFlow"
      />

      <div className="relative z-10 grid gap-4 md:grid-cols-2">
        <Card title="Getting started">
          <ol className="space-y-2 text-sm text-cf-muted list-decimal list-inside">
            <li>Run <code className="font-mono text-cf-cyan">npm install</code> at the repo root.</li>
            <li>Copy <code className="font-mono text-cf-cyan">server/.env.example</code> → <code className="font-mono">server/.env</code>.</li>
            <li>Start with <code className="font-mono text-cf-cyan">npm run dev</code>.</li>
            <li>Open <code className="font-mono text-cf-cyan">http://localhost:5173</code>.</li>
          </ol>
        </Card>

        <Card title="Core modules">
          <ul className="space-y-2 text-sm text-cf-muted">
            <li className="flex gap-2"><BookOpen className="w-4 h-4 text-cf-red mt-0.5" /> Overview & repositories</li>
            <li className="flex gap-2"><Terminal className="w-4 h-4 text-cf-cyan mt-0.5" /> Git Studio & Docker Manager</li>
            <li className="flex gap-2"><Github className="w-4 h-4 text-cf-royal mt-0.5" /> Contribution Explorer</li>
            <li className="flex gap-2"><Shield className="w-4 h-4 text-cf-violet mt-0.5" /> Settings & integration status</li>
          </ul>
        </Card>
      </div>

      <Alert variant="info" title="Secrets stay on the server" className="relative z-10">
        Never place API keys in <code className="font-mono">client/.env</code>. Configure AI and GitHub tokens only in <code className="font-mono">server/.env</code>.
      </Alert>

      <div className="relative z-10 flex items-center gap-3 text-xs text-cf-faint">
        <SpiderEmblem size={20} />
        See <code className="font-mono text-cf-muted">docs/api.md</code> and <code className="font-mono text-cf-muted">README.md</code> for full details.
      </div>
    </div>
  );
}
