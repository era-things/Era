import { asDate, daysBetween, isDateKey, type DateKey } from './calendar.ts';

export const REMINDERS_STORAGE_KEY = 'era:reminders:v1';
export const PERIODIC_PERIODS = [
	{ value: 'weekly', label: 'Weekly' },
	{ value: 'monthly', label: 'Monthly' },
	{ value: 'yearly', label: 'Yearly' }
] as const;
export type PeriodicPeriod = (typeof PERIODIC_PERIODS)[number]['value'];
export type ReminderPeriod = 'once' | PeriodicPeriod;
export type Reminder = {
	id: string;
	text: string;
	period: ReminderPeriod;
	start: DateKey;
	overrideEmoji: boolean;
	leadDays: number | 'always';
	completedDates: DateKey[];
};

export function createReminder(
	text: string,
	start: DateKey,
	period: ReminderPeriod = 'once'
): Reminder {
	return {
		id: crypto.randomUUID(),
		text: text.trim(),
		start,
		period,
		overrideEmoji: false,
		leadDays: 0,
		completedDates: []
	};
}

export function isReminderLeadDays(value: unknown): value is Reminder['leadDays'] {
	return (
		value === 'always' || (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0)
	);
}

export function reminderOverridesEmoji(reminder: Reminder, day: DateKey, today: DateKey): boolean {
	return (
		reminder.overrideEmoji &&
		!reminder.completedDates.includes(day) &&
		(reminder.leadDays === 'always' || daysBetween(today, day) <= reminder.leadDays) &&
		reminderOccursOn(reminder, day)
	);
}

export function setReminderCompleted(
	reminder: Reminder,
	day: DateKey,
	completed: boolean
): Reminder {
	if (!reminderOccursOn(reminder, day)) return reminder;
	const dates = new Set(reminder.completedDates);
	if (completed) dates.add(day);
	else dates.delete(day);
	return { ...reminder, completedDates: [...dates].sort() };
}

/** Each occurrence uses the original start day, clamped for shorter months. */
export function reminderOccursOn(reminder: Reminder, day: DateKey): boolean {
	if (day < reminder.start) return false;
	if (reminder.period === 'once') return day === reminder.start;
	if (reminder.period === 'weekly') return daysBetween(reminder.start, day) % 7 === 0;
	const start = asDate(reminder.start);
	const date = asDate(day);
	if (reminder.period === 'yearly' && start.getUTCMonth() !== date.getUTCMonth()) return false;
	const monthEnd = new Date(date.getTime());
	monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
	return date.getUTCDate() === Math.min(start.getUTCDate(), monthEnd.getUTCDate());
}

export function parseReminders(raw: string | null): Reminder[] {
	try {
		const saved = JSON.parse(raw ?? 'null');
		if (saved?.version !== 1 || !Array.isArray(saved.reminders)) return [];
		const reminders: Reminder[] = [];
		for (const item of saved.reminders) {
			if (
				!item ||
				typeof item.id !== 'string' ||
				!/^[a-zA-Z0-9-]{1,80}$/.test(item.id) ||
				reminders.some((r) => r.id === item.id) ||
				typeof item.text !== 'string' ||
				!item.text.trim() ||
				item.text.trim().length > 500 ||
				!(item.period === 'once' || PERIODIC_PERIODS.some((p) => p.value === item.period)) ||
				!isDateKey(item.start) ||
				typeof item.overrideEmoji !== 'boolean' ||
				!isReminderLeadDays(item.leadDays) ||
				!Array.isArray(item.completedDates)
			)
				continue;
			reminders.push({
				id: item.id,
				text: item.text.trim(),
				period: item.period,
				start: item.start,
				overrideEmoji: item.overrideEmoji,
				leadDays: item.leadDays,
				completedDates: [...new Set<DateKey>(item.completedDates.filter(isDateKey))]
			});
		}
		return reminders;
	} catch {
		return [];
	}
}
