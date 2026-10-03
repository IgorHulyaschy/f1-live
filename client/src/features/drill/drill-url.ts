/**
 * The driver, lap and compare views live in the address, beside the session and the replay
 * position, so Back closes them and a link opens them: `car=63` is the driver, `carLap=12` one of
 * their laps, `vs=1` the driver compared with, `vsLap` that driver's lap in the lap view.
 */
export const DRILL_PARAMS = ['car', 'carLap', 'vs', 'vsLap'] as const;

export type DrillView =
	| { kind: 'driver'; driverNumber: string }
	| { kind: 'compare'; driverNumber: string; vs: string }
	| {
			kind: 'lap';
			driverNumber: string;
			lap: number;
			/** Another driver's lap to compare with; `lap` null means their best. */
			vs: { driverNumber: string; lap: number | null } | null;
	  };

const DRIVER_NUMBER = /^\d{1,3}$/;

function driverParam(value: string | null): string | null {
	return value !== null && DRIVER_NUMBER.test(value) ? value : null;
}

function lapParam(value: string | null): number | null {
	const lap = Number(value);

	return value !== null && Number.isInteger(lap) && lap > 0 ? lap : null;
}

/** The view the address opens, or null; anything malformed opens none. */
export function readDrill(params: URLSearchParams): DrillView | null {
	const driverNumber = driverParam(params.get('car'));

	if (driverNumber === null) {
		return null;
	}

	const lap = lapParam(params.get('carLap'));
	const vs = driverParam(params.get('vs'));

	if (lap !== null) {
		return {
			kind: 'lap',
			driverNumber,
			lap,
			vs: vs === null ? null : { driverNumber: vs, lap: lapParam(params.get('vsLap')) }
		};
	}

	return vs !== null && vs !== driverNumber
		? { kind: 'compare', driverNumber, vs }
		: { kind: 'driver', driverNumber };
}

/** The address with `view` open instead of whatever was; null closes it. */
export function writeDrill(params: URLSearchParams, view: DrillView | null): URLSearchParams {
	const next = new URLSearchParams(params);

	for (const name of DRILL_PARAMS) {
		next.delete(name);
	}

	if (view === null) {
		return next;
	}

	next.set('car', view.driverNumber);

	if (view.kind === 'compare') {
		next.set('vs', view.vs);
	} else if (view.kind === 'lap') {
		next.set('carLap', String(view.lap));

		if (view.vs) {
			next.set('vs', view.vs.driverNumber);

			if (view.vs.lap !== null) {
				next.set('vsLap', String(view.vs.lap));
			}
		}
	}

	return next;
}
