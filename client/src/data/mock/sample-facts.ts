import { type Facts, factsSchema } from '@f1-live/shared/facts';

import facts2025 from './facts-2025.json';

/** The offline replay's facts, the 2025 drivers of the real facts file, so driver pages show them without a server. */
export function sampleFacts(): Facts {
	return factsSchema.parse(facts2025);
}
