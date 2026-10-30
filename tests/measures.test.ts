import assert from 'node:assert/strict';
import test from 'node:test';
import {
	parseMeasures,
	removeMeasure,
	validMeasureValue,
	type MeasuresState
} from '../src/lib/measures.ts';

const state: MeasuresState = {
	definitions: [
		{ id: 'steps', name: 'Steps', type: 'uint', palette: 'blue' },
		{ id: 'read', name: 'Read', type: 'boolean', palette: 'green' }
	],
	days: { '2026-10-30': { steps: 0, read: false }, '2026-10-31': { steps: null } }
};
test('measure persistence distinguishes empty numbers, zero and false', () => {
	assert.deepEqual(parseMeasures(JSON.stringify({ version: 1, ...state })), state);
});
test('unsigned values must be safe non-negative integers', () => {
	for (const value of [-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '12', true])
		assert.equal(validMeasureValue('uint', value), false);
	for (const value of [null, 0, 20, Number.MAX_SAFE_INTEGER])
		assert.equal(validMeasureValue('uint', value), true);
	assert.equal(validMeasureValue('boolean', 0), false);
	assert.equal(validMeasureValue('boolean', false), true);
});
test('invalid saved entries and orphaned day values are discarded', () => {
	const saved = {
		version: 1,
		definitions: [
			...state.definitions,
			{ id: '__proto__', name: 'Bad', type: 'uint', palette: 'green' },
			{ id: 'bad', name: 'Bad', type: 'uint', palette: 'unknown' }
		],
		days: {
			'2026-02-30': { steps: 1 },
			'2026-10-30': { steps: -1, read: 'false', missing: 4 },
			'2026-10-31': { steps: 3, read: true }
		}
	};
	assert.deepEqual(parseMeasures(JSON.stringify(saved)), {
		definitions: state.definitions,
		days: { '2026-10-31': { steps: 3, read: true } }
	});
	assert.deepEqual(parseMeasures('{'), { definitions: [], days: {} });
});
test('deleting a definition removes all its day values and empty dates', () => {
	assert.deepEqual(removeMeasure(state, 'steps'), {
		definitions: [state.definitions[1]],
		days: { '2026-10-30': { read: false } }
	});
	assert.equal(state.days['2026-10-30'].steps, 0);
});
