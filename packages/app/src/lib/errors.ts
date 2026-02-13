export function getErrorMessage(error: unknown, fallback = 'Unexpected error'): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const maybeMessage = 'message' in error ? error.message : undefined;
    const maybeDetails = 'details' in error ? error.details : undefined;
    const maybeHint = 'hint' in error ? error.hint : undefined;

    const parts = [maybeMessage, maybeDetails, maybeHint]
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean);

    if (parts.length > 0) {
      return parts.join(' — ');
    }
  }

  return fallback;
}
