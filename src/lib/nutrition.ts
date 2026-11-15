import { isDateKey, type DateKey } from './calendar.ts';

export const NUTRIENTS = [
	{ key: 'kcal', label: 'kcal', shortLabel: 'kcal', color: 'var(--ink)' },
	{ key: 'protein', label: 'Protein', shortLabel: 'P', color: '#286394' },
	{ key: 'fat', label: 'Fat', shortLabel: 'F', color: '#38713d' },
	{ key: 'carbs', label: 'Carbs', shortLabel: 'C', color: '#965015' }
] as const;
export type Nutrients = { kcal: number; protein: number; fat: number; carbs: number };
export type FoodItem = Nutrients & { id: string; name: string; quantity: number };
export type NutritionState = { pinned: boolean; days: Record<DateKey, FoodItem[]> };
export const emptyNutrition = (): NutritionState => ({ pinned: false, days: {} });

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

export function setNutritionItems(
	state: NutritionState,
	day: DateKey,
	items: FoodItem[]
): NutritionState {
	const days = { ...state.days };
	days[day] = items;
	return { ...state, days };
}

export function parseNutrition(raw: string | null): NutritionState {
	try {
		const saved = JSON.parse(raw ?? 'null');
		if (
			!saved ||
			typeof saved.pinned !== 'boolean' ||
			!saved.days ||
			typeof saved.days !== 'object' ||
			Array.isArray(saved.days)
		)
			return emptyNutrition();
		const days: NutritionState['days'] = {};
		for (const [day, entries] of Object.entries(saved.days)) {
			if (!isDateKey(day) || !Array.isArray(entries)) continue;
			const ids = new Set<string>();
			const items = entries.filter((item): item is FoodItem => {
				if (!validFoodItem(item) || ids.has(item.id)) return false;
				ids.add(item.id);
				return true;
			});
			days[day] = items;
		}
		return { pinned: saved.pinned, days };
	} catch {
		return emptyNutrition();
	}
}

/** Most recent unique recipes before this day; quantity does not define a recipe. */
export function previousNutritionItems(days: NutritionState['days'], before: DateKey): FoodItem[] {
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
