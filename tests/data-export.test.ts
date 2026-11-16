import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeDataExport, type CalendarData } from '../src/lib/data-export.ts';
import { emptyCalendar } from '../src/lib/calendar-records';
import { emptyLayout, setWidgetSettings } from '../src/lib/widgets';

test('export preserves all dates, zero/false values, emoji and reminder completion history', () => {
	const data: CalendarData = {
		time: { '2000-01-01': { phone: 135, gym: 0, reading: null, movie: 116, steam: 90 } },
		sleep: { '2000-01-01': { start: 1395, end: 420, duration: 465 } },
		layout: setWidgetSettings(emptyLayout(), 'weight', { pinned: true, skin: 'display' }),
		counters: { '2000-01-01': { weight: 72.5, steps: 0 } },
		notes: { '2000-01-01': 'First line\nSecond line', '2040-12-31': '  Keep spacing  ' },
		emojis: { '2000-01-01': '🎉', '2040-12-31': '⭐' },
		measures: {
			definitions: [
				{ id: 'hours', name: 'Hours worked', type: 'uint', palette: 'green' },
				{ id: 'read', name: 'Read', type: 'boolean', palette: 'blue' }
			],
			days: { '2000-01-01': { hours: 0, read: false }, '2040-12-31': { hours: null } }
		},
		nutrition: {
			'2000-01-01': [
				{ id: 'food', name: 'Lunch', quantity: 2, kcal: 500, protein: 25.5, fat: 10, carbs: 60 }
			]
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
	assert.deepEqual(JSON.parse(serializeDataExport(emptyCalendar(), now)).reminders, []);
});
