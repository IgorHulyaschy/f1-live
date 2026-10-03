import type { WebSocket } from 'ws';

/** What changed in an account, so another device knows to pull it. */
export type AccountChange = { type: 'changed'; topic: 'dashboards' | 'viewer' };

/** A device that opened the channel, named by the id it chose; no id means it never excludes itself. */
export type DeviceId = string | null;

type Listener = { socket: WebSocket; device: DeviceId; alive: boolean };

/**
 * The signed-in viewer's own channel: every open device of an account hears when another one
 * changed something, and pulls it. The channel carries only that nudge; the data still comes
 * from the REST endpoints, which are the source of truth and enforce the plan.
 */
export class UserEvents {
	private readonly listeners = new Map<string, Set<Listener>>();
	private readonly timer: NodeJS.Timeout;

	constructor(pingMs: number) {
		this.timer = setInterval(() => this.keepAlive(), pingMs);
		this.timer.unref();
	}

	attach(userId: string, socket: WebSocket, device: DeviceId): void {
		// It may have closed while the session was looked up; nothing would remove it then.
		if (socket.readyState !== socket.OPEN) {
			return;
		}

		const listener: Listener = { socket, device, alive: true };
		const own = this.listeners.get(userId) ?? new Set<Listener>();

		own.add(listener);
		this.listeners.set(userId, own);

		const forget = () => {
			own.delete(listener);

			if (own.size === 0 && this.listeners.get(userId) === own) {
				this.listeners.delete(userId);
			}
		};

		socket.on('pong', () => {
			listener.alive = true;
		});
		socket.on('close', forget);
		socket.on('error', forget);
	}

	/** Tells the account's other devices; `from` is the device that made the change. */
	notify(userId: string, change: AccountChange, from: DeviceId): void {
		const text = JSON.stringify(change);

		for (const { socket, device } of this.listeners.get(userId) ?? []) {
			if (socket.readyState === socket.OPEN && (from === null || device !== from)) {
				socket.send(text);
			}
		}
	}

	/** The account is gone: nothing more to hear. */
	closeAccount(userId: string): void {
		for (const { socket } of this.listeners.get(userId) ?? []) {
			socket.close(4401, 'signed out');
		}
	}

	count(userId: string): number {
		return this.listeners.get(userId)?.size ?? 0;
	}

	close(): void {
		clearInterval(this.timer);

		for (const own of this.listeners.values()) {
			for (const { socket } of own) {
				socket.close(1001, 'server stopping');
			}
		}
	}

	/** A device that stayed silent since the last ping is cut, so a dead tab does not linger. */
	private keepAlive(): void {
		for (const own of this.listeners.values()) {
			for (const listener of own) {
				if (listener.alive) {
					listener.alive = false;
					listener.socket.ping();
				} else {
					listener.socket.terminate();
				}
			}
		}
	}
}
