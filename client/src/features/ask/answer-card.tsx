import { EyeOffIcon } from 'lucide-react';
import { Link } from 'react-router';

import { Key } from '@/components/console/keys';
import { DriverPortrait, TeamLogo } from '@/components/driver-media';
import { revealSession } from '@/data/viewer-settings';
import { hasTeamPictures } from '@/lib/media';
import { cn } from '@/lib/utils';

import { type AnswerPicture, type HeldSession, type Rich, richPart } from './ask-data';
import type { AskOutcome, Visual } from './answers';

/** A proof can be a document on another site, which opens in its own tab. */
function newTab(href: string): { target?: '_blank'; rel?: string } {
	return href.startsWith('https://') ? { target: '_blank', rel: 'noreferrer' } : {};
}

function RichText({ rich, onNavigate }: { rich: Rich; onNavigate: () => void }) {
	return rich.map((part, index) => {
		const { text, href } = richPart(part);

		return href === null ? (
			text
		) : (
			<Link
				// The parts never reorder: a reply is rebuilt whole.
				// oxlint-disable-next-line react/no-array-index-key
				key={index}
				to={href}
				{...newTab(href)}
				onClick={onNavigate}
				className="decoration-focus underline decoration-2 underline-offset-3 hover:decoration-4"
			>
				{text}
			</Link>
		);
	});
}

function Picture({ picture }: { picture: AnswerPicture }) {
	if (picture.kind === 'driver') {
		return <DriverPortrait driver={picture.face} size="md" />;
	}

	return hasTeamPictures(picture.team) ? (
		<TeamLogo subject={picture.team} showName={false} />
	) : null;
}

function revealAll(sessions: readonly HeldSession[]) {
	for (const session of sessions) {
		revealSession(session.key);
	}
}

function VisualView({ visual, onNavigate }: { visual: Visual; onNavigate: () => void }) {
	if (visual.kind === 'bars') {
		const max = Math.max(...visual.bars.map((bar) => bar.value), 0);

		return (
			<ol className="flex flex-col gap-1" data-testid="ask-bars">
				{visual.bars.map((bar) => (
					<li key={bar.label}>
						<Link
							to={bar.href}
							{...newTab(bar.href)}
							onClick={onNavigate}
							className="hover:bg-accent grid grid-cols-[7rem_1fr_4rem] items-center gap-2 text-xs"
						>
							<span className="truncate">{bar.label}</span>
							<span className="bg-muted h-2">
								<span
									className="block h-full w-(--size) bg-(--team)"
									style={{
										'--size': `${max > 0 ? (bar.value / max) * 100 : 0}%`,
										'--team': bar.colour ? `#${bar.colour}` : 'var(--color-foreground)'
									}}
								/>
							</span>
							<span className="text-right font-mono tabular-nums">{bar.display}</span>
						</Link>
					</li>
				))}
			</ol>
		);
	}

	return (
		<table className="w-full text-xs" data-testid="ask-table">
			<thead>
				<tr className="type-label text-left">
					{visual.columns.map((column) => (
						<th key={column} className="pr-2 font-normal">
							{column}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{visual.rows.map((row) => (
					<tr
						key={row.cells.join('|')}
						className={cn('border-t', row.mark && 'bg-accent font-semibold')}
					>
						{row.cells.map((cell, index) => (
							<td
								// Columns are fixed by the table's header.
								// oxlint-disable-next-line react/no-array-index-key
								key={index}
								className={cn('py-0.5 pr-2', index > 0 && 'font-mono tabular-nums')}
							>
								{index === 0 || (visual.columns[0] === 'Pos' && index === 1) ? (
									<Link
										to={row.href}
										{...newTab(row.href)}
										onClick={onNavigate}
										className="flex items-center gap-1.5"
									>
										{row.colour && index === 1 ? (
											<span
												aria-hidden
												className="h-3 w-1 bg-(--team)"
												style={{ '--team': `#${row.colour}` }}
											/>
										) : null}
										{cell}
									</Link>
								) : (
									cell
								)}
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}

function HeldNote({ sessions }: { sessions: readonly HeldSession[] }) {
	return (
		<p
			className="hatch flex flex-wrap items-center gap-x-3 gap-y-1 border px-3 py-2 text-xs"
			data-testid="ask-hidden-note"
		>
			<EyeOffIcon aria-hidden className="size-4 shrink-0" />
			<span className="bg-background px-1">
				{sessions.length === 1 ? sessions[0]?.label : `${sessions.length} sessions`} left out: you
				have not seen {sessions.length === 1 ? 'it' : 'them'} yet.
			</span>
			<Key className="bg-background text-foreground ml-auto" onClick={() => revealAll(sessions)}>
				Reveal to include
			</Key>
		</p>
	);
}

/** A reply to a question: the answer with its proof, a reveal step, or why there is none. */
export function AnswerCard({
	outcome,
	onNavigate
}: {
	outcome: AskOutcome | { kind: 'loading'; label: string };
	onNavigate: () => void;
}) {
	switch (outcome.kind) {
		case 'loading':
		case 'snapshot': {
			return (
				<div className="text-muted-foreground px-3 py-4 text-sm" data-testid="ask-loading">
					Reading {outcome.label}…
				</div>
			);
		}

		case 'missing': {
			return (
				<p className="text-muted-foreground px-3 py-4 text-sm" data-testid="ask-missing">
					{outcome.message}
				</p>
			);
		}

		case 'held': {
			return (
				<div className="px-3 py-4" data-testid="ask-held">
					<p className="flex items-start gap-2 text-sm">
						<EyeOffIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
						<span>
							The answer is the result of the{' '}
							<strong>{outcome.sessions.map((session) => session.label).join(', ')}</strong>, which
							you have not seen yet.
						</span>
					</p>
				</div>
			);
		}

		case 'answer': {
			return (
				<article
					className="flex flex-col gap-2 px-3 py-3"
					aria-live="polite"
					data-testid="ask-answer"
				>
					<div className="flex items-center gap-3">
						{outcome.picture ? <Picture picture={outcome.picture} /> : null}
						<p className="min-w-0 text-base leading-snug font-semibold text-balance">
							<RichText rich={outcome.headline} onNavigate={onNavigate} />
						</p>
					</div>
					{outcome.detail ? (
						<p className="text-muted-foreground text-sm">
							<RichText rich={outcome.detail} onNavigate={onNavigate} />
						</p>
					) : null}
					{outcome.visual ? <VisualView visual={outcome.visual} onNavigate={onNavigate} /> : null}
					<p className="type-label text-balance">Source: {outcome.source}</p>
					{outcome.hidden.length > 0 ? <HeldNote sessions={outcome.hidden} /> : null}
				</article>
			);
		}
	}
}
