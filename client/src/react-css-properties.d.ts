import type { CSSProperties } from 'react';

declare module 'react' {
	interface CSSProperties {
		/** Driver team colour, read by the `team` theme colour. */
		'--team'?: string;
		/** Fractional size or offset of a data mark, as a CSS length or percentage. */
		'--size'?: string;
		'--offset'?: string;
		/** Series colours set by the shadcn chart components. */
		'--color-bg'?: string;
		'--color-border'?: string;
	}
}

/** Inline style carrying a driver's team colour. */
export type TeamColourStyle = Pick<CSSProperties, '--team'>;
