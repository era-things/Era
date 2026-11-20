import assert from 'node:assert/strict';
import test from 'node:test';
import {
	nutritionTotals,
	previousNutritionItems,
	normalizeNutrition,
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

const blank: FoodItem = {
	id: 'blank',
	name: '',
	quantity: 1,
	kcal: 0,
	protein: 0,
	fat: 0,
	carbs: 0
};

test('nutrition totals follow additions, edits and removal, including decimal macros', () => {
	assert.deepEqual(nutritionTotals([blank]), nutritionTotals([]));
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

test('quantities multiply every nutrient and allow positive values with up to two decimals', () => {
	const doubled = { ...lunch, quantity: 2 };
	assert.deepEqual(nutritionTotals([doubled, snack]), {
		kcal: 1000,
		protein: 51.1,
		fat: 26.5,
		carbs: 130.2
	});
	assert.deepEqual(nutritionTotals([{ ...doubled, quantity: 1 }]), nutritionTotals([lunch]));
	const fraction = { ...lunch, quantity: 0.25 };
	assert.equal(validFoodItem(fraction), true);
	assert.equal(validFoodItem({ ...lunch, quantity: Number.MAX_SAFE_INTEGER }), true);
	assert.deepEqual(nutritionTotals([fraction]), {
		kcal: 112.5,
		protein: 6.38,
		fat: 3,
		carbs: 13.75
	});
	for (const quantity of [
		0,
		-1,
		1.125,
		0.001,
		NaN,
		Infinity,
		Number.MAX_SAFE_INTEGER + 1,
		undefined,
		'2'
	]) {
		assert.equal(validFoodItem({ ...lunch, quantity }), false);
	}
});

test('food values must be finite and non-negative; blank names, zero and decimals are valid', () => {
	assert.equal(validFoodItem(lunch), true);
	assert.equal(validFoodItem({ ...lunch, kcal: 0, protein: 0 }), true);
	for (const kcal of [-1, Infinity, NaN, '100', null, undefined])
		assert.equal(validFoodItem({ ...lunch, kcal }), false);
	assert.equal(validFoodItem({ ...lunch, fat: -0.1 }), false);
	assert.equal(validFoodItem({ ...lunch, name: '' }), true);
});

test('nutrition normalization preserves empty days, blank rows and quantities, filtering invalid entries', () => {
	assert.deepEqual(normalizeNutrition(null), {});
	assert.deepEqual(
		normalizeNutrition({
			'2026-02-30': [lunch],
			'2026-11-05': [lunch, lunch, { ...snack, kcal: -1 }, snack, blank],
			'2026-11-06': [{ ...lunch, quantity: 2 }],
			'2026-11-07': []
		}),
		{
			'2026-11-05': [lunch, snack, blank],
			'2026-11-06': [{ ...lunch, quantity: 2 }],
			'2026-11-07': []
		}
	);
});

test('previous items exclude current/future days and blank rows, deduplicating recipes regardless of quantity', () => {
	const recent = { ...lunch, id: 'recent', quantity: 4 };
	const variation = { ...lunch, id: 'variation', kcal: 600 };
	assert.deepEqual(
		previousNutritionItems(
			{
				'2026-11-01': [lunch, snack],
				'2026-11-04': [recent, variation, blank],
				'2026-11-05': [{ ...snack, name: 'Current' }],
				'2026-11-06': [{ ...snack, name: 'Future' }]
			},
			'2026-11-05'
		),
		[recent, variation, snack]
	);
});
