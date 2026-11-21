import type { CalendarData } from './data-export';
import { isDateKey, type DateKey } from './calendar';
import { NUTRIENTS, validFoodItem, type FoodItem } from './nutrition';
import { emptySleep, validSleep, type Sleep } from './sleep';
import { validTime } from './duration';
import type { ScreenApp } from './screen-apps';
import { isRecord, normalizeDays } from './validation';

import { WIDGET_ICONS, type WidgetIcon } from './widget-icons';

export type WidgetKindValues = {
	sleep: Sleep;
	nutrition: FoodItem[];
	counter: number | null;
	time: number | null;
	note: string;
};
export type WidgetKind = keyof WidgetKindValues;
export const WIDGET_VISIBILITIES = ['pinned', 'available', 'with-data', 'hidden'] as const;
export type WidgetVisibility = (typeof WIDGET_VISIBILITIES)[number];

type WidgetDataContext = { automated: boolean; screenApps?: readonly ScreenApp[] };
const hasPositiveValue = (value: number | null) => value !== null && value > 0;
const initialSleep = emptySleep();

type WidgetContract = {
	[K in WidgetKind]: {
		id: string;
		name: string;
		kind: K;
		placement: 'main' | 'time' | 'footer';
		storage: { section: string; key?: string };
		valid: (value: unknown) => value is WidgetKindValues[K];
		hasData: (value: WidgetKindValues[K], context: WidgetDataContext) => boolean;
		fields: readonly WidgetField[];
		compact: boolean;
		visibility: WidgetVisibility;
		skin: string;
		skins: readonly { id: string; name: string }[];
		icon?: WidgetIcon;
		unit?: string;
		integer?: boolean;
		initial: Readonly<WidgetKindValues[K]>;
		sample: Readonly<WidgetKindValues[K]>;
	};
}[WidgetKind];

export type WidgetField = {
	name: string;
	type: 'integer' | 'number' | 'time' | 'string' | 'array';
	nullable?: boolean;
	min?: number;
	max?: number;
};
const validNumber = (value: unknown, integer: boolean): value is number =>
	typeof value === 'number' &&
	Number.isFinite(value) &&
	value >= 0 &&
	value <= Number.MAX_SAFE_INTEGER &&
	(!integer || Number.isSafeInteger(value));
const counterBehavior = (integer: boolean) => ({
	integer,
	fields: counterFields(integer),
	valid: (value: unknown): value is number | null => value === null || validNumber(value, integer)
});

const durationFields = [
	{ name: 'durationMinutes', type: 'integer', nullable: true, min: 0, max: 1440 }
] as const;

const counterFields = (integer: boolean): WidgetField[] => [
	{
		name: 'value',
		type: integer ? 'integer' : 'number',
		nullable: true,
		min: 0,
		max: Number.MAX_SAFE_INTEGER
	}
];

const timeWidget = <K extends keyof typeof WIDGET_ICONS>(id: K, name: string, sample: number) => ({
	id,
	name,
	sample,
	kind: 'time' as const,
	placement: 'time' as const,
	storage: { section: 'time', key: id } as const,
	valid: (value: unknown): value is number | null => value === null || validTime(value),
	hasData: hasPositiveValue,
	icon: WIDGET_ICONS[id],
	fields: durationFields,
	compact: false,
	visibility: 'available' as const,
	skin: 'simple' as const,
	skins: [{ id: 'simple', name: 'Simple' }] as const,
	initial: 0 as number | null
});

export const WIDGETS = [
	{
		id: 'nutrition',
		name: 'Nutrition',
		kind: 'nutrition',
		placement: 'main',
		storage: { section: 'nutrition' },
		valid: (value: unknown): value is FoodItem[] =>
			Array.isArray(value) &&
			value.every(validFoodItem) &&
			new Set(value.map(({ id }) => id)).size === value.length,
		hasData: (items) =>
			items.some((item) => item.name.trim() !== '' || NUTRIENTS.some(({ key }) => item[key] > 0)),
		fields: [{ name: 'items', type: 'array' }],
		compact: false,
		visibility: 'available',
		skin: 'simple',
		skins: [{ id: 'simple', name: 'Simple' }],
		initial: [] as FoodItem[],
		sample: [
			{ id: 'example', name: 'Example', quantity: 1, kcal: 1850, protein: 110, fat: 65, carbs: 205 }
		]
	},
	{
		id: 'weight',
		name: 'Weight',
		kind: 'counter',
		placement: 'main',
		...counterBehavior(false),
		hasData: (value) => value !== null,
		storage: { section: 'counters', key: 'weight' },
		icon: WIDGET_ICONS.weight,
		compact: true,
		visibility: 'available',
		skin: 'scale',
		skins: [
			{ id: 'simple', name: 'Simple' },
			{ id: 'scale', name: 'Scale' },
			{ id: 'display', name: 'Display' }
		],
		unit: 'kg',
		initial: null,
		sample: 72.5
	},
	{
		id: 'steps',
		name: 'Steps',
		kind: 'counter',
		placement: 'main',
		...counterBehavior(true),
		hasData: hasPositiveValue,
		storage: { section: 'counters', key: 'steps' },
		icon: WIDGET_ICONS.steps,
		compact: true,
		visibility: 'available',
		skin: 'simple',
		skins: [
			{ id: 'simple', name: 'Simple' },
			{ id: 'pedometer', name: 'Pedometer' }
		],
		unit: '',
		initial: 0,
		sample: 8200
	},
	{
		id: 'sleep',
		name: 'Sleep',
		kind: 'sleep',
		placement: 'time',
		storage: { section: 'sleep' },
		valid: validSleep,
		hasData: (value, { automated }) =>
			value.start !== null ||
			value.end !== null ||
			value.metrics !== undefined ||
			(hasPositiveValue(value.duration) && (automated || value.duration !== initialSleep.duration)),
		fields: [
			{ name: 'startTime', type: 'time', nullable: true },
			{ name: 'wakeUpTime', type: 'time', nullable: true },
			{ name: 'durationMinutes', type: 'integer', nullable: true, min: 0, max: 1439 }
		],
		compact: false,
		visibility: 'available',
		skin: 'lunar-seal',
		skins: [
			{ id: 'simple', name: 'Simple' },
			{ id: 'lunar-seal', name: 'Lunar seal' }
		],
		initial: initialSleep,
		sample: { start: 1395, end: 405, duration: 450 } as Sleep
	},
	{
		...timeWidget('phone', 'Phone screen time', 135),
		hasData: (value: number | null, { screenApps }: WidgetDataContext) =>
			hasPositiveValue(value) || !!screenApps?.length
	},
	timeWidget('gym', 'Gym time', 70),
	timeWidget('reading', 'Reading time', 45),
	timeWidget('movie', 'Movie time', 116),
	timeWidget('steam', 'Steam game time', 90),
	{
		id: 'note',
		name: 'Note',
		kind: 'note',
		placement: 'footer',
		storage: { section: 'notes' },
		valid: (value: unknown) => typeof value === 'string',
		hasData: (value) => value.trim() !== '',
		fields: [{ name: 'text', type: 'string' }],
		compact: false,
		visibility: 'pinned',
		skin: 'simple',
		skins: [{ id: 'simple', name: 'Simple' }],
		initial: '',
		sample: 'A walk after lunch.\n\n- [ ] Pick up groceries'
	}
] as const satisfies readonly WidgetContract[];
export type Widget = (typeof WIDGETS)[number];
export type WidgetId = Widget['id'];
export type WidgetOfKind<K extends WidgetKind> = Extract<Widget, { kind: K }>;
export type WidgetIdOfKind<K extends WidgetKind> = WidgetOfKind<K>['id'];
export type TimeWidget = Extract<Widget, { kind: 'time' }>;
export type TimeId = TimeWidget['id'];
export const TIME_WIDGETS = WIDGETS.filter(
	(widget): widget is TimeWidget => widget.kind === 'time'
);
export type Counter = Extract<Widget, { kind: 'counter' }>;
export type CounterId = Counter['id'];
export type WidgetSkin<K extends WidgetId = WidgetId> = Extract<
	Widget,
	{ id: K }
>['skins'][number]['id'];
export type WidgetSettings = { visibility: WidgetVisibility; skin: WidgetSkin };
export const COUNTERS = WIDGETS.filter((widget): widget is Counter => widget.kind === 'counter');
export type LayoutState = {
	widgets: { [K in WidgetId]: { visibility: WidgetVisibility; skin: WidgetSkin<K> } };
};
export type WidgetValues = {
	[K in WidgetId]: WidgetKindValues[Extract<Widget, { id: K }>['kind']];
};
export type WidgetInstanceFor<I extends WidgetId> = {
	[K in I]: {
		id: K;
		kind: Extract<Widget, { id: K }>['kind'];
		definition: Extract<Widget, { id: K }>;
		skin: WidgetSkin<K>;
		value: WidgetValues[K];
	} & (K extends 'phone' ? { screenApps?: readonly ScreenApp[] } : object);
}[I];
export type WidgetInstance = WidgetInstanceFor<WidgetId>;
export type WidgetInstanceOfKind<K extends WidgetKind> = Extract<WidgetInstance, { kind: K }>;
export type WidgetHandlers<R> = {
	[K in WidgetKind]: (widget: WidgetInstanceOfKind<K>) => R;
};

// Indexing a union loses its argument correlation in TypeScript. Keep the one
// dispatch assertion here; every handler is checked against its own kind.
export function widgetHandler<R>(widget: WidgetInstance, handlers: WidgetHandlers<R>) {
	return handlers[widget.kind] as (widget: WidgetInstance) => R;
}
export type WidgetData = Pick<
	CalendarData,
	| 'nutrition'
	| 'notes'
	| 'counters'
	| 'layout'
	| 'measures'
	| 'sleep'
	| 'time'
	| 'automated'
	| 'screenApps'
>;
export const widgetFor = <K extends WidgetId>(id: K) =>
	WIDGETS.find((widget) => widget.id === id)! as Extract<Widget, { id: K }>;
export const emptyLayout = (): LayoutState => ({
	widgets: Object.fromEntries(
		WIDGETS.map(({ id, visibility, skin }) => [id, { visibility, skin }])
	) as LayoutState['widgets']
});
export const validWidgetVisibility = (value: unknown): value is WidgetVisibility =>
	WIDGET_VISIBILITIES.some((visibility) => visibility === value);
export const validWidgetSkin = (id: WidgetId, skin: unknown): skin is WidgetSkin =>
	widgetFor(id).skins.some((option) => option.id === skin);
export function validWidgetValue<K extends WidgetId>(
	id: K,
	value: unknown
): value is WidgetValues[K] {
	return widgetFor(id).valid(value);
}
export function validCounterValue(id: CounterId, value: unknown): value is number {
	return value !== null && widgetFor(id).valid(value);
}
export function setWidgetSettings<K extends WidgetId>(
	layout: LayoutState,
	id: K,
	patch: Partial<LayoutState['widgets'][K]>
): LayoutState {
	const next = { ...layout.widgets[id], ...patch };
	return { widgets: { ...layout.widgets, [id]: next } };
}
export function manualWidgetValue<K extends WidgetId>(
	data: WidgetData,
	day: DateKey,
	id: K
): WidgetValues[K] | undefined {
	const storage = widgetFor(id).storage;
	const daily = data[storage.section][day];
	return (
		'key' in storage
			? (daily as Record<string, WidgetValues[WidgetId]> | undefined)?.[storage.key]
			: daily
	) as WidgetValues[K] | undefined;
}
export function widgetValue<K extends WidgetId>(
	data: WidgetData,
	day: DateKey,
	id: K
): WidgetValues[K] | undefined {
	const automated = data.automated[day]?.[id];
	return automated === undefined ? manualWidgetValue(data, day, id) : automated;
}

export function normalizeAutomatedValues(value: unknown): CalendarData['automated'] {
	return normalizeDays(value, (entry) => {
		if (!isRecord(entry)) return;
		const values = WIDGETS.filter(({ id, valid }) => valid(entry[id])).map(
			({ id }) => [id, entry[id]] as const
		);
		if (values.length) return Object.fromEntries(values);
	});
}

export function setAutomatedWidgetValue<K extends WidgetId>(
	data: CalendarData,
	day: DateKey,
	id: K,
	value: WidgetValues[K]
): CalendarData {
	if (!isDateKey(day) || !validWidgetValue(id, value)) return data;
	return {
		...data,
		automated: { ...data.automated, [day]: { ...data.automated[day], [id]: value } }
	};
}
export const isAttached = (data: WidgetData, day: DateKey, id: WidgetId) =>
	widgetValue(data, day, id) !== undefined;
export function isVisible<K extends WidgetId>(data: WidgetData, day: DateKey, id: K) {
	const { visibility } = data.layout.widgets[id];
	if (visibility === 'pinned') return true;
	if (visibility === 'hidden') return false;
	const value = widgetValue(data, day, id);
	if (value === undefined) return false;
	if (visibility === 'available') return true;
	const automated = data.automated[day]?.[id] !== undefined;
	const hasData = widgetFor(id).hasData as (
		value: WidgetValues[K],
		context: WidgetDataContext
	) => boolean;
	return hasData(value, { automated, screenApps: automated ? data.screenApps[day] : undefined });
}
export const canAttachWidget = (data: WidgetData, day: DateKey, id: WidgetId) =>
	data.layout.widgets[id].visibility === 'available' && !isAttached(data, day, id);
export function dayWidget(data: WidgetData, day: DateKey, id: WidgetId): WidgetInstance {
	const value = widgetValue(data, day, id);
	return {
		id,
		kind: widgetFor(id).kind,
		definition: widgetFor(id),
		skin: data.layout.widgets[id].skin,
		value: value === undefined ? widgetFor(id).initial : value,
		...(id === 'phone' && data.automated[day]?.phone !== undefined
			? { screenApps: data.screenApps[day] }
			: {})
	} as WidgetInstance;
}
export function setWidgetValue<T extends WidgetData, K extends WidgetId>(
	data: T,
	day: DateKey,
	id: K,
	value: WidgetValues[K]
): T {
	const definition = widgetFor(id);
	if (!isDateKey(day) || !definition.valid(value)) return data;
	const storage = definition.storage;
	const daily =
		'key' in storage ? { ...(data[storage.section][day] as object), [storage.key]: value } : value;
	return { ...data, [storage.section]: { ...data[storage.section], [day]: daily } };
}

export const attachWidget = <T extends WidgetData>(data: T, day: DateKey, id: WidgetId) =>
	canAttachWidget(data, day, id)
		? setWidgetValue(data, day, id, widgetFor(id).initial as WidgetValues[WidgetId])
		: data;

export function clearManualWidgetValue<T extends WidgetData>(
	data: T,
	day: DateKey,
	id: WidgetId
): T {
	const storage = widgetFor(id).storage;
	const days: Record<string, unknown> = { ...data[storage.section] };
	if ('key' in storage) {
		const values = { ...(days[day] as Record<string, unknown>) };
		delete values[storage.key];
		if (Object.keys(values).length) days[day] = values;
		else delete days[day];
	} else delete days[day];
	return { ...data, [storage.section]: days };
}

export function removeWidgetValue(data: CalendarData, day: DateKey, id: WidgetId): CalendarData {
	let next = clearManualWidgetValue(data, day, id);
	if (id === 'phone' && Object.hasOwn(data.screenApps, day)) {
		const screenApps = { ...data.screenApps };
		delete screenApps[day];
		next = { ...next, screenApps };
	}
	if (data.automated[day]?.[id] === undefined) return next;
	const automated = { ...data.automated };
	const values = { ...automated[day] };
	delete values[id];
	if (Object.keys(values).length) automated[day] = values;
	else delete automated[day];
	return { ...next, automated };
}
