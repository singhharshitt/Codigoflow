import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors in a single page so the shell (sidebar, top bar) stays
 * usable. AppShell keys this by pathname, so navigating away resets it.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CódigoFlow] Page crashed', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="mx-auto mt-12 max-w-xl rounded-2xl border border-cf-border bg-cf-card p-6">
        <div className="flex items-center gap-2 text-cf-error">
          <AlertTriangle className="h-4 w-4" />
          <h1 className="text-base font-medium text-cf-text">This page failed to render</h1>
        </div>
        <p className="mt-2 text-sm text-cf-muted">
          The rest of CódigoFlow still works. Reload the page, or pick another section from the sidebar.
        </p>
        <pre className="code-block mt-4 max-h-40 whitespace-pre-wrap text-xs">{error.message}</pre>
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => this.setState({ error: null })}
        >
          <RotateCcw className="h-4 w-4" />
          Try again
        </button>
      </div>
    );
  }
}
