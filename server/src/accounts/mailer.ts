import { createTransport, type Transporter } from 'nodemailer';

import { escapeHtml } from '../payments/fake-pages.js';
import type { EventLog } from '../sources/f1/live.js';

export type MailMessage = { to: string; subject: string; text: string; html: string };

/** Sends email. SMTP covers most providers (Postmark, Resend, SES, Mailgun) with only a URL. */
export interface Mailer {
	send(message: MailMessage): Promise<void>;
}

/**
 * Development mail: prints each message to the terminal and keeps the last link per address, so
 * tests and a local run can sign in with no email account.
 */
export class ConsoleMailer implements Mailer {
	private readonly lastLinks = new Map<string, string>();
	private readonly log: EventLog;

	constructor(log: EventLog) {
		this.log = log;
	}

	async send(message: MailMessage): Promise<void> {
		const link = message.text.match(/https?:\/\/\S+/)?.[0] ?? null;

		if (link) {
			this.lastLinks.set(message.to.toLowerCase(), link);
		}

		this.log('mail', { to: message.to, subject: message.subject, link });
	}

	lastLink(to: string): string | null {
		return this.lastLinks.get(to.toLowerCase()) ?? null;
	}
}

export class SmtpMailer implements Mailer {
	private readonly transport: Transporter;
	private readonly from: string;

	constructor(smtpUrl: string, from: string) {
		this.transport = createTransport(smtpUrl);
		this.from = from;
	}

	async send(message: MailMessage): Promise<void> {
		await this.transport.sendMail({ from: this.from, ...message });
	}
}

/** The sign-in email: one link, what it does, and what to do if it was not you. */
export function signInMessage(brand: string, to: string, url: string): MailMessage {
	return {
		to,
		subject: `Sign in to ${brand}`,
		text: [
			`Open this link to sign in to ${brand}:`,
			'',
			url,
			'',
			'It works once, for the next 5 minutes. If you did not ask to sign in, ignore this email.'
		].join('\n'),
		html: `<p>Open this link to sign in to ${escapeHtml(brand)}:</p>
<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 14px;background:#1f1d1a;color:#f7f5f0;font-family:ui-monospace,monospace;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;text-decoration:none">Sign in</a></p>
<p style="color:#6b6760;font-size:13px">It works once, for the next 5 minutes. If you did not ask to sign in, ignore this email.</p>`
	};
}
