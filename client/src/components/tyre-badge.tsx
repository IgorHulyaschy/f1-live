import type { TyreCompound } from '@f1-live/shared';

import { cn } from '@/lib/utils';

const COMPOUND_CLASS: Record<TyreCompound, string> = {
	SOFT: 'border-tyre-soft text-tyre-soft',
	MEDIUM: 'border-tyre-medium text-tyre-medium',
	HARD: 'border-tyre-hard text-tyre-hard',
	INTERMEDIATE: 'border-tyre-intermediate text-tyre-intermediate',
	WET: 'border-tyre-wet text-tyre-wet',
	UNKNOWN: 'border-muted-foreground text-muted-foreground'
};

const COMPOUND_LETTER: Record<TyreCompound, string> = {
	SOFT: 'S',
	MEDIUM: 'M',
	HARD: 'H',
	INTERMEDIATE: 'I',
	WET: 'W',
	UNKNOWN: '?'
};

const COMPOUND_NAME: Record<TyreCompound, string> = {
	SOFT: 'Soft',
	MEDIUM: 'Medium',
	HARD: 'Hard',
	INTERMEDIATE: 'Intermediate',
	WET: 'Wet',
	UNKNOWN: 'Unknown'
};

export function compoundName(compound: TyreCompound): string {
	return COMPOUND_NAME[compound];
}

export function TyreBadge({ compound, age }: { compound: TyreCompound; age?: number }) {
	return (
		<span className="inline-flex items-center gap-1.5" title={`${COMPOUND_NAME[compound]} tyre`}>
			<span
				className={cn(
					'inline-flex size-5 items-center justify-center rounded-full border-2 text-xs font-bold',
					COMPOUND_CLASS[compound]
				)}
			>
				{COMPOUND_LETTER[compound]}
			</span>
			{age === undefined ? null : (
				<span className="text-muted-foreground font-mono text-xs tabular-nums">{age}</span>
			)}
		</span>
	);
}

/** Fill colour for the compound, for bars in strategy views. */
export const COMPOUND_FILL_CLASS: Record<TyreCompound, string> = {
	SOFT: 'bg-tyre-soft',
	MEDIUM: 'bg-tyre-medium',
	HARD: 'bg-tyre-hard',
	INTERMEDIATE: 'bg-tyre-intermediate',
	WET: 'bg-tyre-wet',
	UNKNOWN: 'bg-muted-foreground'
};
