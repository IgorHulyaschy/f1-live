import { noticeFrom, noticeUrl, sameSiteUrl } from './push-notice.ts';

/**
 * Web Push in the service worker: shows what the server sent and opens the app when a notice is
 * tapped. The shell worker (service-worker.ts) only calls `installPush`, so a different worker
 * could do the same.
 */
export function installPush(scope: ServiceWorkerGlobalScope): void {
	scope.addEventListener('push', (event) => {
		const notice = noticeFrom(event.data?.text() ?? null);

		event.waitUntil(
			scope.registration.showNotification(notice.title, {
				body: notice.body,
				// Notices with a tag replace each other: two devices, or a retry, show one.
				tag: notice.tag,
				icon: '/icons/icon-192.png',
				data: { url: notice.url }
			})
		);
	});

	scope.addEventListener('notificationclick', (event) => {
		event.notification.close();

		const url = sameSiteUrl(noticeUrl(event.notification.data), scope.location.origin);

		event.waitUntil(focusOrOpen(scope, url));
	});
}

async function focusOrOpen(scope: ServiceWorkerGlobalScope, url: string): Promise<void> {
	const windows = await scope.clients.matchAll({ type: 'window', includeUncontrolled: true });
	const open = windows[0];

	if (open) {
		await open.focus();
		await open.navigate(url).catch(() => undefined);

		return;
	}

	await scope.clients.openWindow(url);
}
