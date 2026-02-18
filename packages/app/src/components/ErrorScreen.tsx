import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export type ErrorCode = 404 | 500 | 403 | 'generic';

interface ErrorScreenProps {
  code: ErrorCode;
  title?: string;
  message?: string;
  onRetry?: () => void;
  showGoHome?: boolean;
  /** Optional extra buttons (e.g. Sign out) */
  extraActions?: React.ReactNode;
  /** 'full' = full page (h-screen), 'inline' = fill parent (e.g. inside AppShell) */
  variant?: 'full' | 'inline';
}

const defaults: Record<ErrorCode, { title: string; message: string }> = {
  404: {
    title: 'Page not found',
    message: 'The page you are looking for does not exist or has been moved.',
  },
  500: {
    title: 'Server error',
    message: 'Something went wrong on our side. Please try again later.',
  },
  403: {
    title: 'Access denied',
    message: 'You do not have permission to view this resource.',
  },
  generic: {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
  },
};

export function ErrorScreen({
  code,
  title,
  message,
  onRetry,
  showGoHome = true,
  extraActions,
  variant = 'full',
}: ErrorScreenProps) {
  const { title: defaultTitle, message: defaultMessage } = defaults[code];
  const containerClass = variant === 'inline' ? 'min-h-[280px] h-full bg-background text-foreground grid place-items-center px-6' : 'h-screen bg-background text-foreground grid place-items-center px-6';

  return (
    <div className={containerClass}>
      <div className="w-full max-w-lg border border-border rounded-xl bg-card p-8 space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-mono text-muted-foreground">
            {typeof code === 'number' ? `Error ${code}` : 'Error'}
          </p>
          <h1 className="text-2xl font-semibold">{title ?? defaultTitle}</h1>
          <p className="text-sm text-muted-foreground">{message ?? defaultMessage}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {onRetry && (
            <Button onClick={onRetry}>Try again</Button>
          )}
          {showGoHome && (
            <Button variant="outline" asChild>
              <Link to="/">Go home</Link>
            </Button>
          )}
          {extraActions}
        </div>
      </div>
    </div>
  );
}
