import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeDataExport, type CalendarData } from '../src/lib/data-export.ts';

test('export preserves all dates, zero/false values, emoji and reminder completion history', () => {
	const data: CalendarData = {
		emojis: { '2000-01-01': '🎉', '2040-12-31': '⭐' },
		measures: {
			definitions: [
				{ id: 'hours', name: 'Hours worked', type: 'uint', palette: 'green' },
				{ id: 'read', name: 'Read', type: 'boolean', palette: 'blue' }
			],
			days: { '2000-01-01': { hours: 0, read: false }, '2040-12-31': { hours: null } }
		},
		nutrition: {
			enabled: false,
			days: {
				'2000-01-01': [
					{ id: 'food', name: 'Lunch', quantity: 2, kcal: 500, protein: 25.5, fat: 10, carbs: 60 }
				]
			}
		},
		reminders: [
			{
				id: 'rent',
				text: 'Rent',
				period: 'monthly',
				start: '2026-11-01',
				overrideEmoji: true,
				leadDays: 'always',
				completedDates: ['2026-11-01']
			}
		]
	};
	const now = new Date('2026-11-01T12:00:00Z');
	assert.deepEqual(JSON.parse(serializeDataExport(data, now)), {
		app: 'Era',
		exportedAt: now.toISOString(),
		...data
	});
	assert.deepEqual(
		JSON.parse(
			serializeDataExport(
				{
					emojis: {},
					measures: { definitions: [], days: {} },
					reminders: [],
					nutrition: { enabled: false, days: {} }
				},
				now
			)
		).reminders,
		[]
	);
});
