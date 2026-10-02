import type { FastifyReply, FastifyRequest } from 'fastify';

import type { Cache } from '../../infra/cache/Cache.js';
import type { DriverRepository } from '../../infra/db/repositories/driver.repository.js';
import type { LapRepository } from '../../infra/db/repositories/lap.repository.js';
import type { SessionRepository } from '../../infra/db/repositories/session.repository.js';

export type OnLoadDependencies = {
	cache: Cache;
	lapRepository: LapRepository;
	driverRepository: DriverRepository;
	sessionRepository: SessionRepository;
};

/** Current session with every driver's laps; the client's initial load before live updates. */
export function onLoad(dependencies: OnLoadDependencies) {
	const { cache, lapRepository, driverRepository, sessionRepository } = dependencies;

	return async (_request: FastifyRequest, reply: FastifyReply) => {
		reply.type('application/json').code(200);

		const [drivers, session] = await Promise.all([
			driverRepository.findAll(),
			sessionRepository.findOneById(cache.sessionId)
		]);

		const driversLapsData = await Promise.all(
			drivers.map(async (driver) =>
				Object.assign(driver, {
					laps: await lapRepository.findAllByDriverNumber(driver.number, cache.sessionId)
				})
			)
		);

		return { session, driversLapsData };
	};
}
