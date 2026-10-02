import type { Cache } from '../../infra/cache/Cache.js';
import type { SessionRepository } from '../../infra/db/repositories/session.repository.js';
import type { SessionEvent } from '../../infra/f1-client/types/sync-events.types.js';
import { Session } from '../entities/Session.js';
import { fromSessionEventType } from '../use-cases/session/session.mapper.js';

export class SessionService {
	private readonly cache: Cache;
	private readonly sessionRepository: SessionRepository;

	constructor(cache: Cache, sessionRepository: SessionRepository) {
		this.cache = cache;
		this.sessionRepository = sessionRepository;
	}

	async createAndCacheSession(data: SessionEvent) {
		const existingSession = await this.sessionRepository.findOne(
			data.Meeting.Name,
			fromSessionEventType(data.Name)
		);

		if (existingSession) {
			this.cache.sessionId = existingSession.id;

			return new Session(existingSession);
		}

		const session = Session.create({
			name: data.Meeting.Name,
			country: data.Meeting.Country.Code,
			type: fromSessionEventType(data.Name)
		});

		this.cache.sessionId = session.id;

		return await this.sessionRepository.create(session);
	}
}
