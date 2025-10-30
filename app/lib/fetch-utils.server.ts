/**
 * Shared utilities for API fetching with retry logic and timeout handling
 */

/**
 * Fetch with timeout support
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds
 * @returns Response object
 * @throws Error on timeout or network failure
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Sleep utility for retry delays
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize category names for consistent comparison
 * - Trims whitespace
 * - Normalizes case
 * - Handles common variations
 */
export function normalizeCategoryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

/**
 * Generic retry wrapper for fetch operations
 * @param fetchFn - Function to execute with retry logic
 * @param maxRetries - Maximum number of retry attempts
 * @param initialDelay - Initial delay in milliseconds (doubles on each retry)
 * @param logPrefix - Prefix for log messages
 * @returns Result from fetchFn
 * @throws Last error if all retries fail
 */
export async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  maxRetries: number,
  initialDelay: number,
  logPrefix: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`${logPrefix} Attempt ${attempt}/${maxRetries}`);
      return await fetchFn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.error(`${logPrefix} Attempt ${attempt} failed:`, lastError.message);

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.log(`${logPrefix} Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Unknown error');
}
