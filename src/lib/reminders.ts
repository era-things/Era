import { asDate, daysBetween, type DateKey } from './calendar.ts';

export const REMINDERS_STORAGE_KEY = 'era:reminders:v1';
export const REMINDER_PERIODS = [
	{ value: 'once', label: 'Just once' },
	{ value: 'weekly', label: 'Weekly' },
	{ value: 'monthly', label: 'Monthly' },
	{ value: 'yearly', label: 'Yearly' }
] as const;
export type ReminderPeriod = (typeof REMINDER_PERIODS)[number]['value'];
export type Reminder = {
	id: string;
	text: string;
	period: ReminderPeriod;
	start: DateKey;
	overrideEmoji: boolean;
	leadDays: number | 'always';
	completedDates: DateKey[];
};

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

export function isReminderDate(value: unknown): value is DateKey {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const date = asDate(value);
	return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
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
				!REMINDER_PERIODS.some((p) => p.value === item.period) ||
				!isReminderDate(item.start)
			)
				continue;
			reminders.push({
				id: item.id,
				text: item.text.trim(),
				period: item.period,
				start: item.start,
				overrideEmoji: item.overrideEmoji === true,
				leadDays:
					item.leadDays === 'always' ||
					(typeof item.leadDays === 'number' &&
						Number.isSafeInteger(item.leadDays) &&
						item.leadDays >= 0)
						? item.leadDays
						: 0,
				completedDates: Array.isArray(item.completedDates)
					? ([...new Set(item.completedDates.filter(isReminderDate))] as DateKey[])
					: []
			});
		}
		return reminders;
	} catch {
		return [];
	}
}
