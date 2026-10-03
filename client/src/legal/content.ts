import { BRAND } from '../brand.ts';

/**
 * The legal pages, written as plain data so the owner can edit them without touching a component.
 * The text is a working draft for review, not legal advice: every "Owner to supply" note marks a
 * fact only the owner or their lawyer can give. When a page has been reviewed, set `draft` to
 * false and `updated` to the review date; the page then drops its "Draft" status.
 */

export type LegalSlug = 'terms' | 'privacy' | 'cookies';

export type LegalSection = {
	heading: string;
	paragraphs: readonly string[];
	list?: readonly string[];
	/** A live control shown under the text: `consent` changes the usage-counting answer. */
	control?: 'consent';
};

export type LegalDocument = {
	slug: LegalSlug;
	title: string;
	summary: string;
	/** ISO date shown as "Last updated". */
	updated: string;
	draft: boolean;
	sections: readonly LegalSection[];
};

const NAME = BRAND.name;

const EMAIL = BRAND.supportEmail;

const HOST = new URL(BRAND.origin).host;

const TERMS: LegalDocument = {
	slug: 'terms',
	title: 'Terms of service',
	summary: `The rules for using ${NAME}: what it is, what it is not, and what we each promise.`,
	updated: '2026-10-03',
	draft: true,
	sections: [
		{
			heading: 'Who we are',
			// Owner to supply: the operator's legal name, address and company number, in place of
			// "its operator".
			paragraphs: [
				`${NAME} is run by its operator ("we", "us"). By using ${NAME} at ${HOST} you agree to these terms. If you do not agree, please do not use it.`
			]
		},
		{
			heading: 'What the service is',
			paragraphs: [
				`${NAME} shows live and past timing for motor races, with insights we work out from it: gaps, tyre stints, pit windows and pace.`,
				`${NAME} is unofficial and is not associated in any way with the Formula 1 companies. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks are trade marks of Formula One Licensing B.V.`,
				'Timing comes from public feeds and can be late, incomplete or wrong. Do not rely on it for betting or for any decision that costs money.'
			]
		},
		{
			heading: 'Your dashboards',
			paragraphs: [
				'Dashboards you build are saved in your browser, and in your account once you sign in. A share link carries the whole dashboard, so anyone with the link can see and copy it.',
				'Dashboards you publish to the library are public until you remove them. Give them names that are fit for everyone; we may remove published dashboards that are not.'
			]
		},
		{
			heading: 'Free and Pro',
			// Owner to supply: prices, the refund policy and how taxes are shown.
			paragraphs: [
				'The free plan keeps three dashboards of your own. Pro keeps any number, adds the Pro tiles and lets you publish to the library.',
				'Pro is paid in advance, monthly or yearly, through our payment provider. You can cancel at any time; Pro stays on until the end of the period you paid for.'
			]
		},
		{
			heading: 'Fair use',
			paragraphs: ['Use the service the way it is meant to be used. In particular:'],
			list: [
				'do not copy the data in bulk, resell it or offer it as your own service;',
				'do not try to break, overload or get around the limits of the service;',
				`do not use ${NAME} for anything unlawful.`
			]
		},
		{
			heading: 'Availability',
			paragraphs: [
				`We work to keep ${NAME} running through every session, but outages happen, most of all on race days. We may change or stop features; anything that affects Pro is announced before it applies.`
			]
		},
		{
			heading: 'Liability',
			// Owner to supply: the governing law and the courts that hear disputes.
			paragraphs: [
				`${NAME} is provided as it is. As far as the law allows, we are not liable for indirect losses, or for losses caused by late or wrong timing. Nothing in these terms limits the rights you have as a consumer.`
			]
		},
		{
			heading: 'Changes to these terms',
			paragraphs: [
				'When these terms change, we update this page and the date above. If a change affects Pro, subscribers hear about it before it applies.'
			]
		},
		{
			heading: 'Contact',
			paragraphs: [`Questions about these terms go to ${EMAIL}.`]
		}
	]
};

const PRIVACY: LegalDocument = {
	slug: 'privacy',
	title: 'Privacy policy',
	summary: `What ${NAME} keeps about you, where it lives and how to remove it. The short version: as little as possible, mostly in your own browser.`,
	updated: '2026-10-03',
	draft: true,
	sections: [
		{
			heading: 'Who is responsible',
			// Owner to supply: the controller's legal name and address, and an EU or UK representative
			// if one is needed.
			paragraphs: [
				`The operator of ${NAME} is responsible for the personal data described here. Write to ${EMAIL} about anything on this page.`
			]
		},
		{
			heading: 'What stays in your browser',
			paragraphs: [
				`Your dashboards, the driver you follow, the theme, the text size and your privacy choices are kept in your browser's storage. They are not sent to us. Clearing this site's data in your browser removes them.`
			]
		},
		{
			heading: 'Your account',
			paragraphs: [
				'If you sign in, we keep your email address, your display name and handle, your dashboards and your plan, so your dashboards follow you to other devices. We use them only to run your account.',
				'Deleting your account on the account page removes all of it, including dashboards you published.'
			]
		},
		{
			heading: 'Payments',
			// Owner to supply: name the payment provider once chosen (Stripe or a merchant of record).
			paragraphs: [
				'Pro is paid through our payment provider. It handles your card details; we receive only whether your plan is active and when it renews.'
			]
		},
		{
			heading: 'Usage counts',
			paragraphs: [
				`With your permission, ${NAME} counts which pages are opened and which features are used, such as tiles added or dashboards shared. The counts carry no name, no account and no cookie, and are used only to decide what to build next. You can change your answer on the cookie notice at any time.`
			]
		},
		{
			heading: 'Error reports',
			// Owner to supply: the error reporting service, once chosen.
			paragraphs: [
				`When something breaks, ${NAME} can send an error report: the error, the page address and the browser version. Reports carry no account details.`
			]
		},
		{
			heading: 'Pictures from formula1.com',
			paragraphs: [
				'Driver photos, team logos and car pictures load straight from formula1.com in your browser. Like any website, formula1.com receives your IP address when it sends a picture, under its own privacy policy.'
			]
		},
		{
			heading: 'How long we keep data',
			// Owner to supply: confirm these periods with the chosen providers.
			paragraphs: [
				'Account data is kept until you delete the account. Usage counts are kept as totals only. Error reports are deleted after 90 days.'
			]
		},
		{
			heading: 'Your rights',
			paragraphs: [
				`You can ask for a copy of your data, ask us to correct or delete it, or object to how we use it. Write to ${EMAIL} and we answer within one month. You can also complain to your data protection authority.`
			]
		},
		{
			heading: 'Changes to this policy',
			paragraphs: ['When this policy changes, we update this page and the date above.']
		}
	]
};

const COOKIES: LegalDocument = {
	slug: 'cookies',
	title: 'Cookie notice',
	summary: `${NAME} sets no cookies. It keeps your settings in your browser's own storage, where only you can see them.`,
	updated: '2026-10-03',
	draft: true,
	sections: [
		{
			heading: 'What is stored on your device',
			paragraphs: ['Your browser keeps these for the features you use, so they need no consent:'],
			list: [
				'dashboards you made or changed;',
				'the driver you follow;',
				'the theme, the text size and whether the screen stays awake;',
				'whether you finished the first-run setup or put away the install offer;',
				'your answer about usage counting;',
				'your sign-in, once you have an account.'
			]
		},
		{
			heading: 'Usage counting',
			paragraphs: [
				`If ${NAME} counts usage, it asks first, in a bar at the bottom of the page. The counter sets no cookies. You can change your answer here.`
			],
			control: 'consent'
		},
		{
			heading: 'Pictures from other sites',
			paragraphs: [
				'Driver photos and team logos load from formula1.com, which may set or read its own cookies under its own policy. Your browser settings can block that site.'
			]
		},
		{
			heading: 'Removing it all',
			paragraphs: [
				`Clearing this site's data in your browser removes everything ${NAME} stored there. Questions go to ${EMAIL}.`
			]
		}
	]
};

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [TERMS, PRIVACY, COOKIES];
