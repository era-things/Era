import type { CalendarData } from './data-export';
import type { Measure, MeasureValue } from './measures';
import type { FoodItem } from './nutrition';
import type { Reminder } from './reminders';

export type Section = keyof CalendarData;
export type Change = { key: string; before: string | null; after: string | null };
export const emptyCalendar = (): CalendarData => ({
	emojis: {},
	notes: {},
	measures: { definitions: [], days: {} },
	nutrition: { enabled: false, days: {} },
	reminders: []
});

// Keys identify independently editable records. Missing rows differ from stored JSON null.
export function records(data: CalendarData) {
	const rows = new Map<string, string>();
	const put = (value: unknown, ...path: string[]) =>
		rows.set(JSON.stringify(path), JSON.stringify(value));
	for (const [day, value] of Object.entries(data.notes)) put(value, 'note', day);
	for (const [day, value] of Object.entries(data.emojis)) put(value, 'emoji', day);
	for (const def of data.measures.definitions) put(def, 'measure', def.id);
	for (const [day, values] of Object.entries(data.measures.days))
		for (const [id, value] of Object.entries(values)) put(value, 'value', day, id);
	if (data.nutrition.enabled) put(true, 'nutrition');
	for (const [day, items] of Object.entries(data.nutrition.days))
		for (const item of items) put(item, 'food', day, item.id);
	for (const r of data.reminders) put(r, 'reminder', r.id);
	return rows;
}

export function changes(before: CalendarData, after: CalendarData): Change[] {
	const old = records(before),
		next = records(after);
	return [...new Set([...old.keys(), ...next.keys()])]
		.filter((key) => old.get(key) !== next.get(key))
		.map((key) => ({ key, before: old.get(key) ?? null, after: next.get(key) ?? null }));
}

export function decode(rows: { key: string; value: string }[]): CalendarData {
	const data = emptyCalendar();
	for (const row of rows) {
		const [kind, day, id] = JSON.parse(row.key);
		const value = JSON.parse(row.value);
		switch (kind) {
			case 'note':
				data.notes[day] = value;
				break;
			case 'emoji':
				data.emojis[day] = value;
				break;
			case 'measure':
				data.measures.definitions.push(value as Measure);
				break;
			case 'value':
				(data.measures.days[day] ??= {})[id] = value as MeasureValue;
				break;
			case 'food':
				(data.nutrition.days[day] ??= []).push(value as FoodItem);
				break;
			case 'nutrition':
				data.nutrition.enabled = value;
				break;
			case 'reminder':
				data.reminders.push(value as Reminder);
				break;
			default:
				throw new Error('Unknown record type');
		}
	}
	return data;
}
