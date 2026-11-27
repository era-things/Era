import type { CalendarData } from './data-export';
import { ERA_FIELDS, ERA_VALUE_KINDS } from './eras';
import { widgetBody } from './api-values';
import { FOOD_ITEM_FIELDS, type FoodItem } from './nutrition';
import { WIDGETS, manualWidgetValue } from './widgets';

export type ApiRequest = {
	url: string;
	method: 'PUT' | 'PATCH' | 'POST' | 'DELETE';
	body?: unknown;
};
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const keys = (a: object, b: object) => [...new Set([...Object.keys(a), ...Object.keys(b)])];
const widgetSections = [
	...new Set(WIDGETS.map(({ storage }) => storage.section)),
	'automated'
] as const;

function nutritionItemRequests(url: string, before: FoodItem[], after: FoodItem[]): ApiRequest[] {
	const requests: ApiRequest[] = [];
	const previous = new Map(before.map((item) => [item.id, item]));
	for (const item of after) {
		const itemUrl = `${url}/items/${item.id}`;
		const old = previous.get(item.id);
		if (!old) requests.push({ url: itemUrl, method: 'PUT', body: item });
		else {
			const fields = FOOD_ITEM_FIELDS.filter((field) => old[field] !== item[field]);
			if (fields.length)
				requests.push({
					url: itemUrl,
					method: 'PATCH',
					body: Object.fromEntries(fields.map((field) => [field, item[field]]))
				});
			previous.delete(item.id);
		}
	}
	for (const id of previous.keys()) requests.push({ url: `${url}/items/${id}`, method: 'DELETE' });
	return requests;
}

// Diff local UI state into ordinary resource requests. Old values never go over the wire.
export function apiRequests(before: CalendarData, after: CalendarData): ApiRequest[] {
	const requests: ApiRequest[] = [];
	const add = (url: string, method: ApiRequest['method'], body?: unknown) =>
		requests.push({ url, method, body });
	if (before.timelineColor !== after.timelineColor)
		add('/api/settings/timeline-color', 'PUT', { color: after.timelineColor });
	const previousEras = new Map(before.eras.map((era) => [era.id, era]));
	const nextEraIds = new Set(after.eras.map(({ id }) => id));
	for (const { id, autoMarkedThrough, ...fields } of after.eras) {
		const era = previousEras.get(id);
		const active = autoMarkedThrough !== undefined;
		if (!era) add(`/api/eras/${id}`, 'PUT', { ...fields, active });
		else {
			const patch = Object.fromEntries(
				ERA_FIELDS.filter((field) => era[field] !== fields[field]).map((field) => [
					field,
					fields[field] ?? null
				])
			);
			if (active !== (era.autoMarkedThrough !== undefined)) patch.active = active;
			if (Object.keys(patch).length) add(`/api/eras/${id}`, 'PATCH', patch);
		}
	}
	const marks = new Map<string, { mark: string[]; unmark: string[] }>();
	for (const date of keys(before.eraDays, after.eraDays)) {
		const old = before.eraDays[date] ?? {};
		const next = after.eraDays[date] ?? {};
		for (const id of keys(old, next)) {
			if (!nextEraIds.has(id)) continue;
			if (old[id]?.marked !== next[id]?.marked) {
				const edits = marks.get(id) ?? { mark: [], unmark: [] };
				edits[next[id]?.marked ? 'mark' : 'unmark'].push(date);
				marks.set(id, edits);
			}
			for (const kind of ERA_VALUE_KINDS) {
				const value = next[id]?.values?.[kind];
				if (old[id]?.values?.[kind] === value) continue;
				const url = `/api/days/${date}/eras/${id}/values/${kind}`;
				if (value === undefined) add(url, 'DELETE');
				else add(url, 'PUT', { value });
			}
		}
	}
	for (const [id, edits] of marks) add(`/api/eras/${id}/days`, 'PATCH', edits);
	for (const id of previousEras.keys()) if (!nextEraIds.has(id)) add(`/api/eras/${id}`, 'DELETE');
	for (const { id } of WIDGETS) {
		const patch = Object.fromEntries(
			(['visibility', 'skin'] as const)
				.filter((field) => before.layout.widgets[id][field] !== after.layout.widgets[id][field])
				.map((field) => [field, after.layout.widgets[id][field]])
		);
		if (Object.keys(patch).length) add(`/api/widgets/${id}`, 'PATCH', patch);
	}
	for (const measure of after.measures.definitions) {
		const previous = before.measures.definitions.find((item) => item.id === measure.id);
		if (!previous) add('/api/measures', 'POST', measure);
		else if (!equal(previous, measure))
			add(`/api/measures/${measure.id}`, 'PATCH', { name: measure.name, palette: measure.palette });
	}
	const days = new Set<string>();
	for (const data of [before, after])
		for (const section of widgetSections)
			for (const day of Object.keys(data[section])) days.add(day);
	for (const day of days)
		for (const { id } of WIDGETS) {
			const url = `/api/days/${day}/widgets/${id}`;
			if (id === 'nutrition' && after.nutrition[day]) {
				const old = before.nutrition[day] ?? [];
				const next = after.nutrition[day];
				if (old.length || next.length) {
					requests.push(...nutritionItemRequests(url, old, next));
					continue;
				}
			}
			const old = manualWidgetValue(before, day, id);
			const next = manualWidgetValue(after, day, id);
			if (next !== undefined) {
				if (!equal(old, next)) add(url, 'PUT', widgetBody(id, next));
			} else if (
				before.automated[day]?.[id] !== undefined &&
				after.automated[day]?.[id] === undefined
			) {
				add(url, 'DELETE');
			} else if (old !== undefined) add(`${url}/manual`, 'DELETE');
		}
	for (const day of keys(before.emojis, after.emojis))
		if (before.emojis[day] !== after.emojis[day])
			add(`/api/days/${day}/emoji`, 'PUT', { emoji: after.emojis[day] ?? null });
	for (const day of keys(before.measures.days, after.measures.days)) {
		const old = before.measures.days[day] ?? {},
			next = after.measures.days[day] ?? {};
		for (const id of keys(old, next)) {
			if (!after.measures.definitions.some((item) => item.id === id) || equal(old[id], next[id]))
				continue;
			add(
				`/api/days/${day}/measures/${id}`,
				next[id] === undefined ? 'DELETE' : 'PUT',
				next[id] === undefined ? undefined : { value: next[id] }
			);
		}
	}
	for (const reminder of after.reminders) {
		if (
			!equal(
				before.reminders.find((item) => item.id === reminder.id),
				reminder
			)
		)
			add(`/api/reminders/${reminder.id}`, 'PUT', reminder);
	}
	for (const reminder of before.reminders)
		if (!after.reminders.some((item) => item.id === reminder.id))
			add(`/api/reminders/${reminder.id}`, 'DELETE');
	for (const measure of before.measures.definitions)
		if (!after.measures.definitions.some((item) => item.id === measure.id))
			add(`/api/measures/${measure.id}`, 'DELETE');
	return requests;
}
