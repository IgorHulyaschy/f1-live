import { z } from 'zod';

import { CHANNELS } from './speed.ts';

/** What a map tile keeps: its camera, how the track is painted, and how cars are labelled. */
export const trackMapSettingsSchema = z.object({
	camera: z.enum(['full', 'follow']).optional(),
	paint: z.enum(['plain', 'sectors']).optional(),
	zones: z.boolean().optional(),
	labels: z.enum(['code', 'number']).optional(),
	/** Dominance: each driver's best lap, or the best of each mini sector. */
	span: z.enum(['lap', 'best']).optional(),
	/** Speed map: what the lap is painted by. */
	channel: z.enum(CHANNELS).optional()
});

export type TrackMapSettings = z.infer<typeof trackMapSettingsSchema>;

export type MapCamera = NonNullable<TrackMapSettings['camera']>;
