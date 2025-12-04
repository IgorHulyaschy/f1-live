import type { ReactNode } from 'react';

import Footer from '../Footer';
import Header from '../Header';
import styles from './styles.module.css';

interface LayoutProps {
	children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
	return (
		<div className={styles.layout}>
			<Header />

			<main className={styles.main}>{children}</main>

			<Footer />
		</div>
	);
}
