import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildServerOAuthCallbackUrl,
  buildOAuthCallbackUrl,
  createBootstrapTimeoutGuard,
  hasUnresolvedEnvPlaceholder,
  isGoogleOAuthClientIdMisconfigured,
  isRetriableSessionError,
  normalizeBasePath,
  resolveServerAuthOrigin,
  shouldApplyBootstrapResult,
  withJitter,
} from '../src/hooks/session-utils.js';

function createFakeTimer() {
  let callback: (() => void) | undefined;
  let cleared = false;
  let lastDelay = -1;

  return {
    setTimeoutFn(cb: () => void, timeoutMs: number) {
      callback = cb;
      lastDelay = timeoutMs;
      return 1;
    },
    clearTimeoutFn() {
      cleared = true;
    },
    fire() {
      if (!cleared) {
        callback?.();
      }
    },
    getLastDelay() {
      return lastDelay;
    },
    wasCleared() {
      return cleared;
    },
  };
}

test('normalizeBasePath normalizes leading and trailing slash', () => {
  assert.equal(normalizeBasePath('/app'), '/app/');
  assert.equal(normalizeBasePath('app'), '/app/');
  assert.equal(normalizeBasePath('/'), '/');
  assert.equal(normalizeBasePath(''), '/');
});

test('buildOAuthCallbackUrl builds callback URL under app base path', () => {
  const callbackUrl = buildOAuthCallbackUrl('http://localhost:5173', '/app/');
  assert.equal(callbackUrl, 'http://localhost:5173/app/auth/callback');
});

test('buildOAuthCallbackUrl supports default root base path', () => {
  const callbackUrl = buildOAuthCallbackUrl('http://localhost:5173', '/');
  assert.equal(callbackUrl, 'http://localhost:5173/auth/callback');
});

test('buildServerOAuthCallbackUrl keeps returnTo in next query', () => {
  const callbackUrl = buildServerOAuthCallbackUrl(
    'http://localhost:3000',
    '/app/t/myspace/projects/123/backlog?view=board'
  );
  assert.equal(
    callbackUrl,
    'http://localhost:3000/auth/callback?next=%2Fapp%2Ft%2Fmyspace%2Fprojects%2F123%2Fbacklog%3Fview%3Dboard'
  );
});

test('resolveServerAuthOrigin uses configured callback origin when provided', () => {
  const resolved = resolveServerAuthOrigin('http://localhost:5173', 'http://localhost:3000/app');
  assert.equal(resolved, 'http://localhost:3000');
});

test('resolveServerAuthOrigin maps local vite origin to landing origin', () => {
  assert.equal(resolveServerAuthOrigin('http://localhost:5173'), 'http://localhost:3000');
  assert.equal(resolveServerAuthOrigin('http://127.0.0.1:5173'), 'http://127.0.0.1:3000');
});

test('resolveServerAuthOrigin keeps non-vite origin unchanged', () => {
  assert.equal(resolveServerAuthOrigin('http://localhost:3000'), 'http://localhost:3000');
  assert.equal(resolveServerAuthOrigin('https://8space.app'), 'https://8space.app');
});

test('hasUnresolvedEnvPlaceholder detects unresolved env() syntax', () => {
  assert.equal(hasUnresolvedEnvPlaceholder('env(GOOGLE_CLIENT_ID)'), true);
  assert.equal(hasUnresolvedEnvPlaceholder(' ENV(ANY_VAR) '), true);
  assert.equal(hasUnresolvedEnvPlaceholder('123.apps.googleusercontent.com'), false);
});

test('isGoogleOAuthClientIdMisconfigured detects placeholder client_id in oauth url', () => {
  assert.equal(
    isGoogleOAuthClientIdMisconfigured(
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=env%28GOOGLE_CLIENT_ID%29&scope=email'
    ),
    true
  );
  assert.equal(
    isGoogleOAuthClientIdMisconfigured(
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=your-google-client-id.apps.googleusercontent.com&scope=email'
    ),
    true
  );
  assert.equal(
    isGoogleOAuthClientIdMisconfigured(
      'https://accounts.google.com/o/oauth2/v2/auth?client_id=123.apps.googleusercontent.com&scope=email'
    ),
    false
  );
});

test('isRetriableSessionError detects network/timeout errors', () => {
  assert.equal(isRetriableSessionError(new Error('auth.getSession timed out after 1200ms')), true);
  assert.equal(isRetriableSessionError(new Error('Failed to fetch')), true);
  assert.equal(isRetriableSessionError(new Error('Not authenticated')), false);
});

test('withJitter returns delay within expected range', () => {
  const base = 1000;
  const delay = withJitter(base, () => 0.5);
  assert.equal(delay, 1100);
});

test('createBootstrapTimeoutGuard marks timed out and calls onTimedOut immediately', async () => {
  const timer = createFakeTimer();
  const calls: string[] = [];
  let resolveClear: (() => void) | undefined;

  const guard = createBootstrapTimeoutGuard({
    timeoutMs: 5000,
    setTimeoutFn: timer.setTimeoutFn,
    clearTimeoutFn: timer.clearTimeoutFn,
    onTimedOut: () => {
      calls.push('timedOut');
    },
    onClearStaleSession: () =>
      new Promise<void>((resolve) => {
        resolveClear = () => {
          calls.push('clearDone');
          resolve();
        };
      }),
  });

  assert.equal(guard.hasTimedOut(), false);
  assert.equal(timer.getLastDelay(), 5000);

  timer.fire();
  assert.equal(guard.hasTimedOut(), true);
  assert.deepEqual(calls, ['timedOut']);

  resolveClear?.();
  await Promise.resolve();
  assert.deepEqual(calls, ['timedOut', 'clearDone']);
});

test('createBootstrapTimeoutGuard routes clear-session errors to handler', async () => {
  const timer = createFakeTimer();
  const errors: unknown[] = [];

  createBootstrapTimeoutGuard({
    timeoutMs: 1000,
    setTimeoutFn: timer.setTimeoutFn,
    clearTimeoutFn: timer.clearTimeoutFn,
    onTimedOut: () => undefined,
    onClearStaleSession: async () => {
      throw new Error('clear failed');
    },
    onClearError: (error) => {
      errors.push(error);
    },
  });

  timer.fire();
  await Promise.resolve();

  assert.equal(errors.length, 1);
  assert.match((errors[0] as Error).message, /clear failed/);
});

test('createBootstrapTimeoutGuard cancel prevents timeout callback from firing', () => {
  const timer = createFakeTimer();
  let called = false;

  const guard = createBootstrapTimeoutGuard({
    timeoutMs: 1000,
    setTimeoutFn: timer.setTimeoutFn,
    clearTimeoutFn: timer.clearTimeoutFn,
    onTimedOut: () => {
      called = true;
    },
    onClearStaleSession: async () => undefined,
  });

  guard.cancel();
  timer.fire();

  assert.equal(timer.wasCleared(), true);
  assert.equal(called, false);
  assert.equal(guard.hasTimedOut(), false);
});

test('shouldApplyBootstrapResult returns true only for active non-timed-out state', () => {
  assert.equal(shouldApplyBootstrapResult(true, false), true);
  assert.equal(shouldApplyBootstrapResult(false, false), false);
  assert.equal(shouldApplyBootstrapResult(true, true), false);
  assert.equal(shouldApplyBootstrapResult(false, true), false);
});
