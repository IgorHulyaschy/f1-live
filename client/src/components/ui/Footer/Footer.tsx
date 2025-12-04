import styles from './styles.module.css';

import { Logo } from '@/components/common';

export default function Footer() {
	const currentYear = new Date().getFullYear();

	return (
		<footer className={styles.footer}>
			<div className={styles.container}>
				<div className={styles.topSection}>
					{/* Branding */}
					<div className={styles.brand}>
						<div className={styles.logo}>
							<Logo />
						</div>
						<div>
							<div className={styles.brandName}>F1 Livetime Project</div>
							<div className={styles.brandTagline}>
								Company Limited Corp Pro Max EA Sports
							</div>
						</div>
					</div>

					{/* Links Grid */}
					<div className={styles.linksGrid}>
						{/* Product */}
						<div className={styles.linkColumn}>
							<h3 className={styles.columnTitle}>Product</h3>
							<a href="#" className={styles.link}>
								Live Standings
							</a>
							<a href="#" className={styles.link}>
								Race Analytics
							</a>
							<a href="#" className={styles.link}>
								Team Stats
							</a>
							<a href="#" className={styles.link}>
								Driver Profiles
							</a>
						</div>

						{/* Company */}
						<div className={styles.linkColumn}>
							<h3 className={styles.columnTitle}>Company</h3>
							<a href="#" className={styles.link}>
								About Us
							</a>
							<a href="#" className={styles.link}>
								Careers
							</a>
							<a href="#" className={styles.link}>
								Press Kit
							</a>
							<a href="#" className={styles.link}>
								Contact
							</a>
						</div>

						{/* Resources */}
						<div className={styles.linkColumn}>
							<h3 className={styles.columnTitle}>Resources</h3>
							<a href="#" className={styles.link}>
								Documentation
							</a>
							<a href="#" className={styles.link}>
								API Reference
							</a>
							<a href="#" className={styles.link}>
								Support
							</a>
							<a href="#" className={styles.link}>
								Status
							</a>
						</div>
					</div>
				</div>

				{/* Divider */}
				<div className={styles.divider} />

				{/* Bottom Section */}
				<div className={styles.bottomSection}>
					<div className={styles.copyright}>
						� {currentYear} F1 Livetime Project. All rights reserved.
					</div>
					<div className={styles.legalLinks}>
						<a href="#" className={styles.legalLink}>
							Privacy Policy
						</a>
						<span className={styles.separator}>"</span>
						<a href="#" className={styles.legalLink}>
							Terms of Service
						</a>
						<span className={styles.separator}>"</span>
						<a href="#" className={styles.legalLink}>
							Cookie Policy
						</a>
					</div>
				</div>
			</div>

			{/* Fancy Background Gradient */}
			<div className={styles.gradient} />
		</footer>
	);
}
