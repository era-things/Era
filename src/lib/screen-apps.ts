import { isRecord, normalizeDays } from './validation';

export type ScreenApp = {
	package: string;
	name: string;
	minutes: number;
	lastUsed?: string;
};

export type ScreenAppShare = ScreenApp & { share: number };

export function screenAppShares(
	apps: readonly ScreenApp[],
	duration: number | null
): ScreenAppShare[] {
	const total = Math.max(duration ?? 0, apps.reduce((sum, app) => sum + app.minutes, 0));
	return [...apps]
		.sort((a, b) => b.minutes - a.minutes)
		.map((app) => ({
			...app,
			name: app.name.trim() || app.package,
			share: total === 0 ? 0 : (app.minutes / total) * 100
		}));
}

export function validScreenApps(value: unknown): value is ScreenApp[] {
	if (!Array.isArray(value)) return false;
	const packages = new Set<string>();
	for (const app of value) {
		if (
			!isRecord(app) ||
			Object.keys(app).some((key) => !['package', 'name', 'minutes', 'lastUsed'].includes(key)) ||
			typeof app.package !== 'string' ||
			!app.package.trim() ||
			packages.has(app.package) ||
			typeof app.name !== 'string' ||
			typeof app.minutes !== 'number' ||
			!Number.isInteger(app.minutes) ||
			app.minutes < 0 ||
			app.minutes > 1440 ||
			(Object.hasOwn(app, 'lastUsed') &&
				(typeof app.lastUsed !== 'string' || !Number.isFinite(Date.parse(app.lastUsed))))
		) return false;
		packages.add(app.package);
	}
	return true;
}

export const normalizeScreenApps = (value: unknown) =>
	normalizeDays(value, (apps) => (validScreenApps(apps) ? apps : undefined));
