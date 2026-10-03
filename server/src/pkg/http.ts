import { setTimeout as sleep } from 'node:timers/promises';

export interface RetryPolicy {
	/** Tries in all, the first included. */
	attempts: number;
	/** The wait after the first failure; it doubles after each one. */
	baseDelayMs: number;
}

export const POLITE_RETRY: RetryPolicy = { attempts: 5, baseDelayMs: 1000 };

/** A stalled connection or body fails after this and is tried again. */
const REQUEST_TIMEOUT_MS = 120_000;

/** Statuses worth another try: the server is busy or limiting us. */
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

/** The wait a `Retry-After` header asks for, in milliseconds; null when absent or a date. */
function retryAfterMs(response: Response): number | null {
	const seconds = Number(response.headers.get('retry-after'));

	return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

/**
 * GET that retries network errors and busy or limiting responses, waiting longer each time and
 * as long as `Retry-After` asks. Any other response comes back for the caller to judge;
 * after the last try it throws.
 */
export async function fetchPolitely(
	url: string,
	policy: RetryPolicy = POLITE_RETRY,
	wait: (ms: number) => Promise<void> = sleep
): Promise<Response> {
	let failure = '';

	for (let attempt = 1; attempt <= policy.attempts; attempt += 1) {
		let delayMs = policy.baseDelayMs * 2 ** (attempt - 1);

		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

			if (!RETRYABLE.has(response.status)) {
				return response;
			}

			failure = `status ${response.status}`;
			delayMs = retryAfterMs(response) ?? delayMs;
			await response.body?.cancel();
		} catch (error) {
			failure = error instanceof Error ? error.message : String(error);
		}

		if (attempt < policy.attempts) {
			await wait(delayMs);
		}
	}

	throw new Error(`GET ${url} failed after ${policy.attempts} tries: ${failure}`);
}

/** Runs `work` over `items`, at most `limit` at a time; results keep the order of `items`. */
export async function mapLimited<T, R>(
	items: readonly T[],
	limit: number,
	work: (item: T) => Promise<R>
): Promise<R[]> {
	const results: R[] = [];
	const queue = items.entries();

	async function worker(): Promise<void> {
		for (const [index, item] of queue) {
			results[index] = await work(item);
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

	return results;
}
