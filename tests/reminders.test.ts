import assert from 'node:assert/strict';
import test from 'node:test';
import {
	parseReminders,
	createReminder,
	reminderOccursOn,
	reminderOverridesEmoji,
	setReminderCompleted,
	type Reminder,
	type ReminderPeriod
} from '../src/lib/reminders.ts';

const reminder = (period: ReminderPeriod, start = '2026-10-31'): Reminder => ({
	id: 'test',
	text: 'Remember',
	period,
	start,
	overrideEmoji: false,
	leadDays: 0,
	completedDates: []
});
test('new reminders share defaults across quick-add and periodic creation', () => {
	const once = createReminder('  Remember  ', '2026-11-20');
	const periodic = createReminder('Repeat', '2026-11-20', 'monthly');
	assert.deepEqual({ ...once, id: 'test' }, reminder('once', '2026-11-20'));
	assert.equal(periodic.period, 'monthly');
	assert.notEqual(once.id, periodic.id);
	assert.deepEqual(parseReminders(JSON.stringify({ version: 1, reminders: [once, periodic] })), [
		once,
		periodic
	]);
});
test('reminders never occur before their start', () => {
	for (const period of ['weekly', 'monthly', 'yearly', 'once'] as const) {
		assert.equal(reminderOccursOn(reminder(period), '2026-10-30'), false);
		assert.equal(
			reminderOverridesEmoji(
				{ ...reminder(period), overrideEmoji: true, leadDays: 'always' },
				'2026-10-30',
				'2026-11-01'
			),
			false
		);
		assert.equal(reminderOccursOn(reminder(period), '2026-10-31'), true);
	}
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
					{ ...r, id: 'blank', text: '  ' },
					{ ...r, id: 'missing-override', overrideEmoji: undefined },
					{ ...r, id: 'missing-lead', leadDays: undefined },
					{ ...r, id: 'invalid-lead', leadDays: -1 },
					{ ...r, id: 'missing-completion', completedDates: undefined }
				]
			})
		),
		[r]
	);
	assert.deepEqual(parseReminders('{'), []);
});

test('completion dates are validated and deduplicated', () => {
	const r = {
		...reminder('weekly'),
		overrideEmoji: true,
		leadDays: 'always',
		completedDates: ['2026-10-31', '2026-10-31', 'bad', '2026-02-30']
	};
	assert.deepEqual(parseReminders(JSON.stringify({ version: 1, reminders: [r] }))[0], {
		...r,
		completedDates: ['2026-10-31']
	});
});

test('override starts at the lead-time boundary and stays active when overdue', () => {
	const r = { ...reminder('once'), overrideEmoji: true, leadDays: 3 };
	assert.equal(reminderOverridesEmoji(r, r.start, '2026-10-27'), false);
	assert.equal(reminderOverridesEmoji(r, r.start, '2026-10-28'), true);
	assert.equal(reminderOverridesEmoji(r, r.start, '2026-11-01'), true);
	assert.equal(reminderOverridesEmoji({ ...r, leadDays: 0 }, r.start, '2026-10-30'), false);
	assert.equal(reminderOverridesEmoji({ ...r, leadDays: 0 }, r.start, r.start), true);
	assert.equal(reminderOverridesEmoji({ ...r, leadDays: 'always' }, r.start, '2020-01-01'), true);
	assert.equal(reminderOverridesEmoji({ ...r, leadDays: 'always' }, '2026-11-01', r.start), false);
	assert.equal(reminderOverridesEmoji({ ...r, overrideEmoji: false }, r.start, r.start), false);
});

test('Done suppresses just one occurrence; Undo restores its override', () => {
	const r = { ...reminder('weekly'), overrideEmoji: true, leadDays: 'always' as const };
	const done = setReminderCompleted(r, r.start, true);
	assert.equal(reminderOverridesEmoji(done, r.start, r.start), false);
	assert.equal(reminderOverridesEmoji(done, '2026-11-07', r.start), true);
	assert.deepEqual(setReminderCompleted(done, r.start, true), done);
	assert.deepEqual(setReminderCompleted(done, r.start, false), r);
	assert.deepEqual(setReminderCompleted(r, '2026-11-01', true), r);
	assert.deepEqual(r.completedDates, []);
	assert.deepEqual(parseReminders(JSON.stringify({ version: 1, reminders: [done] })), [done]);
});
