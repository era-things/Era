import type { CalendarData } from './data-export';
import type { Measure, MeasureValue } from './measures';
import type { FoodItem } from './nutrition';
import type { Reminder } from './reminders';
import { WIDGETS, emptyLayout, type WidgetId, type CounterId } from './widgets';

export type Section = keyof CalendarData;
export type Change = { key: string; before: string | null; after: string | null };
export const emptyCalendar = (): CalendarData => ({
	emojis: {},
	notes: {},
	measures: { definitions: [], days: {} },
	nutrition: {},
	counters: {},
	sleep: {},
	layout: emptyLayout(),
	reminders: []
});

// Keys identify independently editable records. Missing rows differ from stored JSON null.
export function records(data: CalendarData) {
	const rows = new Map<string, string>();
	const put = (value: unknown, ...path: string[]) =>
		rows.set(JSON.stringify(path), JSON.stringify(value));
	for (const [day, value] of Object.entries(data.notes)) put(value, 'note', day);
	for (const [day, value] of Object.entries(data.sleep)) put(value, 'sleep', day);
	for (const [day, value] of Object.entries(data.emojis)) put(value, 'emoji', day);
	for (const def of data.measures.definitions) put(def, 'measure', def.id);
	for (const [day, values] of Object.entries(data.measures.days))
		for (const [id, value] of Object.entries(values)) put(value, 'value', day, id);
	for (const widget of WIDGETS) {
		const settings = data.layout.widgets[widget.id];
		for (const field of ['pinned', 'skin'] as const)
			if (settings[field] !== widget[field]) put(settings[field], 'widget', widget.id, field);
	}
	for (const [day, values] of Object.entries(data.counters))
		for (const [id, value] of Object.entries(values)) put(value, 'counter-value', day, id);
	for (const [day, items] of Object.entries(data.nutrition)) {
		put(true, 'nutrition-day', day);
		for (const item of items) put(item, 'food', day, item.id);
	}
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
			case 'sleep':
				data.sleep[day] = value;
				break;
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
				(data.nutrition[day] ??= []).push(value as FoodItem);
				break;
			case 'nutrition-day':
				if (value !== true) throw new Error('Invalid nutrition day');
				data.nutrition[day] ??= [];
				break;
			case 'widget':
				Object.assign(data.layout.widgets[day as WidgetId], { [id]: value });
				break;
			case 'counter-value':
				(data.counters[day] ??= {})[id as CounterId] = value;
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
