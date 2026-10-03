/**
 * What each plan allows, in one place: the account server enforces it and the app explains it.
 * The split is the owner's to decide; these values are the default in
 * docs/product/dashboards.md#free-and-pro.
 */

export const PLAN_IDS = ['free', 'pro'] as const;

export type PlanId = (typeof PLAN_IDS)[number];

/** How often Pro is billed; the prices themselves live with the payment provider. */
export const BILLING_INTERVALS = ['month', 'year'] as const;

export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export type Entitlements = {
	/** Dashboards of the viewer's own; edited ready-made ones do not count. `null` is any number. */
	ownDashboards: number | null;
	shareLinks: boolean;
	proTiles: boolean;
	publish: boolean;
};

export const PLAN_ENTITLEMENTS = {
	free: { ownDashboards: 3, shareLinks: true, proTiles: false, publish: false },
	pro: { ownDashboards: null, shareLinks: true, proTiles: true, publish: true }
} as const satisfies Record<PlanId, Entitlements>;

export function canAddOwnDashboard(entitlements: Entitlements, ownCount: number): boolean {
	return entitlements.ownDashboards === null || ownCount < entitlements.ownDashboards;
}
