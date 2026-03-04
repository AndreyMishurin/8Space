export function normalizeBasePath(basePath: string | undefined): string {
  const raw = (basePath ?? '/').trim();
  if (!raw) {
    return '/';
  }

  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

export function buildOAuthCallbackUrl(origin: string, basePath: string | undefined): string {
  const normalizedBase = normalizeBasePath(basePath);
  return new URL(`${normalizedBase}auth/callback`, origin).toString();
}

export function buildServerOAuthCallbackUrl(origin: string, nextPath: string): string {
  const safeNextPath = nextPath.startsWith('/') ? nextPath : `/${nextPath}`;
  const callback = new URL('/auth/callback', origin);
  callback.searchParams.set('next', safeNextPath);
  return callback.toString();
}

export function resolveServerAuthOrigin(currentOrigin: string, configuredOrigin?: string): string {
  const configured = configuredOrigin?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      return configured;
    }
  }

  try {
    const url = new URL(currentOrigin);
    const isLocalDevHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (isLocalDevHost && url.port === '5173') {
      url.port = '3000';
      return url.origin;
    }
    return url.origin;
  } catch {
    return currentOrigin;
  }
}

export function hasUnresolvedEnvPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('env(') && normalized.endsWith(')');
}

export function isGoogleOAuthClientIdMisconfigured(oauthUrl: string): boolean {
  try {
    const clientId = new URL(oauthUrl).searchParams.get('client_id');
    if (!clientId) {
      return false;
    }
    const normalized = clientId.trim().toLowerCase();
    return hasUnresolvedEnvPlaceholder(clientId) || normalized.includes('your-google-client-id');
  } catch {
    return false;
  }
}

const RETRIABLE_SESSION_ERROR_MARKERS = [
  'timed out',
  'timeout',
  'network',
  'failed to fetch',
  'fetch',
  'abort',
  'offline',
];

export function isRetriableSessionError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
          ? error.message
          : '';

  const normalized = message.toLowerCase();
  return RETRIABLE_SESSION_ERROR_MARKERS.some((marker) => normalized.includes(marker));
}

export function withJitter(baseMs: number, random: () => number = Math.random): number {
  const jitterWindow = Math.max(1, Math.floor(baseMs * 0.2));
  const delta = Math.floor(random() * jitterWindow);
  return baseMs + delta;
}

type SetTimeoutFn = (callback: () => void, timeoutMs: number) => unknown;
type ClearTimeoutFn = (timeoutId: unknown) => void;

interface BootstrapTimeoutGuardOptions {
  timeoutMs: number;
  onTimedOut: () => void;
  onClearStaleSession: () => Promise<void>;
  onClearError?: (error: unknown) => void;
  setTimeoutFn?: SetTimeoutFn;
  clearTimeoutFn?: ClearTimeoutFn;
}

export interface BootstrapTimeoutGuard {
  hasTimedOut: () => boolean;
  cancel: () => void;
}

export function createBootstrapTimeoutGuard(options: BootstrapTimeoutGuardOptions): BootstrapTimeoutGuard {
  let timedOut = false;
  const setTimeoutFn = options.setTimeoutFn ?? ((callback, timeoutMs) => window.setTimeout(callback, timeoutMs));
  const clearTimeoutFn = options.clearTimeoutFn ?? ((timeoutId) => window.clearTimeout(timeoutId as number));

  const timeoutId = setTimeoutFn(() => {
    timedOut = true;
    options.onTimedOut();

    void options
      .onClearStaleSession()
      .catch((error) => options.onClearError?.(error));
  }, options.timeoutMs);

  return {
    hasTimedOut: () => timedOut,
    cancel: () => {
      clearTimeoutFn(timeoutId);
    },
  };
}

export function shouldApplyBootstrapResult(isActive: boolean, hasTimedOut: boolean): boolean {
  return isActive && !hasTimedOut;
}
