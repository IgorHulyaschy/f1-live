import { describeDecision, type Decision } from '@f1-live/shared/decisions';
import { ageOn } from '@f1-live/shared/facts';
import type { SeasonResults } from '@f1-live/shared/results';
import { ExternalLinkIcon } from 'lucide-react';
import * as React from 'react';

import { Field, Panel, PanelHeader } from '@/components/console/panel';
import { useFacts, useSeasonDecisions } from '@/data/decisions-context';
import { splitDecisions } from '@/data/decisions-view';
import { useNow } from '@/hooks/use-now';
import { plural } from '@/lib/format';

const WIKIDATA = 'https://www.wikidata.org/wiki/';

const dateOf = new Intl.DateTimeFormat('en-GB', {
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC'
});

/** Born, age, birthplace and nationality from Wikidata; nothing when the driver is not in the file. */
export function DriverFactsPanel({ id }: { id: string }) {
	const state = useFacts();
	const now = useNow();
	const facts = state.status === 'ready' ? state.value?.drivers[id] : undefined;

	if (facts === undefined) {
		return null;
	}

	const born = facts.birthDate === null ? null : new Date(`${facts.birthDate}T00:00:00Z`);

	return (
		<Panel data-testid="driver-facts">
			<PanelHeader title="Facts" meta="from Wikidata" />
			<div className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 sm:flex sm:flex-wrap">
				{born === null ? null : (
					<>
						<Field label="Born">{dateOf.format(born)}</Field>
						<Field label="Age">{ageOn(facts.birthDate ?? '', new Date(now))}</Field>
					</>
				)}
				{facts.birthPlace === null ? null : <Field label="Birthplace">{facts.birthPlace}</Field>}
				{facts.nationality === null ? null : <Field label="Nationality">{facts.nationality}</Field>}
			</div>
			<p className="px-4 pb-3 text-xs">
				<a
					href={`${WIKIDATA}${facts.wikidata}`}
					className="text-muted-foreground inline-flex min-h-9 items-center gap-1 font-mono hover:underline sm:min-h-7"
					target="_blank"
					rel="noreferrer"
				>
					Source: Wikidata {facts.wikidata}
					<ExternalLinkIcon aria-hidden className="size-3" />
				</a>
			</p>
		</Panel>
	);
}

/** One decision with its own link to the FIA document. */
export function DecisionLink({ decision }: { decision: Decision }) {
	return (
		<a
			href={decision.url}
			className="inline-flex min-h-9 items-center gap-1 hover:underline sm:min-h-7"
			target="_blank"
			rel="noreferrer"
			data-testid="decision-link"
		>
			{decision.title}
			<ExternalLinkIcon aria-hidden className="size-3 shrink-0" />
		</a>
	);
}

/** The penalties a driver was given, season by season, each with the document that records it. */
export function DriverPenaltiesPanel({
	id,
	seasons,
	include
}: {
	id: string;
	seasons: readonly SeasonResults[];
	include: (key: number) => boolean;
}) {
	const years = React.useMemo(() => seasons.map((season) => season.season), [seasons]);
	const state = useSeasonDecisions(years);

	const split = React.useMemo(() => {
		const own =
			state.status === 'ready'
				? state.value.flatMap((season) =>
						season.decisions.filter(
							(decision) => decision.driver === id && decision.outcome === 'penalty'
						)
					)
				: [];

		return splitDecisions(own, seasons, include);
	}, [state, id, seasons, include]);

	if (state.status !== 'ready' || (split.shown.length === 0 && split.held.length === 0)) {
		return null;
	}

	const shownYears = [...new Set(split.shown.map((decision) => decision.season))].toSorted(
		(a, b) => b - a
	);

	return (
		<Panel data-testid="driver-penalties">
			<PanelHeader title="Penalties" meta="stewards’ decisions, by season" />
			{shownYears.map((season) => {
				const list = split.shown.filter((decision) => decision.season === season);

				return (
					<div key={season} className="px-4 py-2">
						<h3 className="type-label pb-1">{season}</h3>
						<ul>
							{list.map((decision) => (
								<li
									key={decision.id}
									className="flex flex-col gap-0.5 border-b py-2 last:border-b-0"
								>
									<span className="text-sm font-medium">
										{decision.event}: {describeDecision(decision)}
									</span>
									<span className="text-muted-foreground text-xs">
										{decision.infringement ?? decision.fact ?? ''}
									</span>
									<span className="text-xs">
										<DecisionLink decision={decision} />
									</span>
								</li>
							))}
						</ul>
					</div>
				);
			})}
			{split.held.length === 0 ? null : (
				<p className="text-muted-foreground px-4 py-2 text-xs" data-testid="held-penalties">
					{split.held.length === 1
						? '1 penalty'
						: plural(split.held.length, 'penalty', 'penalties')}{' '}
					held back until you reveal the session.
				</p>
			)}
		</Panel>
	);
}
