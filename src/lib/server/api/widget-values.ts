import type { CalendarData } from '../../data-export';
import {
	WIDGETS,
	widgetFor,
	manualWidgetValue,
	widgetValue,
	isVisible,
	validWidgetValue,
	type WidgetKind,
	type WidgetKindValues,
	type WidgetIdOfKind,
	type WidgetId,
	type WidgetValues
} from '../../widgets';
import { widgetBody } from '../../api-values';
import { validTime } from '../../duration';
import { validSleep, validSleepMetrics, parseSleepTime, type Sleep } from '../../sleep';
import { validFoodItem } from '../../nutrition';
import { fail, invalid, object, resourceId } from './shared';
export function widgetId(value: string): WidgetId {
	if (!WIDGETS.some((widget) => widget.id === value))
		fail(404, 'widget_not_found', 'Unknown widget.', 'id');
	return value as WidgetId;
}

export function dayWidget(data: CalendarData, date: string, id: WidgetId) {
	const manual = manualWidgetValue(data, date, id);
	const automated = data.automated[date]?.[id];
	const value = widgetValue(data, date, id);
	return {
		date,
		id,
		attached: value !== undefined,
		visible: isVisible(data, date, id),
		value: value === undefined ? null : widgetBody(id, value),
		source: automated !== undefined ? 'automated' : manual !== undefined ? 'manual' : null,
		automatedValue: automated === undefined ? null : widgetBody(id, automated),
		manualValue: manual === undefined ? null : widgetBody(id, manual)
	};
}

export function definition(data: CalendarData, id: WidgetId) {
	const widget = widgetFor(id);
	return {
		id,
		name: widget.name,
		kind: widget.kind,
		...(widget.kind === 'counter' ? { unit: widget.unit } : {}),
		skins: widget.skins,
		settings: data.layout.widgets[id],
		defaultValue: widgetBody(id, widget.initial),
		fields: widget.fields
	};
}

function parseSleep(value: unknown): Sleep {
	const body = object(value, ['startTime', 'wakeUpTime', 'durationMinutes', 'metrics']);
	if (!['startTime', 'wakeUpTime', 'durationMinutes'].some((field) => Object.hasOwn(body, field)))
		invalid('Supply startTime, wakeUpTime, or durationMinutes.', 'body');
	const clock = (key: string): number | null => {
		const value = body[key];
		if (value === undefined || value === null) return null;
		if (typeof value !== 'string' || !/^\d{2}:[0-5]\d$/.test(value))
			invalid('Use a time from 00:00 to 23:59, or null.', key);
		const parsed = parseSleepTime(value);
		if (parsed === null) invalid('Use a time from 00:00 to 23:59, or null.', key);
		return parsed;
	};
	const sleep: Sleep = {
		start: clock('startTime'),
		end: clock('wakeUpTime'),
		duration: body.durationMinutes === undefined ? null : (body.durationMinutes as number | null)
	};
	if (sleep.duration !== null && (!validTime(sleep.duration) || sleep.duration === 1440))
		invalid('Use whole minutes from 0 through 1439, or null.', 'durationMinutes');
	if (sleep.start !== null && sleep.end !== null && !Object.hasOwn(body, 'durationMinutes'))
		sleep.duration = (sleep.end - sleep.start + 1440) % 1440;
	else if (sleep.duration !== null && sleep.start !== null && !Object.hasOwn(body, 'wakeUpTime'))
		sleep.end = (sleep.start + sleep.duration) % 1440;
	else if (sleep.duration !== null && sleep.end !== null && !Object.hasOwn(body, 'startTime'))
		sleep.start = (sleep.end - sleep.duration + 1440) % 1440;
	if (Object.hasOwn(body, 'metrics')) {
		if (!validSleepMetrics(body.metrics))
			invalid('Use whole minutes from 0 through 1440 and a score from 0 through 100.', 'metrics');
		sleep.metrics = body.metrics;
	}
	if (!validSleep(sleep))
		invalid('The supplied sleep times and duration are inconsistent.', 'body');
	return sleep;
}

function parseField<K extends WidgetId>(id: K, value: unknown, message: string): WidgetValues[K] {
	const definition = widgetFor(id);
	const field = definition.fields[0].name;
	const body = object(value, [field], [field]);
	const parsed = body[field];
	if (!validWidgetValue(id, parsed)) invalid(message, field);
	return parsed;
}

function parseNutrition(value: unknown): WidgetValues['nutrition'] {
	const { items } = object(value, ['items'], ['items']);
	if (!Array.isArray(items)) invalid('Expected an array of food items.', 'items');
	const ids = new Set<string>();
	for (const [index, item] of items.entries()) {
		object(
			item,
			['id', 'name', 'quantity', 'kcal', 'protein', 'fat', 'carbs'],
			['id', 'name', 'quantity', 'kcal', 'protein', 'fat', 'carbs']
		);
		if (!validFoodItem(item)) invalid('Invalid food item.', `items.${index}`);
		resourceId(item.id, `items.${index}.id`);
		if (ids.has(item.id)) invalid('Food item IDs must be unique.', `items.${index}.id`);
		ids.add(item.id);
	}
	return items;
}

export type WidgetParsers = {
	[K in WidgetKind]: (id: WidgetIdOfKind<K>, value: unknown) => WidgetKindValues[K];
};
const widgetParsers = {
	sleep: (_id, value) => parseSleep(value),
	nutrition: (_id, value) => parseNutrition(value),
	note: (id, value) => parseField(id, value, 'Expected a string.'),
	time: (id, value) => parseField(id, value, 'Use whole minutes from 0 through 1440, or null.'),
	counter: (id, value) =>
		parseField(
			id,
			value,
			widgetFor(id).fields[0].type === 'integer'
				? 'Use a non-negative whole number, or null.'
				: 'Use a non-negative number, or null.'
		)
} satisfies WidgetParsers;

export function parseWidget<K extends WidgetId>(id: K, value: unknown): WidgetValues[K];
export function parseWidget(id: WidgetId, value: unknown): WidgetValues[WidgetId] {
	// The same ID determines the parser and its result; keep the dynamic
	// dispatch assertion here rather than weakening each parser's signature.
	const parse = widgetParsers[widgetFor(id).kind] as (
		id: WidgetId,
		value: unknown
	) => WidgetValues[WidgetId];
	return parse(id, value);
}
