import type { WebSocketMessage, WebSocketOptions, WebSocketStatus } from '../types/websocket.types';

export class WebSocketService {
	private ws: WebSocket | null = null;
	private url: string;
	private reconnectInterval: number;
	private maxReconnectAttempts: number;
	private heartbeatInterval: number;
	private reconnectAttempts = 0;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
	private statusListeners: Set<(status: WebSocketStatus) => void> = new Set();
	private currentStatus: WebSocketStatus = 'disconnected';

	constructor(options: WebSocketOptions) {
		this.url = options.url;
		this.reconnectInterval = options.reconnectInterval ?? 3000;
		this.maxReconnectAttempts = options.maxReconnectAttempts ?? 10;
		this.heartbeatInterval = options.heartbeatInterval ?? 30000;

		if (options.autoConnect !== false) {
			this.connect();
		}
	}

	/**
	 * Connect to WebSocket server
	 */
	connect(): void {
		if (this.ws?.readyState === WebSocket.OPEN) {
			// eslint-disable-next-line no-console
			console.warn('WebSocket is already connected');

			return;
		}

		this.setStatus('connecting');

		try {
			this.ws = new WebSocket(this.url);

			this.ws.onopen = this.handleOpen.bind(this);
			this.ws.onmessage = this.handleMessage.bind(this);
			this.ws.onerror = this.handleError.bind(this);
			this.ws.onclose = this.handleClose.bind(this);
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('Failed to create WebSocket:', error);
			this.setStatus('error');
			this.scheduleReconnect();
		}
	}

	/**
	 * Disconnect from WebSocket server
	 */
	disconnect(): void {
		this.clearReconnectTimeout();
		this.clearHeartbeat();

		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}

		this.setStatus('disconnected');
	}

	/**
	 * Send message to WebSocket server
	 */
	send<T>(type: string, data: T): void {
		if (this.ws?.readyState !== WebSocket.OPEN) {
			console.error('WebSocket is not connected');

			return;
		}

		const message: WebSocketMessage<T> = [type, data];

		this.ws.send(JSON.stringify(message));
	}

	/**
	 * Subscribe to messages of a specific type
	 */
	on<T>(type: string, callback: (data: T) => void): () => void {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set());
		}

		this.listeners.get(type)!.add(callback as (data: unknown) => void);

		// Return unsubscribe function
		return () => {
			this.listeners.get(type)?.delete(callback as (data: unknown) => void);
		};
	}

	/**
	 * Subscribe to status changes
	 */
	onStatusChange(callback: (status: WebSocketStatus) => void): () => void {
		this.statusListeners.add(callback);

		// Call immediately with current status
		callback(this.currentStatus);

		// Return unsubscribe function
		return () => {
			this.statusListeners.delete(callback);
		};
	}

	/**
	 * Get current connection status
	 */
	getStatus(): WebSocketStatus {
		return this.currentStatus;
	}

	/**
	 * Handle WebSocket open event
	 */
	private handleOpen(): void {
		// eslint-disable-next-line no-console
		console.log('WebSocket connected');
		this.setStatus('connected');
		this.reconnectAttempts = 0;
		this.startHeartbeat();
	}

	/**
	 * Handle WebSocket message event
	 */
	private handleMessage(event: MessageEvent): void {
		try {
			const message: WebSocketMessage = JSON.parse(event.data);
			const [topic, data] = message;

			// Emit to listeners for this message type
			const listeners = this.listeners.get(topic);

			if (listeners) {
				listeners.forEach((callback) => callback(data));
			}

			// Also emit to wildcard listeners
			const wildcardListeners = this.listeners.get('*');

			if (wildcardListeners) {
				wildcardListeners.forEach((callback) => callback(message));
			}
		} catch (error) {
			if (event.data !== 'Connection established') {
				console.error('Failed to parse WebSocket message:', error);
			}
		}
	}

	/**
	 * Handle WebSocket error event
	 */
	private handleError(event: Event): void {
		// eslint-disable-next-line no-console
		console.error('WebSocket error:', event);
		this.setStatus('error');
	}

	/**
	 * Handle WebSocket close event
	 */
	private handleClose(): void {
		// eslint-disable-next-line no-console
		console.log('WebSocket disconnected');
		this.setStatus('disconnected');
		this.clearHeartbeat();
		this.scheduleReconnect();
	}

	/**
	 * Schedule reconnection attempt
	 */
	private scheduleReconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			// eslint-disable-next-line no-console
			console.error('Max reconnection attempts reached');

			return;
		}

		this.clearReconnectTimeout();

		this.reconnectTimeout = setTimeout(() => {
			this.reconnectAttempts++;
			// eslint-disable-next-line no-console
			console.log(`Reconnecting... (attempt ${this.reconnectAttempts})`);
			this.connect();
		}, this.reconnectInterval);
	}

	/**
	 * Clear reconnection timeout
	 */
	private clearReconnectTimeout(): void {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
	}

	/**
	 * Start heartbeat to keep connection alive
	 */
	private startHeartbeat(): void {
		this.clearHeartbeat();

		this.heartbeatTimer = setInterval(() => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.send('ping', { timestamp: Date.now() });
			}
		}, this.heartbeatInterval);
	}

	/**
	 * Clear heartbeat timer
	 */
	private clearHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	/**
	 * Set connection status and notify listeners
	 */
	private setStatus(status: WebSocketStatus): void {
		if (this.currentStatus !== status) {
			this.currentStatus = status;
			this.statusListeners.forEach((callback) => callback(status));
		}
	}
}

const url = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';

export const webSocketConnection = new WebSocketService({ url });
