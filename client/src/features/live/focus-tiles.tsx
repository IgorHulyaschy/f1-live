import { Panel, PanelHeader } from '@/components/console/panel';
import { ProGate } from '@/components/pro-gate';
import { RaceOnly } from '@/components/race-only';
import { useRace } from '@/data/race-context';

import { BoxNow } from './box-now';
import { GapLadder } from './gap-ladder';

function useFollowedCode() {
	const { snapshot, followedDriver } = useRace();
	const driver = snapshot.drivers.find((entry) => entry.number === followedDriver);

	return { number: followedDriver, code: driver?.code ?? followedDriver };
}

/** The gap ladder on its own, for dashboards that keep the full focus panel elsewhere. */
export function GapsPanel() {
	const { code } = useFollowedCode();

	return (
		<Panel aria-label="Gaps around the followed driver">
			<PanelHeader title="Gaps" meta={code} />
			<GapLadder />
		</Panel>
	);
}

/** The pit stop prediction on its own. */
export function BoxNowPanel() {
	const { number, code } = useFollowedCode();

	return (
		<Panel aria-label="Pit stop prediction">
			<PanelHeader title="Box now" meta={code} />
			<div className="p-4">
				<RaceOnly what="Pit stop prediction">
					<ProGate
						feature="Pit stop prediction"
						teaser={`Where ${code} comes out if they box this lap, and whether it is into traffic.`}
					>
						<BoxNow driverNumber={number} />
					</ProGate>
				</RaceOnly>
			</div>
		</Panel>
	);
}
