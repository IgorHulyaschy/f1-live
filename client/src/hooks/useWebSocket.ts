import { useEffect, useRef, useState } from 'react';

import { WebSocketService } from '../services/websocket';

import type { WebSocketHookOptions, WebSocketStatus } from '../types/websocket.types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';

/**
 * Hook to manage WebSocket connection
 *
 * @param options - Configuration options
 * @param options.url - WebSocket server URL (default: from env)
 * @param options.enabled - Whether to connect (default: true)
 * @param options.reconnectInterval - Reconnection interval in ms (default: 3000)
 * @param options.maxReconnectAttempts - Max reconnection attempts (default: 10)
 * @param options.onMessage - Global message handler
 * @param options.onConnect - Connection handler
 * @param options.onDisconnect - Disconnection handler
 * @param options.onError - Error handler
 *
 * @example
 * const { status, send, subscribe } = useWebSocket();
 *
 * useEffect(() => {
 *   return subscribe('driver_update', (data) => {
 *     console.log('Driver updated:', data);
 *   });
 * }, [subscribe]);
 */
export function useWebSocket(options: WebSocketHookOptions = {}) {
	const {
		url = WS_URL,
		enabled = true,
		reconnectInterval,
		maxReconnectAttempts,
		heartbeatInterval,
		onMessage,
		onConnect,
		onDisconnect,
		onError
	} = options;

	const [status, setStatus] = useState<WebSocketStatus>('disconnected');
	const wsRef = useRef<WebSocketService | null>(null);

	// Initialize WebSocket service
	useEffect(() => {
		if (!enabled) {
			return;
		}

		wsRef.current = new WebSocketService({
			url,
			reconnectInterval,
			maxReconnectAttempts,
			heartbeatInterval,
			autoConnect: true
		});

		// Subscribe to status changes
		const unsubscribe = wsRef.current.onStatusChange((newStatus) => {
			setStatus(newStatus);

			if (newStatus === 'connected' && onConnect) {
				onConnect();
			} else if (newStatus === 'disconnected' && onDisconnect) {
				onDisconnect();
			} else if (newStatus === 'error' && onError) {
				onError(new Event('error'));
			}
		});

		// Subscribe to all messages if handler provided
		let messageUnsubscribe: (() => void) | undefined;

		if (onMessage) {
			messageUnsubscribe = wsRef.current.on('*', onMessage);
		}

		return () => {
			unsubscribe();
			messageUnsubscribe?.();
			wsRef.current?.disconnect();
			wsRef.current = null;
		};
	}, [
		enabled,
		url,
		reconnectInterval,
		maxReconnectAttempts,
		heartbeatInterval,
		onConnect,
		onDisconnect,
		onError,
		onMessage
	]);

	/**
	 * Send message to WebSocket server
	 */
	const send = <T>(type: string, data: T) => {
		wsRef.current?.send(type, data);
	};

	/**
	 * Subscribe to messages of a specific type
	 */
	const subscribe = <T>(type: string, callback: (data: T) => void) => {
		return wsRef.current?.on(type, callback) ?? (() => {});
	};

	/**
	 * Manually reconnect
	 */
	const reconnect = () => {
		wsRef.current?.disconnect();
		wsRef.current?.connect();
	};

	return {
		status,
		send,
		subscribe,
		reconnect,
		isConnected: status === 'connected',
		isConnecting: status === 'connecting'
	};
}
