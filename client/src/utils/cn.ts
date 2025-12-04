import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for merging Tailwind CSS classes with CSS Modules
 * Combines clsx for conditional classes and tailwind-merge for Tailwind class conflicts
 *
 * @param inputs - Class values to merge
 * @returns Merged class string
 *
 * @example
 * cn('px-4 py-2', styles.button, isActive && 'bg-blue-500')
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
