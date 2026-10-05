import {
	ALERT_KINDS,
	ALERT_LABELS,
	type AlertKind,
	MAX_ALERT_DELAY_SECONDS
} from '@f1-live/shared/alerts';
import { BellIcon, SendIcon } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Key, KeyGroup } from '@/components/console/keys';
import { useChosenDriver, useRace } from '@/data/race-context';
import { useAccount, useAccountsConfig } from '@/features/account/account-store';
import { AccountsError } from '@/features/account/api';
import { SignInDialog } from '@/features/account/sign-in';
import { plural } from '@/lib/format';

import { alertSettingsStore, changeAlertSettings } from './alert-settings';
import { type Device, fetchAlerts, registerDevice, removeDevice, sendTestPush } from './alerts-api';
import {
	currentSubscription,
	PushError,
	type PushState,
	pushState,
	subscribeThisDevice,
	unsubscribeThisDevice
} from './push';

function Section({
	title,
	meta,
	children
}: {
	title: string;
	meta?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<section aria-label={title} className="flex flex-col gap-4">
			<header className="border-rule-strong flex flex-wrap items-baseline gap-x-4 border-b-2 pb-1.5">
				<h2 className="type-wide text-xs font-bold">{title}</h2>
				{meta ? <span className="type-label">{meta}</span> : null}
			</header>
			{children}
		</section>
	);
}

const DELAY_STEPS = [0, 5, 10, 20, 30, 60];

/** The usual waits, and the one in use when it is another (a delay matched to the broadcast's). */
function delayOptions(current: number) {
	return (DELAY_STEPS.includes(current) ? DELAY_STEPS : [...DELAY_STEPS, current])
		.toSorted((a, b) => a - b)
		.map((seconds) => ({
			value: String(seconds),
			label: seconds === 0 ? 'None' : `${seconds} s`
		}));
}

/** A sample of each alert, as a toast, so a viewer sees what they are choosing. */
const SAMPLES: Record<AlertKind, { title: string; body: string }> = {
	pit_stop: { title: 'LEC is in the pits', body: 'Stop 1, lap 18' },
	flag: { title: 'Safety car', body: 'Lap 23' },
	penalty: { title: 'LEC: 5 s time penalty', body: 'Causing a collision' },
	retirement: { title: 'LEC is out', body: 'Power unit' },
	session_start: { title: 'Race has started', body: 'Las Vegas Grand Prix' }
};

function OnOff({
	on,
	label,
	onChange,
	disabled,
	testId
}: {
	on: boolean;
	label: string;
	onChange: (on: boolean) => void;
	disabled?: boolean;
	testId?: string;
}) {
	return (
		<Key
			pressed={on}
			aria-pressed={on}
			aria-label={label}
			disabled={disabled}
			data-testid={testId}
			className="w-12 justify-center"
			onClick={() => onChange(!on)}
		>
			{on ? 'On' : 'Off'}
		</Key>
	);
}

type PushView = { state: PushState | null; mine: string | null; devices: Device[] };

/** What this browser can do about pushes, which subscription it holds, and the account's devices. */
async function loadPushView(signedIn: boolean): Promise<PushView> {
	return {
		state: await pushState(),
		mine: (await currentSubscription())?.endpoint ?? null,
		devices: signedIn
			? await fetchAlerts().then(
					(result) => result.devices,
					() => []
				)
			: []
	};
}

/** What this browser can do about pushes, and what the account holds: one place to turn them on. */
function PushDevice({ onNeedSignIn }: { onNeedSignIn: () => void }) {
	const account = useAccount();
	const config = useAccountsConfig();
	const [view, setView] = React.useState<PushView>({ state: null, mine: null, devices: [] });
	const { state, mine, devices } = view;
	const [busy, setBusy] = React.useState(false);
	const signedIn = account.status === 'signed-in';

	React.useEffect(() => {
		let current = true;

		void (async () => {
			const loaded = await loadPushView(signedIn);

			if (current) {
				setView(loaded);
			}
		})();

		return () => {
			current = false;
		};
	}, [signedIn]);

	const reload = async () => setView(await loadPushView(signedIn));

	const act = async (task: () => Promise<void>) => {
		setBusy(true);

		try {
			await task();
		} catch (cause) {
			toast(
				cause instanceof PushError && cause.reason === 'denied'
					? 'Notifications are blocked for this site'
					: cause instanceof AccountsError
						? cause.message
						: 'Could not do that. Try again in a moment.',
				cause instanceof PushError && cause.reason === 'denied'
					? { description: 'Allow them in the browser’s site settings, then try again.' }
					: undefined
			);
		} finally {
			setBusy(false);
			await reload();
		}
	};

	const turnOn = (publicKey: string) =>
		act(async () => {
			const subscription = await subscribeThisDevice(publicKey);

			await registerDevice(subscription.toJSON());
			toast('Pushes are on for this device', {
				description: 'Send a test to see one.'
			});
		});

	const turnOff = () =>
		act(async () => {
			const endpoint = await unsubscribeThisDevice();

			if (endpoint) {
				await removeDevice(endpoint).catch(() => undefined);
			}
		});

	const test = () =>
		act(async () => {
			const result = await sendTestPush();

			toast(
				result.sent > 0 ? `Sent to ${plural(result.sent, 'device')}` : 'Nothing was delivered',
				{
					description:
						result.sent > 0
							? 'It should arrive in a moment, even with this tab closed.'
							: 'Turn pushes on for a device first, or try again.'
				}
			);
		});

	let note: React.ReactNode;
	let action: React.ReactNode = null;

	if (!signedIn) {
		note =
			'Pushes reach this device when the app is closed. They need an account, so we know where to send them.';
		action = (
			<Key pressed onClick={onNeedSignIn}>
				Sign in
			</Key>
		);
	} else if (config && !config.push) {
		note = 'Web Push is not set up on this server. Alerts still show in the app.';
	} else if (state === 'unsupported') {
		note = 'This browser cannot receive pushes. Alerts still show in the app.';
	} else if (state === 'no-worker') {
		note =
			'Pushes need the installed app or the production build. This page runs without the service worker that receives them.';
	} else if (state === 'denied') {
		note = 'Notifications are blocked for this site. Allow them in the browser’s site settings.';
	} else if (mine && devices.some((device) => device.endpoint === mine)) {
		note = 'Pushes are on for this device.';
		action = (
			<>
				<Key onClick={() => void test()} disabled={busy} data-testid="push-test">
					<SendIcon />
					Send a test
				</Key>
				<Key onClick={() => void turnOff()} disabled={busy} data-testid="push-off">
					Turn off
				</Key>
			</>
		);
	} else if (config?.push) {
		const { publicKey } = config.push;

		note = 'Get alerts on this device even when the app is closed.';
		action = (
			<Key pressed onClick={() => void turnOn(publicKey)} disabled={busy} data-testid="push-on">
				<BellIcon />
				Turn on pushes
			</Key>
		);
	} else {
		note = 'Checking this device';
	}

	return (
		<div className="flex flex-col gap-3">
			<output className="text-muted-foreground block max-w-2xl text-sm" data-testid="push-status">
				{note}
			</output>
			{action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
			{signedIn && devices.length > 0 ? (
				<ul className="border-t text-sm" aria-label="Devices with pushes">
					{devices.map((device) => (
						<li key={device.endpoint} className="flex flex-wrap items-center gap-3 border-b py-2">
							<span className="min-w-0 flex-1 truncate">
								{describeDevice(device.userAgent)}
								{device.endpoint === mine ? (
									<span className="type-label ml-3">This device</span>
								) : null}
							</span>
							<span className="type-label">
								Added{' '}
								{new Date(device.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
							</span>
							{device.endpoint === mine ? null : (
								<Key
									aria-label={`Remove ${describeDevice(device.userAgent)}`}
									onClick={() =>
										void act(async () => {
											await removeDevice(device.endpoint);
										})
									}
								>
									Remove
								</Key>
							)}
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}

/** A browser and system from its user agent, short enough for a list; the whole string never shows. */
function describeDevice(userAgent: string | null): string {
	if (!userAgent) {
		return 'A device';
	}

	const browser = /Edg\//.test(userAgent)
		? 'Edge'
		: /Firefox\//.test(userAgent)
			? 'Firefox'
			: /Chrome\//.test(userAgent)
				? 'Chrome'
				: /Safari\//.test(userAgent)
					? 'Safari'
					: 'Browser';

	const system = /Android/.test(userAgent)
		? 'Android'
		: /iPhone|iPad/.test(userAgent)
			? 'iOS'
			: /Mac OS X/.test(userAgent)
				? 'macOS'
				: /Windows/.test(userAgent)
					? 'Windows'
					: /Linux/.test(userAgent)
						? 'Linux'
						: null;

	return system ? `${browser} on ${system}` : browser;
}

const setKind = (kind: AlertKind, channel: 'toast' | 'push', on: boolean) =>
	changeAlertSettings((current) => ({
		...current,
		[channel]: { ...current[channel], [kind]: on }
	}));

/**
 * Alerts for the driver the viewer follows (stops, penalties, retirements) and for everyone's
 * track (flags, session starts): which to show as a toast while the app is open, which to push to
 * a phone, when not to, and how long to wait so a push never beats a delayed broadcast.
 */
export function AlertsPage() {
	const settings = alertSettingsStore.useValue();
	const { snapshot, live } = useRace();
	const account = useAccount();
	const chosen = useChosenDriver();
	const [signingIn, setSigningIn] = React.useState(false);
	const driver = snapshot.drivers.find((entry) => entry.number === chosen);
	const signedIn = account.status === 'signed-in';
	const broadcastDelay = Math.round(live.delaySeconds);

	return (
		<div className="flex flex-col gap-8" data-testid="alerts">
			<header className="flex flex-col gap-2">
				<h1 className="type-wide text-2xl leading-none font-black italic md:text-4xl">Alerts</h1>
				<p className="text-muted-foreground max-w-2xl text-sm">
					Pit stops, penalties and retirements for{' '}
					<span className="text-foreground font-medium">{driver?.code ?? `#${chosen}`}</span>, the
					driver you follow, and flags and session starts for everyone. Change who you follow with
					the Focus tile or ⌘K.
				</p>
			</header>
			<Section
				title="What to tell me"
				meta="A toast shows while the app is open; a push reaches the phone"
			>
				<ul className="border-t">
					{ALERT_KINDS.map((kind) => (
						<li key={kind} className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b py-3">
							<span className="flex min-w-48 flex-1 flex-col">
								<span className="type-wide text-sm font-bold">{ALERT_LABELS[kind].name}</span>
								<span className="text-muted-foreground text-sm">{ALERT_LABELS[kind].detail}</span>
							</span>
							<span className="flex items-center gap-2">
								<span className="type-label">In the app</span>
								<OnOff
									on={settings.toast[kind]}
									label={`${ALERT_LABELS[kind].name} in the app`}
									testId={`alert-toast-${kind}`}
									onChange={(on) => setKind(kind, 'toast', on)}
								/>
							</span>
							<span className="flex items-center gap-2">
								<span className="type-label">Push</span>
								<OnOff
									on={settings.push[kind]}
									label={`${ALERT_LABELS[kind].name} push`}
									testId={`alert-push-${kind}`}
									onChange={(on) => setKind(kind, 'push', on)}
									disabled={!signedIn}
								/>
							</span>
							<Key
								aria-label={`Show a sample ${ALERT_LABELS[kind].name} alert`}
								onClick={() => toast(SAMPLES[kind].title, { description: SAMPLES[kind].body })}
							>
								Sample
							</Key>
						</li>
					))}
				</ul>
			</Section>
			<Section title="Pushes to this device">
				<PushDevice onNeedSignIn={() => setSigningIn(true)} />
			</Section>
			<Section title="Quiet hours" meta="No pushes in this window; toasts are not affected">
				<div className="flex flex-wrap items-end gap-x-6 gap-y-3">
					<OnOff
						on={settings.quiet.enabled}
						label="Quiet hours"
						testId="quiet-toggle"
						onChange={(enabled) =>
							changeAlertSettings((current) => ({
								...current,
								quiet: { ...current.quiet, enabled }
							}))
						}
					/>
					{(['from', 'to'] as const).map((edge) => (
						<label key={edge} className="flex flex-col gap-1">
							<span className="type-label">{edge === 'from' ? 'From' : 'Until'}</span>
							<input
								type="time"
								value={settings.quiet[edge]}
								disabled={!settings.quiet.enabled}
								onChange={(event) => {
									const { value } = event.target;

									if (/^\d\d:\d\d$/.test(value)) {
										changeAlertSettings((current) => ({
											...current,
											quiet: { ...current.quiet, [edge]: value }
										}));
									}
								}}
								className="border-rule-strong focus-visible:border-foreground h-9 border-b-2 bg-transparent font-mono text-sm outline-none disabled:opacity-40"
								data-testid={`quiet-${edge}`}
							/>
						</label>
					))}
					<span className="type-label pb-2.5">{settings.quiet.timeZone.replaceAll('_', ' ')}</span>
				</div>
			</Section>
			<Section
				title="Wait before a push"
				meta="So it does not arrive before a delayed broadcast shows the moment"
			>
				<div className="flex flex-wrap items-center gap-3">
					<KeyGroup
						label="Wait before a push"
						options={delayOptions(settings.delaySeconds)}
						value={String(settings.delaySeconds)}
						onChange={(value) =>
							changeAlertSettings((current) => ({ ...current, delaySeconds: Number(value) }))
						}
					/>
					{broadcastDelay > 0 && broadcastDelay !== settings.delaySeconds ? (
						<Key
							onClick={() =>
								changeAlertSettings((current) => ({
									...current,
									delaySeconds: Math.min(MAX_ALERT_DELAY_SECONDS, broadcastDelay)
								}))
							}
						>
							Match my broadcast delay ({broadcastDelay} s)
						</Key>
					) : null}
				</div>
			</Section>
			<p className="text-muted-foreground max-w-2xl text-sm">
				Once a session is over, a push that would give its result away (a retirement or a penalty)
				is not sent while spoiler protection is on and you have not watched it.
			</p>
			<SignInDialog
				open={signingIn}
				onOpenChange={setSigningIn}
				reason="Pushes need an account, so we can reach this device when the app is closed. No password: we email you a link."
			/>
		</div>
	);
}
