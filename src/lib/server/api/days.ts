import {
	reply,
	noContent,
	fail,
	invalid,
	object,
	resourceId,
	dayKey,
	measureFor,
	type ApiContext,
	type ApiRoute
} from './shared';
import { WIDGETS, isVisible, isAttached, removeWidgetValue, setWidgetValue } from '../../widgets';
import { setDayMeasure, validMeasureValue } from '../../measures';
import { normalizeEmoji } from '../../day-emojis';
import { widgetId, dayWidget, parseWidget } from './widget-values';
function getDay({ store, params }: ApiContext) {
	const date = dayKey(params.date);
	const data = store.read();
	return reply({
		date,
		emoji: data.emojis[date] ?? null,
		widgets: WIDGETS.filter((item) => isVisible(data, date, item.id)).map((item) =>
			dayWidget(data, date, item.id)
		),
		measures: Object.entries(data.measures.days[date] ?? {}).map(([id, value]) => ({
			id,
			value
		}))
	});
}
function getDayWidget({ store, params }: ApiContext) {
	const date = dayKey(params.date);
	const id = widgetId(params.id);
	return reply(dayWidget(store.read(), date, id));
}
function putDayWidget({ store, body, params }: ApiContext) {
	const date = dayKey(params.date);
	const id = widgetId(params.id);
	const value = parseWidget(id, body);
	const data = store.update((current) => {
		if (current.layout.widgets[id].archived && !isAttached(current, date, id))
			fail(
				409,
				'widget_archived',
				'Restore this widget from the catalog before adding it to a new day.',
				'archived'
			);
		return setWidgetValue(current, date, id, value);
	});
	return reply(dayWidget(data, date, id));
}
function deleteDayWidget({ store, params }: ApiContext) {
	const date = dayKey(params.date);
	const id = widgetId(params.id);
	store.update((data) => removeWidgetValue(data, date, id));
	return noContent();
}
function getDayMeasure({ store, params }: ApiContext) {
	const date = dayKey(params.date);
	const id = resourceId(params.id);
	const data = store.read();
	measureFor(data, id);
	return reply({
		date,
		id,
		attached: Object.hasOwn(data.measures.days[date] ?? {}, id),
		value: data.measures.days[date]?.[id] ?? null
	});
}
function changeDayMeasure({ store, body, params, method }: ApiContext) {
	const date = dayKey(params.date);
	const id = resourceId(params.id);
	const payload = method === 'PUT' ? object(body, ['value'], ['value']) : undefined;
	const data = store.update((current) => {
		const measure = measureFor(current, id);
		if (payload && !validMeasureValue(measure.type, payload.value))
			invalid(
				measure.type === 'boolean'
					? 'Expected a boolean.'
					: 'Use a non-negative whole number, or null.',
				'value'
			);
		return {
			...current,
			measures: setDayMeasure(
				current.measures,
				date,
				id,
				payload?.value as number | boolean | null | undefined
			)
		};
	});
	return method === 'DELETE'
		? noContent()
		: reply({ date, id, attached: true, value: data.measures.days[date][id] });
}
function getEmoji({ store, params }: ApiContext) {
	const date = dayKey(params.date);
	return reply({ date, emoji: store.read().emojis[date] ?? null });
}
function putEmoji({ store, body, params }: ApiContext) {
	const date = dayKey(params.date);
	const payload = object(body, ['emoji'], ['emoji']);
	if (payload.emoji !== null && typeof payload.emoji !== 'string')
		invalid('Expected one emoji, or null.', 'emoji');
	const emoji = payload.emoji === null ? '' : normalizeEmoji(payload.emoji as string);
	if (emoji === null) invalid('Expected one emoji, or null.', 'emoji');
	store.update((data) => {
		const emojis = { ...data.emojis };
		if (emoji) emojis[date] = emoji;
		else delete emojis[date];
		return { ...data, emojis };
	});
	return reply({ date, emoji: emoji || null });
}
export const dayRoutes = [
	{ pattern: /^days\/(?<date>[^/]+)$/, methods: { GET: getDay } },
	{
		pattern: /^days\/(?<date>[^/]+)\/widgets\/(?<id>[^/]+)$/,
		methods: { GET: getDayWidget, PUT: putDayWidget, DELETE: deleteDayWidget }
	},
	{
		pattern: /^days\/(?<date>[^/]+)\/measures\/(?<id>[^/]+)$/,
		methods: { GET: getDayMeasure, PUT: changeDayMeasure, DELETE: changeDayMeasure }
	},
	{ pattern: /^days\/(?<date>[^/]+)\/emoji$/, methods: { GET: getEmoji, PUT: putEmoji } }
] satisfies ApiRoute[];
