/** Topics the server publishes to its own WebSocket clients. */
export const Theme = {
	SESSION_INFO: 'SessionInfo',
	LAP_INFO: 'LapInfo'
} as const;

export type Theme = (typeof Theme)[keyof typeof Theme];
