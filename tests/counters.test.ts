import { test, expect } from 'bun:test';
import { normalizeCounters } from '../src/lib/counters';
import { validCounterValue } from '../src/lib/widgets';

test('weight accepts decimals while steps require non-negative safe whole numbers', () => {
	for (const value of [-1, Infinity, NaN, '72', null, true, Number.MAX_SAFE_INTEGER + 1]) {
		expect(validCounterValue('weight', value)).toBe(false);
		expect(validCounterValue('steps', value)).toBe(false);
	}
	expect(validCounterValue('weight', 72.65)).toBe(true);
	expect(validCounterValue('steps', 72.65)).toBe(false);
	expect(validCounterValue('steps', 0)).toBe(true);
});
test('counter normalization filters invalid dates and values, preserving empty attached counters', () => {
	expect(
		normalizeCounters({
			'2026-02-30': { weight: 72 },
			'2026-11-15': { weight: 72.65, steps: 1.5, unknown: 4 },
			'2026-11-16': { steps: 0, weight: null },
			'2026-11-17': { weight: -1 }
		})
	).toEqual({ '2026-11-15': { weight: 72.65 }, '2026-11-16': { steps: 0, weight: null } });
});
