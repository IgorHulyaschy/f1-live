import type { TrackMapSettings } from '@f1-live/shared/dashboard';

export { type TrackMapSettings, trackMapSettingsSchema } from '@f1-live/shared/dashboard';

export type MapCamera = NonNullable<TrackMapSettings['camera']>;
