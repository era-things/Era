import assert from 'node:assert/strict';
import test from 'node:test';
import {
	emptyNutrition,
	nutritionTotals,
	parseNutrition,
	setNutritionItems,
	validFoodItem,
	type FoodItem
} from '../src/lib/nutrition.ts';

const lunch: FoodItem = {
	id: 'lunch',
	name: 'Lunch',
	quantity: 1,
	kcal: 450,
	protein: 25.5,
	fat: 12,
	carbs: 55
};
const snack: FoodItem = {
	id: 'snack',
	name: 'Snack',
	quantity: 1,
	kcal: 100,
	protein: 0.1,
	fat: 2.5,
	carbs: 20.2
};

test('nutrition totals follow additions, edits and removal, including decimal macros', () => {
	assert.deepEqual(nutritionTotals([]), { kcal: 0, protein: 0, fat: 0, carbs: 0 });
	assert.deepEqual(nutritionTotals([lunch, snack]), {
		kcal: 550,
		protein: 25.6,
		fat: 14.5,
		carbs: 75.2
	});
	assert.equal(
		nutritionTotals([
			{ ...snack, protein: 0.1 },
			{ ...snack, protein: 0.2 }
		]).protein,
		0.3
	);
	assert.equal(nutritionTotals([{ ...lunch, kcal: 600 }, snack]).kcal, 700);
	assert.equal(nutritionTotals([snack]).kcal, 100);
});

test('quantities multiply every nutrient and round-trip through storage', () => {
	const doubled = { ...lunch, quantity: 2 };
	assert.deepEqual(nutritionTotals([doubled, snack]), {
		kcal: 1000,
		protein: 51.1,
		fat: 26.5,
		carbs: 130.2
	});
	assert.deepEqual(nutritionTotals([{ ...doubled, quantity: 1 }]), nutritionTotals([lunch]));
	const state = setNutritionItems({ ...emptyNutrition(), enabled: true }, '2026-11-05', [doubled]);
	assert.deepEqual(parseNutrition(JSON.stringify(state)), state);
	for (const quantity of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, undefined, '2']) {
		assert.equal(validFoodItem({ ...lunch, quantity }), false);
	}
});

test('food values must be named, finite and non-negative; zero and decimals are valid', () => {
	assert.equal(validFoodItem(lunch), true);
	assert.equal(validFoodItem({ ...lunch, kcal: 0, protein: 0 }), true);
	for (const kcal of [-1, Infinity, NaN, '100', null, undefined])
		assert.equal(validFoodItem({ ...lunch, kcal }), false);
	assert.equal(validFoodItem({ ...lunch, fat: -0.1 }), false);
	assert.equal(validFoodItem({ ...lunch, name: '  ' }), false);
});

test('day updates preserve other dates and disabling preserves food history', () => {
	const first = setNutritionItems({ ...emptyNutrition(), enabled: true }, '2026-11-05', [lunch]);
	const second = setNutritionItems(first, '2026-11-06', [snack]);
	const removed = setNutritionItems(second, '2026-11-05', []);
	assert.deepEqual(removed.days, { '2026-11-06': [snack] });
	assert.deepEqual(first.days, { '2026-11-05': [lunch] });
	const disabled = { ...second, enabled: false };
	assert.deepEqual(parseNutrition(JSON.stringify(disabled)), disabled);
	assert.deepEqual(
		parseNutrition(JSON.stringify({ ...disabled, enabled: true })).days,
		second.days
	);
});

test('nutrition storage discards malformed entries and duplicate food IDs per day', () => {
	assert.deepEqual(parseNutrition('{'), emptyNutrition());
	assert.deepEqual(
		parseNutrition(
			JSON.stringify({
				enabled: true,
				days: {
					'2026-02-30': [lunch],
					'2026-11-05': [lunch, lunch, { ...snack, kcal: -1 }, snack],
					'2026-11-06': [lunch]
				}
			})
		),
		{ enabled: true, days: { '2026-11-05': [lunch, snack], '2026-11-06': [lunch] } }
	);
});
