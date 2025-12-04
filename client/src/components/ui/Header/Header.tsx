import { Link, useLocation } from 'react-router-dom';

import styles from './styles.module.css';

import { Logo } from '@/components/common';

export default function Header() {
	const location = useLocation();

	const isActive = (path: string) => location.pathname === path;

	return (
		<header className={styles.header}>
			<div className={styles.container}>
				<div className={styles.leftSection}>
					{/* Logo & Brand */}
					<Link to="/" className={styles.logo}>
						<div className={styles.logoIcon}>
							<Logo />
						</div>

						<span className={styles.brandName}>
							F1 <span className={styles.brandLive}>LIVE</span>
						</span>
					</Link>

					{/* Live Badge */}
					<div className={styles.liveBadge}>
						<span className={styles.liveDot} />
						LIVE
					</div>
				</div>

				{/* Navigation */}
				<nav className={styles.nav}>
					<Link to="/" className={styles.navLink} data-active={isActive('/')}>
						Race Standings
					</Link>
					<Link
						to="/simple-live"
						className={styles.navLink}
						data-active={isActive('/simple-live')}
					>
						Simple Live
					</Link>
					<Link
						to="/graphics"
						className={styles.navLink}
						data-active={isActive('/graphics')}
					>
						Graphics
					</Link>
				</nav>
			</div>
		</header>
	);
}
