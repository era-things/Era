import type { DateKey } from './calendar.ts';
import { normalizeDays } from './validation';

export const NUTRIENTS = [
	{ key: 'kcal', label: 'kcal', shortLabel: 'kcal', color: 'var(--ink)' },
	{ key: 'protein', label: 'Protein', shortLabel: 'P', color: '#286394' },
	{ key: 'fat', label: 'Fat', shortLabel: 'F', color: '#38713d' },
	{ key: 'carbs', label: 'Carbs', shortLabel: 'C', color: '#965015' }
] as const;
export type Nutrients = { kcal: number; protein: number; fat: number; carbs: number };
export type FoodItem = Nutrients & { id: string; name: string; quantity: number };
export type NutritionDays = Record<DateKey, FoodItem[]>;

export function validFoodItem(value: unknown): value is FoodItem {
	if (!value || typeof value !== 'object') return false;
	const item = value as Record<string, unknown>;
	return (
		typeof item.id === 'string' &&
		/^[a-zA-Z0-9-]{1,80}$/.test(item.id) &&
		typeof item.name === 'string' &&
		item.name.length <= 120 &&
		typeof item.quantity === 'number' &&
		Number.isSafeInteger(item.quantity) &&
		item.quantity >= 1 &&
		NUTRIENTS.every(
			({ key }) =>
				typeof item[key] === 'number' &&
				Number.isFinite(item[key]) &&
				item[key] >= 0 &&
				item[key] <= Number.MAX_SAFE_INTEGER
		)
	);
}

export function nutritionTotals(items: FoodItem[]): Nutrients {
	const totals: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
	for (const { key } of NUTRIENTS) {
		totals[key] =
			Math.round(items.reduce((sum, item) => sum + item[key] * item.quantity, 0) * 100) / 100;
	}
	return totals;
}

export function normalizeNutrition(value: unknown): NutritionDays {
	return normalizeDays(value, (entries) => {
		if (!Array.isArray(entries)) return;
		const ids = new Set<string>();
		return entries.filter((item): item is FoodItem => {
			if (!validFoodItem(item) || ids.has(item.id)) return false;
			ids.add(item.id);
			return true;
		});
	});
}

/** Most recent unique recipes before this day; quantity does not define a recipe. */
export function previousNutritionItems(days: NutritionDays, before: DateKey): FoodItem[] {
	const seen = new Set<string>();
	return Object.keys(days)
		.filter((day) => day < before)
		.sort()
		.reverse()
		.flatMap((day) =>
			days[day].filter((item) => {
				if (!item.name.trim()) return false;
				const key = JSON.stringify([item.name, ...NUTRIENTS.map(({ key }) => item[key])]);
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			})
		);
}
