import type { DayEmojis } from './day-emojis';
import type { MeasuresState } from './measures';
import type { Reminder } from './reminders';
import type { NutritionDays } from './nutrition';
import type { DayNotes } from './day-notes';
import type { CounterDays } from './counters';
import type { LayoutState, WidgetValues } from './widgets';
import type { DateKey } from './calendar';
import type { SleepDays } from './sleep';
import type { TimeDays } from './time';
import type { ScreenApp } from './screen-apps';

export type CalendarData = {
	emojis: DayEmojis;
	measures: MeasuresState;
	reminders: Reminder[];
	nutrition: NutritionDays;
	notes: DayNotes;
	counters: CounterDays;
	sleep: SleepDays;
	time: TimeDays;
	screenApps: Record<DateKey, ScreenApp[]>;
	automated: Record<DateKey, Partial<WidgetValues>>;
	layout: LayoutState;
};

export type BackupPreview = {
	days: number;
	overwrittenDays: number;
	overwritesOtherData: boolean;
};

export function serializeDataExport(data: CalendarData, now = new Date()): string {
	return JSON.stringify({ app: 'Era', exportedAt: now.toISOString(), ...data }, null, 2);
}
