import { z } from 'zod';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');

const kindFlags = z.object({
	pit_stop: z.boolean(),
	flag: z.boolean(),
	penalty: z.boolean(),
	retirement: z.boolean(),
	session_start: z.boolean()
});

export type KindFlags = z.infer<typeof kindFlags>;

/** The longest push delay: as long as the broadcast delay the app offers. */
export const MAX_ALERT_DELAY_SECONDS = 300;

export const alertSettingsSchema = z.object({
	/** The racing number whose stops, penalties and retirements are announced; null: none. */
	driver: z.string().min(1).max(3).regex(/^\d+$/).nullable(),
	/** Which alerts show as a toast while the app is open, and which are pushed to the phone. */
	toast: kindFlags,
	push: kindFlags,
	/** No pushes between `from` and `to` in `timeZone`; a window past midnight is fine. */
	quiet: z.object({
		enabled: z.boolean(),
		from: hhmm,
		to: hhmm,
		timeZone: z.string().min(1).max(64)
	}),
	/** Pushes wait this long, so they do not arrive before a delayed broadcast shows the moment. */
	delaySeconds: z.int().min(0).max(MAX_ALERT_DELAY_SECONDS)
});

export type AlertSettings = z.infer<typeof alertSettingsSchema>;

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
	driver: null,
	toast: { pit_stop: true, flag: true, penalty: true, retirement: true, session_start: true },
	push: { pit_stop: true, flag: true, penalty: true, retirement: true, session_start: true },
	quiet: { enabled: false, from: '23:00', to: '07:00', timeZone: 'UTC' },
	delaySeconds: 0
};

/** Whether `at` falls in the quiet window, in the viewer's own time zone. */
export function inQuietHours(quiet: AlertSettings['quiet'], at: Date): boolean {
	if (!quiet.enabled || quiet.from === quiet.to) {
		return false;
	}

	let minutes: number;

	try {
		const parts = new Intl.DateTimeFormat('en-GB', {
			timeZone: quiet.timeZone,
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		}).formatToParts(at);

		const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value);

		minutes = part('hour') * 60 + part('minute');
	} catch {
		// A zone this runtime does not know: better a notice than silence.
		return false;
	}

	const start = minutesOf(quiet.from);
	const end = minutesOf(quiet.to);

	return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
}

function minutesOf(time: string): number {
	const [hours = 0, minutes = 0] = time.split(':').map(Number);

	return hours * 60 + minutes;
}
