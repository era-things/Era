import type { CalendarData } from './data-export';
import type { Measure, MeasureValue } from './measures';
import type { FoodItem } from './nutrition';
import type { Reminder } from './reminders';
import { WIDGETS, emptyLayout, type WidgetId, type CounterId } from './widgets';
import type { TimeId } from './widgets';

export type Section = keyof CalendarData;
export type Change = { key: string; before: string | null; after: string | null };
export const emptyCalendar = (): CalendarData => ({
	emojis: {},
	notes: {},
	measures: { definitions: [], days: {} },
	nutrition: {},
	counters: {},
	sleep: {},
	time: {},
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
	for (const [day, values] of Object.entries(data.time))
		for (const [id, value] of Object.entries(values)) put(value, 'time-value', day, id);
	for (const [day, value] of Object.entries(data.emojis)) put(value, 'emoji', day);
	for (const def of data.measures.definitions) put(def, 'measure', def.id);
	for (const [day, values] of Object.entries(data.measures.days))
		for (const [id, value] of Object.entries(values)) put(value, 'value', day, id);
	for (const widget of WIDGETS) {
		const settings = data.layout.widgets[widget.id];
		for (const field of ['pinned', 'skin', 'archived'] as const)
			if (settings[field] !== (field === 'archived' ? false : widget[field]))
				put(settings[field], 'widget', widget.id, field);
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

type Decoder = (data: CalendarData, day: string, id: string, value: unknown) => void;
const decoders = new Map<string, Decoder>(
	Object.entries({
		'time-value': (data, day, id, value) => {
			(data.time[day] ??= {})[id as TimeId] = value as number | null;
		},
		sleep: (data, day, _id, value) => {
			data.sleep[day] = value as CalendarData['sleep'][string];
		},
		note: (data, day, _id, value) => {
			data.notes[day] = value as string;
		},
		emoji: (data, day, _id, value) => {
			data.emojis[day] = value as string;
		},
		measure: (data, _day, _id, value) => {
			data.measures.definitions.push(value as Measure);
		},
		value: (data, day, id, value) => {
			(data.measures.days[day] ??= {})[id] = value as MeasureValue;
		},
		food: (data, day, _id, value) => {
			(data.nutrition[day] ??= []).push(value as FoodItem);
		},
		'nutrition-day': (data, day, _id, value) => {
			if (value !== true) throw new Error('Invalid nutrition day');
			data.nutrition[day] ??= [];
		},
		widget: (data, day, id, value) => {
			Object.assign(data.layout.widgets[day as WidgetId], { [id]: value });
		},
		'counter-value': (data, day, id, value) => {
			(data.counters[day] ??= {})[id as CounterId] = value as number | null;
		},
		reminder: (data, _day, _id, value) => {
			data.reminders.push(value as Reminder);
		}
	} satisfies Record<string, Decoder>)
);

export function decode(rows: { key: string; value: string }[]): CalendarData {
	const data = emptyCalendar();
	for (const row of rows) {
		const [kind, day, id] = JSON.parse(row.key);
		const decoder = decoders.get(kind);
		if (!decoder) throw new Error('Unknown record type');
		decoder(data, day, id, JSON.parse(row.value));
	}
	return data;
}
