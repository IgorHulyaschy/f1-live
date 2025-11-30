import type { Driver } from './driver.types';

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type WebSocketMessage<T = unknown> = [
	string, // topic
	T // data
];

// WebSocket message types
export type MessageType =
	| 'session_update'
	| 'driver_update'
	| 'position_change'
	| 'lap_update'
	| 'sector_update'
	| 'tire_change'
	| 'status_change'
	| 'fastest_lap'
	| 'drs_update'
	| 'session_start'
	| 'session_end'
	| 'error';

// Session update message
export interface SessionUpdateData {
	sessionId: string;
	currentLap: number;
	totalLaps: number;
	isLive: boolean;
}

// Driver update message
export interface DriverUpdateData {
	driver: Driver;
}

// Position change message
export interface PositionChangeData {
	driverId: string;
	oldPosition: number;
	newPosition: number;
	positionChange: number;
}

// Lap update message
export interface LapUpdateData {
	driverId: string;
	lapTime: string;
	isFastest: boolean;
	lapNumber: number;
}

// Sector update message
export interface SectorUpdateData {
	driverId: string;
	sector: 1 | 2 | 3;
	time: string;
	status: 'fastest' | 'pb' | 'yellow' | 'normal';
}

// Tire change message
export interface TireChangeData {
	driverId: string;
	tire: 'S' | 'M' | 'H';
	tireAge: number;
	lapNumber: number;
}

// Status change message
export interface StatusChangeData {
	driverId: string;
	status: 'PIT' | 'OUT' | 'TRACK';
}

// DRS update message
export interface DRSUpdateData {
	driverId: string;
	inDRS: boolean;
}

// Error message
export interface ErrorData {
	message: string;
	code?: string;
}

export interface WebSocketOptions {
	url: string;
	reconnectInterval?: number;
	maxReconnectAttempts?: number;
	heartbeatInterval?: number;
	autoConnect?: boolean;
}

export interface WebSocketHookOptions extends Partial<WebSocketOptions> {
	enabled?: boolean;
	onMessage?: (message: WebSocketMessage) => void;
	onConnect?: () => void;
	onDisconnect?: () => void;
	onError?: (error: Event) => void;
}
