import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State { error: Error | null }

/**
 * Last line of defence: if a screen crashes, show what happened and a way out
 * instead of a blank window. Your files stay on the device either way.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Happy PDF screen crashed', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <main className="crash" role="alert">
        <div className="hp-card empty-state">
          <p className="empty-state__title">Something went wrong on this screen</p>
          <p className="empty-state__body">Nothing was uploaded. Reloading usually fixes it.</p>
          <code className="crash__detail">{error.name}: {error.message}</code>
          <button type="button" className="hp-btn hp-btn--filled" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </main>
    );
  }
}
