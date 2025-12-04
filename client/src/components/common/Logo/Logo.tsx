export default function Logo(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
			<path
				d="M3 8L8 3L21 3L21 8L16 13L21 13L21 21L8 21L3 16L8 16L3 8Z"
				fill="currentColor"
			/>
		</svg>
	);
}
