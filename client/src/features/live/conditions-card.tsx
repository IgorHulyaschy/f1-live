import { CloudRainIcon, DropletsIcon, ThermometerIcon, WindIcon } from 'lucide-react';
import type * as React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRace } from '@/data/race-context';

function Reading({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
	return (
		<div className="flex items-center gap-2">
			<span className="text-muted-foreground">{icon}</span>
			<div>
				<div className="text-muted-foreground text-xs">{label}</div>
				<div className="font-mono text-sm tabular-nums">{value}</div>
			</div>
		</div>
	);
}

export function ConditionsCard() {
	const { snapshot } = useRace();
	const weather = snapshot.weather.at(-1);

	if (!weather) {
		return null;
	}

	return (
		<Card size="sm">
			<CardHeader>
				<CardTitle>Conditions</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-2 gap-3">
					<Reading
						icon={<ThermometerIcon className="size-4" />}
						label="Track"
						value={`${weather.trackTempC.toFixed(1)} °C`}
					/>
					<Reading
						icon={<ThermometerIcon className="size-4" />}
						label="Air"
						value={`${weather.airTempC.toFixed(1)} °C`}
					/>
					<Reading
						icon={<DropletsIcon className="size-4" />}
						label="Humidity"
						value={`${weather.humidityPct}%`}
					/>
					<Reading
						icon={
							weather.rainfall ? (
								<CloudRainIcon className="size-4" />
							) : (
								<WindIcon className="size-4" />
							)
						}
						label={weather.rainfall ? 'Rain' : 'Wind'}
						value={weather.rainfall ? 'Falling' : `${weather.windSpeedMs.toFixed(1)} m/s`}
					/>
				</div>
			</CardContent>
		</Card>
	);
}
