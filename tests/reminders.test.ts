import assert from 'node:assert/strict';
import test from 'node:test';
import {
	parseReminders,
	reminderOccursOn,
	type Reminder,
	type ReminderPeriod
} from '../src/lib/reminders.ts';

const reminder = (period: ReminderPeriod, start = '2026-10-31'): Reminder => ({
	id: 'test',
	text: 'Remember',
	period,
	start
});
test('daily, weekly and one-time reminders never occur before their start', () => {
	for (const period of ['daily', 'weekly', 'monthly', 'yearly', 'once'] as const) {
		assert.equal(reminderOccursOn(reminder(period), '2026-10-30'), false);
		assert.equal(reminderOccursOn(reminder(period), '2026-10-31'), true);
	}
	assert.equal(reminderOccursOn(reminder('daily'), '2027-01-01'), true);
	assert.equal(reminderOccursOn(reminder('weekly'), '2026-11-07'), true);
	assert.equal(reminderOccursOn(reminder('weekly'), '2026-11-08'), false);
	assert.equal(reminderOccursOn(reminder('once'), '2026-11-01'), false);
});
test('monthly reminders clamp to the month end without shifting later occurrences', () => {
	const r = reminder('monthly', '2024-01-31');
	for (const date of ['2024-02-29', '2024-03-31', '2024-04-30', '2025-02-28'])
		assert.equal(reminderOccursOn(r, date), true);
	for (const date of ['2024-02-28', '2024-03-30', '2024-04-29'])
		assert.equal(reminderOccursOn(r, date), false);
});
test('yearly leap-day reminders use February 28 in non-leap years', () => {
	const r = reminder('yearly', '2024-02-29');
	assert.equal(reminderOccursOn(r, '2025-02-28'), true);
	assert.equal(reminderOccursOn(r, '2028-02-29'), true);
	assert.equal(reminderOccursOn(r, '2028-02-28'), false);
	assert.equal(reminderOccursOn(r, '2025-03-29'), false);
});
test('saved reminders round-trip and invalid entries are discarded', () => {
	const r = reminder('once');
	assert.deepEqual(parseReminders(JSON.stringify({ version: 1, reminders: [r] })), [r]);
	assert.deepEqual(
		parseReminders(
			JSON.stringify({
				version: 1,
				reminders: [
					r,
					r,
					{ ...r, id: 'bad-date', start: '2026-02-30' },
					{ ...r, id: 'bad-period', period: 'hourly' },
					{ ...r, id: 'blank', text: '  ' }
				]
			})
		),
		[r]
	);
	assert.deepEqual(parseReminders('{'), []);
});
