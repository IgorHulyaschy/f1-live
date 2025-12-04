import classNames from 'classnames';

import { ArrowDownIcon, ArrowUpIcon } from '@/components/ui/Icons';

export default function PositionChange({ change }: { change: number }) {
	if (change === 0) return null;

	const changeClasses = classNames(
		'inline-flex items-center gap-0.5 text-[10px] font-semibold ml-1',
		{
			'text-[#22c55e]': change > 0,
			'text-[#ef4444]': change < 0
		}
	);

	if (change > 0) {
		return (
			<span className={changeClasses}>
				<ArrowUpIcon />
				{change}
			</span>
		);
	}

	return (
		<span className={changeClasses}>
			<ArrowDownIcon />
			{Math.abs(change)}
		</span>
	);
}
