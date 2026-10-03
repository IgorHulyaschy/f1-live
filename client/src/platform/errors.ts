/**
 * Crash reports behind one interface, so the provider is a configuration choice. Plan 4 asks for
 * error reporting (Sentry or similar) before the first paid sign-up; until the owner picks one,
 * development builds print reports and production builds leave them to the browser's own log.
 */

export type ErrorSource = 'render' | 'window' | 'promise';

export type ErrorContext = { source: ErrorSource; path: string };

export type ErrorReporter = {
	capture: (cause: unknown, context: ErrorContext) => void;
};

export const silentReporter: ErrorReporter = { capture: () => undefined };

export const consoleReporter: ErrorReporter = {
	capture: (cause, context) => console.error(`[${context.source}] ${context.path}`, cause)
};

/** Uncaught errors and rejections anywhere on the page, including React's uncaught render errors. */
export function reportUncaughtErrors(target: Window, reporter: ErrorReporter): () => void {
	const onError = (event: ErrorEvent) =>
		reporter.capture(event.error ?? event.message, {
			source: 'window',
			path: target.location.pathname
		});

	const onRejection = (event: PromiseRejectionEvent) =>
		reporter.capture(event.reason, { source: 'promise', path: target.location.pathname });

	target.addEventListener('error', onError);
	target.addEventListener('unhandledrejection', onRejection);

	return () => {
		target.removeEventListener('error', onError);
		target.removeEventListener('unhandledrejection', onRejection);
	};
}

/**
 * A script chunk that no longer exists on the server: the app was open across a deploy. Reloading
 * fetches the new version, so the error screen says that instead of "something broke".
 */
export function isStaleChunk(cause: unknown): boolean {
	return (
		cause instanceof Error &&
		/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
			cause.message
		)
	);
}
