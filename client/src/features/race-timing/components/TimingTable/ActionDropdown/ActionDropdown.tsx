import { motion } from 'framer-motion';

export default function ActionDropdown({ isOpen }: { isOpen: boolean }) {
	if (!isOpen) return null;

	return (
		<motion.div
			className="absolute right-2 top-full mt-1 bg-[#1a1a1a] border border-white/8 rounded-lg shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-100 min-w-[150px] overflow-hidden"
			initial={{ opacity: 0, y: -8 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -8 }}
			transition={{ duration: 0.12 }}
		>
			{['Lap Times', 'Driver Profile', 'Team Radio', 'Onboard'].map((item) => (
				<div
					key={item}
					className="px-3.5 py-2.5 text-[13px] text-[#888] cursor-pointer transition-all duration-100 hover:bg-white/5 hover:text-white"
				>
					{item}
				</div>
			))}
		</motion.div>
	);
}
