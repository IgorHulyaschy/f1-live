import type { RaceSession, SessionInfo, ApiError } from '../types/api.types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiService {
	private async fetchWithError<T>(endpoint: string, options?: RequestInit): Promise<T> {
		try {
			const response = await fetch(`${API_BASE_URL}${endpoint}`, {
				headers: {
					'Content-Type': 'application/json',
					...options?.headers
				},
				...options
			});

			if (!response.ok) {
				const error: ApiError = {
					message: `HTTP ${response.status}: ${response.statusText}`,
					statusCode: response.status
				};

				try {
					const errorData = await response.json();

					error.message = errorData.message || error.message;
					error.code = errorData.code;
				} catch {
					// If response is not JSON, use the default error message
				}

				throw error;
			}

			return await response.json();
		} catch (error) {
			if ((error as ApiError).statusCode) {
				throw error;
			}

			// Network or other errors
			const apiError: ApiError = {
				message: error instanceof Error ? error.message : 'An unknown error occurred',
				code: 'NETWORK_ERROR'
			};

			throw apiError;
		}
	}

	/**
	 * Get current race session data
	 */
	async getRaceSession(sessionId?: string): Promise<RaceSession> {
		const endpoint = sessionId ? `/sessions/${sessionId}` : '/sessions/current';

		return this.fetchWithError<RaceSession>(endpoint);
	}

	/**
	 * Get list of available sessions
	 */
	async getSessions(): Promise<SessionInfo[]> {
		return this.fetchWithError<SessionInfo[]>('/sessions');
	}

	/**
	 * Get session by ID
	 */
	async getSessionById(sessionId: string): Promise<RaceSession> {
		return this.fetchWithError<RaceSession>(`/sessions/${sessionId}`);
	}
}

export const apiService = new ApiService();
