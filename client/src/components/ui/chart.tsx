import * as React from 'react';
import * as RechartsPrimitive from 'recharts';
import type { LegendPayload, TooltipPayloadEntry } from 'recharts';

import { cn } from '@/lib/utils';

/** Theme name and the selector that activates it. */
const THEMES = [
	['light', ''],
	['dark', '.dark']
] as const;

type ThemeName = (typeof THEMES)[number][0];

export type ChartConfig = Record<
	string,
	{
		label?: React.ReactNode;
		icon?: React.ComponentType;
	} & ({ color?: string; theme?: never } | { color?: never; theme: Record<ThemeName, string> })
>;

type ChartContextProps = {
	config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
	const context = React.useContext(ChartContext);

	if (!context) {
		throw new Error('useChart must be used within a <ChartContainer />');
	}

	return context;
}

function ChartContainer({
	id,
	className,
	children,
	config,
	...props
}: React.ComponentProps<'div'> & {
	config: ChartConfig;
	children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
}) {
	const uniqueId = React.useId();
	const chartId = `chart-${id ?? uniqueId.replaceAll(':', '')}`;
	const contextValue = React.useMemo(() => ({ config }), [config]);

	return (
		<ChartContext.Provider value={contextValue}>
			<div
				data-slot="chart"
				data-chart={chartId}
				className={cn(
					"[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
					className
				)}
				{...props}
			>
				<ChartStyle id={chartId} config={config} />
				<RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
			</div>
		</ChartContext.Provider>
	);
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
	const colorConfig = Object.entries(config).filter(([, entry]) => entry.theme ?? entry.color);

	if (colorConfig.length === 0) {
		return null;
	}

	const css = THEMES.map(([theme, prefix]) => {
		const declarations = colorConfig
			.map(([key, itemConfig]) => {
				const color = itemConfig.theme?.[theme] ?? itemConfig.color;

				return color ? `  --color-${key}: ${color};` : null;
			})
			.join('\n');

		return `${prefix} [data-chart=${id}] {\n${declarations}\n}`;
	}).join('\n');

	return <style>{css}</style>;
}

const ChartTooltip = RechartsPrimitive.Tooltip;

type ChartTooltipContentProps = {
	active?: boolean;
	payload?: ReadonlyArray<TooltipPayloadEntry>;
	label?: React.ReactNode;
	className?: string;
	indicator?: 'line' | 'dot' | 'dashed';
	hideLabel?: boolean;
	hideIndicator?: boolean;
	labelFormatter?: (label: React.ReactNode) => React.ReactNode;
	valueFormatter?: (value: number) => string;
	nameKey?: string;
};

function ChartTooltipContent({
	active,
	payload,
	label,
	className,
	indicator = 'dot',
	hideLabel = false,
	hideIndicator = false,
	labelFormatter,
	valueFormatter,
	nameKey
}: ChartTooltipContentProps) {
	const { config } = useChart();

	if (!active || !payload?.length) {
		return null;
	}

	const nestLabel = payload.length === 1 && indicator !== 'dot';

	const tooltipLabel = hideLabel ? null : (
		<div className="font-medium">{labelFormatter ? labelFormatter(label) : label}</div>
	);

	return (
		<div
			className={cn(
				'border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl',
				className
			)}
		>
			{nestLabel ? null : tooltipLabel}
			<div className="grid gap-1.5">
				{payload
					.filter((item) => item.type !== 'none')
					.map((item) => {
						const key = String(nameKey ?? item.name ?? item.dataKey ?? 'value');
						const itemConfig = config[key];
						const indicatorColor = item.color ?? item.stroke ?? item.fill;
						const value = item.value;

						return (
							<div
								key={key}
								className={cn(
									'[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5',
									indicator === 'dot' && 'items-center'
								)}
							>
								{hideIndicator ? null : (
									<div
										className={cn(
											'shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)',
											{
												'h-2.5 w-2.5': indicator === 'dot',
												'w-1': indicator === 'line',
												'w-0 border-[1.5px] border-dashed bg-transparent': indicator === 'dashed',
												'my-0.5': nestLabel && indicator === 'dashed'
											}
										)}
										style={{ '--color-bg': indicatorColor, '--color-border': indicatorColor }}
									/>
								)}
								<div
									className={cn(
										'flex flex-1 justify-between gap-4 leading-none',
										nestLabel ? 'items-end' : 'items-center'
									)}
								>
									<div className="grid gap-1.5">
										{nestLabel ? tooltipLabel : null}
										<span className="text-muted-foreground">{itemConfig?.label ?? item.name}</span>
									</div>
									{value === undefined ? null : (
										<span className="text-foreground font-mono font-medium tabular-nums">
											{valueFormatter && !Array.isArray(value)
												? valueFormatter(Number(value))
												: String(value)}
										</span>
									)}
								</div>
							</div>
						);
					})}
			</div>
		</div>
	);
}

const ChartLegend = RechartsPrimitive.Legend;

function ChartLegendContent({
	className,
	hideIcon = false,
	payload,
	verticalAlign = 'bottom'
}: {
	className?: string;
	hideIcon?: boolean;
	payload?: ReadonlyArray<LegendPayload>;
	verticalAlign?: 'top' | 'middle' | 'bottom';
}) {
	const { config } = useChart();

	if (!payload?.length) {
		return null;
	}

	return (
		<div
			className={cn(
				'flex flex-wrap items-center justify-center gap-x-4 gap-y-1',
				verticalAlign === 'top' ? 'pb-3' : 'pt-3',
				className
			)}
		>
			{payload
				.filter((item) => item.type !== 'none')
				.map((item) => {
					const key = String(item.dataKey ?? item.value ?? 'value');
					const itemConfig = config[key];

					return (
						<div
							key={key}
							className="[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3"
						>
							{itemConfig?.icon && !hideIcon ? (
								<itemConfig.icon />
							) : (
								<div
									className="h-2 w-2 shrink-0 rounded-[2px] bg-(--color-bg)"
									style={{ '--color-bg': item.color }}
								/>
							)}
							{itemConfig?.label ?? item.value}
						</div>
					);
				})}
		</div>
	);
}

export {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	ChartLegend,
	ChartLegendContent,
	ChartStyle
};
