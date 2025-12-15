/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelayMs = 1000, shouldRetry = () => true } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const shouldRetryThis = shouldRetry(error);

      if (isLastAttempt || !shouldRetryThis) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s, 8s, etc.
      const delay = initialDelayMs * Math.pow(2, attempt);
      console.log(`   🔄 Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new Error('Retry logic error');
}

/**
 * Determine if an error is retryable (transient)
 */
export function isRetryableError(error: any): boolean {
  const errorString = String(error).toLowerCase();
  const message = error?.message?.toLowerCase() || '';

  // Network errors
  if (
    errorString.includes('econnreset') ||
    errorString.includes('econnrefused') ||
    errorString.includes('etimedout') ||
    errorString.includes('timeout') ||
    errorString.includes('network')
  ) {
    return true;
  }

  // Rate limit errors
  if (errorString.includes('rate') || errorString.includes('429')) {
    return true;
  }

  // Server errors (5xx)
  if (errorString.includes('500') || errorString.includes('503') || errorString.includes('502')) {
    return true;
  }

  // OpenAI specific errors
  if (message.includes('overloaded') || message.includes('server_error')) {
    return true;
  }

  return false;
}
