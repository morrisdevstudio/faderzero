import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/ui/components/Button';

type Props = { children: ReactNode; onRetry?: () => void };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Les données IndexedDB sont préservées jusqu'au rechargement demandé par la personne.
  }

  handleRetry = (): void => {
    if (this.props.onRetry) {
      this.props.onRetry();
      return;
    }
    window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-fz-text">Impossible d’afficher cette page</h1>
          <p className="text-sm text-fz-text-muted">Vos données locales sont conservées. Réessayez de lancer l’application.</p>
        </div>
        <Button variant="primary" onClick={this.handleRetry}>Réessayer</Button>
      </main>
    );
  }
}
