import type { DayEmojis } from './day-emojis';
import type { MeasuresState } from './measures';
import type { Reminder } from './reminders';

export type CalendarData = {
	emojis: DayEmojis;
	measures: MeasuresState;
	reminders: Reminder[];
};

export function serializeDataExport(data: CalendarData, now = new Date()): string {
	return JSON.stringify({ app: 'Era', exportedAt: now.toISOString(), ...data }, null, 2);
}
