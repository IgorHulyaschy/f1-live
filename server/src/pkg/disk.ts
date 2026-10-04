import { mkdir, readdir, stat, statfs } from 'node:fs/promises';
import path from 'node:path';

export const GB = 1e9;

/** Free space on the disk that holds the directory, for an unprivileged writer. */
export async function freeBytes(directory: string): Promise<number> {
	// A fresh data folder has none of its subfolders yet; its disk is the nearest folder that exists.
	await mkdir(directory, { recursive: true });

	const { bavail, bsize } = await statfs(directory);

	return bavail * bsize;
}

/** What a folder takes on disk, its files' allocated blocks rather than their lengths; 0 when absent. */
export async function sizeOnDisk(target: string): Promise<number> {
	const info = await stat(target).catch(() => null);

	if (info === null) {
		return 0;
	}

	if (!info.isDirectory()) {
		return info.blocks * 512;
	}

	const entries = await readdir(target);
	const sizes = await Promise.all(entries.map((entry) => sizeOnDisk(path.join(target, entry))));

	return sizes.reduce((sum, size) => sum + size, info.blocks * 512);
}

export interface DiskRoom {
	freeBytes: number;
	floorBytes: number;
}

/** Whether writing `needBytes` leaves at least the floor free. */
export function hasRoom(disk: DiskRoom, needBytes: number): boolean {
	return disk.freeBytes - needBytes >= disk.floorBytes;
}

/** "12.3 GB free, below the 10 GB floor", for a stop message. */
export function describeShortfall(disk: DiskRoom, needBytes: number): string {
	const need = needBytes > 0 ? ` and ${(needBytes / GB).toFixed(1)} GB needed` : '';

	return `${(disk.freeBytes / GB).toFixed(1)} GB free${need}, below the ${(disk.floorBytes / GB).toFixed(0)} GB floor`;
}
