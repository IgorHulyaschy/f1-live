/** What an error answer may carry besides its code and message. */
export type HttpErrorExtra = { field?: string; limit?: number; handle?: string };

/** An answer the accounts API gives on purpose: the status, a code to branch on, and a message. */
export class HttpError extends Error {
	readonly status: number;
	readonly code: string;
	readonly extra: HttpErrorExtra;

	constructor(status: number, code: string, message: string, extra: HttpErrorExtra = {}) {
		super(message);
		this.status = status;
		this.code = code;
		this.extra = extra;
	}
}
