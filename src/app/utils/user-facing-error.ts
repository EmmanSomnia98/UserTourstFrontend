type FriendlyErrorOptions = {
  action?: string;
  fallback?: string;
};

function extractStatusCode(message: string): number | null {
  const match = message.match(/\((\d{3})\)/);
  if (!match) return null;
  const code = Number.parseInt(match[1], 10);
  return Number.isFinite(code) ? code : null;
}

export function toUserFacingErrorMessage(
  error: unknown,
  options: FriendlyErrorOptions = {}
): string {
  const fallback = options.fallback ?? 'Something went wrong. Please try again.';
  const action = options.action ?? 'continue';
  const rawMessage = error instanceof Error ? error.message : String(error ?? '');
  const message = rawMessage.trim();

  if (!message) return fallback;

  const normalized = message.toLowerCase();
  const status = extractStatusCode(message);

  if (status === 401 || status === 403) {
    return 'Your session expired. Please sign in again.';
  }
  if (status === 404) {
    return `We couldn't complete this request right now. Please try again in a moment.`;
  }
  if (status === 409 || normalized.includes('already responded')) {
    return 'This request was already handled.';
  }
  if (status === 400 || status === 422) {
    return `Some details are invalid, so we couldn't ${action}. Please review your input and try again.`;
  }
  if (status === 429) {
    return 'Too many requests right now. Please wait a moment and try again.';
  }
  if (status !== null && status >= 500) {
    return `Our server is having trouble right now, so we couldn't ${action}. Please try again shortly.`;
  }

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('load failed') ||
    normalized.includes('network request failed')
  ) {
    return `We couldn't reach the server, so we couldn't ${action}. Please check your internet connection and try again.`;
  }

  if (
    normalized.includes('unauthorized') ||
    normalized.includes('invalid token') ||
    normalized.includes('jwt') ||
    normalized.includes('forbidden')
  ) {
    return 'Your session expired. Please sign in again.';
  }

  if (
    normalized.startsWith('request failed') ||
    normalized.includes('syntaxerror') ||
    normalized.includes('typeerror') ||
    normalized.includes('referenceerror')
  ) {
    return fallback;
  }

  return message;
}
