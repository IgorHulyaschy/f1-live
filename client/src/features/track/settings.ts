import { z } from 'zod';

/** What a map tile keeps: its camera, how the track is painted, and how cars are labelled. */
export const trackMapSettingsSchema = z.object({
	camera: z.enum(['full', 'follow']).optional(),
	paint: z.enum(['plain', 'sectors']).optional(),
	zones: z.boolean().optional(),
	labels: z.enum(['code', 'number']).optional()
});

export type TrackMapSettings = z.infer<typeof trackMapSettingsSchema>;

export type MapCamera = NonNullable<TrackMapSettings['camera']>;
